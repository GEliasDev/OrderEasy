import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  TrendingUp, TrendingDown, Package, AlertTriangle, ShoppingBag, Wallet,
  ChevronRight, Plus, ClipboardList, Receipt, CalendarDays,
} from 'lucide-react';
import { getVentas } from '../../../../services/ventaService';
import { getEgresos } from '../../../../services/egresoService';
import { getAllProducts } from '../../../../services/productServices';
import { getSaldoPorCobrar } from '../../../../services/pedidoService';
import './inicio.css';

const STOCK_BAJO = 5;
const DIAS_GRAFICA = 7;
const MONEDA = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const COMPACTO = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });
const fmt = (n) => MONEDA.format(Number(n) || 0);
const fmtCompacto = (n) => `$${COMPACTO.format(Number(n) || 0)}`;

// Ingreso = dinero cobrado (una entrega de pedido sin pagar todavía no cuenta)
const cobradoDe = (v) => Number(v.cobrado ?? v.total);

const claveDia = (fecha) => {
  const d = new Date(fecha);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const prefiereMenosMovimiento = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function Tarjeta({ etiqueta, valor, nota, icono: Icono, tono, alerta }) {
  return (
    <article className={`ini-kpi ini-kpi--${tono}${alerta ? ' ini-kpi--alerta' : ''}`}>
      <span className="ini-kpi-icono"><Icono size={18} aria-hidden="true" /></span>
      <div>
        <h3>{etiqueta}</h3>
        <p className="ini-kpi-valor">{valor}</p>
        {nota && <span className="ini-kpi-nota">{nota}</span>}
      </div>
    </article>
  );
}

function TooltipDia({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { etiquetaLarga, total, ventas } = payload[0].payload;
  return (
    <div className="ini-tooltip">
      <strong>{etiquetaLarga}</strong>
      <span>{fmt(total)}</span>
      <small>{ventas} {ventas === 1 ? 'venta' : 'ventas'}</small>
    </div>
  );
}

function Inicio() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ventas, setVentas] = useState([]);
  const [egresos, setEgresos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [porCobrar, setPorCobrar] = useState(null);
  const [user, setUser] = useState(null);
  const reducido = useMemo(prefiereMenosMovimiento, []);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try { setUser(JSON.parse(userData)); } catch { localStorage.removeItem('user'); }
    }

    Promise.all([getVentas(), getEgresos(), getAllProducts(), getSaldoPorCobrar().catch(() => null)])
      .then(([v, e, p, saldo]) => {
        setVentas(v);
        setEgresos(e);
        setProductos(p);
        setPorCobrar(saldo);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const datos = useMemo(() => {
    const ahora = new Date();
    const hoy = claveDia(ahora);
    const mes = ahora.getMonth();
    const anio = ahora.getFullYear();
    const delMes = (f) => { const d = new Date(f); return d.getMonth() === mes && d.getFullYear() === anio; };

    const ventasHoy = ventas.filter((v) => claveDia(v.createdAt) === hoy);
    const ingresosMes = ventas.filter((v) => delMes(v.createdAt)).reduce((s, v) => s + cobradoDe(v), 0);
    const egresosMes = egresos.filter((e) => delMes(e.createdAt)).reduce((s, e) => s + Number(e.total), 0);

    const dias = Array.from({ length: DIAS_GRAFICA }, (_, i) => {
      const d = new Date(ahora);
      d.setDate(ahora.getDate() - (DIAS_GRAFICA - 1 - i));
      return {
        clave: claveDia(d),
        etiqueta: d.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', ''),
        etiquetaLarga: d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }),
        total: 0,
        ventas: 0,
      };
    });
    const porDia = new Map(dias.map((d) => [d.clave, d]));
    ventas.forEach((v) => {
      const dia = porDia.get(claveDia(v.createdAt));
      if (dia) { dia.total += cobradoDe(v); dia.ventas += 1; }
    });

    const vigentes = productos.filter((p) => p.activo !== false);
    return {
      ahora,
      ventasHoy,
      ingresosHoy: ventasHoy.reduce((s, v) => s + cobradoDe(v), 0),
      ingresosMes,
      egresosMes,
      balanceMes: ingresosMes - egresosMes,
      dias,
      totalSemana: dias.reduce((s, d) => s + d.total, 0),
      stockCritico: vigentes
        .filter((p) => Number(p.cantidadDisponible) < STOCK_BAJO)
        .sort((a, b) => Number(a.cantidadDisponible) - Number(b.cantidadDisponible)),
      totalProductos: vigentes.length,
      ultimasVentas: [...ventas].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6),
    };
  }, [ventas, egresos, productos]);

  const nombreUsuario = user?.primerNombre || 'usuario';
  const { ahora, ventasHoy, balanceMes, stockCritico } = datos;
  const saldoPorCobrar = Number(porCobrar?.total || 0);

  if (loading) {
    return (
      <div className="ini-pagina" role="status" aria-label="Cargando inicio">
        <div className="ini-esq ini-esq--titulo" />
        <div className="ini-kpis">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="ini-esq ini-esq--kpi" />)}</div>
        <div className="ini-fila"><div className="ini-esq ini-esq--panel" /><div className="ini-esq ini-esq--panel" /></div>
      </div>
    );
  }

  return (
    <div className="ini-pagina">
      <header className="ini-encabezado">
        <div>
          <h1>Hola, {nombreUsuario}</h1>
          <p>
            <CalendarDays size={14} aria-hidden="true" />
            <span className="ini-fecha">{ahora.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </p>
        </div>
        <div className="ini-accesos">
          <button type="button" className="ini-btn ini-btn--primario" onClick={() => navigate('/dashboard/nueva-venta')}>
            <Plus size={16} aria-hidden="true" /><span>Registrar venta</span>
          </button>
          <button type="button" className="ini-btn" onClick={() => navigate('/dashboard/pedidos/nuevo')}>
            <ClipboardList size={16} aria-hidden="true" /><span>Nuevo pedido</span>
          </button>
          <button type="button" className="ini-btn" onClick={() => navigate('/dashboard/nuevo-egreso')}>
            <Receipt size={16} aria-hidden="true" /><span>Registrar egreso</span>
          </button>
        </div>
      </header>

      <section className="ini-kpis" aria-label="Resumen del día y del mes">
        <Tarjeta
          etiqueta="Ventas hoy"
          valor={fmt(datos.ingresosHoy)}
          nota={`${ventasHoy.length} ${ventasHoy.length === 1 ? 'venta' : 'ventas'}`}
          icono={TrendingUp}
          tono="ok"
        />
        <Tarjeta
          etiqueta="Balance del mes"
          valor={fmt(balanceMes)}
          nota={`${fmtCompacto(datos.ingresosMes)} ingresos · ${fmtCompacto(datos.egresosMes)} egresos`}
          icono={balanceMes >= 0 ? TrendingUp : TrendingDown}
          tono={balanceMes >= 0 ? 'primario' : 'peligro'}
        />
        <Tarjeta
          etiqueta="Por cobrar"
          valor={fmt(saldoPorCobrar)}
          nota={porCobrar ? `${porCobrar.clientes || 0} ${porCobrar.clientes === 1 ? 'cliente' : 'clientes'} con saldo` : 'Saldo de tus clientes'}
          icono={Wallet}
          tono={saldoPorCobrar > 0 ? 'aviso' : 'ok'}
        />
        <Tarjeta etiqueta="Productos" valor={datos.totalProductos} nota="activos en inventario" icono={Package} tono="primario" />
        <Tarjeta
          etiqueta="Stock crítico"
          valor={stockCritico.length}
          nota={stockCritico.length === 0 ? 'Sin alertas' : `menos de ${STOCK_BAJO} unidades`}
          icono={AlertTriangle}
          tono={stockCritico.length > 0 ? 'aviso' : 'ok'}
          alerta={stockCritico.length > 0}
        />
      </section>

      <div className="ini-fila">
        <section className="ini-panel ini-panel--ancho" aria-labelledby="ini-semana">
          <header className="ini-panel-cabecera">
            <div>
              <h2 id="ini-semana">Ventas de los últimos {DIAS_GRAFICA} días</h2>
              <p>{fmt(datos.totalSemana)} cobrados en la semana</p>
            </div>
            <button type="button" className="ini-ver" onClick={() => navigate('/dashboard/estadisticas')}>
              Ver estadísticas <ChevronRight size={14} aria-hidden="true" />
            </button>
          </header>
          <div
            className="ini-grafica"
            role="img"
            aria-label={`Ventas por día: ${datos.dias.map((d) => `${d.etiquetaLarga} ${fmt(d.total)}`).join('; ')}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos.dias} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--neutral-200)" strokeDasharray="3 4" />
                <XAxis dataKey="etiqueta" axisLine={false} tickLine={false} tick={{ fill: 'var(--neutral-500)', fontSize: 12 }} dy={6} />
                <YAxis axisLine={false} tickLine={false} width={52} tick={{ fill: 'var(--neutral-500)', fontSize: 12 }} tickFormatter={fmtCompacto} />
                <Tooltip content={<TooltipDia />} cursor={{ fill: 'var(--neutral-100)' }} />
                <Bar dataKey="total" fill="var(--color-primary)" radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive={!reducido} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="ini-panel" aria-labelledby="ini-stock">
          <header className="ini-panel-cabecera">
            <div>
              <h2 id="ini-stock">Stock crítico</h2>
              <p>{stockCritico.length === 0 ? 'Todo en orden' : `${stockCritico.length} ${stockCritico.length === 1 ? 'producto' : 'productos'} por reponer`}</p>
            </div>
            <button type="button" className="ini-ver" onClick={() => navigate('/dashboard/productos')}>
              Ver productos <ChevronRight size={14} aria-hidden="true" />
            </button>
          </header>

          {stockCritico.length === 0 ? (
            <div className="ini-vacio"><Package size={28} aria-hidden="true" /><p>Todos los productos tienen stock suficiente</p></div>
          ) : (
            <ul className="ini-lista">
              {stockCritico.slice(0, 6).map((p) => (
                <li key={p.productoid}>
                  <button type="button" className="ini-fila-item" onClick={() => navigate(`/dashboard/producto/${p.productoid}`)}>
                    <span className="ini-item-textos">
                      <strong>{p.nombre}</strong>
                      <small>{fmt(p.precioVenta)}</small>
                    </span>
                    <span className={`tbl-badge ${Number(p.cantidadDisponible) <= 0 ? 'tbl-badge--danger' : 'tbl-badge--warning'}`}>
                      {Number(p.cantidadDisponible) <= 0 ? 'Sin stock' : `${p.cantidadDisponible} und.`}
                    </span>
                  </button>
                </li>
              ))}
              {stockCritico.length > 6 && <li className="ini-mas">+{stockCritico.length - 6} productos más con stock bajo</li>}
            </ul>
          )}
        </section>
      </div>

      <section className="ini-panel" aria-labelledby="ini-ventas">
        <header className="ini-panel-cabecera">
          <div>
            <h2 id="ini-ventas">Últimas ventas</h2>
            <p>Los movimientos más recientes de tu negocio</p>
          </div>
          <button type="button" className="ini-ver" onClick={() => navigate('/dashboard/balance')}>
            Ver todas <ChevronRight size={14} aria-hidden="true" />
          </button>
        </header>

        {datos.ultimasVentas.length === 0 ? (
          <div className="ini-vacio"><ShoppingBag size={28} aria-hidden="true" /><p>Aún no hay ventas registradas</p></div>
        ) : (
          <ul className="ini-lista">
            {datos.ultimasVentas.map((v) => {
              const resumen = v.detalles?.length > 1
                ? `${v.detalles[0].productoNombre} (+${v.detalles.length - 1})`
                : v.detalles?.[0]?.productoNombre || 'Venta';
              return (
                <li key={v.ventaid}>
                  <button type="button" className="ini-fila-item" onClick={() => navigate(`/dashboard/venta/${v.ventaid}`, { state: { venta: v } })}>
                    <span className="ini-item-textos">
                      <strong>{resumen}</strong>
                      <small>{v.cliente?.nombreCliente || 'General'}</small>
                    </span>
                    <span className="ini-item-derecha">
                      <strong className="ini-monto">{fmt(cobradoDe(v))}</strong>
                      <small>{new Date(v.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default Inicio;
