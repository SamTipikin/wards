# Award Radar — Build Spec

Daily pipeline that scrapes web design award winners, analyzes each winning site (fonts, tech stack, colors, vibe), stores everything in SQLite, and publishes a static trend-report frontend. Runs on GitHub Actions with zero paid services. Working name: `award-radar` (rename freely).

## Principles

- Zero cost. GitHub Actions (public repo), Cloudflare Pages, SQLite in-repo, Claude via Max subscription OAuth token. No paid APIs.
- One broken scraper must never kill the run. Each source is isolated; failures log loudly and continue.
- Everything is idempotent. Re-running a day upserts, never duplicates.
- Data first, frontend second. The DB schema is the contract.

## Repo structure

```
award-radar/
├── CLAUDE.md
├── package.json
├── data/
│   ├── radar.db              # SQLite, committed after each run
│   └── screenshots/          # WebP, max 1600px wide, ~100-200KB each
├── src/
│   ├── run.ts                # daily entrypoint: scrape → analyze → commit
│   ├── backfill.ts           # historical archive scraper, CLI args: --source --from --to
│   ├── db.ts                 # schema, migrations, upsert helpers (better-sqlite3)
│   ├── scrapers/
│   │   ├── index.ts          # registry, runs all, collects per-source errors
│   │   ├── awwwards.ts       # SOTD
│   │   ├── fwa.ts            # FWA of the Day
│   │   ├── cssda.ts          # WOTD
│   │   ├── godly.ts
│   │   └── siteinspire.ts
│   ├── analyze/
│   │   ├── visit.ts          # Playwright session per site, orchestrates extractors
│   │   ├── fonts.ts
│   │   ├── tech.ts
│   │   ├── colors.ts
│   │   ├── screenshot.ts
│   │   └── vibe.ts           # Claude call via `claude -p`
│   └── digest.ts             # weekly summary generator (markdown to stdout)
├── site/                     # Astro frontend
│   ├── astro.config.mjs
│   └── src/
│       ├── pages/
│       │   ├── index.astro           # daily feed
│       │   ├── analytics.astro       # trend dashboards
│       │   ├── fonts/[slug].astro    # per-font page: usage over time, sites
│       │   ├── studios/[slug].astro
│       │   └── site/[id].astro       # winner detail page
│       └── lib/queries.ts            # build-time SQLite queries
└── .github/workflows/
    └── daily.yml
```

## Data model (SQLite)

```sql
CREATE TABLE sites (
  id INTEGER PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,        -- normalized: lowercase, no www, no path
  url TEXT NOT NULL,                  -- full URL as awarded
  title TEXT,
  first_seen DATE NOT NULL
);

CREATE TABLE awards (
  id INTEGER PRIMARY KEY,
  site_id INTEGER REFERENCES sites(id),
  source TEXT NOT NULL,               -- 'awwwards' | 'fwa' | 'cssda' | 'godly' | 'siteinspire'
  award_type TEXT NOT NULL,           -- 'sotd', 'wotd', 'honorable', etc.
  award_date DATE NOT NULL,
  studio TEXT,
  country TEXT,
  source_url TEXT,                    -- award page URL
  UNIQUE(site_id, source, award_type, award_date)
);

CREATE TABLE analyses (
  site_id INTEGER PRIMARY KEY REFERENCES sites(id),
  analyzed_at DATETIME NOT NULL,
  fonts JSON,          -- [{family, foundry_hint, source: 'google'|'adobe'|'fontshare'|'self-hosted'|'system'}]
  tech JSON,           -- [{name, category: '3d'|'animation'|'scroll'|'framework'|'builder', confidence}]
  colors JSON,         -- [{hex, share}] top 6 dominant
  vibe JSON,           -- Claude output, schema below
  screenshot TEXT,     -- relative path in data/screenshots/
  status TEXT NOT NULL DEFAULT 'ok',  -- 'ok' | 'unreachable' | 'blocked' | 'timeout'
  error TEXT
);

CREATE TABLE run_log (
  id INTEGER PRIMARY KEY,
  run_date DATE NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,               -- 'ok' | 'failed' | 'empty'
  winners_found INTEGER,
  error TEXT
);
```

Multi-platform winners fall out of this for free: `GROUP BY site_id HAVING COUNT(DISTINCT source) > 1`.

## Scrapers

Each scraper exports `scrape(date?: string): Promise<Winner[]>` where `Winner = {url, title, studio?, country?, awardType, awardDate, sourceUrl}`.

- Use Playwright for all sources (some are JS-rendered, and uniform tooling beats mixing fetch + Playwright).
- Realistic UA and viewport, `waitUntil: 'domcontentloaded'` plus explicit selector waits.
- Selectors live at the top of each file as named constants so breakage fixes are one-line diffs.
- On zero results, log `status: 'empty'` to run_log and continue. A source returning nothing on a real award day means the selector broke; the workflow summary must surface it.
- Rate limit: 2s minimum between requests to the same host. Backfill: 5s.
- Awwwards sits behind Cloudflare at times. If the SOTD page fails, retry once after 30s, then log 'blocked' and move on. Do not fight bot detection beyond realistic headers.

## Site analysis (analyze/visit.ts)

One Playwright context per winning site. Total budget per site: 90s hard timeout.

1. Navigate, wait for `networkidle` OR 20s, whichever first. Then wait 5 more seconds (WebGL/loader-heavy sites).
2. Dismiss obvious cookie banners (try common selectors, click "reject"/"decline" variants first, then close buttons). Best effort, 5s budget.
3. Run extractors against the live page, then screenshot.

### fonts.ts
- `document.fonts` entries with `status === 'loaded'` → family names.
- Parse `<link>` hrefs for fonts.googleapis.com, use.typekit.net, api.fontshare.com → source attribution.
- Capture font file network requests (.woff2/.woff) → filename hints for self-hosted foundry guessing (e.g. `PPNeueMontreal-*.woff2` → Pangram Pangram).
- Normalize family names (strip weight/style suffixes, dedupe).
- Filter out icon fonts and system stack (Arial, Helvetica, system-ui, etc.) into a separate `system: true` flag rather than dropping them.

### tech.ts
Two passes:
- Window globals via `page.evaluate`: `THREE`, `gsap`, `ScrollTrigger`, `Lenis`, `barba`, `Swup`, `PIXI`, `Matter`, `p5`, `Spline` runtime, `next` (`__NEXT_DATA__`), `___gatsby`, `__NUXT__`, `Webflow`, Framer (`__framer` markers), `Shopify`.
- Source scan: fetch the page's script bundle contents already captured by Playwright network events, regex for signatures (`three.module`, `gsap.registerPlugin`, `framer-motion`, `@studio-freight/lenis`, `react-three-fiber`).
Confidence: 'high' for window global, 'medium' for source signature only.

### colors.ts
- Take the screenshot buffer, downscale to 64px wide with sharp, quantize to 6 dominant colors with share percentages. Ignore pure white/black above 60% share when picking the "brand palette" but still store them.

### screenshot.ts
- Full viewport 1440×900 shot (not full-page; heroes are what matters and full-page shots of scroll-animated sites are garbage).
- Convert to WebP quality 80, max 1600px wide, save to `data/screenshots/{siteId}.webp`.

### vibe.ts
Shell out to `claude -p` (headless Claude Code, uses `CLAUDE_CODE_OAUTH_TOKEN`). One call per site. Prompt includes: screenshot path (attach the image), extracted fonts, tech, colors, page title + meta description.

Response must be strict JSON, no prose:

```json
{
  "description": "one sentence, plain language, what the site is and does",
  "industry": "one of: agency|saas|ecommerce|fashion|culture|fintech|gaming|food|architecture|portfolio|editorial|event|crypto|health|education|other",
  "vibe_tags": ["3-6 tags from: minimal, maximalist, brutalist, editorial, playful, corporate, luxury, retro, futuristic, organic, technical, illustrative, photographic, typographic, dark, light, colorful, monochrome"],
  "mood": "one short phrase",
  "uses_3d": true,
  "notable": "one specific standout detail or null"
}
```

Parse defensively: strip code fences, JSON.parse in try/catch, on failure store raw text in `error` and `vibe: null`. Never retry more than once.

## GitHub Actions (daily.yml)

```yaml
name: daily
on:
  schedule:
    - cron: '30 6 * * *'   # 06:30 UTC, after most award sites publish
  workflow_dispatch:

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npx playwright install chromium --with-deps
      - run: npm i -g @anthropic-ai/claude-code
      - run: npx tsx src/run.ts
        env:
          CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
      - name: Commit data
        run: |
          git config user.name "award-radar-bot"
          git config user.email "bot@users.noreply.github.com"
          git add data/
          git diff --staged --quiet || git commit -m "data: $(date -u +%F)"
          git push
```

- Sam generates the token locally with `claude setup-token` and adds it as a repo secret. Long-lived, tied to his Max subscription.
- Cloudflare Pages watches the repo and rebuilds the Astro site on every push. No deploy step needed in the workflow.
- The run must print a summary table to the job log: per source, winners found, analyzed ok/failed. Use `core.summary` / `$GITHUB_STEP_SUMMARY` so failures are visible at a glance.

## Frontend (Astro, fully static)

Queries run at build time against `data/radar.db` via better-sqlite3 in `queries.ts`.

Pages:
- **Feed (/)** — reverse-chron winner cards: screenshot, title, award badges (stacked when multi-platform), fonts, tech chips, palette strip, vibe tags. Group by day.
- **Analytics (/analytics)** —
  - Font leaderboard, 30/90/365-day windows, with delta vs previous window.
  - Tech adoption lines over time (Three.js, GSAP, Lenis, Webflow, Framer) as % of winners per month.
  - Country and studio leaderboards.
  - Vibe tag distribution over time.
  - Multi-platform winners list.
- **Font detail (/fonts/[slug])** — usage sparkline, every site that used it, foundry/source breakdown.
- **Site detail (/site/[id])** — full analysis, all awards, screenshot.

Charts: lightweight, no heavy chart lib. Inline SVG sparklines and bars generated at build time are fine. Design direction comes later from Sam; ship structure first with restrained defaults (single accent color, generous type scale).

## Backfill

`npx tsx src/backfill.ts --source awwwards --from 2023-01-01 --to 2026-07-01`

- Awwwards and FWA archives paginate cleanly by date. CSSDA has monthly winner listings.
- Backfill scrapes award metadata for the full range but only runs full site analysis (Playwright visit + Claude) for the most recent 12 months, in batches of 30 sites per manual run to stay inside Actions job limits and Claude usage. Older entries keep award data only, `analyses.status = 'skipped_backfill'`.
- Run backfill locally or via `workflow_dispatch` with inputs, not on the daily cron.

## Weekly digest

`digest.ts` runs every Monday (add a second cron `0 7 * * 1` with a `MODE=digest` env check in run.ts). Output: markdown summary of the past week (winners count, new fonts entering top 10, tech movers, standout site) written to `data/digests/{date}.md` and committed. Sam turns these into LinkedIn posts manually for now; no auto-posting in v1.

## v1 scope cuts

- No auth, no user accounts, no comments.
- No auto-posting anywhere.
- No CSSDA "special kudos" tiers, SOTD/WOTD-level awards only.
- No mobile screenshots.
- English-only frontend.

## Build order

1. db.ts + schema, awwwards scraper, run.ts skeleton. Verify one real day end-to-end without analysis.
2. analyze/visit.ts + fonts + tech + colors + screenshot on 3 hand-picked sites.
3. vibe.ts with `claude -p`, verify JSON parsing.
4. Remaining scrapers.
5. daily.yml, first live run.
6. Astro feed page, then analytics.
7. Backfill.
