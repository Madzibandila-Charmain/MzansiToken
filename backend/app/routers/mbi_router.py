"""
mbi_router.py - morphology / linguistic metrics endpoints.

Routes:

    GET /mbi/{model_name}
        MBI metrics for one tokenizer on one language

    GET /compare_mbi
        MBI metrics for two tokenizers at once

Amended by Mukovhe Ranwashe
18 September 2026 

    /morphology-languages is new. RANK needs to know which languages can
    be scored, and that set is read from the dataset rather than assumed -
    it has changed once already.

"""

from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.schemas.mbi_schemas import (
    MBIComparisonResult,
    MBIComparisonTokenizerResult,
    MBIResult,
    MBIMetrics,
)

from app.services.nchlt_state import available_languages, get_or_compute_mbi

from app.services.tokenizer_state import (get_or_load_tokenizer, validate_tokenizer,)

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
        result = get_or_compute_mbi(model_name, language, tokenizer)

    except FileNotFoundError as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )

    except KeyError:
        # Wording preserved exactly: Compare.jsx and Rank.jsx both test for
        # "Unsupported language" to tell a language with no NCHLT data apart from a real failure.
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language: {language}",
        )

    except ValueError as e:
        # A slow tokenizer, or one whose offsets do not cover the word. Nothing the server can fix, and not a server fault either.
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )

    return MBIResult(
        model_name=model_name,
        language=language,
        words_evaluated=result["words_evaluated"],
        metrics=MBIMetrics(
            precision=result["metrics"]["precision"],
            recall=result["metrics"]["recall"],
            f1=result["metrics"]["f1"],
            aligned_boundaries=result["metrics"]["aligned_boundaries"],
            total_gold_boundaries=result["metrics"]["total_gold_boundaries"],
        ),
    )

@router.get("/morphology-languages")
def list_morphology_languages():
    """
    The languages NCHLT has gold segmentations for.

    RANK calls this so it only asks for morphology where there is any to get, 
    rather than firing a request per FLORES language and letting the English one fail every time.

    Example response:
        {"languages": ["Sepedi", "Sesotho", "Setswana", ...]}
    """
    try:
        return {"languages": available_languages()}

    except FileNotFoundError as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
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