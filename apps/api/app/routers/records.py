from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException, Query

from app.db.mongo import get_mongo_uri, get_records_collection
from app.schemas.record import (
    FullRecordOut,
    RecordListItem,
    SaveRecordBody,
    SaveRecordOut,
)

router = APIRouter(prefix="/api/v1", tags=["records"])


def _require_mongo() -> None:
    if not get_mongo_uri():
        raise HTTPException(
            status_code=503,
            detail="Database not configured. Set MONGODB_URI or mongodb_uri in apps/api/.env",
        )


def _iso(dt: Any) -> str:
    if isinstance(dt, datetime):
        v = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        return v.isoformat()
    if isinstance(dt, str):
        return dt
    return ""


@router.post("/records", response_model=SaveRecordOut, status_code=201)
def save_record(body: SaveRecordBody) -> SaveRecordOut:
    """Store one combined ingest + Groq analysis (case / evidence trail)."""
    _require_mongo()
    col = get_records_collection()
    created = datetime.now(timezone.utc)
    doc: dict[str, Any] = {
        "created_at": created,
        "ingest": body.ingest.model_dump(mode="json"),
        "analysis": body.analysis.model_dump(mode="json"),
        "ingest_text_preview": (body.ingest.cleaned_text or "")[:400],
        "ingest_source": body.ingest.source,
    }
    r = col.insert_one(doc)
    return SaveRecordOut(
        id=str(r.inserted_id),
        created_at=created,
    )


@router.get("/records", response_model=list[RecordListItem])
def list_records(
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0, le=10_000),
) -> list[RecordListItem]:
    """Newest first; for dashboards / history."""
    _require_mongo()
    col = get_records_collection()
    out: list[RecordListItem] = []
    cur = col.find().sort("created_at", -1).skip(skip).limit(limit)
    for row in cur:
        aid = row.get("_id")
        analysis = row.get("analysis") or {}
        risk = (analysis or {}).get("risk") or {}
        intent = (analysis or {}).get("intent") or {}
        ingest = row.get("ingest") or {}
        out.append(
            RecordListItem(
                id=str(aid),
                created_at=_iso(row.get("created_at")),
                source=str(ingest.get("source", "")),
                text_preview=(str(row.get("ingest_text_preview", "")) or "—")[:400],
                risk_score=float(risk.get("score", 0) or 0),
                risk_band=str(risk.get("band", "low")),
                intent_label=str((intent or {}).get("label", "normal")),
                has_image_ingest=ingest.get("source") == "image",
            ),
        )
    return out


@router.get("/records/{rec_id}", response_model=FullRecordOut)
def get_record(rec_id: str) -> FullRecordOut:
    _require_mongo()
    col = get_records_collection()
    try:
        oid = ObjectId(rec_id)
    except InvalidId as e:
        raise HTTPException(status_code=400, detail="Invalid record id") from e
    row = col.find_one({"_id": oid})
    if not row:
        raise HTTPException(status_code=404, detail="Record not found")
    return FullRecordOut(
        id=rec_id,
        created_at=_iso(row.get("created_at")),
        ingest=dict(row.get("ingest") or {}),
        analysis=dict(row.get("analysis") or {}),
    )
