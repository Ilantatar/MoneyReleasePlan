/**
 * Dump parent rows (Monday export) as JSON for tooling. Usage:
 *   node scripts/dump-xlsx-parents.mjs <path-to.xlsx>
 */
import { existsSync } from "node:fs";
import XLSX from "xlsx";

const COL = {
  parentName: Number(process.env.MONDAY_XLS_COL_PARENT_NAME ?? 0),
  subName: Number(process.env.MONDAY_XLS_COL_SUB_NAME ?? 1),
  parentStatus: Number(process.env.MONDAY_XLS_COL_PARENT_STATUS ?? 2),
  subStatus: Number(process.env.MONDAY_XLS_COL_SUB_STATUS ?? 3),
  subDrop: Number(process.env.MONDAY_XLS_COL_SUB_DROP ?? 4),
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
  if (!t) return [];
  return t
    .split(/[,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parentDropLabels(dropRaw) {
  return [...new Set(splitDrops(dropRaw))];
}

function effectiveSubitemDrops(parentDrops, subDropRaw) {
  const fromSub = parentDropLabels(subDropRaw);
  if (fromSub.length > 0) return fromSub;
  return [...parentDrops];
}

function parseMondayExportMatrix(matrix) {
  let skipNext = false;
  let current = null;
  const parents = [];
  /** Flat list for cross-tooling: parents + subitems (each row that has a NWLD/drop bucket). */
  const features = [];

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
      const pDrops = parentDropLabels(dropVal);
      if (pDrops.length === 0) {
        current = null;
        continue;
      }
      current = {
        name: a,
        status: c || "—",
        dropRaw: dropVal,
        drops: pDrops,
      };
      parents.push(current);
      const st = String(c || "").trim().toLowerCase();
      if (st !== "cancelled") {
        features.push({
          kind: "parent",
          parentName: null,
          name: a,
          displayPath: a,
          status: c || "—",
          dropRaw: dropVal,
          drops: pDrops,
        });
      }
      continue;
    }
    if (a === "" && b !== "" && current) {
      current.subitems = current.subitems || [];
      current.subitems.push({
        name: b,
        status: d || "—",
        dropRaw: subDropVal,
      });
      const subSt = String(d || "").trim().toLowerCase();
      if (subSt === "cancelled") continue;
      const eff = effectiveSubitemDrops(current.drops, subDropVal);
      if (eff.length === 0) continue;
      features.push({
        kind: "subitem",
        parentName: current.name,
        name: b,
        displayPath: `${current.name} > ${b}`,
        status: d || "—",
        dropRaw: subDropVal || current.dropRaw,
        drops: eff,
      });
    }
  }

  return { parents, features };
}

const xlsxPath = process.argv[2];
if (!xlsxPath || !existsSync(xlsxPath)) {
  console.error("Usage: node scripts/dump-xlsx-parents.mjs <board.xlsx>");
  process.exit(1);
}

const wb = XLSX.readFile(xlsxPath, { cellDates: true, raw: false });
const sheetName = wb.SheetNames[0];
const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
  header: 1,
  defval: "",
  blankrows: false,
});
const { parents, features } = parseMondayExportMatrix(matrix);
console.log(JSON.stringify({ sheetName, parents, features }, null, 2));
