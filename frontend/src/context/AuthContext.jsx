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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rol');
    localStorage.removeItem('balancePeriod');
    localStorage.removeItem('activeBalanceTab');
    setToken(null);
    setUser(null);
  }, []);

  // Refresca los datos del usuario guardados (nombre, correo...) cuando edita su perfil; el token nuevo reemplaza al anterior
  const actualizarUsuario = useCallback((parcial, nuevoToken) => {
    setUser((previo) => {
      const siguiente = { ...(previo || {}), ...parcial };
      localStorage.setItem('user', JSON.stringify(siguiente));
      return siguiente;
    });
    if (nuevoToken) {
      localStorage.setItem('token', nuevoToken);
      setToken(nuevoToken);
    }
  }, []);

  const isAuthenticated = !!token && isTokenValid(token);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, login, logout, actualizarUsuario }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
