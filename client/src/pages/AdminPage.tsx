import { useEffect, useState } from 'react';
import type { LeaderboardEntryDto, MarketSnapshotDto, StockDto } from '../../../src/shared/contracts.js';
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
  const [csv, setCsv] = useState('username,password,displayName,role\nparticipant01,market-ready,Participant 01,PARTICIPANT');
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

  const pricePreview = impacts.map((impact) => {
    const stock = snapshot.stocks.find((item) => item.ticker === impact.ticker);
    if (!stock) return null;
    const nextPrice = stock.currentPrice * (1 + impact.magnitudePct / 100);
    return `${impact.ticker}: ${formatCurrency(stock.currentPrice)} -> ${formatCurrency(nextPrice)}`;
  });

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
      <header className="terminal-topbar">
        <div>
          <p className="market-panel__eyebrow">Admin Control</p>
          <h1>{session.user?.displayName}</h1>
        </div>
        <div className="metric-row">
          <div className="metric-pill">
            <span>Round</span>
            <strong>{snapshot.marketState.currentRoundName ?? 'Not started'}</strong>
          </div>
          <div className={`metric-pill ${connected ? 'metric-pill--good' : 'metric-pill--warn'}`}>
            <span>Connection</span>
            <strong>{connected ? 'Live' : 'Reconnecting'}</strong>
          </div>
          <div className="metric-pill">
            <span>Leaderboard</span>
            <strong>{snapshot.marketState.leaderboardVisible ? 'Visible' : 'Hidden'}</strong>
          </div>
          <button className="ghost-button" onClick={() => void onLogout()}>
            Logout
          </button>
        </div>
      </header>

      {statusMessage ? <p className="status-banner status-banner--good">{statusMessage}</p> : null}
      {errorMessage ? <p className="status-banner status-banner--bad">{errorMessage}</p> : null}

      <section className="admin-grid">
        <MarketPanel eyebrow="Round Control" title="Start / End" className="admin-grid__rounds">
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
                  'Round started.',
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

        <MarketPanel eyebrow="Narrative Event" title="News Trigger" className="admin-grid__news">
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
            <p>Preview</p>
            {pricePreview.length ? (
              pricePreview.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)
            ) : (
              <span>Add at least one impact.</span>
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

        <MarketPanel eyebrow="Shock Tool" title="Direct Price Adjustment" className="admin-grid__shock">
          <label>
            Stock
            <select value={shockTicker} onChange={(event) => setShockTicker(event.target.value)}>
              {snapshot.stocks.map((stock: StockDto) => (
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

        <MarketPanel eyebrow="Broadcast" title="Free Text Narrative" className="admin-grid__broadcast">
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

        <MarketPanel eyebrow="Safety" title="Emergency Controls" className="admin-grid__safety">
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
                snapshot.marketState.leaderboardVisible
                  ? 'Leaderboard hidden.'
                  : 'Leaderboard revealed.',
              )
            }
          >
            {snapshot.marketState.leaderboardVisible ? 'Hide Leaderboard' : 'Reveal Leaderboard'}
          </button>
        </MarketPanel>

        <MarketPanel eyebrow="Import" title="Participants from CSV" className="admin-grid__import">
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

        <MarketPanel eyebrow="Participant Monitor" title="Live Rankings" className="admin-grid__monitor">
          <div className="leaderboard-table">
            {participants.slice(0, 12).map((participant) => (
              <article key={participant.userId} className="leaderboard-row">
                <div>
                  <p>#{participant.rank}</p>
                  <h3>{participant.displayName}</h3>
                </div>
                <div>
                  <strong>{formatCurrency(participant.portfolioValue)}</strong>
                  <span>{participant.tradeCount} trades</span>
                </div>
              </article>
            ))}
          </div>
        </MarketPanel>
      </section>
    </main>
  );
};
