import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAdmin } from './AdminContext.jsx';

export default function AdminLogin() {
  const { admin, loading, login } = useAdmin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Already signed in: go straight to the dashboard
  if (!loading && admin) {
    return <Navigate to="/admin" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(username.trim(), password); // on success the page redirects by itself
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-login">
      <div className="card">
        <h1>Admin sign in</h1>
        <p className="muted">For venue staff only.</p>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="help">
          <Link to="/">Back to the visitor site</Link>
        </p>
      </div>
    </div>
  );
}