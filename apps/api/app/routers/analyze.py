import httpx
from fastapi import APIRouter, HTTPException

from app.schemas.analyze import AnalyzeRequest, AnalyzeResponse
from app.services.groq_analyze import analyze_with_groq

router = APIRouter(prefix="/api/v1", tags=["analyze"])


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(body: AnalyzeRequest) -> AnalyzeResponse:
    """Phase 2: sentiment, emotion, and tone via Groq (JSON-only)."""
    try:
        return analyze_with_groq(body.text)
    except RuntimeError as e:
        msg = str(e)
        if "GROQ_API_KEY" in msg:
            raise HTTPException(status_code=503, detail=msg) from e
        raise HTTPException(status_code=502, detail=msg) from e
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=e.response.text or str(e),
        ) from e
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=502, detail=f"Analysis failed: {e}") from e
