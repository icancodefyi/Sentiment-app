from typing import Literal

from pydantic import BaseModel, Field


class EntityOut(BaseModel):
    type: str
    value: str
    start: int | None = None
    end: int | None = None


class IngestResponse(BaseModel):
    source: Literal["text", "image", "chat", "x_post"]
    raw_text: str
    cleaned_text: str
    chunks: list[str]
    entities: list[EntityOut]
    ocr_meta: dict | None = Field(
        default=None,
        description="OCR / image metadata; null for text, chat, and X post.",
    )
    ingest_meta: dict | None = Field(
        default=None,
        description="Extra context (e.g. X post URL, fetch method, author).",
    )


class TextIngestBody(BaseModel):
    text: str = Field(..., min_length=1, max_length=50_000)


class ChatMessage(BaseModel):
    role: str | None = Field(default=None, max_length=64)
    content: str = Field(..., min_length=1, max_length=20_000)


class ChatIngestBody(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=200)


class XPostIngestBody(BaseModel):
    url: str = Field(..., min_length=12, max_length=2048, description="https://x.com/.../status/... or twitter.com")
