from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId

from app.db.mongo import get_mongo_uri, get_records_collection


def get_record_row_by_id(rec_id: str) -> dict[str, Any] | None:
    if not get_mongo_uri():
        return None
    col = get_records_collection()
    try:
        oid = ObjectId(rec_id)
    except InvalidId:
        return None
    row = col.find_one({"_id": oid})
    if row and isinstance(row.get("created_at"), datetime):
        c = row["created_at"]
        if c.tzinfo is None:
            row = {**row, "created_at": c.replace(tzinfo=timezone.utc)}
    return row
