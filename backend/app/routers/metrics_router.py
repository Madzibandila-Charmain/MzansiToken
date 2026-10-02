"""
metrics_router.py - efficiency metrics endpoints (the RANK and COMPARE views).

Routes:
    GET /metrics/{model_name}   metrics for one tokenizer, every language
    GET /compare                metrics for two tokenizers at once
"""

from fastapi import APIRouter, HTTPException

from app.services.flores_state import get_or_compute_metrics
from app.services.tokenizer_state import get_or_load_tokenizer

router = APIRouter(tags=["metrics"])


@router.get("/metrics/bulk")
def get_metrics_bulk(names: str):
    """
    Efficiency metrics for several tokenizers at once, keyed by name.

    Rank's per-language grid used to call GET /metrics/{name} once per
    board row - up to ten separate HTTP round trips, every single time
    the page loaded, to re-read data that get_or_compute_metrics had
    already cached for any tokenizer already on the board. This
    collapses that into one request. Each tokenizer is still looked up
    one at a time inside this function - a tokenizer that has never
    been measured before still has to tokenize the whole corpus, and
    firing several of those concurrently is exactly what the old
    one-at-a-time design was protecting the API from - but there is no
    longer an HTTP round trip between them, so a board of already-
    cached tokenizers now resolves in one request instead of N.

    `names` is a comma-separated list. A name that fails to load is
    reported under "errors" rather than failing the whole batch - one
    bad id should cost one row, not the grid.

    Registered before /metrics/{model_name:path} on purpose: that route
    uses a greedy :path converter and would otherwise swallow
    "/metrics/bulk" as a literal tokenizer name called "bulk".

    Example call: GET /metrics/bulk?names=gpt2,bert-base-uncased
    Example response:
        {
            "metrics": {"gpt2": {...}, "bert-base-uncased": {...}},
            "errors": {}
        }
    """
    requested = [
        name
        for name in (candidate.strip() for candidate in names.split(","))
        if name
    ]

    results = {}
    errors = {}

    for name in requested:
        try:
            tokenizer = get_or_load_tokenizer(name)
            results[name] = get_or_compute_metrics(name, tokenizer)
        except ValueError as e:
            errors[name] = str(e)
        except HTTPException as e:
            # get_or_load_tokenizer validates the name (empty, too
            # long, not a Hugging Face-shaped id) before ever trying
            # to load it, and raises HTTPException directly for that -
            # the single-tokenizer endpoints below let it propagate
            # and fail their one request. A batch should not let one
            # malformed name take the other nine down with it.
            errors[name] = str(e.detail)

    return {"metrics": results, "errors": errors}


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