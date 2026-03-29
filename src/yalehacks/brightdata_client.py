from __future__ import annotations

import asyncio
import json
import re
from typing import Any
from urllib.parse import quote_plus

import httpx
from bs4 import BeautifulSoup

from yalehacks.config import get_brightdata_api_key, get_brightdata_zone

BRIGHTDATA_REQUEST_URL = "https://api.brightdata.com/request"


def _html_to_snippet_text(html: str, max_chars: int = 12000) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()
    text = soup.get_text("\n", strip=True)
    lines = [ln.strip() for ln in text.split("\n") if ln.strip() and len(ln.strip()) > 1]
    seen: set[str] = set()
    deduped: list[str] = []
    for ln in lines:
        key = ln[:120]
        if key in seen:
            continue
        seen.add(key)
        deduped.append(ln)
    out = "\n".join(deduped)
    return out[:max_chars]


def _body_to_html(raw: str) -> str:
    t = raw.strip()
    if not t:
        return ""
    if t.startswith("{") or t.startswith("["):
        try:
            obj = json.loads(t)
        except json.JSONDecodeError:
            return raw
        if isinstance(obj, str):
            return obj
        if isinstance(obj, dict):
            for k in ("body", "html", "content", "result", "page_html", "data"):
                v = obj.get(k)
                if isinstance(v, str) and v.strip():
                    return v
                if k == "data" and isinstance(v, dict):
                    for sub in ("html", "body", "content"):
                        s2 = v.get(sub)
                        if isinstance(s2, str) and s2.strip():
                            return s2
        return raw
    return raw


def _raise_brightdata_error(response: httpx.Response) -> None:
    code = response.status_code
    text = response.text[:2000]
    msg: str | None = None
    try:
        data = response.json()
        if isinstance(data, dict):
            msg = (
                data.get("error")
                or data.get("message")
                or data.get("error_message")
                or (data.get("errors") and str(data["errors"])[:500])
            )
    except (json.JSONDecodeError, ValueError):
        pass
    if code == 401:
        raise RuntimeError(
            "Bright Data returned 401 — check BRIGHTDATA_API_KEY (Bearer token) at "
            "https://brightdata.com/cp/zones"
        ) from None
    if code == 403:
        raise RuntimeError(
            "Bright Data returned 403 — check zone access, billing, or IP allowlist."
        ) from None
    if msg:
        raise RuntimeError(f"Bright Data HTTP {code}: {msg}") from None
    raise RuntimeError(f"Bright Data HTTP {code}: {text or response.reason_phrase}") from None


async def _fetch_raw_html(
    client: httpx.AsyncClient,
    target_url: str,
    api_key: str,
    zone: str,
) -> str:
    payload = {"zone": zone, "url": target_url, "format": "raw"}
    r = await client.post(
        BRIGHTDATA_REQUEST_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=120.0,
    )
    if r.status_code != 200:
        _raise_brightdata_error(r)
    return r.text


async def _fetch_search_excerpts(client: httpx.AsyncClient, label: str, search_url: str) -> tuple[str, dict[str, Any]]:
    api_key = get_brightdata_api_key()
    zone = get_brightdata_zone()
    raw = await _fetch_raw_html(client, search_url, api_key, zone)
    html = _body_to_html(raw)
    text = _html_to_snippet_text(html) if html.strip() else ""
    if not text.strip():
        text = re.sub(r"<[^>]+>", " ", html)
        text = " ".join(text.split())[:12000]
    meta: dict[str, Any] = {"source": label, "url": search_url, "raw_chars": len(raw)}
    return text, meta


def google_search_url(q: str) -> str:
    return f"https://www.google.com/search?q={quote_plus(q)}&hl=en&num=10"


def bing_search_url(q: str) -> str:
    return f"https://www.bing.com/search?q={quote_plus(q)}"


async def search_parallel(q: str) -> tuple[str, str, dict[str, Any], dict[str, Any]]:
    async with httpx.AsyncClient() as client:
        g_task = asyncio.create_task(
            _fetch_search_excerpts(client, "google", google_search_url(q))
        )
        b_task = asyncio.create_task(
            _fetch_search_excerpts(client, "bing", bing_search_url(q))
        )
        g_pair, b_pair = await asyncio.gather(g_task, b_task)
    g_text, g_meta = g_pair
    b_text, b_meta = b_pair
    return g_text, b_text, g_meta, b_meta
