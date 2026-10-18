import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Moon, Sun, Settings, LogOut, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../../../context/AuthContext';
import { useTheme } from '../../../../context/ThemeContext';
import GlobalSearch from './GlobalSearch';
import './Navbar.css';

const iniciales = (user) => {
  const n = (user?.primerNombre || user?.correo || '?').trim();
  const partes = n.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
};

function Navbar({ onToggleSidebar }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef(null);

  const esAdmin = user?.rol === 'administrador';

  // Cierra el menú de perfil al hacer clic fuera
  useEffect(() => {
    if (!menuAbierto) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAbierto(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuAbierto]);

  const handleLogout = () => {
    setMenuAbierto(false);
    toast('¿Cerrar sesión?', {
      action: {
        label: 'Cerrar sesión',
        onClick: () => { logout(); navigate('/'); },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
      duration: 5000,
    });
  };

  const irAConfiguracion = () => {
    setMenuAbierto(false);
    navigate('/dashboard/configuracion');
  };

  return (
    <header className="navbar">
      <button className="navbar-hamburger" onClick={onToggleSidebar} aria-label="Abrir menú">
        <Menu size={22} />
      </button>

      <div className="navbar-right">
        <GlobalSearch />

        <button
          className="navbar-icon-btn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="navbar-profile" ref={menuRef}>
          <button
            className={`navbar-profile-btn ${menuAbierto ? 'open' : ''}`}
            onClick={() => setMenuAbierto((o) => !o)}
          >
            <span className="navbar-avatar">{iniciales(user)}</span>
            <span className="navbar-profile-name">{user?.primerNombre || 'Usuario'}</span>
            <ChevronDown size={15} className="navbar-profile-chevron" />
          </button>

          {menuAbierto && (
            <div className="navbar-menu">
              <div className="navbar-menu-head">
                <span className="navbar-avatar lg">{iniciales(user)}</span>
                <div className="navbar-menu-head-text">
                  <span className="navbar-menu-name">{user?.primerNombre || 'Usuario'}</span>
                  <span className="navbar-menu-sub">{user?.correo || user?.nombreNegocio || ''}</span>
                  <span className="navbar-menu-rol">{esAdmin ? 'Administrador' : 'Vendedor'}</span>
                </div>
              </div>

              <div className="navbar-menu-divider" />

              {esAdmin && (
                <button className="navbar-menu-item" onClick={irAConfiguracion}>
                  <Settings size={16} />
                  <span>Configuración</span>
                </button>
              )}

              <button className="navbar-menu-item danger" onClick={handleLogout}>
                <LogOut size={16} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
