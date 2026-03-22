import { useEffect, useState } from 'react';
import type { LeaderboardEntryDto, MarketSnapshotDto } from '../../../src/shared/contracts.js';
import { request } from '../api.js';
import { MarketPanel } from '../components/MarketPanel.js';
import type { UserSessionState } from '../App.js';

interface AdminPageProps {
  session: UserSessionState;
  snapshot: MarketSnapshotDto;
  participants: LeaderboardEntryDto[];
  connected: boolean;
  onLogout: () => Promise<void>;
  onRefreshParticipants: () => Promise<void>;
}

interface RoundDto {
  id: number;
  number: number;
  name: string;
  status: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);

const formatSignedPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

export const AdminPage = ({
  session,
  snapshot,
  participants,
  connected,
  onLogout,
  onRefreshParticipants,
}: AdminPageProps) => {
  const [rounds, setRounds] = useState<RoundDto[]>([]);
  const [roundId, setRoundId] = useState<number | ''>('');
  const [impactTicker, setImpactTicker] = useState(snapshot.stocks[0]?.ticker ?? '');
  const [impactMagnitude, setImpactMagnitude] = useState(10);
  const [impacts, setImpacts] = useState<Array<{ ticker: string; magnitudePct: number }>>([]);
  const [newsHeadline, setNewsHeadline] = useState('');
  const [newsDetail, setNewsDetail] = useState('');
  const [shockTicker, setShockTicker] = useState(snapshot.stocks[0]?.ticker ?? '');
  const [shockMagnitude, setShockMagnitude] = useState(15);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [csv, setCsv] = useState(
    'username,password,displayName,role\nparticipant01,market-ready,Participant 01,PARTICIPANT',
  );
  const [haltConfirmation, setHaltConfirmation] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const payload = await request<{ rounds: RoundDto[] }>('/api/admin/rounds');
      setRounds(payload.rounds);
      setRoundId((current) => current || payload.rounds[0]?.id || '');
    })();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void onRefreshParticipants();
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [onRefreshParticipants]);

  const marketOpen =
    !snapshot.marketState.tradingHalted && snapshot.marketState.roundStatus === 'ACTIVE';
  const pricePreview = impacts
    .map((impact) => {
      const stock = snapshot.stocks.find((item) => item.ticker === impact.ticker);
      if (!stock) return null;
      const nextPrice = stock.currentPrice * (1 + impact.magnitudePct / 100);
      return `${impact.ticker}: ${formatCurrency(stock.currentPrice)} -> ${formatCurrency(nextPrice)}`;
    })
    .filter((entry): entry is string => Boolean(entry));
  const totalPortfolioValue = participants.reduce((total, participant) => total + participant.portfolioValue, 0);
  const totalTrades = participants.reduce((total, participant) => total + participant.tradeCount, 0);
  const marketBreadth = snapshot.stocks.filter((stock) => stock.currentPrice >= stock.basePrice).length;
  const quoteDeck = [...snapshot.stocks].sort(
    (left, right) =>
      Math.abs((right.currentPrice - right.basePrice) / (right.basePrice || 1)) -
      Math.abs((left.currentPrice - left.basePrice) / (left.basePrice || 1)),
  );
  const topMover = quoteDeck[0];
  const topParticipants = participants.slice(0, 5);

  const runAction = async (task: () => Promise<void>, successMessage: string) => {
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await task();
      setStatusMessage(successMessage);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Action failed.');
    }
  };

  return (
    <main className="terminal-shell terminal-shell--admin">
      <header className="desk-header">
        <div className="desk-header__identity">
          <div className="brand-lockup">
            <div className="brand-mark">VX</div>
            <div>
              <p className="market-panel__eyebrow">Venturers Exchange</p>
              <h1>Market Operations Desk</h1>
              <p className="desk-header__summary">
                Live market supervision for rounds, narrative events, direct pricing shocks, and safety
                controls.
              </p>
            </div>
          </div>
        </div>
        <div className="desk-header__actions">
          <div className={`live-pill ${connected ? 'live-pill--good' : 'live-pill--warn'}`}>
            <span className={`status-dot ${connected ? '' : 'status-dot--warn'}`} />
            {connected ? 'Control channel live' : 'Reconnecting'}
          </div>
          <div className="desk-stat-grid">
            <div className="desk-stat">
              <span>Operator</span>
              <strong>{session.user?.displayName}</strong>
            </div>
            <div className="desk-stat">
              <span>Round</span>
              <strong>{snapshot.marketState.currentRoundName ?? 'Not started'}</strong>
            </div>
            <div className="desk-stat">
              <span>Status</span>
              <strong>{marketOpen ? 'Open' : snapshot.marketState.tradingHalted ? 'Halted' : 'Closed'}</strong>
            </div>
            <div className="desk-stat">
              <span>Leaderboard</span>
              <strong>{snapshot.marketState.leaderboardVisible ? 'Visible' : 'Hidden'}</strong>
            </div>
            <div className="desk-stat">
              <span>Participants</span>
              <strong>{participants.length}</strong>
            </div>
            <div className="desk-stat">
              <span>Event version</span>
              <strong>{snapshot.marketState.eventVersion}</strong>
            </div>
          </div>
          <button className="ghost-button" onClick={() => void onLogout()}>
            Logout
          </button>
        </div>
      </header>

      <section className="signal-strip signal-strip--admin">
        <article className="signal-card">
          <span>Market breadth</span>
          <strong>
            {marketBreadth}/{snapshot.stocks.length}
          </strong>
          <p>Names are trading above their base price.</p>
        </article>
        <article className="signal-card">
          <span>Aggregate value</span>
          <strong>{formatCurrency(totalPortfolioValue)}</strong>
          <p>Total participant book value across the session.</p>
        </article>
        <article className="signal-card">
          <span>Executed trades</span>
          <strong>{totalTrades}</strong>
          <p>Running trade count based on the leaderboard dataset.</p>
        </article>
        <article className="signal-card">
          <span>Lead mover</span>
          <strong>{topMover?.ticker ?? '--'}</strong>
          <p>
            {topMover
              ? formatSignedPercent(
                  ((topMover.currentPrice - topMover.basePrice) / (topMover.basePrice || 1)) * 100,
                )
              : 'No move yet'}
          </p>
        </article>
      </section>

      {statusMessage ? <p className="status-banner status-banner--good">{statusMessage}</p> : null}
      {errorMessage ? <p className="status-banner status-banner--bad">{errorMessage}</p> : null}

      <section className="admin-workspace">
        <div className="admin-column admin-column--left">
          <MarketPanel
            eyebrow="Market Pulse"
            title="Quote Deck"
            aside={<span className="session-chip">{snapshot.stocks.length} tracked names</span>}
            className="pulse-panel"
          >
            <div className="quote-deck">
              {quoteDeck.map((stock) => {
                const deltaPct = ((stock.currentPrice - stock.basePrice) / (stock.basePrice || 1)) * 100;

                return (
                  <article key={stock.id} className="quote-row">
                    <div className="quote-row__meta">
                      <p>{stock.ticker}</p>
                      <h3>{stock.companyName}</h3>
                      <span>{stock.availableSupply} available</span>
                    </div>
                    <div className="quote-row__value">
                      <strong>{formatCurrency(stock.currentPrice)}</strong>
                      <span className={deltaPct >= 0 ? 'up' : 'down'}>{formatSignedPercent(deltaPct)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </MarketPanel>

          <MarketPanel eyebrow="Round Control" title="Session Clock" className="round-panel">
            <label>
              Round
              <select value={roundId} onChange={(event) => setRoundId(Number(event.target.value))}>
                {rounds.map((round) => (
                  <option key={round.id} value={round.id}>
                    {round.number}. {round.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="action-row">
              <button
                className="primary-button"
                onClick={() =>
                  void runAction(
                    () => request('/api/admin/round/start', { method: 'POST', body: { roundId } }),
                    'Round started and live trading resumed.',
                  )
                }
              >
                Start Round
              </button>
              <button
                className="ghost-button"
                onClick={() =>
                  void runAction(() => request('/api/admin/round/end', { method: 'POST' }), 'Round ended.')
                }
              >
                End Round
              </button>
            </div>
          </MarketPanel>

          <MarketPanel eyebrow="Safety Layer" title="Emergency Controls" className="safety-panel">
            <label>
              Type HALT to confirm
              <input value={haltConfirmation} onChange={(event) => setHaltConfirmation(event.target.value)} />
            </label>
            <div className="action-row">
              <button
                className="danger-button"
                onClick={() =>
                  void runAction(
                    () =>
                      request('/api/admin/halt', {
                        method: 'POST',
                        body: { halted: true, confirmation: haltConfirmation },
                      }),
                    'Trading halted.',
                  )
                }
              >
                Halt Trading
              </button>
              <button
                className="ghost-button"
                onClick={() =>
                  void runAction(
                    () => request('/api/admin/halt', { method: 'POST', body: { halted: false } }),
                    'Trading resumed.',
                  )
                }
              >
                Resume Trading
              </button>
            </div>
            <button
              className="ghost-button"
              onClick={() =>
                void runAction(
                  () =>
                    request('/api/admin/leaderboard/reveal', {
                      method: 'POST',
                      body: { visible: !snapshot.marketState.leaderboardVisible },
                    }),
                  snapshot.marketState.leaderboardVisible ? 'Leaderboard hidden.' : 'Leaderboard revealed.',
                )
              }
            >
              {snapshot.marketState.leaderboardVisible ? 'Hide Leaderboard' : 'Reveal Leaderboard'}
            </button>
          </MarketPanel>
        </div>

        <div className="admin-column admin-column--center">
          <MarketPanel eyebrow="Narrative Engine" title="News Trigger" className="narrative-panel">
            <label>
              Headline
              <input value={newsHeadline} onChange={(event) => setNewsHeadline(event.target.value)} />
            </label>
            <label>
              Detail
              <textarea value={newsDetail} onChange={(event) => setNewsDetail(event.target.value)} rows={3} />
            </label>
            <div className="impact-builder">
              <select value={impactTicker} onChange={(event) => setImpactTicker(event.target.value)}>
                {snapshot.stocks.map((stock) => (
                  <option key={stock.id} value={stock.ticker}>
                    {stock.ticker}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={impactMagnitude}
                onChange={(event) => setImpactMagnitude(Number(event.target.value))}
              />
              <button
                className="ghost-button"
                onClick={() =>
                  setImpacts((current) => [...current, { ticker: impactTicker, magnitudePct: impactMagnitude }])
                }
              >
                Add Impact
              </button>
            </div>
            <div className="tag-row">
              {impacts.map((impact, index) => (
                <button
                  key={`${impact.ticker}-${index}`}
                  className="tag-chip"
                  onClick={() => setImpacts((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                >
                  {impact.ticker} {impact.magnitudePct > 0 ? '+' : ''}
                  {impact.magnitudePct}%
                </button>
              ))}
            </div>
            <div className="preview-card">
              <p>Price preview</p>
              {pricePreview.length ? (
                pricePreview.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)
              ) : (
                <span>Add at least one impact to preview the shock.</span>
              )}
            </div>
            <button
              className="primary-button"
              onClick={() =>
                void runAction(
                  () =>
                    request('/api/admin/news', {
                      method: 'POST',
                      body: { headline: newsHeadline, detail: newsDetail, impacts },
                    }),
                  'News event broadcast.',
                )
              }
            >
              Broadcast News
            </button>
          </MarketPanel>

          <div className="admin-duo">
            <MarketPanel eyebrow="Shock Tool" title="Direct Price Adjustment" className="shock-panel">
              <label>
                Stock
                <select value={shockTicker} onChange={(event) => setShockTicker(event.target.value)}>
                  {snapshot.stocks.map((stock) => (
                    <option key={stock.id} value={stock.ticker}>
                      {stock.ticker}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Magnitude (%)
                <input
                  type="number"
                  value={shockMagnitude}
                  onChange={(event) => setShockMagnitude(Number(event.target.value))}
                />
              </label>
              <button
                className="ghost-button"
                onClick={() =>
                  void runAction(
                    () =>
                      request('/api/admin/shock', {
                        method: 'POST',
                        body: { ticker: shockTicker, magnitudePct: shockMagnitude },
                      }),
                    'Direct shock applied.',
                  )
                }
              >
                Fire Shock
              </button>
            </MarketPanel>

            <MarketPanel eyebrow="Broadcast" title="Floor Message" className="broadcast-panel">
              <textarea
                rows={5}
                value={broadcastMessage}
                onChange={(event) => setBroadcastMessage(event.target.value)}
                placeholder="Broadcast plain-text narrative to every participant."
              />
              <button
                className="primary-button"
                onClick={() =>
                  void runAction(
                    () => request('/api/admin/broadcast', { method: 'POST', body: { message: broadcastMessage } }),
                    'Broadcast sent.',
                  )
                }
              >
                Send Broadcast
              </button>
            </MarketPanel>
          </div>

          <MarketPanel eyebrow="Import" title="Participants from CSV" className="import-panel">
            <textarea rows={7} value={csv} onChange={(event) => setCsv(event.target.value)} />
            <button
              className="ghost-button"
              onClick={() =>
                void runAction(
                  async () => {
                    const result = await request<{ importedCount: number; usernames: string[] }>(
                      '/api/admin/users/import',
                      {
                        method: 'POST',
                        body: { csv },
                      },
                    );
                    setStatusMessage(`Imported ${result.importedCount} users.`);
                  },
                  'Users imported.',
                )
              }
            >
              Import CSV
            </button>
          </MarketPanel>
        </div>

        <div className="admin-column admin-column--right">
          <MarketPanel
            eyebrow="Room Monitor"
            title="Leaderboard"
            aside={<span className="session-chip">{participants.length} desks</span>}
            className="monitor-panel"
          >
            <div className="podium-strip">
              {topParticipants.map((participant) => (
                <div key={participant.userId} className="podium-card">
                  <span>#{participant.rank}</span>
                  <strong>{participant.displayName}</strong>
                  <p>{formatCurrency(participant.portfolioValue)}</p>
                </div>
              ))}
            </div>
            <div className="leaderboard-list">
              {participants.slice(0, 12).map((participant) => (
                <article key={participant.userId} className="leaderboard-row">
                  <div className="leaderboard-row__meta">
                    <span className="leaderboard-rank">#{participant.rank}</span>
                    <h3>{participant.displayName}</h3>
                    <span>{participant.tradeCount} trades</span>
                  </div>
                  <div className="leaderboard-row__value">
                    <strong>{formatCurrency(participant.portfolioValue)}</strong>
                    <span>{formatCurrency(participant.cashBalance)} cash</span>
                  </div>
                </article>
              ))}
            </div>
          </MarketPanel>
        </div>
      </section>
    </main>
  );
};
