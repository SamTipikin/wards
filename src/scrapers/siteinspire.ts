import type { Browser } from 'playwright';
import type { Scraper, Winner } from '../types.js';
import { RateLimiter, newPage } from './util.js';

// SiteInspire is a curated gallery (no per-day award); we treat the most recent
// featured websites as winners. Server-rendered, clean article cards.
const GALLERY = 'https://www.siteinspire.com/websites';
const CARD = 'article.WebsiteCard';
const EXT_LINK = 'a[href*="ref=siteinspire"]'; // the outbound "visit site" link
const CAPTION = '.WebsiteCaption__title';
const AWARD_TYPE = 'featured';
const READY_SELECTOR = CARD;
const NAV_TIMEOUT = 30_000;
const MAX_WINNERS = 24; // one page of recents

export class SiteinspireScraper implements Scraper {
  source = 'siteinspire' as const;

  constructor(
    private browser: Browser,
    private limiter = new RateLimiter(),
  ) {}

  async scrape(date?: string): Promise<Winner[]> {
    await this.limiter.wait(GALLERY);
    const page = await newPage(this.browser);
    try {
      await page.goto(GALLERY, {
        waitUntil: 'domcontentloaded',
        timeout: NAV_TIMEOUT,
      });
      await page.waitForSelector(READY_SELECTOR, { timeout: NAV_TIMEOUT });

      const raw = await page.$$eval(
        CARD,
        (cards, sel) =>
          cards.map((card) => ({
            href:
              card.querySelector(sel.ext)?.getAttribute('href') ?? null,
            alt: card.querySelector('img')?.getAttribute('alt') ?? null,
            aria: card.getAttribute('aria-label'),
            caption: card.querySelector(sel.caption)?.textContent ?? null,
          })),
        { ext: EXT_LINK, caption: CAPTION },
      );

      const today = date ?? new Date().toISOString().slice(0, 10);
      const winners: Winner[] = [];
      const seen = new Set<string>();

      for (const r of raw) {
        const url = cleanUrl(r.href);
        if (!url) continue;
        if (seen.has(url)) continue;
        seen.add(url);
        winners.push({
          url,
          title: title(r.alt, r.aria, r.caption),
          awardType: AWARD_TYPE,
          awardDate: relativeToDate(r.caption, today),
          sourceUrl: GALLERY,
        });
        if (winners.length >= MAX_WINNERS) break;
      }
      return winners;
    } finally {
      await page.close().catch(() => {});
    }
  }
}

/** Strip the ?ref=siteinspire tracking query from the outbound URL. */
function cleanUrl(href: string | null): string | undefined {
  if (!href || !/^https?:\/\//.test(href)) return undefined;
  try {
    const u = new URL(href);
    u.search = '';
    return u.href;
  } catch {
    return undefined;
  }
}

function title(
  alt: string | null,
  aria: string | null,
  caption: string | null,
): string | undefined {
  const fromAlt = alt?.trim();
  if (fromAlt) return fromAlt;
  // aria-label form: "Website card for {title}"
  const m = aria?.match(/Website card for (.+)/i);
  if (m?.[1]) return m[1].trim();
  // caption: "{title}10 days ago" — strip a trailing relative-time phrase
  const c = caption?.replace(/\d+\s+\w+\s+ago$/i, '').trim();
  return c || undefined;
}

/**
 * SiteInspire captions carry a relative age ("10 days ago", "3 hours ago").
 * Convert to an approximate absolute date so the feed groups sensibly.
 */
function relativeToDate(caption: string | null, today: string): string {
  const m = caption?.match(/(\d+)\s+(hour|day|week|month)s?\s+ago/i);
  if (!m) return today;
  const n = Number(m[1]);
  const unit = m[2]!.toLowerCase();
  const days =
    unit === 'hour' ? 0 : unit === 'day' ? n : unit === 'week' ? n * 7 : n * 30;
  const base = new Date(today + 'T00:00:00Z');
  base.setUTCDate(base.getUTCDate() - days);
  return base.toISOString().slice(0, 10);
}
