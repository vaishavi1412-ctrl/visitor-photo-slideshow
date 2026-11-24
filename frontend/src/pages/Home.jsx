import { Link } from 'react-router-dom';
import { useVisitor } from '../VisitorContext.jsx';
import HeroStack from '../components/HeroStack.jsx';

export default function Home() {
  const { visitor, loading, forget } = useVisitor();

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>Put your photos on the big screen</h1>
          <p className="lead">
            Add your name, upload a few photos and tick the consent box. They join the live
            slideshow within seconds.
          </p>

          {loading ? (
            <p className="muted">Loading…</p>
          ) : visitor ? (
            <div className="card welcome-card">
              <h2>Welcome back, {visitor.fullName}!</h2>
              <p className="muted">We recognized this device, so you can go straight to your photos.</p>
              <div className="actions">
                <Link to="/upload" className="btn btn-primary">
                  Continue to upload
                </Link>
                <button type="button" className="btn btn-secondary" onClick={forget}>
                  This is not me
                </button>
              </div>
            </div>
          ) : (
            <div className="actions">
              <Link to="/register" className="btn btn-primary">
                I am a new visitor
              </Link>
              <Link to="/returning" className="btn btn-secondary">
                I have been here before
              </Link>
            </div>
          )}
        </div>

        <HeroStack />
      </section>

      <section className="section">
        <h2 className="section-title">How it works</h2>
        <div className="filmstrip">
          <article className="frame">
            <span className="step-number">1</span>
            <h3>Tell us your name</h3>
            <p>Register once. We remember this device, so next time is quicker.</p>
          </article>
          <article className="frame">
            <span className="step-number">2</span>
            <h3>Upload your photos</h3>
            <p>Choose JPG, PNG or WEBP images up to 5 MB each and tick the consent box.</p>
          </article>
          <article className="frame">
            <span className="step-number">3</span>
            <h3>Watch them appear</h3>
            <p>Your photos join the live slideshow within seconds.</p>
          </article>
        </div>
      </section>

      <section className="promise">
        <div>
          <h2>Nothing goes on screen without your say-so</h2>
          <p>You choose which photos to share, and you can take them down whenever you like.</p>
        </div>
        <ul>
          <li>Your photos are shown only on the public slideshow screen at this venue.</li>
          <li>They appear only if you tick the consent box when uploading.</li>
          <li>Your name is never shown on the slideshow.</li>
          <li>You can delete your photos or ask the admin to remove them at any time.</li>
        </ul>
      </section>
    </>
  );
}