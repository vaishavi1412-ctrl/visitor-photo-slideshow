import { useCallback, useEffect, useState } from 'react';
import { admin as adminApi } from '../../api.js';
import { formatDate } from '../../utils/format.js';
import { useAdmin } from './AdminContext.jsx';

const FILTERS = [
  ['all', 'All'],
  ['visible', 'On the slideshow'],
  ['hidden', 'Hidden'],
];

export default function AdminPhotos() {
  const { sessionExpired } = useAdmin();
  const [photos, setPhotos] = useState(null);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fail = useCallback(
    (err) => {
      if (err.status === 401) sessionExpired();
      else setError(err.message);
    },
    [sessionExpired]
  );

  const load = useCallback(async () => {
    try {
      const [photoData, requestData] = await Promise.all([
        adminApi.photos(),
        adminApi.removalRequests(),
      ]);
      setPhotos(photoData.photos);
      setRequests(requestData.requests);
    } catch (err) {
      fail(err);
    }
  }, [fail]);

  useEffect(() => {
    load();
  }, [load]);

  // Runs one admin action, shows a message, then reloads the lists
  async function run(busyKey, action, successMessage) {
    setBusyId(busyKey);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(successMessage);
      await load();
    } catch (err) {
      fail(err);
    } finally {
      setBusyId(null);
    }
  }

  function toggleHidden(photo) {
    const next = photo.displayStatus === 'hidden' ? 'visible' : 'hidden';
    run(
      photo.id,
      () => adminApi.setPhotoStatus(photo.id, next),
      next === 'hidden' ? 'Photo hidden from the slideshow.' : 'Photo is back on the slideshow.'
    );
  }

  function deletePhoto(photo) {
    if (!window.confirm('Delete this photo for good? This cannot be undone.')) return;
    run(photo.id, () => adminApi.deletePhoto(photo.id), 'Photo deleted.');
  }

  function decide(request, status) {
    run(
      `request-${request.id}`,
      () => adminApi.decideRequest(request.id, status),
      status === 'approved'
        ? 'Request approved. The photo is hidden from the slideshow. You can delete it below.'
        : 'Request rejected. The photo stays on the slideshow.'
    );
  }

  const waiting = requests.filter((r) => r.status === 'pending').length;
  const shown = (photos || []).filter((p) => filter === 'all' || p.displayStatus === filter);

  return (
    <>
      <h1>Photos</h1>
      <p className="muted">Hide or delete photos, and answer removal requests from visitors.</p>

      {notice && (
        <div className="alert alert-success" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <h2>Removal requests{waiting > 0 ? ` (${waiting} waiting)` : ''}</h2>
      {requests.length === 0 ? (
        <p className="muted">No removal requests.</p>
      ) : (
        <ul className="requests">
          {requests.map((request) => (
            <li key={request.id} className="request">
              <img src={request.url} alt="" />
              <div>
                <p className="request-title">
                  <strong>{request.visitorName}</strong>{' '}
                  <span className={`status status-${request.status}`}>{request.status}</span>
                </p>
                <p className="muted">{request.reason || 'No reason given.'}</p>
                <p className="tile-meta">{formatDate(request.createdAt)}</p>
                {request.status === 'pending' && (
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn-small"
                      aria-label={`Approve removal request from ${request.visitorName}`}
                      disabled={busyId === `request-${request.id}`}
                      onClick={() => decide(request, 'approved')}
                    >
                      Approve and hide
                    </button>
                    <button
                      type="button"
                      className="btn-small"
                      aria-label={`Reject removal request from ${request.visitorName}`}
                      disabled={busyId === `request-${request.id}`}
                      onClick={() => decide(request, 'rejected')}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2>All photos{photos ? ` (${photos.length})` : ''}</h2>
      <div className="filters" role="group" aria-label="Filter photos">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`chip${filter === value ? ' is-on' : ''}`}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {!photos && !error && <p className="muted">Loading…</p>}
      {photos && shown.length === 0 && <p className="muted">No photos to show here.</p>}

      {shown.length > 0 && (
        <ul className="photo-grid">
          {shown.map((photo) => {
            const hidden = photo.displayStatus === 'hidden';
            return (
              <li key={photo.id} className="tile">
                <div className="tile-image">
                  <img src={photo.url} alt={`Photo by ${photo.visitorName}`} loading="lazy" />
                  {hidden && <span className="badge badge-hidden">Hidden</span>}
                  {!photo.consent && <span className="badge badge-hidden">No consent</span>}
                </div>
                <p className="tile-meta">
                  <strong>{photo.visitorName}</strong>
                  <br />
                  {formatDate(photo.uploadDate)}
                </p>
                <div className="tile-actions">
                  <button
                    type="button"
                    className="btn-small"
                    aria-label={`${hidden ? 'Show' : 'Hide'} photo by ${photo.visitorName}`}
                    disabled={busyId === photo.id}
                    onClick={() => toggleHidden(photo)}
                  >
                    {hidden ? 'Show on slideshow' : 'Hide from slideshow'}
                  </button>
                  <button
                    type="button"
                    className="btn-small"
                    aria-label={`Delete photo by ${photo.visitorName}`}
                    disabled={busyId === photo.id}
                    onClick={() => deletePhoto(photo)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}