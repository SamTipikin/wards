import {
  getSourceSections,
  getTotals,
  type SourceSection,
  type Winner,
} from '@/lib/queries';
import { Badges, FontChips, Palette, TechChips, VibeTags } from '@/components/bits';

export const dynamic = 'force-static';

function fmtDay(d: string): string {
  if (!d) return 'Undated';
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function HeroCard({ w, awardLabel }: { w: Winner; awardLabel: string }) {
  return (
    <article className="hero-card">
      <a href={`/site/${w.id}`} className="hero-shot">
        {w.screenshot ? (
          <img src={`/${w.screenshot}`} alt={w.title ?? w.domain} />
        ) : (
          <div className="noshot">no screenshot yet</div>
        )}
      </a>
      <Palette colors={w.colors} />
      <div className="hero-body">
        <div className="hero-eyebrow">
          {awardLabel} · {fmtDay(w.awardDate)}
        </div>
        <div className="card-title-row">
          <a href={`/site/${w.id}`} className="hero-title">
            {w.title ?? w.domain}
          </a>
          <Badges awards={w.awards} />
        </div>
        <div className="card-domain">{w.domain}</div>
        {w.vibe?.description && <p className="vibe-desc">{w.vibe.description}</p>}
        {w.vibe?.vibe_tags?.length ? <VibeTags tags={w.vibe.vibe_tags} /> : null}
        <div className="hero-meta">
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
        </div>
      </div>
    </article>
  );
}

function MiniCard({ w }: { w: Winner }) {
  return (
    <a href={`/site/${w.id}`} className="mini-card">
      <div className="mini-shot">
        {w.screenshot ? (
          <img src={`/${w.screenshot}`} alt={w.title ?? w.domain} loading="lazy" />
        ) : (
          <div className="noshot">queued</div>
        )}
      </div>
      <Palette colors={w.colors} />
      <div className="mini-body">
        <div className="mini-title">{w.title ?? w.domain}</div>
        <div className="mini-sub">
          {fmtDay(w.awardDate).replace(/,.*/, '')} · {w.domain}
        </div>
      </div>
    </a>
  );
}

function Section({ s, hero }: { s: SourceSection; hero: boolean }) {
  const [lead, ...rest] = s.winners;
  if (!lead) return null;
  return (
    <section className={hero ? 'source-section lead' : 'source-section'}>
      <div className="source-head">
        <h2>{s.label}</h2>
        <span className="source-award">{s.awardLabel}</span>
        <span className="source-count">{s.winners.length} winners</span>
      </div>
      <div className="hero-wrap">
        <HeroCard w={lead} awardLabel={s.awardLabel} />
      </div>
      {rest.length > 0 && (
        <div className="carousel" aria-label={`More from ${s.label}`}>
          {rest.map((w) => (
            <MiniCard key={w.id} w={w} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function FeedPage() {
  const sections = getSourceSections();
  const totals = getTotals();

  return (
    <>
      <section className="intro">
        <h1>
          What the web design
          <br />
          award circuit shipped.
        </h1>
        <p>
          Every day, Award Radar scrapes each platform&apos;s winners, then visits
          every site to pull its fonts, tech stack, color palette, and vibe.
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
            <div className="num">{sections.length}</div>
            <div className="lbl">Sources</div>
          </div>
        </div>
      </section>

      {sections.map((s, i) => (
        <Section key={s.source} s={s} hero={i === 0} />
      ))}
    </>
  );
}
