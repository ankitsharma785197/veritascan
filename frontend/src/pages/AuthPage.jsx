import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Eye, Loader2, ScanLine, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export function AuthPage() {
  const { authenticate, loading, error } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  async function submit(event) {
    event.preventDefault();
    await authenticate(mode, form).catch(() => {});
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className="auth-screen">
      <section className="auth-shell" aria-label="VeritaScan authentication">
        <div className="auth-intel">
          <div className="radar-grid" />
          <div className="brand-mark">
            <div className="brand-icon"><Eye size={22} /></div>
            <div>
              <div className="brand-word">VeritaScan</div>
              <div className="brand-sub">forensic content intelligence</div>
            </div>
          </div>

          <div className="auth-copy">
            <h1>Detect synthetic evidence before it enters the record.</h1>
            <p>
              A clinical review surface for image and PDF integrity checks, built for fast triage and defensible reports.
            </p>
            <ul className="feature-stack">
              <li><Shield size={16} /> JWT-protected scan history per analyst</li>
              <li><ScanLine size={16} /> Metadata, visual, and text-layer inspection</li>
              <li><CheckCircle size={16} /> Gemini-assisted forensic report generation</li>
            </ul>
          </div>

          <div className="auth-signal">
            <div className="signal-row">
              <span>Live analysis grid</span>
              <span>ready</span>
            </div>
            <div className="signal-bars" aria-hidden="true">
              {Array.from({ length: 18 }).map((_, index) => <span key={index} />)}
            </div>
          </div>
        </div>

        <div className="auth-panel">
          <div className="brand-mark mobile-auth-brand">
            <div className="brand-icon"><Eye size={21} /></div>
            <div>
              <div className="brand-word">VeritaScan</div>
              <div className="brand-sub">forensic content intelligence</div>
            </div>
          </div>

          <h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
          <p>{mode === 'login' ? 'Access your secure forensic workspace.' : 'Create a workspace for protected scan history.'}</p>

          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => setMode('login')}
              role="tab"
              aria-selected={mode === 'login'}
            >
              Sign In
            </button>
            <button
              type="button"
              className={mode === 'signup' ? 'active' : ''}
              onClick={() => setMode('signup')}
              role="tab"
              aria-selected={mode === 'signup'}
            >
              Create Account
            </button>
          </div>

          <form className="form-stack" onSubmit={submit}>
            {mode === 'signup' && (
              <label className="field">
                <span>Name</span>
                <input
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  autoComplete="name"
                  required
                />
              </label>
            )}

            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                type="password"
                minLength={6}
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </label>

            {error && (
              <div className="error-banner" role="alert">
                <AlertTriangle size={17} />
                <span>{error}</span>
              </div>
            )}

            <button className="primary-btn" type="submit" disabled={loading}>
              {loading ? <Loader2 className="spin" size={18} /> : null}
              {loading ? 'Authenticating...' : mode === 'login' ? 'Enter Workspace' : 'Create Secure Account'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
