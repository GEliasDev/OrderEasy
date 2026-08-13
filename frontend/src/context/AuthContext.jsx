import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

const isTokenValid = (token) => {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    const t = localStorage.getItem('token');
    return isTokenValid(t) ? t : null;
  });

  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });

  const login = useCallback((data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.usuario));
    localStorage.setItem('rol', data.usuario.rol);
    setToken(data.token);
    setUser(data.usuario);
  }, []);

  const logout = useCallback(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user'));
      if (u?.id) localStorage.removeItem(`chat_history_${u.id}`);
    } catch {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rol');
    localStorage.removeItem('balancePeriod');
    localStorage.removeItem('activeBalanceTab');
    setToken(null);
    setUser(null);
  }, []);

  const isAuthenticated = !!token && isTokenValid(token);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
