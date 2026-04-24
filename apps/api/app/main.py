from pathlib import Path

from app.platform_io import ensure_utf8_stdio

ensure_utf8_stdio()

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.db.mongo import get_mongo_uri, ping_mongo
from app.routers.analyze import router as analyze_router
from app.routers.dashboard import router as dashboard_router
from app.routers.exports import router as exports_router
from app.routers.ingest import router as ingest_router
from app.routers.records import router as records_router

_env = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env)

app = FastAPI(title="Sentilx API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest_router)
app.include_router(analyze_router)
app.include_router(records_router)
app.include_router(exports_router)
app.include_router(dashboard_router)


@app.get("/api/v1")
def api_v1_index() -> dict[str, object]:
    """Quick sanity check when debugging 404s (wrong process / wrong port)."""
    return {
        "service": "sentilx-api",
        "ingest": {
            "text": "POST /api/v1/ingest/text",
            "chat": "POST /api/v1/ingest/chat",
            "image": "POST /api/v1/ingest/image (multipart)",
        },
        "analyze": "POST /api/v1/analyze (sentiment, tone, intent, risk, signals)",
        "records": "POST/GET /api/v1/records (MongoDB)",
        "export_pdf": "GET /api/v1/records/{id}/export/pdf",
        "dashboard": "GET /api/v1/dashboard/summary?period_days=30",
        "docs": "/docs",
    }


class SentimentRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text to analyze")


@app.get("/health")
def health() -> dict[str, str]:
    # If this shape is missing in the browser, you are not hitting this FastAPI app.
    h: dict[str, str] = {
        "status": "ok",
        "app": "sentilx-api",
        "api_version": "0.1",
    }
    if not get_mongo_uri():
        h["mongo"] = "unconfigured"
    else:
        h["mongo"] = "ok" if ping_mongo() else "error"
    return h


@app.post("/api/sentiment")
def analyze_sentiment(body: SentimentRequest) -> dict:
    """Legacy placeholder; Phase 2+ will replace with real analysis."""
    text = body.text.strip()
    return {
        "text": text[:500],
        "label": "neutral",
        "score": 0.0,
        "note": "Use /api/v1/ingest/* for Phase 1 ingest + OCR.",
    }
