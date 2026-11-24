import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useVisitor } from '../VisitorContext.jsx';

export default function Returning() {
  const { visitor, loading, setVisitor, forget } = useVisitor();
  const [visitorCode, setVisitorCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (visitorCode.trim().length !== 6 || fullName.trim().length < 2) {
      setError('Please enter your 6-character visitor code and your full name.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await api.loginReturning(visitorCode, fullName);
      setVisitor(data.visitor);
      navigate('/upload');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="muted">Loading…</p>;
  }

  // This browser was already recognized by its cookie
  if (visitor) {
    return (
      <div className="card narrow">
        <h1>Welcome back, {visitor.fullName}!</h1>
        <p className="muted">We recognized this device, so there is nothing to type.</p>
        <div className="actions">
          <Link to="/upload" className="btn btn-primary">
            Continue to upload
          </Link>
          <button type="button" className="btn btn-secondary" onClick={forget}>
            This is not me
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card narrow">
      <h1>Returning visitor</h1>
      <p className="muted">
        Enter the visitor code you received after your first upload, and your full name.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="visitorCode">Visitor code</label>
        <input
          id="visitorCode"
          type="text"
          value={visitorCode}
          onChange={(e) => setVisitorCode(e.target.value.toUpperCase())}
          placeholder="e.g. K7M2QX"
          maxLength={6}
          autoComplete="off"
          className="code-input"
        />

        <label htmlFor="fullName">Full name</label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="The name you registered with"
          maxLength={60}
          autoComplete="name"
        />

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Please wait…' : 'Find my photos'}
        </button>
      </form>

      <p className="help">
        Lost your code, or new here? <Link to="/register">Register as a new visitor</Link>.
      </p>
    </div>
  );
}