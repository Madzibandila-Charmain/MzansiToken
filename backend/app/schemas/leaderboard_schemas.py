"""Pydantic schemas for leaderboard endpoints."""
from pydantic import BaseModel, ConfigDict

class LeaderboardUpsertRequest(BaseModel):
    """Data sent when creating a leaderboard entry."""

    name: str

    model_config = ConfigDict(extra="forbid")
