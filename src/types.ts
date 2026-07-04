// Shared contracts across scrapers, analysis, and the frontend.
// The DB schema in db.ts is the source of truth; these mirror it.

export type Source = 'awwwards' | 'fwa' | 'cssda' | 'godly' | 'siteinspire';

/** What every scraper's `scrape(date?)` resolves to. */
export interface Winner {
  url: string;
  title?: string;
  studio?: string;
  country?: string;
  awardType: string; // 'sotd' | 'wotd' | 'honorable' | ...
  awardDate: string; // YYYY-MM-DD
  sourceUrl?: string; // the award page URL
}

export interface Scraper {
  source: Source;
  scrape(date?: string): Promise<Winner[]>;
}

export type RunStatus = 'ok' | 'failed' | 'empty';

/** Per-source outcome for a single run, written to run_log. */
export interface RunResult {
  source: Source;
  status: RunStatus;
  winnersFound: number;
  error?: string;
}

// --- Analysis shapes (used from Phase 2 onward) ---

export type FontSource =
  | 'google'
  | 'adobe'
  | 'fontshare'
  | 'self-hosted'
  | 'system';

export interface FontEntry {
  family: string;
  foundryHint?: string;
  source: FontSource;
  system?: boolean;
}

export type TechCategory =
  | '3d'
  | 'animation'
  | 'scroll'
  | 'framework'
  | 'builder';

export interface TechEntry {
  name: string;
  category: TechCategory;
  confidence: 'high' | 'medium';
}

export interface ColorEntry {
  hex: string;
  share: number; // 0..1
}

export interface Vibe {
  description: string;
  industry: string;
  vibe_tags: string[];
  mood: string;
  uses_3d: boolean;
  notable: string | null;
}

export type AnalysisStatus =
  | 'ok'
  | 'unreachable'
  | 'blocked'
  | 'timeout'
  | 'skipped_backfill';

export interface Analysis {
  siteId: number;
  analyzedAt: string;
  fonts: FontEntry[] | null;
  tech: TechEntry[] | null;
  colors: ColorEntry[] | null;
  vibe: Vibe | null;
  screenshot: string | null;
  status: AnalysisStatus;
  error?: string;
}
