"""Windows: avoid charmap / UnicodeEncodeError from tqdm, EasyOCR, etc. (e.g. U+2588)."""

from __future__ import annotations

import sys


def ensure_utf8_stdio() -> None:
    if sys.platform != "win32":
        return
    for stream in (sys.stdout, sys.stderr):
        if stream is not None and hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except (OSError, ValueError, AttributeError):
                pass
