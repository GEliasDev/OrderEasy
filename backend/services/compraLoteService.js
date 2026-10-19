// Compra al proveedor por lote: junta los faltantes de varios pedidos (clientes) en una sola orden de compra,
// conserva a quién va destinado cada par (asignaciones) y reparte lo que llega al recibir.
//
// - Faltante de una línea de pedido = lo pendiente de entregar - lo que cubre el stock libre - lo que ya viene en compras activas.
//   El stock libre se asigna a las líneas más antiguas primero.
// - Al recibir menos de lo comprado, el usuario elige a qué clientes corresponde lo que llegó (o se asigna por orden de pedido).
// - El estado de cada pedido (confirmado / en compra / recibido) se calcula con sus asignaciones.

const Pedido = require('../models/pedidoModel');
const PedidoDetalle = require('../models/pedidoDetalleModel');
const OrdenCompra = require('../models/ordenCompraModel');
const OrdenCompraDetalle = require('../models/ordenCompraDetalleModel');
const Asignacion = require('../models/ordenCompraAsignacionModel');
const Producto = require('../models/productModel');
const Cliente = require('../models/clientModel');
const { resolverStockDeDetalle } = require('./stockService');
const { dos } = require('./pedidoPagoService');

class ErrorCompra extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

const ESTADOS_COMPRABLES = ['confirmado', 'en_compra', 'recibido'];
const redondear = (n) => Math.round(Number(n) * 1000) / 1000;
const pendienteDe = (detalle) => redondear(Number(detalle.cantidad) - Number(detalle.cantidadEntregada || 0));
const claveGrupo = (detalle) => `${detalle.productoid}:${detalle.varianteid || ''}`;

// Por línea de pedido: cuánto viene en compras activas sin llegar y cuánto ya llegó (compras no anuladas)
const resumenComprasPorDetalle = async (detalleIds, transaction) => {
  const mapa = new Map();
  if (!detalleIds.length) return mapa;
  const asignaciones = await Asignacion.findAll({
    where: { pedidodetalleid: detalleIds },
    include: [{ model: OrdenCompraDetalle, as: 'ordenDetalle', include: [{ model: OrdenCompra, as: 'orden', attributes: ['estado'] }] }],
    transaction,
  });
  for (const a of asignaciones) {
    if (a.ordenDetalle?.orden?.estado === 'anulada') continue;
    const actual = mapa.get(a.pedidodetalleid) || { enCompra: 0, recibido: 0 };
    actual.enCompra = redondear(actual.enCompra + Number(a.cantidad) - Number(a.cantidadRecibida));
    actual.recibido = redondear(actual.recibido + Number(a.cantidadRecibida));
    mapa.set(a.pedidodetalleid, actual);
  }
  return mapa;
};

// Calcula qué hay que comprar para cubrir los pedidos indicados.
const calcularFaltantes = async ({ pedidoids, negocioid, transaction }) => {
  const ids = [...new Set((pedidoids || []).map(Number).filter(Boolean))];
  if (ids.length === 0) throw new ErrorCompra('Selecciona al menos un pedido');

  const pedidos = await Pedido.findAll({
    where: { pedidoid: ids, negocioid },
    include: [
      { model: PedidoDetalle, as: 'detalles' },
      { model: Cliente, as: 'cliente', attributes: ['clienteid', 'nombreCliente'] },
    ],
    order: [['createdAt', 'ASC'], ['pedidoid', 'ASC'], [{ model: PedidoDetalle, as: 'detalles' }, 'detalleid', 'ASC']],
    transaction,
  });
  if (pedidos.length !== ids.length) throw new ErrorCompra('Alguno de los pedidos no existe', 404);
  for (const pedido of pedidos) {
    if (!ESTADOS_COMPRABLES.includes(pedido.estado)) {
      throw new ErrorCompra(`El pedido #${pedido.pedidoid} no está confirmado (${pedido.estado}); confírmalo antes de comprar`);
    }
  }

  const lineas = [];
  for (const pedido of pedidos) {
    for (const detalle of pedido.detalles) {
      if (!detalle.productoid || pendienteDe(detalle) <= 0) continue;
      lineas.push({ pedido, detalle });
    }
  }

  const enCompra = await resumenComprasPorDetalle(lineas.map((l) => l.detalle.detalleid), transaction);

  const porGrupo = new Map();
  for (const linea of lineas) {
    const clave = claveGrupo(linea.detalle);
    if (!porGrupo.has(clave)) porGrupo.set(clave, []);
    porGrupo.get(clave).push(linea);
  }

  const grupos = [];
  for (const [clave, lineasGrupo] of porGrupo) {
    const primero = lineasGrupo[0].detalle;
    const producto = await Producto.findOne({ where: { productoid: primero.productoid, negocioid }, transaction, lock: transaction ? true : undefined });
    if (!producto) throw new ErrorCompra(`Producto no encontrado: ${primero.productoNombre}`);
    const stock = await resolverStockDeDetalle(producto, primero, transaction);

    // Stock libre = disponible menos lo reservado por pedidos que NO están en esta compra
    const sumaPendiente = lineasGrupo.reduce((s, l) => s + pendienteDe(l.detalle), 0);
    const reservadoOtros = Math.max(0, Number(stock.cantidadReservada) - sumaPendiente);
    let libre = Math.max(0, Number(stock.cantidadDisponible) - reservadoOtros);

    const detalleLineas = lineasGrupo.map(({ pedido, detalle }) => {
      const pendiente = pendienteDe(detalle);
      const cubiertoStock = redondear(Math.min(libre, pendiente));
      libre = redondear(libre - cubiertoStock);
      const yaEnCompra = enCompra.get(detalle.detalleid)?.enCompra || 0;
      const faltante = Math.max(0, redondear(pendiente - cubiertoStock - yaEnCompra));
      return {
        pedidoid: pedido.pedidoid,
        cliente: pedido.cliente?.nombreCliente || 'Sin cliente',
        detalleid: detalle.detalleid,
        pendiente,
        cubiertoStock,
        enCompra: yaEnCompra,
        faltante,
      };
    });

    const totalFaltante = redondear(detalleLineas.reduce((s, l) => s + l.faltante, 0));
    grupos.push({
      key: clave,
      productoid: producto.productoid,
      productoNombre: producto.nombre,
      talla: primero.talla || null,
      varianteid: primero.varianteid || null,
      categoriaid: producto.categoriaid,
      unidadMedida: producto.unidadMedida,
      precioCompra: Number(producto.precioCompra),
      lineas: detalleLineas,
      totalFaltante,
      costo: dos(totalFaltante * Number(producto.precioCompra)),
    });
  }

  const conFaltante = grupos.filter((g) => g.totalFaltante > 0);
  const pedidosConFaltante = new Set(conFaltante.flatMap((g) => g.lineas.filter((l) => l.faltante > 0).map((l) => l.pedidoid)));

  return {
    pedidos: pedidos.map((p) => ({
      pedidoid: p.pedidoid,
      cliente: p.cliente?.nombreCliente || 'Sin cliente',
      estado: p.estado,
      conFaltante: pedidosConFaltante.has(p.pedidoid),
    })),
    grupos: conFaltante,
    total: dos(conFaltante.reduce((s, g) => s + g.costo, 0)),
  };
};

// Recalcula el estado de compra de un pedido a partir de sus asignaciones activas:
// pendiente de llegar -> en compra; todo llegó -> recibido; sin compras -> confirmado.
const sincronizarEstadoPedido = async (pedidoid, transaction) => {
  const pedido = await Pedido.findByPk(pedidoid, { transaction, lock: transaction ? true : undefined });
  if (!pedido || !ESTADOS_COMPRABLES.includes(pedido.estado)) return;

  const detalles = await PedidoDetalle.findAll({ where: { pedidoid }, attributes: ['detalleid'], transaction });
  const mapa = await resumenComprasPorDetalle(detalles.map((d) => d.detalleid), transaction);

  const valores = [...mapa.values()];
  const pendiente = valores.reduce((s, v) => s + v.enCompra, 0);
  const hayCompras = valores.length > 0;

  const nuevo = pendiente > 0 ? 'en_compra' : (hayCompras ? 'recibido' : 'confirmado');
  if (pedido.estado !== nuevo) await pedido.update({ estado: nuevo }, { transaction });
};

const pedidoidsDeOrden = async (ordenid, transaction) => {
  const asignaciones = await Asignacion.findAll({
    include: [
      { model: OrdenCompraDetalle, as: 'ordenDetalle', where: { ordenid }, attributes: [] },
      { model: PedidoDetalle, as: 'pedidoDetalle', attributes: ['pedidoid'] },
    ],
    transaction,
  });
  return [...new Set(asignaciones.map((a) => a.pedidoDetalle?.pedidoid).filter(Boolean))];
};

// Crea una orden de compra con los faltantes de los pedidos y el reparto por cliente.
const crearOrdenDesdePedidos = async ({ pedidoids, proveedorid, descripcion, negocioid, usuarioid, transaction }) => {
  const { pedidos, grupos } = await calcularFaltantes({ pedidoids, negocioid, transaction });
  if (grupos.length === 0) {
    throw new ErrorCompra('El stock actual y las órdenes existentes ya cubren estos pedidos');
  }

  const ids = pedidos.map((p) => p.pedidoid);
  const orden = await OrdenCompra.create({
    negocioid,
    proveedorid: proveedorid || null,
    pedidoid: ids.length === 1 ? ids[0] : null,
    usuarioid,
    estado: 'enviada',
    descripcion: descripcion || (ids.length === 1 ? `Pedido #${ids[0]}` : `Compra para pedidos ${ids.map((i) => `#${i}`).join(', ')}`),
    total: 0,
  }, { transaction });

  let total = 0;
  for (const grupo of grupos) {
    const subtotal = dos(grupo.totalFaltante * grupo.precioCompra);
    const detalle = await OrdenCompraDetalle.create({
      ordenid: orden.ordenid,
      productoid: grupo.productoid,
      productoNombre: grupo.productoNombre,
      cantidad: grupo.totalFaltante,
      cantidadRecibida: 0,
      precioUnitario: grupo.precioCompra,
      subtotal,
      categoriaid: grupo.categoriaid,
      talla: grupo.talla,
      varianteid: grupo.varianteid,
    }, { transaction });

    for (const linea of grupo.lineas.filter((l) => l.faltante > 0)) {
      await Asignacion.create({ ordendetalleid: detalle.detalleid, pedidodetalleid: linea.detalleid, cantidad: linea.faltante }, { transaction });
    }
    total += subtotal;
  }
  await orden.update({ total: dos(total) }, { transaction });

  for (const id of ids) await sincronizarEstadoPedido(id, transaction);
  return orden;
};

// Reparte lo recibido de una línea de compra entre sus asignaciones.
// `reparto` = [{ asignacionid, cantidad }] elegido por el usuario; sin reparto se asigna por orden de pedido (FIFO).
const repartirRecepcion = async ({ detalle, cantidad, reparto, transaction }) => {
  const todas = await Asignacion.findAll({
    where: { ordendetalleid: detalle.detalleid },
    include: [{ model: PedidoDetalle, as: 'pedidoDetalle', attributes: ['pedidoid'], include: [{ model: Pedido, as: 'pedido', attributes: ['estado'] }] }],
    order: [['asignacionid', 'ASC']],
    transaction,
  });
  // Si un cliente canceló, su par ya no es de nadie: lo que llegue de más queda como stock libre
  const asignaciones = todas.filter((a) => a.pedidoDetalle?.pedido?.estado !== 'anulado');
  if (asignaciones.length === 0) return;

  const pendiente = (a) => redondear(Number(a.cantidad) - Number(a.cantidadRecibida));
  let cambios;

  if (Array.isArray(reparto) && reparto.length > 0) {
    cambios = [];
    let suma = 0;
    for (const item of reparto) {
      const asignacion = asignaciones.find((a) => Number(a.asignacionid) === Number(item.asignacionid));
      if (!asignacion) throw new ErrorCompra('El reparto incluye una línea que no pertenece a esta compra');
      const cant = redondear(item.cantidad);
      if (!Number.isFinite(cant) || cant < 0) throw new ErrorCompra('Las cantidades del reparto no son válidas');
      if (cant === 0) continue;
      if (cant > pendiente(asignacion) + 0.0005) {
        throw new ErrorCompra(`Se asignaron más de los pendientes de ${detalle.productoNombre}${detalle.talla ? ` talla ${detalle.talla}` : ''}`);
      }
      cambios.push({ asignacion, cant });
      suma = redondear(suma + cant);
    }
    // Lo recibido que no se asigne a nadie queda como stock libre (p. ej. llegaron más pares de los pedidos)
    if (suma > redondear(cantidad) + 0.0005) {
      throw new ErrorCompra(`El reparto de ${detalle.productoNombre}${detalle.talla ? ` talla ${detalle.talla}` : ''} supera lo recibido (${redondear(cantidad)})`);
    }
  } else {
    cambios = [];
    let restante = redondear(cantidad);
    for (const asignacion of asignaciones) {
      if (restante <= 0) break;
      const cant = Math.min(pendiente(asignacion), restante);
      if (cant <= 0) continue;
      cambios.push({ asignacion, cant });
      restante = redondear(restante - cant);
    }
  }

  for (const { asignacion, cant } of cambios) {
    await asignacion.update({ cantidadRecibida: redondear(Number(asignacion.cantidadRecibida) + cant) }, { transaction });
  }
};

module.exports = {
  ErrorCompra,
  ESTADOS_COMPRABLES,
  resumenComprasPorDetalle,
  calcularFaltantes,
  sincronizarEstadoPedido,
  pedidoidsDeOrden,
  crearOrdenDesdePedidos,
  repartirRecepcion,
};
