import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  LineChart,
  DollarSign,
  LogOut,
  ShoppingCart,
  ClipboardList,
  Users,
  Truck,
  Tag,
  Settings,
  Building2,
  X,
} from 'lucide-react';

import { toast } from 'sonner';
import { useAuth } from '../../../../context/AuthContext';
import { getNegocio } from '../../../../services/negocioService';
import { imagenUrl } from '../../../../config';
import './styles/Sidebar.css';
import logo from '../../login/LoginAssets/logo.png';

// `rutas`: pantallas que pertenecen a cada opción, para marcarla activa también en sus subpantallas
const MENU = [
  {
    section: 'Principal',
    items: [
      { to: 'inicio', label: 'Inicio', icon: LayoutDashboard, seccion: 'inicio', rutas: ['/inicio'] },
      { to: 'inventario', label: 'Inventario', icon: Package, seccion: 'inventario', rutas: ['/inventario', '/producto/', '/nuevo-producto'] },
      { to: 'productos', label: 'Productos', icon: ShoppingCart, seccion: 'productos', rutas: ['/productos'] },
      { to: 'categorias', label: 'Categorías', icon: Tag, seccion: 'categorias', rutas: ['/categorias'] },
    ],
  },
  {
    section: 'Ventas',
    items: [
      { to: 'pedidos', label: 'Pedidos', icon: ClipboardList, seccion: 'pedidos', rutas: ['/pedidos', '/pedido/', '/nuevo-pedido'] },
    ],
  },
  {
    section: 'Finanzas',
    items: [
      { to: 'balance', label: 'Balance', icon: DollarSign, seccion: 'balance', rutas: ['/balance', '/nueva-venta', '/nuevo-egreso', '/venta/', '/egreso/'] },
      { to: 'estadisticas', label: 'Estadísticas', icon: LineChart, seccion: 'estadisticas', rutas: ['/estadisticas'] },
    ],
  },
  {
    section: 'Contactos',
    items: [
      { to: 'clientes', label: 'Clientes', icon: Users, seccion: 'clientes', rutas: ['/clientes'] },
      { to: 'proveedores', label: 'Proveedores', icon: Truck, seccion: 'proveedores', rutas: ['/proveedores'] },
    ],
  },
  {
    section: 'Gestión',
    adminOnly: true,
    items: [
      { to: 'configuracion', label: 'Configuración', icon: Settings, seccion: null, rutas: ['/configuracion', '/usuarios', '/roles', '/perfil'] },
    ],
  },
];

function Sidebar({ isOpen = false, onClose = () => {} }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const [negocio, setNegocio] = useState(null);

  const esAdmin = user?.rol === 'administrador';
  const secciones = user?.secciones || [];

  useEffect(() => {
    getNegocio().then(setNegocio).catch(() => {});
  }, []);

  // Con el menú abierto en celular: Esc lo cierra y la página de atrás no hace scroll
  useEffect(() => {
    if (!isOpen) return undefined;
    const alTeclear = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', alTeclear);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = overflowPrevio;
    };
  }, [isOpen, onClose]);

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

  const isActive = (item) => item.rutas.some((ruta) => location.pathname.includes(ruta));

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`} aria-label="Navegación principal">
      <div className="logo-container">
        <Link to="/dashboard" onClick={onClose} className="logo-link" aria-label="Ir al inicio">
          <img src={logo} alt="OrderEasy" className="custom-logo" />
        </Link>
        <button type="button" className="sidebar-close" onClick={onClose} aria-label="Cerrar menú">
          <X size={20} />
        </button>
      </div>

      {negocio?.nombre && (
        <div className="sidebar-negocio" title={negocio.nombre}>
          <span className="sidebar-negocio-logo">
            {negocio.logo ? <img src={imagenUrl(negocio.logo)} alt="" /> : <Building2 size={16} aria-hidden="true" />}
          </span>
          <span className="sidebar-negocio-textos">
            <strong>{negocio.nombre}</strong>
            <small>{esAdmin ? 'Administrador' : 'Vendedor'}</small>
          </span>
        </div>
      )}

      <div className="menu-container">
        <nav className="menu-items" aria-label="Secciones">
          {MENU.map(({ section, adminOnly, items }, gi) => {
            const visibles = items.filter((item) => puedeVer(item, adminOnly));
            if (visibles.length === 0) return null;
            return (
              <div key={gi} className="menu-grupo" role="group" aria-labelledby={`menu-seccion-${gi}`}>
                <span className="menu-section-title" id={`menu-seccion-${gi}`}>{section}</span>
                {visibles.map((item) => {
                  const Icon = item.icon;
                  const activo = isActive(item);
                  return (
                    <Link
                      key={item.to}
                      to={`/dashboard/${item.to}`}
                      className={`menu-item ${activo ? 'active' : ''}`}
                      aria-current={activo ? 'page' : undefined}
                      onClick={onClose}
                    >
                      <Icon className="menu-icon" aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="logout-container">
        <button type="button" className="logout-button" onClick={handleLogout}>
          <LogOut className="menu-icon" aria-hidden="true" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
