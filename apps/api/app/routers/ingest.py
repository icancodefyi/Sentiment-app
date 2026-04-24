from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas.ingest import ChatIngestBody, IngestResponse, TextIngestBody
from app.services.entities import extract_entities
from app.services.ocr_service import OCRNotAvailableError, ocr_image_bytes
from app.services.text_normalize import chunk_text, normalize_text

router = APIRouter(prefix="/api/v1/ingest", tags=["ingest"])

_ALLOWED_IMAGE = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"}
_MAX_IMAGE_BYTES = 12 * 1024 * 1024


def _build_response(
    source: Literal["text", "image", "chat"],
    raw: str,
    ocr_meta: dict | None = None,
) -> IngestResponse:
    cleaned = normalize_text(raw)
    chunks = chunk_text(cleaned)
    entities = extract_entities(cleaned)
    return IngestResponse(
        source=source,
        raw_text=raw,
        cleaned_text=cleaned,
        chunks=chunks,
        entities=entities,
        ocr_meta=ocr_meta,
    )


@router.post("/text", response_model=IngestResponse)
def ingest_text(body: TextIngestBody) -> IngestResponse:
    return _build_response("text", body.text)


@router.post("/chat", response_model=IngestResponse)
def ingest_chat(body: ChatIngestBody) -> IngestResponse:
    parts: list[str] = []
    for m in body.messages:
        prefix = f"{m.role}: " if m.role else ""
        parts.append(f"{prefix}{m.content}".strip())
    raw = "\n\n".join(parts)
    return _build_response("chat", raw)


@router.post("/image", response_model=IngestResponse)
async def ingest_image(
    file: Annotated[UploadFile, File(description="PNG, JPEG, WebP, or GIF")],
    context_text: Annotated[str | None, Form()] = None,
) -> IngestResponse:
    if file.content_type not in _ALLOWED_IMAGE:
        raise HTTPException(
            400,
            detail=f"Unsupported type {file.content_type!r}. Allowed: {sorted(_ALLOWED_IMAGE)}",
        )
    data = await file.read()
    if len(data) > _MAX_IMAGE_BYTES:
        raise HTTPException(400, detail="Image too large (max 12MB)")
    if not data:
        raise HTTPException(400, detail="Empty file")

    try:
        ocr_text, ocr_meta = ocr_image_bytes(data)
    except OCRNotAvailableError as e:
        raise HTTPException(503, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(400, detail=str(e)) from e
    except Exception as e:  # pragma: no cover
        raise HTTPException(500, detail=f"OCR failed: {e}") from e

    raw_parts: list[str] = []
    if context_text and context_text.strip():
        raw_parts.append(context_text.strip())
    if ocr_text:
        raw_parts.append(ocr_text)
    raw = "\n\n".join(raw_parts).strip()
    if not raw:
        raw = "(no text detected in image)"

    return _build_response("image", raw, ocr_meta=ocr_meta)
