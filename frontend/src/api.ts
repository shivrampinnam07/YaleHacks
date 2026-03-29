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

export async function postOcr(file: File, sessionId?: string): Promise<OcrResponse> {
  const fd = new FormData();
  fd.append("file", file);
  if (sessionId) fd.append("session_id", sessionId);
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

export type SearchResponse = {
  q: string;
  google_snippets: string;
  bing_snippets: string;
  session_id?: string;
};

export async function postSearch(body: {
  q?: string;
  session_id?: string;
}): Promise<SearchResponse> {
  const r = await fetch(`${base()}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json() as Promise<SearchResponse>;
}

export type SessionDoc = Record<string, unknown>;

export async function getSession(sessionId: string): Promise<SessionDoc> {
  const r = await fetch(`${base()}/api/sessions/${encodeURIComponent(sessionId)}`);
  if (!r.ok) throw new Error(await parseError(r));
  return r.json() as Promise<SessionDoc>;
}
