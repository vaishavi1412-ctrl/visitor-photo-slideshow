import { NavLink, Link, Outlet } from 'react-router-dom';
import { useVisitor } from '../VisitorContext.jsx';

export default function Layout() {
  const { visitor } = useVisitor();

  return (
    <>
      <header className="navbar">
        <div className="container">
          <Link to="/" className="brand">
            📸 Photo Slideshow
          </Link>
          <nav className="nav-links">
            <NavLink to="/" end>
              Home
            </NavLink>
            {visitor && <NavLink to="/upload">Upload</NavLink>}
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
          <p>
            <a href="/slideshow" target="_blank" rel="noreferrer">
              Open slideshow screen
            </a>
            {' · '}
            <Link to="/admin/login">Admin</Link>
          </p>
        </div>
      </footer>
    </>
  );
}