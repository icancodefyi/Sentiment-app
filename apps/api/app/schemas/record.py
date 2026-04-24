from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field, field_serializer

from app.schemas.analyze import AnalyzeResponse
from app.schemas.ingest import IngestResponse


class SaveRecordBody(BaseModel):
    """Persist one ingest+analyze run; usually called by the web after a successful run."""

    ingest: IngestResponse
    analysis: AnalyzeResponse


class SaveRecordOut(BaseModel):
    id: str
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )

    @field_serializer("created_at")
    def s_created(self, v: datetime) -> str:
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v.isoformat()


class RecordListItem(BaseModel):
    id: str
    created_at: str
    source: str
    text_preview: str
    risk_score: float
    risk_band: str
    intent_label: str
    has_image_ingest: bool = False


class FullRecordOut(BaseModel):
    id: str
    created_at: str
    ingest: dict[str, Any]
    analysis: dict[str, Any]
