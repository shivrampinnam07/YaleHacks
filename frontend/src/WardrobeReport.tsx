import type { WardrobeImpactResponse } from "./api";

export function WardrobeReport({ data }: { data: WardrobeImpactResponse }) {
  const tbl = data.comparison_table;
  const metrics = data.aggregation_metrics;

  return (
    <div className="wardrobe-report">
      <div className="result-block">
        <label>Each garment — quick read</label>
        <div className="per-item-summaries">
          {data.per_item.map((it, i) => (
            <div key={i} className="per-item-card">
              <div className="per-item-topline">
                <span className="per-item-chip">Piece {i + 1}</span>
                <h3 className="per-item-title">{it.title}</h3>
              </div>
              <ul className="per-item-bullets">
                {it.summary_points.map((p, j) => (
                  <li key={j}>{p}</li>
                ))}
              </ul>
              <div className="per-item-meta">
                <div>
                  <span className="metric-label">Materials</span>
                  <p className="metric-value">{it.key_materials || "—"}</p>
                </div>
                <div>
                  <span className="metric-label">Top impact</span>
                  <p className="metric-value">{it.top_environmental_impacts || "—"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {tbl.headers.length > 0 && tbl.rows.length > 0 ? (
        <div className="result-block">
          <label>Comparison — all garments</label>
          <div className="table-scroll">
            <table className="impact-table">
              <thead>
                <tr>
                  {tbl.headers.map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tbl.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {metrics ? (
        <div className="result-block">
          <label>Aggregation metrics ({metrics.item_count} items)</label>
          <div className="metrics-grid">
            <div className="metric-card">
              <span className="metric-label">Fibers seen in more than one piece</span>
              <p className="metric-value">
                {metrics.fibers_repeated_across_items.length
                  ? metrics.fibers_repeated_across_items.join(", ")
                  : "—"}
              </p>
            </div>
            <div className="metric-card">
              <span className="metric-label">Themes repeated across items</span>
              <p className="metric-value">
                {metrics.themes_repeated_across_items.length
                  ? metrics.themes_repeated_across_items.join(", ")
                  : "—"}
              </p>
            </div>
            <div className="metric-card">
              <span className="metric-label">Item index — highest concern (1-based)</span>
              <p className="metric-value">
                {metrics.highest_concern_garment_index != null
                  ? String(metrics.highest_concern_garment_index)
                  : "—"}
              </p>
            </div>
            <div className="metric-card wide">
              <span className="metric-label">Notes</span>
              <p className="metric-value">{metrics.notes || "—"}</p>
            </div>
          </div>
        </div>
      ) : null}

      {data.aggregation_narrative ? (
        <div className="result-block">
          <label>Aggregation — how it fits together</label>
          <div className="box prose">{data.aggregation_narrative}</div>
        </div>
      ) : null}

      {data.final_conclusion ? (
        <div className="result-block">
          <label>Final conclusion</label>
          <div className="box prose conclusion">{data.final_conclusion}</div>
        </div>
      ) : null}
    </div>
  );
}
