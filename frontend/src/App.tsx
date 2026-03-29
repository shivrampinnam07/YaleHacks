import { useCallback, useId, useState } from "react";
import { BackgroundClothes } from "./BackgroundClothes";
import { WardrobeReport } from "./WardrobeReport";
import {
  postGraph,
  postOcr,
  postWardrobeImpact,
  type GraphResponse,
  type WardrobeImpactResponse,
} from "./api";

type ItemStatus = "draft" | "analyzing" | "done" | "error";

type WardrobeItem = {
  localId: string;
  description: string;
  file: File | null;
  previewUrl: string | null;
  status: ItemStatus;
  sessionId?: string;
  ocrText?: string;
  summary?: string;
  searchQuery?: string;
  error?: string;
};

function newItem(): WardrobeItem {
  return {
    localId: crypto.randomUUID(),
    description: "",
    file: null,
    previewUrl: null,
    status: "draft",
  };
}

export default function App() {
  const formId = useId();
  const [items, setItems] = useState<WardrobeItem[]>(() => [newItem(), newItem()]);
  const [globalBusy, setGlobalBusy] = useState(false);
  const [globalErr, setGlobalErr] = useState<string | null>(null);
  const [impactBusy, setImpactBusy] = useState(false);
  const [impact, setImpact] = useState<WardrobeImpactResponse | null>(null);

  const updateItem = useCallback((localId: string, patch: Partial<WardrobeItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.localId === localId ? { ...it, ...patch } : it))
    );
  }, []);

  const onFile = (localId: string, file: File | null) => {
    setItems((prev) => {
      const row = prev.find((x) => x.localId === localId);
      if (row?.previewUrl) URL.revokeObjectURL(row.previewUrl);
      const cleared = {
        sessionId: undefined,
        ocrText: undefined,
        summary: undefined,
        searchQuery: undefined,
        error: undefined,
      };
      if (!file) {
        return prev.map((it) =>
          it.localId === localId
            ? {
                ...it,
                file: null,
                previewUrl: null,
                status: "draft" as const,
                ...cleared,
              }
            : it
        );
      }
      const url = URL.createObjectURL(file);
      return prev.map((it) =>
        it.localId === localId
          ? {
              ...it,
              file,
              previewUrl: url,
              status: "draft" as const,
              ...cleared,
            }
          : it
      );
    });
    setImpact(null);
  };

  const addRow = () => {
    setItems((prev) => [...prev, newItem()]);
    setImpact(null);
  };

  const removeRow = (localId: string) => {
    setItems((prev) => {
      const it = prev.find((x) => x.localId === localId);
      if (it?.previewUrl) URL.revokeObjectURL(it.previewUrl);
      const next = prev.filter((x) => x.localId !== localId);
      return next.length ? next : [newItem()];
    });
    setImpact(null);
  };

  const analyzeOne = async (it: WardrobeItem): Promise<WardrobeItem> => {
    if (!it.file) {
      return { ...it, status: "error" as const, error: "Add a tag photo." };
    }
    const next: WardrobeItem = { ...it, status: "analyzing", error: undefined };
    try {
      const ocr = await postOcr(it.file, undefined, it.description.trim() || undefined);
      const graph: GraphResponse = await postGraph({ session_id: ocr.session_id });
      return {
        ...next,
        status: "done",
        sessionId: ocr.session_id,
        ocrText: ocr.ocr_text,
        summary: graph.summary ?? "",
        searchQuery: graph.search_query ?? "",
      };
    } catch (e) {
      return {
        ...next,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      };
    }
  };

  const analyzeAll = async () => {
    setGlobalErr(null);
    setImpact(null);
    setGlobalBusy(true);
    try {
      const snapshot = [...items];
      for (const it of snapshot) {
        if (!it.file) continue;
        setItems((prev) =>
          prev.map((row) =>
            row.localId === it.localId ? { ...row, status: "analyzing" as const } : row
          )
        );
        const updated = await analyzeOne({ ...it, status: "analyzing" });
        setItems((prev) =>
          prev.map((row) => (row.localId === it.localId ? updated : row))
        );
      }
    } finally {
      setGlobalBusy(false);
    }
  };

  const runWardrobeImpact = async () => {
    setGlobalErr(null);
    const payload = items
      .filter((it) => (it.summary || "").trim())
      .map((it) => ({
        description: it.description.trim() || undefined,
        ocr_text: it.ocrText ?? "",
        summary: it.summary ?? "",
        session_id: it.sessionId,
      }));
    if (!payload.length) {
      setGlobalErr("Analyze at least one garment with a tag photo first.");
      return;
    }
    setImpactBusy(true);
    setImpact(null);
    try {
      const out = await postWardrobeImpact(payload);
      setImpact(out);
    } catch (e) {
      setGlobalErr(e instanceof Error ? e.message : String(e));
    } finally {
      setImpactBusy(false);
    }
  };

  const doneCount = items.filter((it) => it.status === "done").length;
  const canImpact = items.some((it) => (it.summary || "").trim());

  return (
    <div className="site">
      <BackgroundClothes />
      <header className="site-header">
        <div className="site-header-inner">
          <div className="brand-block">
            <span className="brand-mark" aria-hidden>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path
                  d="M12 14c0-4 4-8 8-8s8 4 8 8l4 2 6 3v6H4v-6l6-3 4-2z"
                  fill="currentColor"
                  opacity="0.9"
                />
                <path
                  d="M8 22v10c0 3 6 6 12 6s12-3 12-6V22"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  opacity="0.6"
                />
              </svg>
            </span>
            <div>
              <p className="brand-kicker">YaleHacks · Textiles &amp; society</p>
              <p className="brand-title">Wardrobe impact</p>
            </div>
          </div>
          <p className="header-tagline">
            What we wear connects to workers, water, climate, and communities — read the label,
            learn the story.
          </p>
        </div>
      </header>

      <main className="site-main">
        <div className="app">
          <h1>Test my wardrobe</h1>
          <p className="sub">
            Add each garment&apos;s description and care-label photo. We read the tag, search trusted
            sources, and summarize — then blend everything into one societal-impact view of your
            closet.
          </p>

          <section>
        <h2>Your clothes</h2>
        <div className="wardrobe-list">
          {items.map((it, idx) => (
            <div key={it.localId} className="wardrobe-item">
              <div className="wardrobe-item-head">
                <span className="wardrobe-item-title">Garment {idx + 1}</span>
                <span className={`wardrobe-badge status-${it.status}`}>{it.status}</span>
                <button
                  type="button"
                  className="icon-remove"
                  onClick={() => removeRow(it.localId)}
                  aria-label="Remove garment"
                  disabled={globalBusy}
                >
                  ×
                </button>
              </div>
              <div className="field">
                <label htmlFor={`${formId}-d-${it.localId}`}>Description</label>
                <input
                  id={`${formId}-d-${it.localId}`}
                  type="text"
                  placeholder="e.g. Winter parka, blue, daily wear"
                  value={it.description}
                  disabled={globalBusy}
                  onChange={(e) => {
                    updateItem(it.localId, { description: e.target.value });
                    setImpact(null);
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor={`${formId}-f-${it.localId}`}>Tag photo</label>
                <input
                  id={`${formId}-f-${it.localId}`}
                  type="file"
                  accept="image/*"
                  disabled={globalBusy}
                  onChange={(e) => onFile(it.localId, e.target.files?.[0] ?? null)}
                />
              </div>
              {it.previewUrl ? (
                <img className="preview wardrobe-thumb" src={it.previewUrl} alt="" />
              ) : null}
              {it.error ? <div className="err small">{it.error}</div> : null}
              {it.status === "done" ? (
                <div className="wardrobe-results">
                  {it.sessionId ? (
                    <div className="result-block tight">
                      <label>Session</label>
                      <pre className="tiny">{it.sessionId}</pre>
                    </div>
                  ) : null}
                  {it.ocrText ? (
                    <div className="result-block tight">
                      <label>Tag text</label>
                      <div className="box small">{it.ocrText}</div>
                    </div>
                  ) : null}
                  {it.summary ? (
                    <div className="result-block tight">
                      <label>Item summary</label>
                      <div className="box small">{it.summary}</div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <div className="actions">
          <button type="button" className="secondary" disabled={globalBusy} onClick={addRow}>
            Add garment
          </button>
          <button
            type="button"
            className="primary"
            disabled={globalBusy || !items.some((x) => x.file)}
            onClick={analyzeAll}
          >
            {globalBusy ? "Analyzing…" : "Analyze all with photos"}
          </button>
        </div>
        <div className="hint">
          {doneCount} / {items.filter((x) => x.file).length || items.length} with photos analyzed
          (only rows with a photo are processed).
        </div>
      </section>

      <section>
        <h2>Wardrobe report</h2>
        <p className="muted-block">
          Builds per-garment highlights (1–2 points each), a comparison table, aggregation metrics
          when you have more than one item, a short cross-piece narrative, and a final conclusion.
        </p>
        <div className="actions">
          <button
            type="button"
            className="primary"
            disabled={impactBusy || !canImpact}
            onClick={runWardrobeImpact}
          >
            {impactBusy ? "Generating report…" : "Generate full wardrobe report"}
          </button>
        </div>
        {globalErr ? <div className="err">{globalErr}</div> : null}
        {impact ? <WardrobeReport data={impact} /> : null}
      </section>
        </div>
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <p className="footer-line">
            Better information helps everyone choose clothes that align with the world we want —
            fair work, less waste, and a healthier environment.
          </p>
          <p className="footer-meta">YaleHacks · Societal impact through everyday threads</p>
        </div>
      </footer>
    </div>
  );
}
