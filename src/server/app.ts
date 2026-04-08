import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';
import { prisma } from './lib/db.js';
import { env, isProduction } from './lib/env.js';
import { HttpError } from './lib/errors.js';
import { sessionMiddleware } from './lib/session.js';
import { createApiRouter } from './routes/api.js';
import { createAuthRouter } from './routes/auth.js';
import type { MarketRuntime } from './services/marketRuntime.js';
import type { MarketService } from './services/marketService.js';
import type { TradeService } from './services/tradeService.js';

const clientDistPath = path.resolve(process.cwd(), 'dist/client');

export interface StartupState {
  phase: 'starting' | 'ready' | 'failed';
  ready: boolean;
  errorMessage: string | null;
}

export const createApp = (
  runtime: MarketRuntime,
  marketService: MarketService,
  tradeService: TradeService,
  startupState: StartupState,
) => {
  const app = express();

  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    const requestOrigin =
      typeof req.headers.origin === 'string'
        ? req.headers.origin.replace(/\/$/, '')
        : undefined;

    if (env.clientUrl && requestOrigin && requestOrigin !== env.clientUrl) {
      res.status(403).json({
        error: 'Origin not allowed.',
      });
      return;
    }

    if (env.clientUrl && requestOrigin === env.clientUrl) {
      res.header('Access-Control-Allow-Origin', requestOrigin);
      res.header('Vary', 'Origin');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    }

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }

    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', async (_req, res, next) => {
    if (!startupState.ready) {
      res.status(503).json({
        ok: false,
        database: startupState.phase === 'failed' ? 'unavailable' : 'connecting',
        startup: {
          phase: startupState.phase,
          error: startupState.errorMessage,
        },
      });
      return;
    }

    try {
      await prisma.$queryRaw`SELECT 1`;
      const state = runtime.getMarketState();
      const lastTickAt = state.lastTickAt ? new Date(state.lastTickAt).getTime() : null;
      const tickIsFresh =
        state.roundStatus !== 'ACTIVE' ||
        state.tradingHalted ||
        (lastTickAt !== null && Date.now() - lastTickAt < env.priceTickMs * 3);

      res.status(tickIsFresh ? 200 : 503).json({
        ok: tickIsFresh,
        database: 'connected',
        startup: {
          phase: startupState.phase,
          error: startupState.errorMessage,
        },
        marketState: state,
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((_req, res, next) => {
    if (startupState.ready) {
      next();
      return;
    }

    res.status(503).json({
      error:
        startupState.phase === 'failed'
          ? 'Server startup failed.'
          : 'Server is still starting. Please try again shortly.',
      startup: {
        phase: startupState.phase,
      },
    });
  });

  app.use(sessionMiddleware);

  app.use('/auth', createAuthRouter(runtime));
  app.use('/api', createApiRouter(runtime, marketService, tradeService));

  if (isProduction && env.serveStaticClient) {
    app.use(express.static(clientDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
        next();
        return;
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode =
      error instanceof HttpError
        ? error.statusCode
        : typeof error === 'object' && error !== null && 'statusCode' in error
          ? Number((error as { statusCode?: number }).statusCode ?? 500)
          : 500;

    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unexpected server error.';

    res.status(statusCode).json({
      error: message,
    });
  });

  return app;
};
