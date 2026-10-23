import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Activity, AlertCircle, BarChart3, CalendarDays, Percent, Receipt, RefreshCw,
  ShoppingBag, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react';
import { getDashboardStats } from '../../../../services/statsService';
import './Estadisticas.css';

const MONEDA = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const COMPACTO = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });
const NUMERO = new Intl.NumberFormat('es-CO');

const formatoMoneda = (valor) => MONEDA.format(Number(valor) || 0);
const formatoCompacto = (valor) => `${Number(valor) < 0 ? '-' : ''}$${COMPACTO.format(Math.abs(Number(valor) || 0))}`;
const recortar = (texto, max = 24) => (String(texto).length > max ? `${String(texto).slice(0, max - 1)}…` : String(texto));

const NOMBRES_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Colores de las series: azul y ámbar se distinguen también con daltonismo; el balance va en tinta
const COLOR_INGRESOS = 'var(--color-primary)';
const COLOR_GASTOS = 'var(--color-warning)';
const COLOR_BALANCE = 'var(--neutral-800)';

const prefiereMenosMovimiento = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function TooltipFlujo({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const punto = payload[0].payload;
  return (
    <div className="stats-tooltip">
      <span className="stats-tooltip-titulo">{label}</span>
      <div className="stats-tooltip-fila"><i style={{ background: COLOR_INGRESOS }} />Ingresos<strong>{formatoMoneda(punto.Ingresos)}</strong></div>
      <div className="stats-tooltip-fila"><i style={{ background: COLOR_GASTOS }} />Egresos<strong>{formatoMoneda(punto.Gastos)}</strong></div>
      <div className="stats-tooltip-fila stats-tooltip-total">Balance del mes<strong>{formatoMoneda(punto.Balance)}</strong></div>
    </div>
  );
}

function TooltipProducto({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  return (
    <div className="stats-tooltip">
      <span className="stats-tooltip-titulo">{name}</span>
      <div className="stats-tooltip-fila">Unidades vendidas<strong>{NUMERO.format(value)}</strong></div>
    </div>
  );
}

// Minigráfica de tendencia dentro de una tarjeta (decorativa: el dato real está en el texto)
function Tendencia({ datos, clave, color, reducido }) {
  return (
    <div className="stats-kpi-tendencia" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={datos} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`tend-${clave}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={clave} stroke={color} strokeWidth={2} fill={`url(#tend-${clave})`} isAnimationActive={!reducido} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TarjetaKpi({ etiqueta, valor, nota, icono: Icono, tono, tendencia }) {
  return (
    <article className={`stats-kpi stats-kpi--${tono}`}>
      <header className="stats-kpi-cabecera">
        <span className="stats-kpi-icono"><Icono size={16} aria-hidden="true" /></span>
        <h3>{etiqueta}</h3>
      </header>
      <p className="stats-kpi-valor">{valor}</p>
      {nota && <p className="stats-kpi-nota">{nota}</p>}
      {tendencia}
    </article>
  );
}

function Esqueleto() {
  return (
    <div className="stats-esqueleto" role="status" aria-label="Cargando estadísticas">
      <div className="stats-esq-fila">{[0, 1, 2, 3].map((i) => <div key={i} className="stats-esq-bloque stats-esq-kpi" />)}</div>
      <div className="stats-esq-bloque stats-esq-franja" />
      <div className="stats-esq-bloque stats-esq-grafica" />
      <div className="stats-esq-fila stats-esq-dos">
        <div className="stats-esq-bloque stats-esq-lista" />
        <div className="stats-esq-bloque stats-esq-lista" />
      </div>
    </div>
  );
}

function Estadisticas() {
  const anioActual = new Date().getFullYear();
  const anios = useMemo(() => Array.from({ length: 4 }, (_, i) => anioActual - i), [anioActual]);
  const [anio, setAnio] = useState(anioActual);
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const reducido = useMemo(prefiereMenosMovimiento, []);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError(false);
      setData(await getDashboardStats(String(anio)));
    } catch (e) {
      console.error('Error al cargar estadísticas:', e);
      setData(null);
      setError(true);
    } finally {
      setCargando(false);
    }
  }, [anio]);

  useEffect(() => { cargar(); }, [cargar]);

  const resumen = useMemo(() => {
    if (!data) return null;
    const { kpis } = data;
    let acumulado = 0;
    const meses = (data.monthlyFlow || []).map((m, i) => {
      const balance = m.Ingresos - m.Gastos;
      acumulado += balance;
      return { ...m, mes: NOMBRES_MES[i], Balance: balance, Acumulado: acumulado };
    });
    const mejor = meses.reduce((a, m) => (m.Ingresos > (a?.Ingresos ?? 0) ? m : a), null);
    const mesesTranscurridos = anio === anioActual ? new Date().getMonth() + 1 : 12;
    const margen = kpis.totalIngresos > 0 ? (kpis.balance / kpis.totalIngresos) * 100 : null;
    const totalCategorias = (data.categoryData || []).reduce((s, c) => s + c.value, 0);
    const principales = (data.categoryData || []).slice(0, 7);
    const resto = (data.categoryData || []).slice(7).reduce((s, c) => s + c.value, 0);
    const categorias = resto > 0 ? [...principales, { name: 'Otras categorías', value: resto }] : principales;
    return {
      meses,
      mejor,
      margen,
      totalCategorias,
      categorias,
      promedioMensual: kpis.totalIngresos / mesesTranscurridos,
      ticket: kpis.totalVentasCount > 0 ? kpis.totalIngresos / kpis.totalVentasCount : null,
    };
  }, [data, anio, anioActual]);

  const encabezado = (
    <header className="stats-encabezado">
      <div>
        <h1>Estadísticas</h1>
        <p>Cómo se mueve tu negocio: lo que cobras, lo que gastas y lo que más se vende.</p>
      </div>
      <div className="stats-periodo" role="radiogroup" aria-label="Año a consultar">
        {anios.map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={a === anio}
            className={`stats-periodo-opcion${a === anio ? ' activo' : ''}`}
            onClick={() => setAnio(a)}
          >
            {a}
          </button>
        ))}
      </div>
    </header>
  );

  if (cargando && !data) {
    return <div className="stats-pagina">{encabezado}<Esqueleto /></div>;
  }

  if (error) {
    return (
      <div className="stats-pagina">
        {encabezado}
        <div className="stats-estado" role="alert">
          <span className="stats-estado-icono stats-estado-icono--error"><AlertCircle size={26} aria-hidden="true" /></span>
          <h2>No pudimos cargar las estadísticas</h2>
          <p>Revisa tu conexión e inténtalo de nuevo.</p>
          <button type="button" className="stats-boton" onClick={cargar}><RefreshCw size={14} aria-hidden="true" />Reintentar</button>
        </div>
      </div>
    );
  }

  if (!data || (data.kpis.totalIngresos === 0 && data.kpis.totalEgresos === 0)) {
    return (
      <div className="stats-pagina">
        {encabezado}
        <div className="stats-estado">
          <span className="stats-estado-icono"><Activity size={26} aria-hidden="true" /></span>
          <h2>Sin movimientos en {anio}</h2>
          <p>Cuando registres ventas, cobros o egresos de este año, aquí verás cómo evolucionan.</p>
        </div>
      </div>
    );
  }

  const { kpis, topProducts = [] } = data;
  const { meses, mejor, margen, categorias, totalCategorias, promedioMensual, ticket } = resumen;
  const balancePositivo = kpis.balance >= 0;

  return (
    <div className={`stats-pagina${cargando ? ' stats-actualizando' : ''}`} aria-busy={cargando}>
      {encabezado}

      <section className="stats-kpis" aria-label="Resumen del año">
        <TarjetaKpi
          etiqueta="Ingresos"
          valor={formatoMoneda(kpis.totalIngresos)}
          nota="Dinero cobrado en el año"
          icono={TrendingUp}
          tono="ingresos"
          tendencia={<Tendencia datos={meses} clave="Ingresos" color={COLOR_INGRESOS} reducido={reducido} />}
        />
        <TarjetaKpi
          etiqueta="Egresos"
          valor={formatoMoneda(kpis.totalEgresos)}
          nota="Compras y gastos del año"
          icono={TrendingDown}
          tono="egresos"
          tendencia={<Tendencia datos={meses} clave="Gastos" color={COLOR_GASTOS} reducido={reducido} />}
        />
        <TarjetaKpi
          etiqueta="Balance"
          valor={formatoMoneda(kpis.balance)}
          nota={balancePositivo ? 'Ganancia del año' : 'Pérdida del año'}
          icono={Wallet}
          tono={balancePositivo ? 'positivo' : 'negativo'}
          tendencia={<Tendencia datos={meses} clave="Acumulado" color={balancePositivo ? 'var(--color-success)' : 'var(--color-danger)'} reducido={reducido} />}
        />
        <TarjetaKpi
          etiqueta="Margen"
          valor={margen === null ? '—' : `${margen.toFixed(1)}%`}
          nota="Balance sobre ingresos"
          icono={Percent}
          tono={margen !== null && margen >= 0 ? 'positivo' : 'negativo'}
        />
      </section>

      <section className="stats-franja" aria-label="Datos complementarios">
        <div className="stats-franja-dato">
          <ShoppingBag size={16} aria-hidden="true" />
          <div><span>Ventas registradas</span><strong>{NUMERO.format(kpis.totalVentasCount)}</strong></div>
        </div>
        <div className="stats-franja-dato">
          <Receipt size={16} aria-hidden="true" />
          <div><span>Ticket promedio</span><strong>{ticket === null ? '—' : formatoMoneda(ticket)}</strong></div>
        </div>
        <div className="stats-franja-dato">
          <CalendarDays size={16} aria-hidden="true" />
          <div><span>Mejor mes</span><strong>{mejor ? `${mejor.mes.charAt(0).toUpperCase()}${mejor.mes.slice(1)} · ${formatoCompacto(mejor.Ingresos)}` : '—'}</strong></div>
        </div>
        <div className="stats-franja-dato">
          <BarChart3 size={16} aria-hidden="true" />
          <div><span>Ingreso mensual promedio</span><strong>{formatoMoneda(promedioMensual)}</strong></div>
        </div>
      </section>

      <section className="stats-tarjeta" aria-labelledby="stats-flujo">
        <header className="stats-tarjeta-cabecera">
          <div>
            <h2 id="stats-flujo">Flujo de caja mensual</h2>
            <p>Lo que cobraste frente a lo que gastaste cada mes, y cómo va tu balance acumulado.</p>
          </div>
          <ul className="stats-leyenda" aria-label="Leyenda">
            <li><i className="stats-leyenda-barra" style={{ background: COLOR_INGRESOS }} />Ingresos</li>
            <li><i className="stats-leyenda-barra" style={{ background: COLOR_GASTOS }} />Egresos</li>
            <li><i className="stats-leyenda-linea" style={{ background: COLOR_BALANCE }} />Balance acumulado</li>
          </ul>
        </header>
        <div className="stats-grafica" role="img" aria-label={`Gráfica de ingresos, egresos y balance acumulado por mes de ${anio}. Los datos están en la tabla siguiente.`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={meses} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={3} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="var(--neutral-200)" strokeDasharray="3 4" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--neutral-500)', fontSize: 12 }} dy={8} />
              <YAxis axisLine={false} tickLine={false} width={56} tick={{ fill: 'var(--neutral-500)', fontSize: 12 }} tickFormatter={formatoCompacto} />
              <Tooltip content={<TooltipFlujo />} cursor={{ fill: 'var(--neutral-100)' }} />
              <Bar dataKey="Ingresos" fill={COLOR_INGRESOS} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={!reducido} />
              <Bar dataKey="Gastos" fill={COLOR_GASTOS} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={!reducido} />
              <Line type="monotone" dataKey="Acumulado" stroke={COLOR_BALANCE} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} isAnimationActive={!reducido} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="stats-solo-lectores">
        <table>
          <caption>Ingresos, egresos y balance por mes de {anio}</caption>
          <thead><tr><th>Mes</th><th>Ingresos</th><th>Egresos</th><th>Balance del mes</th></tr></thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.name}><th>{m.mes}</th><td>{formatoMoneda(m.Ingresos)}</td><td>{formatoMoneda(m.Gastos)}</td><td>{formatoMoneda(m.Balance)}</td></tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      <div className="stats-dos-columnas">
        <section className="stats-tarjeta" aria-labelledby="stats-categorias">
          <header className="stats-tarjeta-cabecera">
            <div>
              <h2 id="stats-categorias">Ventas por categoría</h2>
              <p>Qué parte de lo vendido aporta cada categoría.</p>
            </div>
          </header>
          {categorias.length === 0 ? (
            <p className="stats-vacio">Aún no hay ventas con categoría en {anio}.</p>
          ) : (
            <ol className="stats-ranking">
              {categorias.map((c) => {
                const porcentaje = totalCategorias > 0 ? (c.value / totalCategorias) * 100 : 0;
                return (
                  <li key={c.name} className="stats-ranking-fila">
                    <div className="stats-ranking-texto">
                      <span className="stats-ranking-nombre" title={c.name}>{c.name}</span>
                      <span className="stats-ranking-valor">{formatoMoneda(c.value)} <b>{porcentaje.toFixed(0)}%</b></span>
                    </div>
                    <div className="stats-ranking-pista" role="presentation"><div className="stats-ranking-barra" style={{ width: `${Math.max(porcentaje, 1.5)}%` }} /></div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="stats-tarjeta" aria-labelledby="stats-productos">
          <header className="stats-tarjeta-cabecera">
            <div>
              <h2 id="stats-productos">Productos más vendidos</h2>
              <p>Unidades vendidas en {anio}.</p>
            </div>
          </header>
          {topProducts.length === 0 ? (
            <p className="stats-vacio">Aún no hay productos vendidos en {anio}.</p>
          ) : (
            <div className="stats-grafica stats-grafica-ranking" style={{ height: topProducts.length * 38 + 16 }} role="img" aria-label={`Ranking de ${topProducts.length} productos más vendidos: ${topProducts.map((p) => `${p.name} ${p.value}`).join(', ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={150} tick={{ fill: 'var(--neutral-700)', fontSize: 12 }} tickFormatter={(v) => recortar(v, 24)} />
                  <Tooltip content={<TooltipProducto />} cursor={{ fill: 'var(--neutral-100)' }} />
                  <Bar dataKey="value" fill={COLOR_INGRESOS} radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={!reducido}>
                    <LabelList dataKey="value" position="right" style={{ fill: 'var(--neutral-700)', fontSize: 12, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default Estadisticas;
