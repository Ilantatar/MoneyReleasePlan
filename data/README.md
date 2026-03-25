# Board export (Excel)

1. In Monday, open your board → **⋯** (or **File**) → **Export board** → **Excel**.
2. Save the downloaded `.xlsx` as **`board-export.xlsx`** in this folder (replace the previous file).
3. From the repo root run:
   ```bash
   npm install
   npm run generate:xlsx
   ```
4. Commit and push **`board-export.xlsx`** and **`index.html`** (or use the GitHub Action that runs on `data/*.xlsx` changes).

If your export uses different column positions than the default Monday layout for this board, set env vars (see main README): `MONDAY_XLS_COL_PARENT_NAME`, `MONDAY_XLS_COL_SUB_NAME`, `MONDAY_XLS_COL_PARENT_STATUS`, `MONDAY_XLS_COL_SUB_STATUS`, `MONDAY_XLS_COL_SUB_DROP` (subitem **Drop**, default column **E** / index **4**), `MONDAY_XLS_COL_DROP` (all **0-based**).

Parents with an **empty Drop** are skipped. Under each drop column, only subitems whose **Drop** matches that bucket are listed; subitems with **no** Drop value repeat under **every** parent drop they belong to.
