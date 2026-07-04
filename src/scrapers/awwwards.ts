import type { Browser } from 'playwright';
import type { Scraper, Winner } from '../types.js';
import { RateLimiter, newPage, sleep, todayUTC } from './util.js';

// --- Selectors (top-of-file so breakage fixes are one-line diffs) ---
// Each SOTD card carries a `data-collectable-model-value` JSON blob (title,
// slug, tags). The external site URL is the _blank rollover button; the award
// detail page is the figure link; the studio is the avatar name link.
const SOTD_URL = 'https://www.awwwards.com/websites/sites_of_the_day/';
const CARD = 'li.js-collectable';
const CARD_MODEL_ATTR = 'data-collectable-model-value';
const CARD_VISIT_LINK = 'a.figure-rollover__bt[target="_blank"]';
const CARD_AWARD_LINK = 'a.figure-rollover__link';
const CARD_STUDIO = 'a.avatar-name__link';

const READY_SELECTOR = CARD;
const NAV_TIMEOUT = 30_000;

function clean(s: string | null): string | undefined {
  const t = s?.trim();
  return t ? t : undefined;
}

/**
 * Studio links render the name plus a membership badge ("PRO"/"PLUS") and lots
 * of layout whitespace. Collapse runs of whitespace and drop the trailing badge.
 */
function cleanStudio(s: string | null): string | undefined {
  const collapsed = s?.replace(/\s+/g, ' ').trim();
  if (!collapsed) return undefined;
  const stripped = collapsed.replace(/\s+(PRO|PLUS)$/i, '').trim();
  return stripped || undefined;
}

function resolveUrl(href: string | null, base: string): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href, base).href;
  } catch {
    return undefined;
  }
}

/** Pull the title out of a card's data-collectable-model-value JSON attr. */
function parseModelTitle(model: string | null): string | undefined {
  if (!model) return undefined;
  try {
    const parsed = JSON.parse(model) as { title?: string };
    return clean(parsed.title ?? null);
  } catch {
    return undefined;
  }
}

export class AwwwardsScraper implements Scraper {
  source = 'awwwards' as const;

  constructor(
    private browser: Browser,
    private limiter = new RateLimiter(),
  ) {}

  async scrape(date: string = todayUTC()): Promise<Winner[]> {
    return this.fetchWithRetry(date, true);
  }

  private async fetchWithRetry(
    date: string,
    retry: boolean,
  ): Promise<Winner[]> {
    await this.limiter.wait(SOTD_URL);
    const page = await newPage(this.browser);
    try {
      await page.goto(SOTD_URL, {
        waitUntil: 'domcontentloaded',
        timeout: NAV_TIMEOUT,
      });
      await page.waitForSelector(READY_SELECTOR, { timeout: NAV_TIMEOUT });

      // Return raw strings only — no inner functions in the page callback, so
      // tsx/esbuild never injects a `__name` helper that is undefined in-page.
      // URL resolution and cleanup happen back in Node.
      const raw = await page.$$eval(
        CARD,
        (cards, sel) =>
          cards.map((card) => ({
            model: card.getAttribute(sel.modelAttr),
            href: card.querySelector(sel.visit)?.getAttribute('href') ?? null,
            studio: card.querySelector(sel.studio)?.textContent ?? null,
            awardHref:
              card.querySelector(sel.award)?.getAttribute('href') ?? null,
          })),
        {
          modelAttr: CARD_MODEL_ATTR,
          visit: CARD_VISIT_LINK,
          award: CARD_AWARD_LINK,
          studio: CARD_STUDIO,
        },
      );

      const winners: Winner[] = [];
      const seen = new Set<string>();
      for (const r of raw) {
        const url = resolveUrl(r.href, SOTD_URL);
        if (!url) continue; // no external link → not a real winner card
        if (seen.has(url)) continue;
        seen.add(url);
        winners.push({
          url,
          title: parseModelTitle(r.model),
          studio: cleanStudio(r.studio),
          awardType: 'sotd',
          awardDate: date,
          sourceUrl: resolveUrl(r.awardHref, SOTD_URL),
        });
      }
      return winners;
    } catch (err) {
      // Awwwards sits behind Cloudflare at times: retry once after 30s.
      if (retry) {
        await page.close().catch(() => {});
        await sleep(30_000);
        return this.fetchWithRetry(date, false);
      }
      throw err;
    } finally {
      await page.close().catch(() => {});
    }
  }
}
