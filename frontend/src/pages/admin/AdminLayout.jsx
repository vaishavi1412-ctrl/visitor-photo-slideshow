import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAdmin } from './AdminContext.jsx';

// The frame around every admin page. It also keeps strangers out.
export default function AdminLayout() {
  const { admin, loading, logout } = useAdmin();

  if (loading) {
    return <p className="muted admin-loading">Loading…</p>;
  }
  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="admin">
      <aside className="admin-side">
        <div className="admin-brand">
          <span className="admin-mark" aria-hidden="true" />
          <div>
            <strong>Slideshow admin</strong>
            <span className="admin-user">Signed in as {admin.username}</span>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Admin">
          <NavLink to="/admin" end>
            Dashboard
          </NavLink>
          <NavLink to="/admin/photos">Photos</NavLink>
          <NavLink to="/admin/visitors">Visitors</NavLink>
          <NavLink to="/admin/settings">Settings</NavLink>
        </nav>

        <div className="admin-side-links">
          <a href="/slideshow" target="_blank" rel="noreferrer">
            Open slideshow screen
          </a>
          <Link to="/">Back to site</Link>
          <button type="button" className="btn-small" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}