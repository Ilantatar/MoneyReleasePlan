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

Parents with an **empty Drop** are skipped. Under each drop column: subitems follow parent/sub-Drop rules. If a sub-item’s Drop is **not** on the parent, the parent row is also listed under that sub-only drop (e.g. parent V2+V3, two subs V1 → those subs appear under **V1** in their own column as well as under V2/V3).
