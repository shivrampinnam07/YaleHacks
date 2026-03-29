from __future__ import annotations

import uuid
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, model_validator

from yalehacks.config import get_cors_origins
from yalehacks.db import create_session, get_session, update_session
from yalehacks.graph import run_full_graph
from yalehacks.query_build import build_sustainability_query
from yalehacks.brightdata_client import search_parallel
from yalehacks.tag_read import read_tag_text
from yalehacks.wardrobe_impact import compute_wardrobe_impact


def _session_json(doc: dict[str, Any] | None) -> dict[str, Any] | None:
    if doc is None:
        return None
    return jsonable_encoder(doc)


def _get_session_or_404(session_id: str) -> dict[str, Any]:
    doc = get_session(session_id)
    if not doc:
        raise HTTPException(status_code=404, detail="session_id not found")
    return doc


def _create_session_safe(session_id: str, extra: dict[str, Any] | None = None) -> None:
    create_session(session_id, extra)


def _update_session_safe(session_id: str, fields: dict[str, Any]) -> None:
    try:
        update_session(session_id, fields)
    except KeyError:
        raise HTTPException(status_code=404, detail="session_id not found") from None


app = FastAPI(title="YaleHacks sustainability")

_origins = get_cors_origins()
if _origins == ["*"]:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/ocr")
async def api_ocr(
    file: UploadFile = File(...),
    session_id: str | None = Form(None),
    description: str | None = Form(None),
) -> dict[str, Any]:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if session_id:
        _get_session_or_404(session_id)
        sid = session_id
    else:
        sid = str(uuid.uuid4())
        _create_session_safe(sid)
    try:
        text = read_tag_text(data)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    fields: dict[str, Any] = {"ocr_text": text}
    if description is not None and description.strip():
        fields["item_description"] = description.strip()
    _update_session_safe(sid, fields)
    return {"session_id": sid, "ocr_text": text}


class SearchBody(BaseModel):
    q: str | None = None
    session_id: str | None = None

    @model_validator(mode="after")
    def require_q_or_session(self) -> SearchBody:
        if not self.q and not self.session_id:
            raise ValueError("Provide q or session_id")
        return self


@app.post("/api/search")
async def api_search(body: SearchBody) -> dict[str, Any]:
    if body.q:
        q = body.q.strip()
    else:
        assert body.session_id
        doc = _get_session_or_404(body.session_id)
        ocr = doc.get("ocr_text") or ""
        if not ocr.strip():
            raise HTTPException(status_code=400, detail="Session has no ocr_text; run /api/ocr first")
        q = build_sustainability_query(ocr)
    try:
        g_text, b_text, _, _ = await search_parallel(q)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    out: dict[str, Any] = {
        "q": q,
        "google_snippets": g_text,
        "bing_snippets": b_text,
    }
    if body.session_id:
        _update_session_safe(
            body.session_id,
            {"search_query": q, "google_serp": g_text, "bing_serp": b_text},
        )
        out["session_id"] = body.session_id
    return out


class GraphBody(BaseModel):
    session_id: str | None = None
    ocr_text: str | None = None

    @model_validator(mode="after")
    def require_one(self) -> GraphBody:
        if not self.session_id and not self.ocr_text:
            raise ValueError("Provide session_id or ocr_text")
        return self


class WardrobeItemIn(BaseModel):
    description: str | None = None
    ocr_text: str = ""
    summary: str = ""
    session_id: str | None = None


class WardrobeImpactBody(BaseModel):
    items: list[WardrobeItemIn]

    @model_validator(mode="after")
    def need_items(self) -> WardrobeImpactBody:
        if not self.items:
            raise ValueError("Provide at least one item")
        return self


@app.post("/api/wardrobe/impact")
def api_wardrobe_impact(body: WardrobeImpactBody) -> dict[str, Any]:
    ready = [it.model_dump() for it in body.items if (it.summary or "").strip()]
    if not ready:
        raise HTTPException(
            status_code=400,
            detail="At least one item with a non-empty summary is required",
        )
    try:
        return compute_wardrobe_impact(ready)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@app.post("/api/graph")
async def api_graph(body: GraphBody) -> dict[str, Any]:
    if body.session_id:
        sid = body.session_id
        doc = _get_session_or_404(sid)
        ocr = doc.get("ocr_text") or ""
        if not ocr.strip():
            raise HTTPException(status_code=400, detail="Session has no ocr_text")
    else:
        assert body.ocr_text is not None
        ocr = body.ocr_text.strip()
        if not ocr:
            raise HTTPException(status_code=400, detail="ocr_text is empty")
        sid = str(uuid.uuid4())
        _create_session_safe(sid, {"ocr_text": ocr})
    try:
        out = await run_full_graph(sid, ocr)
    except KeyError:
        raise HTTPException(status_code=404, detail="session_id not found") from None
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {
        "session_id": sid,
        "summary": out.get("summary"),
        "search_query": out.get("search_query"),
    }


@app.get("/api/sessions/{session_id}")
def api_get_session(session_id: str) -> dict[str, Any]:
    doc = _get_session_or_404(session_id)
    j = _session_json(doc)
    assert j is not None
    return j
