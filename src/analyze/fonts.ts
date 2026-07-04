import type { Page } from 'playwright';
import type { FontEntry, FontSource } from '../types.js';
import type { NetworkCapture } from './network.js';

// System / generic families we flag rather than treat as a design choice.
const SYSTEM_FAMILIES = new Set(
  [
    'arial',
    'helvetica',
    'helvetica neue',
    'times',
    'times new roman',
    'georgia',
    'courier',
    'courier new',
    'verdana',
    'tahoma',
    'segoe ui',
    'system-ui',
    'ui-sans-serif',
    'ui-serif',
    'ui-monospace',
    '-apple-system',
    'blinkmacsystemfont',
    'sans-serif',
    'serif',
    'monospace',
    'roboto',
  ].map((s) => s.toLowerCase()),
);

// Self-hosted filename → foundry hints (extend freely).
const FOUNDRY_HINTS: Array<[RegExp, string]> = [
  [/PPNeue|PPMori|PPEditorial|PPFormula|PPRader|^PP/i, 'Pangram Pangram'],
  [/ABCDiatype|ABCFavorit|ABCMonument|^ABC/i, 'Dinamo'],
  [/NeueHaas|NeueMontreal|NeuePixel/i, 'Various'],
  [/Söhne|Soehne|Sohne/i, 'Klim'],
  [/GT[-]?(America|Walsheim|Flexa|Super|Sectra)/i, 'Grilli Type'],
  [/Migra|Sligoil|Basement/i, 'Displaay'],
];

function normalizeFamily(raw: string): string {
  return raw
    .replace(/["']/g, '')
    .replace(/\s+(thin|extralight|light|regular|medium|semibold|bold|extrabold|black|italic|oblique)$/i, '')
    .replace(/-(thin|light|regular|medium|semibold|bold|black|italic)$/i, '')
    .trim();
}

/**
 * Collect loaded font families from `document.fonts`, attribute Google/Adobe/
 * Fontshare via <link> hrefs, and guess self-hosted foundries from .woff2 names.
 */
export async function analyzeFonts(
  page: Page,
  net: NetworkCapture,
): Promise<FontEntry[]> {
  // Loaded families + stylesheet link hosts, extracted in one page pass.
  const dom = await page.evaluate(() => {
    const families: string[] = [];
    // document.fonts is a FontFaceSet; iterate its entries.
    const fontSet = document.fonts as unknown as {
      forEach: (cb: (f: { family: string; status: string }) => void) => void;
    };
    fontSet.forEach((f) => {
      if (f.status === 'loaded') families.push(f.family);
    });
    const links = Array.from(
      document.querySelectorAll('link[rel="stylesheet"], link[href]'),
    )
      .map((l) => (l as HTMLLinkElement).href)
      .filter(Boolean);
    return { families, links };
  });

  const linkBlob = dom.links.join(' ');
  const usesGoogle = /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(linkBlob);
  const usesAdobe = /use\.typekit\.net|typekit\.com/.test(linkBlob);
  const usesFontshare = /api\.fontshare\.com|fontshare/.test(linkBlob);

  const fontFiles = [...net.fontUrls].map((u) => u.split('/').pop() ?? u);

  const byFamily = new Map<string, FontEntry>();

  for (const rawFamily of dom.families) {
    // Synthetic fallback faces (e.g. "Inter Fallback") are metric-adjust
    // shims injected by frameworks, not real design choices — drop them.
    if (/\bfallback\b/i.test(rawFamily)) continue;
    const family = normalizeFamily(rawFamily);
    if (!family) continue;
    const key = family.toLowerCase();
    if (byFamily.has(key)) continue;

    const system = SYSTEM_FAMILIES.has(key);
    let source: FontSource = system ? 'system' : 'self-hosted';
    let foundryHint: string | undefined;

    if (!system) {
      // Attribute by delivery host, else guess foundry from filenames.
      if (usesGoogle) source = 'google';
      else if (usesAdobe) source = 'adobe';
      else if (usesFontshare) source = 'fontshare';
      else {
        source = 'self-hosted';
        foundryHint = guessFoundry(fontFiles, family);
      }
    }

    byFamily.set(key, { family, source, foundryHint, system });
  }

  return [...byFamily.values()];
}

function guessFoundry(files: string[], family: string): string | undefined {
  const hay = `${files.join(' ')} ${family}`;
  for (const [re, foundry] of FOUNDRY_HINTS) if (re.test(hay)) return foundry;
  return undefined;
}
