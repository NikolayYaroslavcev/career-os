import { useState, useEffect } from 'react';

export function AuthSection() {
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'CHECK_AUTH', payload: {} }, (response) => {
      setAuthenticated(response?.data?.authenticated ?? false);
      setUserEmail(response?.data?.user?.email ?? '');
    });
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    chrome.runtime.sendMessage(
      { type: 'LOGIN', payload: { email, password } },
      (response) => {
        setLoading(false);
        if (response?.ok) {
          setAuthenticated(true);
          setUserEmail(response.data.email);
          setEmail('');
          setPassword('');
        } else {
          setError(response?.error ?? 'Login failed');
        }
      }
    );
  };

  const handleLogout = () => {
    chrome.runtime.sendMessage({ type: 'LOGOUT', payload: {} }, () => {
      setAuthenticated(false);
      setUserEmail('');
    });
  };

  return (
    <div className="section">
      <h2>Authentication</h2>
      {authenticated ? (
        <div>
          <div className="form-row">
            <label>Signed in as</label>
            <span>{userEmail}</span>
          </div>
          <div className="btn-group">
            <button className="btn btn-danger" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
            />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      )}
    </div>
  );
}
