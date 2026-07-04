import type { Browser } from 'playwright';
import type { Scraper, Winner } from '../types.js';
import { RateLimiter, newPage } from './util.js';

// FWA renders client-side but exposes a clean JSON timeline API — far more
// robust than scraping the SPA DOM. We hit the homepage first to establish a
// browser context, then fetch the API in-page.
const HOME = 'https://thefwa.com/';
const TIMELINE = '/api/timeline/?limit=40&offset=0';
const AWARD_TITLE = 'FWA of the Day';
const AWARD_TYPE = 'fotd';
const NAV_TIMEOUT = 30_000;

interface TimelineItem {
  title?: string;
  slug?: string;
  url?: string;
  profiles?: Array<{ title?: string; name?: string }>;
}
interface TimelineEntry {
  type?: string;
  title?: string; // award tier, e.g. "FWA of the Day"
  sortDate?: string; // YYYY-MM-DD
  item?: TimelineItem;
}

export class FwaScraper implements Scraper {
  source = 'fwa' as const;

  constructor(
    private browser: Browser,
    private limiter = new RateLimiter(),
  ) {}

  async scrape(date?: string): Promise<Winner[]> {
    await this.limiter.wait(HOME);
    const page = await newPage(this.browser);
    try {
      await page.goto(HOME, {
        waitUntil: 'domcontentloaded',
        timeout: NAV_TIMEOUT,
      });
      const raw = await page.evaluate(async (path) => {
        const res = await fetch(path, { headers: { accept: 'application/json' } });
        if (!res.ok) throw new Error(`timeline ${res.status}`);
        return (await res.json()) as { items?: unknown[] };
      }, TIMELINE);

      const entries = (raw.items ?? []) as TimelineEntry[];
      const winners: Winner[] = [];
      const seen = new Set<string>();

      for (const e of entries) {
        if (e.type !== 'awards' || e.title !== AWARD_TITLE) continue;
        const item = e.item;
        const url = item?.url?.trim();
        if (!url || !/^https?:\/\//.test(url)) continue;
        if (seen.has(url)) continue;
        seen.add(url);

        const awardDate = e.sortDate ?? date ?? new Date().toISOString().slice(0, 10);
        const studio =
          item?.profiles?.[0]?.title ?? item?.profiles?.[0]?.name ?? undefined;

        winners.push({
          url,
          title: item?.title?.trim() || undefined,
          studio,
          awardType: AWARD_TYPE,
          awardDate,
          sourceUrl: item?.slug ? `https://thefwa.com/${item.slug}` : HOME,
        });
      }
      return winners;
    } finally {
      await page.close().catch(() => {});
    }
  }
}
