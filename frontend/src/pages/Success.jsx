import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useVisitor } from '../VisitorContext.jsx';
import PhotoTile from '../components/PhotoTile.jsx';

export default function Success() {
  const { visitor, loading } = useVisitor();
  const location = useLocation();
  const results = location.state?.results || null; // present right after an upload

  const [photos, setPhotos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visitor) return undefined;
    let cancelled = false;
    api
      .getMyPhotos()
      .then((data) => {
        if (!cancelled) setPhotos(data.photos);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [visitor]);

  function handleDeleted(id) {
    setPhotos((current) => current.filter((photo) => photo.id !== id));
  }

  if (loading) {
    return <p className="muted">Loading…</p>;
  }

  if (!visitor) {
    return (
      <div className="card narrow">
        <h1>Your photos</h1>
        <p className="muted">Please register or sign in to see your photos.</p>
        <div className="actions">
          <Link to="/register" className="btn btn-primary">
            I am a new visitor
          </Link>
          <Link to="/returning" className="btn btn-secondary">
            I have been here before
          </Link>
        </div>
      </div>
    );
  }

  const savedIds = new Set(
    (results || []).filter((r) => r.status === 'saved').map((r) => r.photo.id)
  );
  const notSaved = (results || []).filter((r) => r.status !== 'saved');
  const newPhotos = (photos || []).filter((p) => savedIds.has(p.id));
  const earlierPhotos = (photos || []).filter((p) => !savedIds.has(p.id));

  return (
    <div className="wide">
      {savedIds.size > 0 ? (
        <>
          <h1>
            Done! {savedIds.size} {savedIds.size === 1 ? 'photo' : 'photos'} uploaded
          </h1>
          <div className="alert alert-success" role="status">
            Your photos will appear on the slideshow screen in a few seconds.
          </div>
        </>
      ) : (
        <h1>Your photos</h1>
      )}

      {notSaved.length > 0 && (
        <div className="alert alert-error" role="alert">
          <strong>These photos were not saved:</strong>
          <ul>
            {notSaved.map((result, index) => (
              <li key={index}>
                <strong>{result.fileName}</strong>: {result.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="code-card">
        <div>
          <p className="code-label">Your visitor code</p>
          <p className="code-value">{visitor.visitorCode}</p>
        </div>
        <p className="muted">
          Keep this code. On another device, choose &ldquo;I have been here before&rdquo; and enter
          it with your name to see your photos again.
        </p>
      </div>

      <div className="actions">
        <Link to="/upload" className="btn btn-primary">
          Upload more photos
        </Link>
        <a href="/slideshow" target="_blank" rel="noreferrer" className="btn btn-secondary">
          Open slideshow screen
        </a>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {photos && photos.length === 0 && (
        <div className="card empty-note">
          <p className="muted">You have no photos yet.</p>
          <Link to="/upload" className="btn btn-accent">
            Upload your first photo
          </Link>
        </div>
      )}

      {newPhotos.length > 0 && (
        <>
          <h2 className="photo-section-title">Just uploaded ({newPhotos.length})</h2>
          <ul className="photo-grid">
            {newPhotos.map((photo) => (
              <PhotoTile key={photo.id} photo={photo} isNew onDeleted={handleDeleted} />
            ))}
          </ul>
        </>
      )}

      {earlierPhotos.length > 0 && (
        <>
          <h2 className="photo-section-title">
            {savedIds.size > 0 ? 'Your earlier photos' : 'Your photos'} ({earlierPhotos.length})
          </h2>
          <ul className="photo-grid">
            {earlierPhotos.map((photo) => (
              <PhotoTile key={photo.id} photo={photo} onDeleted={handleDeleted} />
            ))}
          </ul>
        </>
      )}

      {photos && photos.length > 0 && (
        <p className="help">
          <strong>Delete</strong> removes a photo straight away. <strong>Request removal</strong>{' '}
          asks the admin to review it instead.
        </p>
      )}
    </div>
  );
}