// Abonos, devoluciones y su conciliación con las ventas generadas al entregar un pedido.
//
// - Un abono es dinero que el cliente entrega antes (o al momento) de recibir su pedido.
// - Al entregar, la venta se crea con pagos tomados de los abonos disponibles (más antiguos primero),
//   conservando el método con que se cobró cada uno; el resto del valor queda como saldo por cobrar.
// - Al anular, el dinero de los abonos no aplicado se devuelve al cliente (devolución) o se deja como
//   saldo a favor del cliente, que luego se traslada a otro pedido suyo (traslado).
// - El balance (utilidad) sigue contando la venta al entregar; los abonos aún no aplicados se muestran
//   aparte como "anticipos de clientes".

const PedidoPago = require('../models/pedidoPagoModel');
const VentaPago = require('../models/ventaPagoModel');

class ErrorPago extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

const METODOS = ['efectivo', 'tarjeta', 'transferencia'];

const dos = (valor) => Math.round(Number(valor) * 100) / 100;

const normalizarMetodo = (metodo, porDefecto = 'efectivo') => {
  const m = metodo || porDefecto;
  if (!METODOS.includes(m)) throw new ErrorPago('El método de pago no es válido (efectivo, tarjeta o transferencia)');
  return m;
};

const validarMonto = (monto) => {
  const n = dos(monto);
  if (!Number.isFinite(n) || n <= 0) throw new ErrorPago('El monto debe ser mayor a 0');
  return n;
};

// Resumen de dinero de un pedido a partir de sus detalles y movimientos (objetos planos o modelos).
const resumenPedido = ({ estado, total, detalles = [], pagos = [] }) => {
  const abonos = pagos.filter((p) => p.tipo === 'abono');
  const devoluciones = pagos.filter((p) => p.tipo !== 'abono'); // devoluciones y traslados: el dinero sale del pedido

  const totalAbonos = abonos.reduce((s, p) => s + Number(p.monto), 0);
  const totalDevuelto = devoluciones.reduce((s, p) => s + Number(p.monto), 0);
  const abonado = dos(totalAbonos - totalDevuelto);

  const entregado = dos(detalles.reduce((s, d) => s + Number(d.cantidadEntregada || 0) * Number(d.precioUnitario), 0));
  // Un pedido anulado solo "vale" lo que ya se entregó
  const valorVigente = estado === 'anulado' ? entregado : dos(total);

  // Dinero de abonos que aún no se ha cobrado en una venta ni devuelto
  const disponibleAbonos = dos(abonos.reduce(
    (s, p) => s + Number(p.monto) - Number(p.montoAplicado || 0) - Number(p.montoDevuelto || 0), 0
  ));

  return {
    total: dos(total),
    abonado,
    entregado,
    porEntregar: dos(Math.max(0, valorVigente - entregado)),
    saldo: dos(Math.max(0, valorVigente - abonado)),
    disponibleAbonos,
  };
};

// Registra un abono o una devolución dentro de la transacción `transaction`.
// `contexto` trae el pedido y sus detalles/pagos actuales para validar contra el saldo.
const registrarMovimiento = async ({ pedido, detalles, tipo, monto, metodo, nota, usuarioid, transaction }) => {
  const importe = validarMonto(monto);
  const pagos = await PedidoPago.findAll({ where: { pedidoid: pedido.pedidoid }, order: [['pagoid', 'ASC']], transaction, lock: true });
  const resumen = resumenPedido({ estado: pedido.estado, total: pedido.total, detalles, pagos });

  if (tipo === 'abono') {
    if (pedido.estado === 'anulado') throw new ErrorPago('No se pueden registrar abonos en un pedido anulado');
    if (importe > resumen.saldo + 0.001) {
      throw new ErrorPago(`El abono supera el saldo pendiente (${resumen.saldo.toLocaleString('es-CO')})`);
    }
  } else if (tipo === 'devolucion' && importe > resumen.disponibleAbonos + 0.001) {
    throw new ErrorPago(`Solo se pueden devolver ${resumen.disponibleAbonos.toLocaleString('es-CO')} (el resto ya se cobró en entregas)`);
  }

  const movimiento = await PedidoPago.create({
    pedidoid: pedido.pedidoid,
    negocioid: pedido.negocioid,
    usuarioid,
    tipo,
    metodo: normalizarMetodo(metodo),
    monto: importe,
    nota: nota ? String(nota).slice(0, 255) : null,
  }, { transaction });

  // Una devolución o traslado consume los abonos disponibles, más antiguos primero
  if (tipo !== 'abono') {
    let restante = importe;
    for (const abono of pagos.filter((p) => p.tipo === 'abono')) {
      if (restante <= 0) break;
      const libre = dos(Number(abono.monto) - Number(abono.montoAplicado) - Number(abono.montoDevuelto));
      if (libre <= 0) continue;
      const tomar = Math.min(libre, restante);
      await abono.update({ montoDevuelto: dos(Number(abono.montoDevuelto) + tomar) }, { transaction });
      restante = dos(restante - tomar);
    }
  }

  return movimiento;
};

// Cobra una venta con los abonos disponibles del pedido (más antiguos primero). Devuelve lo cubierto.
const aplicarAbonosAVenta = async ({ pedidoid, venta, totalVenta, transaction }) => {
  const abonos = await PedidoPago.findAll({
    where: { pedidoid, tipo: 'abono' },
    order: [['pagoid', 'ASC']],
    transaction,
    lock: true,
  });

  let restante = dos(totalVenta);
  let cubierto = 0;
  for (const abono of abonos) {
    if (restante <= 0) break;
    const libre = dos(Number(abono.monto) - Number(abono.montoAplicado) - Number(abono.montoDevuelto));
    if (libre <= 0) continue;
    const tomar = Math.min(libre, restante);

    await abono.update({ montoAplicado: dos(Number(abono.montoAplicado) + tomar) }, { transaction });
    await VentaPago.create({ ventaid: venta.ventaid, metodo: abono.metodo, monto: tomar }, { transaction });

    restante = dos(restante - tomar);
    cubierto = dos(cubierto + tomar);
  }
  return cubierto;
};

// Saldo a favor de un cliente: dinero de abonos de pedidos anulados que se dejó como crédito
const saldoAFavorDeCliente = async ({ clienteid, negocioid, transaction }) => {
  const Pedido = require('../models/pedidoModel');
  const pedidos = await Pedido.findAll({
    where: { clienteid, negocioid, estado: 'anulado' },
    include: [{ model: PedidoPago, as: 'pagos', where: { tipo: 'abono' }, required: true }],
    transaction,
  });
  const detalle = pedidos
    .map((p) => ({
      pedidoid: p.pedidoid,
      disponible: dos(p.pagos.reduce((s, a) => s + Number(a.monto) - Number(a.montoAplicado) - Number(a.montoDevuelto), 0)),
    }))
    .filter((p) => p.disponible > 0);
  return { total: dos(detalle.reduce((s, p) => s + p.disponible, 0)), pedidos: detalle };
};

// Traslada saldo a favor de pedidos anulados del cliente a un abono del pedido destino
const usarSaldoAFavor = async ({ pedido, detalles, monto, usuarioid, transaction }) => {
  if (!pedido.clienteid) throw new ErrorPago('El pedido no tiene cliente: no hay saldo a favor que usar');
  const { total, pedidos } = await saldoAFavorDeCliente({ clienteid: pedido.clienteid, negocioid: pedido.negocioid, transaction });
  if (total <= 0) throw new ErrorPago('El cliente no tiene saldo a favor');

  const pagosDestino = await PedidoPago.findAll({ where: { pedidoid: pedido.pedidoid }, transaction });
  const { saldo } = resumenPedido({ estado: pedido.estado, total: pedido.total, detalles, pagos: pagosDestino });
  let porUsar = dos(monto !== undefined && monto !== null && monto !== '' ? validarMonto(monto) : Math.min(total, saldo));
  if (porUsar > total + 0.001) throw new ErrorPago(`El cliente solo tiene ${total.toLocaleString('es-CO')} de saldo a favor`);
  if (porUsar > saldo + 0.001) throw new ErrorPago(`El monto supera el saldo pendiente del pedido (${saldo.toLocaleString('es-CO')})`);
  if (porUsar <= 0) throw new ErrorPago('El pedido no tiene saldo pendiente');

  let usado = 0;
  for (const origen of pedidos) {
    if (porUsar <= 0) break;
    const tomar = Math.min(origen.disponible, porUsar);
    const pedidoOrigen = await require('../models/pedidoModel').findByPk(origen.pedidoid, { transaction, lock: true });
    const detallesOrigen = await require('../models/pedidoDetalleModel').findAll({ where: { pedidoid: origen.pedidoid }, transaction });
    const abonoOrigen = await PedidoPago.findOne({ where: { pedidoid: origen.pedidoid, tipo: 'abono' }, order: [['pagoid', 'ASC']], transaction });

    await registrarMovimiento({
      pedido: pedidoOrigen, detalles: detallesOrigen, tipo: 'traslado', monto: tomar,
      metodo: abonoOrigen?.metodo, nota: `Saldo a favor trasladado al pedido #${pedido.pedidoid}`, usuarioid, transaction,
    });
    await registrarMovimiento({
      pedido, detalles, tipo: 'abono', monto: tomar,
      metodo: abonoOrigen?.metodo, nota: `Saldo a favor del pedido #${origen.pedidoid}`, usuarioid, transaction,
    });
    porUsar = dos(porUsar - tomar);
    usado = dos(usado + tomar);
  }
  return usado;
};

// Total de abonos de un negocio que siguen en poder del negocio (no aplicados ni devueltos)
const anticiposDeClientes = async (negocioid) => {
  const abonos = await PedidoPago.findAll({ where: { negocioid, tipo: 'abono' }, attributes: ['monto', 'montoAplicado', 'montoDevuelto'] });
  return dos(abonos.reduce((s, p) => s + Number(p.monto) - Number(p.montoAplicado) - Number(p.montoDevuelto), 0));
};

module.exports = {
  ErrorPago,
  METODOS,
  dos,
  normalizarMetodo,
  resumenPedido,
  registrarMovimiento,
  aplicarAbonosAVenta,
  anticiposDeClientes,
  saldoAFavorDeCliente,
  usarSaldoAFavor,
};
