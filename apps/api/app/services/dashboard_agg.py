from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from app.schemas.dashboard import (
    DashboardSummaryOut,
    EmotionDayPoint,
    PerDayPoint,
)


def _day_key(dt: Any) -> str:
    if isinstance(dt, datetime):
        v = dt
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        v = v.astimezone(timezone.utc)
        return v.strftime("%Y-%m-%d")
    if isinstance(dt, str):
        return dt[:10] if len(dt) >= 10 else dt
    return "unknown"


def build_dashboard_summary(
    records: list[dict[str, Any]],
    period_days: int,
) -> DashboardSummaryOut:
    if not records:
        return DashboardSummaryOut(
            period_days=period_days,
            total_runs=0,
            avg_risk=0.0,
            by_intent={},
            by_risk_band={},
            by_sentiment={},
            runs_per_day=[],
            emotion_timeline=[],
        )

    total_r = 0.0
    by_intent: dict[str, int] = defaultdict(int)
    by_band: dict[str, int] = defaultdict(int)
    by_sent: dict[str, int] = defaultdict(int)
    n = 0

    by_day_runs: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in records:
        n += 1
        a = row.get("analysis") or {}
        r = a.get("risk") or {}
        it = a.get("intent") or {}
        se = a.get("sentiment") or {}
        try:
            total_r += float(r.get("score", 0) or 0)
        except (TypeError, ValueError):
            pass
        il = str(it.get("label", "normal") or "normal")
        by_intent[il] += 1
        by_band[str(r.get("band", "low") or "low")] += 1
        by_sent[str(se.get("label", "neutral") or "neutral")] += 1
        dk = _day_key(row.get("created_at"))
        by_day_runs[dk].append(row)

    avg_r = total_r / n if n else 0.0

    # Sort days
    days_sorted = sorted(by_day_runs.keys())
    runs_per: list[PerDayPoint] = []
    emo_t: list[EmotionDayPoint] = []

    def _avgf(xs: list[float]) -> float:
        return float(sum(xs) / len(xs)) if xs else 0.0

    for d in days_sorted:
        day_rows = by_day_runs[d]
        c = len(day_rows)
        rs: list[float] = []
        e_f: list[float] = []
        e_a: list[float] = []
        e_j: list[float] = []
        e_s: list[float] = []
        e_u: list[float] = []
        for row in day_rows:
            a = row.get("analysis") or {}
            r = a.get("risk") or {}
            e = a.get("emotions") or {}
            try:
                rs.append(float(r.get("score", 0) or 0))
            except (TypeError, ValueError):
                pass
            for bucket, name in ((e_f, "fear"), (e_a, "anger"), (e_j, "joy"), (e_s, "sadness"), (e_u, "urgency")):
                try:
                    bucket.append(float(e.get(name, 0) or 0))  # type: ignore[union-attr]
                except (TypeError, ValueError):
                    pass
        runs_per.append(PerDayPoint(date=d, run_count=c, avg_risk=_avgf(rs)))
        emo_t.append(
            EmotionDayPoint(
                date=d,
                run_count=c,
                fear=_avgf(e_f),
                anger=_avgf(e_a),
                joy=_avgf(e_j),
                sadness=_avgf(e_s),
                urgency=_avgf(e_u),
            ),
        )

    return DashboardSummaryOut(
        period_days=period_days,
        total_runs=n,
        avg_risk=round(avg_r, 2),
        by_intent=dict(by_intent),
        by_risk_band=dict(by_band),
        by_sentiment=dict(by_sent),
        runs_per_day=runs_per,
        emotion_timeline=emo_t,
    )


def load_records_in_window(period_days: int, cap: int = 5_000) -> list[dict[str, Any]]:
    from app.db.mongo import get_mongo_uri, get_records_collection

    if not get_mongo_uri():
        return []
    since = datetime.now(timezone.utc) - timedelta(days=period_days)
    col = get_records_collection()
    cur = col.find({"created_at": {"$gte": since}}).sort("created_at", 1).limit(cap)
    return list(cur)
