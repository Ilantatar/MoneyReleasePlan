/**
 * Shared CSS + HTML renderer for the roadmap index (API and XLSX pipelines).
 */

export const ROADMAP_CSS = `  :root {
    --bg: #eef2f8;
    --panel: rgba(255,255,255,.78);
    --card: #ffffff;
    --text: #1f2937;
    --muted: #6b7280;
    --shadow: 0 12px 30px rgba(31,41,55,.08);
    --v1: #4f7cff;
    --v2: #8c63ff;
    --v3: #3bbf74;
    --v4: #f2a34d;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: linear-gradient(180deg, #f4f7fb 0%, var(--bg) 100%);
    color: var(--text);
  }
  .wrap { max-width: 1550px; margin: 0 auto; padding: 24px; }
  .hero {
    background: linear-gradient(90deg, #9b4dff 0%, #4f7cff 100%);
    color: white;
    border-radius: 22px;
    padding: 28px 30px;
    box-shadow: var(--shadow);
  }
  .hero h1 { margin: 0; font-size: 30px; letter-spacing: -0.03em; }
  .hero p { margin: 8px 0 0; opacity: .9; }
  .stats {
    margin-top: 18px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }
  .stat {
    background: rgba(255,255,255,.14);
    border: 1px solid rgba(255,255,255,.18);
    border-radius: 18px;
    padding: 16px;
    backdrop-filter: blur(8px);
  }
  .stat .label { font-size: 12px; text-transform: uppercase; letter-spacing: .12em; opacity: .85; }
  .stat .value { font-size: 34px; font-weight: 800; margin-top: 6px; }
  .stat .small { font-size: 13px; opacity: .9; margin-top: 4px; }
  .content { margin-top: 22px; }
  .legend { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px; color: var(--muted); font-size: 13px; }
  .pill { padding: 7px 11px; border-radius: 999px; background: rgba(255,255,255,.8); box-shadow: var(--shadow); }
  .grid { display: grid; gap: 16px; align-items: start; }
  .drop {
    background: var(--panel);
    border: 1px solid rgba(148,163,184,.25);
    border-radius: 20px;
    box-shadow: var(--shadow);
    overflow: hidden;
    backdrop-filter: blur(8px);
  }
  .drop-head {
    padding: 16px 16px 14px;
    border-bottom: 1px solid rgba(148,163,184,.22);
    display: flex; justify-content: space-between; align-items: end; gap: 8px;
  }
  .drop-head h2 { margin: 0; font-size: 20px; }
  .drop-head .sub { color: var(--muted); font-size: 12px; margin-top: 2px; }
  .count { font-size: 12px; color: var(--muted); }
  .drop-body { padding: 12px; display: grid; gap: 12px; }
  details.feature, div.feature.feature-leaf {
    background: var(--card); border-radius: 16px; border: 1px solid rgba(148,163,184,.18); box-shadow: 0 8px 22px rgba(31,41,55,.05); overflow: hidden;
  }
  details.feature[open] { box-shadow: 0 14px 30px rgba(31,41,55,.08); }
  summary {
    list-style: none; cursor: pointer; padding: 14px 14px 12px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  }
  summary::-webkit-details-marker { display: none; }
  .feature-chevron {
    flex: 0 0 22px; width: 22px; display: inline-flex; align-items: center; justify-content: center;
    color: #9ca3af; font-size: 15px; font-weight: 600; line-height: 1; user-select: none;
    transition: transform 0.15s ease;
  }
  details.feature[open] > summary .feature-chevron { transform: rotate(90deg); }
  .feature-chevron-spacer { flex: 0 0 22px; width: 22px; }
  div.feature-leaf .feature-summary {
    padding: 14px 14px 12px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  }
  .feature-title { font-weight: 700; flex: 1 1 240px; line-height: 1.25; }
  .feature-body { padding: 0 14px 14px; border-top: 1px solid rgba(148,163,184,.16); }
  .badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 5px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: .02em;
    border: 1px solid transparent; white-space: nowrap;
  }
  .drop-badge { background: #f6f8ff; color: #4f46e5; border-color: rgba(79,70,229,.15); }
  .status-done { background: #e8f7ee; color: #187a3f; border-color: rgba(24,122,63,.15); }
  .status-wip { background: #edf4ff; color: #2e64c8; border-color: rgba(46,100,200,.15); }
  .status-discovery { background: #fff4db; color: #a66b00; border-color: rgba(166,107,0,.15); }
  .status-stuck { background: #ffe8e8; color: #c03636; border-color: rgba(192,54,54,.15); }
  .status-cancelled { background: #efefef; color: #666; border-color: rgba(102,102,102,.15); }
  .status-other, .status-empty { background: #f3f4f6; color: #374151; border-color: rgba(55,65,81,.12); }
  .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
  .meta { background: #f9fafb; border-radius: 12px; padding: 10px 11px; border: 1px solid rgba(148,163,184,.16); }
  .meta-k { display: block; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 4px; }
  .meta-v { font-size: 13px; line-height: 1.35; }
  .feature-body > .subsection:first-child { margin-top: 0; }
  .subsection { margin-top: 14px; }
  .subsection-title { font-size: 12px; text-transform: uppercase; letter-spacing: .14em; color: var(--muted); margin-bottom: 8px; }
  .subitems { display: grid; gap: 10px; }
  .subitem {
    background: linear-gradient(180deg, #fbfdff 0%, #f8fbff 100%);
    border-radius: 14px; padding: 11px; border: 1px solid rgba(148,163,184,.16);
  }
  .subitem-top { display: flex; gap: 10px; align-items: start; justify-content: space-between; }
  .subitem-name { font-size: 13px; font-weight: 700; line-height: 1.3; }
  .subitem-badges { display: flex; flex-wrap: wrap; gap: 6px; justify-content: end; }
  .submeta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
  .submeta-pill { font-size: 11px; color: #4b5563; background: rgba(255,255,255,.9); border: 1px solid rgba(148,163,184,.16); border-radius: 999px; padding: 5px 8px; }
  .hint { margin-top: 10px; color: var(--muted); font-size: 12px; }
  @media (max-width: 1180px) { .grid, .stats { grid-template-columns: repeat(2, minmax(0,1fr)); } }
  @media (max-width: 720px) { .grid, .stats, .meta-grid { grid-template-columns: 1fr; } .wrap { padding: 14px; } .hero { padding: 20px; } }
`;

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function statusBadgeClass(label) {
  const l = String(label).toLowerCase();
  if (l.includes("cancelled")) return "status-cancelled";
  if (l.includes("stuck")) return "status-stuck";
  if (l.includes("discovery")) return "status-discovery";
  if (l === "done" || (l.includes("done") && !l.includes("wip"))) return "status-done";
  if (l.includes("deployment")) return "status-done";
  if (l.includes("not started")) return "status-other";
  if (l.includes("design") || l === "qa" || l.includes("handle by")) return "status-other";
  if (l.includes("wip") || l.includes("dev") || l.includes("groom")) return "status-wip";
  if (l === "—" || !l.trim()) return "status-empty";
  return "status-other";
}

export function dropSortKey(label) {
  const m = String(label).match(/V\s*(\d+)/i);
  if (m) return parseInt(m[1], 10) * 10000 + String(label).length;
  return 50000 + String(label).charCodeAt(0);
}

export function renderFeature(f) {
  const badge = `<span class="badge ${statusBadgeClass(f.status)}">${esc(f.status)}</span>`;
  const title = esc(f.name);
  const hasSubs = f.subitems.length > 0;
  const subBlock = hasSubs
    ? `<div class="feature-body"><div class="subsection"><div class="subsection-title">Subitems</div><div class="subitems">${f.subitems
        .map(
          (s) => `<div class="subitem"><div class="subitem-top"><div class="subitem-name">${esc(s.name)}</div><div class="subitem-badges"><span class="badge ${statusBadgeClass(s.status)}">${esc(s.status)}</span></div></div></div>`
        )
        .join("")}</div></div></div>`
    : "";

  if (hasSubs) {
    return `<details class="feature feature-expandable"><summary><span class="feature-chevron" aria-hidden="true">›</span><span class="feature-title">${title}</span>${badge}</summary>${subBlock}</details>`;
  }
  return `<div class="feature feature-leaf"><div class="feature-summary"><span class="feature-chevron-spacer" aria-hidden="true"></span><span class="feature-title">${title}</span>${badge}</div></div>`;
}

/**
 * @param model {{ boardName: string, dropKeys: string[], buckets: Map<string, any[]>, stats: object }}
 * @param opts {{ sourceLineHtml: string, metaDescription?: string }}
 */
export function renderRoadmapHtml(model, opts) {
  const { boardName, dropKeys, buckets, stats } = model;
  const generatedAt = new Date().toISOString();
  const gridStyle =
    dropKeys.length <= 4
      ? `grid-template-columns: repeat(${Math.max(dropKeys.length, 1)}, minmax(0, 1fr));`
      : "grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));";

  const sections = dropKeys.map((drop, i) => {
    const features = buckets.get(drop) || [];
    const varIdx = (i % 4) + 1;
    const featuresHtml = features.map(renderFeature).join("");
    return `<section class="drop" style="border-top: 5px solid var(--v${varIdx});"><div class="drop-head"><div><h2>${esc(drop)}</h2><div class="sub">Release bucket</div></div><div class="count">${features.length} features</div></div><div class="drop-body">${featuresHtml}</div></section>`;
  });

  const desc = opts.metaDescription || "Interactive roadmap grouped by release drop with nested sub-items.";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(boardName)} — Roadmap</title>
<meta name="description" content="${esc(desc)}" />
<meta name="theme-color" content="#4f7cff" />
<style>
${ROADMAP_CSS}
  .grid { ${gridStyle} }
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <h1>${esc(boardName)}</h1>
    <p>Features grouped by drop, with nested sub-items (name and status only).</p>
    <p style="margin-top:10px;font-size:12px;opacity:.9">${opts.sourceLineHtml}</p>
    <div class="stats">
      <div class="stat"><div class="label">Total features</div><div class="value">${stats.uniqueCount}</div><div class="small">unique parent items</div></div>
      <div class="stat"><div class="label">Completed</div><div class="value">${stats.doneCount}</div><div class="small">parent status = Done</div></div>
      <div class="stat"><div class="label">Progress</div><div class="value">${stats.progress}%</div><div class="small">based on completed features</div></div>
      <div class="stat"><div class="label">Drops</div><div class="value">${stats.dropCount}</div><div class="small">distinct drop labels</div></div>
    </div>
  </div>
  <div class="content">
    <div class="legend">
      <span class="pill">Multi-drop features appear in every relevant drop bucket.</span>
      <span class="pill">Sub-items show name and status only.</span>
    </div>
    <div class="grid">
${sections.join("\n")}
    </div>
  </div>
</div>
<!-- generated-at: ${esc(generatedAt)} -->
</body>
</html>
`;
}
