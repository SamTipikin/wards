import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Analysis, RunResult, Source, Winner } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = resolve(__dirname, '../data/radar.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  first_seen DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS awards (
  id INTEGER PRIMARY KEY,
  site_id INTEGER REFERENCES sites(id),
  source TEXT NOT NULL,
  award_type TEXT NOT NULL,
  award_date DATE NOT NULL,
  studio TEXT,
  country TEXT,
  source_url TEXT,
  UNIQUE(site_id, source, award_type, award_date)
);

CREATE TABLE IF NOT EXISTS analyses (
  site_id INTEGER PRIMARY KEY REFERENCES sites(id),
  analyzed_at DATETIME NOT NULL,
  fonts JSON,
  tech JSON,
  colors JSON,
  vibe JSON,
  screenshot TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  error TEXT
);

CREATE TABLE IF NOT EXISTS run_log (
  id INTEGER PRIMARY KEY,
  run_date DATE NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  winners_found INTEGER,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_awards_date ON awards(award_date);
CREATE INDEX IF NOT EXISTS idx_awards_site ON awards(site_id);
CREATE INDEX IF NOT EXISTS idx_run_log_date ON run_log(run_date);
`;

export type DB = Database.Database;

/** Open (creating if needed) the radar DB with schema applied. */
export function openDb(path: string = DB_PATH): DB {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

/**
 * Normalize a URL to a dedup key: lowercase host, strip leading www., drop
 * path/query/fragment. Falls back to a cleaned raw string if URL parsing fails.
 */
export function normalizeDomain(url: string): string {
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return url
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]!
      .trim();
  }
}

/** Insert a site if new, returning its id. Idempotent on domain. */
export function upsertSite(
  db: DB,
  winner: Pick<Winner, 'url' | 'title'>,
  firstSeen: string,
): number {
  const domain = normalizeDomain(winner.url);
  const existing = db
    .prepare('SELECT id FROM sites WHERE domain = ?')
    .get(domain) as { id: number } | undefined;
  if (existing) {
    // Backfill a title if we now have one and didn't before.
    if (winner.title) {
      db.prepare(
        'UPDATE sites SET title = COALESCE(title, ?) WHERE id = ?',
      ).run(winner.title, existing.id);
    }
    return existing.id;
  }
  const info = db
    .prepare(
      'INSERT INTO sites (domain, url, title, first_seen) VALUES (?, ?, ?, ?)',
    )
    .run(domain, winner.url, winner.title ?? null, firstSeen);
  return Number(info.lastInsertRowid);
}

/** Upsert an award. Unique on (site_id, source, award_type, award_date). */
export function upsertAward(
  db: DB,
  siteId: number,
  source: Source,
  winner: Winner,
): void {
  db.prepare(
    `INSERT INTO awards (site_id, source, award_type, award_date, studio, country, source_url)
     VALUES (@siteId, @source, @awardType, @awardDate, @studio, @country, @sourceUrl)
     ON CONFLICT(site_id, source, award_type, award_date) DO UPDATE SET
       studio = COALESCE(excluded.studio, awards.studio),
       country = COALESCE(excluded.country, awards.country),
       source_url = COALESCE(excluded.source_url, awards.source_url)`,
  ).run({
    siteId,
    source,
    awardType: winner.awardType,
    awardDate: winner.awardDate,
    studio: winner.studio ?? null,
    country: winner.country ?? null,
    sourceUrl: winner.sourceUrl ?? null,
  });
}

/** Convenience: upsert site + award together for one winner. Returns siteId. */
export function recordWinner(
  db: DB,
  source: Source,
  winner: Winner,
): number {
  const siteId = upsertSite(db, winner, winner.awardDate);
  upsertAward(db, siteId, source, winner);
  return siteId;
}

export interface SiteRow {
  id: number;
  domain: string;
  url: string;
  title: string | null;
}

/** Sites that have no analysis row yet (optionally capped). */
export function getSitesNeedingAnalysis(db: DB, limit?: number): SiteRow[] {
  const sql =
    `SELECT s.id, s.domain, s.url, s.title FROM sites s
     LEFT JOIN analyses a ON a.site_id = s.id
     WHERE a.site_id IS NULL
     ORDER BY s.id` + (limit ? ' LIMIT ?' : '');
  const stmt = db.prepare(sql);
  return (limit ? stmt.all(limit) : stmt.all()) as SiteRow[];
}

/** Upsert a full analysis row (JSON columns stringified). Idempotent on site. */
export function upsertAnalysis(db: DB, a: Analysis): void {
  db.prepare(
    `INSERT INTO analyses
       (site_id, analyzed_at, fonts, tech, colors, vibe, screenshot, status, error)
     VALUES (@siteId, @analyzedAt, @fonts, @tech, @colors, @vibe, @screenshot, @status, @error)
     ON CONFLICT(site_id) DO UPDATE SET
       analyzed_at = excluded.analyzed_at,
       fonts = excluded.fonts,
       tech = excluded.tech,
       colors = excluded.colors,
       vibe = excluded.vibe,
       screenshot = excluded.screenshot,
       status = excluded.status,
       error = excluded.error`,
  ).run({
    siteId: a.siteId,
    analyzedAt: a.analyzedAt,
    fonts: a.fonts ? JSON.stringify(a.fonts) : null,
    tech: a.tech ? JSON.stringify(a.tech) : null,
    colors: a.colors ? JSON.stringify(a.colors) : null,
    vibe: a.vibe ? JSON.stringify(a.vibe) : null,
    screenshot: a.screenshot ?? null,
    status: a.status,
    error: a.error ?? null,
  });
}

/** Append a per-source outcome row for a run. */
export function logRun(db: DB, runDate: string, result: RunResult): void {
  db.prepare(
    `INSERT INTO run_log (run_date, source, status, winners_found, error)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    runDate,
    result.source,
    result.status,
    result.winnersFound,
    result.error ?? null,
  );
}

export { existsSync };
