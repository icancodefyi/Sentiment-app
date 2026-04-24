from __future__ import annotations

import io
from functools import lru_cache
from typing import Any

from app.platform_io import ensure_utf8_stdio
from PIL import Image, UnidentifiedImageError


class OCRNotAvailableError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _reader():
    ensure_utf8_stdio()
    try:
        import easyocr  # type: ignore[import-untyped]
    except ImportError as e:  # pragma: no cover
        raise OCRNotAvailableError(
            "easyocr is not installed. Run: pip install -r requirements.txt",
        ) from e
    # CPU dev server; set gpu=True if you have CUDA configured.
    return easyocr.Reader(["en"], gpu=False)


def ocr_image_bytes(data: bytes) -> tuple[str, dict[str, Any]]:
    try:
        img = Image.open(io.BytesIO(data))
    except UnidentifiedImageError as e:
        raise ValueError("Unrecognized image format") from e

    img = img.convert("RGB")
    import numpy as np

    arr = np.array(img)
    reader = _reader()
    lines = reader.readtext(arr)

    def sort_key(item: tuple) -> float:
        box = item[0]
        return float(box[0][1])

    lines_sorted = sorted(lines, key=sort_key)
    texts = [t[1] for t in lines_sorted if t[1].strip()]
    full = "\n".join(texts).strip()
    confs = [float(t[2]) for t in lines_sorted if t[1].strip()]
    meta: dict[str, Any] = {
        "line_count": len(texts),
        "avg_confidence": round(sum(confs) / len(confs), 4) if confs else None,
    }
    return full, meta
