from __future__ import annotations

import datetime as dt
import os
from typing import Any

from pymongo import MongoClient, ASCENDING
from pymongo.collection import Collection

from yalehacks.config import get_mongodb_uri

_client: MongoClient | None = None
_mongo_ok: bool | None = None
_memory: dict[str, dict[str, Any]] = {}


def _invalidate_mongo() -> None:
    global _mongo_ok
    _mongo_ok = False


def get_client() -> MongoClient:
    global _client
    if _client is None:
        uri = get_mongodb_uri()
        if not uri:
            raise RuntimeError("MONGODB_URI is empty")
        _client = MongoClient(uri, serverSelectionTimeoutMS=10000)
    return _client


def _ping_mongo() -> bool:
    global _mongo_ok
    if _mongo_ok is False:
        return False
    if _mongo_ok is True:
        return True
    if not get_mongodb_uri():
        _mongo_ok = False
        return False
    try:
        get_client().admin.command("ping", serverSelectionTimeoutMS=5000)
        _mongo_ok = True
        return True
    except Exception:
        _mongo_ok = False
        return False


def get_db():
    name = os.environ.get("MONGODB_DB_NAME", "yalehacks").strip() or "yalehacks"
    return get_client()[name]


def sessions_coll() -> Collection:
    return get_db()["sessions"]


def ensure_indexes() -> None:
    coll = sessions_coll()
    coll.create_index([("session_id", ASCENDING)], unique=True)


def create_session(session_id: str, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    now = dt.datetime.now(dt.UTC)
    doc: dict[str, Any] = {
        "session_id": session_id,
        "created_at": now,
        "updated_at": now,
    }
    if extra:
        doc.update(extra)
    wrote_mongo = False
    if _ping_mongo():
        try:
            ensure_indexes()
            sessions_coll().insert_one({**doc})
            wrote_mongo = True
        except Exception:
            _invalidate_mongo()
    if not wrote_mongo:
        _memory[session_id] = {**doc}
    return doc


def update_session(session_id: str, fields: dict[str, Any]) -> None:
    now = dt.datetime.now(dt.UTC)
    payload = {**fields, "updated_at": now}
    if _ping_mongo():
        try:
            result = sessions_coll().update_one({"session_id": session_id}, {"$set": payload})
            if result.matched_count > 0:
                return
        except Exception:
            _invalidate_mongo()
    if session_id in _memory:
        _memory[session_id].update(payload)
        return
    raise KeyError(session_id)


def get_session(session_id: str) -> dict[str, Any] | None:
    if _ping_mongo():
        try:
            doc = sessions_coll().find_one({"session_id": session_id})
            if doc is not None:
                return doc
        except Exception:
            _invalidate_mongo()
    mem = _memory.get(session_id)
    return dict(mem) if mem is not None else None


def list_sessions_recent(limit: int = 20) -> list[dict[str, Any]]:
    if _ping_mongo():
        try:
            cur = sessions_coll().find().sort("updated_at", -1).limit(limit)
            return list(cur)
        except Exception:
            _invalidate_mongo()
    rows = sorted(_memory.values(), key=lambda d: d["updated_at"], reverse=True)
    return list(rows[:limit])
