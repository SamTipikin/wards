import sharp from 'sharp';
import type { ColorEntry } from '../types.js';

const SAMPLE_WIDTH = 64;
const TOP_N = 6;
// Buckets quantize each channel; 5 bits/channel (32 levels) balances grouping.
const BITS = 5;
const SHIFT = 8 - BITS;

/**
 * Downscale the screenshot to 64px wide, quantize to a small palette, and
 * return the top-6 dominant colors with share. White/black are kept but the
 * caller can treat >60%-share pure white/black as background, not brand.
 */
export async function analyzeColors(webp: Buffer): Promise<ColorEntry[]> {
  const { data, info } = await sharp(webp)
    .resize({ width: SAMPLE_WIDTH })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels; // 3 after removeAlpha
  const counts = new Map<number, { r: number; g: number; b: number; n: number }>();
  let total = 0;

  for (let i = 0; i + channels <= data.length; i += channels) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const key =
      ((r >> SHIFT) << (BITS * 2)) | ((g >> SHIFT) << BITS) | (b >> SHIFT);
    const bucket = counts.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.n += 1;
    } else {
      counts.set(key, { r, g, b, n: 1 });
    }
    total += 1;
  }

  if (total === 0) return [];

  return [...counts.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, TOP_N)
    .map((c) => ({
      hex: toHex(c.r / c.n, c.g / c.n, c.b / c.n),
      share: Math.round((c.n / total) * 1000) / 1000,
    }));
}

function toHex(r: number, g: number, b: number): string {
  const h = (v: number) =>
    Math.round(v).toString(16).padStart(2, '0').slice(0, 2);
  return `#${h(r)}${h(g)}${h(b)}`;
}
