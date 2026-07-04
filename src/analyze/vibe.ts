import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { SCREENSHOT_DIR } from './screenshot.js';
import type { ColorEntry, FontEntry, TechEntry, Vibe } from '../types.js';

const execFileP = promisify(execFile);
const CLAUDE_TIMEOUT_MS = 60_000;

export interface VibeInput {
  screenshotRelPath: string; // e.g. "screenshots/12.webp"
  title?: string | null;
  description?: string | null;
  fonts: FontEntry[];
  tech: TechEntry[];
  colors: ColorEntry[];
}

export interface VibeResult {
  vibe: Vibe | null;
  error?: string;
}

function buildPrompt(input: VibeInput, absShot: string): string {
  const fonts = input.fonts.map((f) => f.family).join(', ') || 'none detected';
  const tech = input.tech.map((t) => t.name).join(', ') || 'none detected';
  const colors = input.colors.map((c) => c.hex).join(', ') || 'none';
  return [
    `Analyze this award-winning website. A screenshot is at: ${absShot}`,
    `Read that image, then respond with STRICT JSON only — no prose, no code fences.`,
    ``,
    `Title: ${input.title ?? 'unknown'}`,
    `Meta description: ${input.description ?? 'none'}`,
    `Fonts: ${fonts}`,
    `Tech: ${tech}`,
    `Dominant colors: ${colors}`,
    ``,
    `Respond with exactly this JSON shape:`,
    `{`,
    `  "description": "one sentence, plain language, what the site is and does",`,
    `  "industry": "one of: agency|saas|ecommerce|fashion|culture|fintech|gaming|food|architecture|portfolio|editorial|event|crypto|health|education|other",`,
    `  "vibe_tags": ["3-6 from: minimal, maximalist, brutalist, editorial, playful, corporate, luxury, retro, futuristic, organic, technical, illustrative, photographic, typographic, dark, light, colorful, monochrome"],`,
    `  "mood": "one short phrase",`,
    `  "uses_3d": true,`,
    `  "notable": "one specific standout detail or null"`,
    `}`,
  ].join('\n');
}

/** Strip code fences and parse the first JSON object found. */
function parseVibe(raw: string): Vibe {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) text = text.slice(start, end + 1);
  const parsed = JSON.parse(text) as Partial<Vibe>;
  return {
    description: String(parsed.description ?? ''),
    industry: String(parsed.industry ?? 'other'),
    vibe_tags: Array.isArray(parsed.vibe_tags) ? parsed.vibe_tags.map(String) : [],
    mood: String(parsed.mood ?? ''),
    uses_3d: Boolean(parsed.uses_3d),
    notable: parsed.notable == null ? null : String(parsed.notable),
  };
}

/**
 * One `claude -p` call per site. Never retries more than once. If the CLI is
 * unavailable (e.g. local dev without claude-code), returns vibe:null with a
 * note — the rest of the analysis still succeeds.
 */
export async function analyzeVibe(input: VibeInput): Promise<VibeResult> {
  const absShot = resolve(SCREENSHOT_DIR, '..', input.screenshotRelPath);
  const prompt = buildPrompt(input, absShot);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { stdout } = await execFileP('claude', ['-p', prompt], {
        timeout: CLAUDE_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024,
        env: process.env,
      });
      return { vibe: parseVibe(stdout) };
    } catch (err) {
      const e = err as NodeJS.ErrnoException & { stdout?: string };
      if (e.code === 'ENOENT') {
        return { vibe: null, error: 'claude CLI not available (vibe skipped)' };
      }
      if (attempt === 1) {
        const msg = e.stdout ? String(e.stdout).slice(0, 500) : e.message;
        return { vibe: null, error: `vibe failed: ${msg}` };
      }
    }
  }
  return { vibe: null, error: 'vibe failed' };
}
