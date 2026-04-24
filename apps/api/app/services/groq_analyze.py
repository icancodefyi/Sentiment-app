from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx
from pydantic import ValidationError

from app.schemas.analyze import AnalyzeResponse

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

_SYSTEM = """You are SentinelX, a forensic communication analyst.
Given user text (possibly from OCR), respond with ONE JSON object only — no markdown, no prose outside JSON.

Schema (all scores are 0–100 floats):
{
  "sentiment": {
    "label": "positive" | "negative" | "neutral",
    "confidence": <number 0-100 for the label>,
    "scores": { "positive": <0-100>, "negative": <0-100>, "neutral": <0-100> }
  },
  "emotions": {
    "fear": <0-100>, "anger": <0-100>, "joy": <0-100>, "sadness": <0-100>, "urgency": <0-100>
  },
  "tone": {
    "label": "aggressive" | "polite" | "manipulative",
    "scores": { "aggressive": <0-100>, "polite": <0-100>, "manipulative": <0-100> }
  },
  "rationale": "<2-4 sentences, concrete, cite phrases from the text>"
}

Rules:
- scores should roughly reflect intensity; they need not sum to 100 except sentiment.scores should be on a 0-100 scale and loosely reflect the mix.
- If text is empty noise, still return best-effort neutral sentiment with low confidence.
- Detect manipulation, coercion, or scam pressure when present and reflect in tone + urgency.
"""


def _strip_json_fence(s: str) -> str:
    s = s.strip()
    m = re.match(r"^```(?:json)?\s*([\s\S]*?)```\s*$", s, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return s


def _truncate(text: str, limit: int) -> tuple[str, bool]:
    if len(text) <= limit:
        return text, False
    return text[: limit - 20] + "\n…(truncated)", True


def analyze_with_groq(text: str) -> AnalyzeResponse:
    key = os.environ.get("GROQ_API_KEY", "").strip()
    if not key:
        raise RuntimeError("GROQ_API_KEY is not set. Add it to apps/api/.env for Phase 2.")

    model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
    body_text, truncated = _truncate(text.strip(), 14_000)

    payload: dict[str, Any] = {
        "model": model,
        "temperature": 0.15,
        "max_tokens": 1200,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {
                "role": "user",
                "content": f"Analyze the following text:\n\n{body_text}",
            },
        ],
    }

    with httpx.Client(timeout=60.0) as client:
        r = client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json=payload,
        )
        r.raise_for_status()
        data = r.json()

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"Unexpected Groq response shape: {data!r}") from e

    if not isinstance(content, str):
        raise RuntimeError("Groq returned non-string content")

    raw_json = _strip_json_fence(content)
    try:
        parsed = json.loads(raw_json)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Groq returned invalid JSON: {raw_json[:500]}") from e

    try:
        out = AnalyzeResponse.model_validate(
            {**parsed, "provider_model": model, "truncated": truncated},
        )
    except ValidationError as e:
        raise RuntimeError(f"Groq JSON failed validation: {e}") from e

    return out
