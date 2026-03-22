import bcrypt from 'bcrypt';
import { AdminEventType, PrismaClient, RoundStatus } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { parseUserCsv } from '../lib/csv.js';
import { HttpError } from '../lib/errors.js';
import { toInputJson } from '../lib/json.js';
import { decimalOf, moneyNumber } from '../lib/money.js';
import type { MarketRuntime } from './marketRuntime.js';
import { calculateNextTickPrice, clampStockPrice } from './pricingEngine.js';

interface NewsImpactInput {
  ticker: string;
  magnitudePct: number;
}

export class MarketService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly runtime: MarketRuntime,
  ) {}

  async tick(): Promise<void> {
    await this.runtime.queueMarketMutation(async () => {
      const tickedTickers: string[] = [];

      await this.prisma.$transaction(async (tx) => {
        const marketState = await tx.marketState.findUniqueOrThrow({ where: { id: 1 } });
        if (marketState.roundStatus !== RoundStatus.ACTIVE || marketState.tradingHalted) {
          return;
        }

        const stocks = await tx.stock.findMany({
          where: { isTradeable: true },
          orderBy: { ticker: 'asc' },
        });

        for (const stock of stocks) {
          const baselineSupply = this.runtime.getBaselineSupply(stock.ticker, stock.availableSupply);
          const tradeSignal = this.runtime.getTradeSignal(stock.ticker);
          const randomShock = Math.random() + Math.random() - 1;
          const nextPrice = calculateNextTickPrice({
            currentPrice: stock.currentPrice.toString(),
            basePrice: stock.basePrice.toString(),
            volatilityPct: stock.volatilityPct.toString(),
            availableSupply: stock.availableSupply,
            baselineSupply,
            tradeSignal,
            randomShock,
          });

          await tx.stock.update({
            where: { id: stock.id },
            data: { currentPrice: nextPrice.toFixed(2) },
          });

          tickedTickers.push(stock.ticker);
        }

        await tx.marketState.update({
          where: { id: 1 },
          data: {
            lastTickAt: new Date(),
            eventVersion: { increment: 1 },
          },
        });
      }, {
        maxWait: 10_000,
        timeout: 20_000,
      });

      for (const ticker of tickedTickers) {
        this.runtime.decayTradeSignal(ticker);
      }
    }, { forceLeaderboardRefresh: true });
  }

  async startRound(roundId: number, actorId: number): Promise<void> {
    await this.runtime.queueMarketMutation(
      async () => {
        await this.prisma.$transaction(async (tx) => {
          const round = await tx.round.findUnique({ where: { id: roundId } });
          if (!round) {
            throw new HttpError(404, 'Round not found.');
          }

          await tx.round.updateMany({
            where: { status: RoundStatus.ACTIVE },
            data: { status: RoundStatus.ENDED, endedAt: new Date() },
          });

          await tx.round.update({
            where: { id: roundId },
            data: {
              status: RoundStatus.ACTIVE,
              startedAt: round.startedAt ?? new Date(),
              endedAt: null,
            },
          });

          await tx.stock.updateMany({
            data: { isTradeable: true },
          });

          await tx.marketState.update({
            where: { id: 1 },
            data: {
              currentRoundId: roundId,
              roundStatus: RoundStatus.ACTIVE,
              tradingHalted: false,
              leaderboardVisible: false,
              eventVersion: { increment: 1 },
            },
          });

          await tx.adminEvent.create({
            data: {
              type: AdminEventType.ROUND_STARTED,
              actorId,
              payload: toInputJson({ roundId, roundName: round.name }),
            },
          });

          await tx.newsEvent.create({
            data: {
              roundId,
              headline: `${round.name} started`,
              detail: 'Trading is now open.',
              payload: { kind: 'round', action: 'start' },
            },
          });
        });

        this.runtime.resetTradeSignals();
      },
      { forceLeaderboardRefresh: true },
    );
  }

  async endRound(actorId: number): Promise<void> {
    await this.runtime.queueMarketMutation(
      async () => {
        await this.prisma.$transaction(async (tx) => {
          const marketState = await tx.marketState.findUniqueOrThrow({ where: { id: 1 } });

          if (!marketState.currentRoundId) {
            throw new HttpError(409, 'No active round to end.');
          }

          const round = await tx.round.update({
            where: { id: marketState.currentRoundId },
            data: {
              status: RoundStatus.ENDED,
              endedAt: new Date(),
            },
          });

          await tx.stock.updateMany({
            data: { isTradeable: false },
          });

          await tx.marketState.update({
            where: { id: 1 },
            data: {
              roundStatus: RoundStatus.ENDED,
              tradingHalted: false,
              eventVersion: { increment: 1 },
            },
          });

          await tx.adminEvent.create({
            data: {
              type: AdminEventType.ROUND_ENDED,
              actorId,
              payload: toInputJson({ roundId: round.id, roundName: round.name }),
            },
          });

          await tx.newsEvent.create({
            data: {
              roundId: round.id,
              headline: `${round.name} ended`,
              detail: 'Trading is closed until the next round.',
              payload: { kind: 'round', action: 'end' },
            },
          });
        });

        this.runtime.resetTradeSignals();
      },
      { forceLeaderboardRefresh: true },
    );
  }

  async publishNews(
    actorId: number,
    input: { headline: string; detail?: string; impacts: NewsImpactInput[] },
  ): Promise<void> {
    if (!input.headline.trim()) {
      throw new HttpError(400, 'Headline is required.');
    }

    await this.runtime.queueMarketMutation(
      async () => {
        await this.prisma.$transaction(async (tx) => {
          const marketState = await tx.marketState.findUniqueOrThrow({ where: { id: 1 } });
          const impactedTickers = input.impacts.map((impact) => impact.ticker.toUpperCase());

          const stocks = await tx.stock.findMany({
            where: { ticker: { in: impactedTickers } },
          });

          const byTicker = new Map(stocks.map((stock) => [stock.ticker, stock]));

          for (const impact of input.impacts) {
            const stock = byTicker.get(impact.ticker.toUpperCase());
            if (!stock) {
              throw new HttpError(404, `Unknown ticker ${impact.ticker}.`);
            }

            const currentPrice = decimalOf(stock.currentPrice.toString());
            const basePrice = decimalOf(stock.basePrice.toString());
            const nextPrice = clampStockPrice(
              basePrice,
              currentPrice.mul(new Decimal(1).add(new Decimal(impact.magnitudePct).div(100))),
            );

            await tx.stock.update({
              where: { id: stock.id },
              data: { currentPrice: nextPrice.toFixed(2) },
            });
          }

          await tx.newsEvent.create({
            data: {
              roundId: marketState.currentRoundId ?? undefined,
              headline: input.headline.trim(),
              detail: input.detail?.trim() || null,
              payload: toInputJson({ kind: 'news', impacts: input.impacts }),
            },
          });

          await tx.marketState.update({
            where: { id: 1 },
            data: { eventVersion: { increment: 1 } },
          });

          await tx.adminEvent.create({
            data: {
              type: AdminEventType.NEWS_BROADCAST,
              actorId,
              payload: toInputJson(input),
            },
          });
        });
      },
      { forceLeaderboardRefresh: true },
    );
  }

  async applyShock(
    actorId: number,
    input: { ticker: string; magnitudePct: number; reason?: string },
  ): Promise<void> {
    await this.runtime.queueMarketMutation(
      async () => {
        await this.prisma.$transaction(async (tx) => {
          const stock = await tx.stock.findUnique({
            where: { ticker: input.ticker.toUpperCase() },
          });

          if (!stock) {
            throw new HttpError(404, 'Stock not found.');
          }

          const currentPrice = decimalOf(stock.currentPrice.toString());
          const basePrice = decimalOf(stock.basePrice.toString());
          const nextPrice = clampStockPrice(
            basePrice,
            currentPrice.mul(new Decimal(1).add(new Decimal(input.magnitudePct).div(100))),
          );

          await tx.stock.update({
            where: { id: stock.id },
            data: { currentPrice: nextPrice.toFixed(2) },
          });

          await tx.marketState.update({
            where: { id: 1 },
            data: { eventVersion: { increment: 1 } },
          });

          await tx.adminEvent.create({
            data: {
              type: AdminEventType.SHOCK,
              actorId,
              payload: {
                ...input,
                beforePrice: moneyNumber(currentPrice),
                afterPrice: moneyNumber(nextPrice),
              },
            },
          });
        });
      },
      { forceLeaderboardRefresh: true },
    );
  }

  async broadcastMessage(actorId: number, message: string): Promise<void> {
    if (!message.trim()) {
      throw new HttpError(400, 'Broadcast message cannot be empty.');
    }

    await this.runtime.queueMarketMutation(async () => {
      await this.prisma.$transaction(async (tx) => {
        const marketState = await tx.marketState.findUniqueOrThrow({ where: { id: 1 } });

        await tx.newsEvent.create({
          data: {
            roundId: marketState.currentRoundId ?? undefined,
            headline: message.trim(),
            detail: null,
            payload: { kind: 'broadcast' },
          },
        });

        await tx.marketState.update({
          where: { id: 1 },
          data: { eventVersion: { increment: 1 } },
        });

        await tx.adminEvent.create({
            data: {
              type: AdminEventType.BROADCAST,
              actorId,
              payload: toInputJson({ message }),
            },
          });
      });
    });
  }

  async setTradingHalt(
    actorId: number,
    input: { halted: boolean; confirmation?: string },
  ): Promise<void> {
    if (input.halted && input.confirmation !== 'HALT') {
      throw new HttpError(400, 'HALT confirmation is required.');
    }

    await this.runtime.queueMarketMutation(
      async () => {
        await this.prisma.$transaction(async (tx) => {
          const marketState = await tx.marketState.findUniqueOrThrow({ where: { id: 1 } });
          const shouldTrade = !input.halted && marketState.roundStatus === RoundStatus.ACTIVE;

          await tx.stock.updateMany({
            data: { isTradeable: shouldTrade },
          });

          await tx.marketState.update({
            where: { id: 1 },
            data: {
              tradingHalted: input.halted,
              eventVersion: { increment: 1 },
            },
          });

          await tx.adminEvent.create({
            data: {
              type: input.halted ? AdminEventType.HALT : AdminEventType.RESUME,
              actorId,
              payload: toInputJson({ halted: input.halted }),
            },
          });

          await tx.newsEvent.create({
            data: {
              roundId: marketState.currentRoundId ?? undefined,
              headline: input.halted ? 'Trading halted' : 'Trading resumed',
              detail: input.halted
                ? 'Admin paused the market for a technical correction.'
                : 'Trading is live again.',
              payload: { kind: 'market-control', halted: input.halted },
            },
          });
        });
      },
      { forceLeaderboardRefresh: true },
    );
  }

  async setLeaderboardVisibility(actorId: number, visible: boolean): Promise<void> {
    await this.runtime.queueMarketMutation(
      async () => {
        await this.prisma.$transaction(async (tx) => {
          await tx.marketState.update({
            where: { id: 1 },
            data: {
              leaderboardVisible: visible,
              eventVersion: { increment: 1 },
            },
          });

          await tx.adminEvent.create({
            data: {
              type: visible
                ? AdminEventType.LEADERBOARD_REVEALED
                : AdminEventType.LEADERBOARD_HIDDEN,
              actorId,
              payload: toInputJson({ visible }),
            },
          });
        });
      },
      { forceLeaderboardRefresh: true },
    );
  }

  async importUsers(actorId: number, csv: string): Promise<{ importedCount: number; usernames: string[] }> {
    const rows = parseUserCsv(csv);

    const payload = await Promise.all(
      rows.map(async (row) => ({
        username: row.username,
        passwordHash: await bcrypt.hash(row.password, 10),
        displayName: row.displayName,
        role: row.role,
      })),
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.createMany({
        data: payload,
        skipDuplicates: true,
      });

      await tx.adminEvent.create({
        data: {
          type: AdminEventType.USERS_IMPORTED,
          actorId,
          payload: toInputJson({
            importedCount: created.count,
            usernames: payload.map((row) => row.username),
          }),
        },
      });

      return created;
    });

    return {
      importedCount: result.count,
      usernames: payload.map((row) => row.username),
    };
  }
}
