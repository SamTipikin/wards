import type { Browser } from 'playwright';
import type { RunResult, Scraper, Winner } from '../types.js';
import { AwwwardsScraper } from './awwwards.js';

export interface ScrapeOutcome extends RunResult {
  winners: Winner[];
}

/** Build the active scraper set. Phase 1: awwwards only. */
export function buildScrapers(browser: Browser): Scraper[] {
  return [new AwwwardsScraper(browser)];
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
