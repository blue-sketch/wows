import http from 'node:http';
import path from 'node:path';
import { Server as SocketIOServer } from 'socket.io';
import type { Session, SessionData } from 'express-session';
import { UserRole } from '@prisma/client';
import { createApp } from './app.js';
import { prisma } from './lib/db.js';
import { env } from './lib/env.js';
import { sessionMiddleware } from './lib/session.js';
import { MarketRuntime } from './services/marketRuntime.js';
import { MarketService } from './services/marketService.js';
import { TradeService } from './services/tradeService.js';

const bootstrap = async (): Promise<void> => {
  const server = http.createServer();
  const io = new SocketIOServer(server, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  const runtime = new MarketRuntime(prisma, io);
  const marketService = new MarketService(prisma, runtime);
  const tradeService = new TradeService(prisma, runtime);
  const app = createApp(runtime, marketService, tradeService);

  server.on('request', app);

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

  await runtime.initialize();

  setInterval(() => {
    void marketService.tick().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[market-tick] failed: ${message}`);
    });
  }, env.priceTickMs);

  server.listen(env.port, () => {
    const staticRoot = path.resolve(process.cwd(), 'dist/client');
    console.log(`Venturers Market Platform listening on http://localhost:${env.port}`);
    console.log(`Static client root: ${staticRoot}`);
  });
};

void bootstrap();
