"""
Fetch public X (Twitter) post text for analysis.

Uses the public FxEmbed (fxtwitter) Status API (GET /:user/status/:id) — the
user segment is ignored for ID resolution, so we can use a placeholder when
only the status id is known (e.g. x.com/i/web/status/…).
"""

from __future__ import annotations

import json
import re
from html import unescape
from typing import Any
from urllib.parse import urlparse

import httpx

_USER_AGENT = (
    "Mozilla/5.0 (compatible; SentinelX/1.0; +https://github.com/) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

_ALLOWED_HOSTS = frozenset(
    {
        "x.com",
        "www.x.com",
        "twitter.com",
        "www.twitter.com",
        "mobile.twitter.com",
        "mobile.x.com",
    },
)

def _parse_path_status(path: str) -> tuple[str | None, str] | None:
    """(screen_name|None, status_id) from the URL path, or None."""
    if not path:
        return None
    m = re.search(r"/i/web/status/(\d+)(?:/|$)", path, re.I)
    if m:
        return None, m.group(1)
    m = re.search(
        r"/([A-Za-z0-9_]{1,30})/status(?:es)?/(\d+)(?:/|\?|$)",
        path,
        re.I,
    )
    if m:
        return m.group(1), m.group(2)
    return None


def _host_ok(url: str) -> bool:
    try:
        p = urlparse(url)
        if p.scheme not in ("http", "https"):
            return False
        h = (p.netloc or "").lower().split("@")[-1]
        if ":" in h:
            h = h.rsplit(":", 1)[0]
        return h in _ALLOWED_HOSTS
    except Exception:
        return False


def _parse_x_status_url(url: str) -> tuple[str | None, str] | None:
    """
    Return (screen_name or None, status_id) for an X post URL, or None.
    """
    u = url.strip()
    if not u or not _host_ok(u):
        return None
    p = urlparse(u)
    return _parse_path_status(p.path or "")


def _extract_tweet_text(data: dict[str, Any]) -> str | None:
    if not isinstance(data, dict):
        return None
    tw = data.get("tweet")
    if isinstance(tw, dict) and tw.get("text"):
        return str(tw["text"]).strip() or None
    if data.get("text") and "tweet" not in data:
        return str(data["text"]).strip() or None
    return None


def _fxtwitter_status(api_user: str, status_id: str) -> dict[str, Any] | None:
    u = f"https://api.fxtwitter.com/{api_user}/status/{status_id}"
    with httpx.Client(
        timeout=20.0,
        follow_redirects=True,
        headers={"User-Agent": _USER_AGENT, "Accept": "application/json"},
    ) as c:
        r = c.get(u)
        if r.status_code != 200:
            return None
        try:
            return r.json()
        except json.JSONDecodeError:
            return None


def _vxtwitter_status(api_user: str, status_id: str) -> dict[str, Any] | None:
    u = f"https://api.vxtwitter.com/{api_user}/status/{status_id}"
    with httpx.Client(
        timeout=20.0,
        follow_redirects=True,
        headers={"User-Agent": _USER_AGENT, "Accept": "application/json"},
    ) as c:
        r = c.get(u)
        if r.status_code != 200:
            return None
        try:
            return r.json()
        except json.JSONDecodeError:
            return None


def _oembed_tweet_page(original_url: str) -> str | None:
    q = f"https://publish.twitter.com/oembed?url={httpx.QueryParams({'url': original_url})}&omit_script=true&dnt=true"
    with httpx.Client(
        timeout=15.0,
        follow_redirects=True,
        headers={"User-Agent": _USER_AGENT},
    ) as c:
        r = c.get(
            "https://publish.twitter.com/oembed",
            params={"url": original_url, "omit_script": "true", "dnt": "true"},
        )
        if r.status_code != 200:
            return None
        try:
            d = r.json()
        except json.JSONDecodeError:
            return None
    html = d.get("html")
    if not isinstance(html, str) or not html:
        return None
    t = re.sub(r"<[^>]+>", " ", html)
    t = unescape(t)
    t = re.sub(r"\s+", " ", t).strip()
    return t or None


def fetch_x_post_text(url: str) -> tuple[str, dict[str, Any]]:
    """
    Return (text_for_analysis, meta) where meta includes source and author if known.
    Raises ValueError for bad URL; RuntimeError if tweet text could not be resolved.
    """
    u = url.strip()
    if not u:
        raise ValueError("URL is required")
    if not _host_ok(u):
        raise ValueError("Only x.com and twitter.com post links are allowed")

    parsed = _parse_x_status_url(u)
    if not parsed:
        raise ValueError("Not a valid X post URL (expected …/status/<id> or …/i/web/status/<id>)")
    user, status_id = parsed
    # API placeholder when handle unknown (ignored by fxtwitter)
    api_user = user if user else "x"

    meta: dict[str, Any] = {"source_url": u, "status_id": status_id, "method": None, "author": None}

    for name, fn in (("fxtwitter", _fxtwitter_status), ("vxtwitter", _vxtwitter_status)):
        data = fn(api_user, status_id)
        if not data or not isinstance(data, dict):
            continue
        code = data.get("code")
        msg = data.get("message")
        if code in (401, 403, 404) or msg in (
            "NOT_FOUND",
            "PRIVATE_TWEET",
            "SUSPENDED_TWEET",
            "TWEET_NOT_FOUND",
        ):
            raise RuntimeError(
                f"Could not read this post ({msg or code}). It may be private, deleted, or not available to public APIs.",
            )
        if code not in (200, "200", None) and "tweet" not in data and not data.get("text"):
            # Unknown error shape — try next source
            continue
        text = _extract_tweet_text(data) if data else None
        tw = data.get("tweet") if isinstance(data, dict) else None
        if isinstance(tw, dict) and tw.get("author") and isinstance(tw["author"], dict):
            sn = tw["author"].get("screen_name")
            if sn:
                meta["author"] = f"@{sn}"
        if text:
            meta["method"] = name
            body = text
            if meta.get("author"):
                body = f"{meta['author']}: {body}"
            return body, meta

    o_text = _oembed_tweet_page(u)
    if o_text:
        meta["method"] = "oembed"
        return o_text, meta

    raise RuntimeError(
        "Could not fetch the post text. The link may be invalid, the post may be private, "
        "or the fetch service is temporarily unavailable. Try pasting the post text instead.",
    )
