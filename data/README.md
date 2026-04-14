# Board export (Excel)

1. In Monday, open your board → **⋯** (or **File**) → **Export board** → **Excel**.
2. Save the downloaded `.xlsx` as **`board-export.xlsx`** in this folder (replace the previous file).
3. From the repo root run:
   ```bash
   npm install
   npm run generate:xlsx
   ```
4. Commit and push **`board-export.xlsx`** and **`index.html`** (or use the GitHub Action that runs on `data/*.xlsx` changes).

If your export uses different column positions than the default Monday layout for this board, set env vars (see main README): `MONDAY_XLS_COL_PARENT_NAME`, `MONDAY_XLS_COL_SUB_NAME`, `MONDAY_XLS_COL_PARENT_STATUS`, `MONDAY_XLS_COL_SUB_STATUS`, `MONDAY_XLS_COL_SUB_DROP` (subitem **Drop**, default column **F** / index **5**; **E** is often JIRA), `MONDAY_XLS_COL_DROP` (all **0-based**).

Parents with an **empty Drop** are skipped. Sub-items with a Drop that **matches** the column appear there; empty sub-Drop repeats under every **parent** drop. If a sub’s Drop **does not overlap** the parent’s drops, it appears **only** under extension columns for those sub-drops (e.g. parent V2+V3, sub V1 → that sub only under **V1**, not under V2/V3). The parent row is listed under sub-only drops when needed so those subs have a place to render.
