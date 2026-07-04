import type { ColorEntry, FontEntry, TechEntry } from '@/lib/queries';

export function Palette({ colors }: { colors: ColorEntry[] }) {
  if (!colors.length) return null;
  return (
    <div className="palette" aria-label="dominant colors">
      {colors.map((c, i) => (
        <span key={i} style={{ background: c.hex }} title={`${c.hex} · ${Math.round(c.share * 100)}%`} />
      ))}
    </div>
  );
}

export function TechChips({ tech }: { tech: TechEntry[] }) {
  if (!tech.length) return null;
  return (
    <div className="chips">
      {tech.map((t) => (
        <span className="chip tech" key={t.name}>
          <span className={t.confidence === 'high' ? 'hi' : 'med'} />
          {t.name}
        </span>
      ))}
    </div>
  );
}

export function FontChips({ fonts }: { fonts: FontEntry[] }) {
  const real = fonts.filter((f) => !f.system);
  if (!real.length) return null;
  return (
    <div className="chips">
      {real.map((f) => (
        <span className="chip font" key={f.family}>
          {f.family}
          {f.foundryHint ? ` · ${f.foundryHint}` : ''}
        </span>
      ))}
    </div>
  );
}

export function VibeTags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="tags">
      {tags.map((t) => (
        <span className="tag" key={t}>
          {t}
        </span>
      ))}
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  awwwards: 'AWW',
  fwa: 'FWA',
  cssda: 'CSSDA',
  godly: 'GODLY',
  siteinspire: 'SI',
};

export function Badges({
  awards,
}: {
  awards: { source: string; awardType: string }[];
}) {
  return (
    <div className="badges">
      {awards.map((a, i) => (
        <span className="badge" key={i}>
          {SOURCE_LABEL[a.source] ?? a.source} · {a.awardType}
        </span>
      ))}
    </div>
  );
}
