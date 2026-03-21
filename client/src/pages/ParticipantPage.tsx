import { useEffect, useState } from 'react';
import type {
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
  const displayPortfolio = optimisticPortfolio ?? portfolio;

  return (
    <main className="terminal-shell">
      <header className="terminal-topbar">
        <div>
          <p className="market-panel__eyebrow">Participant Terminal</p>
          <h1>{session.user?.displayName}</h1>
        </div>
        <div className="metric-row">
          <div className="metric-pill">
            <span>Round</span>
            <strong>{snapshot.marketState.currentRoundName ?? 'Awaiting kickoff'}</strong>
          </div>
          <div className="metric-pill">
            <span>Status</span>
            <strong>
              {snapshot.marketState.tradingHalted
                ? 'Halted'
                : snapshot.marketState.roundStatus === 'ACTIVE'
                  ? 'Trading Open'
                  : 'Closed'}
            </strong>
          </div>
          <div className="metric-pill">
            <span>Cash</span>
            <strong>{formatCurrency(displayPortfolio?.cashBalance ?? 0)}</strong>
          </div>
          <div className="metric-pill">
            <span>Total Value</span>
            <strong>{formatCurrency(displayPortfolio?.totalValue ?? 0)}</strong>
          </div>
          <div className={`metric-pill ${connected ? 'metric-pill--good' : 'metric-pill--warn'}`}>
            <span>Connection</span>
            <strong>{connected ? 'Live' : 'Reconnecting'}</strong>
          </div>
          <button className="ghost-button" onClick={() => void onLogout()}>
            Logout
          </button>
        </div>
      </header>

      <section className="participant-grid">
        <MarketPanel eyebrow="Market Board" title="Stocks" className="participant-grid__stocks">
          <div className="stock-list">
            {snapshot.stocks.map((stock) => {
              const values = history[stock.ticker] ?? [];
              const previous = values.length > 1 ? values[values.length - 2] : stock.currentPrice;
              const delta = stock.currentPrice - previous;

              return (
                <button
                  key={stock.ticker}
                  className={`stock-card ${selectedStock?.ticker === stock.ticker ? 'stock-card--active' : ''}`}
                  onClick={() => setSelectedTicker(stock.ticker)}
                >
                  <div>
                    <p>{stock.ticker}</p>
                    <h3>{stock.companyName}</h3>
                  </div>
                  <div className="stock-card__metrics">
                    <strong>{formatCurrency(stock.currentPrice)}</strong>
                    <span className={delta >= 0 ? 'up' : 'down'}>
                      {delta >= 0 ? '+' : ''}
                      {delta.toFixed(2)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </MarketPanel>

        <MarketPanel
          eyebrow={selectedStock?.sector ?? 'Market'}
          title={selectedStock?.companyName ?? 'Select a stock'}
          aside={<span className="ticker-pill">{selectedStock?.ticker}</span>}
          className="participant-grid__chart"
        >
          <div className="chart-summary">
            <div>
              <p>Current price</p>
              <strong>{selectedStock ? formatCurrency(selectedStock.currentPrice) : '--'}</strong>
            </div>
            <div>
              <p>Supply</p>
              <strong>{selectedStock?.availableSupply ?? 0}</strong>
            </div>
            <div>
              <p>Volatility</p>
              <strong>{selectedStock?.volatilityPct ?? 0}%</strong>
            </div>
          </div>
          <Sparkline values={selectedStock ? history[selectedStock.ticker] ?? [selectedStock.currentPrice] : []} />
        </MarketPanel>

        <MarketPanel eyebrow="Execution" title="Trade Widget" className="participant-grid__trade">
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

              <label>
                Quantity
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                />
              </label>

              <div className="trade-estimate">
                <p>Estimated value</p>
                <strong>{formatCurrency(selectedStock.currentPrice * quantity)}</strong>
              </div>

              {tradeError ? <p className="form-error">{tradeError}</p> : null}

              <button
                className="primary-button"
                type="submit"
                disabled={pending || snapshot.marketState.tradingHalted || snapshot.marketState.roundStatus !== 'ACTIVE'}
              >
                {pending ? 'Sending order...' : `Confirm ${side}`}
              </button>
            </form>
          ) : (
            <p>Select a stock to trade.</p>
          )}
        </MarketPanel>

        <MarketPanel eyebrow="Holdings" title="Portfolio" className="participant-grid__portfolio">
          <div className="portfolio-list">
            {displayPortfolio?.holdings.length ? (
              displayPortfolio.holdings.map((holding) => (
                <article key={holding.stockId} className="portfolio-row">
                  <div>
                    <p>{holding.ticker}</p>
                    <h3>{holding.companyName}</h3>
                  </div>
                  <div>
                    <strong>{holding.quantity} shares</strong>
                    <span>{formatCurrency(holding.marketValue)}</span>
                  </div>
                </article>
              ))
            ) : (
              <p className="muted">No holdings yet. Start building a position.</p>
            )}
          </div>
        </MarketPanel>

        <MarketPanel eyebrow="Narrative Feed" title="News & Announcements" className="participant-grid__news">
          <div className="news-feed">
            {snapshot.recentNews.length ? (
              snapshot.recentNews.map((item) => (
                <article key={item.id} className="news-card">
                  <div>
                    <p>{new Date(item.triggeredAt).toLocaleTimeString()}</p>
                    <h3>{item.headline}</h3>
                  </div>
                  {item.detail ? <p>{item.detail}</p> : null}
                </article>
              ))
            ) : (
              <p className="muted">No events yet. Watch this rail for shocks, round changes, and broadcast intel.</p>
            )}
          </div>
        </MarketPanel>
      </section>
    </main>
  );
};
