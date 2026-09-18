"""
mbi_router.py - morphology / linguistic metrics endpoints.

Routes:

    GET /mbi/{model_name}
        MBI metrics for one tokenizer on one language

    GET /compare_mbi
        MBI metrics for two tokenizers at once
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.schemas.mbi_schemas import (
    MBIComparisonResult,
    MBIComparisonTokenizerResult,
    MBIResult,
    MBIMetrics,
)

from app.services.NCHLT_dataset_service import load_nchlt_data

from app.services.morphology_service import (
    BoundaryVector,
    aggregate_results,
    compare_boundaries,
    to_boundary_vector,
)

from app.services.tokenizer import get_NCHLT_boundary_vector

from app.services.tokenizer_state import (
    get_or_load_tokenizer,
    validate_tokenizer,
)


router = APIRouter(tags=["mbi"])


BASE_DIR = Path(__file__).resolve().parents[3]

NCHLT_DIR = BASE_DIR / "datasets" / "NCHLT"


def _compute_mbi_for_language(model_name: str, language: str) -> MBIResult:
    """
    Compute morphological boundary identification metrics
    for one tokenizer and one NCHLT language.
    """

    if not language or not language.strip():
        raise HTTPException(
            status_code=400,
            detail="Language cannot be empty.",
        )

    validate_tokenizer(model_name)

    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )

    try:
        dataset = load_nchlt_data(str(NCHLT_DIR))
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )

    if language not in dataset:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language: {language}",
        )

    word_results = []

    for surface_word, gold_segmentation in dataset[language]:

        # Get tokenizer boundaries using character offset mapping.
        #
        # This avoids relying on tokenizer-specific markers such as:
        # ## for WordPiece
        # ▁ for SentencePiece
        # Ġ for GPT-style BPE
        predicted_boundaries = get_NCHLT_boundary_vector(
            tokenizer,
            surface_word,
        )

        predicted_vector = BoundaryVector(
            word=surface_word,
            boundaries=predicted_boundaries,
        )

        # Convert the NCHLT gold morpheme segmentation
        # into the same binary boundary-vector format.
        gold_vector = to_boundary_vector(
            surface_word,
            gold_segmentation,
        )

        # Compare tokenizer boundaries against the
        # NCHLT gold-standard boundaries.
        word_results.append(
            compare_boundaries(
                predicted_vector,
                gold_vector,
            )
        )

    # Micro-average TP, FP and FN across all words.
    metrics = aggregate_results(word_results)

    return MBIResult(
        model_name=model_name,
        language=language,
        words_evaluated=len(word_results),
        metrics=MBIMetrics(
            precision=metrics.precision,
            recall=metrics.recall,
            f1=metrics.f1,
        ),
    )


@router.get("/mbi/{model_name:path}", response_model=MBIResult)
def get_mbi(model_name: str, language: str):
    """
    Morphological boundary identification metrics for
    a tokenizer on one NCHLT language.

    Example call:

        GET /mbi/gpt2?language=isiZulu

    Example response:

        {
            "model_name": "gpt2",
            "language": "isiZulu",
            "words_evaluated": 331,
            "metrics": {
                "precision": 0.58,
                "recall": 0.61,
                "f1": 0.60
            }
        }
    """

    return _compute_mbi_for_language(
        model_name,
        language,
    )


@router.get("/compare_mbi", response_model=MBIComparisonResult)
def compare_mbi(
    model_a: str,
    model_b: str,
    language: str,
):
    """
    Compare the morphology scores of two tokenizers
    on the same NCHLT language.

    Example call:

        GET /compare_mbi?model_a=gpt2&model_b=bert-base-multilingual-cased&language=isiZulu
    """

    result_a = _compute_mbi_for_language(
        model_a,
        language,
    )

    result_b = _compute_mbi_for_language(
        model_b,
        language,
    )

    return MBIComparisonResult(
        language=language,
        tokenizer_a=MBIComparisonTokenizerResult(
            name=model_a,
            metrics=result_a.metrics,
            words_evaluated=result_a.words_evaluated,
        ),
        tokenizer_b=MBIComparisonTokenizerResult(
            name=model_b,
            metrics=result_b.metrics,
            words_evaluated=result_b.words_evaluated,
        ),
    )