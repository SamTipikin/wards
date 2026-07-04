import type { Page } from 'playwright';
import type { TechEntry, TechCategory } from '../types.js';
import type { NetworkCapture } from './network.js';

interface Probe {
  name: string;
  category: TechCategory;
  // A window-global check (high confidence) …
  global?: string;
  // … and/or a source-signature regex (medium confidence).
  signature?: RegExp;
}

const PROBES: Probe[] = [
  { name: 'Three.js', category: '3d', global: 'THREE', signature: /three\.module|three\.min|createTexture.*WebGLRenderer/i },
  { name: 'React Three Fiber', category: '3d', signature: /react-three-fiber|@react-three\/fiber/i },
  { name: 'PixiJS', category: '3d', global: 'PIXI' },
  { name: 'Spline', category: '3d', global: 'Spline', signature: /spline\.design|@splinetool/i },
  { name: 'GSAP', category: 'animation', global: 'gsap', signature: /gsap\.registerPlugin|greensock/i },
  { name: 'ScrollTrigger', category: 'scroll', global: 'ScrollTrigger', signature: /ScrollTrigger/ },
  { name: 'Lenis', category: 'scroll', global: 'Lenis', signature: /@studio-freight\/lenis|lenis/i },
  { name: 'Framer Motion', category: 'animation', signature: /framer-motion/i },
  { name: 'Matter.js', category: 'animation', global: 'Matter' },
  { name: 'p5.js', category: 'animation', global: 'p5' },
  { name: 'Barba.js', category: 'scroll', global: 'barba', signature: /@barba\/core|barba\.js/i },
  { name: 'Swup', category: 'scroll', global: 'Swup' },
  { name: 'Next.js', category: 'framework', global: '__NEXT_DATA__', signature: /__NEXT_DATA__/ },
  { name: 'Nuxt', category: 'framework', global: '__NUXT__' },
  { name: 'Gatsby', category: 'framework', global: '___gatsby' },
  { name: 'Webflow', category: 'builder', global: 'Webflow', signature: /webflow/i },
  { name: 'Framer', category: 'builder', signature: /__framer|framerusercontent/i },
  { name: 'Shopify', category: 'builder', global: 'Shopify', signature: /cdn\.shopify\.com/i },
];

/** Two passes: window globals (high) then source-signature scan (medium). */
export async function analyzeTech(
  page: Page,
  net: NetworkCapture,
): Promise<TechEntry[]> {
  const globalNames = PROBES.filter((p) => p.global).map((p) => p.global!);
  const presentGlobals = new Set(
    await page.evaluate((names: string[]) => {
      const w = window as unknown as Record<string, unknown>;
      return names.filter((n) => typeof w[n] !== 'undefined');
    }, globalNames),
  );

  const src = net.scriptText();
  const found = new Map<string, TechEntry>();

  for (const p of PROBES) {
    if (p.global && presentGlobals.has(p.global)) {
      found.set(p.name, { name: p.name, category: p.category, confidence: 'high' });
      continue;
    }
    if (p.signature && p.signature.test(src)) {
      if (!found.has(p.name))
        found.set(p.name, { name: p.name, category: p.category, confidence: 'medium' });
    }
  }

  return [...found.values()];
}
