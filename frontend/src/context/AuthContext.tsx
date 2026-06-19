import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../services/api';

export interface User {
  id:      string;
  email:   string;
  name:    string;
  role:    string;
  wardId?: number | null;
  rewardPoints?:  number;
  rewardLevel?:   string;
  totalReports?:  number;
}

interface AuthCtx {
  user:    User | null;
  token:   string | null;
  login:   (email: string, password: string) => Promise<void>;
  logout:  () => void;
  fetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,  setUser]  = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem('aqi_user') || 'null'); }
    catch { return null; }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('aqi_token'));

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: t, user: u } = res.data;
    u.rewardPoints = u.greenPoints || 0; // Map backend field to frontend
    localStorage.setItem('aqi_token', t);
    localStorage.setItem('aqi_user', JSON.stringify(u));
    setToken(t);
    setUser(u);
    api.defaults.headers.common['Authorization'] = `Bearer ${t}`;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('aqi_token');
    localStorage.removeItem('aqi_user');
    setToken(null);
    setUser(null);
    delete api.defaults.headers.common['Authorization'];
  }, []);

  const fetchUser = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/auth/me');
      const u = res.data.user;
      u.rewardPoints = u.greenPoints || 0;
      setUser(u);
      localStorage.setItem('aqi_user', JSON.stringify(u));
    } catch (e) {
      console.error('Failed to fetch user profile');
    }
  }, [token]);

  React.useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    }
  }, [token, fetchUser]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}
