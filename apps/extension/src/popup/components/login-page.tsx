import { useState } from 'react';

interface LoginPageProps {
  onLogin: (user: { id: string; email: string }) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    chrome.runtime.sendMessage(
      { type: 'LOGIN', payload: { email, password } },
      (response) => {
        setLoading(false);
        if (response?.ok) {
          onLogin(response.data);
        } else {
          setError(response?.error ?? 'Login failed');
        }
      }
    );
  };

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <h2>Sign in to CareerOS</h2>
      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input
          id="password"
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
        style={{ width: '100%', marginTop: 12 }}
        disabled={loading}
      >
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
