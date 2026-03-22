import {
  Prisma,
  PrismaClient,
  TradeSide,
  type Trade,
} from '@prisma/client';
import { Decimal } from 'decimal.js';
import type { TradeResponseDto } from '../../shared/contracts.js';
import { HttpError } from '../lib/errors.js';
import { decimalOf, moneyNumber, roundMoney } from '../lib/money.js';
import type { MarketRuntime } from './marketRuntime.js';
import { calculateTradeAdjustedPrice } from './pricingEngine.js';

const MAX_TRANSACTION_RETRIES = 3;

interface TradeRequestInput {
  userId: number;
  stockId: number;
  quantity: number;
  requestId: string;
  side: TradeSide;
}

interface TradeExecutionResult {
  response: TradeResponseDto;
  marketEffect?: {
    ticker: string;
    side: TradeSide;
    quantity: number;
    availableSupplyAfterTrade: number;
  };
}

const isSerializableConflict = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'P2034';

const isTransientTransactionFailure = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;

  const code = 'code' in error ? (error as { code?: string }).code : undefined;
  if (code === 'P2028') return true;

  const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
  return (
    message.includes('Transaction not found') ||
    message.includes('could not serialize access due to concurrent update')
  );
};

const isUniqueRequestViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'P2002';

export class TradeService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly runtime: MarketRuntime,
  ) {}

  async executeTrade(input: TradeRequestInput): Promise<TradeResponseDto> {
    if (!input.requestId.trim()) {
      throw new HttpError(400, 'requestId is required.');
    }

    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new HttpError(400, 'Quantity must be a positive integer.');
    }

    for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt += 1) {
      try {
        const result = await this.prisma.$transaction(
          async (tx): Promise<TradeExecutionResult> => {
            const existingTrade = await tx.trade.findUnique({
              where: { requestId: input.requestId },
            });

            if (existingTrade) {
              return {
                response: await this.buildResponseFromExisting(tx, existingTrade, input.userId),
              };
            }

            await tx.$queryRaw`
              SELECT id
              FROM "User"
              WHERE id = ${input.userId}
              FOR UPDATE
            `;

            const [marketState] = await tx.$queryRaw<
              Array<{ trading_halted: boolean }>
            >`
              SELECT trading_halted
              FROM "MarketState"
              WHERE id = 1
            `;

            if (marketState?.trading_halted) {
              throw new HttpError(409, 'Trading is currently halted.');
            }

            const [stock] = await tx.$queryRaw<
              Array<{
                id: number;
                ticker: string;
                current_price: Prisma.Decimal;
                base_price: Prisma.Decimal;
                available_supply: number;
                is_tradeable: boolean;
              }>
            >`
              SELECT id, ticker, current_price, base_price, available_supply, is_tradeable
              FROM "Stock"
              WHERE id = ${input.stockId}
              FOR UPDATE
            `;

            if (!stock) {
              throw new HttpError(404, 'Stock not found.');
            }

            if (!stock.is_tradeable) {
              throw new HttpError(409, 'This stock is not tradeable right now.');
            }

            const user = await tx.user.findUniqueOrThrow({
              where: { id: input.userId },
              select: { cashBalance: true },
            });

            if (input.side === TradeSide.BUY) {
              if (stock.available_supply < input.quantity) {
                throw new HttpError(409, 'Insufficient supply for this order.');
              }

              const price = decimalOf(stock.current_price.toString());
              const totalCost = roundMoney(price.mul(input.quantity));

              if (decimalOf(user.cashBalance.toString()).lt(totalCost)) {
                throw new HttpError(409, 'Insufficient cash balance.');
              }

              const availableSupplyAfterTrade = stock.available_supply - input.quantity;
              const impactedPrice = calculateTradeAdjustedPrice({
                currentPrice: stock.current_price.toString(),
                basePrice: stock.base_price.toString(),
                baselineSupply: this.runtime.getBaselineSupply(stock.ticker, stock.available_supply),
                availableSupplyAfterTrade,
                quantity: input.quantity,
                side: 'BUY',
              });

              await tx.user.update({
                where: { id: input.userId },
                data: {
                  cashBalance: decimalOf(user.cashBalance.toString()).sub(totalCost).toFixed(2),
                },
              });

              await tx.stock.update({
                where: { id: input.stockId },
                data: {
                  availableSupply: { decrement: input.quantity },
                  currentPrice: impactedPrice.toFixed(2),
                },
              });

              const existingHolding = await tx.holding.findUnique({
                where: { userId_stockId: { userId: input.userId, stockId: input.stockId } },
              });

              if (!existingHolding) {
                await tx.holding.create({
                  data: {
                    userId: input.userId,
                    stockId: input.stockId,
                    quantity: input.quantity,
                    avgBuyPrice: price.toFixed(2),
                  },
                });
              } else {
                const existingQuantity = decimalOf(existingHolding.quantity);
                const newQuantity = existingQuantity.add(input.quantity);
                const avgBuyPrice = existingHolding.avgBuyPrice
                  ? decimalOf(existingHolding.avgBuyPrice.toString())
                  : new Decimal(0);

                const updatedAvg = roundMoney(
                  existingQuantity.mul(avgBuyPrice).add(decimalOf(input.quantity).mul(price)).div(newQuantity),
                );

                await tx.holding.update({
                  where: { userId_stockId: { userId: input.userId, stockId: input.stockId } },
                  data: {
                    quantity: newQuantity.toNumber(),
                    avgBuyPrice: updatedAvg.toFixed(2),
                  },
                });
              }

              const trade = await tx.trade.create({
                data: {
                  requestId: input.requestId,
                  userId: input.userId,
                  stockId: input.stockId,
                  side: TradeSide.BUY,
                  quantity: input.quantity,
                  price: price.toFixed(2),
                },
              });

              return {
                response: await this.buildResponseFromTrade(tx, trade, input.userId),
                marketEffect: {
                  ticker: stock.ticker,
                  side: TradeSide.BUY,
                  quantity: input.quantity,
                  availableSupplyAfterTrade,
                },
              };
            }

            const holdings = await tx.$queryRaw<
              Array<{
                quantity: number;
                avg_buy_price: Prisma.Decimal | null;
              }>
            >`
              SELECT quantity, avg_buy_price
              FROM "Holding"
              WHERE user_id = ${input.userId} AND stock_id = ${input.stockId}
              FOR UPDATE
            `;

            const holding = holdings[0];
            if (!holding || holding.quantity < input.quantity) {
              throw new HttpError(409, 'Insufficient holdings for this sell order.');
            }

            const sellPrice = decimalOf(stock.current_price.toString());
            const proceeds = roundMoney(sellPrice.mul(input.quantity));
            const availableSupplyAfterTrade = stock.available_supply + input.quantity;
            const impactedPrice = calculateTradeAdjustedPrice({
              currentPrice: stock.current_price.toString(),
              basePrice: stock.base_price.toString(),
              baselineSupply: this.runtime.getBaselineSupply(stock.ticker, stock.available_supply),
              availableSupplyAfterTrade,
              quantity: input.quantity,
              side: 'SELL',
            });

            await tx.user.update({
              where: { id: input.userId },
              data: {
                cashBalance: decimalOf(user.cashBalance.toString()).add(proceeds).toFixed(2),
              },
            });

            await tx.stock.update({
              where: { id: input.stockId },
              data: {
                availableSupply: { increment: input.quantity },
                currentPrice: impactedPrice.toFixed(2),
              },
            });

            const remainingQuantity = holding.quantity - input.quantity;
            if (remainingQuantity === 0) {
              await tx.holding.delete({
                where: { userId_stockId: { userId: input.userId, stockId: input.stockId } },
              });
            } else {
              await tx.holding.update({
                where: { userId_stockId: { userId: input.userId, stockId: input.stockId } },
                data: { quantity: remainingQuantity },
              });
            }

            const trade = await tx.trade.create({
              data: {
                requestId: input.requestId,
                userId: input.userId,
                stockId: input.stockId,
                side: TradeSide.SELL,
                quantity: input.quantity,
                price: sellPrice.toFixed(2),
              },
            });

            return {
              response: await this.buildResponseFromTrade(tx, trade, input.userId),
              marketEffect: {
                ticker: stock.ticker,
                side: TradeSide.SELL,
                quantity: input.quantity,
                availableSupplyAfterTrade,
              },
            };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 10_000,
            timeout: 20_000,
          },
        );

        if (result.marketEffect) {
          this.runtime.recordTradeActivity(result.marketEffect);
          await this.runtime.queueStateRefresh({ forceLeaderboardRefresh: true });
        }

        await this.runtime.emitPortfolioUpdate(input.userId);
        return result.response;
      } catch (error) {
        if (isUniqueRequestViolation(error)) {
          const trade = await this.prisma.trade.findUnique({
            where: { requestId: input.requestId },
          });
          if (!trade) {
            throw error;
          }
          await this.runtime.queueStateRefresh({ forceLeaderboardRefresh: true });
          await this.runtime.emitPortfolioUpdate(input.userId);
          return this.buildResponseFromPersistedTrade(trade, input.userId);
        }

        if ((isSerializableConflict(error) || isTransientTransactionFailure(error)) && attempt < MAX_TRANSACTION_RETRIES) {
          continue;
        }

        throw error;
      }
    }

    throw new HttpError(409, 'Trade could not be completed after multiple retries.');
  }

  private async buildResponseFromPersistedTrade(trade: Trade, userId: number): Promise<TradeResponseDto> {
    return this.buildResponseFromExisting(this.prisma, trade, userId);
  }

  private async buildResponseFromExisting(
    client: Prisma.TransactionClient | PrismaClient,
    trade: Trade,
    userId: number,
  ): Promise<TradeResponseDto> {
    return this.buildResponseFromTrade(client, trade, userId);
  }

  private async buildResponseFromTrade(
    client: Prisma.TransactionClient | PrismaClient,
    trade: Trade,
    userId: number,
  ): Promise<TradeResponseDto> {
    const [user, holding] = await Promise.all([
      client.user.findUniqueOrThrow({
        where: { id: userId },
        select: { cashBalance: true },
      }),
      client.holding.findUnique({
        where: { userId_stockId: { userId, stockId: trade.stockId } },
        select: { quantity: true },
      }),
    ]);

    return {
      tradeId: trade.id,
      requestId: trade.requestId,
      side: trade.side,
      quantity: trade.quantity,
      executedPrice: moneyNumber(trade.price.toString()),
      cashBalance: moneyNumber(user.cashBalance.toString()),
      holdingQuantity: holding?.quantity ?? 0,
    };
  }
}
