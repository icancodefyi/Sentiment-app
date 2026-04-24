from __future__ import annotations

import os
import smtplib
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any


def smtp_configured() -> bool:
    return bool((os.environ.get("SMTP_HOST") or "").strip())


def _int_env(name: str, default: int) -> int:
    try:
        return int((os.environ.get(name) or "").strip() or default)
    except ValueError:
        return default


def send_report_email(
    *,
    to_addr: str,
    subject: str,
    body_text: str,
    attachment_name: str,
    attachment_bytes: bytes,
    attachment_mime: str = "application/pdf",
) -> None:
    if not smtp_configured():
        raise RuntimeError("SMTP not configured. Set SMTP_HOST in apps/api/.env")

    host = (os.environ.get("SMTP_HOST") or "").strip()
    user = (os.environ.get("SMTP_USER") or os.environ.get("smtp_user") or "").strip()
    password = (os.environ.get("SMTP_PASSWORD") or os.environ.get("smtp_password") or "").strip()
    port = _int_env("SMTP_PORT", 587)
    use_tls = (os.environ.get("SMTP_USE_TLS", "1").strip().lower() not in ("0", "false", "no"))
    from_addr = (os.environ.get("REPORT_EMAIL_FROM") or user or "noreply@localhost").strip()

    msg = MIMEMultipart()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg.attach(MIMEText(body_text, "plain", "utf-8"))

    if attachment_mime == "application/pdf":
        part = MIMEBase("application", "pdf")
    else:
        main, sub = attachment_mime.split("/", 1) if "/" in attachment_mime else ("application", "octet-stream")
        part = MIMEBase(main, sub)
    part.set_payload(attachment_bytes)
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", f"attachment; filename={attachment_name}")
    msg.attach(part)

    with smtplib.SMTP(host, port, timeout=30) as s:
        if use_tls:
            s.starttls()
        if user and password:
            s.login(user, password)
        s.sendmail(from_addr, [to_addr], msg.as_string())


def build_default_email_body(row: dict[str, Any] | None, rec_id: str) -> str:
    line = f"Record {rec_id} — SentinelX analysis report (PDF attached).\n"
    if not row:
        return line
    it = (row.get("analysis") or {}).get("intent") or {}
    r = (row.get("analysis") or {}).get("risk") or {}
    return (
        line
        + f"Intent: {it.get('label', 'n/a')}\n"
        + f"Risk: {r.get('score', 'n/a')} ({r.get('band', 'n/a')})\n"
    )
