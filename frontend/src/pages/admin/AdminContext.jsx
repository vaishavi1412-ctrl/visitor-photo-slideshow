import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { admin as adminApi } from '../../api.js';

const AdminContext = createContext(null);

// Wraps every admin page. It asks the server once: "is an admin signed in?"
export function AdminProvider() {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .me()
      .then((data) => {
        if (!cancelled) setAdmin(data.admin);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await adminApi.login(username, password);
    setAdmin(data.admin);
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminApi.logout();
    } catch {
      // even if the server cannot be reached, leave the admin area
    }
    setAdmin(null);
  }, []);

  // Pages call this when the server answers 401, so the admin is sent back to the login page
  const sessionExpired = useCallback(() => setAdmin(null), []);

  return (
    <AdminContext.Provider value={{ admin, loading, login, logout, sessionExpired }}>
      <Outlet />
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}