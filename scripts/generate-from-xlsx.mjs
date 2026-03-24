/**
 * Builds index.html from a Monday "Export to Excel" file (no API token).
 *
 * Layout matches Generate_Release_Plan_Html.ps1 / typical eToro Plus Money export:
 * - Skip first 3 sheet rows; parent name in column A; subitems: A blank, name in B, status in D.
 * - Parent status column C, Drop column H (0-based: 2 and 7).
 *
 * Env:
 *   BOARD_XLSX — path to .xlsx (default: data/board-export.xlsx)
 *   BOARD_TITLE — hero title (default: eToro Plus — Money Roadmap)
 *   MONDAY_XLS_* — optional 0-based column overrides (see README)
 */

import { existsSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { dropSortKey, esc, renderRoadmapHtml } from "./roadmap-render.mjs";

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
  drop: Number(process.env.MONDAY_XLS_COL_DROP ?? 7),
};

function cell(row, i) {
  if (!row || i < 0) return "";
  const v = row[i];
  if (v === undefined || v === null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function splitDrops(raw) {
  const t = (raw || "").trim();
  if (!t) return ["Unassigned"];
  return t
    .split(/[,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Parse sheet matrix using the same row rules as Generate_Release_Plan_Html.ps1.
 */
function parseMondayExportMatrix(matrix) {
  let skipNext = false;
  /** @type {{ id: string, name: string, status: string, dropRaw: string, subitems: { name: string, status: string }[] } | null} */
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

    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (a === "Subitems") {
      skipNext = true;
      continue;
    }
    if (b === "Name" && c === "Owner" && d === "Status") continue;
    if (a === "Name" && c === "Status") continue;

    if (a !== "") {
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
      });
    }
  }

  return parents;
}

function buildModelFromParents(parents, boardName) {
  /** @type {Map<string, Array<{ id: string; name: string; status: string; subitems: { name: string; status: string }[] }>>} */
  const buckets = new Map();
  /** @type {Map<string, object>} */
  const idToFeature = new Map();

  for (const p of parents) {
    const dropLabels = splitDrops(p.dropRaw);
    const feature = {
      id: p.id,
      name: p.name,
      status: p.status,
      subitems: p.subitems,
    };
    if (!idToFeature.has(p.id)) idToFeature.set(p.id, feature);
    for (const d of dropLabels) {
      const key = d || "Unassigned";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(feature);
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

  const parents = parseMondayExportMatrix(matrix);
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
