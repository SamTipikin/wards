import { appendFileSync } from 'node:fs';
import { openDb, logRun, recordWinner } from './db.js';
import { runAll, type ScrapeOutcome } from './scrapers/index.js';
import { analyzePending, type AnalyzeSummary } from './analyze/index.js';
import { launchBrowser, todayUTC } from './scrapers/util.js';

async function main(): Promise<void> {
  const date = process.argv[2] ?? todayUTC();
  console.log(`[award-radar] daily run for ${date}`);

  const db = openDb();
  const browser = await launchBrowser();

  let outcomes: ScrapeOutcome[] = [];
  let analysis: AnalyzeSummary = { attempted: 0, ok: 0, degraded: 0 };
  try {
    // 1. Scrape all sources.
    outcomes = await runAll(browser, date);

    // 2. Persist winners + per-source run_log rows.
    const insertAll = db.transaction((all: ScrapeOutcome[]) => {
      for (const o of all) {
        for (const w of o.winners) recordWinner(db, o.source, w);
        logRun(db, date, o);
      }
    });
    insertAll(outcomes);

    // 3. Analyze winners still missing an analysis (new today + retries).
    //    Capped per run so a backlog (e.g. after adding a source) can't blow
    //    the CI job timeout; the remainder drains over subsequent runs.
    const limit = Number(process.env.ANALYZE_LIMIT ?? '40') || undefined;
    analysis = await analyzePending(db, browser, limit);
  } finally {
    await browser.close();
    db.close();
  }

  printSummary(date, outcomes, analysis);
  writeStepSummary(date, outcomes, analysis);

  // A source that failed on a real award day is worth a non-zero exit signal
  // in the log, but must not fail the workflow (data still committed).
  const failed = outcomes.filter((o) => o.status === 'failed');
  if (failed.length) {
    console.warn(`[award-radar] ${failed.length} source(s) failed this run.`);
  }
}

function printSummary(
  date: string,
  outcomes: ScrapeOutcome[],
  analysis: AnalyzeSummary,
): void {
  console.log(`\n=== Run summary ${date} ===`);
  for (const o of outcomes) {
    const err = o.error ? `  (${o.error})` : '';
    console.log(
      `  ${o.source.padEnd(12)} ${o.status.padEnd(7)} winners=${o.winnersFound}${err}`,
    );
  }
  console.log(
    `  analysis: ${analysis.attempted} attempted, ${analysis.ok} ok, ${analysis.degraded} degraded`,
  );
}

function writeStepSummary(
  date: string,
  outcomes: ScrapeOutcome[],
  analysis: AnalyzeSummary,
): void {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (!path) return;
  const rows = outcomes
    .map((o) => {
      const status = o.status === 'ok' ? '✅ ok' : o.status === 'empty' ? '⚠️ empty' : '❌ failed';
      const note = o.error ? o.error.replace(/\|/g, '\\|').slice(0, 120) : '';
      return `| ${o.source} | ${status} | ${o.winnersFound} | ${note} |`;
    })
    .join('\n');
  const md = [
    `## Award Radar — ${date}`,
    '',
    '| Source | Status | Winners | Note |',
    '| --- | --- | --- | --- |',
    rows,
    '',
    `**Analysis:** ${analysis.attempted} attempted · ${analysis.ok} ok · ${analysis.degraded} degraded`,
    '',
  ].join('\n');
  appendFileSync(path, md);
}

main().catch((err) => {
  console.error('[award-radar] fatal:', err);
  process.exit(1);
});
