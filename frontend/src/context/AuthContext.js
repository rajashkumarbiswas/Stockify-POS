'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load the real user from the backend (the cookie is the only credential)
  const loadUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
    } catch (error) {
      setUser(null);
      // A stale/invalid cookie would otherwise stay in the browser: ask the server to clear it
      if (error.status === 401) api.post('/auth/logout').catch(() => {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Any protected API call that comes back 401 means the session is gone
  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      api.post('/auth/logout').catch(() => {});
      toast.error('Your session has expired. Please sign in again.', { id: 'session-expired' });
      router.replace('/login');
    };
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, [router]);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // the cookie may already be gone; continue
    }
    setUser(null);
    toast.success('You have been signed out');
    router.replace('/login');
  }, [router]);

  // UI helpers only: the backend enforces every permission again
  const can = useCallback(
    (permission) => Boolean(user?.permissions?.includes(permission)),
    [user]
  );
  const canAny = useCallback((...permissions) => permissions.some((p) => can(p)), [can]);

  const value = useMemo(
    () => ({ user, loading, login, logout, setUser, refreshUser: loadUser, can, canAny }),
    [user, loading, login, logout, loadUser, can, canAny]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}