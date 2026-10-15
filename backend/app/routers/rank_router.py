"""
rank_router.py - leaderboard endpoints.

Routes:

    GET    /leaderboard               list all active tokenizers
    GET    /leaderboard/scoring       return the overall-score formula
    GET    /leaderboard/saved/{name}  return saved measurements
    POST   /leaderboard               calculate and save a tokenizer
    POST   /leaderboard/{name}/restore
                                      restore saved measurements
    POST   /leaderboard/{name}/vocabulary
                                      fill in the vocabulary metrics of
                                      an entry saved before they existed
    DELETE /leaderboard/{id}          remove a tokenizer entry

Amended by Mukovhe Ranwashe (RNWMUK001)
September 2026
"""

from fastapi import APIRouter, HTTPException
from app.schemas.leaderboard_schemas import LeaderboardUpsertRequest
from app.services.scoring import BOUNDS, WEIGHTS, score_breakdown
from app.services.tokenizer_state import validate_tokenizer
from app.services.leaderboard_service import (
    get_leaderboard,
    get_saved_tokenizer,
    remove_tokenizer,
    upsert_tokenizer,
    restore_tokenizer,
    update_metrics,
)
from app.services.leaderboard_measurement_service import (
    VOCABULARY_METRICS,
    compute_leaderboard_metrics,
    compute_vocabulary_metrics,
)

router = APIRouter(tags=["leaderboard"])

# Helper function: attach computed score
def _with_score(metrics: dict) -> dict:
    """
    Take the incoming metrics dict and add the computed overall_score.
    - Important: we don't trust scores sent by the client.
    - Ensures consistency: every row's score is calculated server-side.
    """
    scored = dict(metrics)
    scored["overall_score"] = score_breakdown(scored)["overall_score"]
    return scored

# Endpoint 1: GET /leaderboard
@router.get("/leaderboard")
def list_leaderboard(sort_by: str = "overall_score", descending: bool = True):
    """
    Return the leaderboard ordered by the requested metric.
    - Default sort: overall_score, descending (highest first).
    - Client can override sort_by and order.
    """
    try:
        return get_leaderboard(sort_by=sort_by, descending=descending)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Endpoint 2: GET /leaderboard/scoring
@router.get("/leaderboard/scoring")
def describe_scoring():
    """
    Return the scoring formula details:
    - Which metrics are included.
    - How much each metric contributes (weights).
    - Bounds: values that map to score 0 and score 100.
    - Used by frontend to explain scoring transparently.
    """
    return {
        "weights": WEIGHTS,
        "bounds": {
            name: {"zero_at": low, "hundred_at": high}
            for name, (low, high) in BOUNDS.items()
        },
    }

# Endpoint 3: GET /leaderboard/saved/{name}
#
# {name:path}, not {name}. Over half the models we support have a vendor
# prefix - "openai-community/gpt2-large" - and a plain {name} only matches
# one path segment, so every one of those came back 404. The sibling
# restore route below already had it right.
@router.get("/leaderboard/saved/{name:path}")
def get_saved_leaderboard_entry(name: str):
    """
    Return a previously measured tokenizer and its saved metrics.

    This includes inactive tokenizers so the frontend can restore
    previous measurements without recalculating them.
    """
    tokenizer = get_saved_tokenizer(name)

    if tokenizer is None:
        raise HTTPException(
            status_code=404,
            detail="Tokenizer has no saved leaderboard measurement.",
        )

    return tokenizer

# Endpoint 4: POST /leaderboard
@router.post("/leaderboard")
def create_or_update_leaderboard(request: LeaderboardUpsertRequest):
    """
    Measure a tokenizer and put it on the board.

    The name is cleaned first and the cleaned one is used from there on.
    " gpt2" and "gpt2" are the same model, but as two different strings they
    would take two rows against a UNIQUE column, two leaderboard slots, and
    two full runs over the corpus.
    """
    name = validate_tokenizer(request.name)

    try:
        metrics = compute_leaderboard_metrics(name)
        metrics = _with_score(metrics)

        tokenizer_id = upsert_tokenizer(
            name,
            metrics
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except RuntimeError as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    return {
        "id": tokenizer_id,
        "name": name,
        "metrics": metrics,
    }

def _fill_vocabulary_metrics(tokenizer: dict) -> dict:
    """
    An entry saved before the vocabulary metrics existed has NULL for all
    three. Restoring it is the moment to fill them in: efficiency only (no
    morphology), usually from the cache, and the saved score is untouched
    because these are not part of it.

    Best effort. If the tokenizer cannot be loaded right now (Hugging Face
    unreachable, say), the restore still succeeds exactly as before and the
    three just stay empty - a restore must never fail over extra columns.
    """
    if all(tokenizer.get(name) is not None for name in VOCABULARY_METRICS):
        return tokenizer

    try:
        extra = compute_vocabulary_metrics(tokenizer["name"])
        update_metrics(tokenizer["id"], extra)
        return get_saved_tokenizer(tokenizer["name"]) or tokenizer

    except Exception as error:
        print(f"Could not fill the vocabulary metrics for {tokenizer['name']}: {error}")
        return tokenizer


# Endpoint 5: POST /leaderboard/{name}/restore
@router.post("/leaderboard/{name:path}/restore")
def restore_leaderboard_entry(name: str):
    try:
        tokenizer = restore_tokenizer(name)

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    tokenizer = _fill_vocabulary_metrics(tokenizer)

    return {
        "id": tokenizer["id"],
        "name": tokenizer["name"],
        "metrics": {
            "token_count": tokenizer.get("token_count"),
            "fertility": tokenizer.get("fertility"),
            "compression": tokenizer.get("compression"),
            "token_premium": tokenizer.get("token_premium"),
            "f1": tokenizer.get("f1"),
            "precision": tokenizer.get("precision"),
            "recall": tokenizer.get("recall"),
            "overall_score": tokenizer.get("overall_score"),
            **{name: tokenizer.get(name) for name in VOCABULARY_METRICS},
        },
    }

# Endpoint 5b: POST /leaderboard/{name}/vocabulary
@router.post("/leaderboard/{name:path}/vocabulary")
def fill_leaderboard_vocabulary(name: str):
    """
    Fill in the three vocabulary metrics for a saved entry that does not
    have them yet, and nothing else.

    Rank calls this for entries already on the board that were saved before
    these columns existed. It is deliberately not /restore: restoring puts
    an entry back on the board, and an entry the user removed a moment ago
    must stay removed. This never touches whether an entry is on the board,
    and never touches its score.

    Best effort, like the restore path: if the tokenizer cannot be loaded
    right now the entry is returned unchanged, with the three still empty.
    """
    saved = get_saved_tokenizer(name)

    if saved is None:
        raise HTTPException(
            status_code=404,
            detail="Tokenizer has no saved leaderboard measurement.",
        )

    filled = _fill_vocabulary_metrics(saved)

    return {
        "name": filled["name"],
        **{name: filled.get(name) for name in VOCABULARY_METRICS},
    }

# Endpoint 6: DELETE /leaderboard/{tokenizer_id}
@router.delete("/leaderboard/{tokenizer_id:int}")
def delete_leaderboard_entry(tokenizer_id: int):
    """
    Take a tokenizer off the active leaderboard.

    The measurements are kept, so the entry can be restored later without
    paying for the whole corpus again. "removed" says that plainly;
    "deleted" claimed something the database does not do.
    """
    if not remove_tokenizer(tokenizer_id):
        raise HTTPException(
            status_code=404,
            detail="No leaderboard entry with that id.",
        )

    return {"tokenizer_id": tokenizer_id, "removed": True}
