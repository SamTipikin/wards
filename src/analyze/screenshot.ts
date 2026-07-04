import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { Page } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const SCREENSHOT_DIR = resolve(__dirname, '../../data/screenshots');
const MAX_WIDTH = 1600;
const WEBP_QUALITY = 80;

export interface ShotResult {
  /** Relative path stored in the DB, e.g. "screenshots/12.webp". */
  relPath: string;
  /** The encoded WebP buffer (reused by colors.ts to avoid a re-shot). */
  webp: Buffer;
}

/**
 * Viewport (not full-page) screenshot of the hero, re-encoded to WebP.
 * Full-page shots of scroll-animated sites are garbage; the hero is what matters.
 */
export async function captureScreenshot(
  page: Page,
  siteId: number,
): Promise<ShotResult> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const raw = await page.screenshot({ type: 'png', fullPage: false });
  const webp = await sharp(raw)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  const filename = `${siteId}.webp`;
  await sharp(webp).toFile(resolve(SCREENSHOT_DIR, filename));
  return { relPath: `screenshots/${filename}`, webp };
}
