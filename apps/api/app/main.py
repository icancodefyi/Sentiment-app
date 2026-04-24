from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Sentilx API", version="0.1.0")


class SentimentRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text to analyze")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/sentiment")
def analyze_sentiment(body: SentimentRequest) -> dict:
    """Placeholder: replace with your model or service integration."""
    text = body.text.strip()
    return {
        "text": text[:500],
        "label": "neutral",
        "score": 0.0,
        "note": "Replace this endpoint with real sentiment analysis.",
    }
