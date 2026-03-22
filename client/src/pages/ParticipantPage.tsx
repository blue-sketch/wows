import { useEffect, useState } from 'react';
import type {
  HoldingDto,
  MarketSnapshotDto,
  PortfolioDto,
  StockDto,
  TradeResponseDto,
} from '../../../src/shared/contracts.js';
import { MarketPanel } from '../components/MarketPanel.js';
import { Sparkline } from '../components/Sparkline.js';
import type { UserSessionState } from '../App.js';

interface ParticipantPageProps {
  session: UserSessionState;
  snapshot: MarketSnapshotDto;
  portfolio: PortfolioDto | null;
  history: Record<string, number[]>;
  connected: boolean;
  onLogout: () => Promise<void>;
  onTrade: (side: 'buy' | 'sell', stockId: number, quantity: number) => Promise<TradeResponseDto>;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);

const formatSignedCurrency = (value: number) => `${value >= 0 ? '+' : '-'}${formatCurrency(Math.abs(value))}`;

const formatSignedPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

const describeBreadth = (ratio: number) => {
  if (ratio >= 0.67) return 'Risk-on tape';
  if (ratio >= 0.4) return 'Balanced tape';
  return 'Defensive tape';
};

const describeMomentum = (value: number) => {
  if (value >= 4) return 'Momentum bid';
  if (value >= 0) return 'Constructive';
  if (value <= -4) return 'Heavy pressure';
  return 'Soft tone';
};

const computeOptimisticPortfolio = (
  portfolio: PortfolioDto,
  stock: StockDto,
  side: 'buy' | 'sell',
  quantity: number,
): PortfolioDto => {
  const price = stock.currentPrice;
  const delta = price * quantity;
  const holdings = [...portfolio.holdings];
  const existingIndex = holdings.findIndex((holding) => holding.stockId === stock.id);
  const existing = existingIndex >= 0 ? holdings[existingIndex] : null;

  if (side === 'buy') {
    if (existing) {
      const nextQuantity = existing.quantity + quantity;
      const weightedAverage =
        ((existing.avgBuyPrice ?? price) * existing.quantity + price * quantity) / nextQuantity;

      holdings[existingIndex] = {
        ...existing,
        quantity: nextQuantity,
        avgBuyPrice: weightedAverage,
        marketPrice: price,
        marketValue: nextQuantity * price,
        unrealizedPnl: nextQuantity * price - nextQuantity * weightedAverage,
      };
    } else {
      holdings.push({
        stockId: stock.id,
        ticker: stock.ticker,
        companyName: stock.companyName,
        quantity,
        avgBuyPrice: price,
        marketPrice: price,
        marketValue: quantity * price,
        unrealizedPnl: 0,
      });
    }
  } else if (existing) {
    const nextQuantity = Math.max(existing.quantity - quantity, 0);
    if (nextQuantity === 0) {
      holdings.splice(existingIndex, 1);
    } else {
      holdings[existingIndex] = {
        ...existing,
        quantity: nextQuantity,
        marketPrice: price,
        marketValue: nextQuantity * price,
        unrealizedPnl: nextQuantity * price - nextQuantity * (existing.avgBuyPrice ?? price),
      };
    }
  }

  const cashBalance = side === 'buy' ? portfolio.cashBalance - delta : portfolio.cashBalance + delta;
  const holdingsValue = holdings.reduce((total, holding) => total + holding.marketValue, 0);

  return {
    ...portfolio,
    cashBalance,
    totalValue: cashBalance + holdingsValue,
    holdings,
  };
};

const revaluePortfolio = (portfolio: PortfolioDto | null, priceMap: Record<string, number>): PortfolioDto | null => {
  if (!portfolio) return null;

  const holdings = portfolio.holdings.map((holding) => {
    const marketPrice = priceMap[holding.ticker] ?? holding.marketPrice;
    const marketValue = marketPrice * holding.quantity;
    const unrealizedPnl = marketValue - holding.quantity * (holding.avgBuyPrice ?? marketPrice);

    return {
      ...holding,
      marketPrice,
      marketValue,
      unrealizedPnl,
    };
  });

  const holdingsValue = holdings.reduce((total, holding) => total + holding.marketValue, 0);

  return {
    ...portfolio,
    holdings,
    totalValue: portfolio.cashBalance + holdingsValue,
  };
};

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

  useEffect(() => {
    if (!selectedTicker && snapshot.stocks[0]) {
      setSelectedTicker(snapshot.stocks[0].ticker);
    }
  }, [selectedTicker, snapshot.stocks]);

  useEffect(() => {
    setOptimisticPortfolio(portfolio);
  }, [portfolio]);

  const selectedStock = snapshot.stocks.find((stock) => stock.ticker === selectedTicker) ?? snapshot.stocks[0];
  const selectedHistory = selectedStock ? history[selectedStock.ticker] ?? [selectedStock.currentPrice] : [];
  const previousTickPrice =
    selectedHistory.length > 1
      ? selectedHistory[selectedHistory.length - 2]
      : selectedStock?.basePrice ?? selectedStock?.currentPrice ?? 0;
  const tickDelta = selectedStock ? selectedStock.currentPrice - previousTickPrice : 0;
  const sessionDelta = selectedStock ? selectedStock.currentPrice - selectedStock.basePrice : 0;
  const sessionDeltaPct = selectedStock ? (sessionDelta / (selectedStock.basePrice || 1)) * 100 : 0;
  const displayPortfolio = revaluePortfolio(optimisticPortfolio ?? portfolio, snapshot.prices);
  const leaderboardEntry = snapshot.leaderboard.find((entry) => entry.userId === session.user?.userId) ?? null;
  const selectedHolding =
    displayPortfolio?.holdings.find((holding) => holding.stockId === selectedStock?.id) ?? null;
  const estimatedValue = selectedStock ? selectedStock.currentPrice * quantity : 0;
  const projectedCashBalance = displayPortfolio
    ? displayPortfolio.cashBalance + (side === 'buy' ? -estimatedValue : estimatedValue)
    : 0;
  const projectedQuantity =
    side === 'buy'
      ? (selectedHolding?.quantity ?? 0) + quantity
      : Math.max((selectedHolding?.quantity ?? 0) - quantity, 0);
  const canAfford = side === 'buy' ? (displayPortfolio?.cashBalance ?? 0) >= estimatedValue : true;
  const canSell = side === 'sell' ? (selectedHolding?.quantity ?? 0) >= quantity : true;
  const marketOpen =
    !snapshot.marketState.tradingHalted && snapshot.marketState.roundStatus === 'ACTIVE';
  const tradeDisabled =
    pending ||
    !selectedStock ||
    quantity < 1 ||
    !marketOpen ||
    !selectedStock.isTradeable ||
    (side === 'buy' ? !canAfford : !canSell);
  const holdings = [...(displayPortfolio?.holdings ?? [])].sort(
    (left, right) => right.marketValue - left.marketValue,
  );
  const strongestHolding =
    holdings.reduce<HoldingDto | null>(
      (best, holding) => (best === null || holding.unrealizedPnl > best.unrealizedPnl ? holding : best),
      null,
    ) ?? null;
  const breadthCount = snapshot.stocks.filter((stock) => stock.currentPrice >= stock.basePrice).length;
  const breadthRatio = snapshot.stocks.length ? breadthCount / snapshot.stocks.length : 0;
  const tapeDescription = describeBreadth(breadthRatio);
  const bestMover = [...snapshot.stocks].sort(
    (left, right) =>
      (right.currentPrice - right.basePrice) / (right.basePrice || 1) -
      (left.currentPrice - left.basePrice) / (left.basePrice || 1),
  )[0];
  const projectedMarketValue = selectedStock ? selectedStock.currentPrice * projectedQuantity : 0;
  const projectedExposure =
    displayPortfolio && projectedMarketValue
      ? (projectedMarketValue / (displayPortfolio.totalValue || 1)) * 100
      : 0;
  const tradeGuidance = !marketOpen
    ? 'Trading is paused until the round goes live again.'
    : !selectedStock?.isTradeable
      ? 'This instrument is currently restricted from trading.'
      : side === 'buy'
        ? canAfford
          ? 'Routing against the live quote. Review notional and exposure before sending.'
          : 'Buying power is below the current order notional.'
        : canSell
          ? `You can exit up to ${selectedHolding?.quantity ?? 0} shares from this position.`
          : 'Order size exceeds the shares in your current position.';
  const liveTime = snapshot.marketState.lastTickAt
    ? new Intl.DateTimeFormat('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(snapshot.marketState.lastTickAt))
    : 'Waiting';
  const newsTimeFormatter = new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <main className="terminal-shell terminal-shell--participant">
      <header className="desk-header">
        <div className="desk-header__identity">
          <div className="brand-lockup">
            <div className="brand-mark">VX</div>
            <div>
              <p className="market-panel__eyebrow">Venturers Exchange</p>
              <h1>Private Order Desk</h1>
              <p className="desk-header__summary">
                A tighter trading workspace for live decisions, with the tape on the left, conviction in
                the center, and execution parked on the right.
              </p>
            </div>
          </div>
        </div>
        <div className="desk-header__actions">
          <div className={`live-pill ${connected ? 'live-pill--good' : 'live-pill--warn'}`}>
            <span className={`status-dot ${connected ? '' : 'status-dot--warn'}`} />
            {connected ? 'Exchange live' : 'Reconnecting'}
          </div>
          <div className="desk-stat-grid">
            <div className="desk-stat">
              <span>Operator</span>
              <strong>{session.user?.displayName}</strong>
            </div>
            <div className="desk-stat">
              <span>Round</span>
              <strong>{snapshot.marketState.currentRoundName ?? 'Awaiting kickoff'}</strong>
            </div>
            <div className="desk-stat">
              <span>Desk rank</span>
              <strong>{leaderboardEntry ? `#${leaderboardEntry.rank}` : 'Unranked'}</strong>
            </div>
            <div className="desk-stat">
              <span>Net liq</span>
              <strong>{formatCurrency(displayPortfolio?.totalValue ?? 0)}</strong>
            </div>
            <div className="desk-stat">
              <span>Cash</span>
              <strong>{formatCurrency(displayPortfolio?.cashBalance ?? 0)}</strong>
            </div>
            <div className="desk-stat">
              <span>Last tick</span>
              <strong>{liveTime}</strong>
            </div>
          </div>
          <button className="ghost-button" onClick={() => void onLogout()}>
            Logout
          </button>
        </div>
      </header>

      <section className="signal-strip signal-strip--participant">
        <article className="signal-card">
          <span>Tape state</span>
          <strong>{tapeDescription}</strong>
          <p>
            {breadthCount}/{snapshot.stocks.length} names trading above base.
          </p>
        </article>
        <article className="signal-card">
          <span>Lead mover</span>
          <strong>{bestMover?.ticker ?? '--'}</strong>
          <p>
            {bestMover
              ? formatSignedPercent(
                  ((bestMover.currentPrice - bestMover.basePrice) / (bestMover.basePrice || 1)) * 100,
                )
              : 'No move yet'}
          </p>
        </article>
        <article className="signal-card">
          <span>Best position</span>
          <strong>{strongestHolding?.ticker ?? 'No holdings'}</strong>
          <p>
            {strongestHolding
              ? `${formatSignedCurrency(strongestHolding.unrealizedPnl)} unrealized`
              : 'No live position on the book yet.'}
          </p>
        </article>
        <article className="signal-card">
          <span>Trading state</span>
          <strong>
            {snapshot.marketState.tradingHalted
              ? 'Halted'
              : snapshot.marketState.roundStatus === 'ACTIVE'
                ? 'Open'
                : 'Closed'}
          </strong>
          <p>Rankings and quotes update directly from the live runtime.</p>
        </article>
      </section>

      <section className="participant-workspace">
        <MarketPanel
          eyebrow="Market Tape"
          title="Watchlist"
          aside={<span className="session-chip">{snapshot.stocks.length} instruments</span>}
          className="watchlist-panel"
        >
          <div className="watchlist-list">
            {snapshot.stocks.map((stock) => {
              const values = history[stock.ticker] ?? [];
              const previous = values.length > 1 ? values[values.length - 2] : stock.basePrice;
              const delta = stock.currentPrice - previous;
              const baseDeltaPct = ((stock.currentPrice - stock.basePrice) / (stock.basePrice || 1)) * 100;

              return (
                <button
                  key={stock.ticker}
                  className={`watchlist-row ${
                    selectedStock?.ticker === stock.ticker ? 'watchlist-row--active' : ''
                  } ${delta >= 0 ? 'watchlist-row--up' : 'watchlist-row--down'}`}
                  onClick={() => setSelectedTicker(stock.ticker)}
                >
                  <div className="watchlist-row__main">
                    <div className="watchlist-row__ticker">{stock.ticker}</div>
                    <div>
                      <h3>{stock.companyName}</h3>
                      <p>{stock.sector}</p>
                    </div>
                  </div>
                  <div className="watchlist-row__price">
                    <strong>{formatCurrency(stock.currentPrice)}</strong>
                    <span>{formatSignedPercent(baseDeltaPct)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </MarketPanel>

        <section className="participant-stage">
          <MarketPanel
            eyebrow={selectedStock?.sector ?? 'Market'}
            title={selectedStock?.companyName ?? 'Select a stock'}
            aside={
              <div className="panel-chip-row">
                <span className="ticker-pill">{selectedStock?.ticker}</span>
                <span className="session-chip">{selectedStock?.isTradeable ? 'Tradeable' : 'Restricted'}</span>
              </div>
            }
            className="focus-panel"
          >
            <div className="focus-panel__hero">
              <div className="focus-price">
                <span>Last trade</span>
                <strong>{selectedStock ? formatCurrency(selectedStock.currentPrice) : '--'}</strong>
                <p className={sessionDelta >= 0 ? 'up' : 'down'}>
                  {formatSignedCurrency(tickDelta)} intratick / {formatSignedPercent(sessionDeltaPct)} session
                </p>
              </div>
              <div className="focus-callouts">
                <div className="focus-badge">
                  <span>Bias</span>
                  <strong>{describeMomentum(sessionDeltaPct)}</strong>
                </div>
                <div className="focus-badge">
                  <span>Supply</span>
                  <strong>{selectedStock?.availableSupply ?? 0}</strong>
                </div>
                <div className="focus-badge">
                  <span>Volatility</span>
                  <strong>{selectedStock?.volatilityPct ?? 0}%</strong>
                </div>
              </div>
            </div>

            <Sparkline values={selectedStock ? selectedHistory : []} />

            <div className="focus-insight-grid">
              <div className="focus-insight">
                <span>Base price</span>
                <strong>{formatCurrency(selectedStock?.basePrice ?? 0)}</strong>
              </div>
              <div className="focus-insight">
                <span>Position size</span>
                <strong>{selectedHolding?.quantity ?? 0} shares</strong>
              </div>
              <div className="focus-insight">
                <span>Average cost</span>
                <strong>
                  {selectedHolding?.avgBuyPrice ? formatCurrency(selectedHolding.avgBuyPrice) : '--'}
                </strong>
              </div>
              <div className="focus-insight">
                <span>Position P&amp;L</span>
                <strong className={(selectedHolding?.unrealizedPnl ?? 0) >= 0 ? 'up' : 'down'}>
                  {formatSignedCurrency(selectedHolding?.unrealizedPnl ?? 0)}
                </strong>
              </div>
            </div>
          </MarketPanel>

          <div className="participant-stage__bottom">
            <MarketPanel
              eyebrow="Current Book"
              title="Positions"
              aside={<span className="session-chip">{holdings.length} live positions</span>}
              className="book-panel"
            >
              {holdings.length ? (
                <div className="positions-table">
                  <div className="positions-table__head">
                    <span>Name</span>
                    <span>Qty</span>
                    <span>Value</span>
                    <span>P&amp;L</span>
                  </div>
                  {holdings.map((holding) => (
                    <article key={holding.stockId} className="positions-table__row">
                      <div className="positions-table__security">
                        <strong>{holding.ticker}</strong>
                        <span>
                          {holding.companyName} / Avg {formatCurrency(holding.avgBuyPrice ?? 0)}
                        </span>
                      </div>
                      <span>{holding.quantity}</span>
                      <span>{formatCurrency(holding.marketValue)}</span>
                      <span className={holding.unrealizedPnl >= 0 ? 'up' : 'down'}>
                        {formatSignedCurrency(holding.unrealizedPnl)}
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">No holdings yet. Start building a position.</p>
              )}
            </MarketPanel>

            <MarketPanel
              eyebrow="Desk Wire"
              title="Narrative Feed"
              aside={<span className="session-chip">{snapshot.recentNews.length} items</span>}
              className="wire-panel"
            >
              <div className="wire-list">
                {snapshot.recentNews.length ? (
                  snapshot.recentNews.map((item) => (
                    <article key={item.id} className="wire-item">
                      <div className="wire-item__time">{newsTimeFormatter.format(new Date(item.triggeredAt))}</div>
                      <div>
                        <h3>{item.headline}</h3>
                        {item.detail ? <p>{item.detail}</p> : null}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="muted">No events yet. Watch this rail for shocks, round changes, and broadcast intel.</p>
                )}
              </div>
            </MarketPanel>
          </div>
        </section>

        <MarketPanel
          eyebrow="Execution"
          title="Order Ticket"
          aside={<span className="session-chip">{selectedHolding?.quantity ?? 0} shares held</span>}
          className="order-panel"
        >
          {selectedStock ? (
            <form
              className="trade-form"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!displayPortfolio || !selectedStock) return;

                setTradeError(null);
                setPending(true);
                const previousPortfolio = displayPortfolio;
                setOptimisticPortfolio(computeOptimisticPortfolio(displayPortfolio, selectedStock, side, quantity));

                try {
                  await onTrade(side, selectedStock.id, quantity);
                } catch (error) {
                  setOptimisticPortfolio(previousPortfolio);
                  setTradeError(error instanceof Error ? error.message : 'Trade failed.');
                } finally {
                  setPending(false);
                }
              }}
            >
              <div className="segmented-control">
                <button
                  type="button"
                  className={side === 'buy' ? 'segmented-control__active' : ''}
                  onClick={() => setSide('buy')}
                >
                  Buy
                </button>
                <button
                  type="button"
                  className={side === 'sell' ? 'segmented-control__active' : ''}
                  onClick={() => setSide('sell')}
                >
                  Sell
                </button>
              </div>

              <div className="order-panel__spotlight">
                <span>{selectedStock.ticker}</span>
                <strong>{formatCurrency(selectedStock.currentPrice)}</strong>
                <p>
                  Exposure after fill: {projectedExposure ? `${projectedExposure.toFixed(1)}%` : '0.0%'} of total
                  book
                </p>
              </div>

              <div className="trade-shortcuts">
                {[5, 10, 25, 50].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`tag-chip ${quantity === preset ? 'tag-chip--active' : ''}`}
                    onClick={() => setQuantity(preset)}
                  >
                    {preset} sh
                  </button>
                ))}
              </div>

              <label>
                Quantity
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                />
              </label>

              <div className="trade-estimate-grid">
                <div className="trade-estimate">
                  <p>Order notional</p>
                  <strong>{formatCurrency(estimatedValue)}</strong>
                </div>
                <div className="trade-estimate">
                  <p>Cash after fill</p>
                  <strong>{formatCurrency(projectedCashBalance)}</strong>
                </div>
                <div className="trade-estimate">
                  <p>Position after fill</p>
                  <strong>{projectedQuantity} shares</strong>
                </div>
                <div className="trade-estimate">
                  <p>Ticket state</p>
                  <strong>{marketOpen ? 'Ready' : 'Paused'}</strong>
                </div>
              </div>

              <p
                className={`trade-note ${
                  tradeDisabled && !pending ? 'trade-note--warn' : 'trade-note--good'
                }`}
              >
                {tradeGuidance}
              </p>

              {tradeError ? <p className="form-error">{tradeError}</p> : null}

              <button className="primary-button" type="submit" disabled={tradeDisabled}>
                {pending ? 'Routing order...' : `Send ${side} order`}
              </button>
            </form>
          ) : (
            <p>Select a stock to trade.</p>
          )}
        </MarketPanel>
      </section>
    </main>
  );
};
