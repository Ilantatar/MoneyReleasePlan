
# eToro Plus Money Roadmap

This folder contains a static HTML site ready to host.

## Fastest ways to share a clickable link

### GitHub Pages
1. Create a new GitHub repo.
2. Upload `index.html` to the repo root.
3. In repo settings, enable **Pages** from the `main` branch.
4. Share the generated `https://<username>.github.io/<repo>/` link.

### Netlify
1. Go to Netlify and choose **Add new site**.
2. Drag-and-drop this folder or the `index.html` file.
3. Share the generated site URL.

### Internal hosting
If your company has an internal static host, upload `index.html` there and share the published URL.

## Push from this folder (after creating the repo on GitHub)

Create an **empty** public repo named `MoneyReleasePlan` (no README/license on GitHub if you want a clean first push), then in PowerShell:

```powershell
cd $HOME\MoneyReleasePlan
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/MoneyReleasePlan.git
git push -u origin main
```

Sign in when Git prompts you (browser or Personal Access Token). Then enable **Settings → Pages → Deploy from branch `main` / (root)**. The site URL will be `https://YOUR_GITHUB_USERNAME.github.io/MoneyReleasePlan/`.

## Notes
- This is a single-file static page; no build step is required.
- If you want the page to load from a root URL, keep the filename as `index.html`.
- `.nojekyll` is included so GitHub Pages serves the HTML as static files without Jekyll processing.
