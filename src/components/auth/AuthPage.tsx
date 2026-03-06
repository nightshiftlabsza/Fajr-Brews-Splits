import { useState } from 'react';
import { useAppStore } from '../../store/appStore';

type Mode = 'login' | 'signup' | 'success';

export function AuthPage() {
  const { signIn, signUp } = useAppStore();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const err = await signIn(email, password);
        if (err) setError(err);
      } else {
        const err = await signUp(email, password, fullName);
        if (err) {
          setError(err);
        } else {
          setMode('success');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  if (mode === 'success') {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="auth-brand-icon">☕</span>
            <h1>Fajr Brews</h1>
            <p className="auth-subtitle">Coffee Splitter</p>
          </div>
          <div className="alert alert-success" style={{ marginBottom: 0 }}>
            <strong>Account created.</strong>
            <br />
            Check your email to confirm your address, then ask your Fajr Brews admin to add you to
            the workspace. Once you're added, sign in below.
          </div>
          <button
            className="btn btn-secondary w-full mt-4"
            onClick={() => setMode('login')}
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        {/* Brand */}
        <div className="auth-brand">
          <span className="auth-brand-icon">☕</span>
          <h1>Fajr Brews</h1>
          <p className="auth-subtitle">Coffee Splitter</p>
        </div>

        <p className="auth-tagline">Shared coffee order reconciliation</p>

        {/* Mode tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(''); }}
            type="button"
          >
            Sign in
          </button>
          <button
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => { setMode('signup'); setError(''); }}
            type="button"
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <div className="field">
              <label className="field-label" htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                className="input"
                type="text"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          )}

          <div className="field">
            <label className="field-label" htmlFor="email">Email address</label>
            <input
              id="email"
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus={mode === 'login'}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              placeholder={mode === 'signup' ? 'Min 6 characters' : '••••••••'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'signup' ? 6 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <div className="alert alert-error">{error}</div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner" style={{ width: 20, height: 20 }} />
            ) : mode === 'login' ? (
              'Sign in'
            ) : (
              'Create account'
            )}
          </button>
        </form>

        <p className="auth-footer">
          {mode === 'login' ? (
            <>No account? <button className="auth-link" onClick={() => { setMode('signup'); setError(''); }}>Create one</button></>
          ) : (
            <>Already have an account? <button className="auth-link" onClick={() => { setMode('login'); setError(''); }}>Sign in</button></>
          )}
        </p>
      </div>

      <style>{`
        .auth-shell {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-bg);
          padding: var(--space-4);
        }

        .auth-card {
          width: 100%;
          max-width: 420px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          padding: var(--space-8) var(--space-8);
        }

        @media (max-width: 480px) {
          .auth-card { padding: var(--space-6) var(--space-5); }
        }

        .auth-brand {
          text-align: center;
          margin-bottom: var(--space-2);
        }

        .auth-brand-icon {
          font-size: 2.5rem;
          display: block;
          margin-bottom: var(--space-3);
        }

        .auth-brand h1 {
          font-family: var(--font-display);
          font-size: 1.875rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--color-text-primary);
        }

        .auth-subtitle {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--color-text-muted);
          margin-top: 2px;
        }

        .auth-tagline {
          text-align: center;
          font-size: 0.875rem;
          color: var(--color-text-muted);
          margin-bottom: var(--space-6);
        }

        .auth-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          overflow: hidden;
          margin-bottom: var(--space-6);
        }

        .auth-tab {
          padding: var(--space-3);
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text-muted);
          transition: background-color var(--transition-fast), color var(--transition-fast);
        }

        .auth-tab + .auth-tab {
          border-left: 1.5px solid var(--color-border);
        }

        .auth-tab:hover {
          background: var(--color-surface-raised);
          color: var(--color-text-primary);
        }

        .auth-tab.active {
          background: var(--color-accent);
          color: var(--color-text-inverse);
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .auth-footer {
          text-align: center;
          font-size: 0.8125rem;
          color: var(--color-text-muted);
          margin-top: var(--space-5);
        }

        .auth-link {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-accent);
          font-size: inherit;
          font-weight: 600;
          text-decoration: underline;
        }

        .auth-link:hover {
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
}
