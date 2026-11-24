import { NavLink, Link, Outlet } from 'react-router-dom';
import { useVisitor } from '../VisitorContext.jsx';

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="4" width="28" height="24" rx="6" fill="#ffc93c" stroke="#1a1340" strokeWidth="2.5" />
      <circle cx="12" cy="13" r="3.2" fill="#ff5c93" stroke="#1a1340" strokeWidth="1.5" />
      <path d="M5 25l7-8 5 5 4-4 7 7z" fill="#3a35f2" stroke="#1a1340" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export default function Layout() {
  const { visitor } = useVisitor();

  return (
    <>
      <header className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="brand">
            <BrandMark />
            <span>Photo Slideshow</span>
          </Link>
          <nav className="nav-links">
            <NavLink to="/" end>
              Home
            </NavLink>
            {visitor && <NavLink to="/upload">Upload</NavLink>}
            {visitor && <NavLink to="/success">My photos</NavLink>}
            {visitor && <span className="nav-user">Hi, {visitor.fullName.split(' ')[0]}</span>}
          </nav>
        </div>
      </header>

      <main>
        <div className="container">
          <Outlet />
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <p>
            Photos are shown on our public slideshow screen only if you give your consent, and you
            can ask for them to be removed at any time.
          </p>
          <div className="footer-links">
            <a href="/slideshow" target="_blank" rel="noreferrer">
              Open slideshow screen
            </a>
            <Link to="/admin/login">Admin</Link>
          </div>
        </div>
      </footer>
    </>
  );
}