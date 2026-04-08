import { Decimal } from 'decimal.js';
import { clamp, decimalOf, percentage, roundMoney } from '../lib/money.js';

const MIN_IDLE_MOVE_PCT = 0.0001;
const RANDOM_MOVE_SHARE = 0.10;
const MAX_TICK_MOVE_SHARE = 0.12;
const MIN_MAX_TICK_MOVE_PCT = 0.003;

const INVENTORY_PRESSURE_BASE = 0.0025;
const INVENTORY_PRESSURE_INTENSE = 0.0045;
const ORDER_FLOW_PRESSURE_BASE = 0.003;
const ORDER_FLOW_PRESSURE_INTENSE = 0.006;

const BASE_TRADE_IMPACT_PCT = 0.0005;
const SIZE_TRADE_IMPACT_MULTIPLIER = 0.03;
const SCARCITY_TRADE_IMPACT_MULTIPLIER = 0.5;
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

const getMaxDeviationPct = (basePrice: Decimal.Value): number => {
  const normalizedBasePrice = decimalOf(basePrice).toNumber();

  if (normalizedBasePrice <= 100) {
    return 0.03;
  }

  if (normalizedBasePrice <= 1000) {
    return 0.015;
  }

  return 0.005;
};

const getBracketLimits = (
  basePrice: Decimal.Value,
): { lowerLimit: Decimal; upperLimit: Decimal } => {
  const base = decimalOf(basePrice);
  const maxDeviationPct = getMaxDeviationPct(base);

  return {
    lowerLimit: base.mul(1 - maxDeviationPct),
    upperLimit: base.mul(1 + maxDeviationPct),
  };
};

export const clampStockPrice = (
  basePrice: Decimal.Value,
  nextPrice: Decimal.Value,
): Decimal => {
  const { lowerLimit, upperLimit } = getBracketLimits(basePrice);
  return roundMoney(clamp(nextPrice, lowerLimit, upperLimit));
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
  const maxDeviationPct = getMaxDeviationPct(base);
  const { lowerLimit, upperLimit } = getBracketLimits(base);

  const floatSupply = getFloatSupply(baselineSupply, availableSupply);
  const normalizedShock = clampNumber(randomShock, -1, 1);
  const baseVolatility = percentage(volatilityPct).toNumber();
  const maxTickMovePct = Math.min(
    Math.max(baseVolatility * MAX_TICK_MOVE_SHARE, MIN_MAX_TICK_MOVE_PCT),
    maxDeviationPct * 0.45,
  );
  const tickVolatilityPct = Math.min(
    Math.max(baseVolatility * RANDOM_MOVE_SHARE, MIN_IDLE_MOVE_PCT),
    maxTickMovePct * 0.75,
  );
  const randomMove = normalizedShock * tickVolatilityPct;
  const scarcity = clampNumber((baselineSupply - availableSupply) / floatSupply, -0.4, 0.95);
  const orderImbalance = clampNumber(tradeSignal?.orderImbalance ?? 0, -1, 1);
  const tradeIntensity = clampNumber(tradeSignal?.tradeIntensity ?? 0, 0, 1);

  const inventoryPressure =
    scarcity * (INVENTORY_PRESSURE_BASE + tradeIntensity * INVENTORY_PRESSURE_INTENSE);
  const orderFlowPressure =
    orderImbalance * (ORDER_FLOW_PRESSURE_BASE + tradeIntensity * ORDER_FLOW_PRESSURE_INTENSE);

  const rawMovePct = randomMove + inventoryPressure + orderFlowPressure;
  const boundedMovePct = clampNumber(rawMovePct, -maxTickMovePct, maxTickMovePct);
  const proposedPrice = current.mul(new Decimal(1).add(boundedMovePct));
  const finalPrice = clamp(proposedPrice, lowerLimit, upperLimit);

  return roundMoney(finalPrice);
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
