import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';

const POLL_MS = 20000; // safety net: ask again now and then, even if the live connection drops
const HIDE_CONTROLS_MS = 3000;

function sameList(a, b) {
  return a.length === b.length && a.every((photo, i) => photo.id === b[i].id);
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    document.documentElement.requestFullscreen?.()?.catch(() => {});
  }
}

function Icon({ name }) {
  const paths = {
    prev: 'M6 5h2v14H6zM20 5v14L9 12z',
    next: 'M16 5h2v14h-2zM4 5v14l11-7z',
    play: 'M7 4v16l13-8z',
    pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
    fullscreen: 'M4 4h6v2H6v4H4zM14 4h6v6h-2V6h-4zM4 14h2v4h4v2H4zM18 14h2v6h-6v-2h4z',
  };
  return (
    <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

// One photo on screen: a blurred copy fills the background, the sharp photo sits on top
function Slide({ photo, mode, variant, onBroken }) {
  return (
    <div className={`slide is-${mode} kb-${variant}`}>
      <img className="bg" src={photo.url} alt="" aria-hidden="true" />
      <img
        className="fg"
        src={photo.url}
        alt="Photo shared by a visitor"
        decoding="async"
        onError={() => onBroken(photo)}
      />
    </div>
  );
}

export default function Slideshow() {
  const [searchParams] = useSearchParams();
  const tvMode = searchParams.get('tv') === '1'; // /slideshow?tv=1 starts in clean display mode

  const [photos, setPhotos] = useState([]);
  const [settings, setSettings] = useState({ photoDuration: 5, transitionType: 'fade' });
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);
  const [live, setLive] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [timerKey, setTimerKey] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // stage = what is on screen. tick counts photo changes (it restarts the timer and the timer bar).
  const [stage, setStage] = useState({ current: null, leaving: null, tick: 0, leavingTick: 0 });

  const photosRef = useRef([]);
  const stageRef = useRef(stage);
  const brokenRef = useRef(new Set()); // photos whose image failed to load
  const priorityRef = useRef([]); // brand-new photos that should be shown next
  const firstLoadRef = useRef(true);
  const hideTimerRef = useRef(null);

  // ---------- Loading the photo list ----------
  const loadSlideshow = useCallback(async () => {
    try {
      const res = await fetch('/api/slideshow', { cache: 'no-store' });
      if (!res.ok) throw new Error('bad response');
      const data = await res.json();
      const list = data.photos.filter((p) => !brokenRef.current.has(p.id));

      // After the first load, photos we have not seen before are shown at the next slide change
      if (!firstLoadRef.current) {
        const known = new Set(photosRef.current.map((p) => p.id));
        list.forEach((p) => {
          if (!known.has(p.id) && !priorityRef.current.includes(p.id)) {
            priorityRef.current.push(p.id);
          }
        });
      }
      firstLoadRef.current = false;

      setPhotos((prev) => (sameList(prev, list) ? prev : list));
      setSettings((prev) =>
        prev.photoDuration === data.settings.photoDuration &&
        prev.transitionType === data.settings.transitionType
          ? prev
          : data.settings
      );
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadSlideshow();
  }, [loadSlideshow]);

  useEffect(() => {
    const timer = setInterval(loadSlideshow, POLL_MS);
    return () => clearInterval(timer);
  }, [loadSlideshow]);

  // Live updates: the server says "photos:updated" after every upload, delete or settings change
  useEffect(() => {
    const socket = io();
    socket.on('connect', () => {
      setLive(true);
      loadSlideshow(); // catch up on anything missed while disconnected
    });
    socket.on('disconnect', () => setLive(false));
    socket.on('photos:updated', loadSlideshow);
    return () => socket.disconnect();
  }, [loadSlideshow]);

  // Keep refs in step with state, so timers and key presses see the latest values
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    photosRef.current = photos;
    setStage((prev) => {
      if (photos.length === 0) {
        return prev.current ? { ...prev, current: null, leaving: null } : prev;
      }
      if (!prev.current) {
        return { current: photos[0], leaving: null, tick: prev.tick + 1, leavingTick: prev.tick };
      }
      if (photos.some((p) => p.id === prev.current.id)) return prev;
      // the photo on screen was removed: move on
      return { current: photos[0], leaving: null, tick: prev.tick + 1, leavingTick: prev.tick };
    });
  }, [photos]);

  // ---------- Changing photo ----------
  const advance = useCallback((step = 1) => {
    const list = photosRef.current;
    const current = stageRef.current.current;
    if (list.length < 2 || !current) return;

    let next = null;
    if (step === 1) {
      while (priorityRef.current.length > 0 && !next) {
        const id = priorityRef.current.shift();
        next = list.find((p) => p.id === id && p.id !== current.id) || null;
      }
    }
    if (!next) {
      const i = list.findIndex((p) => p.id === current.id);
      next = list[(i + step + list.length) % list.length];
    }
    if (!next || next.id === current.id) return;

    setStage((prev) => ({
      current: next,
      leaving: prev.current,
      tick: prev.tick + 1,
      leavingTick: prev.tick,
    }));
  }, []);

  // Jump straight to a chosen photo (used by the thumbnails)
  const goTo = useCallback((photo) => {
    const current = stageRef.current.current;
    if (!photo || !current || photo.id === current.id) return;
    setStage((prev) => ({
      current: photo,
      leaving: prev.current,
      tick: prev.tick + 1,
      leavingTick: prev.tick,
    }));
  }, []);

  const togglePlay = useCallback(() => setPlaying((p) => !p), []);

  // Pressing Play starts a fresh countdown (and a fresh timer bar)
  useEffect(() => {
    if (playing) setTimerKey((k) => k + 1);
  }, [playing]);

  // Show each photo for "photoDuration" seconds, then move on (not while paused)
  const hasMany = photos.length > 1;
  useEffect(() => {
    if (!stage.current || !hasMany || !playing) return undefined;
    const timer = setTimeout(() => advance(1), settings.photoDuration * 1000);
    return () => clearTimeout(timer);
  }, [stage.tick, stage.current, hasMany, playing, timerKey, settings.photoDuration, advance]);

  // After the transition has finished, remove the old photo from the screen
  useEffect(() => {
    if (!stage.leaving) return undefined;
    const timer = setTimeout(() => setStage((s) => ({ ...s, leaving: null })), 1500);
    return () => clearTimeout(timer);
  }, [stage.leaving, stage.tick]);

  // Load the next photo in the background so it appears instantly
  useEffect(() => {
    if (!stage.current || photos.length < 2) return;
    const i = photos.findIndex((p) => p.id === stage.current.id);
    const upcoming = photos[(i + 1) % photos.length];
    if (upcoming) {
      const preload = new Image();
      preload.src = upcoming.url;
    }
  }, [stage.tick, stage.current, photos]);

  // Keep the highlighted thumbnail in view
  useEffect(() => {
    document
      .querySelector('.thumb.is-active')
      ?.scrollIntoView?.({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [stage.tick, photos.length]);

  // An image that fails to load is dropped, so a broken image is never shown
  const handleBroken = useCallback((photo) => {
    brokenRef.current.add(photo.id);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }, []);

  // ---------- Controls in display mode: appear on mouse move or touch, hide after a few seconds ----------
  const wake = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), HIDE_CONTROLS_MS);
  }, []);

  useEffect(() => () => clearTimeout(hideTimerRef.current), []);

  useEffect(() => {
    function onKey(event) {
      const onControl =
        event.target instanceof Element && event.target.closest('button, a, input, textarea');

      if (event.key === 'ArrowRight') {
        advance(1);
        wake();
      } else if (event.key === 'ArrowLeft') {
        advance(-1);
        wake();
      } else if ((event.key === ' ' || event.code === 'Space') && !onControl) {
        event.preventDefault();
        togglePlay();
        wake();
      } else if (event.key === 'f' || event.key === 'F') {
        toggleFullscreen();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, togglePlay, wake]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // ---------- What to draw ----------
  const currentIndex = stage.current ? photos.findIndex((p) => p.id === stage.current.id) : -1;
  const showEmpty = loaded && photos.length === 0;
  const clean = fullscreen || tvMode; // clean mode hides the buttons until the mouse moves

  return (
    <div
      className={`tv${clean ? ' clean' : ''}${controlsVisible ? ' show-controls' : ''}`}
      data-transition={settings.transitionType}
      style={{ '--slide-ms': `${settings.photoDuration}s` }}
      onMouseMove={wake}
      onTouchStart={wake}
    >
      <header className="tv-header">
        <span className="tv-title">Live slideshow</span>
        <span className="tv-pill">
          <i className={`dot${live ? ' on' : ''}`} />
          {live ? 'Live' : 'Reconnecting…'}
        </span>
        <span className="tv-address">
          Add your photo at <strong>{window.location.host}</strong>
        </span>
        <Link to="/" className="tv-btn">
          Back to site
        </Link>
      </header>

      <div className="tv-stage">
        {!loaded && (
          <div className="tv-empty">
            <p>Loading slideshow…</p>
          </div>
        )}

        {showEmpty && offline && (
          <div className="tv-empty">
            <h1>Can&rsquo;t reach the server</h1>
            <p>The slideshow will start by itself as soon as the connection is back.</p>
          </div>
        )}

        {showEmpty && !offline && (
          <div className="tv-empty">
            <div className="empty-frames" aria-hidden="true">
              <div className="empty-frame">
                <i style={{ background: 'var(--flamingo)' }} />
              </div>
              <div className="empty-frame">
                <i style={{ background: 'var(--marigold)' }} />
              </div>
              <div className="empty-frame">
                <i style={{ background: 'var(--mint)' }} />
              </div>
            </div>
            <h1>Be the first on the big screen</h1>
            <p>
              Open this address on your phone, add your name and upload a few photos. They show up
              here within seconds.
            </p>
            <span className="tv-url">{window.location.host}</span>
          </div>
        )}

        {stage.current && (
          <>
            {stage.leaving && (
              <Slide
                key={`slide-${stage.leavingTick}`}
                photo={stage.leaving}
                mode="leaving"
                variant={stage.leavingTick % 2}
                onBroken={handleBroken}
              />
            )}
            <Slide
              key={`slide-${stage.tick}`}
              photo={stage.current}
              mode="entering"
              variant={stage.tick % 2}
              onBroken={handleBroken}
            />
            {hasMany && (
              <div className={`tv-timer${playing ? '' : ' paused'}`}>
                {/* the key restarts the bar for every new photo and every Play */}
                <span key={`${stage.tick}-${timerKey}`} />
              </div>
            )}
            {hasMany && !playing && <div className="tv-paused">Paused</div>}
          </>
        )}

        {clean && photos.length > 0 && (
          <div className="tv-join">
            Add your photo at <strong>{window.location.host}</strong>
          </div>
        )}
      </div>

      <div className="tv-bottom">
        {photos.length > 0 && (
          <div className="tv-strip">
            {photos.map((photo, i) => (
              <button
                key={photo.id}
                type="button"
                className={`thumb${i === currentIndex ? ' is-active' : ''}`}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === currentIndex ? 'true' : undefined}
                onClick={() => goTo(photo)}
              >
                <img src={photo.url} alt="" loading="lazy" onError={() => handleBroken(photo)} />
              </button>
            ))}
          </div>
        )}

        <div className="tv-dock" role="toolbar" aria-label="Slideshow controls">
          <div className="dock-info">
            <span className="dock-count" data-testid="count">
              {photos.length > 0 && currentIndex >= 0
                ? `Photo ${currentIndex + 1} of ${photos.length}`
                : 'No photos yet'}
            </span>
            <span className="dock-meta">
              {settings.photoDuration} seconds per photo, {settings.transitionType} transition
            </span>
          </div>

          <div className="dock-buttons">
            <button type="button" className="tv-btn" onClick={() => advance(-1)} disabled={!hasMany}>
              <Icon name="prev" />
              Previous
            </button>
            <button
              type="button"
              className="tv-btn tv-btn-main"
              onClick={togglePlay}
              disabled={!hasMany}
            >
              <Icon name={playing ? 'pause' : 'play'} />
              {playing ? 'Pause' : 'Play'}
            </button>
            <button type="button" className="tv-btn" onClick={() => advance(1)} disabled={!hasMany}>
              Next
              <Icon name="next" />
            </button>
          </div>

          <div className="dock-right">
            <button type="button" className="tv-btn" onClick={toggleFullscreen}>
              <Icon name="fullscreen" />
              {fullscreen ? 'Exit full screen' : 'Full screen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}