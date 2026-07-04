import { getFeed, getTotals, type Winner } from '@/lib/queries';
import { Badges, FontChips, Palette, TechChips, VibeTags } from '@/components/bits';

export const dynamic = 'force-static';

function fmtDay(d: string): string {
  if (!d) return 'Undated';
  const date = new Date(d + 'T00:00:00Z');
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function groupByDay(winners: Winner[]): [string, Winner[]][] {
  const map = new Map<string, Winner[]>();
  for (const w of winners) {
    const key = w.awardDate || '';
    (map.get(key) ?? map.set(key, []).get(key)!).push(w);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

function Card({ w }: { w: Winner }) {
  return (
    <article className="card">
      <a href={`/site/${w.id}`} className="shot">
        {w.screenshot ? (
          <img src={`/${w.screenshot}`} alt={w.title ?? w.domain} loading="lazy" />
        ) : (
          <div className="noshot">no screenshot</div>
        )}
      </a>
      <Palette colors={w.colors} />
      <div className="card-body">
        <div className="card-title-row">
          <div>
            <a href={`/site/${w.id}`} className="card-title">
              {w.title ?? w.domain}
            </a>
            <div className="card-domain">{w.domain}</div>
          </div>
          <Badges awards={w.awards} />
        </div>

        {w.vibe?.description && <p className="vibe-desc">{w.vibe.description}</p>}
        {w.vibe?.vibe_tags?.length ? <VibeTags tags={w.vibe.vibe_tags} /> : null}

        {w.tech.length > 0 && (
          <div className="section">
            <div className="meta-label">Tech</div>
            <TechChips tech={w.tech} />
          </div>
        )}
        {w.fonts.filter((f) => !f.system).length > 0 && (
          <div className="section">
            <div className="meta-label">Type</div>
            <FontChips fonts={w.fonts} />
          </div>
        )}
        {w.status && w.status !== 'ok' && (
          <div className="status-flag">⚠ analysis: {w.status}</div>
        )}
      </div>
    </article>
  );
}

export default function FeedPage() {
  const winners = getFeed();
  const totals = getTotals();
  const days = groupByDay(winners);

  return (
    <>
      <section className="intro">
        <h1>
          What the web design
          <br />
          award circuit shipped.
        </h1>
        <p>
          Every day, Award Radar scrapes the winners, then visits each site to
          pull its fonts, tech stack, color palette, and vibe. This is the feed.
        </p>
        <div className="stats-row">
          <div className="stat">
            <div className="num">{totals.sites}</div>
            <div className="lbl">Winners</div>
          </div>
          <div className="stat">
            <div className="num">{totals.analyzed}</div>
            <div className="lbl">Analyzed</div>
          </div>
          <div className="stat">
            <div className="num">{totals.withVibe}</div>
            <div className="lbl">With vibe</div>
          </div>
          <div className="stat">
            <div className="num">{fmtDay(totals.latestDate).split(',')[0] || '—'}</div>
            <div className="lbl">Latest drop</div>
          </div>
        </div>
      </section>

      {days.map(([day, ws]) => (
        <section key={day}>
          <div className="day-head">
            <h2>{fmtDay(day)}</h2>
            <span className="count">{ws.length} winners</span>
          </div>
          <div className="grid">
            {ws.map((w) => (
              <Card key={w.id} w={w} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
