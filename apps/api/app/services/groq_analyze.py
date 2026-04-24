from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx
from pydantic import ValidationError

from app.schemas.analyze import AnalyzeResponse
from app.services.risk_signals import merge_risk_with_rules

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

_SYSTEM = """You are SentinelX, a forensic communication analyst.
Given user text (possibly from OCR), respond with ONE JSON object only — no markdown, no prose outside JSON.

Schema (all scores are 0–100 unless noted):
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
  "intent": {
    "label": "scam" | "threat" | "complaint" | "normal",
    "confidence": <0-100>,
    "scores": { "scam": <0-100>, "threat": <0-100>, "complaint": <0-100>, "normal": <0-100> }
  },
  "risk": { "score": <0-100 overall risk of harm, fraud, or escalation>, "band": "low" | "medium" | "high" },
  "signals": [ "<6 short labels, kebab-case: e.g. phish-pattern, coercive-language, payment-request, urgency-pressure>" ],
  "rationale": "<2-5 sentences, concrete, cite short phrases from the text>"
}

Rules:
- For intent, "scam" = fraudulent extraction or impersonation; "threat" = direct harm, intimidation, extortion; "complaint" = product/service issues without fraud; "normal" = ordinary conversation.
- Sentiment/ emotion / tone / intent scores: reflect intensity; they need not sum to 100, but use the 0–100 scale.
- "risk" score reflects combined likelihood of real-world harm, fraud, or high-pressure manipulation (not just negative sentiment); band should be consistent: low<~38, medium<~65, else high.
- signals: 0-6 user-facing sub-labels; server may add deterministic checks — still include your best 3-6 here.
- If the text is empty noise, still return best-effort values with low confidence and neutral-leaning intent when appropriate.
- Detect manipulation, coercion, and scam pressure when present and reflect in tone, urgency, intent, risk, and signals.
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
        "temperature": 0.12,
        "max_tokens": 2000,
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
        parsed: dict[str, Any] = json.loads(raw_json)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Groq returned invalid JSON: {raw_json[:500]}") from e

    if not isinstance(parsed, dict):
        raise RuntimeError("Groq root JSON is not an object")
    try:
        merge_risk_with_rules(body_text, parsed)
    except Exception as e:  # pragma: no cover
        raise RuntimeError(f"Risk / signal merge failed: {e}") from e

    try:
        out = AnalyzeResponse.model_validate(
            {**parsed, "provider_model": model, "truncated": truncated},
        )
    except ValidationError as e:
        raise RuntimeError(f"Groq JSON failed validation: {e}") from e

    return out
