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

Scrape + analysis are live. Sources:

| Source | Status | How |
| --- | --- | --- |
| **awwwards** | ✅ live | SOTD, DOM scrape. Cloudflare blocks GitHub's datacenter IP — often fails from CI, works locally. |
| **fwa** | ✅ live | FOTD via the `thefwa.com/api/timeline` JSON API — robust, API-based. |
| **siteinspire** | ✅ live | Recent featured, DOM scrape. |
| **cssda** | ⛔ deferred | Hard 403 on all paths, even residential — actively blocks automation. |
| **godly** | ⛔ deferred | Client-rendered SPA; entries are social posts without clean site URLs. |

Multi-source means multi-platform winners fall out for free (a site winning on
more than one platform). Per-run analysis is capped by `ANALYZE_LIMIT` (default
40) so a backlog can't blow the CI timeout.

Backfill and the weekly digest are specced but not yet implemented.
