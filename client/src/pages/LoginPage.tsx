import { useState } from 'react';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<void>;
  error: string | null;
}

export const LoginPage = ({ onLogin, error }: LoginPageProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);

  return (
    <main className="login-shell">
      <div className="login-poster">
        <p className="login-poster__eyebrow">Venturers EDC</p>
        <h1>Wolf of Wall Street</h1>
        <p className="login-poster__lede">
          A four-hour live market where narrative shocks, fast trades, and disciplined timing decide the
          leaderboard.
        </p>
        <ul className="login-poster__notes">
          <li>Same-origin app delivery for stable sessions and sockets.</li>
          <li>Round state, halt state, and leaderboard visibility survive server restarts.</li>
          <li>Portfolio values and rankings come from one authoritative valuation path.</li>
        </ul>
      </div>

      <form
        className="login-card"
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
          <p className="market-panel__eyebrow">Access Terminal</p>
          <h2>Sign In</h2>
        </div>

        <label>
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? 'Signing in...' : 'Enter the Market'}
        </button>
      </form>
    </main>
  );
};
