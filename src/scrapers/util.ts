import { chromium, type Browser, type Page } from 'playwright';

export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const VIEWPORT = { width: 1440, height: 900 };

/** Min ms between requests to the same host. Backfill overrides to 5000. */
export const DEFAULT_HOST_DELAY = 2000;

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Tracks last-hit time per host so scrapers can self-throttle. */
export class RateLimiter {
  private last = new Map<string, number>();
  constructor(private minDelay = DEFAULT_HOST_DELAY) {}

  async wait(url: string): Promise<void> {
    const host = safeHost(url);
    const prev = this.last.get(host);
    const now = Date.now();
    if (prev !== undefined) {
      const elapsed = now - prev;
      if (elapsed < this.minDelay) await sleep(this.minDelay - elapsed);
    }
    this.last.set(host, Date.now());
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

/** Open a realistically-configured page in a fresh context. */
export async function newPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    userAgent: UA,
    viewport: VIEWPORT,
    locale: 'en-US',
    timezoneId: 'UTC',
  });
  return context.newPage();
}
