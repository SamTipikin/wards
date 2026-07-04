import type { Browser, Page } from 'playwright';
import type { Analysis, AnalysisStatus } from '../types.js';
import type { SiteRow } from '../db.js';
import { UA, VIEWPORT } from '../scrapers/util.js';
import { NetworkCapture } from './network.js';
import { analyzeFonts } from './fonts.js';
import { analyzeTech } from './tech.js';
import { analyzeColors } from './colors.js';
import { captureScreenshot } from './screenshot.js';
import { analyzeVibe } from './vibe.js';

const HARD_BUDGET_MS = 90_000;
const NAV_TIMEOUT_MS = 20_000;
const SETTLE_MS = 5_000; // extra wait for WebGL/loader-heavy sites
const COOKIE_BUDGET_MS = 5_000;

// Try reject/decline first, then generic close.
const COOKIE_SELECTORS = [
  'button#onetrust-reject-all-handler',
  'button[aria-label*="reject" i]',
  'button:has-text("Reject")',
  'button:has-text("Decline")',
  'button:has-text("Deny")',
  '.cookie button:has-text("Reject")',
  '#onetrust-accept-btn-handler',
  'button:has-text("Accept")',
  'button[aria-label*="close" i]',
];

function nowIso(): string {
  return new Date().toISOString();
}

class TimeoutError extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new TimeoutError('site budget exceeded')), ms),
    ),
  ]);
}

async function dismissCookies(page: Page): Promise<void> {
  const deadline = Date.now() + COOKIE_BUDGET_MS;
  for (const sel of COOKIE_SELECTORS) {
    if (Date.now() > deadline) break;
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 300 })) {
        await btn.click({ timeout: 800 });
        await page.waitForTimeout(300);
        break;
      }
    } catch {
      // best effort — ignore and try the next selector
    }
  }
}

/** Analyze a single winning site. Never throws; always returns an Analysis. */
export async function visitSite(
  browser: Browser,
  site: SiteRow,
): Promise<Analysis> {
  const base: Analysis = {
    siteId: site.id,
    analyzedAt: nowIso(),
    fonts: null,
    tech: null,
    colors: null,
    vibe: null,
    screenshot: null,
    status: 'ok',
  };

  try {
    return await withTimeout(runAnalysis(browser, site, base), HARD_BUDGET_MS);
  } catch (err) {
    const status: AnalysisStatus =
      err instanceof TimeoutError ? 'timeout' : classifyError(err);
    return {
      ...base,
      analyzedAt: nowIso(),
      status,
      error: err instanceof Error ? err.message.slice(0, 300) : String(err),
    };
  }
}

async function runAnalysis(
  browser: Browser,
  site: SiteRow,
  base: Analysis,
): Promise<Analysis> {
  const context = await browser.newContext({
    userAgent: UA,
    viewport: VIEWPORT,
    locale: 'en-US',
  });
  const page = await context.newPage();
  const net = new NetworkCapture();
  net.attach(page);

  try {
    const resp = await page.goto(site.url, {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT_MS,
    });
    if (resp && resp.status() >= 400) base.status = 'blocked';

    // networkidle OR 20s, whichever first, then a fixed settle for loaders.
    await page.waitForLoadState('networkidle', { timeout: NAV_TIMEOUT_MS }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);
    await dismissCookies(page);
    await net.settle();

    // Meta description for the vibe prompt.
    const description = await page
      .evaluate(() => {
        const m = document.querySelector('meta[name="description"]');
        return m?.getAttribute('content') ?? null;
      })
      .catch(() => null);

    const [fonts, tech] = await Promise.all([
      analyzeFonts(page, net).catch(() => []),
      analyzeTech(page, net).catch(() => []),
    ]);

    const shot = await captureScreenshot(page, site.id);
    const colors = await analyzeColors(shot.webp).catch(() => []);

    const { vibe, error: vibeError } = await analyzeVibe({
      screenshotRelPath: shot.relPath,
      title: site.title,
      description,
      fonts,
      tech,
      colors,
    });

    return {
      ...base,
      analyzedAt: nowIso(),
      fonts,
      tech,
      colors,
      vibe,
      screenshot: shot.relPath,
      status: base.status,
      error: vibeError,
    };
  } finally {
    await context.close().catch(() => {});
  }
}

function classifyError(err: unknown): AnalysisStatus {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err);
  if (msg.includes('timeout')) return 'timeout';
  if (
    msg.includes('err_name_not_resolved') ||
    msg.includes('err_connection') ||
    msg.includes('net::') ||
    msg.includes('unreachable')
  )
    return 'unreachable';
  if (msg.includes('403') || msg.includes('blocked')) return 'blocked';
  return 'unreachable';
}
