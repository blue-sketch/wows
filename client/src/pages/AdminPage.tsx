import { useEffect, useState } from 'react';
import type { LeaderboardEntryDto, MarketSnapshotDto } from '../../../src/shared/contracts.js';
import { request } from '../api.js';
import type { UserSessionState } from '../App.js';
import '../styles/admin.css';

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

const formatCurrencyShort = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

const formatSignedPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

/* ── Inline icon components ──────────────────── */
const Icon = {
  User: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7"/></svg>
  ),
  Activity: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  ),
  Clock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  ),
  Shield: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  ),
  Zap: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
  ),
  Send: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
  ),
  Upload: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
  ),
  ArrowRight: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
  ),
  X: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  ),
  Eye: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  ),
  EyeOff: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
  ),
  Logout: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
  ),
};

/* ─── Reusable panel wrapper ─────────────────── */
const Panel = ({
  eyebrow,
  title,
  aside,
  icon,
  className = '',
  children,
}: {
  eyebrow: string;
  title: string;
  aside?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) => (
  <section className={`ap-panel ${className}`}>
    <header className="ap-panel__header">
      <div className="ap-panel__header-left">
        {icon && <span className="ap-panel__icon">{icon}</span>}
        <div>
          <span className="ap-eyebrow">{eyebrow}</span>
          <h2 className="ap-panel__title">{title}</h2>
        </div>
      </div>
      {aside && <div className="ap-panel__aside">{aside}</div>}
    </header>
    <div className="ap-panel__body">{children}</div>
  </section>
);

/* ════════════════════════════════════════════════
   MAIN ADMIN COMPONENT
   ════════════════════════════════════════════════ */

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
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [onRefreshParticipants]);

  // Auto-dismiss status/error messages
  useEffect(() => {
    if (statusMessage) {
      const t = setTimeout(() => setStatusMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [statusMessage]);

  useEffect(() => {
    if (errorMessage) {
      const t = setTimeout(() => setErrorMessage(null), 8000);
      return () => clearTimeout(t);
    }
  }, [errorMessage]);

  /* ── Derived data ── */
  const marketOpen =
    !snapshot.marketState.tradingHalted && snapshot.marketState.roundStatus === 'ACTIVE';
  const tradingStatus = snapshot.marketState.tradingHalted
    ? 'halted'
    : marketOpen
      ? 'open'
      : 'closed';

  const pricePreview = impacts
    .map((impact) => {
      const stock = snapshot.stocks.find((item) => item.ticker === impact.ticker);
      if (!stock) return null;
      const nextPrice = stock.currentPrice * (1 + impact.magnitudePct / 100);
      return { ticker: impact.ticker, from: stock.currentPrice, to: nextPrice, pct: impact.magnitudePct };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const totalPortfolioValue = participants.reduce((total, p) => total + p.portfolioValue, 0);
  const totalTrades = participants.reduce((total, p) => total + p.tradeCount, 0);
  const marketBreadth = snapshot.stocks.filter((s) => s.currentPrice >= s.basePrice).length;
  const quoteDeck = [...snapshot.stocks].sort(
    (a, b) =>
      Math.abs((b.currentPrice - b.basePrice) / (b.basePrice || 1)) -
      Math.abs((a.currentPrice - a.basePrice) / (a.basePrice || 1)),
  );
  const topMover = quoteDeck[0];

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
    <main className="ap-shell">
      {/* ── Ambient ── */}
      <div className="ap-ambient" aria-hidden="true">
        <div className="ap-ambient__glow ap-ambient__glow--warm" />
        <div className="ap-ambient__glow ap-ambient__glow--cool" />
      </div>

      {/* ── Header ── */}
      <header className="ap-header">
        <div className="ap-header__brand">
          <div className="ap-header__mark">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M2 20L11 2L20 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.5 14H16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <span className="ap-header__name">Venturers Exchange</span>
            <h1 className="ap-header__title">Operations Desk</h1>
          </div>
        </div>

        <div className="ap-header__stats">
          <div className="ap-stat">
            <span>Operator</span>
            <strong>{session.user?.displayName}</strong>
          </div>
          <div className="ap-stat">
            <span>Round</span>
            <strong>{snapshot.marketState.currentRoundName ?? 'Not started'}</strong>
          </div>
          <div className={`ap-stat ap-stat--status ap-stat--${tradingStatus}`}>
            <span>Status</span>
            <strong>{tradingStatus === 'open' ? 'Open' : tradingStatus === 'halted' ? 'Halted' : 'Closed'}</strong>
          </div>
          <div className="ap-stat">
            <span>Board</span>
            <strong>{snapshot.marketState.leaderboardVisible ? 'Visible' : 'Hidden'}</strong>
          </div>
          <div className="ap-stat">
            <span>Desks</span>
            <strong>{participants.length}</strong>
          </div>
          <div className="ap-stat">
            <span>Version</span>
            <strong>{snapshot.marketState.eventVersion}</strong>
          </div>
        </div>

        <div className="ap-header__right">
          <div className={`ap-conn ${connected ? '' : 'ap-conn--warn'}`}>
            <span className="ap-conn__dot" />
            <span>{connected ? 'Control Live' : 'Reconnecting'}</span>
          </div>
          <button className="ap-btn ap-btn--ghost ap-btn--sm" onClick={() => void onLogout()}>
            <Icon.Logout />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* ── Signal strip ── */}
      <section className="ap-signals">
        <article className="ap-signal">
          <span className="ap-signal__label">Market Breadth</span>
          <strong className="ap-signal__value">{marketBreadth}/{snapshot.stocks.length}</strong>
          <p>Names above base price</p>
        </article>
        <article className="ap-signal">
          <span className="ap-signal__label">Aggregate Value</span>
          <strong className="ap-signal__value">{formatCurrencyShort(totalPortfolioValue)}</strong>
          <p>Total book value across all desks</p>
        </article>
        <article className="ap-signal">
          <span className="ap-signal__label">Executed Trades</span>
          <strong className="ap-signal__value">{totalTrades}</strong>
          <p>Running count from leaderboard</p>
        </article>
        <article className="ap-signal">
          <span className="ap-signal__label">Lead Mover</span>
          <strong className="ap-signal__value">{topMover?.ticker ?? '—'}</strong>
          <p>
            {topMover
              ? formatSignedPercent(((topMover.currentPrice - topMover.basePrice) / (topMover.basePrice || 1)) * 100)
              : 'No data'}
          </p>
        </article>
      </section>

      {/* ── Toast messages ── */}
      {statusMessage && (
        <div className="ap-toast ap-toast--ok">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)}><Icon.X /></button>
        </div>
      )}
      {errorMessage && (
        <div className="ap-toast ap-toast--err">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/></svg>
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)}><Icon.X /></button>
        </div>
      )}

      {/* ── Main workspace ── */}
      <div className="ap-workspace">
        {/* ── LEFT: Market & Controls ── */}
        <div className="ap-col ap-col--left">
          <Panel eyebrow="Market Pulse" title="Quote Deck" icon={<Icon.Activity />}
            aside={<span className="ap-badge">{snapshot.stocks.length} names</span>}>
            <div className="ap-quotes">
              {quoteDeck.map((stock) => {
                const deltaPct = ((stock.currentPrice - stock.basePrice) / (stock.basePrice || 1)) * 100;
                return (
                  <article key={stock.id} className="ap-quote-row">
                    <div className="ap-quote-row__meta">
                      <span className="ap-quote-row__ticker">{stock.ticker}</span>
                      <strong>{stock.companyName}</strong>
                      <span className="ap-quote-row__supply">{stock.availableSupply.toLocaleString()} avail</span>
                    </div>
                    <div className="ap-quote-row__price">
                      <strong>{formatCurrency(stock.currentPrice)}</strong>
                      <span className={`ap-pct ${deltaPct >= 0 ? 'ap-pct--up' : 'ap-pct--down'}`}>
                        {formatSignedPercent(deltaPct)}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </Panel>

          <Panel eyebrow="Round Control" title="Session Clock" icon={<Icon.Clock />}>
            <div className="ap-field">
              <label className="ap-field__label">Round</label>
              <select className="ap-select" value={roundId} onChange={(e) => setRoundId(Number(e.target.value))}>
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>{r.number}. {r.name}</option>
                ))}
              </select>
            </div>
            <div className="ap-btn-row">
              <button className="ap-btn ap-btn--primary"
                onClick={() => void runAction(() => request('/api/admin/round/start', { method: 'POST', body: { roundId } }), 'Round started.')}>
                <Icon.Zap /><span>Start Round</span>
              </button>
              <button className="ap-btn ap-btn--ghost"
                onClick={() => void runAction(() => request('/api/admin/round/end', { method: 'POST' }), 'Round ended.')}>
                End Round
              </button>
            </div>
          </Panel>

          <Panel eyebrow="Safety Layer" title="Emergency Controls" icon={<Icon.Shield />} className="ap-panel--danger-zone">
            <div className="ap-field">
              <label className="ap-field__label">Type HALT to confirm</label>
              <input className="ap-input" value={haltConfirmation} onChange={(e) => setHaltConfirmation(e.target.value)} placeholder="HALT" />
            </div>
            <div className="ap-btn-row">
              <button className="ap-btn ap-btn--danger"
                onClick={() => void runAction(() => request('/api/admin/halt', { method: 'POST', body: { halted: true, confirmation: haltConfirmation } }), 'Trading halted.')}>
                Halt Trading
              </button>
              <button className="ap-btn ap-btn--ghost"
                onClick={() => void runAction(() => request('/api/admin/halt', { method: 'POST', body: { halted: false } }), 'Trading resumed.')}>
                Resume
              </button>
            </div>
            <button className={`ap-btn ap-btn--outline ap-btn--full ${snapshot.marketState.leaderboardVisible ? 'ap-btn--active' : ''}`}
              onClick={() => void runAction(
                () => request('/api/admin/leaderboard/reveal', { method: 'POST', body: { visible: !snapshot.marketState.leaderboardVisible } }),
                snapshot.marketState.leaderboardVisible ? 'Leaderboard hidden.' : 'Leaderboard revealed.',
              )}>
              {snapshot.marketState.leaderboardVisible ? <><Icon.EyeOff /><span>Hide Leaderboard</span></> : <><Icon.Eye /><span>Reveal Leaderboard</span></>}
            </button>
          </Panel>
        </div>

        {/* ── CENTER: Narrative Tools ── */}
        <div className="ap-col ap-col--center">
          <Panel eyebrow="Narrative Engine" title="News Trigger" icon={<Icon.Zap />} className="ap-panel--narrative">
            <div className="ap-field">
              <label className="ap-field__label">Headline</label>
              <input className="ap-input" value={newsHeadline} onChange={(e) => setNewsHeadline(e.target.value)} placeholder="Breaking: Market-moving event..." />
            </div>
            <div className="ap-field">
              <label className="ap-field__label">Detail</label>
              <textarea className="ap-textarea" value={newsDetail} onChange={(e) => setNewsDetail(e.target.value)} rows={2} placeholder="Optional context for the event..." />
            </div>

            <div className="ap-impact-builder">
              <span className="ap-field__label">Impact Builder</span>
              <div className="ap-impact-builder__row">
                <select className="ap-select" value={impactTicker} onChange={(e) => setImpactTicker(e.target.value)}>
                  {snapshot.stocks.map((s) => (
                    <option key={s.id} value={s.ticker}>{s.ticker}</option>
                  ))}
                </select>
                <input className="ap-input ap-input--narrow" type="number" value={impactMagnitude} onChange={(e) => setImpactMagnitude(Number(e.target.value))} />
                <span className="ap-impact-builder__unit">%</span>
                <button className="ap-btn ap-btn--ghost ap-btn--sm" onClick={() => setImpacts((c) => [...c, { ticker: impactTicker, magnitudePct: impactMagnitude }])}>
                  Add
                </button>
              </div>
            </div>

            {impacts.length > 0 && (
              <div className="ap-tags">
                {impacts.map((imp, i) => (
                  <button key={`${imp.ticker}-${i}`} className={`ap-tag ${imp.magnitudePct >= 0 ? 'ap-tag--up' : 'ap-tag--down'}`}
                    onClick={() => setImpacts((c) => c.filter((_, idx) => idx !== i))}>
                    {imp.ticker} {imp.magnitudePct > 0 ? '+' : ''}{imp.magnitudePct}%
                    <Icon.X />
                  </button>
                ))}
              </div>
            )}

            {pricePreview.length > 0 && (
              <div className="ap-preview">
                <span className="ap-field__label">Price Preview</span>
                {pricePreview.map((p) => (
                  <div key={p.ticker} className="ap-preview__row">
                    <span className="ap-preview__ticker">{p.ticker}</span>
                    <span>{formatCurrency(p.from)}</span>
                    <Icon.ArrowRight />
                    <strong className={p.pct >= 0 ? 'ap-pct--up' : 'ap-pct--down'}>{formatCurrency(p.to)}</strong>
                    <span className={`ap-pct ${p.pct >= 0 ? 'ap-pct--up' : 'ap-pct--down'}`}>
                      {p.pct > 0 ? '+' : ''}{p.pct}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button className="ap-btn ap-btn--primary ap-btn--full"
              onClick={() => void runAction(
                () => request('/api/admin/news', { method: 'POST', body: { headline: newsHeadline, detail: newsDetail, impacts } }),
                'News event broadcast.',
              )}>
              <Icon.Send /><span>Broadcast News</span>
            </button>
          </Panel>

          <div className="ap-duo">
            <Panel eyebrow="Shock Tool" title="Direct Price" icon={<Icon.Zap />}>
              <div className="ap-field">
                <label className="ap-field__label">Stock</label>
                <select className="ap-select" value={shockTicker} onChange={(e) => setShockTicker(e.target.value)}>
                  {snapshot.stocks.map((s) => (
                    <option key={s.id} value={s.ticker}>{s.ticker}</option>
                  ))}
                </select>
              </div>
              <div className="ap-field">
                <label className="ap-field__label">Magnitude (%)</label>
                <input className="ap-input" type="number" value={shockMagnitude} onChange={(e) => setShockMagnitude(Number(e.target.value))} />
              </div>
              <button className="ap-btn ap-btn--warning ap-btn--full"
                onClick={() => void runAction(
                  () => request('/api/admin/shock', { method: 'POST', body: { ticker: shockTicker, magnitudePct: shockMagnitude } }),
                  'Direct shock applied.',
                )}>
                <Icon.Zap /><span>Fire Shock</span>
              </button>
            </Panel>

            <Panel eyebrow="Broadcast" title="Floor Message" icon={<Icon.Send />}>
              <textarea className="ap-textarea" rows={3} value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Message to all participants..." />
              <button className="ap-btn ap-btn--primary ap-btn--full"
                onClick={() => void runAction(
                  () => request('/api/admin/broadcast', { method: 'POST', body: { message: broadcastMessage } }),
                  'Broadcast sent.',
                )}>
                <Icon.Send /><span>Send Broadcast</span>
              </button>
            </Panel>
          </div>

          <Panel eyebrow="Import" title="Participants from CSV" icon={<Icon.Upload />}>
            <textarea className="ap-textarea ap-textarea--mono" rows={4} value={csv}
              onChange={(e) => setCsv(e.target.value)} />
            <button className="ap-btn ap-btn--ghost ap-btn--full"
              onClick={() => void runAction(
                async () => {
                  const result = await request<{ importedCount: number; usernames: string[] }>(
                    '/api/admin/users/import', { method: 'POST', body: { csv } });
                  setStatusMessage(`Imported ${result.importedCount} users.`);
                },
                'Users imported.',
              )}>
              <Icon.Upload /><span>Import CSV</span>
            </button>
          </Panel>
        </div>

        {/* ── RIGHT: Leaderboard ── */}
        <div className="ap-col ap-col--right">
          <Panel eyebrow="Room Monitor" title="Leaderboard" icon={<Icon.User />}
            aside={<span className="ap-badge">{participants.length} desks</span>} className="ap-panel--monitor">
            {participants.length > 0 ? (
              <>
                <div className="ap-lb-top5">
                  {participants.slice(0, 5).map((p) => (
                    <div key={p.userId} className={`ap-lb-podium ap-lb-podium--r${Math.min(p.rank, 4)}`}>
                      <span className="ap-lb-podium__rank">#{p.rank}</span>
                      <strong className="ap-lb-podium__name">{p.displayName}</strong>
                      <span className="ap-lb-podium__val">{formatCurrencyShort(p.portfolioValue)}</span>
                    </div>
                  ))}
                </div>
                <div className="ap-lb-list">
                  {participants.slice(0, 15).map((p) => (
                    <article key={p.userId} className="ap-lb-row">
                      <span className="ap-lb-row__rank">#{p.rank}</span>
                      <div className="ap-lb-row__info">
                        <strong>{p.displayName}</strong>
                        <span>{p.tradeCount} trades</span>
                      </div>
                      <div className="ap-lb-row__vals">
                        <strong>{formatCurrency(p.portfolioValue)}</strong>
                        <span>{formatCurrencyShort(p.cashBalance)} cash</span>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="ap-lb-empty">
                <p>No participants yet. Import via CSV or wait for sign-ups.</p>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </main>
  );
};
