/**
 * Builds index.html from a Monday "Export to Excel" file (no API token).
 *
 * Layout matches Generate_Release_Plan_Html.ps1 / typical eToro Plus Money export:
 * - Skip first 3 sheet rows; parent name in column A; subitems: A blank, name in B, status in D.
 * - Parent status column C, Drop column H (0-based: 2 and 7).
 * - Subitem Drop column F (0-based: 5); column E is often JIRA. Parent also appears in extra columns for sub-only drops (e.g. parent V2/V3, sub V1 → row under V1 with that sub only).
 * - Parents with no Drop are omitted; subitems under a skipped parent are ignored.
 *
 * Env:
 *   BOARD_XLSX — path to .xlsx (default: data/board-export.xlsx)
 *   BOARD_TITLE — hero title (default: eToro Plus — Money Roadmap)
 *   MONDAY_XLS_* — optional 0-based column overrides (see README)
 *   BOARD_EXCLUDED_PARENTS — optional extra | pipe-separated parent names to omit (see isExcludedRoadmapParentName defaults in roadmap-render.mjs)
 */

import { existsSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
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

/** Prefer lowercase data/ (Linux CI); Windows often uses same folder as Data/. */
function resolveDefaultXlsxPath() {
  if (process.env.BOARD_XLSX) return process.env.BOARD_XLSX;
  const lower = join(ROOT, "data", "board-export.xlsx");
  const upperD = join(ROOT, "Data", "board-export.xlsx");
  if (existsSync(lower)) return lower;
  if (existsSync(upperD)) return upperD;
  return lower;
}

const COL = {
  parentName: Number(process.env.MONDAY_XLS_COL_PARENT_NAME ?? 0),
  subName: Number(process.env.MONDAY_XLS_COL_SUB_NAME ?? 1),
  parentStatus: Number(process.env.MONDAY_XLS_COL_PARENT_STATUS ?? 2),
  subStatus: Number(process.env.MONDAY_XLS_COL_SUB_STATUS ?? 3),
  subDrop: Number(process.env.MONDAY_XLS_COL_SUB_DROP ?? 5),
  drop: Number(process.env.MONDAY_XLS_COL_DROP ?? 7),
};

function cell(row, i) {
  if (!row || i < 0) return "";
  const v = row[i];
  if (v === undefined || v === null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

/** Split Drop cell; empty → [] (parent with no drop is excluded from the roadmap). */
function splitDrops(raw) {
  const t = (raw || "").trim();
  if (!t) return [];
  return t
    .split(/[,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Distinct non-empty drop labels for a parent row. */
function parentDropLabels(dropRaw) {
  return [...new Set(splitDrops(dropRaw))];
}

/** Sub-item drop labels that are not on the parent (e.g. sub on V1 while parent is V2/V3). */
function orphanSubDropLabelsFromParent(p) {
  const parentSet = new Set(parentDropLabels(p.dropRaw));
  const out = new Set();
  for (const s of p.subitems || []) {
    for (const d of splitDrops(s.dropRaw)) {
      if (d && !parentSet.has(d)) out.add(d);
    }
  }
  return [...out];
}

/** Columns where this parent appears: parent drops plus any orphan sub-only drops. */
function placementDropsForParent(p) {
  return [...new Set([...parentDropLabels(p.dropRaw), ...orphanSubDropLabelsFromParent(p)])];
}

/**
 * Parse sheet matrix using the same row rules as Generate_Release_Plan_Html.ps1.
 */
function parseMondayExportMatrix(matrix) {
  /** @type {{ id: string, name: string, status: string, dropRaw: string, subitems: { name: string, status: string, dropRaw: string }[] } | null} */
  let current = null;
  const parents = [];

  for (let ri = 0; ri < matrix.length; ri++) {
    const excelRow1Based = ri + 1;
    if (excelRow1Based <= 3) continue;

    const row = matrix[ri] || [];
    const a = cell(row, COL.parentName);
    const b = cell(row, COL.subName);
    const c = cell(row, COL.parentStatus);
    const d = cell(row, COL.subStatus);
    const dropVal = cell(row, COL.drop);
    const subDropVal = cell(row, COL.subDrop);

    if (a === "Subitems") {
      continue;
    }
    if (b === "Name" && c === "Owner" && d === "Status") continue;
    if (a === "Name" && c === "Status") continue;

    if (a !== "") {
      const pDrops = parentDropLabels(dropVal);
      if (pDrops.length === 0) {
        current = null;
        continue;
      }
      if (isExcludedRoadmapParentName(a)) {
        current = null;
        continue;
      }
      current = {
        id: `xlsx-${parents.length}-${a.slice(0, 24)}`,
        name: a,
        status: c || "—",
        dropRaw: dropVal,
        subitems: [],
      };
      parents.push(current);
      continue;
    }
    if (a === "" && b !== "" && current) {
      current.subitems.push({
        name: b,
        status: d || "—",
        dropRaw: subDropVal,
      });
    }
  }

  return parents;
}

/**
 * Subitems for column `bucketKey`. `parentDropKeys` = drops on the parent row only.
 * - Extension column (!inParent): only subs whose sub-Drop includes `bucketKey`.
 * - Parent column + empty sub-Drop: show in every parent column (Excel col F; Monday API uses a separate sub Drop column).
 * - Parent with sub-items: omit from a drop bucket when no sub-items belong in that bucket (even if parent Drop lists that release).
 * - Parent column + sub-Drop overlaps parent: show only where sub-Drop matches `bucketKey`.
 * - Parent column + sub-Drop does not overlap parent: omit (those subs use extension columns only).
 */
function subitemsForBucket(parentDropKeys, subitems, bucketKey) {
  const inParent = parentDropKeys.includes(bucketKey);
  return subitems
    .filter((s) => {
      const sd = [...new Set(splitDrops(s.dropRaw))];
      if (!inParent) return sd.includes(bucketKey);
      if (sd.length === 0) return true;
      const overlapsParent = sd.some((d) => parentDropKeys.includes(d));
      if (!overlapsParent) return false;
      return sd.includes(bucketKey);
    })
    .map((s) => ({ name: s.name, status: s.status }));
}

function buildModelFromParents(parents, boardName) {
  /** @type {Map<string, Array<{ id: string; name: string; status: string; subitems: { name: string; status: string }[] }>>} */
  const buckets = new Map();
  /** @type {Map<string, { status: string }>} */
  const idToParent = new Map();

  for (const p of parents) {
    if (isHiddenRoadmapStatus(p.status)) continue;
    const dropLabels = parentDropLabels(p.dropRaw);
    if (dropLabels.length === 0) continue;

    if (!idToParent.has(p.id)) idToParent.set(p.id, { status: p.status });

    for (const d of placementDropsForParent(p)) {
      const inParentColumn = dropLabels.includes(d);
      const subFiltered = subitemsForBucket(dropLabels, p.subitems, d).filter((s) => !isHiddenRoadmapStatus(s.status));
      const hasSubitems = (p.subitems || []).length > 0;
      if (subFiltered.length === 0) {
        if (hasSubitems || !inParentColumn) continue;
      }
      if (!buckets.has(d)) buckets.set(d, []);
      buckets.get(d).push({
        id: p.id,
        name: p.name,
        status: deriveParentStatusForBucket(p.status, subFiltered),
        subitems: subFiltered,
      });
    }
  }

  const dropKeys = [...buckets.keys()].sort((a, b) => dropSortKey(a) - dropSortKey(b) || a.localeCompare(b));

  const uniqueCount = idToParent.size;
  const progressRows = parents
    .filter((p) => parentDropLabels(p.dropRaw).length > 0 && !isHiddenRoadmapStatus(p.status))
    .map((p) => ({
      status: p.status,
      subitems: p.subitems.filter((s) => !isHiddenRoadmapStatus(s.status)).map((s) => ({ status: s.status })),
    }));
  const { progress, doneCount } = computeSubitemWeightedProgress(progressRows);

  return {
    boardName,
    dropKeys,
    buckets,
    stats: {
      uniqueCount,
      doneCount,
      progress,
      dropCount: dropKeys.length,
    },
  };
}

function main() {
  const xlsxPath = resolveDefaultXlsxPath();
  if (!existsSync(xlsxPath)) {
    console.error(`Missing Excel file: ${xlsxPath}`);
    console.error("Export your board from Monday (Excel), save as data/board-export.xlsx (or Data\\\\board-export.xlsx) or set BOARD_XLSX.");
    process.exit(1);
  }

  const boardTitle = process.env.BOARD_TITLE || "eToro Plus — Money Roadmap";

  const wb = XLSX.readFile(xlsxPath, { cellDates: true, raw: false });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });

  const parents = parseMondayExportMatrix(matrix).filter((p) => !isExcludedRoadmapParentName(p.name));
  if (!parents.length) {
    console.error("No parent rows found. Check that the file is a Monday board export and column positions match (see README).");
    process.exit(1);
  }

  const model = buildModelFromParents(parents, boardTitle);
  const generatedAt = new Date().toISOString();
  const fileLabel = esc(basename(xlsxPath));

  const html = renderRoadmapHtml(model, {
    metaDescription: "Roadmap generated from Monday Excel export.",
    sourceLineHtml: `Source: Excel export <code>${fileLabel}</code> · Sheet <code>${esc(sheetName)}</code> · Updated ${esc(generatedAt)} · <a href="live-board.html" style="color:#fff;text-decoration:underline">Live board</a> (Monday login)`,
  });

  const out = join(ROOT, "index.html");
  writeFileSync(out, html, "utf8");
  console.log(`Wrote ${out} (${parents.length} parents, ${sheetName})`);
  console.log(`Drops: ${model.dropKeys.join(" | ")}`);
}

main();
