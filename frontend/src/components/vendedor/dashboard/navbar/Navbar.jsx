import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Moon, Sun, Settings, LogOut, ChevronDown, UserRound } from 'lucide-react';
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

// Nombre de la pantalla según la ruta (/dashboard/<segmento>/...)
const TITULOS = {
  inicio: 'Inicio',
  inventario: 'Inventario',
  productos: 'Productos',
  producto: 'Producto',
  'nuevo-producto': 'Nuevo producto',
  categorias: 'Categorías',
  pedidos: 'Pedidos',
  pedido: 'Compra',
  'nuevo-pedido': 'Nueva compra',
  balance: 'Balance',
  'nueva-venta': 'Registrar venta',
  'nuevo-egreso': 'Registrar egreso',
  venta: 'Detalle de venta',
  egreso: 'Detalle de egreso',
  estadisticas: 'Estadísticas',
  clientes: 'Clientes',
  proveedores: 'Proveedores',
  configuracion: 'Configuración',
  usuarios: 'Personal',
  roles: 'Roles y permisos',
  perfil: 'Mi perfil',
};

const tituloDe = (pathname) => TITULOS[pathname.split('/')[2]] || '';

function Navbar({ onToggleSidebar }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef(null);
  const botonRef = useRef(null);

  const esAdmin = user?.rol === 'administrador';
  const titulo = tituloDe(pathname);

  // Cierra el menú de perfil al hacer clic fuera o con Esc (devolviendo el foco al botón)
  useEffect(() => {
    if (!menuAbierto) return undefined;
    const alHacerClic = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAbierto(false);
    };
    const alTeclear = (e) => {
      if (e.key === 'Escape') {
        setMenuAbierto(false);
        botonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', alHacerClic);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('mousedown', alHacerClic);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [menuAbierto]);

  // Al cambiar de pantalla el menú se cierra solo
  useEffect(() => { setMenuAbierto(false); }, [pathname]);

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

  const ir = (ruta) => {
    setMenuAbierto(false);
    navigate(ruta);
  };

  return (
    <header className="navbar">
      <button type="button" className="navbar-hamburger" onClick={onToggleSidebar} aria-label="Abrir menú">
        <Menu size={22} aria-hidden="true" />
      </button>

      {titulo && <p className="navbar-titulo" aria-hidden="true">{titulo}</p>}

      <div className="navbar-right">
        <GlobalSearch />

        <button
          type="button"
          className="navbar-icon-btn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        >
          {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </button>

        <div className="navbar-profile" ref={menuRef}>
          <button
            type="button"
            ref={botonRef}
            className={`navbar-profile-btn ${menuAbierto ? 'open' : ''}`}
            onClick={() => setMenuAbierto((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuAbierto}
            aria-label={`Menú de ${user?.primerNombre || 'usuario'}`}
          >
            <span className="navbar-avatar" aria-hidden="true">{iniciales(user)}</span>
            <span className="navbar-profile-name">{user?.primerNombre || 'Usuario'}</span>
            <ChevronDown size={15} className="navbar-profile-chevron" aria-hidden="true" />
          </button>

          {menuAbierto && (
            <div className="navbar-menu" role="menu" aria-label="Cuenta">
              <div className="navbar-menu-head">
                <span className="navbar-avatar lg" aria-hidden="true">{iniciales(user)}</span>
                <div className="navbar-menu-head-text">
                  <span className="navbar-menu-name">{user?.primerNombre || 'Usuario'}</span>
                  <span className="navbar-menu-sub">{user?.correo || user?.nombreNegocio || ''}</span>
                  <span className="navbar-menu-rol">{esAdmin ? 'Administrador' : 'Vendedor'}</span>
                </div>
              </div>

              <div className="navbar-menu-divider" role="separator" />

              <button type="button" role="menuitem" className="navbar-menu-item" onClick={() => ir('/dashboard/perfil')}>
                <UserRound size={16} aria-hidden="true" />
                <span>Mi perfil</span>
              </button>

              {esAdmin && (
                <button type="button" role="menuitem" className="navbar-menu-item" onClick={() => ir('/dashboard/configuracion')}>
                  <Settings size={16} aria-hidden="true" />
                  <span>Configuración</span>
                </button>
              )}

              <button type="button" role="menuitem" className="navbar-menu-item danger" onClick={handleLogout}>
                <LogOut size={16} aria-hidden="true" />
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
