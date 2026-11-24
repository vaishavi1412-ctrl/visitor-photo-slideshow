import { useEffect, useState } from 'react';

// Four little illustrated "photos" for the home page preview.
// They are only decoration: real visitor photos appear on the slideshow screen.
const SLIDES = [
  {
    caption: 'Golden hour',
    scene: (
      <>
        <rect width="300" height="300" fill="#ffc93c" />
        <circle cx="150" cy="170" r="70" fill="#ff5c93" />
        <path d="M0 220 Q80 160 150 210 T300 190 V300 H0Z" fill="#3a35f2" />
        <path d="M0 260 Q100 220 200 255 T300 245 V300 H0Z" fill="#1a1340" />
      </>
    ),
  },
  {
    caption: 'Up, up and away',
    scene: (
      <>
        <rect width="300" height="300" fill="#2fd0a4" />
        <path d="M100 165 L150 280 M170 128 L150 280 M205 192 L150 280" stroke="#1a1340" strokeWidth="3" fill="none" />
        <circle cx="100" cy="120" r="45" fill="#ff5c93" stroke="#1a1340" strokeWidth="3" />
        <circle cx="170" cy="90" r="38" fill="#ffc93c" stroke="#1a1340" strokeWidth="3" />
        <circle cx="205" cy="150" r="42" fill="#3a35f2" stroke="#1a1340" strokeWidth="3" />
        <rect x="133" y="270" width="34" height="22" rx="4" fill="#1a1340" />
      </>
    ),
  },
  {
    caption: 'City lights',
    scene: (
      <>
        <rect width="300" height="300" fill="#3a35f2" />
        <circle cx="230" cy="70" r="28" fill="#ffc93c" />
        <rect x="20" y="150" width="50" height="150" fill="#1a1340" />
        <rect x="75" y="110" width="60" height="190" fill="#ff5c93" />
        <rect x="140" y="170" width="50" height="130" fill="#1a1340" />
        <rect x="195" y="130" width="55" height="170" fill="#ffc93c" />
        <rect x="255" y="180" width="45" height="120" fill="#1a1340" />
        <g fill="#ffffff" opacity="0.85">
          <rect x="32" y="170" width="10" height="10" />
          <rect x="48" y="200" width="10" height="10" />
          <rect x="90" y="140" width="10" height="10" />
          <rect x="110" y="180" width="10" height="10" />
          <rect x="210" y="160" width="10" height="10" />
          <rect x="228" y="200" width="10" height="10" />
        </g>
      </>
    ),
  },
  {
    caption: 'In bloom',
    scene: (
      <>
        <rect width="300" height="300" fill="#ff5c93" />
        <path d="M150 190 V300" stroke="#1a1340" strokeWidth="8" />
        <g transform="translate(150 140)" fill="#ffc93c" stroke="#1a1340" strokeWidth="3">
          <circle cx="50" cy="0" r="28" />
          <circle cx="25" cy="43" r="28" />
          <circle cx="-25" cy="43" r="28" />
          <circle cx="-50" cy="0" r="28" />
          <circle cx="-25" cy="-43" r="28" />
          <circle cx="25" cy="-43" r="28" />
          <circle cx="0" cy="0" r="26" fill="#1a1340" />
        </g>
      </>
    ),
  },
];

const SLIDE_MS = 3600;

export default function HeroStack() {
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Respect people who turned off animations in their system settings
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(query.matches);
    const onChange = (event) => setReduceMotion(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Move to the next photo every few seconds
  useEffect(() => {
    if (reduceMotion) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  return (
    <div className="hero-stage" aria-hidden="true">
      <div className="polaroids">
        {SLIDES.map((slide, i) => (
          <figure
            key={slide.caption}
            className="polaroid"
            data-pos={(i - index + SLIDES.length) % SLIDES.length}
          >
            <div className="photo">
              <svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice">
                {slide.scene}
              </svg>
            </div>
            <figcaption>{slide.caption}</figcaption>
          </figure>
        ))}
      </div>

      {!reduceMotion && (
        <div className="timer">
          {/* key={index} restarts the bar every time the photo changes */}
          <span key={index} />
        </div>
      )}
      <p className="stage-note">
        Slideshow preview, photo {index + 1} of {SLIDES.length}
      </p>
    </div>
  );
}