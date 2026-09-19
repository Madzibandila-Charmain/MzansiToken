"""
rank_router.py - leaderboard endpoints.

Routes:
	GET    /leaderboard               list all tokenizers ranked by a metric
	GET    /leaderboard/scoring       the formula behind overall_score
	POST   /leaderboard               create or update a tokenizer entry
	PATCH  /leaderboard/{id}          update metrics for an existing tokenizer
	DELETE /leaderboard/{id}          remove a tokenizer entry

Amended by Mukovhe Ranwashe (RNWMUK001)
September 2026
"""

from fastapi import APIRouter, HTTPException
from app.schemas.leaderboard_schemas import LeaderboardUpdateRequest, LeaderboardUpsertRequest
from app.services.scoring import BOUNDS, SCORED_METRICS, WEIGHTS, score_breakdown
from app.services.leaderboard_service import (
    get_leaderboard,
    get_saved_tokenizer,
    remove_tokenizer,
    update_metrics,
    upsert_tokenizer,
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


# Helper function: fetch existing metrics for a tokenizer
def _existing_metrics(tokenizer_id: int) -> dict:
    """
    Get the metrics already stored for a given tokenizer ID.
    - PATCH requests only send partial updates.
    - We merge stored values with the patch to avoid losing data.
    - Example: patching fertility alone should not erase morphology metrics.
    """
    for row in get_leaderboard(sort_by="name", descending=False):
        if row.get("id") == tokenizer_id:
            return {key: row.get(key) for key in SCORED_METRICS}
    return {}


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
@router.get("/leaderboard/saved/{name}")
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
def create_or_update_leaderboard_entry(request: LeaderboardUpsertRequest):
    """
    Create a new tokenizer entry OR update an existing one with the same name.
    - Uses upsert_tokenizer service.
    - Always recalculates overall_score before saving.
    """
    tokenizer_id = upsert_tokenizer(request.name, _with_score(request.metrics))
    return {"tokenizer_id": tokenizer_id, "name": request.name}


# Endpoint 5: PATCH /leaderboard/{id}
@router.patch("/leaderboard/{tokenizer_id:int}")
def patch_leaderboard_entry(tokenizer_id: int, request: LeaderboardUpdateRequest):
    """
    Update one or more metrics for an existing tokenizer.
    - Merge stored metrics with incoming patch.
    - Recompute overall_score after merge.
    """
    merged = {**_existing_metrics(tokenizer_id), **request.metrics}
    update_metrics(tokenizer_id, _with_score(merged))
    return {"tokenizer_id": tokenizer_id, "updated": True}


# Endpoint 6: DELETE /leaderboard/{id}
@router.delete("/leaderboard/{tokenizer_id:int}")
def delete_leaderboard_entry(tokenizer_id: int):
    """
    Remove a tokenizer entry from the leaderboard.
    - Calls remove_tokenizer service.
    - Returns confirmation payload.
    """
    remove_tokenizer(tokenizer_id)
    return {"tokenizer_id": tokenizer_id, "deleted": True}
