import { useState } from 'react';
import { api } from '../api.js';

// One of the visitor's own photos, with Delete and Request removal
export default function PhotoTile({ photo, isNew, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    if (!window.confirm('Delete this photo? It will be removed from the slideshow for good.')) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.deletePhoto(photo.id);
      onDeleted(photo.id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function handleRequest(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.requestRemoval(photo.id, reason);
      setSent(true);
      setAsking(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="tile">
      <div className="tile-image">
        <img src={photo.url} alt="One of your uploaded photos" loading="lazy" />
        {isNew && <span className="badge badge-new">New</span>}
        {photo.displayStatus === 'hidden' && <span className="badge badge-hidden">Hidden</span>}
      </div>

      {!asking && (
        <div className="tile-actions">
          <button type="button" className="btn-small" onClick={handleDelete} disabled={busy}>
            Delete
          </button>
          <button
            type="button"
            className="btn-small"
            onClick={() => setAsking(true)}
            disabled={busy || sent}
          >
            Request removal
          </button>
        </div>
      )}

      {asking && (
        <form onSubmit={handleRequest} className="tile-form">
          <label htmlFor={`reason-${photo.id}`} className="tile-label">
            Why should it be removed? (optional)
          </label>
          <textarea
            id={`reason-${photo.id}`}
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="tile-actions">
            <button type="submit" className="btn-small" disabled={busy}>
              Send request
            </button>
            <button type="button" className="btn-small" onClick={() => setAsking(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {sent && <p className="tile-note">Request sent. The admin will review it.</p>}
      {error && (
        <p className="tile-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}