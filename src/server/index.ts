import http from 'node:http';
import path from 'node:path';
import { Server as SocketIOServer } from 'socket.io';
import type { Session, SessionData } from 'express-session';
import { UserRole } from '@prisma/client';
import { createApp, type StartupState } from './app.js';
import { prisma } from './lib/db.js';
import { env } from './lib/env.js';
import { sessionMiddleware } from './lib/session.js';
import { MarketRuntime } from './services/marketRuntime.js';
import { MarketService } from './services/marketService.js';
import { TradeService } from './services/tradeService.js';

const STARTUP_MAX_ATTEMPTS = 5;
const STARTUP_RETRY_DELAY_MS = 5_000;

const delay = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const bootstrap = async (): Promise<void> => {
  const server = http.createServer();
  const io = new SocketIOServer(server, {
    cors: {
      origin: env.clientUrl || true,
      credentials: true,
    },
  });

  const runtime = new MarketRuntime(prisma, io);
  const marketService = new MarketService(prisma, runtime);
  const tradeService = new TradeService(prisma, runtime);
  const startupState: StartupState = {
    phase: 'starting',
    ready: false,
    errorMessage: null,
  };
  const app = createApp(runtime, marketService, tradeService, startupState);

  server.on('request', app);
  server.on('error', (error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[startup] server failed: ${message}`);
  });

  io.engine.use(sessionMiddleware);
  io.on('connection', (socket) => {
    const handshakeMode = socket.handshake.auth?.mode;
    const request = socket.request as typeof socket.request & {
      session?: Session & Partial<SessionData>;
    };
    const sessionUser = request.session?.user;

    if (!sessionUser && handshakeMode !== 'display') {
      socket.disconnect(true);
      return;
    }

    if (handshakeMode === 'display') {
      socket.join('display');
      socket.emit('display_state_sync', runtime.getPublicSnapshot());
      return;
    }

    if (!sessionUser) {
      socket.disconnect(true);
      return;
    }

    socket.join(`user:${sessionUser.userId}`);
    if (sessionUser.role === UserRole.ADMIN) {
      socket.join('admin');
      socket.emit('admin_state_sync', runtime.getSnapshot(true));
      return;
    }

    socket.join('market');
    socket.emit('state_sync', runtime.getSnapshot(false));
  });

  const startMarketTicker = (): void => {
    setInterval(() => {
      void marketService.tick().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[market-tick] failed: ${message}`);
      });
    }, env.priceTickMs);
  };

  const failStartup = (error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error);
    startupState.ready = false;
    startupState.phase = 'failed';
    startupState.errorMessage = message;
    console.error(`[startup] giving up after ${STARTUP_MAX_ATTEMPTS} attempts: ${message}`);
    server.close(() => {
      process.exit(1);
    });
    setTimeout(() => {
      process.exit(1);
    }, 5_000).unref();
  };

  const initializeRuntime = async (): Promise<void> => {
    for (let attempt = 1; attempt <= STARTUP_MAX_ATTEMPTS; attempt += 1) {
      startupState.ready = false;
      startupState.phase = 'starting';
      startupState.errorMessage = null;
      console.log(`[startup] initializing runtime (attempt ${attempt}/${STARTUP_MAX_ATTEMPTS})`);

      try {
        console.log('[startup] connecting to database');
        await prisma.$connect();
        console.log('[startup] database connection established');
        await runtime.initialize();
        startupState.ready = true;
        startupState.phase = 'ready';
        console.log('[startup] runtime initialization completed');
        startMarketTicker();
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        startupState.errorMessage = message;
        console.error(
          `[startup] runtime initialization failed (attempt ${attempt}/${STARTUP_MAX_ATTEMPTS}): ${message}`,
        );
        await prisma.$disconnect().catch(() => undefined);

        if (attempt === STARTUP_MAX_ATTEMPTS) {
          failStartup(error);
          return;
        }

        console.log(`[startup] retrying in ${STARTUP_RETRY_DELAY_MS / 1000}s`);
        await delay(STARTUP_RETRY_DELAY_MS);
      }
    }
  };

  server.listen(env.port, () => {
    const staticRoot = path.resolve(process.cwd(), 'dist/client');
    console.log(`Venturers Market Platform listening on http://localhost:${env.port}`);
    console.log(`Static client root: ${staticRoot}`);
    void initializeRuntime();
  });
};

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[startup] bootstrap failed: ${message}`);
  process.exit(1);
});
