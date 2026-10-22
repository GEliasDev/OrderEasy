const Egreso = require('../models/egresoModel');
const { anticiposDeClientes } = require('../services/pedidoPagoService');
const { movimientosDeIngreso, totalIngresos: sumarIngresos } = require('../services/ingresosService');
const { Op } = require('sequelize');

const getPeriodRange = (period) => {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case 'today': {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return { from: startOfToday, to: endOfToday };
    }
    case 'week': {
      const day = now.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      return { from: monday, to: endOfToday };
    }
    case 'month': {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { from: firstOfMonth, to: endOfToday };
    }
    case 'year': {
      const firstOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const lastOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { from: firstOfYear, to: lastOfYear };
    }
    default:
      return null;
  }
};

const getBalanceSummary = async (req, res) => {
  try {
    const { negocioid } = req.usuario;
    const { period = 'all' } = req.query;

    const range = getPeriodRange(period);
    const whereBase = { negocioid };
    if (range) {
      whereBase.createdAt = { [Op.between]: [range.from, range.to] };
    }

    // Ingresos = dinero cobrado (las entregas de pedidos solo cuentan lo que ya se pagó)
    const [movimientos, egresos, anticiposClientes] = await Promise.all([
      movimientosDeIngreso({ negocioid, from: range?.from, to: range?.to }),
      Egreso.findAll({ where: whereBase, attributes: ['total'] }),
      anticiposDeClientes(negocioid), // abonos de pedidos aún sin entregar (no es utilidad, se muestra aparte)
    ]);

    const totalIngresos = sumarIngresos(movimientos);
    const totalEgresos = egresos.reduce((sum, e) => sum + Number(e.total), 0);
    const balance = totalIngresos - totalEgresos;
    const margen = totalIngresos > 0
      ? Math.round(((totalIngresos - totalEgresos) / totalIngresos) * 100)
      : 0;

    res.json({
      totalIngresos,
      totalEgresos,
      anticiposClientes,
      balance,
      margen,
      period,
      from: range ? range.from.toISOString().split('T')[0] : null,
      to: range ? range.to.toISOString().split('T')[0] : null
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener el resumen de balance' });
  }
};

module.exports = { getBalanceSummary };
