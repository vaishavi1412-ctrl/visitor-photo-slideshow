import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useVisitor } from '../VisitorContext.jsx';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { setVisitor } = useVisitor();
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault(); // stop the browser from reloading the page
    setError('');

    if (fullName.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await api.register(fullName);
      setVisitor(data.visitor);
      navigate('/upload');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card narrow">
      <h1>New visitor</h1>
      <p className="muted">Enter your full name to get started.</p>

      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="fullName">Full name</label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="e.g. Asha Patel"
          maxLength={60}
          autoComplete="name"
          autoFocus
        />

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Please wait…' : 'Continue'}
        </button>
      </form>

      <p className="help">
        <strong>How we recognize you next time:</strong> this device gets a private cookie, and you
        get a short visitor code. If you visit from another device, the code and your name bring
        your photos back.
      </p>
      <p className="help">
        Been here before? <Link to="/returning">Sign in as a returning visitor</Link>.
      </p>
    </div>
  );
}