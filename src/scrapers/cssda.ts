import type { Browser } from 'playwright';
import type { Scraper, Winner } from '../types.js';
import { RateLimiter, newPage, todayUTC } from './util.js';

// CSSDA Website of the Day. NOTE: cssdesignawards.com edge-blocks datacenter
// IPs with a 403, so this Playwright scrape works from a residential IP but not
// from GitHub Actions. Data can also be seeded via the browser extension.
const WOTD_URL = 'https://www.cssdesignawards.com/wotd-award-winners';
const CARD = '.single-project';
const EXT_LINK = 'a.sp__project-link';
const CATEGORY = '.sp__meta__category';
const DATE = '.sp__meta__date';
const AWARD_TYPE = 'wotd';
const NAV_TIMEOUT = 30_000;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Parse CSSDA's "JUL 4" (no year) into YYYY-MM-DD, inferring the year. */
export function parseWotdDate(raw: string | null, today = todayUTC()): string {
  const m = raw?.trim().match(/([a-z]{3})[a-z]*\s+(\d{1,2})/i);
  if (!m) return today;
  const month = MONTHS[m[1]!.toLowerCase()];
  const day = Number(m[2]);
  if (!month) return today;
  const nowYear = Number(today.slice(0, 4));
  // If the month is ahead of today, it must be last year's award.
  const thisYear = `${nowYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const year = thisYear > today ? nowYear - 1 : nowYear;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export class CssdaScraper implements Scraper {
  source = 'cssda' as const;

  constructor(
    private browser: Browser,
    private limiter = new RateLimiter(),
  ) {}

  async scrape(date: string = todayUTC()): Promise<Winner[]> {
    await this.limiter.wait(WOTD_URL);
    const page = await newPage(this.browser);
    try {
      await page.goto(WOTD_URL, {
        waitUntil: 'domcontentloaded',
        timeout: NAV_TIMEOUT,
      });
      await page.waitForSelector(CARD, { timeout: NAV_TIMEOUT });

      const raw = await page.$$eval(
        CARD,
        (cards, sel) =>
          cards.map((c) => ({
            ext: c.querySelector(sel.ext)?.getAttribute('href') ?? null,
            cat: c.querySelector(sel.cat)?.textContent ?? null,
            date: c.querySelector(sel.date)?.textContent ?? null,
            alt: c.querySelector('img')?.getAttribute('alt') ?? null,
          })),
        { ext: EXT_LINK, cat: CATEGORY, date: DATE },
      );

      const winners: Winner[] = [];
      const seen = new Set<string>();
      for (const r of raw) {
        if (!/WOTD/i.test(r.cat ?? '')) continue;
        const url = r.ext?.trim();
        if (!url || !/^https?:\/\//.test(url) || seen.has(url)) continue;
        seen.add(url);
        winners.push({
          url,
          title: (r.alt ?? '').replace(/\s+website$/i, '').trim() || undefined,
          awardType: AWARD_TYPE,
          awardDate: parseWotdDate(r.date, date),
          sourceUrl: WOTD_URL,
        });
      }
      return winners;
    } finally {
      await page.close().catch(() => {});
    }
  }
}
