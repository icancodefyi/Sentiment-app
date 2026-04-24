import re
from dataclasses import dataclass

from app.schemas.ingest import EntityOut


@dataclass(frozen=True)
class _Hit:
    type: str
    value: str
    start: int
    end: int


_EMAIL = re.compile(
    r"(?i)\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b",
)
_URL = re.compile(
    r"(?i)\bhttps?://[^\s<>\[\]\"']+|www\.[^\s<>\[\]\"']+",
)
_PHONE = re.compile(
    r"(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}\b",
)
_MONEY = re.compile(
    r"(?i)(?:₹|rs\.?|inr|usd|\$)\s?\d[\d,]*(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?\s?(?:usd|inr|dollars?|rupees?)\b",
)


def extract_entities(text: str) -> list[EntityOut]:
    hits: list[_Hit] = []

    def add(pat: re.Pattern[str], kind: str) -> None:
        for m in pat.finditer(text):
            hits.append(_Hit(kind, m.group(0), m.start(), m.end()))

    add(_EMAIL, "email")
    add(_URL, "url")
    add(_PHONE, "phone")
    add(_MONEY, "money")

    hits.sort(key=lambda h: h.start)
    out: list[EntityOut] = []
    last_end = -1
    for h in hits:
        if h.start < last_end:
            continue
        out.append(EntityOut(type=h.type, value=h.value, start=h.start, end=h.end))
        last_end = h.end
    return out
