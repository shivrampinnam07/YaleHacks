from __future__ import annotations

import re


_MATERIAL_RE = re.compile(
    r"\b("
    r"organic\s+cotton|recycled\s+cotton|recycled\s+polyester|"
    r"faux\s+leather|vegan\s+leather|"
    r"cotton|polyester|nylon|polyamide|wool|merino|silk|linen|hemp|jute|"
    r"viscose|rayon|bamboo\s+viscose|"
    r"modal|lyocell|tencel|acetate|acrylic|"
    r"elastane|spandex|lycra|polyurethane|"
    r"down|feather|"
    r"leather|suede|rubber|"
    r"mohair|angora|cashmere|alpaca|"
    r"aramid|kevlar|neoprene"
    r")\b",
    re.IGNORECASE,
)


def _normalize_term(raw: str) -> str:
    t = re.sub(r"\s+", " ", raw.strip().lower())
    return t


def _looks_like_sku_line(line: str) -> bool:
    s = line.strip()
    if len(s) < 4:
        return True
    alnum = sum(c.isalnum() for c in s)
    if len(s) > 8 and alnum / len(s) < 0.45:
        return True
    if re.match(r"^[\dA-Z\-/\s\(\)\.]+$", s) and re.search(r"\d{3,}", s):
        return True
    return False


def extract_material_keywords(ocr_text: str, max_terms: int = 12) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for m in _MATERIAL_RE.finditer(ocr_text):
        term = _normalize_term(m.group(1))
        if term in seen:
            continue
        seen.add(term)
        out.append(term)
        if len(out) >= max_terms:
            break
    return out


def _fallback_phrase(ocr_text: str, max_chars: int = 100) -> str:
    lines = [ln.strip() for ln in ocr_text.splitlines() if ln.strip()]
    kept: list[str] = []
    for line in lines:
        if _looks_like_sku_line(line):
            continue
        low = line.lower()
        if "made in" in low and len(line) < 25:
            continue
        kept.append(re.sub(r"\s+", " ", line))
        if len(" ".join(kept)) >= max_chars:
            break
    text = " ".join(kept).strip()
    if len(text) > max_chars:
        text = text[:max_chars].rsplit(" ", 1)[0]
    return text or "textile garment"


def build_sustainability_query(ocr_text: str) -> str:
    t = (ocr_text or "").strip()
    if not t:
        return "textile fiber sustainability environmental impact recycling"

    materials = extract_material_keywords(t)
    if materials:
        core = " ".join(materials)
    else:
        core = _fallback_phrase(t)

    q = f"{core} sustainability environmental impact textile recycling life cycle"
    q = " ".join(q.split())
    if len(q) > 400:
        q = q[:400].rsplit(" ", 1)[0]
    return q
