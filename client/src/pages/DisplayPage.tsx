import type { PublicDisplaySnapshotDto } from '../../../src/shared/contracts.js';

interface DisplayPageProps {
  snapshot: PublicDisplaySnapshotDto | null;
  connected: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

export const DisplayPage = ({ snapshot, connected }: DisplayPageProps) => (
  <main className="display-shell">
    <header className="display-hero">
      <div>
        <p className="market-panel__eyebrow">Public Display</p>
        <h1>{snapshot?.marketState.currentRoundName ?? 'Venturers Market Platform'}</h1>
      </div>
      <div className={`metric-pill ${connected ? 'metric-pill--good' : 'metric-pill--warn'}`}>
        <span>Feed</span>
        <strong>{connected ? 'Live' : 'Reconnecting'}</strong>
      </div>
    </header>

    <section className="display-grid">
      <article className="display-card">
        <p className="market-panel__eyebrow">Round Status</p>
        <h2>
          {snapshot?.marketState.tradingHalted
            ? 'Trading Halted'
            : snapshot?.marketState.roundStatus === 'ACTIVE'
              ? 'Trading Open'
              : 'Market Closed'}
        </h2>
      </article>

      <article className="display-card display-card--leaderboard">
        <p className="market-panel__eyebrow">Top 10 Leaderboard</p>
        {snapshot?.leaderboard.length ? (
          snapshot.leaderboard.map((entry) => (
            <div key={entry.userId} className="display-row">
              <span>#{entry.rank}</span>
              <strong>{entry.displayName}</strong>
              <span>{formatCurrency(entry.portfolioValue)}</span>
            </div>
          ))
        ) : (
          <h3>Leaderboard hidden until reveal.</h3>
        )}
      </article>

      <article className="display-card">
        <p className="market-panel__eyebrow">News Ticker</p>
        <div className="display-news">
          {snapshot?.recentNews.length ? (
            snapshot.recentNews.map((item) => (
              <div key={item.id} className="display-news__item">
                <strong>{item.headline}</strong>
                {item.detail ? <span>{item.detail}</span> : null}
              </div>
            ))
          ) : (
            <h3>No news yet.</h3>
          )}
        </div>
      </article>
    </section>
  </main>
);
