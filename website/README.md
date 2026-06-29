# Hermes Forge — Marketing site

Static landing page for [Hermes Forge](https://github.com/karmsheel/hermes-forge). Deploy this to your public domain; the **app** lives in the parent repo (local / desktop).

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # → dist/
npm run preview  # serve dist locally
```

## Configure before deploy

Edit `src/config.ts`:

| Field | Purpose |
|-------|---------|
| `githubUrl` | Source repo link |
| `downloadUrl` | GitHub Releases (desktop exe) |
| `downloadComingSoon` | Set `false` when a release exists |
| `appUrl` | Optional link to a hosted web app |

Edit `astro.config.mjs` → `site` to your production URL (e.g. `https://hermesforge.ai`) for correct canonical URLs and sitemap.

## Deploy

Build and upload `dist/` to any static host (Cloudflare Pages, Netlify, Vercel, S3, etc.).

## Separate repo (optional)

This folder is self-contained. To split into `hermes-forge-website`:

```bash
cd website
git init
git add .
git commit -m "Initial marketing site"
# gh repo create hermes-forge-website --public --source=. --push
```

Then remove `website/` from the app repo or replace it with a submodule pointer.