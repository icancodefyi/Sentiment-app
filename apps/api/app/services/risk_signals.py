from __future__ import annotations

import re
from typing import Literal

# Tuned to surface likely scam / manipulation signals without over-firing on support copy.
_URGENCY = re.compile(
    r"\b("
    r"urgent|immediately|right\s*now|within\s*24|within\s*hours?|act\s*now|"
    r"expires?\s*soon|time\s*sensitive|last\s*chance|verify\s*now|"
    r"or\s*else|account\s*(?:will\s*be|is\s*being)\s*(?:closed|suspended|locked|terminated)"
    r")\b",
    re.I,
)
_PAYMENT = re.compile(
    r"\b("
    r"pay|payment|send\s*money|wire|transfer|upi|ifsc|"
    r"cryptocurrency|bitcoin|usdt|gift\s*card|voucher|"
    r"bank\s*details|account\s*number|routing|swift"
    r")\b",
    re.I,
)
_AUTH = re.compile(
    r"\b("
    r"dear\s*customer|security\s*team|irs|tax\s*department|"
    r"verif(?:y|ication)\s*your\s*account|suspended|"
    r"unusual\s*activity|click\s*here|confirm\s*your"
    r")\b",
    re.I,
)
_PHONE_OR_LINK = re.compile(
    r"(\+?\d{1,3}[-.\s]?\(?\d{2,4}\)[-.\s]?\d{3,}|\bhttps?://\S+)",
    re.I,
)
_PRIZE = re.compile(
    r"\b(prize|lottery|winner|congratulations\s+you|claim\s+your|free\s+money|refund\s+of)\b",
    re.I,
)

_SIGNAL_WEIGHTS: dict[str, int] = {
    "urgency-pressure": 14,
    "payment-request": 18,
    "authority-or-impersonation": 12,
    "suspicious-contact-or-link": 6,
    "prize-refund-bait": 10,
    # allow legacy snake if ever present
    "urgency_pressure": 14,
    "payment_request": 18,
    "authority_or_impersonation": 12,
    "suspicious_contact_or_link": 6,
    "prize_refund_bait": 10,
}

_MAX_BUMP = 36


def detect_rule_signals(text: str) -> list[str]:
    """Deterministic, explainable slugs; merged with model-provided `signals` in the API layer."""
    if not text or not str(text).strip():
        return []
    t = text
    out: list[str] = []
    if _URGENCY.search(t):
        out.append("urgency-pressure")
    if _PAYMENT.search(t):
        out.append("payment-request")
    if _AUTH.search(t):
        out.append("authority-or-impersonation")
    if _PHONE_OR_LINK.search(t) and (len(t) < 2000 or _PAYMENT.search(t) or _AUTH.search(t)):
        out.append("suspicious-contact-or-link")
    if _PRIZE.search(t):
        out.append("prize-refund-bait")
    return list(dict.fromkeys(out))


def risk_bump_from_rules(signals: list[str]) -> int:
    acc = 0
    for s in signals:
        w = _SIGNAL_WEIGHTS.get(s, 0)
        acc += w
    return min(_MAX_BUMP, acc)


def risk_band_for_score(n: int) -> Literal["low", "medium", "high"]:
    n = max(0, min(100, n))
    if n < 38:
        return "low"
    if n < 65:
        return "medium"
    return "high"


def merge_risk_with_rules(text: str, parsed: dict) -> None:
    """
    In-place: combine LLM `signals` with rule-based slugs, bump `risk.score`
    with bounded rule contribution, and set `risk.band` from the final score.
    """
    if "risk" not in parsed or not isinstance(parsed["risk"], dict):
        parsed["risk"] = {"score": 0, "band": "low"}
    rule_hits = detect_rule_signals(text)
    bump = risk_bump_from_rules(rule_hits)
    raw = float(parsed["risk"].get("score", 0))
    raw = max(0, min(100, raw))
    # Blend: preserve model while letting rules nudge the needle (capped)
    final = int(min(100, round(raw + min(32, int(bump * 0.45)))))
    def _kebab(s: str) -> str:
        return str(s).strip().lower().replace("_", "-")

    msigs = parsed.get("signals")
    if not isinstance(msigs, list):
        msigs = []
    from_llm = [_kebab(x) for x in msigs if x is not None and str(x).strip()]
    from_rules = [_kebab(x) for x in rule_hits]
    merged: list[str] = list(dict.fromkeys(from_llm + from_rules))[:24]
    parsed["risk"]["score"] = final
    parsed["risk"]["band"] = risk_band_for_score(final)
    parsed["signals"] = merged
