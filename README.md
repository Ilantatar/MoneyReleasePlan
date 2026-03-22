
# eToro Plus Money Roadmap

This folder contains a static HTML site ready to host.

## Live site (GitHub Pages)

After **Settings → Pages** is set to deploy from branch **`main`** / **(root)**, the public URL is:

**https://ilantatar.github.io/MoneyReleasePlan/**

(Use the same casing as your GitHub username if the link is ever case-sensitive.)

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

## Push updates from this PC

Repo: [Ilantatar/MoneyReleasePlan](https://github.com/Ilantatar/MoneyReleasePlan)

```powershell
cd $HOME\MoneyReleasePlan
git add -A
git commit -m "Update site"
git push -u origin main
```

## Notes
- This is a single-file static page; no build step is required.
- If you want the page to load from a root URL, keep the filename as `index.html`.
- `.nojekyll` is included so GitHub Pages serves the HTML as static files without Jekyll processing.
