import { db } from './db';

// --- Shapes mirroring the JSON columns in analyses (see src/types.ts) ---
export interface FontEntry {
  family: string;
  foundryHint?: string;
  source: string;
  system?: boolean;
}
export interface TechEntry {
  name: string;
  category: string;
  confidence: 'high' | 'medium';
}
export interface ColorEntry {
  hex: string;
  share: number;
}
export interface Vibe {
  description: string;
  industry: string;
  vibe_tags: string[];
  mood: string;
  uses_3d: boolean;
  notable: string | null;
}
export interface AwardBadge {
  source: string;
  awardType: string;
  awardDate: string;
  studio: string | null;
  country: string | null;
  sourceUrl: string | null;
}
export interface Winner {
  id: number;
  domain: string;
  url: string;
  title: string | null;
  awardDate: string; // most recent award date
  awards: AwardBadge[];
  fonts: FontEntry[];
  tech: TechEntry[];
  colors: ColorEntry[];
  vibe: Vibe | null;
  screenshot: string | null;
  status: string | null;
}

function parse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface SiteJoinRow {
  id: number;
  domain: string;
  url: string;
  title: string | null;
  fonts: string | null;
  tech: string | null;
  colors: string | null;
  vibe: string | null;
  screenshot: string | null;
  status: string | null;
}

function awardsFor(siteId: number): AwardBadge[] {
  return (
    db()
      .prepare(
        `SELECT source, award_type as awardType, award_date as awardDate,
                studio, country, source_url as sourceUrl
         FROM awards WHERE site_id = ? ORDER BY award_date DESC`,
      )
      .all(siteId) as AwardBadge[]
  );
}

function hydrate(row: SiteJoinRow): Winner {
  const awards = awardsFor(row.id);
  return {
    id: row.id,
    domain: row.domain,
    url: row.url,
    title: row.title,
    awardDate: awards[0]?.awardDate ?? '',
    awards,
    fonts: parse<FontEntry[]>(row.fonts, []),
    tech: parse<TechEntry[]>(row.tech, []),
    colors: parse<ColorEntry[]>(row.colors, []),
    vibe: parse<Vibe | null>(row.vibe, null),
    screenshot: row.screenshot,
    status: row.status,
  };
}

/** Every winner, newest award first, with analysis joined. */
export function getFeed(): Winner[] {
  const rows = db()
    .prepare(
      `SELECT s.id, s.domain, s.url, s.title,
              a.fonts, a.tech, a.colors, a.vibe, a.screenshot, a.status,
              MAX(w.award_date) AS latest
       FROM sites s
       JOIN awards w ON w.site_id = s.id
       LEFT JOIN analyses a ON a.site_id = s.id
       GROUP BY s.id
       ORDER BY latest DESC, s.id DESC`,
    )
    .all() as (SiteJoinRow & { latest: string })[];
  return rows.map(hydrate);
}

/** One winner by id (or null). */
export function getWinner(id: number): Winner | null {
  const row = db()
    .prepare(
      `SELECT s.id, s.domain, s.url, s.title,
              a.fonts, a.tech, a.colors, a.vibe, a.screenshot, a.status
       FROM sites s LEFT JOIN analyses a ON a.site_id = s.id
       WHERE s.id = ?`,
    )
    .get(id) as SiteJoinRow | undefined;
  return row ? hydrate(row) : null;
}

export function getAllSiteIds(): number[] {
  return (db().prepare('SELECT id FROM sites ORDER BY id').all() as { id: number }[]).map(
    (r) => r.id,
  );
}

export interface SourceSection {
  source: string;
  label: string;
  awardLabel: string;
  winners: Winner[]; // most-recent award for this source first
}

const SOURCE_ORDER = ['awwwards', 'cssda', 'fwa', 'siteinspire', 'godly'];
const SOURCE_META: Record<string, { label: string; awardLabel: string }> = {
  awwwards: { label: 'Awwwards', awardLabel: 'Site of the Day' },
  cssda: { label: 'CSSDA', awardLabel: 'Website of the Day' },
  fwa: { label: 'FWA', awardLabel: 'FWA of the Day' },
  siteinspire: { label: 'SiteInspire', awardLabel: 'Featured' },
  godly: { label: 'Godly', awardLabel: 'Featured' },
};

/**
 * Winners grouped by award source, each ordered newest-first and deduped by
 * site (a site winning the same source twice shows once, at its latest date).
 * A multi-platform winner appears under each source it won on.
 */
export function getSourceSections(): SourceSection[] {
  const rows = db()
    .prepare(
      `SELECT a.source, a.award_date AS srcDate,
              s.id, s.domain, s.url, s.title,
              an.fonts, an.tech, an.colors, an.vibe, an.screenshot, an.status
       FROM awards a
       JOIN sites s ON s.id = a.site_id
       LEFT JOIN analyses an ON an.site_id = s.id
       ORDER BY a.award_date DESC, s.id DESC`,
    )
    .all() as (SiteJoinRow & { source: string; srcDate: string })[];

  const bySource = new Map<string, Map<number, (typeof rows)[number]>>();
  for (const r of rows) {
    let m = bySource.get(r.source);
    if (!m) bySource.set(r.source, (m = new Map()));
    if (!m.has(r.id)) m.set(r.id, r); // first seen = most recent (ordered)
  }

  const ordered = [
    ...SOURCE_ORDER,
    ...[...bySource.keys()].filter((s) => !SOURCE_ORDER.includes(s)),
  ];
  const out: SourceSection[] = [];
  for (const source of ordered) {
    const m = bySource.get(source);
    if (!m) continue;
    const winners = [...m.values()].map((r) => ({
      ...hydrate(r),
      awardDate: r.srcDate,
    }));
    const meta = SOURCE_META[source] ?? { label: source, awardLabel: 'Winner' };
    out.push({ source, label: meta.label, awardLabel: meta.awardLabel, winners });
  }
  return out;
}

export interface Stat {
  name: string;
  count: number;
}

/** Font usage leaderboard across all analyzed winners. */
export function getFontLeaderboard(limit = 15): Stat[] {
  const counts = new Map<string, number>();
  for (const w of getFeed()) {
    for (const f of w.fonts) {
      if (f.system) continue;
      counts.set(f.family, (counts.get(f.family) ?? 0) + 1);
    }
  }
  return topN(counts, limit);
}

/** Tech adoption leaderboard. */
export function getTechLeaderboard(limit = 15): Stat[] {
  const counts = new Map<string, number>();
  for (const w of getFeed()) {
    for (const t of w.tech) counts.set(t.name, (counts.get(t.name) ?? 0) + 1);
  }
  return topN(counts, limit);
}

/** Studio leaderboard from award metadata. */
export function getStudioLeaderboard(limit = 15): Stat[] {
  const rows = db()
    .prepare(
      `SELECT studio AS name, COUNT(*) AS count FROM awards
       WHERE studio IS NOT NULL AND studio != ''
       GROUP BY studio ORDER BY count DESC, name LIMIT ?`,
    )
    .all(limit) as Stat[];
  return rows;
}

export interface Totals {
  sites: number;
  analyzed: number;
  withVibe: number;
  latestDate: string;
}

export function getTotals(): Totals {
  const q = (sql: string) => (db().prepare(sql).get() as { n: number }).n;
  return {
    sites: q('SELECT COUNT(*) n FROM sites'),
    analyzed: q("SELECT COUNT(*) n FROM analyses WHERE status = 'ok'"),
    withVibe: q('SELECT COUNT(*) n FROM analyses WHERE vibe IS NOT NULL'),
    latestDate:
      (db().prepare('SELECT MAX(award_date) d FROM awards').get() as { d: string })
        .d ?? '',
  };
}

function topN(counts: Map<string, number>, limit: number): Stat[] {
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}
