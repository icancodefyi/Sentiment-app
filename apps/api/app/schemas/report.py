from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class EmailReportBody(BaseModel):
    to: EmailStr | None = Field(
        default=None,
        description="If omitted, uses REPORT_EMAIL_TO from apps/api/.env",
    )
    message: str | None = Field(default=None, max_length=2_000)
