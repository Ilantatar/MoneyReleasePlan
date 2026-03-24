
# eToro Plus Money Roadmap

Static **GitHub Pages** site: roadmap columns are **release drops** from Monday; each feature shows **parent status**; **sub-items only show name and status**.

## No Monday API token (company policy)?

**GitHub Pages cannot call Monday’s API from the visitor’s browser** for your private board: the API is meant for server-side use, and browsers will block those requests ([CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)). So a pure `github.io` page **cannot** “on each open, pull fresh JSON from Monday” without **some** approved server or automation that holds credentials.

What you *can* do without storing a token in GitHub:

| Approach | Always up to date when you open the page? | Notes |
|----------|-------------------------------------------|--------|
| **[`live-board.html`](live-board.html)** — embeds the real Monday board in an iframe | **Yes**, for anyone **already logged in** to Monday in that browser | Same UI as Monday, not the custom roadmap layout. Some orgs block iframing (`X-Frame-Options`); if the frame is blank, use the “Open in Monday” link on that page. |
| **IT-approved tiny proxy** (e.g. Cloudflare Worker, Azure Function, internal API) with the token **only in that environment** | Yes, if your HTML/JS calls *your* proxy | Token never lives in this repo; security reviews this pattern more often than personal tokens in GitHub. |
| **Keep `index.html` + manual or scheduled export** | Only after you refresh the file (export → script → push) | No API token in GitHub; aligns with “export only” policies. |

---

## Data source (Monday.com, not Excel)

The published `index.html` is generated from Monday board **`18396795757`** via the [Monday GraphQL API](https://developer.monday.com/).

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

1. Repo **Settings → Pages**: source **Deploy from a branch**, branch **`main`**, folder **`/` (root)**.
2. Site URL: `https://<username>.github.io/MoneyReleasePlan/` (or your repo name).

Keep **`.nojekyll`** in the root so Pages serves the site as static files.

## Files

| Path | Purpose |
|------|---------|
| `index.html` | Generated roadmap (do not hand-edit if you use the workflow) |
| `live-board.html` | Full **live** Monday board in an iframe (login required; no API token) |
| `scripts/generate-release-plan.mjs` | Fetches Monday and writes `index.html` |
| `.github/workflows/update-roadmap.yml` | Scheduled + manual regeneration |
