from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, HTTPException, Response
from pydantic import ValidationError

from app.schemas.report import EmailReportBody
from app.services.email_service import build_default_email_body, send_report_email, smtp_configured
from app.services.pdf_report import build_record_pdf_bytes

router = APIRouter(prefix="/api/v1", tags=["exports"])


@router.get("/records/{rec_id}/export/pdf")
def export_record_pdf(rec_id: str) -> Response:
    """5.10 — download a structured PDF for one saved run."""
    try:
        data = build_record_pdf_bytes(rec_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail="Record not found") from e
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"PDF build failed: {e}") from e
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="sentinelx-report-{rec_id}.pdf"'},
    )


@router.post("/records/{rec_id}/export/email")
def email_record_pdf(
    rec_id: str,
    data: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, str | bool]:
    """
    5.11 — email the PDF for a run. Configure SMTP* and REPORT_EMAIL_* in apps/api/.env.
    """
    import os

    if not smtp_configured():
        raise HTTPException(
            status_code=503,
            detail="SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, ... in apps/api/.env",
        )
    try:
        body = EmailReportBody.model_validate(data)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    default_to = (os.environ.get("REPORT_EMAIL_TO") or os.environ.get("report_email_to") or "").strip()
    to_addr = (str(body.to) if body.to else default_to or "").strip()
    if not to_addr:
        raise HTTPException(
            status_code=400,
            detail="No recipient. Pass { \"to\": \"you@x.com\" } or set REPORT_EMAIL_TO in apps/api/.env",
        )
    from app.db.record_access import get_record_row_by_id

    row = get_record_row_by_id(rec_id)
    if not row:
        raise HTTPException(status_code=404, detail="Record not found")
    try:
        pdf = build_record_pdf_bytes(rec_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail="Record not found") from e
    subj = f"SentinelX report {rec_id}"
    extra = (body.message or "").strip()
    btxt = build_default_email_body(row, rec_id)
    if extra:
        btxt += f"\nNote:\n{extra}\n"
    try:
        send_report_email(
            to_addr=to_addr,
            subject=subj,
            body_text=btxt,
            attachment_name=f"sentinelx-report-{rec_id}.pdf",
            attachment_bytes=pdf,
        )
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=502, detail=f"Send failed: {e}") from e
    return {"ok": True, "to": to_addr}
