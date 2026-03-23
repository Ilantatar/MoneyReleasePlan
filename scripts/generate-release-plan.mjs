/**
 * Fetches Monday.com board data via GraphQL and writes ../index.html
 * (release plan: columns by Drop, parent status, subitems = name + status only).
 *
 * Env:
 *   MONDAY_API_TOKEN — required (Monday API token; use value shown in Monday admin)
 *   MONDAY_BOARD_ID — optional, default 18396795757
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOARD_ID = process.env.MONDAY_BOARD_ID || "18396795757";
const TOKEN = process.env.MONDAY_API_TOKEN;

const QUERY = `
query ReleasePlan($ids: [ID!]!) {
  boards(ids: $ids) {
    id
    name
    columns {
      id
      title
      type
    }
    groups {
      id
      title
      items_page(limit: 500) {
        items {
          id
          name
          column_values {
            id
            type
            text
            value
          }
          subitems {
            id
            name
            column_values {
              id
              type
              text
              value
            }
          }
        }
      }
    }
  }
}
`;

const CSS = `  :root {
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
  details.feature { background: var(--card); border-radius: 16px; border: 1px solid rgba(148,163,184,.18); box-shadow: 0 8px 22px rgba(31,41,55,.05); overflow: hidden; }
  details.feature[open] { box-shadow: 0 14px 30px rgba(31,41,55,.08); }
  summary {
    list-style: none; cursor: pointer; padding: 14px 14px 12px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  }
  summary::-webkit-details-marker { display: none; }
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

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseJsonSafe(s) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function statusFromCv(cv) {
  if (!cv) return "—";
  const j = parseJsonSafe(cv.value);
  if (j && (j.label || j.text)) return String(j.label || j.text);
  const t = (cv.text || "").trim();
  return t || "—";
}

function dropsFromItem(item, dropColId, groupTitleFallback) {
  if (!dropColId) {
    if (groupTitleFallback) return [groupTitleFallback];
    return ["Unassigned"];
  }
  const cv = item.column_values?.find((c) => c.id === dropColId);
  if (!cv) {
    return groupTitleFallback ? [groupTitleFallback] : ["Unassigned"];
  }
  const raw = (cv.text || "").trim();
  if (raw) {
    const parts = raw
      .split(/[,;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (parts.length) return parts;
  }
  const j = parseJsonSafe(cv.value);
  if (j?.label) return [String(j.label)];
  if (Array.isArray(j?.labels) && j.labels.length) {
    return j.labels.map((x) => (typeof x === "string" ? x : x?.name || x?.label)).filter(Boolean);
  }
  return groupTitleFallback ? [groupTitleFallback] : ["Unassigned"];
}

function groupTitleAsDrop(title) {
  const t = (title || "").trim();
  if (!t) return null;
  if (/^V\d/i.test(t)) return t;
  return null;
}

function findDropColumn(columns) {
  const list = columns || [];
  const byExact = list.find((c) => (c.title || "").toLowerCase() === "drop");
  if (byExact) return byExact;
  return list.find((c) => /drop|release/i.test(c.title || "") && c.type !== "name");
}

function findParentStatusColumn(columns) {
  const list = columns || [];
  const statusCols = list.filter((c) => c.type === "status");
  if (!statusCols.length) return null;
  const named = statusCols.find((c) => /status|project|feature/i.test((c.title || "").toLowerCase()));
  return named || statusCols[0];
}

function statusBadgeClass(label) {
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

function dropSortKey(label) {
  const m = String(label).match(/V\s*(\d+)/i);
  if (m) return parseInt(m[1], 10) * 10000 + String(label).length;
  return 50000 + String(label).charCodeAt(0);
}

function subitemStatus(sub) {
  const cv = sub.column_values?.find((c) => c.type === "status");
  return statusFromCv(cv);
}

async function fetchBoard() {
  if (!TOKEN) {
    throw new Error("MONDAY_API_TOKEN is not set.");
  }
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: TOKEN,
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query: QUERY, variables: { ids: [BOARD_ID] } }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.errors?.[0]?.message || json?.message || `HTTP ${res.status}`);
  }
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  const board = json.data?.boards?.[0];
  if (!board) throw new Error("Board not found or no access.");
  return board;
}

function buildFeatures(board) {
  const dropCol = findDropColumn(board.columns);
  const statusCol = findParentStatusColumn(board.columns);
  const dropColId = dropCol?.id ?? null;
  const statusColId = statusCol?.id ?? null;

  /** @type {Map<string, Array<{ id: string; name: string; status: string; subitems: { name: string; status: string }[] }>>} */
  const buckets = new Map();
  /** @type {Map<string, { id: string; name: string; status: string; subitems: { name: string; status: string }[] }>} */
  const idToFeature = new Map();

  for (const group of board.groups || []) {
    const gFallback = groupTitleAsDrop(group.title);
    const items = group.items_page?.items || group.items || [];
    for (const item of items) {
      const dropLabels = dropsFromItem(item, dropColId, gFallback);
      const statusCv = statusColId ? item.column_values?.find((c) => c.id === statusColId) : null;
      let parentStatus = statusFromCv(statusCv);
      if (parentStatus === "—") {
        const anyStatus = item.column_values?.find((c) => c.type === "status");
        parentStatus = statusFromCv(anyStatus);
      }
      const subs = (item.subitems || []).map((s) => ({
        name: s.name || "—",
        status: subitemStatus(s),
      }));
      const feature = {
        id: item.id,
        name: item.name || "—",
        status: parentStatus,
        subitems: subs,
      };
      if (!idToFeature.has(item.id)) idToFeature.set(item.id, feature);
      for (const d of dropLabels) {
        const key = d || "Unassigned";
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(feature);
      }
    }
  }

  const dropKeys = [...buckets.keys()].sort((a, b) => dropSortKey(a) - dropSortKey(b) || a.localeCompare(b));

  const uniqueCount = idToFeature.size;
  let doneCount = 0;
  for (const f of idToFeature.values()) {
    if (String(f.status).toLowerCase() === "done") doneCount++;
  }
  const progress = uniqueCount ? Math.round((doneCount / uniqueCount) * 100) : 0;

  return {
    boardName: board.name || "Money roadmap",
    dropKeys,
    buckets,
    stats: {
      uniqueCount,
      doneCount,
      progress,
      dropCount: dropKeys.length,
    },
    meta: {
      dropColumn: dropCol?.title || dropCol?.id || "(group / unassigned)",
      statusColumn: statusCol?.title || statusCol?.id || "(first status)",
    },
  };
}

function renderFeature(f) {
  const badge = `<span class="badge ${statusBadgeClass(f.status)}">${esc(f.status)}</span>`;
  const subBlock =
    f.subitems.length > 0
      ? `<div class="feature-body"><div class="subsection"><div class="subsection-title">Subitems</div><div class="subitems">${f.subitems
          .map(
            (s) => `<div class="subitem"><div class="subitem-top"><div class="subitem-name">${esc(s.name)}</div><div class="subitem-badges"><span class="badge ${statusBadgeClass(s.status)}">${esc(s.status)}</span></div></div></div>`
          )
          .join("")}</div></div></div>`
      : "";
  return `<details class="feature"><summary><span class="feature-title">${esc(f.name)}</span>${badge}</summary>${subBlock}</details>`;
}

function renderHtml(model) {
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

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(boardName)} — Roadmap</title>
<meta name="description" content="Interactive roadmap grouped by release drop with nested sub-items (generated from Monday.com)." />
<meta name="theme-color" content="#4f7cff" />
<style>
${CSS}
  .grid { ${gridStyle} }
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <h1>${esc(boardName)}</h1>
    <p>Features grouped by drop, with nested sub-items (name and status only).</p>
    <p style="margin-top:10px;font-size:12px;opacity:.9">Source: Monday.com board ${esc(BOARD_ID)} · Updated ${esc(generatedAt)}</p>
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

async function main() {
  const board = await fetchBoard();
  const model = buildFeatures(board);
  const html = renderHtml(model);
  const out = join(ROOT, "index.html");
  writeFileSync(out, html, "utf8");
  console.log(`Wrote ${out}`);
  console.log(`Drops: ${model.dropKeys.join(" | ")}`);
  console.log(`Mapped columns — Drop: ${model.meta.dropColumn}; Parent status: ${model.meta.statusColumn}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
