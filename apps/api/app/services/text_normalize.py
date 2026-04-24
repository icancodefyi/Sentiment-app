import re
import unicodedata


_ZW_RE = re.compile(r"[\u200b\u200c\u200d\ufeff]")


def normalize_text(text: str) -> str:
    t = unicodedata.normalize("NFKC", text)
    t = _ZW_RE.sub("", t)
    t = re.sub(r"[ \t\r\f\v]+", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def chunk_text(text: str, max_chars: int = 2500, overlap: int = 200) -> list[str]:
    if len(text) <= max_chars:
        return [text] if text else []
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(0, end - overlap)
    return chunks
