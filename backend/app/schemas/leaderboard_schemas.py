"""Pydantic schemas for leaderboard endpoints."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


LeaderboardMetricName = Literal[
    "token_count",
    "fertility",
    "compression",
    "token_premium",
    "f1",
    "precision",
    "recall",
]

class LeaderboardUpsertRequest(BaseModel):
    """Data sent when creating a leaderboard entry."""

    name: str

    model_config = ConfigDict(extra="forbid")

class LeaderboardUpdateRequest(BaseModel):
    """Data sent when updating leaderboard metrics."""

    metrics: dict[
        LeaderboardMetricName,
        float | int | None
    ] = Field(default_factory=dict)

    model_config = ConfigDict(extra="forbid")