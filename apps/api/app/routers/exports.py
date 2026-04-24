from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response

from app.services.pdf_report import build_record_pdf_bytes

router = APIRouter(prefix="/api/v1", tags=["exports"])


@router.get("/records/{rec_id}/export/pdf")
def export_record_pdf(rec_id: str) -> Response:
    """Download a structured PDF for one saved run (5.10)."""
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
