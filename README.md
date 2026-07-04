# Award Radar

Daily pipeline that scrapes web-design award winners, analyzes each winning site
(fonts, tech stack, colors, vibe), stores everything in a single committed SQLite
file, and publishes a static trend-report front-end. Runs on GitHub Actions with
zero paid services. See [CLAUDE.md](CLAUDE.md) for the full build spec.

## Layout

```
src/               pipeline (TypeScript, run with tsx)
  run.ts           daily entrypoint: scrape → analyze → (CI commits data/)
  db.ts            schema + upsert helpers (better-sqlite3)
  scrapers/        one module per award source (awwwards live)
  analyze/         Playwright visit + fonts/tech/colors/screenshot/vibe
data/
  radar.db         the database — one file, committed after each run
  screenshots/     per-site hero shots (WebP)
web/               static Next.js front-end (deploys to Vercel) — see web/README.md
.github/workflows/daily.yml   the 06:30 UTC cron
```

## Run the pipeline locally

```bash
npm install
npx playwright install chromium
npm run run          # scrape today + analyze new winners
npm run analyze 5    # (re)analyze up to 5 un-analyzed sites
npm run typecheck
```

The **vibe** step shells out to `claude -p`; if the `claude` CLI isn't installed
locally it's skipped (vibe stays null) and the rest of the analysis still runs.

## Front-end

```bash
cd web && npm install && npm run dev    # http://localhost:3000
```

Builds a fully static site from `data/radar.db` at build time.

## Deploy

1. **Pipeline (GitHub Actions):** push to a public repo. Add repo secret
   `CLAUDE_CODE_OAUTH_TOKEN` (generate locally with `claude setup-token`). The
   `daily` workflow runs on cron and on manual dispatch, committing `data/` back.
2. **Site (Vercel):** import the repo, set Root Directory to `web`, enable
   "Include files outside of the Root Directory". Details in
   [web/README.md](web/README.md). Every data commit re-triggers a deploy.

## Status

Phase 1 (scrape) and Phase 2 (analysis) are live for the **awwwards** source;
31 winners analyzed end-to-end. Remaining scrapers (FWA, CSSDA, Godly,
SiteInspire), backfill, and the weekly digest are scaffolded in the spec but not
yet implemented.
