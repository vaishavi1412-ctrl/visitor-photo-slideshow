import { useCallback, useEffect, useState } from 'react';
import { admin as adminApi } from '../../api.js';
import { formatDate } from '../../utils/format.js';
import { useAdmin } from './AdminContext.jsx';

export default function AdminVisitors() {
  const { sessionExpired } = useAdmin();
  const [visitors, setVisitors] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fail = useCallback(
    (err) => {
      if (err.status === 401) sessionExpired();
      else setError(err.message);
    },
    [sessionExpired]
  );

  const load = useCallback(async () => {
    try {
      const data = await adminApi.visitors();
      setVisitors(data.visitors);
    } catch (err) {
      fail(err);
    }
  }, [fail]);

  useEffect(() => {
    load();
  }, [load]);

  function startRename(visitor) {
    setEditingId(visitor.id);
    setDraft(visitor.fullName);
    setError('');
    setNotice('');
  }

  async function saveRename(visitor) {
    setBusy(true);
    setError('');
    try {
      await adminApi.renameVisitor(visitor.id, draft);
      setEditingId(null);
      setNotice('Name updated.');
      await load();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function removeVisitor(visitor) {
    const count = visitor.photoCount;
    const message = `Delete ${visitor.fullName}? This also deletes ${count} ${
      count === 1 ? 'photo' : 'photos'
    } and cannot be undone.`;
    if (!window.confirm(message)) return;

    setBusy(true);
    setError('');
    setNotice('');
    try {
      await adminApi.deleteVisitor(visitor.id);
      setNotice('Visitor deleted.');
      await load();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Visitors</h1>
      <p className="muted">Everyone who has registered. Visitor codes are private and not shown here.</p>

      {notice && (
        <div className="alert alert-success" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {!visitors && !error && <p className="muted">Loading…</p>}
      {visitors && visitors.length === 0 && <p className="muted">No visitors yet.</p>}

      {visitors && visitors.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Joined</th>
                <th>Photos</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map((visitor) => (
                <tr key={visitor.id}>
                  <td>
                    {editingId === visitor.id ? (
                      <input
                        type="text"
                        value={draft}
                        maxLength={60}
                        aria-label={`New name for ${visitor.fullName}`}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(visitor);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                      />
                    ) : (
                      visitor.fullName
                    )}
                  </td>
                  <td>{formatDate(visitor.createdAt)}</td>
                  <td>{visitor.photoCount}</td>
                  <td>
                    <div className="row-actions">
                      {editingId === visitor.id ? (
                        <>
                          <button
                            type="button"
                            className="btn-small"
                            aria-label={`Save new name for ${visitor.fullName}`}
                            disabled={busy}
                            onClick={() => saveRename(visitor)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn-small"
                            disabled={busy}
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-small"
                            aria-label={`Rename ${visitor.fullName}`}
                            disabled={busy}
                            onClick={() => startRename(visitor)}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="btn-small"
                            aria-label={`Delete ${visitor.fullName}`}
                            disabled={busy}
                            onClick={() => removeVisitor(visitor)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}