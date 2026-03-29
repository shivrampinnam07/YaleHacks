const base = () => (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    return JSON.stringify(j.detail ?? j);
  } catch {
    return await res.text();
  }
}

export type OcrResponse = { session_id: string; ocr_text: string };

export async function postOcr(
  file: File,
  sessionId?: string,
  description?: string
): Promise<OcrResponse> {
  const fd = new FormData();
  fd.append("file", file);
  if (sessionId) fd.append("session_id", sessionId);
  if (description != null && description !== "")
    fd.append("description", description);
  const r = await fetch(`${base()}/api/ocr`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json() as Promise<OcrResponse>;
}

export type GraphResponse = {
  session_id: string;
  summary: string | null;
  search_query: string | null;
};

export async function postGraph(body: {
  session_id?: string;
  ocr_text?: string;
}): Promise<GraphResponse> {
  const r = await fetch(`${base()}/api/graph`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json() as Promise<GraphResponse>;
}

export type WardrobeItemPayload = {
  description?: string;
  ocr_text: string;
  summary: string;
  session_id?: string;
};

export type WardrobePerItem = {
  title: string;
  summary_points: string[];
  key_materials: string;
  top_environmental_impacts: string;
  societal_notes: string;
};

export type WardrobeComparisonTable = {
  headers: string[];
  rows: string[][];
};

export type WardrobeAggregationMetrics = {
  item_count: number;
  fibers_repeated_across_items: string[];
  themes_repeated_across_items: string[];
  highest_concern_garment_index: number | null;
  notes: string;
};

export type WardrobeImpactResponse = {
  per_item: WardrobePerItem[];
  comparison_table: WardrobeComparisonTable;
  aggregation_metrics: WardrobeAggregationMetrics | null;
  aggregation_narrative: string;
  final_conclusion: string;
};

export async function postWardrobeImpact(
  items: WardrobeItemPayload[]
): Promise<WardrobeImpactResponse> {
  const r = await fetch(`${base()}/api/wardrobe/impact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json() as Promise<WardrobeImpactResponse>;
}
