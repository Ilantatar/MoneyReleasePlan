/**
 * Fetches Monday.com board data via GraphQL and writes ../index.html
 * (release plan: columns by Drop, parent status, subitems = name + status only).
 *
 * Env:
 *   MONDAY_API_TOKEN — required (Monday API token; use value shown in Monday admin)
 *   MONDAY_BOARD_ID — optional, default 18396795757
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeSubitemWeightedProgress,
  deriveParentStatusForBucket,
  dropSortKey,
  esc,
  isExcludedRoadmapParentName,
  isHiddenRoadmapStatus,
  renderRoadmapHtml,
} from "./roadmap-render.mjs";

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

/** Sub-item drops that are not on the parent (parent row vs sub row mismatch). */
function orphanSubDropLabelsFromItem(item, dropColId, parentDropKeys) {
  const parentSet = new Set(parentDropKeys);
  const out = new Set();
  for (const sub of item.subitems || []) {
    for (const d of parentDropLabelsFromItem(sub, dropColId, null)) {
      if (d && !parentSet.has(d)) out.add(d);
    }
  }
  return [...out];
}

/** Subitem in column bucketKey; parentDropKeys = parent's drops only. Orphan sub-drops (no overlap with parent) appear only on extension columns. */
function subitemsForBucketFromApi(subitems, bucketKey, parentDropKeys, dropColId) {
  const inParent = parentDropKeys.includes(bucketKey);
  return (subitems || [])
    .filter((sub) => {
      const sd = parentDropLabelsFromItem(sub, dropColId, null);
      if (!inParent) return sd.includes(bucketKey);
      if (sd.length === 0) return true;
      const overlapsParent = sd.some((d) => parentDropKeys.includes(d));
      if (!overlapsParent) return false;
      return sd.includes(bucketKey);
    })
    .map((s) => ({
      name: s.name || "—",
      status: subitemStatus(s),
    }));
}

async function fetchBoard() {
  const jsonPath = process.env.MONDAY_BOARD_JSON;
  if (jsonPath) {
    const json = JSON.parse(readFileSync(jsonPath, "utf8"));
    const board = json.data?.boards?.[0] ?? json.boards?.[0];
    if (!board) throw new Error(`No board in snapshot: ${jsonPath}`);
    return board;
  }
  if (!TOKEN) {
    throw new Error("MONDAY_API_TOKEN is not set (or set MONDAY_BOARD_JSON to a Monday API JSON snapshot).");
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
  /** @type {Map<string, { status: string, subitems: { status: string }[] }>} */
  const progressByParentId = new Map();

  for (const group of board.groups || []) {
    const gFallback = groupTitleAsDrop(group.title);
    const items = group.items_page?.items || group.items || [];
    for (const item of items) {
      const dropLabels = parentDropLabelsFromItem(item, dropColId, gFallback);
      if (dropLabels.length === 0) continue;

      const parentStatus = parentItemStatus(item, board.columns);
      const name = item.name || "—";
      if (isExcludedRoadmapParentName(name)) continue;
      if (isHiddenRoadmapStatus(parentStatus)) continue;
      if (!idToParent.has(item.id)) {
        idToParent.set(item.id, { status: parentStatus });
        progressByParentId.set(item.id, {
          status: parentStatus,
          subitems: (item.subitems || [])
            .filter((s) => !isHiddenRoadmapStatus(subitemStatus(s)))
            .map((s) => ({ status: subitemStatus(s) })),
        });
      }

      const placementDrops = [...new Set([...dropLabels, ...orphanSubDropLabelsFromItem(item, dropColId, dropLabels)])];
      for (const d of placementDrops) {
        const inParentColumn = dropLabels.includes(d);
        const subFiltered = subitemsForBucketFromApi(item.subitems, d, dropLabels, dropColId).filter(
          (s) => !isHiddenRoadmapStatus(s.status)
        );
        if (subFiltered.length === 0 && !inParentColumn) continue;
        if (!buckets.has(d)) buckets.set(d, []);
        buckets.get(d).push({
          id: item.id,
          name,
          status: deriveParentStatusForBucket(parentStatus, subFiltered),
          subitems: subFiltered,
        });
      }
    }
  }

  const dropKeys = [...buckets.keys()].sort((a, b) => dropSortKey(a) - dropSortKey(b) || a.localeCompare(b));

  const uniqueCount = idToParent.size;
  const progressRows = [...progressByParentId.values()];
  const { progress, doneCount } = computeSubitemWeightedProgress(progressRows);

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
  const sourceLabel = process.env.MONDAY_BOARD_JSON
    ? `Monday.com board ${esc(BOARD_ID)} (live snapshot)`
    : `Monday.com board ${esc(BOARD_ID)}`;
  const html = renderRoadmapHtml(model, {
    metaDescription: "Interactive roadmap grouped by release drop with nested sub-items (generated from Monday.com).",
    sourceLineHtml: `Source: ${sourceLabel} · Updated ${esc(generatedAt)} · <a href="live-board.html" style="color:#fff;text-decoration:underline">Live board</a> (Monday login)`,
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
