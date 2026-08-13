import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { getDashboardStats } from '../../../../../services/statsService';

const formatCOP = (value) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    notation: 'compact'
  }).format(value);

const BalanceTrendChart = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardStats(new Date().getFullYear())
      .then((res) => setData(res.monthlyFlow))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="chart-skeleton" />;
  }

  return (
    <div className="trend-chart-container">
      <h4 className="trend-chart-title">Flujo mensual {new Date().getFullYear()}</h4>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} barSize={8} barGap={2}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip
            formatter={(value) => formatCOP(value)}
            contentStyle={{ fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}
          />
          <Legend iconSize={8} wrapperStyle={{ fontSize: '0.72rem' }} />
          <Bar dataKey="Ingresos" fill="#059669" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Gastos" fill="#DC2626" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BalanceTrendChart;
