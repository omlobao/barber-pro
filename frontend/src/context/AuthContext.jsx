import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { getStoredTokens, setStoredTokens } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(getStoredTokens()?.access));

  const fetchMe = useCallback(async () => {
    const tokens = getStoredTokens();
    if (!tokens?.access) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const { data } = await api.get('/api/auth/me/');
      setUser(data);
      return data;
    } catch {
      setStoredTokens(null);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('barberpro:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('barberpro:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/api/auth/login/', { username, password });
    setStoredTokens({ access: data.access, refresh: data.refresh });
    const me = await fetchMe();
    if (!me) {
      throw new Error('Sua conta não possui acesso ativo ao painel da barbearia.');
    }
    return me;
  }, [fetchMe]);

  const hydrateStaffSession = useCallback((tokens, staffUser) => {
    setStoredTokens(tokens);
    setUser(staffUser);
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    setStoredTokens(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        isAdmin: Boolean(user?.is_staff),
        login,
        hydrateStaffSession,
        logout,
        refreshUser: fetchMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return ctx;
}
