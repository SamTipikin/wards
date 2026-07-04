# Award Radar — web

Static Next.js front-end for the Award Radar dataset. Reads `../data/radar.db`
(SQLite) and `../data/screenshots/` **at build time**, bakes everything into
flat HTML/JSON, and exports to `out/`. No server, no runtime DB — deploys
anywhere static, including Vercel free tier.

## Local dev

```bash
cd web
npm install
npm run dev        # copies screenshots → public/, then next dev on :3000
```

`npm run build` produces the static site in `web/out/`.

## How data flows in

- `scripts/prepare-data.mjs` runs before dev/build. It copies
  `../data/screenshots/*` into `public/screenshots/` (so the static export can
  serve them) and checks that `../data/radar.db` exists.
- `lib/db.ts` opens the DB read-only; `lib/queries.ts` holds every query.
- All pages are `force-static` — they run their queries once at build.

Override the data location with `DATA_DIR` (default `../data`).

## Deploy to Vercel

Because the site reads files in `../data` (one level above this folder), Vercel
must include repo files outside the root directory:

1. Import the repo in Vercel.
2. **Root Directory** → `web`.
3. Enable **"Include files outside of the Root Directory in the Build Step"**
   (Settings → General). This exposes `../data` to the build.
4. Framework preset: **Next.js**. Build command and output dir come from
   `vercel.json` (`npm run build` → `out`).

Every push that updates `data/radar.db` (i.e. the daily pipeline commit)
re-triggers a build, so the deployed site always reflects the latest data.

> Alternative: keep Root Directory at the repo root and set the build command to
> `cd web && npm install && npm run build`, output `web/out`.
