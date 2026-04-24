from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.db.mongo import get_mongo_uri
from app.schemas.dashboard import DashboardSummaryOut
from app.services.dashboard_agg import build_dashboard_summary, load_records_in_window

router = APIRouter(prefix="/api/v1", tags=["dashboard"])


@router.get("/dashboard/summary", response_model=DashboardSummaryOut)
def dashboard_summary(period_days: int = Query(30, ge=1, le=1825)) -> DashboardSummaryOut:
    """5.12 — aggregates for trends, stats, and emotion over time (Mongo)."""
    if not get_mongo_uri():
        raise HTTPException(
            status_code=503,
            detail="Set MONGODB_URI in apps/api/.env to use the dashboard",
        )
    recs = load_records_in_window(period_days=period_days)
    return build_dashboard_summary(recs, period_days=period_days)
