from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.routers.ingest import router as ingest_router

app = FastAPI(title="Sentilx API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest_router)


class SentimentRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text to analyze")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


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
