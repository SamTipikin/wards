import type { Browser } from 'playwright';
import { openDb, getSitesNeedingAnalysis, upsertAnalysis, type DB } from '../db.js';
import { launchBrowser } from '../scrapers/util.js';
import { visitSite } from './visit.js';

export interface AnalyzeSummary {
  attempted: number;
  ok: number;
  degraded: number;
}

/**
 * Analyze every site without an analysis row yet (optionally capped).
 * Sequential — one Playwright context at a time to stay inside CI limits.
 */
export async function analyzePending(
  db: DB,
  browser: Browser,
  limit?: number,
): Promise<AnalyzeSummary> {
  const sites = getSitesNeedingAnalysis(db, limit);
  const summary: AnalyzeSummary = { attempted: sites.length, ok: 0, degraded: 0 };
  console.log(`[analyze] ${sites.length} site(s) to analyze`);

  for (const [i, site] of sites.entries()) {
    process.stdout.write(`  [${i + 1}/${sites.length} ${site.domain}] … `);
    const analysis = await visitSite(browser, site);
    upsertAnalysis(db, analysis);
    const fonts = analysis.fonts?.length ?? 0;
    const tech = analysis.tech?.length ?? 0;
    const colors = analysis.colors?.length ?? 0;
    const vibe = analysis.vibe ? 'vibe✓' : 'vibe—';
    if (analysis.status === 'ok') summary.ok++;
    else summary.degraded++;
    console.log(`${analysis.status}  fonts=${fonts} tech=${tech} colors=${colors} ${vibe}`);
  }
  return summary;
}

/** CLI: tsx src/analyze/index.ts [limit] */
async function main(): Promise<void> {
  const limitArg = process.argv[2];
  const limit = limitArg ? Number(limitArg) : undefined;

  const db = openDb();
  const browser = await launchBrowser();
  try {
    const s = await analyzePending(db, browser, limit);
    console.log(`\n[analyze] done: ${s.ok} ok, ${s.degraded} degraded/failed`);
  } finally {
    await browser.close();
    db.close();
  }
}

// Only run as a CLI when invoked directly (not when imported by run.ts).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[analyze] fatal:', err);
    process.exit(1);
  });
}
