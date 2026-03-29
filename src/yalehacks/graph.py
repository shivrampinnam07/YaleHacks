from __future__ import annotations

import asyncio
from typing import TypedDict

from groq import Groq
from langgraph.graph import END, START, StateGraph

from yalehacks.config import get_groq_key, get_groq_summary_model
from yalehacks.db import update_session
from yalehacks.query_build import build_sustainability_query
from yalehacks.brightdata_client import search_parallel


class GraphState(TypedDict, total=False):
    session_id: str
    ocr_text: str
    search_query: str
    google_serp: str
    bing_serp: str
    summary: str


async def node_parse(state: GraphState) -> dict:
    q = build_sustainability_query(state["ocr_text"])
    return {"search_query": q}


async def node_search(state: GraphState) -> dict:
    q = state.get("search_query") or ""
    g_text, b_text, _, _ = await search_parallel(q)
    return {"google_serp": g_text, "bing_serp": b_text}


def summarize_llm(ocr_text: str, google_serp: str, bing_serp: str) -> str:
    client = Groq(api_key=get_groq_key())
    model = get_groq_summary_model()
    system = (
        "You are a sustainability analyst. Be concise and factual; note uncertainty when "
        "sources conflict or are unclear."
    )
    user = f"""Tag / label text:
{ocr_text}

Google search excerpts:
{google_serp[:6000]}

Bing search excerpts:
{bing_serp[:6000]}

Summarize likely environmental and social sustainability implications of these materials (water, energy, microplastics, recyclability, labor where relevant). Use short bullet points. Note that web snippets are incomplete and may be biased."""
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.3,
        max_tokens=2048,
    )
    return (resp.choices[0].message.content or "").strip()


async def node_summarize(state: GraphState) -> dict:
    summary = await asyncio.to_thread(
        summarize_llm,
        state["ocr_text"],
        state.get("google_serp") or "",
        state.get("bing_serp") or "",
    )
    return {"summary": summary}


def build_graph():
    g = StateGraph(GraphState)
    g.add_node("parse", node_parse)
    g.add_node("search", node_search)
    g.add_node("summarize", node_summarize)
    g.add_edge(START, "parse")
    g.add_edge("parse", "search")
    g.add_edge("search", "summarize")
    g.add_edge("summarize", END)
    return g.compile()


async def run_full_graph(session_id: str, ocr_text: str) -> dict:
    app = build_graph()
    out = await app.ainvoke(
        {
            "session_id": session_id,
            "ocr_text": ocr_text,
        }
    )
    update_session(
        session_id,
        {
            "search_query": out.get("search_query"),
            "google_serp": out.get("google_serp"),
            "bing_serp": out.get("bing_serp"),
            "summary": out.get("summary"),
        },
    )
    return dict(out)
