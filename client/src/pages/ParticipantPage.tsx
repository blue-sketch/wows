import { useEffect, useState } from 'react';
import type {
  MarketSnapshotDto,
  PortfolioDto,
  StockDto,
  TradeResponseDto,
} from '../../../src/shared/contracts.js';
import { Sparkline } from '../components/Sparkline.js';
import type { UserSessionState } from '../App.js';
import '../styles/participant.css';

interface ParticipantPageProps {
  session: UserSessionState;
  snapshot: MarketSnapshotDto;
  portfolio: PortfolioDto | null;
  history: Record<string, number[]>;
  connected: boolean;
  onLogout: () => Promise<void>;
  onTrade: (side: 'buy' | 'sell', stockId: number, quantity: number) => Promise<TradeResponseDto>;
}

/* ── Formatters ──────────────────────────────── */
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);

const formatCurrencyShort = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

const formatSignedCurrency = (value: number) => `${value >= 0 ? '+' : '-'}${formatCurrency(Math.abs(value))}`;

const formatSignedPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;


const describeMomentum = (value: number) => {
  if (value >= 4) return 'Momentum bid';
  if (value >= 0) return 'Constructive';
  if (value <= -4) return 'Heavy pressure';
  return 'Soft tone';
};

/* ── Portfolio helpers ────────────────────────── */
const computeOptimisticPortfolio = (
  portfolio: PortfolioDto,
  stock: StockDto,
  side: 'buy' | 'sell',
  quantity: number,
): PortfolioDto => {
  const price = stock.currentPrice;
  const delta = price * quantity;
  const holdings = [...portfolio.holdings];
  const existingIndex = holdings.findIndex((h) => h.stockId === stock.id);
  const existing = existingIndex >= 0 ? holdings[existingIndex] : null;

  if (side === 'buy') {
    if (existing) {
      const nextQty = existing.quantity + quantity;
      const weightedAvg = ((existing.avgBuyPrice ?? price) * existing.quantity + price * quantity) / nextQty;
      holdings[existingIndex] = {
        ...existing, quantity: nextQty, avgBuyPrice: weightedAvg, marketPrice: price,
        marketValue: nextQty * price, unrealizedPnl: nextQty * price - nextQty * weightedAvg,
      };
    } else {
      holdings.push({
        stockId: stock.id, ticker: stock.ticker, companyName: stock.companyName,
        quantity, avgBuyPrice: price, marketPrice: price, marketValue: quantity * price, unrealizedPnl: 0,
      });
    }
  } else if (existing) {
    const nextQty = Math.max(existing.quantity - quantity, 0);
    if (nextQty === 0) { holdings.splice(existingIndex, 1); }
    else {
      holdings[existingIndex] = {
        ...existing, quantity: nextQty, marketPrice: price, marketValue: nextQty * price,
        unrealizedPnl: nextQty * price - nextQty * (existing.avgBuyPrice ?? price),
      };
    }
  }

  const cashBalance = side === 'buy' ? portfolio.cashBalance - delta : portfolio.cashBalance + delta;
  const holdingsValue = holdings.reduce((t, h) => t + h.marketValue, 0);
  return { ...portfolio, cashBalance, totalValue: cashBalance + holdingsValue, holdings };
};

const revaluePortfolio = (portfolio: PortfolioDto | null, priceMap: Record<string, number>): PortfolioDto | null => {
  if (!portfolio) return null;
  const holdings = portfolio.holdings.map((h) => {
    const marketPrice = priceMap[h.ticker] ?? h.marketPrice;
    const marketValue = marketPrice * h.quantity;
    const unrealizedPnl = marketValue - h.quantity * (h.avgBuyPrice ?? marketPrice);
    return { ...h, marketPrice, marketValue, unrealizedPnl };
  });
  const holdingsValue = holdings.reduce((t, h) => t + h.marketValue, 0);
  return { ...portfolio, holdings, totalValue: portfolio.cashBalance + holdingsValue };
};

/* ── Icons ────────────────────────────────────── */
const Icon = {
  ChartUp: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  Wallet: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
    </svg>
  ),
  Newspaper: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <line x1="10" y1="6" x2="18" y2="6" /><line x1="10" y1="10" x2="18" y2="10" /><line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  ),
  ArrowUpDown: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="3" x2="12" y2="21" /><polyline points="18 15 12 21 6 15" /><polyline points="6 9 12 3 18 9" />
    </svg>
  ),
  Logout: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
};

/* ════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════ */

export const ParticipantPage = ({
  session,
  snapshot,
  portfolio,
  history,
  connected,
  onLogout,
  onTrade,
}: ParticipantPageProps) => {
  const [selectedTicker, setSelectedTicker] = useState(snapshot.stocks[0]?.ticker ?? '');
  const [quantity, setQuantity] = useState(10);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [pending, setPending] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [optimisticPortfolio, setOptimisticPortfolio] = useState<PortfolioDto | null>(portfolio);
  const [tradeFlash, setTradeFlash] = useState<'ok' | 'err' | null>(null);

  useEffect(() => { if (!selectedTicker && snapshot.stocks[0]) setSelectedTicker(snapshot.stocks[0].ticker); }, [selectedTicker, snapshot.stocks]);
  useEffect(() => { setOptimisticPortfolio(portfolio); }, [portfolio]);
  useEffect(() => { if (tradeFlash) { const t = setTimeout(() => setTradeFlash(null), 1800); return () => clearTimeout(t); } }, [tradeFlash]);

  /* ── Derived state ── */
  const selectedStock = snapshot.stocks.find((s) => s.ticker === selectedTicker) ?? snapshot.stocks[0];
  const selectedHistory = selectedStock ? history[selectedStock.ticker] ?? [selectedStock.currentPrice] : [];
  const previousTickPrice = selectedHistory.length > 1 ? selectedHistory[selectedHistory.length - 2] : selectedStock?.basePrice ?? selectedStock?.currentPrice ?? 0;
  const tickDelta = selectedStock ? selectedStock.currentPrice - previousTickPrice : 0;
  const sessionDelta = selectedStock ? selectedStock.currentPrice - selectedStock.basePrice : 0;
  const sessionDeltaPct = selectedStock ? (sessionDelta / (selectedStock.basePrice || 1)) * 100 : 0;
  const displayPortfolio = revaluePortfolio(optimisticPortfolio ?? portfolio, snapshot.prices);
  const leaderboardEntry = snapshot.leaderboard.find((e) => e.userId === session.user?.userId) ?? null;
  const selectedHolding = displayPortfolio?.holdings.find((h) => h.stockId === selectedStock?.id) ?? null;
  const estimatedValue = selectedStock ? selectedStock.currentPrice * quantity : 0;
  const projectedCashBalance = displayPortfolio ? displayPortfolio.cashBalance + (side === 'buy' ? -estimatedValue : estimatedValue) : 0;
  const projectedQuantity = side === 'buy' ? (selectedHolding?.quantity ?? 0) + quantity : Math.max((selectedHolding?.quantity ?? 0) - quantity, 0);
  const canAfford = side === 'buy' ? (displayPortfolio?.cashBalance ?? 0) >= estimatedValue : true;
  const canSell = side === 'sell' ? (selectedHolding?.quantity ?? 0) >= quantity : true;
  const marketOpen = !snapshot.marketState.tradingHalted && snapshot.marketState.roundStatus === 'ACTIVE';
  const tradeDisabled = pending || !selectedStock || quantity < 1 || !marketOpen || !selectedStock.isTradeable || (side === 'buy' ? !canAfford : !canSell);
  const holdings = [...(displayPortfolio?.holdings ?? [])].sort((a, b) => b.marketValue - a.marketValue);
  const projectedMarketValue = selectedStock ? selectedStock.currentPrice * projectedQuantity : 0;
  const projectedExposure = displayPortfolio && projectedMarketValue ? (projectedMarketValue / (displayPortfolio.totalValue || 1)) * 100 : 0;

  const tradeGuidance = !marketOpen
    ? 'Trading is paused until the round goes live.'
    : !selectedStock?.isTradeable
      ? 'This instrument is currently restricted.'
      : side === 'buy'
        ? canAfford ? 'Order routed against live quote. Review before sending.' : 'Insufficient buying power.'
        : canSell ? `You can exit up to ${selectedHolding?.quantity ?? 0} shares.` : 'Exceeds current position.';

  const liveTime = snapshot.marketState.lastTickAt
    ? new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(snapshot.marketState.lastTickAt))
    : '—';

  const newsTimeFmt = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' });

  const tradingStatus = snapshot.marketState.tradingHalted ? 'halted' : marketOpen ? 'open' : 'closed';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!displayPortfolio || !selectedStock) return;
    setTradeError(null);
    setPending(true);
    const prev = displayPortfolio;
    setOptimisticPortfolio(computeOptimisticPortfolio(displayPortfolio, selectedStock, side, quantity));
    try {
      await onTrade(side, selectedStock.id, quantity);
      setTradeFlash('ok');
    } catch (error) {
      setOptimisticPortfolio(prev);
      setTradeError(error instanceof Error ? error.message : 'Trade failed.');
      setTradeFlash('err');
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="pp-shell">
      {/* ── Ambient ── */}
      <div className="pp-ambient" aria-hidden="true">
        <div className="pp-ambient__glow pp-ambient__glow--warm" />
        <div className="pp-ambient__glow pp-ambient__glow--cool" />
      </div>

      {/* ── Header ── */}
      <header className="pp-header">
        <div className="pp-header__brand">
          <div className="pp-header__mark">
            <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
              <path d="M2 20L11 2L20 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.5 14H16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <span className="pp-header__label">Venturers Exchange</span>
            <h1 className="pp-header__title">Trading Terminal</h1>
          </div>
        </div>

        <div className="pp-header__stats">
          <div className="pp-stat"><span>Trader</span><strong>{session.user?.displayName}</strong></div>
          <div className="pp-stat"><span>Round</span><strong>{snapshot.marketState.currentRoundName ?? '—'}</strong></div>
          <div className="pp-stat"><span>Rank</span><strong>{leaderboardEntry ? `#${leaderboardEntry.rank}` : '—'}</strong></div>
          <div className="pp-stat"><span>Net Liq</span><strong>{formatCurrencyShort(displayPortfolio?.totalValue ?? 0)}</strong></div>
          <div className="pp-stat"><span>Cash</span><strong>{formatCurrencyShort(displayPortfolio?.cashBalance ?? 0)}</strong></div>
          <div className={`pp-stat pp-stat--${tradingStatus}`}><span>Status</span><strong>{tradingStatus === 'open' ? 'Open' : tradingStatus === 'halted' ? 'Halted' : 'Closed'}</strong></div>
          <div className="pp-stat"><span>Tick</span><strong>{liveTime}</strong></div>
        </div>

        <div className="pp-header__right">
          <div className={`pp-conn ${connected ? '' : 'pp-conn--warn'}`}>
            <span className="pp-conn__dot" />
            <span>{connected ? 'Live' : '...'}</span>
          </div>
          <button className="pp-btn pp-btn--ghost pp-btn--sm" onClick={() => void onLogout()}>
            <Icon.Logout /><span>Logout</span>
          </button>
        </div>
      </header>

      {/* ── Workspace (fills viewport) ── */}
      <div className="pp-workspace">
        {/* ╔═══ LEFT: WATCHLIST ═══╗ */}
        <section className="pp-watchlist">
          <header className="pp-watchlist__header">
            <div>
              <span className="pp-eyebrow">Market Tape</span>
              <h2 className="pp-panel-title">Watchlist</h2>
            </div>
            <span className="pp-badge">{snapshot.stocks.length}</span>
          </header>
          <div className="pp-watchlist__list">
            {snapshot.stocks.map((stock) => {
              const baseDeltaPct = ((stock.currentPrice - stock.basePrice) / (stock.basePrice || 1)) * 100;
              const isSelected = selectedStock?.ticker === stock.ticker;
              const holding = displayPortfolio?.holdings.find(h => h.stockId === stock.id);
              return (
                <button key={stock.ticker}
                  className={`pp-wl-row ${isSelected ? 'pp-wl-row--active' : ''}`}
                  onClick={() => setSelectedTicker(stock.ticker)}>
                  <div className="pp-wl-row__left">
                    <span className="pp-wl-row__ticker">{stock.ticker}</span>
                    <span className="pp-wl-row__name">{stock.companyName}</span>
                  </div>
                  <div className="pp-wl-row__right">
                    <strong>{formatCurrency(stock.currentPrice)}</strong>
                    <span className={`pp-pct ${baseDeltaPct >= 0 ? 'pp-pct--up' : 'pp-pct--down'}`}>
                      {formatSignedPercent(baseDeltaPct)}
                    </span>
                  </div>
                  {holding && <span className="pp-wl-row__held" title={`Holding ${holding.quantity} shares`}>{holding.quantity}</span>}
                </button>
              );
            })}
          </div>
        </section>

        {/* ╔═══ CENTER: CHART + POSITIONS + NEWS ═══╗ */}
        <section className="pp-center">
          {/* ── Stock detail + Chart ── */}
          <div className="pp-chart-zone">
            <header className="pp-chart-zone__header">
              <div className="pp-chart-zone__stock">
                <div>
                  <span className="pp-eyebrow">{selectedStock?.sector ?? 'Market'}</span>
                  <h2 className="pp-panel-title">{selectedStock?.companyName ?? 'Select a stock'}</h2>
                </div>
                <div className="pp-chart-zone__pills">
                  <span className="pp-ticker-pill">{selectedStock?.ticker}</span>
                  <span className={`pp-status-chip pp-status-chip--${selectedStock?.isTradeable ? 'ok' : 'no'}`}>
                    {selectedStock?.isTradeable ? 'Tradeable' : 'Restricted'}
                  </span>
                </div>
              </div>
              <div className="pp-chart-zone__price">
                <strong className="pp-price-big">{selectedStock ? formatCurrency(selectedStock.currentPrice) : '—'}</strong>
                <span className={`pp-pct-lg ${sessionDelta >= 0 ? 'pp-pct--up' : 'pp-pct--down'}`}>
                  {formatSignedCurrency(tickDelta)} tick · {formatSignedPercent(sessionDeltaPct)} session
                </span>
              </div>
            </header>
            <div className="pp-chart-zone__canvas">
              <Sparkline values={selectedStock ? selectedHistory : []} />
            </div>
            <div className="pp-insight-strip">
              <div className="pp-insight">
                <span>Base</span>
                <strong>{formatCurrency(selectedStock?.basePrice ?? 0)}</strong>
              </div>
              <div className="pp-insight">
                <span>Bias</span>
                <strong>{describeMomentum(sessionDeltaPct)}</strong>
              </div>
              <div className="pp-insight">
                <span>Supply</span>
                <strong>{(selectedStock?.availableSupply ?? 0).toLocaleString()}</strong>
              </div>
              <div className="pp-insight">
                <span>Vol</span>
                <strong>{selectedStock?.volatilityPct ?? 0}%</strong>
              </div>
              <div className="pp-insight">
                <span>Held</span>
                <strong>{selectedHolding?.quantity ?? 0}</strong>
              </div>
              <div className={`pp-insight ${(selectedHolding?.unrealizedPnl ?? 0) >= 0 ? 'pp-insight--up' : 'pp-insight--down'}`}>
                <span>P&L</span>
                <strong>{formatSignedCurrency(selectedHolding?.unrealizedPnl ?? 0)}</strong>
              </div>
            </div>
          </div>

          {/* ── Bottom: Positions + News ── */}
          <div className="pp-bottom-duo">
            {/* Positions */}
            <div className="pp-positions">
              <header className="pp-panel-header">
                <div className="pp-panel-header__left">
                  <span className="pp-panel-icon"><Icon.Wallet /></span>
                  <div><span className="pp-eyebrow">Book</span><h2 className="pp-panel-title">Positions</h2></div>
                </div>
                <span className="pp-badge">{holdings.length}</span>
              </header>
              <div className="pp-positions__body">
                {holdings.length ? (
                  <div className="pp-pos-table">
                    <div className="pp-pos-table__head">
                      <span>Name</span><span>Qty</span><span>Value</span><span>P&L</span>
                    </div>
                    {holdings.map((h) => (
                      <button key={h.stockId} className={`pp-pos-table__row ${selectedTicker === h.ticker ? 'pp-pos-table__row--active' : ''}`}
                        onClick={() => setSelectedTicker(h.ticker)}>
                        <div className="pp-pos-table__name">
                          <strong>{h.ticker}</strong>
                          <span>{h.companyName}</span>
                        </div>
                        <span>{h.quantity}</span>
                        <span>{formatCurrencyShort(h.marketValue)}</span>
                        <span className={h.unrealizedPnl >= 0 ? 'pp-pct--up' : 'pp-pct--down'}>
                          {formatSignedCurrency(h.unrealizedPnl)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="pp-empty">No holdings yet. Start trading to build your book.</p>
                )}
              </div>
            </div>

            {/* News */}
            <div className="pp-news">
              <header className="pp-panel-header">
                <div className="pp-panel-header__left">
                  <span className="pp-panel-icon"><Icon.Newspaper /></span>
                  <div><span className="pp-eyebrow">Wire</span><h2 className="pp-panel-title">News Feed</h2></div>
                </div>
                <span className="pp-badge">{snapshot.recentNews.length}</span>
              </header>
              <div className="pp-news__body">
                {snapshot.recentNews.length ? (
                  snapshot.recentNews.slice().reverse().map((item) => (
                    <article key={item.id} className="pp-news-item">
                      <span className="pp-news-item__time">{newsTimeFmt.format(new Date(item.triggeredAt))}</span>
                      <div>
                        <strong>{item.headline}</strong>
                        {item.detail && <p>{item.detail}</p>}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="pp-empty">No events yet. Watch for market-moving news.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ╔═══ RIGHT: ORDER TICKET ═══╗ */}
        <section className={`pp-order ${tradeFlash === 'ok' ? 'pp-order--flash-ok' : tradeFlash === 'err' ? 'pp-order--flash-err' : ''}`}>
          <header className="pp-panel-header">
            <div className="pp-panel-header__left">
              <span className="pp-panel-icon"><Icon.ArrowUpDown /></span>
              <div><span className="pp-eyebrow">Execution</span><h2 className="pp-panel-title">Order Ticket</h2></div>
            </div>
            <span className="pp-badge">{selectedHolding?.quantity ?? 0} held</span>
          </header>

          {selectedStock ? (
            <form className="pp-order__body" onSubmit={handleSubmit}>
              {/* Buy / Sell toggle */}
              <div className="pp-side-toggle">
                <button type="button" className={`pp-side-btn pp-side-btn--buy ${side === 'buy' ? 'pp-side-btn--active' : ''}`} onClick={() => setSide('buy')}>Buy</button>
                <button type="button" className={`pp-side-btn pp-side-btn--sell ${side === 'sell' ? 'pp-side-btn--active' : ''}`} onClick={() => setSide('sell')}>Sell</button>
              </div>

              {/* Spotlight */}
              <div className={`pp-order-spotlight pp-order-spotlight--${side}`}>
                <div><span className="pp-order-spotlight__ticker">{selectedStock.ticker}</span><strong>{formatCurrency(selectedStock.currentPrice)}</strong></div>
                <span>Exposure: {projectedExposure ? `${projectedExposure.toFixed(1)}%` : '—'}</span>
              </div>

              {/* Qty presets */}
              <div className="pp-qty-presets">
                {[5, 10, 25, 50].map((p) => (
                  <button key={p} type="button" className={`pp-preset ${quantity === p ? 'pp-preset--active' : ''}`} onClick={() => setQuantity(p)}>{p}</button>
                ))}
              </div>

              {/* Qty input */}
              <div className="pp-field">
                <label className="pp-field__label">Quantity</label>
                <input className="pp-input" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
              </div>

              {/* Estimates */}
              <div className="pp-estimate-grid">
                <div className="pp-estimate"><span>Notional</span><strong>{formatCurrencyShort(estimatedValue)}</strong></div>
                <div className="pp-estimate"><span>Cash after</span><strong>{formatCurrencyShort(projectedCashBalance)}</strong></div>
                <div className="pp-estimate"><span>Position</span><strong>{projectedQuantity} sh</strong></div>
                <div className="pp-estimate"><span>State</span><strong className={marketOpen ? 'pp-pct--up' : ''}>{marketOpen ? 'Ready' : 'Paused'}</strong></div>
              </div>

              {/* Guidance */}
              <p className={`pp-guidance ${tradeDisabled && !pending ? 'pp-guidance--warn' : ''}`}>{tradeGuidance}</p>

              {tradeError && <p className="pp-trade-err">{tradeError}</p>}

              {/* CTA */}
              <button className={`pp-btn pp-btn--cta pp-btn--${side}`} type="submit" disabled={tradeDisabled}>
                {pending ? 'Routing...' : `Send ${side} order`}
              </button>
            </form>
          ) : (
            <div className="pp-order__body"><p className="pp-empty">Select a stock to trade.</p></div>
          )}
        </section>
      </div>
    </main>
  );
};
