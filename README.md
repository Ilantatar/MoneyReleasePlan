
# eToro Plus Money Roadmap

Static **GitHub Pages** site: roadmap columns are **release drops** from Monday; each feature shows **parent status**; **sub-items only show name and status**.

To compare this board’s **Drop** column (Excel export) against **Jira Product Discovery (EPP) NWLD**, use the sibling repo **[eToro/monday-jpd-drop-compare](https://github.com/eToro/monday-jpd-drop-compare)** (not part of this site’s build).

## No Monday API token (company policy)?

**GitHub Pages cannot call Monday’s API from the visitor’s browser** for your private board: the API is meant for server-side use, and browsers will block those requests ([CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)). So a pure `github.io` page **cannot** “on each open, pull fresh JSON from Monday” without **some** approved server or automation that holds credentials.

What you *can* do without storing a token in GitHub:

| Approach | Always up to date when you open the page? | Notes |
|----------|-------------------------------------------|--------|
| **[`live-board.html`](live-board.html)** — embeds the real Monday board in an iframe | **Yes**, for anyone **already logged in** to Monday in that browser | Same UI as Monday, not the custom roadmap layout. Some orgs block iframing (`X-Frame-Options`); if the frame is blank, use the “Open in Monday” link on that page. |
| **IT-approved tiny proxy** (e.g. Cloudflare Worker, Azure Function, internal API) with the token **only in that environment** | Yes, if your HTML/JS calls *your* proxy | Token never lives in this repo; security reviews this pattern more often than personal tokens in GitHub. |
| **Excel export → HTML** (below) | After each export + push (or Action) | **No Monday API token.** Matches your custom roadmap layout. |

---

## Excel export pipeline (no API token)

Monday does **not** publish a supported “download this board as XLS” URL you can call without logging in, so **the automated part starts after you export** from the Monday UI (one click). Then everything else can be scripted.

### What you do each time

1. In Monday: **⋯** / **File** → **Export board** → **Excel**.
2. Save the file as **`data/board-export.xlsx`** in this repo (replace the old file).

### What runs automatically

**Locally (Node 18+):**

```bash
npm install
npm run generate:xlsx
```

Then commit **`index.html`** (and optionally the `.xlsx`) and push. GitHub Pages will serve the new static HTML.

**On GitHub (optional):** workflow **“Build roadmap from Excel export”** runs when you **push** any `data/*.xlsx`. It runs `npm run generate:xlsx` and commits **`index.html`** if it changed. **No `MONDAY_API_TOKEN` secret** is required.

- First time: add `data/board-export.xlsx`, commit, push — the workflow needs `package-lock.json` (already in repo after `npm install`).

The parser matches the **eToro Plus Money** Monday export (parent name **A**, status **C**, drop **H**; subitem name **B**, status **D**, subitem drop **F** — **E** is often JIRA; first three rows skipped). Older layouts may use subitem drop in **E**; set `MONDAY_XLS_COL_SUB_DROP=4` if needed. If your export shifts columns, set env vars `MONDAY_XLS_COL_*` (see [`data/README.md`](data/README.md)).

---

## Data source (Monday API — optional)

The published `index.html` can instead be generated from Monday board **`18396795757`** via the [Monday GraphQL API](https://developer.monday.com/).

1. In GitHub: **Settings → Secrets and variables → Actions**, add **`MONDAY_API_TOKEN`** with your Monday API token (same value you use in the Authorization header per [Monday API docs](https://developer.monday.com/)).
2. Run workflow **Update roadmap from Monday** (**Actions** tab → **Run workflow**) **after you change Monday** — GitHub Pages only shows what is in the last committed `index.html`, not live Monday data.
3. Optional: the workflow also runs weekly (Mondays 06:00 UTC).

If a status looks wrong after a run, your board may have **several Status columns** (e.g. overall **Status** vs **FE**). The generator prefers a column titled **Status**, then **Project status** / **Feature status**, then **Done** if *any* parent status column is Done, then the first remaining status column. Hard-refresh the site (Ctrl+F5) in case the browser cached an old page.

To generate locally (Node 18+):

```bash
export MONDAY_API_TOKEN="your_token"
export MONDAY_BOARD_ID="18396795757"   # optional
npm run generate
```

### Column mapping

- **Drop**: column titled **Drop** or **Release** (or similar). If missing, the script uses a group title that looks like `V1 …`, else **Unassigned**.
- **Parent status**: first **Status** column on the main board (or the first status-type column on the item).
- **Sub-item status**: the **status** column on the sub-item row.

If your board uses different titles, adjust `findDropColumn` / `findParentStatusColumn` in `scripts/generate-release-plan.mjs`.

## GitHub Pages

**Canonical site for sharing (same `index.html` as this repo’s `main`):** **[https://ilantatar.github.io/MoneyReleasePlan/](https://ilantatar.github.io/MoneyReleasePlan/)** — built from the user-owned fork **[Ilantatar/MoneyReleasePlan](https://github.com/Ilantatar/MoneyReleasePlan)** so the URL stays stable for the team. An org copy may also exist (for example `https://eToro.github.io/MoneyReleasePlan/`); use whichever your org can open in the browser.

1. On the repo that should serve the site: **Settings → Pages** → source **Deploy from a branch**, branch **`main`**, folder **`/` (root)**. Wait for the green Pages build; then hard-refresh (**Ctrl+F5**) if the page looks old.
2. **Who can open the page:** for **`*.github.io/<repo>/`** with a **public** repo, anyone with the link can view it (no GitHub login). If the repo is **private**, GitHub may block public Pages unless your org enables **GitHub Enterprise** internal Pages; in that case either keep the fork **public** for this roadmap or add colleagues as **collaborators** / via org policy so they can reach the org repo’s Pages URL.
3. **Actions on a fork:** if workflows do not run after push, enable **Actions** for the fork once under **Settings → Actions → General** (forks sometimes default to disabled).

Keep **`.nojekyll`** in the root so Pages serves the site as static files.

## Files

| Path | Purpose |
|------|---------|
| `index.html` | Generated roadmap (do not hand-edit if you use the workflow) |
| `live-board.html` | Full **live** Monday board in an iframe (login required; no API token) |
| `scripts/generate-release-plan.mjs` | Fetches Monday API and writes `index.html` |
| `scripts/generate-from-xlsx.mjs` | Reads `data/board-export.xlsx` and writes `index.html` |
| `scripts/roadmap-render.mjs` | Shared HTML/CSS for both generators |
| `.github/workflows/update-roadmap.yml` | API-based regeneration (needs token) |
| `.github/workflows/update-from-xlsx.yml` | Excel-based regeneration (no token) |
