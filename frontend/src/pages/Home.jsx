import { Link } from 'react-router-dom';
import { useVisitor } from '../VisitorContext.jsx';

export default function Home() {
  const { visitor, loading, forget } = useVisitor();

  return (
    <>
      <section className="hero">
        <h1>Share your photos on the big screen</h1>
        <p>
          Upload your photos, give your consent, and watch them appear in our live slideshow on the
          display screen.
        </p>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : visitor ? (
          <div className="card narrow">
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
      </section>

      <section>
        <h2 className="section-title">How it works</h2>
        <div className="steps">
          <div className="card">
            <div className="step-number">1</div>
            <h3>Tell us your name</h3>
            <p className="muted">Register once. We remember this device so next time is quicker.</p>
          </div>
          <div className="card">
            <div className="step-number">2</div>
            <h3>Upload your photos</h3>
            <p className="muted">Choose JPG, PNG or WEBP images up to 5 MB each and tick the consent box.</p>
          </div>
          <div className="card">
            <div className="step-number">3</div>
            <h3>Watch them appear</h3>
            <p className="muted">Your photos join the live slideshow within seconds.</p>
          </div>
        </div>
      </section>

      <section className="card privacy-box">
        <h2>Your privacy</h2>
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