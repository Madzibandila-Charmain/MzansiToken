"""
mbi_router.py - morphology / linguistic metrics endpoints.

Routes:
    GET /mbi/{model_name}   MBI metrics for one tokenizer on one language
    GET /compare_mbi        MBI metrics for two tokenizers at once
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.services.NCHLT_dataset_service import load_nchlt_data
from app.services.morphology_service import aggregate_results, compare_boundaries, to_boundary_vector
from app.services.tokenizer import tokenize_NCHLT
from app.services.tokenizer_state import get_or_load_tokenizer, validate_tokenizer

router = APIRouter(tags=["mbi"])

BASE_DIR = Path(__file__).resolve().parents[3]
NCHLT_DIR = BASE_DIR / "datasets" / "NCHLT"


def _compute_mbi_for_language(model_name: str, language: str) -> dict:
    """Compute morphological boundary identification metrics for one tokenizer and language."""
    if not language or not language.strip():
        raise HTTPException(status_code=400, detail="Language cannot be empty.")

    validate_tokenizer(model_name)

    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        dataset = load_nchlt_data(str(NCHLT_DIR))
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if language not in dataset:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {language}")

    word_results = []
    for surface_word, gold_segmentation in dataset[language]:
        predicted_tokens = tokenize_NCHLT(tokenizer, [(surface_word, gold_segmentation)])
        predicted_segmentation = predicted_tokens[0][1]
        predicted_vector = to_boundary_vector(surface_word, predicted_segmentation)
        gold_vector = to_boundary_vector(surface_word, gold_segmentation)
        word_results.append(compare_boundaries(predicted_vector, gold_vector))

    metrics = aggregate_results(word_results)
    return {
        "model_name": model_name,
        "language": language,
        "words_evaluated": len(word_results),
        "metrics": {
            "precision": metrics.precision,
            "recall": metrics.recall,
            "f1": metrics.f1,
        },
    }


@router.get("/mbi/{model_name:path}")
def get_mbi(model_name: str, language: str):
    """
    Morphological boundary identification metrics for a tokenizer on one language.

    Example call: GET /mbi/gpt2?language=isiZulu
    Example response:
        {
            "model_name": "gpt2",
            "language": "isiZulu",
            "words_evaluated": 331,
            "metrics": {"precision": 0.58, "recall": 0.61, "f1": 0.60}
        }
    """
    return _compute_mbi_for_language(model_name, language)


@router.get("/compare_mbi")
def compare_mbi(model_a: str, model_b: str, language: str):
    """
    Compare the morphology scores of two tokenizers on the same NCHLT language.

    Example call: GET /compare_mbi?model_a=gpt2&model_b=bert-base-multilingual-cased&language=isiZulu
    """
    result_a = _compute_mbi_for_language(model_a, language)
    result_b = _compute_mbi_for_language(model_b, language)

    return {
        "language": language,
        "tokenizer_a": {
            "name": model_a,
            "metrics": result_a["metrics"],
            "words_evaluated": result_a["words_evaluated"],
        },
        "tokenizer_b": {
            "name": model_b,
            "metrics": result_b["metrics"],
            "words_evaluated": result_b["words_evaluated"],
        },
    }

