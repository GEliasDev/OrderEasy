import { useState, useEffect } from 'react';
import { Plus, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TablaIngresos from './vistas/TablaIngresos';
import TablaEgresos from './vistas/TablaEgresos';
import PeriodSelector from './vistas/PeriodSelector';
import BalanceTrendChart from './vistas/BalanceTrendChart';
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

function Balance({ token }) {
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

  const range = computeRange(period);

  return (
    <div className="balance-container">
      <div className="top-actions">
        <button className="action-button action-button-income" onClick={() => navigate('/dashboard/nueva-venta')}>
          <Plus className="button-icon" />
          <span>Registrar Venta</span>
        </button>
        <button className="action-button action-button-expense" onClick={() => navigate('/dashboard/nuevo-egreso')}>
          <Plus className="button-icon" />
          <span>Registrar Egreso</span>
        </button>
      </div>

      <div className="balance-period-row">
        <PeriodSelector value={period} onChange={handlePeriodChange} />
      </div>

      <div className="metrics-grid">
        <div className="metric-card total-balance metric-featured">
          <div className="metric-icon"><DollarSign size={22} /></div>
          <div className="metric-content">
            <h3>Balance General</h3>
            {loading
              ? <div className="metric-skeleton" />
              : (
                <>
                  <p className={`metric-value ${summary.balance < 0 ? 'metric-negative' : ''}`}>
                    {formatoMoneda(summary.balance)}
                  </p>
                  <span className={`metric-margen ${summary.margen < 0 ? 'metric-margen--neg' : ''}`}>
                    Margen: {summary.margen}%
                  </span>
                </>
              )}
          </div>
        </div>

        <div className="metric-card income">
          <div className="metric-icon"><TrendingUp size={20} /></div>
          <div className="metric-content">
            <h3>Ingresos Totales</h3>
            {loading
              ? <div className="metric-skeleton" />
              : <p className="metric-value">{formatoMoneda(summary.totalIngresos)}</p>}
          </div>
        </div>

        <div className="metric-card expense">
          <div className="metric-icon"><TrendingDown size={20} /></div>
          <div className="metric-content">
            <h3>Egresos Totales</h3>
            {loading
              ? <div className="metric-skeleton" />
              : <p className="metric-value">{formatoMoneda(summary.totalEgresos)}</p>}
          </div>
        </div>
      </div>

      <BalanceTrendChart />

      <div className="tab-controls">
        <button
          className={`tab-button ${mostrarTabla === 'ingresos' ? 'active' : ''}`}
          onClick={() => handleCambiarTab('ingresos')}
        >
          <TrendingUp size={14} />
          <span>Ingresos</span>
        </button>
        <button
          className={`tab-button ${mostrarTabla === 'egresos' ? 'active' : ''}`}
          onClick={() => handleCambiarTab('egresos')}
        >
          <TrendingDown size={14} />
          <span>Egresos</span>
        </button>
      </div>

      <div className="table-container">
        {mostrarTabla === 'ingresos'
          ? <TablaIngresos from={range.from} to={range.to} />
          : <TablaEgresos from={range.from} to={range.to} />}
      </div>
    </div>
  );
}

export default Balance;
