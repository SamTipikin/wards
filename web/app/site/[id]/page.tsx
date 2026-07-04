import { notFound } from 'next/navigation';
import { getAllSiteIds, getWinner } from '@/lib/queries';
import { Badges, FontChips, Palette, TechChips, VibeTags } from '@/components/bits';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return getAllSiteIds().map((id) => ({ id: String(id) }));
}

export default async function SiteDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const w = getWinner(Number(id));
  if (!w) notFound();

  return (
    <>
      <a href="/" className="back-link">
        ← Back to feed
      </a>

      <section className="intro" style={{ paddingTop: 18 }}>
        <div className="card-title-row" style={{ alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 34, marginBottom: 8 }}>
              {w.title ?? w.domain}
            </h1>
            <a href={w.url} className="ext-link" target="_blank" rel="noopener">
              {w.domain} ↗
            </a>
          </div>
          <Badges awards={w.awards} />
        </div>
      </section>

      <div className="detail-hero">
        {w.screenshot ? (
          <img src={`/${w.screenshot}`} alt={w.title ?? w.domain} />
        ) : (
          <div className="board">No screenshot captured.</div>
        )}
      </div>
      <div style={{ marginTop: 4 }}>
        <Palette colors={w.colors} />
      </div>

      <div className="detail-grid">
        <div className="kv">
          {w.vibe?.description && (
            <div className="block">
              <div className="meta-label">Summary</div>
              <p className="vibe-desc" style={{ fontSize: 15 }}>
                {w.vibe.description}
              </p>
            </div>
          )}
          {w.vibe?.vibe_tags?.length ? (
            <div className="block">
              <div className="meta-label">Vibe</div>
              <VibeTags tags={w.vibe.vibe_tags} />
            </div>
          ) : null}
          {w.tech.length > 0 && (
            <div className="block">
              <div className="meta-label">Tech stack</div>
              <TechChips tech={w.tech} />
            </div>
          )}
          {w.fonts.filter((f) => !f.system).length > 0 && (
            <div className="block">
              <div className="meta-label">Typography</div>
              <FontChips fonts={w.fonts} />
            </div>
          )}
        </div>

        <div className="kv">
          <div className="block">
            <div className="meta-label">Awards</div>
            {w.awards.map((a, i) => (
              <div key={i} style={{ marginBottom: 10, fontSize: 14 }}>
                <strong>{a.source}</strong> · {a.awardType} · {a.awardDate}
                {a.studio && (
                  <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                    by {a.studio}
                    {a.country ? ` · ${a.country}` : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
          {w.vibe?.mood && (
            <div className="block">
              <div className="meta-label">Mood</div>
              <div style={{ fontSize: 14 }}>{w.vibe.mood}</div>
            </div>
          )}
          {w.vibe?.notable && (
            <div className="block">
              <div className="meta-label">Notable</div>
              <div style={{ fontSize: 14, color: 'var(--text-dim)' }}>
                {w.vibe.notable}
              </div>
            </div>
          )}
          {w.colors.length > 0 && (
            <div className="block">
              <div className="meta-label">Palette</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {w.colors.map((c, i) => (
                  <div key={i} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 8,
                        background: c.hex,
                        border: '1px solid var(--border)',
                        marginBottom: 4,
                      }}
                    />
                    {c.hex}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
