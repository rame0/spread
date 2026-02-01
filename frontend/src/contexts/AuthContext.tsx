import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types/v2';
import {
  getStoredToken,
  setStoredToken,
  getMe,
  login as apiLogin,
  register as apiRegister,
} from '../services/api';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = getStoredToken();
    if (!t) {
      setLoading(false);
      return;
    }
    getMe()
      .then((u) => {
        setUser(u);
        setToken(t);
      })
      .catch(() => {
        setStoredToken(null);
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { user: u, token: t } = await apiLogin(email, password);
    setStoredToken(t);
    setToken(t);
    setUser(u);
  };

  const register = async (email: string, password: string) => {
    const { user: u, token: t } = await apiRegister(email, password);
    setStoredToken(t);
    setToken(t);
    setUser(u);
  };

  const logout = () => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
