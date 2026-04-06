import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { MarketSnapshotDto, PortfolioDto, PublicDisplaySnapshotDto } from '../../../src/shared/contracts.js';

interface AuthSocketOptions {
  enabled: boolean;
  isAdmin: boolean;
  onSnapshot: (snapshot: MarketSnapshotDto) => void;
  onPortfolioUpdate: (portfolio: PortfolioDto) => void;
}

export const useAuthenticatedSocket = ({
  enabled,
  isAdmin,
  onSnapshot,
  onPortfolioUpdate,
}: AuthSocketOptions) => {
  const [connected, setConnected] = useState(false);
  const snapshotRef = useRef(onSnapshot);
  const portfolioRef = useRef(onPortfolioUpdate);

  useEffect(() => {
    snapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  useEffect(() => {
    portfolioRef.current = onPortfolioUpdate;
  }, [onPortfolioUpdate]);

  useEffect(() => {
    if (!enabled) return undefined;

    const socket = io({
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    const snapshotEvent = isAdmin ? 'admin_state_sync' : 'state_sync';

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on(snapshotEvent, (snapshot: MarketSnapshotDto) => snapshotRef.current(snapshot));
    socket.on('portfolio_update', (portfolio: PortfolioDto) => portfolioRef.current(portfolio));

    return () => {
      socket.disconnect();
      setConnected(false);
    };
  }, [enabled, isAdmin]);

  return connected;
};

export const useDisplaySocket = (
  enabled: boolean,
  onSnapshot: (snapshot: PublicDisplaySnapshotDto) => void,
) => {
  const [connected, setConnected] = useState(false);
  const snapshotRef = useRef(onSnapshot);

  useEffect(() => {
    snapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  useEffect(() => {
    if (!enabled) return undefined;

    const socket = io({
      autoConnect: true,
      transports: ['websocket', 'polling'],
      auth: { mode: 'display' },
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('display_state_sync', (snapshot: PublicDisplaySnapshotDto) => snapshotRef.current(snapshot));

    return () => {
      socket.disconnect();
      setConnected(false);
    };
  }, [enabled]);

  return connected;
};
