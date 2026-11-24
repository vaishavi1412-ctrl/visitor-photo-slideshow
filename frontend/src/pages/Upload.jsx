import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useVisitor } from '../VisitorContext.jsx';

const MAX_MB = 5;
const MAX_FILES = 10;
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Returns a reason when the file is not acceptable, or null when it is fine
function checkFile(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension) || !ALLOWED_TYPES.includes(file.type)) {
    return 'is not a JPG, PNG or WEBP image.';
  }
  if (file.size === 0) return 'is empty.';
  if (file.size > MAX_MB * 1024 * 1024) return `is larger than ${MAX_MB} MB.`;
  return null;
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Upload() {
  const { visitor, loading } = useVisitor();
  const navigate = useNavigate();

  const [items, setItems] = useState([]); // chosen photos: { id, file, previewUrl }
  const [problems, setProblems] = useState([]); // files that were not added, with reasons
  const [consent, setConsent] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [failed, setFailed] = useState([]); // photos the server rejected
  const [existingCount, setExistingCount] = useState(0);

  const nextId = useRef(1);
  const itemsRef = useRef([]);

  // Keep a copy of the list so we can free the preview memory when leaving the page
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  // Returning visitors: tell them how many photos they already have
  useEffect(() => {
    if (!visitor) return undefined;
    let cancelled = false;
    api
      .getMyPhotos()
      .then((data) => {
        if (!cancelled) setExistingCount(data.photos.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visitor]);

  function addFiles(fileList) {
    const messages = [];
    const accepted = [];
    const seen = new Set(items.map((i) => `${i.file.name}|${i.file.size}|${i.file.lastModified}`));

    for (const file of Array.from(fileList)) {
      const key = `${file.name}|${file.size}|${file.lastModified}`;
      const problem = checkFile(file);

      if (problem) {
        messages.push(`${file.name} ${problem}`);
      } else if (seen.has(key)) {
        messages.push(`${file.name} is already in your list.`);
      } else if (items.length + accepted.length >= MAX_FILES) {
        messages.push(`${file.name} was skipped. You can upload up to ${MAX_FILES} photos at a time.`);
      } else {
        seen.add(key);
        accepted.push(file);
      }
    }

    if (accepted.length > 0) {
      const newItems = accepted.map((file) => ({
        id: nextId.current++,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      setItems([...items, ...newItems]);
    }

    setProblems(messages);
    setFailed([]);
    setError('');
  }

  function removeItem(id) {
    const target = items.find((item) => item.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    setItems(items.filter((item) => item.id !== id));
    setFailed([]);
    setError('');
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    if (!uploading) addFiles(event.dataTransfer.files);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setFailed([]);

    if (items.length === 0) {
      setError('Choose at least one photo first.');
      return;
    }
    if (!consent) {
      setError('Please tick the consent box so we can show your photos on the slideshow.');
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const data = await api.uploadPhotos(
        items.map((item) => item.file),
        setProgress
      );

      if (data.savedCount === 0) {
        // Nothing was saved: stay here and explain why, photo by photo
        setFailed(data.results);
        setError('None of your photos could be saved.');
      } else {
        navigate('/success', { state: { results: data.results } });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return <p className="muted">Loading…</p>;
  }

  if (!visitor) {
    return (
      <div className="card narrow">
        <h1>Register first</h1>
        <p className="muted">We need your name before you can upload photos.</p>
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

  return (
    <div className="wide">
      <h1>Upload your photos</h1>
      <p className="muted">
        Hi {visitor.fullName.split(' ')[0]}! Choose the photos you would like to show on the
        slideshow screen.
      </p>

      {existingCount > 0 && (
        <p className="notice">
          You already have {existingCount} {existingCount === 1 ? 'photo' : 'photos'} with us.{' '}
          <Link to="/success">View or manage them</Link>
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <label
          className={`dropzone${dragging ? ' is-dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <input
            type="file"
            className="visually-hidden"
            multiple
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = ''; // lets the visitor pick the same file again later
            }}
          />
          <span className="dropzone-title">Drop photos here or tap to choose</span>
          <span className="dropzone-hint">
            JPG, PNG or WEBP, up to {MAX_MB} MB each, up to {MAX_FILES} photos at a time.
          </span>
        </label>

        {problems.length > 0 && (
          <div className="alert alert-error" role="alert">
            <strong>Some files were not added:</strong>
            <ul>
              {problems.map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        {items.length > 0 && (
          <>
            <h2 className="photo-section-title">Ready to upload ({items.length})</h2>
            <ul className="previews">
              {items.map((item) => (
                <li key={item.id} className="preview">
                  <img src={item.previewUrl} alt={`Preview of ${item.file.name}`} />
                  <button
                    type="button"
                    className="preview-remove"
                    aria-label={`Remove ${item.file.name}`}
                    disabled={uploading}
                    onClick={() => removeItem(item.id)}
                  >
                    ×
                  </button>
                  <div className="preview-info">
                    <span className="preview-name">{item.file.name}</span>
                    {formatSize(item.file.size)}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <fieldset className="consent">
          <legend>Where your photos will be shown</legend>
          <p>
            Your photos will be shown full screen on the public slideshow display at this venue,
            one at a time, for a few seconds each. Only the photo is shown, never your name. You
            can delete your photos or ask for their removal at any time.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={consent}
              disabled={uploading}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>I agree that these photos may be shown on the public slideshow screen.</span>
          </label>
        </fieldset>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
            {failed.length > 0 && (
              <ul>
                {failed.map((result, index) => (
                  <li key={index}>
                    <strong>{result.fileName}</strong>: {result.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {uploading && (
          <>
            <div
              className="progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            <p className="progress-label">
              {progress < 100 ? `Uploading… ${progress}%` : 'Checking and saving your photos…'}
            </p>
          </>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={uploading}>
          {uploading
            ? 'Uploading…'
            : items.length > 0
              ? `Upload ${items.length} ${items.length === 1 ? 'photo' : 'photos'}`
              : 'Upload photos'}
        </button>
      </form>
    </div>
  );
}