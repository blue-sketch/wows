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
    <header className="broadcast-header">
      <div className="broadcast-header__identity">
        <div className="brand-lockup">
          <div className="brand-mark">VX</div>
          <div>
            <p className="market-panel__eyebrow">Venturers Exchange</p>
            <h1>{snapshot?.marketState.currentRoundName ?? 'Market Broadcast'}</h1>
            <p className="desk-header__summary">
              Room-scale standings, live quote tape, and narrative events for the trading floor.
            </p>
          </div>
        </div>
      </div>
      <div className="broadcast-header__actions">
        <div className={`live-pill ${connected ? 'live-pill--good' : 'live-pill--warn'}`}>
          <span className={`status-dot ${connected ? '' : 'status-dot--warn'}`} />
          {connected ? 'Broadcast feed live' : 'Reconnecting'}
        </div>
        <div className="desk-stat-grid desk-stat-grid--broadcast">
          <div className="desk-stat">
            <span>Status</span>
            <strong>
              {snapshot?.marketState.tradingHalted
                ? 'Halted'
                : snapshot?.marketState.roundStatus === 'ACTIVE'
                  ? 'Trading Open'
                  : 'Closed'}
            </strong>
          </div>
          <div className="desk-stat">
            <span>Leaderboard</span>
            <strong>{snapshot?.marketState.leaderboardVisible ? 'Visible' : 'Hidden'}</strong>
          </div>
          <div className="desk-stat">
            <span>Event version</span>
            <strong>{snapshot?.marketState.eventVersion ?? 0}</strong>
          </div>
        </div>
      </div>
    </header>

    <section className="ticker-marquee" aria-label="Live market prices">
      <div className="ticker-marquee__track">
        {[...(Object.entries(snapshot?.prices ?? {})), ...(Object.entries(snapshot?.prices ?? {}))].map(
          ([ticker, price], index) => (
            <div key={`${ticker}-${index}`} className="ticker-marquee__item">
              <span>{ticker}</span>
              <strong>{formatCurrency(price)}</strong>
            </div>
          ),
        )}
      </div>
    </section>

    <section className="broadcast-grid">
      <article className="broadcast-card broadcast-card--status">
        <p className="market-panel__eyebrow">Market State</p>
        <h2>
          {snapshot?.marketState.tradingHalted
            ? 'Trading Halted'
            : snapshot?.marketState.roundStatus === 'ACTIVE'
              ? 'Open Auction'
              : 'Market Closed'}
        </h2>
        <p className="broadcast-card__copy">
          {snapshot?.marketState.leaderboardVisible
            ? 'The leaderboard is visible to the room.'
            : 'Leaderboard remains hidden until the reveal.'}
        </p>
      </article>

      <article className="broadcast-card broadcast-card--leaderboard">
        <div className="broadcast-card__header">
          <p className="market-panel__eyebrow">Top 10 Leaderboard</p>
          <span className="session-chip">{snapshot?.leaderboard.length ?? 0} desks ranked</span>
        </div>
        {snapshot?.leaderboard.length ? (
          <div className="broadcast-leaderboard">
            {snapshot.leaderboard.map((entry) => (
              <div key={entry.userId} className={`broadcast-leaderboard__row rank-${entry.rank}`}>
                <span className="leaderboard-rank">#{entry.rank}</span>
                <strong>{entry.displayName}</strong>
                <span>{formatCurrency(entry.portfolioValue)}</span>
              </div>
            ))}
          </div>
        ) : (
          <h3>Leaderboard hidden until reveal.</h3>
        )}
      </article>

      <article className="broadcast-card broadcast-card--news">
        <div className="broadcast-card__header">
          <p className="market-panel__eyebrow">News Wire</p>
          <span className="session-chip">{snapshot?.recentNews.length ?? 0} items</span>
        </div>
        <div className="broadcast-wire">
          {snapshot?.recentNews.length ? (
            snapshot.recentNews.map((item) => (
              <div key={item.id} className="broadcast-wire__item">
                <strong>{item.headline}</strong>
                {item.detail ? <p>{item.detail}</p> : null}
              </div>
            ))
          ) : (
            <h3>No news yet.</h3>
          )}
        </div>
      </article>

      <article className="broadcast-card broadcast-card--quotes">
        <div className="broadcast-card__header">
          <p className="market-panel__eyebrow">Quote Board</p>
          <span className="session-chip">{Object.keys(snapshot?.prices ?? {}).length} quotes</span>
        </div>
        <div className="broadcast-quotes">
          {Object.entries(snapshot?.prices ?? {}).length ? (
            Object.entries(snapshot?.prices ?? {}).map(([ticker, price]) => (
              <div key={ticker} className="broadcast-quotes__row">
                <span>{ticker}</span>
                <strong>{formatCurrency(price)}</strong>
              </div>
            ))
          ) : (
            <h3>Quotes will appear when the market feed starts.</h3>
          )}
        </div>
      </article>
    </section>
  </main>
);
