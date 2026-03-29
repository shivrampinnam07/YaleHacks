from __future__ import annotations

import json
import re
from typing import Any

from groq import Groq

from yalehacks.config import get_groq_key, get_groq_summary_model


def _strip_code_fence(s: str) -> str:
    s = s.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s)
        s = re.sub(r"\s*```\s*$", "", s)
    return s.strip()


def _default_titles(items: list[dict[str, Any]]) -> list[str]:
    out: list[str] = []
    for i, it in enumerate(items, 1):
        desc = (it.get("description") or "").strip()
        out.append(f"Garment {i}" + (f" — {desc}" if desc else ""))
    return out


def _build_table_from_items(
    items: list[dict[str, Any]], per_item: list[dict[str, Any]]
) -> dict[str, Any]:
    headers = ["Garment", "Key materials", "Environmental hotspots", "Societal / ethics"]
    titles = _default_titles(items)
    rows: list[list[str]] = []
    for i, tit in enumerate(titles):
        row = per_item[i] if i < len(per_item) else {}
        rows.append(
            [
                tit,
                str(row.get("key_materials") or "—"),
                str(row.get("top_environmental_impacts") or "—"),
                str(row.get("societal_notes") or "—"),
            ]
        )
    return {"headers": headers, "rows": rows}


def _clamp_points(points: Any, max_n: int = 2) -> list[str]:
    if not isinstance(points, list):
        return []
    out = [str(p).strip() for p in points if str(p).strip()]
    return out[:max_n] if out else ["—"]


def _normalize(
    items: list[dict[str, Any]], data: dict[str, Any]
) -> dict[str, Any]:
    n = len(items)
    titles = _default_titles(items)
    raw_per = data.get("per_item")
    per_item: list[dict[str, Any]] = []
    if isinstance(raw_per, list):
        for i in range(n):
            row = raw_per[i] if i < len(raw_per) and isinstance(raw_per[i], dict) else {}
            title = str(row.get("title") or titles[i])
            per_item.append(
                {
                    "title": title,
                    "summary_points": _clamp_points(row.get("summary_points"), 2),
                    "key_materials": str(row.get("key_materials") or "—"),
                    "top_environmental_impacts": str(
                        row.get("top_environmental_impacts") or "—"
                    ),
                    "societal_notes": str(row.get("societal_notes") or "—"),
                }
            )
    else:
        for i in range(n):
            per_item.append(
                {
                    "title": titles[i],
                    "summary_points": ["See per-item analysis above."],
                    "key_materials": "—",
                    "top_environmental_impacts": "—",
                    "societal_notes": "—",
                }
            )

    tbl = data.get("comparison_table")
    if not isinstance(tbl, dict) or not isinstance(tbl.get("rows"), list):
        tbl = _build_table_from_items(items, raw_per if isinstance(raw_per, list) else [])
    else:
        hdrs = tbl.get("headers")
        if not isinstance(hdrs, list) or len(hdrs) < 2:
            fixed = _build_table_from_items(items, per_item)
            tbl = {"headers": fixed["headers"], "rows": fixed["rows"]}
        else:
            tbl = {
                "headers": [str(h) for h in hdrs],
                "rows": [
                    [str(c) for c in r]
                    for r in (tbl.get("rows") or [])
                    if isinstance(r, (list, tuple))
                ],
            }
            if len(tbl["rows"]) != n:
                tbl = _build_table_from_items(items, per_item)

    metrics = data.get("aggregation_metrics")
    if n < 2:
        metrics = None
    elif not isinstance(metrics, dict):
        metrics = {
            "item_count": n,
            "fibers_repeated_across_items": [],
            "themes_repeated_across_items": [],
            "highest_concern_garment_index": None,
            "notes": "Metrics could not be structured; see narrative.",
        }

    agg_narr = str(data.get("aggregation_narrative") or data.get("aggregation") or "").strip()
    conclusion = str(data.get("final_conclusion") or data.get("final_impact") or "").strip()

    return {
        "per_item": per_item,
        "comparison_table": tbl,
        "aggregation_metrics": metrics,
        "aggregation_narrative": agg_narr,
        "final_conclusion": conclusion,
    }


def compute_wardrobe_impact(items: list[dict[str, Any]]) -> dict[str, Any]:
    if not items:
        return {
            "per_item": [],
            "comparison_table": {"headers": [], "rows": []},
            "aggregation_metrics": None,
            "aggregation_narrative": "",
            "final_conclusion": "",
        }

    n = len(items)
    lines: list[str] = []
    for i, it in enumerate(items, 1):
        desc = (it.get("description") or "").strip()
        ocr = (it.get("ocr_text") or "").strip()
        summ = (it.get("summary") or "").strip()
        lines.append(
            f"=== ITEM {i} ===\n"
            f"User description: {desc or '(none)'}\n"
            f"Label OCR:\n{ocr}\n\n"
            f"Prior sustainability summary for this item:\n{summ}\n"
        )
    blob = "\n".join(lines)

    multi = n >= 2
    metrics_rule = (
        '"aggregation_metrics": {'
        '"item_count": <int>, '
        '"fibers_repeated_across_items": [<string>], '
        '"themes_repeated_across_items": [<string>], '
        '"highest_concern_garment_index": <1-based int or null>, '
        '"notes": "<one sentence>"'
        "}"
        if multi
        else '"aggregation_metrics": null'
    )

    schema = f"""Return ONLY valid JSON (no markdown fences) with this shape:
{{
  "per_item": [
    {{
      "title": "Garment N — short label matching user description when possible",
      "summary_points": ["exactly one or two short bullets for this garment only"],
      "key_materials": "fibers / blends in plain language",
      "top_environmental_impacts": "e.g. microplastics, water, dyeing, down sourcing",
      "societal_notes": "labor, communities, transparency — or N/A"
    }}
  ],
  "comparison_table": {{
    "headers": ["Garment", "Key materials", "Environmental hotspots", "Societal / ethics"],
    "rows": [["...", "...", "...", "..."], ...]
  }},
  "aggregation_metrics": {metrics_rule},
  "aggregation_narrative": "2-4 sentences comparing patterns across the wardrobe",
  "final_conclusion": "3-5 sentences: overall societal + environmental takeaway, what to prioritize, caveats"
}}

Rules:
- per_item length must be {n}. summary_points: 1-2 strings only.
- comparison_table.rows must have {n} rows, same order as items, columns matching headers.
- If {n} == 1: aggregation_metrics must be null; still write aggregation_narrative as a tight reflection and final_conclusion.
- If {n} >= 2: aggregation_metrics must be an object (not null) with quantitative-ish lists where possible.
"""

    client = Groq(api_key=get_groq_key())
    model = get_groq_summary_model()
    system = (
        "You are a sustainability and societal-impact analyst for apparel. "
        "Output strictly valid JSON only. Be factual; flag uncertainty."
    )
    user = f"""{schema}

Data:

{blob}"""
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.2,
        max_tokens=8192,
    )
    raw = (resp.choices[0].message.content or "").strip()
    cleaned = _strip_code_fence(raw)
    try:
        data = json.loads(cleaned)
        if not isinstance(data, dict):
            raise ValueError("not an object")
    except (json.JSONDecodeError, TypeError, ValueError):
        return _normalize(
            items,
            {
                "per_item": [],
                "comparison_table": {},
                "aggregation_metrics": None if n < 2 else {},
                "aggregation_narrative": raw[:6000],
                "final_conclusion": "",
            },
        )

    return _normalize(items, data)
