import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const VisitorContext = createContext(null);

// Asks the backend "who is this browser?" once, when the app opens
export function VisitorProvider({ children }) {
  const [visitor, setVisitor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getMe()
      .then((data) => {
        if (!cancelled) setVisitor(data.visitor);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // "This is not me": forget this device
  const forget = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // even if the server cannot be reached, clear what we show
    }
    setVisitor(null);
  }, []);

  return (
    <VisitorContext.Provider value={{ visitor, setVisitor, loading, forget }}>
      {children}
    </VisitorContext.Provider>
  );
}

export function useVisitor() {
  return useContext(VisitorContext);
}