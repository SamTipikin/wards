import {
  getFontLeaderboard,
  getStudioLeaderboard,
  getTechLeaderboard,
  getTotals,
  type Stat,
} from '@/lib/queries';

export const dynamic = 'force-static';

function Board({ title, stats }: { title: string; stats: Stat[] }) {
  const max = Math.max(1, ...stats.map((s) => s.count));
  return (
    <div className="board">
      <h3>{title}</h3>
      {stats.length === 0 && (
        <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>
          No data yet.
        </div>
      )}
      {stats.map((s) => (
        <div className="bar-row" key={s.name}>
          <span className="name" title={s.name}>
            {s.name}
          </span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{ width: `${(s.count / max) * 100}%` }}
            />
          </span>
          <span className="val">{s.count}</span>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const fonts = getFontLeaderboard();
  const tech = getTechLeaderboard();
  const studios = getStudioLeaderboard();
  const totals = getTotals();

  return (
    <>
      <section className="intro">
        <h1>Analytics</h1>
        <p>
          Aggregate trends across {totals.sites} analyzed winners. Leaderboards
          recompute on every build as new winners land.
        </p>
      </section>
      <div className="board-grid">
        <Board title="Font leaderboard" stats={fonts} />
        <Board title="Tech adoption" stats={tech} />
        <Board title="Studio leaderboard" stats={studios} />
      </div>
    </>
  );
}
