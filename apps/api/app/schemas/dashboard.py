from __future__ import annotations

from pydantic import BaseModel, Field


class PerDayPoint(BaseModel):
    date: str
    run_count: int
    avg_risk: float


class EmotionDayPoint(BaseModel):
    date: str
    """Daily averages of emotion 0–100 (mean over runs that day)."""
    fear: float
    anger: float
    joy: float
    sadness: float
    urgency: float
    run_count: int = 0


class DashboardSummaryOut(BaseModel):
    period_days: int
    total_runs: int
    avg_risk: float
    by_intent: dict[str, int] = Field(default_factory=dict)
    by_risk_band: dict[str, int] = Field(default_factory=dict)
    by_sentiment: dict[str, int] = Field(default_factory=dict)
    runs_per_day: list[PerDayPoint] = Field(
        default_factory=list,
        description="Daily run volume and average risk (0–100)",
    )
    emotion_timeline: list[EmotionDayPoint] = Field(
        default_factory=list,
        description="Daily mean emotion surface (0–100 per dimension)",
    )
