"""Pydantic schemas for leaderboard endpoints"""

from pydantic import BaseModel, Field


class LeaderboardUpsertRequest(BaseModel):
    """Data sent when creating a leaderboard entry."""
    name: str
    metrics: dict[str, float | int | None] = Field(default_factory=dict)


class LeaderboardUpdateRequest(BaseModel):
    """Data sent when updating leaderboard metrics."""
    metrics: dict[str, float | int | None] = Field(default_factory=dict)