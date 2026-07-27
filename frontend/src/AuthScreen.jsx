import { useState } from 'react';
import axios from 'axios';
import { ScanIcon, CheckIcon, WarningIcon, CrossIcon, UserIcon, MailIcon, LockIcon } from './Icons.jsx';

// Login / register screen. Rendered instead of the main app whenever there's
// no valid token in localStorage. On success it hands the token + user back
// up to App.jsx, which is the only place that persists it.

const DOSSIER_ITEMS = [
  'Keyword-by-keyword ATS match scoring',
  'Copy-ready rewrites for every weak bullet',
  'A history only you can open',
];

function AuthScreen({ apiUrl, onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isRegister = mode === 'register';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isRegister && !name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const payload = isRegister
        ? { name: name.trim(), email: email.trim(), password }
        : { email: email.trim(), password };
      const response = await axios.post(`${apiUrl}/api/auth/${mode}`, payload);
      onAuthSuccess(response.data.token, response.data.user);
    } catch (err) {
      if (!err.response) {
        setError('Could not connect to the backend. Please check the server.');
      } else {
        setError(err.response.data?.error || 'Something went wrong, please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setError('');
  };

  return (
    <div className="page">
      <div className="navbar">
        <div className="brand">
          <span className="brand-icon"><ScanIcon width={20} height={20} /></span>
          ATSmate
        </div>
      </div>

      <div className="auth-shell">

        {/* Left: brand / story panel */}
        <div className="auth-brand-panel">
          <div className="scan-grid" aria-hidden="true"></div>

          {/* Oversized faint seal watermark — purely decorative, sits behind
              the content and costs no layout height */}
          <svg viewBox="0 0 120 120" className="auth-watermark" aria-hidden="true">
            <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="0.6" />
            <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeWidth="0.8" />
            <path d="M42 61 L53 72 L79 45" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          <div className="auth-brand-content">

            <div className="auth-lockup">
              <div className="auth-stamp" aria-hidden="true">
                <div className="auth-stamp-ring"></div>
                <svg viewBox="0 0 120 120" width={52} height={52} className="seal-svg auth-seal">
                  <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeWidth="3" />
                  <path d="M42 61 L53 72 L79 45" stroke="currentColor" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="auth-lockup-divider" aria-hidden="true"></span>
              <span className="eyebrow auth-brand-eyebrow">Private access</span>
            </div>

            <h1 className="auth-brand-heading">
              Your dossier, <em>sealed</em> and yours alone.
            </h1>
            <p className="subtitle auth-brand-subtitle">
              Every analysis you run is verified, filed, and visible to no one but you.
            </p>

            <div className="auth-divider" aria-hidden="true"></div>

            <ul className="dossier-list">
              {DOSSIER_ITEMS.map((item) => (
                <li key={item} className="dossier-row">
                  <CheckIcon width={14} height={14} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: the actual form */}
        <div className="auth-form-panel">
          <form className="auth-box" onSubmit={handleSubmit}>

            <div className="auth-tabs" role="tablist" aria-label="Login or sign up">
              <div className={`auth-tab-indicator ${isRegister ? 'is-register' : ''}`} aria-hidden="true"></div>
              <button
                type="button"
                role="tab"
                aria-selected={!isRegister}
                className={`auth-tab ${!isRegister ? 'active' : ''}`}
                onClick={() => switchMode('login')}
              >
                Login
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isRegister}
                className={`auth-tab ${isRegister ? 'active' : ''}`}
                onClick={() => switchMode('register')}
              >
                Sign up
              </button>
            </div>

            <h2 className="auth-title">
              {isRegister ? 'Create your account' : 'Welcome back'}
            </h2>

            {error && (
              <div className="toast toast-error auth-error" role="alert">
                <WarningIcon width={15} height={15} />
                <span>{error}</span>
                <button type="button" className="toast-close" onClick={() => setError('')} aria-label="Dismiss error">
                  <CrossIcon width={12} height={12} />
                </button>
              </div>
            )}

            <div className="auth-fields">
              {isRegister && (
                <div className="field">
                  <UserIcon width={16} height={16} className="field-icon" />
                  <input
                    id="auth-name"
                    className="auth-input"
                    type="text"
                    placeholder=" "
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                  <label htmlFor="auth-name">Full name</label>
                </div>
              )}
              <div className="field">
                <MailIcon width={16} height={16} className="field-icon" />
                <input
                  id="auth-email"
                  className="auth-input"
                  type="email"
                  placeholder=" "
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                <label htmlFor="auth-email">Email</label>
              </div>
              <div className="field">
                <LockIcon width={16} height={16} className="field-icon" />
                <input
                  id="auth-password"
                  className="auth-input"
                  type="password"
                  placeholder=" "
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                />
                <label htmlFor="auth-password">Password</label>
              </div>
            </div>

            <button className="primary-btn auth-submit-btn" type="submit" disabled={loading}>
              {loading ? (isRegister ? 'Creating account…' : 'Logging in…') : (isRegister ? 'Sign up' : 'Login')}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

export default AuthScreen;
