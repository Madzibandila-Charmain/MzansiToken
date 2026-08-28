"""
metrics_router.py - efficiency metrics endpoints (the RANK and COMPARE views).

Routes:
    GET /metrics/{model_name}   metrics for one tokenizer, every language
    GET /compare                metrics for two tokenizers at once
"""

from fastapi import APIRouter, HTTPException

from app.services.state import get_or_compute_metrics, get_or_load_tokenizer

router = APIRouter(tags=["metrics"])


@router.get("/metrics/{model_name:path}")
def get_metrics(model_name: str):
    """
    Efficiency metrics for a tokenizer across every language.

    React calls this to draw the charts. Returns token count, fertility,
    compression and token premium per language.

    Example call: GET /metrics/gpt2
    Example response:
        {
            "English": {"token_count": 25741, "fertility": 1.228, ...},
            "isiZulu": {"token_count": 61665, "fertility": 4.095, ...}
        }
    """
    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return get_or_compute_metrics(model_name, tokenizer)


@router.get("/compare")
def compare_tokenizers(model_a: str, model_b: str):
    """
    Metrics for two tokenizers at once, for the COMPARE dashboard.

    Each one is loaded separately so a bad model name says exactly which side
    failed.

    Example call: GET /compare?model_a=gpt2&model_b=xlm-roberta-base
    Example response:
        {
            "tokenizer_a": {"name": "gpt2", "metrics": {...}},
            "tokenizer_b": {"name": "xlm-roberta-base", "metrics": {...}}
        }
    """
    try:
        tokenizer_a = get_or_load_tokenizer(model_a)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Tokenizer A error: {e}")

    try:
        tokenizer_b = get_or_load_tokenizer(model_b)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Tokenizer B error: {e}")

    return {
        "tokenizer_a": {"name": model_a, "metrics": get_or_compute_metrics(model_a, tokenizer_a)},
        "tokenizer_b": {"name": model_b, "metrics": get_or_compute_metrics(model_b, tokenizer_b)},
    }