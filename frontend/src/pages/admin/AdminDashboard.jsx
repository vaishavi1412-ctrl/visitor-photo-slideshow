import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { admin as adminApi } from '../../api.js';
import { formatDate } from '../../utils/format.js';
import { useAdmin } from './AdminContext.jsx';

function Stat({ label, value, testId, to }) {
  const body = (
    <>
      <span className="stat-label">{label}</span>
      <span className="stat-number" data-testid={testId}>
        {value}
      </span>
    </>
  );
  return to ? (
    <Link to={to} className="stat stat-alert">
      {body}
    </Link>
  ) : (
    <div className="stat">{body}</div>
  );
}

export default function AdminDashboard() {
  const { sessionExpired } = useAdmin();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    adminApi
      .stats()
      .then((data) => {
        if (!cancelled) setStats(data);
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

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">A quick look at your slideshow.</p>
        </div>
        <a href="/slideshow" target="_blank" rel="noreferrer" className="btn btn-accent">
          Open slideshow screen
        </a>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      {!stats && !error && <p className="muted">Loading…</p>}

      {stats && (
        <>
          <div className="stats">
            <Stat label="Visitors" value={stats.totalVisitors} testId="stat-visitors" />
            <Stat label="Photos uploaded" value={stats.totalPhotos} testId="stat-photos" />
            <Stat label="On the slideshow" value={stats.onSlideshow} testId="stat-slideshow" />
            <Stat
              label="Removal requests waiting"
              value={stats.pendingRemovalRequests}
              testId="stat-requests"
              to={stats.pendingRemovalRequests > 0 ? '/admin/photos' : undefined}
            />
          </div>

          <h2>Recent visitors</h2>
          {stats.recentVisitors.length === 0 ? (
            <p className="muted">No visitors yet. Share the site address so people can start uploading.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Joined</th>
                    <th>Photos</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentVisitors.map((visitor) => (
                    <tr key={visitor.id}>
                      <td>{visitor.fullName}</td>
                      <td>{formatDate(visitor.createdAt)}</td>
                      <td>{visitor.photoCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}