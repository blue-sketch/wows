import { useRef, useEffect, useState } from 'react';
import type { PublicDisplaySnapshotDto, LeaderboardEntryDto } from '../../../src/shared/contracts.js';
import '../styles/display.css';

interface DisplayPageProps {
  snapshot: PublicDisplaySnapshotDto | null;
  connected: boolean;
}

/* ── Helpers ──────────────────────────────────── */
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

const formatTime = (isoString: string) => {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

/* ── Podium component for top 3 ──────────────── */
const PodiumCard = ({
  entry,
  position,
}: {
  entry: LeaderboardEntryDto;
  position: 1 | 2 | 3;
}) => {
  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
  return (
    <div className={`dp-podium dp-podium--p${position}`}>
      <div className="dp-podium__rank">
        <span className="dp-podium__medal">{medals[position]}</span>
        <span className="dp-podium__number">#{position}</span>
      </div>
      <strong className="dp-podium__name">{entry.displayName}</strong>
      <span className="dp-podium__value">{formatCurrency(entry.portfolioValue)}</span>
      <div className="dp-podium__meta">
        <span>{entry.tradeCount} trades</span>
        <span>Cash: {formatCurrency(entry.cashBalance)}</span>
      </div>
    </div>
  );
};

/* ── Leaderboard row with animated bar ────────── */
const LeaderboardRow = ({
  entry,
  maxValue,
  index,
}: {
  entry: LeaderboardEntryDto;
  maxValue: number;
  index: number;
}) => {
  const barWidth = maxValue > 0 ? Math.max(8, (entry.portfolioValue / maxValue) * 100) : 0;

  return (
    <div
      className={`dp-lb-row ${entry.rank <= 3 ? `dp-lb-row--top${entry.rank}` : ''}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <span className="dp-lb-row__rank">#{entry.rank}</span>
      <span className="dp-lb-row__name">{entry.displayName}</span>
      <div className="dp-lb-row__bar-track">
        <div
          className="dp-lb-row__bar"
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <strong className="dp-lb-row__value">{formatCurrency(entry.portfolioValue)}</strong>
    </div>
  );
};

/* ── Previous prices tracking for change calc ── */
const usePreviousPrices = (prices: Record<string, number>) => {
  const prevRef = useRef<Record<string, number>>({});
  const [prev, setPrev] = useState<Record<string, number>>({});

  useEffect(() => {
    if (Object.keys(prices).length > 0) {
      setPrev({ ...prevRef.current });
      prevRef.current = { ...prices };
    }
  }, [prices]);

  return prev;
};

/* ── Main display page ───────────────────────── */
export const DisplayPage = ({ snapshot, connected }: DisplayPageProps) => {
  const [mounted, setMounted] = useState(false);
  const prices = snapshot?.prices ?? {};
  const prevPrices = usePreviousPrices(prices);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(timer);
  }, []);

  const leaderboard = snapshot?.leaderboard ?? [];
  const maxValue = leaderboard.length > 0 ? leaderboard[0].portfolioValue : 0;
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  const tradingStatus = snapshot?.marketState.tradingHalted
    ? 'halted'
    : snapshot?.marketState.roundStatus === 'ACTIVE'
      ? 'open'
      : 'closed';

  const statusLabels = {
    open: 'Trading Open',
    closed: 'Market Closed',
    halted: 'Trading Halted',
  };

  return (
    <main className={`dp-shell ${mounted ? 'dp-shell--entered' : ''}`}>
      {/* ── Ambient layers ── */}
      <div className="dp-ambient" aria-hidden="true">
        <div className="dp-ambient__glow dp-ambient__glow--warm" />
        <div className="dp-ambient__glow dp-ambient__glow--cool" />
        <div className="dp-ambient__grid" />
      </div>

      {/* ── Top header bar ── */}
      <header className="dp-header">
        <div className="dp-header__brand">
          <div className="dp-header__mark">
            <svg width="26" height="26" viewBox="0 0 22 22" fill="none">
              <path d="M2 20L11 2L20 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.5 14H16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <span className="dp-header__name">Venturers Exchange</span>
            <span className="dp-header__sub">EDC Flagship · 2026</span>
          </div>
        </div>

        <div className="dp-header__center">
          <h1 className="dp-header__round">
            {snapshot?.marketState.currentRoundName ?? 'Venturers Market'}
          </h1>
        </div>

        <div className="dp-header__right">
          <div className={`dp-status-badge dp-status-badge--${tradingStatus}`}>
            <span className="dp-status-badge__dot" />
            <span>{statusLabels[tradingStatus]}</span>
          </div>
          <div className={`dp-conn-pill ${connected ? '' : 'dp-conn-pill--warn'}`}>
            {connected ? 'Feed Live' : 'Reconnecting'}
          </div>
        </div>
      </header>

      {/* ── Scrolling ticker tape ── */}
      <div className="dp-ticker" aria-label="Live market prices">
        <div className="dp-ticker__track">
          {[...Object.entries(prices), ...Object.entries(prices)].map(
            ([ticker, price], i) => {
              const prev = prevPrices[ticker];
              const change = prev && prev !== 0 ? ((price - prev) / prev) * 100 : 0;
              return (
                <span key={`${ticker}-${i}`} className="dp-ticker__item">
                  <span className="dp-ticker__symbol">{ticker}</span>
                  <strong>{formatCurrency(price)}</strong>
                  {change !== 0 && (
                    <span className={change >= 0 ? 'dp-up' : 'dp-down'}>
                      {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                    </span>
                  )}
                </span>
              );
            },
          )}
        </div>
      </div>

      {/* ── Main content grid ── */}
      <div className="dp-content">
        {/* ── LEFT: Leaderboard ── */}
        <section className="dp-leaderboard">
          <div className="dp-section-header">
            <div className="dp-section-header__left">
              <span className="dp-eyebrow">Standings</span>
              <h2>Top 10 Leaderboard</h2>
            </div>
            <span className="dp-badge">
              {leaderboard.length > 0
                ? `${leaderboard.length} desks ranked`
                : 'Awaiting reveal'}
            </span>
          </div>

          {leaderboard.length > 0 ? (
            <>
              {/* Podium for top 3 */}
              {top3.length >= 3 && (
                <div className="dp-podium-strip">
                  <PodiumCard entry={top3[1]} position={2} />
                  <PodiumCard entry={top3[0]} position={1} />
                  <PodiumCard entry={top3[2]} position={3} />
                </div>
              )}

              {/* Remaining rows */}
              <div className="dp-lb-list">
                {(top3.length < 3 ? leaderboard : rest).map((entry, i) => (
                  <LeaderboardRow
                    key={entry.userId}
                    entry={entry}
                    maxValue={maxValue}
                    index={i}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="dp-lb-hidden">
              <div className="dp-lb-hidden__icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </div>
              <h3>Leaderboard Hidden</h3>
              <p>Rankings will be revealed by the admin. Stay sharp.</p>
            </div>
          )}
        </section>

        {/* ── RIGHT: Quotes + News ── */}
        <aside className="dp-sidebar">
          {/* Quote board */}
          <section className="dp-quotes">
            <div className="dp-section-header">
              <div className="dp-section-header__left">
                <span className="dp-eyebrow">Live Quotes</span>
                <h2>Market Board</h2>
              </div>
              <span className="dp-badge">{Object.keys(prices).length} securities</span>
            </div>
            <div className="dp-quote-grid">
              {Object.entries(prices).map(([ticker, price]) => {
                const prev = prevPrices[ticker];
                const change = prev && prev !== 0 ? ((price - prev) / prev) * 100 : 0;
                const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
                return (
                  <div key={ticker} className={`dp-quote dp-quote--${direction}`}>
                    <span className="dp-quote__ticker">{ticker}</span>
                    <strong className="dp-quote__price">{formatCurrency(price)}</strong>
                    {change !== 0 && (
                      <span className={`dp-quote__change ${direction === 'up' ? 'dp-up' : 'dp-down'}`}>
                        {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* News wire */}
          <section className="dp-news">
            <div className="dp-section-header">
              <div className="dp-section-header__left">
                <span className="dp-eyebrow">Breaking</span>
                <h2>News Wire</h2>
              </div>
              <span className="dp-badge">{snapshot?.recentNews.length ?? 0} alerts</span>
            </div>
            <div className="dp-news-list">
              {snapshot?.recentNews.length ? (
                snapshot.recentNews.slice().reverse().map((item, i) => (
                  <article
                    key={item.id}
                    className="dp-news-item"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="dp-news-item__time">
                      {formatTime(item.triggeredAt)}
                    </div>
                    <div className="dp-news-item__body">
                      <strong>{item.headline}</strong>
                      {item.detail && <p>{item.detail}</p>}
                    </div>
                  </article>
                ))
              ) : (
                <div className="dp-news-empty">
                  <span>No market events yet. The wire opens with Round 1.</span>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
};
