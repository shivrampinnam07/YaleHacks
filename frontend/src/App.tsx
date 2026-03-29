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

const heroImages = [
  "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=80",
];

const garmentPlaceholders = [
  {
    image:
      "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80",
    label: "Upload a label shot",
    text: "Composition, origin, and washing notes will be parsed from the tag.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80",
    label: "Stage the piece",
    text: "Use a clean care-tag photo and we will translate it into a closet-ready impact card.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=80",
    label: "Retail-grade intake",
    text: "Treat every garment like a premium listing with metadata, visuals, and material context.",
  },
];

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
          <div className="topbar">
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
                <p className="brand-kicker">YaleHacks sustainable wardrobe intelligence</p>
                <p className="brand-title">WeaveWise</p>
              </div>
            </div>
            <div className="topbar-pills">
              <span className="top-pill">Tag reader</span>
              <span className="top-pill">Wardrobe scoring</span>
              <span className="top-pill">Social impact</span>
            </div>
          </div>
          <section className="hero-panel">
            <div className="hero-copy">
              <p className="hero-eyebrow">Read garment labels, reveal materials, and understand impact</p>
              <h1 className="hero-title">Know the full story behind every piece in your wardrobe.</h1>
              <p className="header-tagline">
                Upload garment tags, extract materials and care details, and turn them into a refined wardrobe-level view of climate, sourcing, and long-term wear.
              </p>
              <div className="hero-actions">
                <a className="hero-link" href="#upload-lab">Start scanning</a>
                <span className="hero-note">{doneCount} garments analyzed in this session</span>
              </div>
            </div>
            <div className="hero-stack">
              <article className="hero-card hero-card--dark">
                <img className="hero-card-image" src={heroImages[0]} alt="" />
                <span className="hero-card-label">Most loved flow</span>
                <strong>Upload tag</strong>
                <p>Photo-first intake with instant preview and item-by-item progress.</p>
              </article>
              <article className="hero-card hero-card--light">
                <img className="hero-card-image" src={heroImages[1]} alt="" />
                <span className="hero-card-label">Why it matters</span>
                <strong>Beyond fabric</strong>
                <p>Materials, origin, and care instructions all shape the final footprint.</p>
              </article>
            </div>
          </section>
        </div>
      </header>

      <main className="site-main">
        <div className="app">
          <section className="editorial-grid">
            <article className="editorial-card">
              <span className="editorial-kicker">How it works</span>
              <h2>Scan a garment like a listing.</h2>
              <p>Add the piece, upload the tag, and let the app turn the care label into a structured sustainability profile.</p>
            </article>
            <article className="editorial-card editorial-card--soft">
              <span className="editorial-kicker">What you get</span>
              <h2>One piece view + wardrobe story.</h2>
              <p>Every item gets a quick read, then the whole closet gets compared for repeated fibers, themes, and higher-concern pieces.</p>
            </article>
            <article className="editorial-card editorial-card--accent">
              <span className="editorial-kicker">Built for discovery</span>
              <h2>Fashion-native UI.</h2>
              <p>More scrollable, more visual, and more editorial so it feels closer to a marketplace than a developer dashboard.</p>
            </article>
          </section>

          <section id="upload-lab" className="section-shell">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Upload lab</p>
                <h2>Your wardrobe intake</h2>
              </div>
              <p className="section-copy">
                Add each garment like a listing card. Photos drive the analysis, descriptions make the summary more human.
              </p>
            </div>

            <div className="summary-strip">
              <div className="summary-pill">
                <strong>{items.length}</strong>
                <span>garments in queue</span>
              </div>
              <div className="summary-pill">
                <strong>{items.filter((x) => x.file).length}</strong>
                <span>with photos</span>
              </div>
              <div className="summary-pill">
                <strong>{doneCount}</strong>
                <span>analyzed</span>
              </div>
            </div>

            <div className="wardrobe-grid">
              {items.map((it, idx) => {
                const placeholder = garmentPlaceholders[idx % garmentPlaceholders.length];
                return (
                <article key={it.localId} className="wardrobe-item">
                  <div className="wardrobe-item-head">
                    <div>
                      <span className="wardrobe-item-index">Item {idx + 1}</span>
                      <span className="wardrobe-item-title">Closet card</span>
                    </div>
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
                      placeholder="Vintage fleece, washed black, everyday layer"
                      value={it.description}
                      disabled={globalBusy}
                      onChange={(e) => {
                        updateItem(it.localId, { description: e.target.value });
                        setImpact(null);
                      }}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor={`${formId}-f-${it.localId}`}>Care tag photo</label>
                    <input
                      id={`${formId}-f-${it.localId}`}
                      type="file"
                      accept="image/*"
                      disabled={globalBusy}
                      onChange={(e) => onFile(it.localId, e.target.files?.[0] ?? null)}
                    />
                  </div>

                  {it.previewUrl ? (
                    <div className="image-frame">
                      <img className="preview wardrobe-thumb" src={it.previewUrl} alt="" />
                    </div>
                  ) : (
                    <div className="image-placeholder">
                      <img className="image-placeholder-photo" src={placeholder.image} alt="" />
                      <div className="image-placeholder-copy">
                        <span>{placeholder.label}</span>
                        <p>{placeholder.text}</p>
                      </div>
                    </div>
                  )}

                  {it.error ? <div className="err small">{it.error}</div> : null}

                  {it.status === "done" ? (
                    <div className="wardrobe-results">
                      {it.ocrText ? (
                        <div className="result-block tight">
                          <label>Tag text</label>
                          <div className="box small">{it.ocrText}</div>
                        </div>
                      ) : null}
                      {it.summary ? (
                        <div className="result-block tight">
                          <label>Impact read</label>
                          <div className="box small">{it.summary}</div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
                );
              })}
            </div>

            <div className="actions">
              <button type="button" className="secondary" disabled={globalBusy} onClick={addRow}>
                Add another garment
              </button>
              <button
                type="button"
                className="primary"
                disabled={globalBusy || !items.some((x) => x.file)}
                onClick={analyzeAll}
              >
                {globalBusy ? "Analyzing…" : "Analyze selected tags"}
              </button>
            </div>
            <div className="hint">
              {doneCount} / {items.filter((x) => x.file).length || items.length} garments with photos analyzed.
            </div>
          </section>

          <section className="section-shell report-shell">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Wardrobe report</p>
                <h2>From individual pieces to closet-wide patterns</h2>
              </div>
              <p className="section-copy">
                Turn your scanned items into a ranked, comparable wardrobe report with repeat fibers, top concerns, and an editorial-style summary.
              </p>
            </div>
            <div className="report-cta">
              <div>
                <strong>Generate the full report</strong>
                <p>Best when at least one garment has completed tag analysis.</p>
              </div>
              <button
                type="button"
                className="primary"
                disabled={impactBusy || !canImpact}
                onClick={runWardrobeImpact}
              >
                {impactBusy ? "Generating report…" : "Build wardrobe report"}
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
