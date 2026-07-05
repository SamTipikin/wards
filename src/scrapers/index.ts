import type { Browser } from 'playwright';
import type { RunResult, Scraper, Winner } from '../types.js';
import { AwwwardsScraper } from './awwwards.js';
import { CssdaScraper } from './cssda.js';
import { FwaScraper } from './fwa.js';
import { SiteinspireScraper } from './siteinspire.js';

export interface ScrapeOutcome extends RunResult {
  winners: Winner[];
}

/**
 * Build the active scraper set. Awwwards (SOTD, DOM), CSSDA (WOTD, DOM), FWA
 * (FOTD via JSON API), SiteInspire (recent featured, DOM). Awwwards and CSSDA
 * edge-block datacenter IPs (403/Cloudflare) so they only return data from a
 * residential IP; they log 'failed' from CI and the run continues. Godly is a
 * social-heavy SPA without clean site URLs — deferred.
 */
export function buildScrapers(browser: Browser): Scraper[] {
  return [
    new AwwwardsScraper(browser),
    new CssdaScraper(browser),
    new FwaScraper(browser),
    new SiteinspireScraper(browser),
  ];
}

/**
 * Run every scraper in isolation. One source throwing (or returning nothing)
 * never aborts the others; each outcome is captured for run_log + the summary.
 */
export async function runAll(
  browser: Browser,
  date?: string,
): Promise<ScrapeOutcome[]> {
  const scrapers = buildScrapers(browser);
  const outcomes: ScrapeOutcome[] = [];

  for (const scraper of scrapers) {
    try {
      const winners = await scraper.scrape(date);
      outcomes.push({
        source: scraper.source,
        status: winners.length > 0 ? 'ok' : 'empty',
        winnersFound: winners.length,
        winners,
      });
    } catch (err) {
      outcomes.push({
        source: scraper.source,
        status: 'failed',
        winnersFound: 0,
        winners: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return outcomes;
}
