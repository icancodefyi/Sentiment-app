from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.db.record_access import get_record_row_by_id


def _for_pdf(s: str, limit: int = 12_000) -> str:
    if not s:
        return ""
    t = s if len(s) <= limit else s[: limit - 3] + "…"
    return t.encode("cp1252", errors="replace").decode("cp1252", errors="replace")


def _fmt_dt(v: Any) -> str:
    if isinstance(v, datetime):
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    if isinstance(v, str):
        return v
    return "—"


def build_record_pdf_bytes(rec_id: str) -> bytes:
    row = get_record_row_by_id(rec_id)
    if not row:
        raise FileNotFoundError("Record not found")

    ingest: dict[str, Any] = dict(row.get("ingest") or {})
    analysis: dict[str, Any] = dict(row.get("analysis") or {})
    created = _fmt_dt(row.get("created_at"))
    title = f"SentinelX — analysis report {rec_id}"
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.7 * inch,
        title=title,
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], spaceAfter=10, textColor=colors.HexColor("#1a1a1a"))
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], spaceAfter=6, textColor=colors.HexColor("#4a3f35"))
    body = ParagraphStyle("b", parent=styles["BodyText"], fontSize=9, leading=12, spaceAfter=4)
    meta = ParagraphStyle("m", parent=styles["BodyText"], fontSize=8, textColor=colors.grey, spaceAfter=4)

    story: list = []
    story.append(Paragraph(escape("SentinelX"), h1))
    story.append(Paragraph(escape("Communication risk & evidence report"), styles["Title"]))
    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph(escape(f"Record ID: {rec_id}"), meta))
    story.append(Paragraph(escape(f"Generated: {created}"), meta))
    src = str(ingest.get("source", "—"))
    story.append(Paragraph(escape(f"Ingest source: {src}"), meta))
    im = ingest.get("ingest_meta")
    if isinstance(im, dict) and im.get("source_url"):
        story.append(
            Paragraph(escape(f"X post: {_for_pdf(str(im.get('source_url', '')))}"), meta),
        )
    story.append(Spacer(1, 0.2 * inch))

    r = (analysis.get("risk") or {}) if analysis else {}
    it = (analysis.get("intent") or {}) if analysis else {}
    se = (analysis.get("sentiment") or {}) if analysis else {}
    em = (analysis.get("emotions") or {}) if analysis else {}
    story.append(Paragraph(escape("Risk & intent (summary)"), h2))
    data = [
        ["Risk score", f"{r.get('score', '—')}"],
        ["Risk band", str(r.get("band", "—"))],
        ["Intent", str(it.get("label", "—"))],
        ["Intent confidence", f"{it.get('confidence', '—')}"],
        ["Sentiment", str(se.get("label", "—"))],
    ]
    t = Table(data, colWidths=[1.6 * inch, 4.5 * inch])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BOX", (0, 0), (-1, -1), 0.4, colors.grey),
                ("INNERGRID", (0, 0), (-1, -1), 0.2, colors.lightgrey),
            ],
        ),
    )
    story.append(t)
    story.append(Spacer(1, 0.12 * inch))

    story.append(Paragraph(escape("Emotion surface (0–100)"), h2))
    em_data = [
        ["fear", str(em.get("fear", "—"))],
        ["anger", str(em.get("anger", "—"))],
        ["joy", str(em.get("joy", "—"))],
        ["sadness", str(em.get("sadness", "—"))],
        ["urgency", str(em.get("urgency", "—"))],
    ]
    te = Table(em_data, colWidths=[1.2 * inch, 1.2 * inch])
    te.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BOX", (0, 0), (-1, -1), 0.3, colors.lightgrey),
            ],
        ),
    )
    story.append(te)
    story.append(Spacer(1, 0.12 * inch))

    sigs = analysis.get("signals") or []
    if isinstance(sigs, list) and sigs:
        story.append(Paragraph(escape("Signals (model + rules)"), h2))
        story.append(Paragraph(escape(_for_pdf(", ".join(str(s) for s in sigs)[:2_000])), body))
        story.append(Spacer(1, 0.1 * inch))

    story.append(Paragraph(escape("Rationale"), h2))
    story.append(Paragraph(escape(_for_pdf(str(analysis.get("rationale", "—")), 3_000)), body))
    story.append(Spacer(1, 0.12 * inch))

    story.append(Paragraph(escape("Cleaned text (analyzed)"), h2))
    story.append(Paragraph(escape(_for_pdf(str(ingest.get("cleaned_text", "")), 4_000)), body))
    story.append(Spacer(1, 0.1 * inch))

    ents = ingest.get("entities") or []
    if isinstance(ents, list) and ents:
        story.append(Paragraph(escape("Detected entities (regex)"), h2))
        lines: list[str] = []
        for e in ents[:50]:
            if isinstance(e, dict) and e.get("type") and e.get("value"):
                lines.append(f"{e['type']}: {e['value']}")
        if lines:
            story.append(Paragraph(escape(_for_pdf("\n".join(lines)[:2_000])), body))
        story.append(Spacer(1, 0.1 * inch))

    ocr = ingest.get("ocr_meta")
    if isinstance(ocr, dict) and ocr:
        story.append(Paragraph(escape("OCR metadata (images)"), h2))
        story.append(Paragraph(escape(_for_pdf(str(ocr)[:1_500])), body))

    story.append(Spacer(1, 0.2 * inch))
    prov = str(analysis.get("provider_model", "—"))
    story.append(Paragraph(escape(f"Model: {prov} — SentinelX (generated report)"), meta))
    doc.build(story)
    return buffer.getvalue()
