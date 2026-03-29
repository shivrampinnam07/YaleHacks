import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSession,
  postGraph,
  postOcr,
  postSearch,
  type GraphResponse,
  type OcrResponse,
  type SearchResponse,
  type SessionDoc,
} from "./api";

type Phase = "idle" | "ocr" | "graph" | "search" | "lookup";

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState<string | null>(null);

  const [fullOcr, setFullOcr] = useState<OcrResponse | null>(null);
  const [fullGraph, setFullGraph] = useState<GraphResponse | null>(null);

  const [ocrOnly, setOcrOnly] = useState<OcrResponse | null>(null);

  const [searchQ, setSearchQ] = useState("");
  const [searchSessionId, setSearchSessionId] = useState("");
  const [searchOut, setSearchOut] = useState<SearchResponse | null>(null);

  const [graphSessionId, setGraphSessionId] = useState("");
  const [graphOcrText, setGraphOcrText] = useState("");
  const [graphOut, setGraphOut] = useState<GraphResponse | null>(null);

  const [lookupId, setLookupId] = useState("");
  const [sessionDoc, setSessionDoc] = useState<SessionDoc | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onPick = useCallback((f: File | null) => {
    setErr(null);
    setFullOcr(null);
    setFullGraph(null);
    setOcrOnly(null);
    setFile(f);
  }, []);

  const handleFullScan = async () => {
    if (!file) return;
    setErr(null);
    setFullOcr(null);
    setFullGraph(null);
    try {
      setPhase("ocr");
      const ocr = await postOcr(file);
      setFullOcr(ocr);
      setPhase("graph");
      const graph = await postGraph({ session_id: ocr.session_id });
      setFullGraph(graph);
      setPhase("idle");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    }
  };

  const handleOcrOnly = async () => {
    if (!file) return;
    setErr(null);
    setOcrOnly(null);
    try {
      setPhase("ocr");
      const o = await postOcr(file);
      setOcrOnly(o);
      setPhase("idle");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    }
  };

  const handleSearch = async () => {
    setErr(null);
    setSearchOut(null);
    const q = searchQ.trim();
    const sid = searchSessionId.trim();
    if (!q && !sid) {
      setErr("Enter a search query or a session ID.");
      return;
    }
    try {
      setPhase("search");
      const out = await postSearch(q ? { q } : { session_id: sid });
      setSearchOut(out);
      setPhase("idle");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    }
  };

  const handleGraphOnly = async () => {
    setErr(null);
    setGraphOut(null);
    const sid = graphSessionId.trim();
    const ot = graphOcrText.trim();
    if (!sid && !ot) {
      setErr("Enter session_id (after OCR) or paste ocr_text.");
      return;
    }
    try {
      setPhase("graph");
      const out = sid
        ? await postGraph({ session_id: sid })
        : await postGraph({ ocr_text: ot });
      setGraphOut(out);
      setPhase("idle");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    }
  };

  const handleLookup = async () => {
    const id = lookupId.trim();
    if (!id) {
      setErr("Enter a session ID.");
      return;
    }
    setErr(null);
    setSessionDoc(null);
    try {
      setPhase("lookup");
      const doc = await getSession(id);
      setSessionDoc(doc);
      setPhase("idle");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    }
  };

  const busy =
    phase === "ocr" || phase === "graph" || phase === "search" || phase === "lookup";

  return (
    <div className="app">
      <h1>Garment tag sustainability</h1>
      <p className="sub">
        Same flow as <code style={{ fontFamily: "var(--mono)", fontSize: "0.9em" }}>yalehacks scan</code>
        : vision read → Bright Data (Google + Bing) → Groq summary. Backend: FastAPI on port 8000.
      </p>

      <section>
        <h2>1. Image</h2>
        <div
          className={`drop ${drag ? "drag" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f?.type.startsWith("image/")) onPick(f);
          }}
          onClick={() => inputRef.current?.click()}
          role="presentation"
        >
          <div className="drop-inner">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <>
                <strong>{file.name}</strong>
                <div className="hint">Click or drop another image to replace</div>
              </>
            ) : (
              <>
                Drop a tag photo here or click to choose
                <div className="hint">PNG, JPEG, WebP, …</div>
              </>
            )}
          </div>
        </div>
        {preview ? (
          <img className="preview" src={preview} alt="Tag preview" />
        ) : null}
        <div className="actions">
          <button
            type="button"
            className="primary"
            disabled={!file || busy}
            onClick={handleFullScan}
          >
            {busy ? "Working…" : "Run full analysis"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!file || busy}
            onClick={handleOcrOnly}
          >
            OCR only
          </button>
        </div>
        <div className={`status ${busy ? "working" : ""}`}>
          {phase === "ocr" ? "Reading tag with Groq vision…" : null}
          {phase === "graph" ? "Searching via Bright Data (Google + Bing)…" : null}
        </div>
        {err ? <div className="err">{err}</div> : null}

        {fullOcr ? (
          <div className="result-block">
            <label>Session ID</label>
            <pre>{fullOcr.session_id}</pre>
          </div>
        ) : null}
        {fullOcr ? (
          <div className="result-block">
            <label>Tag text (OCR)</label>
            <div className="box">{fullOcr.ocr_text}</div>
          </div>
        ) : null}
        {fullGraph?.summary ? (
          <div className="result-block">
            <label>Summary</label>
            <div className="box">{fullGraph.summary}</div>
          </div>
        ) : null}
        {fullGraph?.search_query ? (
          <div className="result-block">
            <label>Search query used</label>
            <pre>{fullGraph.search_query}</pre>
          </div>
        ) : null}

        {ocrOnly ? (
          <div className="result-block">
            <label>OCR only — session</label>
            <pre>{ocrOnly.session_id}</pre>
            <label style={{ marginTop: "0.75rem" }}>Tag text</label>
            <div className="box">{ocrOnly.ocr_text}</div>
          </div>
        ) : null}
      </section>

      <section>
        <h2>2. Search (Bright Data)</h2>
        <div className="row cols-2">
          <div className="field">
            <label htmlFor="q">Query q</label>
            <input
              id="q"
              type="text"
              placeholder="e.g. polyester textile sustainability"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="sid">Or session ID (uses stored tag text)</label>
            <input
              id="sid"
              type="text"
              placeholder="uuid from OCR"
              value={searchSessionId}
              onChange={(e) => setSearchSessionId(e.target.value)}
            />
          </div>
        </div>
        <button type="button" className="primary" disabled={busy} onClick={handleSearch}>
          Run search
        </button>
        {searchOut ? (
          <>
            <div className="result-block">
              <label>Query</label>
              <pre>{searchOut.q}</pre>
            </div>
            <div className="row cols-2">
              <div className="result-block">
                <label>Google snippets</label>
                <div className="box">{searchOut.google_snippets || "—"}</div>
              </div>
              <div className="result-block">
                <label>Bing snippets</label>
                <div className="box">{searchOut.bing_snippets || "—"}</div>
              </div>
            </div>
          </>
        ) : null}
      </section>

      <section>
        <h2>3. Graph only (LangGraph + summary)</h2>
        <div className="row cols-2">
          <div className="field">
            <label htmlFor="gsid">session_id</label>
            <input
              id="gsid"
              type="text"
              placeholder="After OCR, same session"
              value={graphSessionId}
              onChange={(e) => setGraphSessionId(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="got">or raw ocr_text (new session)</label>
            <input
              id="got"
              type="text"
              placeholder="Paste tag text…"
              value={graphOcrText}
              onChange={(e) => setGraphOcrText(e.target.value)}
            />
          </div>
        </div>
        <button type="button" className="primary" disabled={busy} onClick={handleGraphOnly}>
          Run graph
        </button>
        {graphOut ? (
          <>
            <div className="result-block">
              <label>session_id</label>
              <pre>{graphOut.session_id}</pre>
            </div>
            <div className="result-block">
              <label>Summary</label>
              <div className="box">{graphOut.summary || "—"}</div>
            </div>
            <div className="result-block">
              <label>search_query</label>
              <pre>{graphOut.search_query || "—"}</pre>
            </div>
          </>
        ) : null}
      </section>

      <section>
        <h2>4. Load session</h2>
        <div className="field">
          <label htmlFor="lid">session_id</label>
          <input
            id="lid"
            type="text"
            placeholder="GET /api/sessions/{id}"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
          />
        </div>
        <button type="button" className="secondary" disabled={busy} onClick={handleLookup}>
          Fetch session
        </button>
        {sessionDoc ? (
          <div className="result-block">
            <label>Document</label>
            <pre>{JSON.stringify(sessionDoc, null, 2)}</pre>
          </div>
        ) : null}
      </section>
    </div>
  );
}
