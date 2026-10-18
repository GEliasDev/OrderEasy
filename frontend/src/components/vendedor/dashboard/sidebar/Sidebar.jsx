import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  LineChart,
  DollarSign,
  LogOut,
  ShoppingCart,
  Users,
  Truck,
  Tag,
  Settings,
  Bot,
  CreditCard,
  X,
} from 'lucide-react';

import { toast } from 'sonner';
import { useAuth } from '../../../../context/AuthContext';
import './styles/Sidebar.css';
import logo from '../../login/LoginAssets/logo.png';

const MENU = [
  {
    section: 'Principal',
    items: [
      { to: 'inicio', label: 'Inicio', icon: LayoutDashboard, seccion: 'inicio' },
      { to: 'inventario', label: 'Inventario', icon: Package, seccion: 'inventario' },
      { to: 'productos', label: 'Productos', icon: ShoppingCart, seccion: 'productos' },
      { to: 'categorias', label: 'Categorías', icon: Tag, seccion: 'categorias' },
    ],
  },
  {
    section: 'Ventas',
    items: [
      { to: 'caja', label: 'Caja', icon: CreditCard, seccion: 'caja' },
    ],
  },
  {
    section: 'Finanzas',
    items: [
      { to: 'balance', label: 'Balance', icon: DollarSign, seccion: 'balance' },
      { to: 'estadisticas', label: 'Estadísticas', icon: LineChart, seccion: 'estadisticas' },
    ],
  },
  {
    section: 'Contactos',
    items: [
      { to: 'clientes', label: 'Clientes', icon: Users, seccion: 'clientes' },
      { to: 'proveedores', label: 'Proveedores', icon: Truck, seccion: 'proveedores' },
    ],
  },
  {
    section: 'Asistente',
    items: [
      { to: 'asistente', label: 'Asistente IA', icon: Bot, seccion: 'asistente' },
    ],
  },
  {
    section: 'Gestión',
    adminOnly: true,
    items: [
      { to: 'configuracion', label: 'Configuración', icon: Settings, seccion: null },
    ],
  },
];

function Sidebar({ isOpen = false, onClose = () => {} }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();

  const esAdmin = user?.rol === 'administrador';
  const secciones = user?.secciones || [];

  const puedeVer = (item, groupAdminOnly) => {
    if (esAdmin) return true;
    if (groupAdminOnly) return false;
    if (item.seccion === null) return false;
    return secciones.includes(item.seccion);
  };

  const handleLogout = () => {
    toast('¿Cerrar sesión?', {
      action: {
        label: 'Cerrar sesión',
        onClick: () => {
          logout();
          navigate('/');
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
      duration: 5000,
    });
  };

  const isActive = (path) => location.pathname.includes(path);

  return (
    <>
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="logo-container">
          <Link to="/dashboard" onClick={onClose} className="logo-link">
            <img src={logo} alt="Logo" className="custom-logo" />
          </Link>
          <button className="sidebar-close" onClick={onClose} aria-label="Cerrar menú">
            <X size={20} />
          </button>
        </div>

        <div className="menu-container">
          <nav className="menu-items">
            {MENU.map(({ section, adminOnly, items }, gi) => {
              const visibles = items.filter((item) => puedeVer(item, adminOnly));
              if (visibles.length === 0) return null;
              return (
                <div key={gi}>
                  {gi > 0 && <div className="menu-divider" />}
                  <span className="menu-section-title">{section}</span>
                  {visibles.map(({ to, label, icon: Icon }) => (
                    <Link
                      key={to}
                      to={to}
                      className={`menu-item ${isActive(to) ? 'active' : ''}`}
                      onClick={onClose}
                    >
                      <Icon className="menu-icon" />
                      <span>{label}</span>
                    </Link>
                  ))}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="logout-container">
          <button className="logout-button" onClick={handleLogout}>
            <LogOut className="menu-icon" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </>
  );
}

export default Sidebar;
