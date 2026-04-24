from __future__ import annotations

import os
from typing import Any

_mongo_client: Any = None
_indexes_ensured = False


def get_mongo_uri() -> str | None:
    """URI from env. Supports both MONGODB_URI and lowercase mongodb_uri in .env."""
    return (
        os.environ.get("MONGODB_URI", "").strip()
        or os.environ.get("mongodb_uri", "").strip()
        or None
    )


def get_mongo_db_name() -> str:
    return (os.environ.get("MONGODB_DB") or os.environ.get("mongodb_db") or "sentilx").strip()


def get_mongo() -> Any:
    """Lazily construct PyMongo client + database."""
    from pymongo import MongoClient
    from pymongo.database import Database

    global _mongo_client, _indexes_ensured
    uri = get_mongo_uri()
    if not uri:
        raise RuntimeError("Mongo is not configured (set MONGODB_URI or mongodb_uri in apps/api/.env)")

    if _mongo_client is None:
        _mongo_client = MongoClient(uri, serverSelectionTimeoutMS=8_000)
    db: Database = _mongo_client[get_mongo_db_name()]

    if not _indexes_ensured:
        _indexes_ensured = True
        try:
            db["analysis_records"].create_index("created_at")
        except Exception:  # pragma: no cover
            pass
    return db


def get_records_collection() -> Any:
    return get_mongo()["analysis_records"]


def ping_mongo() -> bool:
    if not get_mongo_uri():
        return False
    try:
        get_mongo().command("ping")
    except Exception:
        return False
    return True
