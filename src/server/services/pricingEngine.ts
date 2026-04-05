import { Decimal } from 'decimal.js';
import { clamp, decimalOf, percentage, roundMoney } from '../lib/money.js';

const PRICE_FLOOR_MULTIPLIER = new Decimal(0.2);
const PRICE_CEILING_MULTIPLIER = new Decimal(6);

const MIN_IDLE_MOVE_PCT = 0.0005; // Was 0.0025
const RANDOM_MOVE_SHARE = 0.10; // Was 0.16
const SOFT_MEAN_REVERSION = 0.015;
const HARD_MEAN_REVERSION = 0.04;
const HARD_REVERSION_DRIFT = 0.12;
const MAX_TICK_MOVE_SHARE = 0.10; // Was 0.26
const MIN_MAX_TICK_MOVE_PCT = 0.003; // Was 0.012;

const INVENTORY_PRESSURE_BASE = 0.001; // Was 0.004
const INVENTORY_PRESSURE_INTENSE = 0.002; // Was 0.006
const ORDER_FLOW_PRESSURE_BASE = 0.001; // Was 0.006
const ORDER_FLOW_PRESSURE_INTENSE = 0.003;

const BASE_TRADE_IMPACT_PCT = 0.0005; // Was 0.002
const SIZE_TRADE_IMPACT_MULTIPLIER = 0.03; // Was 0.12
const SCARCITY_TRADE_IMPACT_MULTIPLIER = 0.5; // Was 1.5
const MAX_TRADE_IMPACT_PCT = 0.005;

export interface TradeSignal {
  orderImbalance: number;
  tradeIntensity: number;
}

interface TickPriceInput {
  currentPrice: Decimal.Value;
  basePrice: Decimal.Value;
  volatilityPct: Decimal.Value;
  availableSupply: number;
  baselineSupply: number;
  tradeSignal?: TradeSignal;
  randomShock: number;
}

interface TradePriceImpactInput {
  currentPrice: Decimal.Value;
  basePrice: Decimal.Value;
  baselineSupply: number;
  availableSupplyAfterTrade: number;
  quantity: number;
  side: 'BUY' | 'SELL';
}

const clampNumber = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const getFloatSupply = (baselineSupply: number, currentSupply: number): number =>
  Math.max(1, baselineSupply, currentSupply);

export const clampStockPrice = (
  basePrice: Decimal.Value,
  nextPrice: Decimal.Value,
): Decimal => {
  const floor = decimalOf(basePrice).mul(PRICE_FLOOR_MULTIPLIER);
  const ceiling = decimalOf(basePrice).mul(PRICE_CEILING_MULTIPLIER);
  return roundMoney(clamp(nextPrice, floor, ceiling));
};

export const calculateNextTickPrice = ({
  currentPrice,
  basePrice,
  volatilityPct,
  availableSupply,
  baselineSupply,
  tradeSignal,
  randomShock,
}: TickPriceInput): Decimal => {
  const current = decimalOf(currentPrice);
  const base = decimalOf(basePrice);
  const floatSupply = getFloatSupply(baselineSupply, availableSupply);
  const normalizedShock = clampNumber(randomShock, -1, 1);
  const baseVolatility = percentage(volatilityPct).toNumber();
  const idleVolatility = Math.max(baseVolatility * RANDOM_MOVE_SHARE, MIN_IDLE_MOVE_PCT);
  const randomMove = normalizedShock * idleVolatility;

  const drift = base.isZero() ? 0 : current.sub(base).div(base).toNumber();
  const meanReversionStrength =
    Math.abs(drift) > HARD_REVERSION_DRIFT ? HARD_MEAN_REVERSION : SOFT_MEAN_REVERSION;
  const meanReversion = -drift * meanReversionStrength;

  const scarcity = clampNumber((baselineSupply - availableSupply) / floatSupply, -0.4, 0.95);
  const orderImbalance = clampNumber(tradeSignal?.orderImbalance ?? 0, -1, 1);
  const tradeIntensity = clampNumber(tradeSignal?.tradeIntensity ?? 0, 0, 1);

  const inventoryPressure =
    scarcity * (INVENTORY_PRESSURE_BASE + tradeIntensity * INVENTORY_PRESSURE_INTENSE);
  const orderFlowPressure =
    orderImbalance * (ORDER_FLOW_PRESSURE_BASE + tradeIntensity * ORDER_FLOW_PRESSURE_INTENSE);

  const rawMovePct = randomMove + meanReversion + inventoryPressure + orderFlowPressure;
  const maxTickMove = Math.max(baseVolatility * MAX_TICK_MOVE_SHARE, MIN_MAX_TICK_MOVE_PCT);
  const boundedMovePct = clampNumber(rawMovePct, -maxTickMove, maxTickMove);

  return clampStockPrice(base, current.mul(1 + boundedMovePct));
};

export const calculateTradeAdjustedPrice = ({
  currentPrice,
  basePrice,
  baselineSupply,
  availableSupplyAfterTrade,
  quantity,
  side,
}: TradePriceImpactInput): Decimal => {
  const current = decimalOf(currentPrice);
  const base = decimalOf(basePrice);
  const floatSupply = getFloatSupply(baselineSupply, availableSupplyAfterTrade);
  const sizeShare = clampNumber(quantity / floatSupply, 0, 0.25);
  const scarcity = clampNumber((baselineSupply - availableSupplyAfterTrade) / floatSupply, 0, 0.95);

  const direction = side === 'BUY' ? 1 : -1;
  const rawImpactPct =
    direction *
    (BASE_TRADE_IMPACT_PCT + sizeShare * SIZE_TRADE_IMPACT_MULTIPLIER) *
    (1 + scarcity * SCARCITY_TRADE_IMPACT_MULTIPLIER);
  const boundedImpactPct = clampNumber(rawImpactPct, -MAX_TRADE_IMPACT_PCT, MAX_TRADE_IMPACT_PCT);

  return clampStockPrice(base, current.mul(1 + boundedImpactPct));
};
