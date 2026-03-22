import { useState } from 'react';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<void>;
  error: string | null;
}

const previewQuotes = [
  { ticker: 'ALFA', price: 'INR 1,240', move: '+3.2%' },
  { ticker: 'VOLT', price: 'INR 890', move: '-1.1%' },
  { ticker: 'CAPE', price: 'INR 1,530', move: '+4.8%' },
];

export const LoginPage = ({ onLogin, error }: LoginPageProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);

  return (
    <main className="login-shell">
      <section className="login-hero">
        <div className="login-hero__header">
          <div className="brand-lockup">
            <div className="brand-mark">VX</div>
            <div>
              <p className="login-poster__eyebrow">Venturers Exchange</p>
              <span className="login-hero__tag">Institutional market simulation</span>
            </div>
          </div>
          <span className="session-chip">Real-time room runtime</span>
        </div>

        <div className="login-hero__copy">
          <h1>Built like a trading desk, tuned for a live market game.</h1>
          <p>
            Narrative shocks move the tape, quotes update in real time, and disciplined execution decides
            the leaderboard.
          </p>
        </div>

        <div className="login-preview">
          <div className="login-preview__board">
            <div className="login-preview__board-header">
              <span>Desk preview</span>
              <strong>Market tape</strong>
            </div>
            <div className="login-preview__quotes">
              {previewQuotes.map((quote) => (
                <div key={quote.ticker} className="login-preview__quote">
                  <div>
                    <span>{quote.ticker}</span>
                    <strong>{quote.price}</strong>
                  </div>
                  <p className={quote.move.startsWith('+') ? 'up' : 'down'}>{quote.move}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="login-preview__notes">
            <article className="signal-card">
              <span>Round state</span>
              <strong>Persistent runtime</strong>
              <p>Trading halts, round transitions, and leaderboard visibility remain in sync.</p>
            </article>
            <article className="signal-card">
              <span>Execution flow</span>
              <strong>Watch, decide, route</strong>
              <p>Quotes, chart context, and order entry sit together like a proper broker workspace.</p>
            </article>
            <article className="signal-card">
              <span>Valuation path</span>
              <strong>One source of truth</strong>
              <p>Portfolio value and rankings come from the same authoritative pricing path.</p>
            </article>
          </div>
        </div>
      </section>

      <form
        className="login-card login-card--refined"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          try {
            await onLogin(username, password);
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="login-card__header">
          <p className="market-panel__eyebrow">Access Desk</p>
          <h2>Sign In</h2>
          <p className="login-card__lede">Use your desk credentials to connect to the live exchange runtime.</p>
        </div>

        <label>
          Username
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            placeholder="participant01"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="market-ready"
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? 'Signing in...' : 'Enter the Market'}
        </button>

        <p className="login-card__trust">Serious market mood. Clear operator flow.</p>
      </form>
    </main>
  );
};
