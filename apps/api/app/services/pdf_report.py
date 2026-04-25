from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.colors import Color
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.db.record_access import get_record_row_by_id

_CONTENT_W = 6.1 * inch


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


def _band_strip_colors(band: str) -> tuple[Color, Color]:
    """Background and accent line for header strip from risk band."""
    b = (band or "").lower()
    if b == "high":
        return colors.HexColor("#F8E8E4"), colors.HexColor("#A93226")
    if b == "medium":
        return colors.HexColor("#FDF4E4"), colors.HexColor("#B77700")
    return colors.HexColor("#E8F2EC"), colors.HexColor("#1A7A4A")


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
        rightMargin=0.7 * inch,
        leftMargin=0.7 * inch,
        topMargin=0.58 * inch,
        bottomMargin=0.58 * inch,
        title=title,
    )
    base = getSampleStyleSheet()
    h1 = ParagraphStyle(
        "sx_h1",
        parent=base["Title"],
        fontName="Helvetica-Bold",
        fontSize=17,
        leading=21,
        textColor=colors.HexColor("#1a1714"),
        spaceAfter=2,
    )
    h2 = ParagraphStyle(
        "sx_h2",
        parent=base["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#2c2417"),
        spaceAfter=5,
        spaceBefore=1,
    )
    body = ParagraphStyle(
        "sx_body",
        parent=base["BodyText"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#2a2520"),
        spaceAfter=4,
    )
    meta = ParagraphStyle(
        "sx_meta",
        parent=base["BodyText"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#66615c"),
        spaceAfter=2,
    )
    kpi_val = ParagraphStyle(
        "sx_kpi",
        parent=base["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=11.5,
        leading=13,
        textColor=colors.HexColor("#1a1714"),
    )
    foot = ParagraphStyle(
        "sx_foot",
        parent=base["BodyText"],
        fontName="Helvetica-Oblique",
        fontSize=6.5,
        leading=9,
        textColor=colors.grey,
    )

    r = (analysis.get("risk") or {}) if analysis else {}
    it = (analysis.get("intent") or {}) if analysis else {}
    se = (analysis.get("sentiment") or {}) if analysis else {}
    em = (analysis.get("emotions") or {}) if analysis else {}
    band = str(r.get("band", "—") or "—")
    risk_score = r.get("score", "—")

    story: list = []
    bg_strip, acc = _band_strip_colors(band)
    cover_rows = [
        [Paragraph(escape("SentinelX"), h1)],
        [Paragraph(escape("Communication risk & evidence"), meta)],
    ]
    cover = Table(
        cover_rows,
        colWidths=[_CONTENT_W],
        style=TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 1), bg_strip),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (0, 0), 11),
                ("BOTTOMPADDING", (0, 0), (0, 0), 2),
                ("BOTTOMPADDING", (0, 1), (0, 1), 9),
                ("LINEABOVE", (0, 0), (0, 0), 3, acc),
            ],
        ),
    )
    story.append(cover)
    story.append(Paragraph(escape(f"Record ID: {rec_id}"), meta))
    story.append(Paragraph(escape(f"Generated: {created}"), meta))
    src = str(ingest.get("source", "—"))
    story.append(Paragraph(escape(f"Ingest source: {src}"), meta))
    im = ingest.get("ingest_meta")
    if isinstance(im, dict) and im.get("source_url"):
        story.append(Paragraph(escape(f"X post: {_for_pdf(str(im.get('source_url', '')))}"), meta))
    story.append(Spacer(1, 0.16 * inch))

    story.append(Paragraph(escape("At a glance"), h2))
    kpi_data = [
        [Paragraph(escape("Risk (0–100)"), meta), Paragraph(escape(str(risk_score)), kpi_val)],
        [Paragraph(escape("Band"), meta), Paragraph(escape(band), kpi_val)],
        [Paragraph(escape("Intent"), meta), Paragraph(escape(str(it.get("label", "—"))), kpi_val)],
        [Paragraph(escape("Intent conf. (%)"), meta), Paragraph(escape(str(it.get("confidence", "—"))), kpi_val)],
        [Paragraph(escape("Sentiment"), meta), Paragraph(escape(str(se.get("label", "—"))), kpi_val)],
    ]
    t_kpi = Table(kpi_data, colWidths=[1.35 * inch, 3.2 * inch])
    t_kpi.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ],
        ),
    )
    story.append(t_kpi)
    story.append(Spacer(1, 0.12 * inch))

    story.append(Paragraph(escape("Emotion surface (0–100)"), h2))
    em_data = [
        ["Fear", str(em.get("fear", "—"))],
        ["Anger", str(em.get("anger", "—"))],
        ["Joy", str(em.get("joy", "—"))],
        ["Sadness", str(em.get("sadness", "—"))],
        ["Urgency", str(em.get("urgency", "—"))],
    ]
    te = Table(em_data, colWidths=[1.35 * inch, 0.85 * inch])
    te.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BOX", (0, 0), (-1, -1), 0.35, colors.HexColor("#c8c0b8")),
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f9f6f0")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ],
        ),
    )
    story.append(te)
    story.append(Spacer(1, 0.1 * inch))

    sigs = analysis.get("signals") or []
    if isinstance(sigs, list) and sigs:
        story.append(Paragraph(escape("Signals (model + rules)"), h2))
        story.append(Paragraph(escape(_for_pdf(", ".join(str(s) for s in sigs)[:2_000])), body))
        story.append(Spacer(1, 0.1 * inch))

    story.append(Paragraph(escape("Rationale"), h2))
    story.append(Paragraph(escape(_for_pdf(str(analysis.get("rationale", "—")), 3_200)), body))
    story.append(Spacer(1, 0.1 * inch))

    story.append(Paragraph(escape("Cleaned text (analyzed)"), h2))
    story.append(Paragraph(escape(_for_pdf(str(ingest.get("cleaned_text", "")), 4_500)), body))
    story.append(Spacer(1, 0.1 * inch))

    ents = ingest.get("entities") or []
    if isinstance(ents, list) and ents:
        story.append(Paragraph(escape("Detected patterns (regex)"), h2))
        lines: list[str] = []
        for e in ents[:50]:
            if isinstance(e, dict) and e.get("type") and e.get("value"):
                lines.append(f"{e['type']}: {e['value']}")
        if lines:
            story.append(Paragraph(escape(_for_pdf("\n".join(lines)[:2_200])), body))
        story.append(Spacer(1, 0.08 * inch))

    ocr = ingest.get("ocr_meta")
    if isinstance(ocr, dict) and ocr:
        story.append(Paragraph(escape("Image / OCR metadata"), h2))
        story.append(Paragraph(escape(_for_pdf(str(ocr)[:1_500])), body))
        story.append(Spacer(1, 0.08 * inch))

    story.append(Spacer(1, 0.08 * inch))
    story.append(
        Paragraph(
            escape(
                "Generated for triage and awareness — not legal advice. "
                "Verify findings against primary evidence before any official action."
            ),
            foot,
        ),
    )
    story.append(Spacer(1, 0.1 * inch))
    prov = str(analysis.get("provider_model", "—"))
    story.append(Paragraph(escape(f"Model: {prov}  ·  SentinelX"), meta))

    doc.build(story)
    return buffer.getvalue()
