import { useEffect, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, ShoppingBag, 
  BarChart2, Activity, PieChart as PieIcon
} from 'lucide-react';
import { getDashboardStats } from '../../../../services/statsService';
import './Estadisticas.css';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <span className="tooltip-label">{label}</span>
        {payload.map((entry, index) => (
          <div key={index} className="tooltip-item" style={{ color: entry.color }}>
            {entry.name}: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(entry.value)}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

function Estadisticas() {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 4 }, (_, i) => currentYear - i);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setCargando(true);
        const stats = await getDashboardStats(selectedYear);
        setData(stats);
      } catch (error) {
        console.error('Error al cargar estadísticas:', error);
      } finally {
        setCargando(false);
      }
    };
    fetchStats();
  }, [selectedYear]);

  // Colores alineados al proyecto: Azul Primario, Esmeralda, Ámbar, Rojo, Indigo
  const COLORS = ['#1565C0', '#059669', '#D97706', '#DC2626', '#6366F1'];

  const formatCurrency = (val) => 
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

  if (cargando) {
    return (
      <div className="stats-content">
        <div className="innovative-empty">
          <div className="loader-spinner" style={{ borderTopColor: 'var(--color-primary)' }}></div>
          <p style={{ marginTop: '1rem', fontWeight: '600', color: 'var(--neutral-500)' }}>Cargando inteligencia de datos...</p>
        </div>
      </div>
    );
  }

  if (!data || (data.kpis.totalIngresos === 0 && data.kpis.totalEgresos === 0)) {
    return (
      <div className="stats-content">
        <div className="stats-header">
          <h1>Estadísticas</h1>
          <select className="year-selector" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="innovative-empty">
          <div className="empty-icon-box">
            <Activity size={40} color="var(--neutral-400)" />
          </div>
          <h2>Sin movimientos detectados en {selectedYear}</h2>
          <p>No se encontraron registros de ventas ni egresos vinculados a este periodo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stats-content">
      <div className="stats-header">
        <h1>Dashboard de Estadísticas</h1>
        <select className="year-selector" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-container income">
            <TrendingUp size={24} />
          </div>
          <div className="kpi-body">
            <h3>Ingresos</h3>
            <p className="kpi-value">{formatCurrency(data.kpis.totalIngresos)}</p>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-container expense">
            <TrendingDown size={24} />
          </div>
          <div className="kpi-body">
            <h3>Egresos</h3>
            <p className="kpi-value">{formatCurrency(data.kpis.totalEgresos)}</p>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-container profit">
            <DollarSign size={24} />
          </div>
          <div className="kpi-body">
            <h3>Balance</h3>
            <p className="kpi-value" style={{ color: data.kpis.balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {formatCurrency(data.kpis.balance)}
            </p>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-container orders">
            <ShoppingBag size={24} />
          </div>
          <div className="kpi-body">
            <h3>Transacciones</h3>
            <p className="kpi-value">{data.kpis.totalVentasCount}</p>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-container margin">
            <Activity size={24} />
          </div>
          <div className="kpi-body">
            <h3>Margen</h3>
            <p className="kpi-value" style={{ color: data.kpis.totalIngresos > 0 && data.kpis.balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {data.kpis.totalIngresos > 0
                ? `${((data.kpis.balance / data.kpis.totalIngresos) * 100).toFixed(1)}%`
                : '—'}
            </p>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-container ticket">
            <BarChart2 size={24} />
          </div>
          <div className="kpi-body">
            <h3>Ticket Promedio</h3>
            <p className="kpi-value">
              {data.kpis.totalVentasCount > 0
                ? formatCurrency(data.kpis.totalIngresos / data.kpis.totalVentasCount)
                : '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="charts-layout">
        <div className="dashboard-card">
          <div className="card-title-area">
            <h2>Flujo de Caja Mensual</h2>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlyFlow} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-danger)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--color-danger)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12}} dy={10} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="Ingresos" 
                  stroke="var(--color-success)" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#colorIngresos)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="Gastos" 
                  stroke="var(--color-danger)" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#colorGastos)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-title-area">
            <h2>Categorías Populares</h2>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="dashboard-card">
        <div className="card-title-area">
          <h2>Ranking de Productos</h2>
        </div>
        <div className="chart-wrapper" style={{ height: '260px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.topProducts} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
              <YAxis hide />
              <Tooltip cursor={{fill: '#F8FAF9'}} />
              <Bar dataKey="value" fill="var(--color-primary)" radius={[6, 6, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default Estadisticas;
