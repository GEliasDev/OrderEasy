import { useState, useEffect, useMemo } from 'react';
import { Plus, TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TablaIngresos from './vistas/TablaIngresos';
import TablaEgresos from './vistas/TablaEgresos';
import PeriodSelector from './vistas/PeriodSelector';
import { getBalanceSummary } from '../../../../services/balanceService';
import './balance.css';

const computeRange = (period) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  switch (period) {
    case 'today':
      return { from: todayStr, to: todayStr };
    case 'week': {
      const day = now.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);
      return { from: monday.toISOString().split('T')[0], to: todayStr };
    }
    case 'month':
      return {
        from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
        to: todayStr
      };
    case 'year':
      return { from: `${now.getFullYear()}-01-01`, to: todayStr };
    default:
      return { from: '', to: '' };
  }
};

const formatoMoneda = (valor) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(valor);

// "1 oct – 23 oct 2026": deja claro qué fechas cubren las cifras de arriba
const describirRango = ({ from, to }) => {
  if (!from || !to) return 'Todo el historial';
  const corta = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  const anio = new Date(`${to}T12:00:00`).getFullYear();
  return from === to ? `${corta(to)} ${anio}` : `${corta(from)} – ${corta(to)} ${anio}`;
};

function Valor({ cargando, children }) {
  return cargando ? <div className="bal-esqueleto" aria-hidden="true" /> : children;
}

function Balance() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState(
    () => localStorage.getItem('balancePeriod') || 'month'
  );
  const [mostrarTabla, setMostrarTabla] = useState(
    () => localStorage.getItem('activeBalanceTab') || 'ingresos'
  );
  const [summary, setSummary] = useState({
    totalIngresos: 0,
    totalEgresos: 0,
    anticiposClientes: 0,
    balance: 0,
    margen: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchSummary = async (p) => {
    setLoading(true);
    try {
      const data = await getBalanceSummary(p);
      setSummary(data);
    } catch {
      // mantener valores en 0 si falla
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(period);
  }, [period]);

  const handlePeriodChange = (p) => {
    setPeriod(p);
    localStorage.setItem('balancePeriod', p);
  };

  const handleCambiarTab = (tab) => {
    setMostrarTabla(tab);
    localStorage.setItem('activeBalanceTab', tab);
  };

  const range = useMemo(() => computeRange(period), [period]);
  const balanceNegativo = summary.balance < 0;

  return (
    <div className="bal-pagina">
      <header className="bal-encabezado">
        <div>
          <h1>Balance</h1>
          <p>Lo que entra y lo que sale de tu negocio en el período elegido.</p>
        </div>
        <div className="bal-acciones">
          <button type="button" className="bal-btn bal-btn--ingreso" onClick={() => navigate('/dashboard/nueva-venta')}>
            <Plus size={16} aria-hidden="true" />
            <span>Registrar venta</span>
          </button>
          <button type="button" className="bal-btn bal-btn--egreso" onClick={() => navigate('/dashboard/nuevo-egreso')}>
            <Plus size={16} aria-hidden="true" />
            <span>Registrar egreso</span>
          </button>
        </div>
      </header>

      <div className="bal-periodo-fila">
        <PeriodSelector value={period} onChange={handlePeriodChange} />
        <span className="bal-rango">{describirRango(range)}</span>
      </div>

      <section className="bal-kpis" aria-label="Resumen del período" aria-busy={loading}>
        <article className={`bal-kpi bal-kpi--balance${balanceNegativo ? ' bal-kpi--negativo' : ''}`}>
          <header>
            <span className="bal-kpi-icono"><DollarSign size={18} aria-hidden="true" /></span>
            <h2>Balance general</h2>
          </header>
          <Valor cargando={loading}>
            <p className="bal-kpi-valor">{formatoMoneda(summary.balance)}</p>
            <span className={`bal-margen${summary.margen < 0 ? ' bal-margen--neg' : ''}`}>
              Margen {summary.margen}%
            </span>
          </Valor>
        </article>

        <article className="bal-kpi bal-kpi--ingresos">
          <header>
            <span className="bal-kpi-icono"><TrendingUp size={18} aria-hidden="true" /></span>
            <h2>Ingresos totales</h2>
          </header>
          <Valor cargando={loading}>
            <p className="bal-kpi-valor">{formatoMoneda(summary.totalIngresos)}</p>
          </Valor>
        </article>

        <article className="bal-kpi bal-kpi--egresos">
          <header>
            <span className="bal-kpi-icono"><TrendingDown size={18} aria-hidden="true" /></span>
            <h2>Egresos totales</h2>
          </header>
          <Valor cargando={loading}>
            <p className="bal-kpi-valor">{formatoMoneda(summary.totalEgresos)}</p>
          </Valor>
        </article>

        {/* Dinero de abonos de pedidos aún sin entregar: no es utilidad, solo está en caja */}
        <article className="bal-kpi bal-kpi--anticipos">
          <header>
            <span className="bal-kpi-icono"><Wallet size={18} aria-hidden="true" /></span>
            <h2>Abonos por entregar</h2>
          </header>
          <Valor cargando={loading}>
            <p className="bal-kpi-valor">{formatoMoneda(summary.anticiposClientes || 0)}</p>
            <span className="bal-kpi-nota">Anticipos de clientes con pedidos pendientes</span>
          </Valor>
        </article>
      </section>

      <div className="bal-tabs" role="tablist" aria-label="Movimientos">
        <button
          type="button"
          role="tab"
          aria-selected={mostrarTabla === 'ingresos'}
          className={`bal-tab${mostrarTabla === 'ingresos' ? ' activo' : ''}`}
          onClick={() => handleCambiarTab('ingresos')}
        >
          <TrendingUp size={15} aria-hidden="true" />
          <span>Ingresos</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mostrarTabla === 'egresos'}
          className={`bal-tab${mostrarTabla === 'egresos' ? ' activo' : ''}`}
          onClick={() => handleCambiarTab('egresos')}
        >
          <TrendingDown size={15} aria-hidden="true" />
          <span>Egresos</span>
        </button>
      </div>

      <div className="table-container" role="tabpanel">
        {mostrarTabla === 'ingresos'
          ? <TablaIngresos from={range.from} to={range.to} />
          : <TablaEgresos from={range.from} to={range.to} />}
      </div>
    </div>
  );
}

export default Balance;
