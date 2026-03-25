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
import { dropSortKey, esc, renderRoadmapHtml } from "./roadmap-render.mjs";

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

/** All status-type columns on the main board (order preserved). */
function statusColumnsInOrder(columns) {
  return (columns || []).filter((c) => c.type === "status");
}

/**
 * Parent rows often have several Status columns (e.g. "Status" vs "FE Status").
 * Prefer the main column users update for overall state, then any explicit Done.
 */
function parentItemStatus(item, columns) {
  const defs = statusColumnsInOrder(columns);
  const cvs = (item.column_values || []).filter((cv) => defs.some((d) => d.id === cv.id));
  if (!cvs.length) return "—";

  const titleEq = (t, want) => (t || "").trim().toLowerCase() === want;

  const pickByTitle = (want) => {
    const def = defs.find((d) => titleEq(d.title, want));
    if (!def) return null;
    const cv = cvs.find((x) => x.id === def.id);
    return cv ? statusFromCv(cv) : null;
  };

  for (const want of ["status", "project status", "feature status", "delivery status", "state"]) {
    const label = pickByTitle(want);
    if (label && label !== "—") return label;
  }

  const labels = cvs.map((cv) => statusFromCv(cv)).filter((s) => s && s !== "—");
  if (labels.some((l) => l.toLowerCase() === "done")) return "Done";

  for (const def of defs) {
    const cv = cvs.find((x) => x.id === def.id);
    if (cv) {
      const t = statusFromCv(cv);
      if (t && t !== "—") return t;
    }
  }
  return "—";
}

function subitemStatus(sub) {
  const cv = sub.column_values?.find((c) => c.type === "status");
  return statusFromCv(cv);
}

/** Parent drop labels; omits Unassigned / empty. Skip item when this is empty. */
function parentDropLabelsFromItem(item, dropColId, groupTitleFallback) {
  const raw = dropsFromItem(item, dropColId, dropColId ? null : groupTitleFallback);
  return [...new Set((raw || []).filter((d) => d && String(d).trim() && d !== "Unassigned"))];
}

/** Subitem shown in bucket when its Drop matches, or subitem has no Drop and parent is in that bucket. */
function subitemsForBucketFromApi(subitems, bucketKey, parentDropKeys, dropColId) {
  return (subitems || [])
    .filter((sub) => {
      const sd = parentDropLabelsFromItem(sub, dropColId, null);
      if (sd.length === 0) return parentDropKeys.includes(bucketKey);
      return sd.includes(bucketKey);
    })
    .map((s) => ({
      name: s.name || "—",
      status: subitemStatus(s),
    }));
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
  const dropColId = dropCol?.id ?? null;

  /** @type {Map<string, Array<{ id: string; name: string; status: string; subitems: { name: string; status: string }[] }>>} */
  const buckets = new Map();
  /** @type {Map<string, { status: string }>} */
  const idToParent = new Map();

  for (const group of board.groups || []) {
    const gFallback = groupTitleAsDrop(group.title);
    const items = group.items_page?.items || group.items || [];
    for (const item of items) {
      const dropLabels = parentDropLabelsFromItem(item, dropColId, gFallback);
      if (dropLabels.length === 0) continue;

      const parentStatus = parentItemStatus(item, board.columns);
      const name = item.name || "—";
      if (!idToParent.has(item.id)) idToParent.set(item.id, { status: parentStatus });

      for (const d of dropLabels) {
        if (!buckets.has(d)) buckets.set(d, []);
        const subFiltered = subitemsForBucketFromApi(item.subitems, d, dropLabels, dropColId);
        buckets.get(d).push({
          id: item.id,
          name,
          status: parentStatus,
          subitems: subFiltered,
        });
      }
    }
  }

  const dropKeys = [...buckets.keys()].sort((a, b) => dropSortKey(a) - dropSortKey(b) || a.localeCompare(b));

  const uniqueCount = idToParent.size;
  let doneCount = 0;
  for (const f of idToParent.values()) {
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
      statusColumns: statusColumnsInOrder(board.columns)
        .map((c) => c.title || c.id)
        .join(", "),
    },
  };
}

async function main() {
  const board = await fetchBoard();
  const model = buildFeatures(board);
  const generatedAt = new Date().toISOString();
  const html = renderRoadmapHtml(model, {
    metaDescription: "Interactive roadmap grouped by release drop with nested sub-items (generated from Monday.com).",
    sourceLineHtml: `Source: Monday.com board ${esc(BOARD_ID)} · Updated ${esc(generatedAt)} · <a href="live-board.html" style="color:#fff;text-decoration:underline">Live board</a> (login required, no API token)`,
  });
  const out = join(ROOT, "index.html");
  writeFileSync(out, html, "utf8");
  console.log(`Wrote ${out}`);
  console.log(`Drops: ${model.dropKeys.join(" | ")}`);
  console.log(`Mapped columns — Drop: ${model.meta.dropColumn}; Status columns: ${model.meta.statusColumns || "—"}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
