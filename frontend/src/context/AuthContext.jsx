import React, { createContext, useContext, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

function readStoredUser() {
  const raw = localStorage.getItem('veritascan_user');
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem('veritascan_user');
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('veritascan_token'));
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function authenticate(mode, form) {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/auth/${mode}`, { method: 'POST', body: form });
      localStorage.setItem('veritascan_token', data.token);
      localStorage.setItem('veritascan_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('veritascan_token');
    localStorage.removeItem('veritascan_user');
    setToken(null);
    setUser(null);
    setError('');
  }

  const value = useMemo(
    () => ({ token, user, loading, error, authenticate, logout }),
    [token, user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
