"""
rank_router.py - leaderboard endpoints.

Routes:
	GET    /leaderboard               list all tokenizers ranked by a metric
	POST   /leaderboard               create or update a tokenizer entry
	PATCH  /leaderboard/{id}          update metrics for an existing tokenizer
	DELETE /leaderboard/{id}          remove a tokenizer entry
"""

from fastapi import APIRouter, HTTPException

from app.schemas.leaderboard_schemas import LeaderboardUpdateRequest, LeaderboardUpsertRequest
from app.services.leaderboard_service import get_leaderboard, remove_tokenizer, update_metrics, upsert_tokenizer

router = APIRouter(tags=["leaderboard"])


@router.get("/leaderboard")
def list_leaderboard(sort_by: str = "compression_ratio", descending: bool = True):
	"""Return the leaderboard ordered by the requested metric."""
	try:
		return get_leaderboard(sort_by=sort_by, descending=descending)
	except ValueError as e:
		raise HTTPException(status_code=400, detail=str(e))


@router.post("/leaderboard")
def create_or_update_leaderboard_entry(request: LeaderboardUpsertRequest):
	"""Create a tokenizer entry or update the existing one with the same name."""
	tokenizer_id = upsert_tokenizer(request.name, request.metrics)
	return {"tokenizer_id": tokenizer_id, "name": request.name}


@router.patch("/leaderboard/{tokenizer_id:int}")
def patch_leaderboard_entry(tokenizer_id: int, request: LeaderboardUpdateRequest):
	"""Update one or more metrics for an existing tokenizer."""
	update_metrics(tokenizer_id, request.metrics)
	return {"tokenizer_id": tokenizer_id, "updated": True}


@router.delete("/leaderboard/{tokenizer_id:int}")
def delete_leaderboard_entry(tokenizer_id: int):
	"""Remove a tokenizer from the leaderboard."""
	remove_tokenizer(tokenizer_id)
	return {"tokenizer_id": tokenizer_id, "deleted": True}
