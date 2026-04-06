import { Router } from 'express';
import { TradeSide, UserRole } from '@prisma/client';
import type { AuthUserDto } from '../../shared/contracts.js';
import { prisma } from '../lib/db.js';
import { HttpError } from '../lib/errors.js';
import { asyncHandler, requireAdmin, requireAuth, requireParticipant } from '../lib/http.js';
import { moneyNumber } from '../lib/money.js';
import type { MarketRuntime } from '../services/marketRuntime.js';
import type { MarketService } from '../services/marketService.js';
import type { TradeService } from '../services/tradeService.js';
import { buildPortfolio } from '../services/valuation.js';

const getCurrentUser = async (
  userId: number,
  displayName: string,
  role: AuthUserDto['role'],
): Promise<AuthUserDto> => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { cashBalance: true },
  });

  return {
    userId,
    displayName,
    role,
    cashBalance: moneyNumber(user.cashBalance.toString()),
  };
};

export const createApiRouter = (
  runtime: MarketRuntime,
  marketService: MarketService,
  tradeService: TradeService,
): Router => {
  const router = Router();

  router.get(
    '/bootstrap',
    requireAuth,
    asyncHandler(async (req, res) => {
      const sessionUser = req.session.user!;
      const user = await getCurrentUser(
        sessionUser.userId,
        sessionUser.displayName,
        sessionUser.role,
      );

      const payload =
        sessionUser.role === UserRole.ADMIN
          ? await runtime.buildAdminBootstrap(user)
          : await runtime.buildParticipantBootstrap(user);

      res.json(payload);
    }),
  );

  router.get(
    '/display/bootstrap',
    asyncHandler(async (_req, res) => {
      res.json(runtime.getPublicSnapshot());
    }),
  );

  router.get(
    '/stocks',
    requireAuth,
    asyncHandler(async (_req, res) => {
      res.json({
        stocks: runtime.getStocks(),
        prices: runtime.getPriceMap(),
      });
    }),
  );

  router.get(
    '/portfolio',
    requireAuth,
    asyncHandler(async (req, res) => {
      const portfolio = await buildPortfolio(
        prisma,
        req.session.user!.userId,
        runtime.getPriceMap(),
      );
      res.json(portfolio);
    }),
  );

  router.get(
    '/leaderboard',
    requireAuth,
    asyncHandler(async (req, res) => {
      const includeHidden = req.session.user!.role === UserRole.ADMIN;
      const leaderboard = runtime.getLeaderboard(includeHidden);

      if (!includeHidden && leaderboard.length === 0) {
        throw new HttpError(403, 'Leaderboard is not visible yet.');
      }

      res.json({ leaderboard });
    }),
  );

  router.post(
    '/trade/buy',
    requireParticipant,
    asyncHandler(async (req, res) => {
      const result = await tradeService.executeTrade({
        userId: req.session.user!.userId,
        stockId: Number(req.body.stockId),
        quantity: Number(req.body.quantity),
        requestId: String(req.body.requestId ?? ''),
        side: TradeSide.BUY,
      });

      res.json(result);
    }),
  );

  router.post(
    '/trade/sell',
    requireParticipant,
    asyncHandler(async (req, res) => {
      const result = await tradeService.executeTrade({
        userId: req.session.user!.userId,
        stockId: Number(req.body.stockId),
        quantity: Number(req.body.quantity),
        requestId: String(req.body.requestId ?? ''),
        side: TradeSide.SELL,
      });

      res.json(result);
    }),
  );

  router.get(
    '/admin/participants',
    requireAdmin,
    asyncHandler(async (_req, res) => {
      await runtime.refreshLeaderboardIfStale();
      res.json({ participants: runtime.getLeaderboard(true) });
    }),
  );

  router.get(
    '/admin/rounds',
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const rounds = await prisma.round.findMany({
        orderBy: { number: 'asc' },
      });
      res.json({ rounds });
    }),
  );

  router.post(
    '/admin/round/start',
    requireAdmin,
    asyncHandler(async (req, res) => {
      await marketService.startRound(Number(req.body.roundId), req.session.user!.userId);
      res.status(204).send();
    }),
  );

  router.post(
    '/admin/round/end',
    requireAdmin,
    asyncHandler(async (req, res) => {
      await marketService.endRound(req.session.user!.userId);
      res.status(204).send();
    }),
  );

  router.post(
    '/admin/news',
    requireAdmin,
    asyncHandler(async (req, res) => {
      await marketService.publishNews(req.session.user!.userId, {
        headline: String(req.body.headline ?? ''),
        detail: typeof req.body.detail === 'string' ? req.body.detail : undefined,
        impacts: Array.isArray(req.body.impacts)
          ? req.body.impacts.map((impact: { ticker: string; magnitudePct: number }) => ({
              ticker: String(impact.ticker),
              magnitudePct: Number(impact.magnitudePct),
            }))
          : [],
      });

      res.status(204).send();
    }),
  );

  router.post(
    '/admin/shock',
    requireAdmin,
    asyncHandler(async (req, res) => {
      await marketService.applyShock(req.session.user!.userId, {
        ticker: String(req.body.ticker ?? ''),
        magnitudePct: Number(req.body.magnitudePct),
        reason: typeof req.body.reason === 'string' ? req.body.reason : undefined,
      });

      res.status(204).send();
    }),
  );
  // NEW: Sector Shock Route
  router.post(
    '/admin/shock/sector',
    requireAdmin,
    asyncHandler(async (req, res) => {
      await marketService.applySectorShock(req.session.user!.userId, {
        sector: String(req.body.sector ?? ''),
        magnitudePct: Number(req.body.magnitudePct),
        reason: typeof req.body.reason === 'string' ? req.body.reason : undefined,
      });

      res.status(204).send();
    }),
  );

  // NEW: Manual Cash Adjustment Route
  router.post(
    '/admin/users/adjust-cash',
    requireAdmin,
    asyncHandler(async (req, res) => {
      await marketService.adjustUserCash(req.session.user!.userId, {
        targetUserId: Number(req.body.targetUserId),
        amount: Number(req.body.amount),
        reason: typeof req.body.reason === 'string' ? req.body.reason : undefined,
      });

      res.status(204).send();
    }),
  );

  router.post(
    '/admin/broadcast',
    requireAdmin,
    asyncHandler(async (req, res) => {
      await marketService.broadcastMessage(req.session.user!.userId, String(req.body.message ?? ''));
      res.status(204).send();
    }),
  );

  router.post(
    '/admin/halt',
    requireAdmin,
    asyncHandler(async (req, res) => {
      await marketService.setTradingHalt(req.session.user!.userId, {
        halted: Boolean(req.body.halted),
        confirmation: typeof req.body.confirmation === 'string' ? req.body.confirmation : undefined,
      });

      res.status(204).send();
    }),
  );

  router.post(
    '/admin/leaderboard/reveal',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const visible = typeof req.body.visible === 'boolean' ? req.body.visible : true;
      await marketService.setLeaderboardVisibility(req.session.user!.userId, visible);
      res.status(204).send();
    }),
  );

  router.post(
    '/admin/users/import',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const csv = String(req.body.csv ?? '');
      const result = await marketService.importUsers(req.session.user!.userId, csv);
      res.json(result);
    }),
  );

  return router;
};
