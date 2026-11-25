import { useEffect, useState } from 'react';
import { admin as adminApi } from '../../api.js';
import { useAdmin } from './AdminContext.jsx';

const DESCRIPTIONS = {
  fade: 'Photos blend softly into each other.',
  slide: 'Each new photo pushes the last one out to the left.',
  zoom: 'New photos grow into view while the old one shrinks away.',
};

export default function AdminSettings() {
  const { sessionExpired } = useAdmin();
  const [limits, setLimits] = useState(null);
  const [duration, setDuration] = useState('5');
  const [transition, setTransition] = useState('fade');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .settings()
      .then((data) => {
        if (cancelled) return;
        setLimits(data.limits);
        setDuration(String(data.settings.photoDuration));
        setTransition(data.settings.transitionType);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) sessionExpired();
        else setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionExpired]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSaved(false);

    const seconds = Number(duration);
    if (!Number.isInteger(seconds) || seconds < limits.minDuration || seconds > limits.maxDuration) {
      setError(
        `Choose a whole number of seconds from ${limits.minDuration} to ${limits.maxDuration}.`
      );
      return;
    }

    setSaving(true);
    try {
      await adminApi.saveSettings(seconds, transition);
      setSaved(true);
    } catch (err) {
      if (err.status === 401) sessionExpired();
      else setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h1>Slideshow settings</h1>
      <p className="muted">Changes reach every open slideshow screen within a few seconds.</p>

      {!limits && !error && <p className="muted">Loading…</p>}
      {!limits && error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {limits && (
        <form onSubmit={handleSubmit} noValidate className="settings-form">
          <label htmlFor="duration">Seconds per photo</label>
          <input
            id="duration"
            type="number"
            min={limits.minDuration}
            max={limits.maxDuration}
            value={duration}
            onChange={(e) => {
              setDuration(e.target.value);
              setSaved(false);
            }}
          />
          <p className="help">
            From {limits.minDuration} to {limits.maxDuration} seconds.
          </p>

          <fieldset className="choices">
            <legend>Transition between photos</legend>
            {limits.transitions.map((name) => (
              <label key={name} className="choice">
                <input
                  type="radio"
                  name="transition"
                  value={name}
                  checked={transition === name}
                  onChange={() => {
                    setTransition(name);
                    setSaved(false);
                  }}
                />
                <span>
                  <strong>{name.charAt(0).toUpperCase() + name.slice(1)}</strong>
                  <small>{DESCRIPTIONS[name] || ''}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <p className="settings-summary">
            Every photo will be shown for {duration || '…'} seconds with the {transition} transition.
          </p>

          {saved && (
            <div className="alert alert-success" role="status">
              Settings saved. Open slideshow screens update within a few seconds.
            </div>
          )}
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      )}
    </>
  );
}