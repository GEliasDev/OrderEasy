import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Package, AlertTriangle,
  ShoppingBag, Clock, ChevronRight
} from 'lucide-react';
import { getVentas } from '../../../../services/ventaService';
import { getEgresos } from '../../../../services/egresoService';
import { getAllProducts } from '../../../../services/productServices';
import './inicio.css';

function Inicio() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ventas, setVentas] = useState([]);
  const [egresos, setEgresos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try { setUser(JSON.parse(userData)); } catch { localStorage.removeItem('user'); }
    }

    Promise.all([getVentas(), getEgresos(), getAllProducts()])
      .then(([v, e, p]) => {
        setVentas(v);
        setEgresos(e);
        setProductos(p);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const localDateStr = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const ventasHoy = ventas.filter(v => localDateStr(v.createdAt) === todayStr);
  const ingresosHoy = ventasHoy.reduce((s, v) => s + Number(v.total), 0);

  const now = new Date();
  const mesActual = now.getMonth();
  const anioActual = now.getFullYear();

  const ingresosMes = ventas
    .filter(v => { const d = new Date(v.createdAt); return d.getMonth() === mesActual && d.getFullYear() === anioActual; })
    .reduce((s, v) => s + Number(v.total), 0);

  const egresosMes = egresos
    .filter(e => { const d = new Date(e.createdAt); return d.getMonth() === mesActual && d.getFullYear() === anioActual; })
    .reduce((s, e) => s + Number(e.total), 0);

  const balanceMes = ingresosMes - egresosMes;

  const stockCritico = productos.filter(p => Number(p.cantidadDisponible) < 5);

  const ultimasVentas = [...ventas]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  const fmt = (n) => `$${Number(n).toLocaleString('es-CO')}`;

  const formatFecha = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  };

  const nombreUsuario = user?.primerNombre || 'usuario';

  if (loading) {
    return (
      <div className="inicio-loader">
        <div className="inicio-spinner"></div>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="inicio-view">
      {/* Header */}
      <div className="inicio-header">
        <div>
          <h1 className="inicio-welcome">Hola, {nombreUsuario}</h1>
          <p className="inicio-fecha">
            <Clock size={13} />
            {now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="inicio-kpi-grid">
        <div className="inicio-kpi-card">
          <div className="inicio-kpi-icon success">
            <TrendingUp size={20} />
          </div>
          <div className="inicio-kpi-body">
            <span className="inicio-kpi-label">Ventas hoy</span>
            <span className="inicio-kpi-value">{fmt(ingresosHoy)}</span>
            <span className="inicio-kpi-sub">{ventasHoy.length} {ventasHoy.length === 1 ? 'transacción' : 'transacciones'}</span>
          </div>
        </div>

        <div className="inicio-kpi-card">
          <div className={`inicio-kpi-icon ${balanceMes >= 0 ? 'primary' : 'danger'}`}>
            {balanceMes >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
          <div className="inicio-kpi-body">
            <span className="inicio-kpi-label">Balance del mes</span>
            <span className={`inicio-kpi-value ${balanceMes < 0 ? 'text-danger' : ''}`}>{fmt(balanceMes)}</span>
            <span className="inicio-kpi-sub">{fmt(ingresosMes)} ingresos · {fmt(egresosMes)} egresos</span>
          </div>
        </div>

        <div className="inicio-kpi-card">
          <div className="inicio-kpi-icon primary">
            <Package size={20} />
          </div>
          <div className="inicio-kpi-body">
            <span className="inicio-kpi-label">Productos</span>
            <span className="inicio-kpi-value">{productos.length}</span>
            <span className="inicio-kpi-sub">en inventario</span>
          </div>
        </div>

        <div className={`inicio-kpi-card ${stockCritico.length > 0 ? 'kpi-warning' : ''}`}>
          <div className={`inicio-kpi-icon ${stockCritico.length > 0 ? 'warning' : 'success'}`}>
            <AlertTriangle size={20} />
          </div>
          <div className="inicio-kpi-body">
            <span className="inicio-kpi-label">Stock crítico</span>
            <span className="inicio-kpi-value">{stockCritico.length}</span>
            <span className="inicio-kpi-sub">{stockCritico.length === 0 ? 'Sin alertas' : 'productos con menos de 5 und.'}</span>
          </div>
        </div>
      </div>

      {/* Bottom panels */}
      <div className="inicio-panels">
        {/* Últimas ventas */}
        <div className="inicio-panel">
          <div className="inicio-panel-header">
            <div className="inicio-panel-title">
              <ShoppingBag size={16} />
              <span>Últimas ventas</span>
            </div>
            <button className="inicio-ver-mas" onClick={() => navigate('/dashboard/balance')}>
              Ver todas <ChevronRight size={13} />
            </button>
          </div>

          {ultimasVentas.length === 0 ? (
            <div className="inicio-empty">
              <TrendingUp size={28} style={{ opacity: 0.2 }} />
              <p>Aún no hay ventas registradas</p>
            </div>
          ) : (
            <ul className="inicio-venta-list">
              {ultimasVentas.map((v) => {
                const resumen = v.detalles?.length > 1
                  ? `${v.detalles[0].productoNombre} (+${v.detalles.length - 1})`
                  : v.detalles?.[0]?.productoNombre || 'Venta';
                return (
                  <li key={v.ventaid} className="inicio-venta-item"
                    onClick={() => navigate(`/dashboard/venta/${v.ventaid}`, { state: { venta: v } })}>
                    <div className="inicio-venta-info">
                      <span className="inicio-venta-producto">{resumen}</span>
                      <span className="inicio-venta-cliente">
                        {v.cliente?.nombreCliente || <span style={{ opacity: 0.5 }}>General</span>}
                      </span>
                    </div>
                    <div className="inicio-venta-right">
                      <span className="inicio-venta-total">{fmt(v.total)}</span>
                      <span className="inicio-venta-fecha">{formatFecha(v.createdAt)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Stock crítico */}
        <div className="inicio-panel">
          <div className="inicio-panel-header">
            <div className="inicio-panel-title">
              <AlertTriangle size={16} />
              <span>Stock crítico</span>
            </div>
            <button className="inicio-ver-mas" onClick={() => navigate('/dashboard/inventario')}>
              Ver inventario <ChevronRight size={13} />
            </button>
          </div>

          {stockCritico.length === 0 ? (
            <div className="inicio-empty">
              <Package size={28} style={{ opacity: 0.2 }} />
              <p>Todos los productos tienen stock suficiente</p>
            </div>
          ) : (
            <ul className="inicio-stock-list">
              {stockCritico.slice(0, 6).map((p) => (
                <li key={p.productoid} className="inicio-stock-item">
                  <div className="inicio-stock-info">
                    <span className="inicio-stock-nombre">{p.nombre}</span>
                    <span className="inicio-stock-precio">{fmt(p.precioVenta)}</span>
                  </div>
                  <span className={`inicio-stock-badge ${p.cantidadDisponible === 0 ? 'badge-out' : 'badge-low'}`}>
                    {p.cantidadDisponible === 0 ? 'Sin stock' : `${p.cantidadDisponible} und.`}
                  </span>
                </li>
              ))}
              {stockCritico.length > 6 && (
                <li className="inicio-stock-more">+{stockCritico.length - 6} productos más con stock bajo</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default Inicio;
