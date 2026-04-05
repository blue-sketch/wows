import { useState, useEffect, useRef } from 'react';
import '../styles/login.css';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<void>;
  error: string | null;
}

/* ── Simulated ticker data ────────────────────── */
const tickerData = [
  { ticker: 'VNTCH', price: 482.50, change: +3.2 },
  { ticker: 'VNDFN', price: 315.00, change: -1.8 },
  { ticker: 'GRNRG', price: 224.10, change: +5.1 },
  { ticker: 'MEDHC', price: 148.30, change: -0.6 },
  { ticker: 'STELB', price: 207.90, change: +2.4 },
  { ticker: 'AUTRX', price: 331.40, change: -2.1 },
  { ticker: 'TELEQ', price: 178.60, change: +1.7 },
  { ticker: 'REALX', price: 265.20, change: +0.9 },
  { ticker: 'ENTFX', price: 134.70, change: -3.4 },
  { ticker: 'COMXZ', price: 88.30,  change: +6.2 },
  { ticker: 'FODBZ', price: 112.80, change: +0.4 },
  { ticker: 'PNKBT', price: 13.40,  change: +12.5 },
  { ticker: 'PNKRG', price: 8.90,   change: -7.1 },
  { ticker: 'AGRFM', price: 98.50,  change: +1.3 },
  { ticker: 'PNKMD', price: 5.60,   change: +18.2 },
];

const featureHighlights = [
  {
    label: 'Live market engine',
    title: 'Prices tick every 10 seconds',
    desc: 'Real-time price broadcasts across all desks simultaneously. Mean-reversion, demand signals, and bounded volatility.',
  },
  {
    label: 'Narrative shocks',
    title: 'News moves the tape',
    desc: 'Admin-triggered events ripple through sectors. Headlines appear and prices jump in the same render cycle.',
  },
  {
    label: '7 rounds of play',
    title: 'Strategy under pressure',
    desc: 'From market opening to world-changing events. Each round escalates the stakes and narrows the leaderboard.',
  },
];

/* ── Animated stock card with a mini sparkline ────── */
const StockCard = ({ ticker, price, change }: { ticker: string; price: number; change: number }) => {
  const isUp = change >= 0;
  // Generate a deterministic-looking sparkline path
  const points = useRef(
    Array.from({ length: 12 }, (_, i) => {
      const seed = ticker.charCodeAt(0) + ticker.charCodeAt(1) + i;
      return 20 + Math.sin(seed * 0.7) * 14 + Math.cos(seed * 1.3) * 8;
    }),
  ).current;
  const pathD = points
    .map((y, i) => `${i === 0 ? 'M' : 'L'} ${(i / 11) * 100} ${y}`)
    .join(' ');

  return (
    <div className="lp-stock-card">
      <div className="lp-stock-card__header">
        <span className="lp-stock-card__ticker">{ticker}</span>
        <span className={`lp-stock-card__change ${isUp ? 'lp-up' : 'lp-down'}`}>
          {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
        </span>
      </div>
      <svg className="lp-stock-card__spark" viewBox="0 0 100 40" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isUp ? 'rgba(74, 222, 128, 0.25)' : 'rgba(248, 113, 113, 0.25)'} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <path d={`${pathD} L 100 40 L 0 40 Z`} fill={`url(#grad-${ticker})`} />
        <path d={pathD} fill="none" stroke={isUp ? '#4ade80' : '#f87171'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <strong className="lp-stock-card__price">₹{price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
    </div>
  );
};

/* ── Main login page ─────────────────────────── */
export const LoginPage = ({ onLogin, error }: LoginPageProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // Stagger entry animations
    const timer = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      await onLogin(username, password);
    } finally {
      setPending(false);
    }
  };

  return (
    <main className={`lp-shell ${mounted ? 'lp-shell--entered' : ''}`}>
      {/* ── Ambient background layers ── */}
      <div className="lp-ambient" aria-hidden="true">
        <div className="lp-ambient__glow lp-ambient__glow--warm" />
        <div className="lp-ambient__glow lp-ambient__glow--cool" />
        <div className="lp-ambient__grid" />
        <div className="lp-ambient__noise" />
      </div>

      {/* ── Running ticker tape ── */}
      <div className="lp-ticker" aria-hidden="true">
        <div className="lp-ticker__track">
          {[...tickerData, ...tickerData].map((t, i) => (
            <span key={i} className="lp-ticker__item">
              <span className="lp-ticker__symbol">{t.ticker}</span>
              <strong>₹{t.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              <span className={t.change >= 0 ? 'lp-up' : 'lp-down'}>
                {t.change >= 0 ? '+' : ''}{t.change.toFixed(1)}%
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Main content area ── */}
      <div className="lp-content">
        {/* ── Left: Hero zone ── */}
        <section className="lp-hero">
          <header className="lp-hero__top">
            <div className="lp-brand">
              <div className="lp-brand__mark">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M2 20L11 2L20 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5.5 14H16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <div className="lp-brand__text">
                <span className="lp-brand__name">Venturers Exchange</span>
                <span className="lp-brand__sub">Market Simulation Platform</span>
              </div>
            </div>
            <div className="lp-hero__status">
              <span className="lp-status-dot" />
              <span>Systems Online</span>
            </div>
          </header>

          <div className="lp-hero__headline">
            <h1>
              The Market<br />
              <em>Awaits.</em>
            </h1>
            <p className="lp-hero__tagline">
              Seven rounds. Fifteen securities. One leaderboard.<br />
              Narrative shocks move the tape — disciplined execution decides the outcome.
            </p>
          </div>

          <div className="lp-features">
            {featureHighlights.map((f, i) => (
              <article
                key={f.label}
                className="lp-feature"
                style={{ animationDelay: `${600 + i * 120}ms` }}
              >
                <span className="lp-feature__label">{f.label}</span>
                <strong className="lp-feature__title">{f.title}</strong>
                <p className="lp-feature__desc">{f.desc}</p>
              </article>
            ))}
          </div>

          <div className="lp-stocks-row">
            {tickerData.slice(0, 5).map((s, i) => (
              <div key={s.ticker} style={{ animationDelay: `${900 + i * 80}ms` }} className="lp-stocks-row__item">
                <StockCard {...s} />
              </div>
            ))}
          </div>
        </section>

        {/* ── Right: Sign-in form ── */}
        <aside className="lp-auth">
          <form ref={formRef} className="lp-auth__card" onSubmit={handleSubmit}>
            <div className="lp-auth__header">
              <span className="lp-auth__eyebrow">Access Desk</span>
              <h2>Sign In</h2>
              <p>Enter your desk credentials to connect to the live exchange runtime.</p>
            </div>

            <div className="lp-auth__fields">
              <label className={`lp-field ${focusedField === 'username' ? 'lp-field--focused' : ''}`}>
                <span className="lp-field__label">Username</span>
                <div className="lp-field__input-wrap">
                  <svg className="lp-field__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
                  </svg>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    autoComplete="username"
                    placeholder="participant01"
                    spellCheck="false"
                  />
                </div>
              </label>

              <label className={`lp-field ${focusedField === 'password' ? 'lp-field--focused' : ''}`}>
                <span className="lp-field__label">Password</span>
                <div className="lp-field__input-wrap">
                  <svg className="lp-field__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                  />
                </div>
              </label>
            </div>

            {error && (
              <div className="lp-auth__error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <circle cx="12" cy="16" r="0.5" fill="currentColor" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button className="lp-auth__submit" type="submit" disabled={pending}>
              <span>{pending ? 'Connecting...' : 'Enter the Market'}</span>
              {!pending && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              )}
              {pending && <span className="lp-auth__spinner" />}
            </button>

            <div className="lp-auth__footer">
              <span className="lp-auth__secured">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Secured session
              </span>
              <span className="lp-auth__runtime">EDC Flagship · 2026</span>
            </div>
          </form>
        </aside>
      </div>
    </main>
  );
};
