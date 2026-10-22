// Ingresos del negocio = dinero realmente cobrado.
//  - Venta normal (mostrador): se cobra al vender, cuenta su total en la fecha de la venta.
//  - Entrega de un pedido: puede entregarse y pagarse después (cada abono lo registra el usuario). Solo cuenta lo que
//    se ha cobrado (pagos de la venta) y en la fecha en que se recibió cada pago.

const { Op } = require('sequelize');
const Venta = require('../models/ventaModel');
const VentaPago = require('../models/ventaPagoModel');

const dos = (n) => Math.round(Number(n) * 100) / 100;

// Movimientos de ingreso del negocio en un rango: [{ fecha, monto }]
const movimientosDeIngreso = async ({ negocioid, from = null, to = null }) => {
  const rango = from && to ? { [Op.between]: [from, to] } : null;

  const normales = await Venta.findAll({
    where: { negocioid, pedidoid: null, ...(rango ? { createdAt: rango } : {}) },
    attributes: ['total', 'createdAt'],
  });
  const cobros = await VentaPago.findAll({
    where: rango ? { createdAt: rango } : {},
    attributes: ['monto', 'createdAt'],
    include: [{ model: Venta, as: 'venta', where: { negocioid, pedidoid: { [Op.ne]: null } }, attributes: [], required: true }],
  });

  return [
    ...normales.map((v) => ({ fecha: v.createdAt, monto: Number(v.total) })),
    ...cobros.map((p) => ({ fecha: p.createdAt, monto: Number(p.monto) })),
  ];
};

const totalIngresos = (movimientos) => dos(movimientos.reduce((s, m) => s + m.monto, 0));

// Lo cobrado de cada venta (para listados): ventas normales = total; entregas de pedidos = suma de sus pagos
const cobradoDeVentas = async (ventas) => {
  const conPedido = ventas.filter((v) => v.pedidoid);
  const pagado = new Map();
  if (conPedido.length) {
    const pagos = await VentaPago.findAll({ where: { ventaid: conPedido.map((v) => v.ventaid) }, attributes: ['ventaid', 'monto'] });
    for (const p of pagos) pagado.set(p.ventaid, dos((pagado.get(p.ventaid) || 0) + Number(p.monto)));
  }
  return (venta) => {
    const total = Number(venta.total);
    const cobrado = venta.pedidoid ? Math.min(total, pagado.get(venta.ventaid) || 0) : total;
    return { cobrado, porCobrar: dos(Math.max(0, total - cobrado)) };
  };
};

module.exports = { movimientosDeIngreso, totalIngresos, cobradoDeVentas };
