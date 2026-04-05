import { describe, expect, it } from 'vitest';
import {
  calculateNextTickPrice,
  calculateTradeAdjustedPrice,
} from '../src/server/services/pricingEngine.js';

describe('pricingEngine', () => {
  it('keeps idle markets calm when there is no order flow', () => {
    const nextPrice = calculateNextTickPrice({
      currentPrice: '100.00',
      basePrice: '100.00',
      volatilityPct: '5.00',
      availableSupply: 2500,
      baselineSupply: 2500,
      randomShock: 1,
    });

    expect(nextPrice.toNumber()).toBeGreaterThan(100);
    expect(nextPrice.toNumber()).toBeLessThanOrEqual(101);
  });

  it('nudges prices upward on buy pressure and tighter supply', () => {
    const idlePrice = calculateNextTickPrice({
      currentPrice: '100.00',
      basePrice: '100.00',
      volatilityPct: '5.00',
      availableSupply: 1200,
      baselineSupply: 2500,
      randomShock: 0,
    });

    const nextPrice = calculateNextTickPrice({
      currentPrice: '100.00',
      basePrice: '100.00',
      volatilityPct: '5.00',
      availableSupply: 1200,
      baselineSupply: 2500,
      tradeSignal: {
        orderImbalance: 0.45,
        tradeIntensity: 0.5,
      },
      randomShock: 0,
    });

    expect(nextPrice.toNumber()).toBeGreaterThan(idlePrice.toNumber());
    expect(nextPrice.toNumber()).toBeGreaterThan(100.5);
  });

  it('adds immediate upward impact after a buy trade', () => {
    const nextPrice = calculateTradeAdjustedPrice({
      currentPrice: '100.00',
      basePrice: '100.00',
      baselineSupply: 2500,
      availableSupplyAfterTrade: 2300,
      quantity: 200,
      side: 'BUY',
    });

    expect(nextPrice.toNumber()).toBeGreaterThan(100);
    expect(nextPrice.toNumber()).toBeLessThan(103);
  });

  it('adds immediate downward impact after a sell trade', () => {
    const nextPrice = calculateTradeAdjustedPrice({
      currentPrice: '100.00',
      basePrice: '100.00',
      baselineSupply: 2500,
      availableSupplyAfterTrade: 1900,
      quantity: 200,
      side: 'SELL',
    });

    expect(nextPrice.toNumber()).toBeLessThan(100);
    expect(nextPrice.toNumber()).toBeGreaterThan(97);
  });

  it('mean reverts large price drift when the market is quiet', () => {
    const nextPrice = calculateNextTickPrice({
      currentPrice: '150.00',
      basePrice: '100.00',
      volatilityPct: '5.00',
      availableSupply: 2500,
      baselineSupply: 2500,
      randomShock: 0,
    });

    expect(nextPrice.toNumber()).toBeLessThan(150);
    expect(nextPrice.toNumber()).toBeGreaterThan(145);
  });
});
