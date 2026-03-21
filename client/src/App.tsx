import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type {
  AdminBootstrapDto,
  AuthUserDto,
  LeaderboardEntryDto,
  MarketSnapshotDto,
  ParticipantBootstrapDto,
  PortfolioDto,
  PublicDisplaySnapshotDto,
  TradeResponseDto,
} from '../../src/shared/contracts.js';
import { request } from './api.js';
import { usePriceHistory } from './hooks/usePriceHistory.js';
import { useAuthenticatedSocket, useDisplaySocket } from './hooks/useSocketState.js';
import { AdminPage } from './pages/AdminPage.js';
import { DisplayPage } from './pages/DisplayPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { ParticipantPage } from './pages/ParticipantPage.js';
import './styles/main.css';

type BootstrapPayload = ParticipantBootstrapDto | AdminBootstrapDto;

export interface UserSessionState {
  user: AuthUserDto | null;
  role: AuthUserDto['role'] | null;
}

const isAdminBootstrap = (payload: BootstrapPayload): payload is AdminBootstrapDto =>
  'participants' in payload;

const isParticipantBootstrap = (payload: BootstrapPayload): payload is ParticipantBootstrapDto =>
  'portfolio' in payload;

export const App = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isDisplayRoute = location.pathname.startsWith('/display');
  const [session, setSession] = useState<UserSessionState>({ user: null, role: null });
  const [snapshot, setSnapshot] = useState<MarketSnapshotDto | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioDto | null>(null);
  const [participants, setParticipants] = useState<LeaderboardEntryDto[]>([]);
  const [displaySnapshot, setDisplaySnapshot] = useState<PublicDisplaySnapshotDto | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'ready' | 'guest'>(
    isDisplayRoute ? 'guest' : 'loading',
  );
  const [loginError, setLoginError] = useState<string | null>(null);

  const loadBootstrap = async () => {
    try {
      const payload = await request<BootstrapPayload>('/api/bootstrap');
      setSession({ user: payload.user, role: payload.user.role });
      setSnapshot(payload);
      setParticipants(isAdminBootstrap(payload) ? payload.participants : []);
      setPortfolio(isParticipantBootstrap(payload) ? payload.portfolio : null);
      setAuthStatus('ready');
    } catch {
      setAuthStatus('guest');
      setSession({ user: null, role: null });
      setSnapshot(null);
      setPortfolio(null);
      setParticipants([]);
    }
  };

  useEffect(() => {
    if (isDisplayRoute) {
      void request<PublicDisplaySnapshotDto>('/api/display/bootstrap')
        .then((payload) => setDisplaySnapshot(payload))
        .catch(() => setDisplaySnapshot(null));
      return;
    }

    void loadBootstrap();
  }, [isDisplayRoute]);

  useEffect(() => {
    if (isDisplayRoute) return;

    if (authStatus === 'guest' && location.pathname !== '/login') {
      navigate('/login', { replace: true });
      return;
    }

    if (authStatus === 'ready' && (location.pathname === '/' || location.pathname === '/login')) {
      navigate(session.role === 'ADMIN' ? '/admin' : '/app', { replace: true });
    }
  }, [authStatus, isDisplayRoute, location.pathname, navigate, session.role]);

  const connected = useAuthenticatedSocket({
    enabled: authStatus === 'ready' && !isDisplayRoute,
    isAdmin: session.role === 'ADMIN',
    onSnapshot: (nextSnapshot) => {
      setSnapshot(nextSnapshot);
      if (session.role === 'ADMIN') {
        setParticipants(nextSnapshot.leaderboard);
      }
    },
    onPortfolioUpdate: (nextPortfolio) => {
      setPortfolio(nextPortfolio);
      setSession((current) =>
        current.user
          ? {
              ...current,
              user: {
                ...current.user,
                cashBalance: nextPortfolio.cashBalance,
              },
            }
          : current,
      );
    },
  });

  const displayConnected = useDisplaySocket(isDisplayRoute, (nextSnapshot) => setDisplaySnapshot(nextSnapshot));
  const history = usePriceHistory(snapshot?.prices ?? {});

  const handleLogin = async (username: string, password: string) => {
    setLoginError(null);
    try {
      const payload = await request<BootstrapPayload>('/auth/login', {
        method: 'POST',
        body: { username, password },
      });

      setSession({ user: payload.user, role: payload.user.role });
      setSnapshot(payload);
      setParticipants(isAdminBootstrap(payload) ? payload.participants : []);
      setPortfolio(isParticipantBootstrap(payload) ? payload.portfolio : null);
      setAuthStatus('ready');
      navigate(payload.user.role === 'ADMIN' ? '/admin' : '/app', { replace: true });
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Unable to sign in.');
    }
  };

  const handleLogout = async () => {
    await request('/auth/logout', { method: 'POST' });
    setAuthStatus('guest');
    setSession({ user: null, role: null });
    setSnapshot(null);
    setPortfolio(null);
    setParticipants([]);
    navigate('/login', { replace: true });
  };

  const handleTrade = async (
    side: 'buy' | 'sell',
    stockId: number,
    quantity: number,
  ): Promise<TradeResponseDto> => {
    const endpoint = side === 'buy' ? '/api/trade/buy' : '/api/trade/sell';
    return request<TradeResponseDto>(endpoint, {
      method: 'POST',
      body: {
        stockId,
        quantity,
        requestId: crypto.randomUUID(),
      },
    });
  };

  const refreshParticipants = async () => {
    const payload = await request<{ participants: LeaderboardEntryDto[] }>('/api/admin/participants');
    setParticipants(payload.participants);
  };

  if (isDisplayRoute) {
    return <DisplayPage snapshot={displaySnapshot} connected={displayConnected} />;
  }

  if (authStatus === 'loading') {
    return <div className="loading-shell">Loading market runtime...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage onLogin={handleLogin} error={loginError} />} />
      <Route
        path="/app"
        element={
          authStatus === 'ready' && session.role === 'PARTICIPANT' && snapshot ? (
            <ParticipantPage
              session={session}
              snapshot={snapshot}
              portfolio={portfolio}
              history={history}
              connected={connected}
              onLogout={handleLogout}
              onTrade={handleTrade}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/admin"
        element={
          authStatus === 'ready' && session.role === 'ADMIN' && snapshot ? (
            <AdminPage
              session={session}
              snapshot={snapshot}
              participants={participants}
              connected={connected}
              onLogout={handleLogout}
              onRefreshParticipants={refreshParticipants}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="/" element={<Navigate to={session.role === 'ADMIN' ? '/admin' : '/app'} replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};
