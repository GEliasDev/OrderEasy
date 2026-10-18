import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Users, Package, Truck, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { getClientes } from '../../../../services/clienteService';
import { getAllProducts } from '../../../../services/productServices';
import { getProveedores } from '../../../../services/proveedorService';
import { getVentas } from '../../../../services/ventaService';
import { getEgresos } from '../../../../services/egresoService';

// Normaliza: minúsculas y sin tildes, para una búsqueda tolerante
const norm = (s) => (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const money = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(v) || 0);

const fecha = (f) => {
  if (!f) return '';
  const d = new Date(f);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const LIMIT = 5; // resultados por grupo

function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const dataRef = useRef(null); // { clientes, productos, proveedores, ventas, egresos }

  const cargarDatos = useCallback(async () => {
    if (dataRef.current) return;
    setLoading(true);
    try {
      const [clientes, productos, proveedores, ventas, egresos] = await Promise.all([
        getClientes().catch(() => []),
        getAllProducts().catch(() => []),
        getProveedores().catch(() => []),
        getVentas().catch(() => []),
        getEgresos().catch(() => []),
      ]);
      dataRef.current = {
        clientes: Array.isArray(clientes) ? clientes : [],
        productos: Array.isArray(productos) ? productos : [],
        proveedores: Array.isArray(proveedores) ? proveedores : [],
        ventas: Array.isArray(ventas) ? ventas : [],
        egresos: Array.isArray(egresos) ? egresos : [],
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const abrir = useCallback(() => {
    setOpen(true);
    setQuery('');
    setActive(0);
    cargarDatos();
  }, [cargarDatos]);

  const cerrar = useCallback(() => setOpen(false), []);

  // Atajo global Ctrl/Cmd + K
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => {
          if (!o) { setQuery(''); setActive(0); cargarDatos(); }
          return !o;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cargarDatos]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // Construye resultados agrupados a partir de la consulta
  const grupos = useMemo(() => {
    const q = norm(query).trim();
    const data = dataRef.current;
    if (!q || !data) return [];

    const clientes = data.clientes
      .filter((c) => norm(c.nombreCliente).includes(q) || norm(c.correo).includes(q) || norm(c.telefono).includes(q))
      .slice(0, LIMIT)
      .map((c) => ({
        key: `cli-${c.clienteid}`,
        icon: Users,
        label: c.nombreCliente,
        sub: c.correo || c.telefono || 'Cliente',
        go: () => navigate('/dashboard/clientes'),
      }));

    const productos = data.productos
      .filter((p) => norm(p.nombre).includes(q) || norm(p.codigoBarras).includes(q) || norm(p.categoriaNombre).includes(q))
      .slice(0, LIMIT)
      .map((p) => ({
        key: `prod-${p.productoid}`,
        icon: Package,
        label: p.nombre,
        sub: `${p.categoriaNombre || 'Producto'} · Stock ${p.cantidadDisponible ?? 0}`,
        go: () => navigate(`/dashboard/producto/${p.productoid}`),
      }));

    const proveedores = data.proveedores
      .filter((p) => norm(p.razonSocial).includes(q) || norm(p.nombreProveedor).includes(q) || norm(p.nit).includes(q))
      .slice(0, LIMIT)
      .map((p) => ({
        key: `prov-${p.proveedorid}`,
        icon: Truck,
        label: p.razonSocial || p.nombreProveedor,
        sub: p.nombreProveedor || p.nit || 'Proveedor',
        go: () => navigate('/dashboard/proveedores'),
      }));

    const matchMovimiento = (m) => {
      const nombres = (m.detalles || []).map((d) => d.productoNombre).join(' ');
      return (
        norm(nombres).includes(q) ||
        norm(m.descripcion).includes(q) ||
        norm(m.cliente?.nombreCliente).includes(q) ||
        norm(m.proveedor?.nombreProveedor).includes(q) ||
        norm(String(m.ventaid ?? m.egresoid)).includes(q)
      );
    };

    const ventas = data.ventas
      .filter(matchMovimiento)
      .slice(0, LIMIT)
      .map((v) => ({
        key: `venta-${v.ventaid}`,
        icon: TrendingUp,
        label: `Venta #${v.ventaid}`,
        sub: `${fecha(v.createdAt)} · ${money(v.total)}`,
        go: () => navigate(`/dashboard/venta/${v.ventaid}`),
      }));

    const egresos = data.egresos
      .filter(matchMovimiento)
      .slice(0, LIMIT)
      .map((e) => ({
        key: `egreso-${e.egresoid}`,
        icon: TrendingDown,
        label: `Egreso #${e.egresoid}`,
        sub: `${fecha(e.createdAt)} · ${money(e.total)}`,
        go: () => navigate(`/dashboard/egreso/${e.egresoid}`),
      }));

    return [
      { title: 'Clientes', items: clientes },
      { title: 'Productos', items: productos },
      { title: 'Proveedores', items: proveedores },
      { title: 'Ventas', items: ventas },
      { title: 'Egresos', items: egresos },
    ].filter((g) => g.items.length > 0);
  }, [query, navigate]);

  // Lista plana para navegación con flechas
  const flat = useMemo(() => grupos.flatMap((g) => g.items), [grupos]);

  useEffect(() => { setActive(0); }, [query]);

  const seleccionar = useCallback((item) => {
    if (!item) return;
    item.go();
    cerrar();
  }, [cerrar]);

  const onInputKey = (e) => {
    if (e.key === 'Escape') { cerrar(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); seleccionar(flat[active]); }
  };

  let runningIndex = -1;

  return (
    <>
      <button className="navbar-search-trigger" onClick={abrir} aria-label="Buscar">
        <Search size={16} />
        <span className="navbar-search-text">Buscar movimientos, clientes, productos…</span>
        <kbd className="navbar-search-kbd">Ctrl K</kbd>
      </button>

      {open && (
        <div className="gsearch-overlay" onMouseDown={cerrar}>
          <div className="gsearch-panel" onMouseDown={(e) => e.stopPropagation()}>
            <div className="gsearch-input-row">
              <Search size={18} className="gsearch-input-icon" />
              <input
                ref={inputRef}
                className="gsearch-input"
                type="text"
                placeholder="Buscar clientes, productos, proveedores, ventas, egresos…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
              />
              {loading && <Loader2 size={16} className="gsearch-spin" />}
              <button className="gsearch-close" onClick={cerrar} aria-label="Cerrar"><X size={16} /></button>
            </div>

            <div className="gsearch-results">
              {!query.trim() ? (
                <div className="gsearch-hint">Escribe para buscar en toda la tienda…</div>
              ) : loading && flat.length === 0 ? (
                <div className="gsearch-hint">Cargando datos…</div>
              ) : flat.length === 0 ? (
                <div className="gsearch-hint">Sin resultados para “{query}”.</div>
              ) : (
                grupos.map((g) => (
                  <div className="gsearch-group" key={g.title}>
                    <div className="gsearch-group-title">{g.title}</div>
                    {g.items.map((item) => {
                      runningIndex += 1;
                      const idx = runningIndex;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.key}
                          className={`gsearch-item ${idx === active ? 'active' : ''}`}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => seleccionar(item)}
                        >
                          <span className="gsearch-item-icon"><Icon size={15} /></span>
                          <span className="gsearch-item-text">
                            <span className="gsearch-item-label">{item.label}</span>
                            <span className="gsearch-item-sub">{item.sub}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="gsearch-footer">
              <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
              <span><kbd>↵</kbd> abrir</span>
              <span><kbd>Esc</kbd> cerrar</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default GlobalSearch;
