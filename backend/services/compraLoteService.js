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
const sequelize = require('../config/database');
const { resolverStock, resolverStockDeDetalle, guardarStock, validarCantidad, datosTalla } = require('./stockService');
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
// Con `ignorarStock` se pide todo al proveedor (las compras de un pedido al proveedor no salen del inventario).
const calcularFaltantes = async ({ pedidoids, negocioid, transaction, ignorarStock = false, aceptarPendientes = false }) => {
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
    if (!ESTADOS_COMPRABLES.includes(pedido.estado) && !(aceptarPendientes && pedido.estado === 'pendiente')) {
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
    let libre = ignorarStock ? 0 : Math.max(0, Number(stock.cantidadDisponible) - reservadoOtros);

    // Cada línea se cotiza con el costo que tenía al crear la compra; si es anterior a ese dato, con el precio actual
    const costoDe = (detalle) => (detalle.precioCompra !== null && detalle.precioCompra !== undefined
      ? Number(detalle.precioCompra)
      : Number(producto.precioCompra));
    let costoFaltante = 0;

    const detalleLineas = lineasGrupo.map(({ pedido, detalle }) => {
      const pendiente = pendienteDe(detalle);
      const cubiertoStock = redondear(Math.min(libre, pendiente));
      libre = redondear(libre - cubiertoStock);
      const yaEnCompra = enCompra.get(detalle.detalleid)?.enCompra || 0;
      const faltante = Math.max(0, redondear(pendiente - cubiertoStock - yaEnCompra));
      costoFaltante += faltante * costoDe(detalle);
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
      imagen: producto.imagenes?.[0] || null,
      talla: primero.talla || null,
      varianteid: primero.varianteid || null,
      categoriaid: producto.categoriaid,
      unidadMedida: producto.unidadMedida,
      // Precio promedio de lo que falta (si las compras se hicieron con costos distintos); el costo total es exacto
      precioCompra: totalFaltante > 0 ? dos(costoFaltante / totalFaltante) : Number(producto.precioCompra),
      lineas: detalleLineas,
      totalFaltante,
      costo: dos(costoFaltante),
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
    include: [{ model: PedidoDetalle, as: 'pedidoDetalle', attributes: ['pedidoid'], include: [{ model: Pedido, as: 'pedido', attributes: ['estado', 'ordenid'] }] }],
    order: [['asignacionid', 'ASC']],
    transaction,
  });
  // Si un cliente canceló, su par ya no es de nadie: lo que llegue de más queda como stock libre
  const asignaciones = todas.filter((a) => a.pedidoDetalle?.pedido?.estado !== 'anulado');
  if (asignaciones.length === 0) return 0;

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

  let reservable = 0;
  for (const { asignacion, cant } of cambios) {
    await asignacion.update({ cantidadRecibida: redondear(Number(asignacion.cantidadRecibida) + cant) }, { transaction });
    if (asignacion.pedidoDetalle?.pedido?.ordenid) reservable = redondear(reservable + cant);
  }
  return reservable;
};

// ───────────── Pedido al proveedor como contenedor de compras de clientes ─────────────
// Flujo: abierta (se le agregan compras de clientes y líneas para stock) -> enviada (se congela lo pedido)
// -> recibida_parcial / recibida (al recibir se reparte cada par entre los clientes; lo demás queda en stock).

// Las compras de clientes dentro de un pedido al proveedor NO usan el inventario: no reservan stock mientras se piden.
// El stock se reserva para el cliente cuando llega la mercancía (al registrar la recepción).

// Si una compra ya reservaba stock del inventario (compra suelta confirmada), se libera al meterla en un pedido.
const liberarReserva = async (pedido, negocioid, transaction) => {
  if (!['confirmado', 'en_compra', 'recibido'].includes(pedido.estado)) return;
  const detalles = await PedidoDetalle.findAll({ where: { pedidoid: pedido.pedidoid }, transaction });
  for (const detalle of detalles) {
    if (!detalle.productoid) continue;
    const pendiente = Math.max(0, redondear(Number(detalle.cantidad) - Number(detalle.cantidadEntregada || 0)));
    if (pendiente <= 0) continue;
    const producto = await Producto.findOne({ where: { productoid: detalle.productoid, negocioid }, transaction, lock: true });
    if (!producto) continue;
    const stock = await resolverStockDeDetalle(producto, detalle, transaction);
    await guardarStock(producto, stock, { cantidadReservada: Math.max(0, Number(stock.cantidadReservada) - pendiente) }, transaction);
  }
};

const cargarOrden = async (ordenid, negocioid, transaction) => {
  const orden = await OrdenCompra.findOne({ where: { ordenid, negocioid }, transaction, lock: transaction ? true : undefined });
  if (!orden) throw new ErrorCompra('Pedido no encontrado', 404);
  return orden;
};

const exigirAbierta = (orden) => {
  if (orden.estado !== 'abierta') {
    throw new ErrorCompra('El pedido ya fue enviado al proveedor; crea otro pedido para agregar más compras');
  }
};

const vigente = (compra) => !['anulado', 'entregado'].includes(compra.estado);

// Envía el pedido al proveedor: calcula lo que se pide por producto y talla (todo lo de los clientes, sin tocar el inventario)
// y deja el reparto por cliente. Las líneas para stock quedan sumadas a la misma línea de producto.
const enviarOrden = async ({ ordenid, negocioid, transaction }) => {
  const orden = await cargarOrden(ordenid, negocioid, transaction);
  exigirAbierta(orden);

  const compras = await Pedido.findAll({ where: { ordenid, negocioid }, transaction, lock: true });
  for (const compra of compras.filter((c) => c.estado === 'pendiente')) {
    await compra.update({ estado: 'confirmado' }, { transaction });
  }
  const ids = compras.filter(vigente).map((c) => c.pedidoid);

  const lineasStock = await OrdenCompraDetalle.findAll({ where: { ordenid }, transaction });

  let grupos = [];
  if (ids.length > 0) ({ grupos } = await calcularFaltantes({ pedidoids: ids, negocioid, transaction, ignorarStock: true }));
  if (grupos.length === 0 && lineasStock.length === 0) {
    throw new ErrorCompra('No hay nada que pedir: agrega compras de clientes o productos para stock');
  }

  for (const grupo of grupos) {
    let detalle = lineasStock.find((d) => Number(d.productoid) === Number(grupo.productoid) && Number(d.varianteid || 0) === Number(grupo.varianteid || 0));
    if (detalle) {
      // Cada unidad conserva su precio: el de la línea de stock y el de las compras de clientes se promedian
      const nuevaCantidad = redondear(Number(detalle.cantidad) + grupo.totalFaltante);
      const precio = dos((Number(detalle.cantidad) * Number(detalle.precioUnitario) + grupo.totalFaltante * grupo.precioCompra) / nuevaCantidad);
      await detalle.update({ cantidad: nuevaCantidad, precioUnitario: precio }, { transaction });
    } else {
      detalle = await OrdenCompraDetalle.create({
        ordenid, productoid: grupo.productoid, productoNombre: grupo.productoNombre, cantidad: grupo.totalFaltante, cantidadRecibida: 0,
        precioUnitario: grupo.precioCompra, subtotal: 0, categoriaid: grupo.categoriaid, talla: grupo.talla, varianteid: grupo.varianteid,
      }, { transaction });
    }
    for (const linea of grupo.lineas.filter((l) => l.faltante > 0)) {
      await Asignacion.create({ ordendetalleid: detalle.detalleid, pedidodetalleid: linea.detalleid, cantidad: linea.faltante }, { transaction });
    }
  }

  let total = 0;
  for (const detalle of await OrdenCompraDetalle.findAll({ where: { ordenid }, transaction })) {
    // El costo usa el precio guardado en cada línea (el de cuando se creó la compra o se agregó el producto), no el actual del inventario
    const subtotal = dos(Number(detalle.cantidad) * Number(detalle.precioUnitario));
    await detalle.update({ subtotal }, { transaction });
    total += subtotal;
  }
  await orden.update({ estado: 'enviada', total: dos(total) }, { transaction });
  for (const id of ids) await sincronizarEstadoPedido(id, transaction);
  return orden;
};

// Vista previa de "Enviar": cuánto se pide por producto y talla y para quién (el inventario no se descuenta)
const previewOrden = async ({ ordenid, negocioid }) => {
  await cargarOrden(ordenid, negocioid);
  const compras = await Pedido.findAll({ where: { ordenid, negocioid }, attributes: ['pedidoid', 'estado'] });
  const ids = compras.filter(vigente).map((c) => c.pedidoid);
  return ids.length ? calcularFaltantes({ pedidoids: ids, negocioid, ignorarStock: true, aceptarPendientes: true }) : { grupos: [], total: 0 };
};

// Agrega al pedido abierto una línea sin cliente (va directo al stock al recibirla). Acumula si ya existe producto y talla.
const agregarLineaStock = async ({ ordenid, negocioid, item, transaction }) => {
  const orden = await cargarOrden(ordenid, negocioid, transaction);
  exigirAbierta(orden);
  const where = { negocioid };
  if (item.productoid) where.productoid = item.productoid;
  else if (item.productoNombre) where.nombre = item.productoNombre;
  else throw new ErrorCompra('Indica el producto');
  const producto = await Producto.findOne({ where, transaction, lock: true });
  if (!producto) throw new ErrorCompra(`Producto no encontrado: ${item.productoNombre || item.productoid}`);
  const cantidad = validarCantidad(item.cantidad, producto);
  const stock = await resolverStock(producto, item.talla, transaction);
  const { talla, varianteid } = datosTalla(producto, stock);

  const existente = await OrdenCompraDetalle.findOne({
    where: { ordenid, productoid: producto.productoid, varianteid: varianteid || null }, transaction,
  });
  const nueva = redondear(Number(existente?.cantidad || 0) + cantidad);
  const valores = { cantidad: nueva, subtotal: dos(nueva * Number(producto.precioCompra)) };
  if (existente) {
    // Lo que ya estaba conserva su precio; solo lo nuevo se cotiza al precio actual
    const precio = dos((Number(existente.cantidad) * Number(existente.precioUnitario) + cantidad * Number(producto.precioCompra)) / nueva);
    return existente.update({ cantidad: nueva, precioUnitario: precio, subtotal: dos(nueva * precio) }, { transaction });
  }
  return OrdenCompraDetalle.create({
    ordenid, productoid: producto.productoid, productoNombre: producto.nombre, cantidadRecibida: 0,
    precioUnitario: producto.precioCompra, categoriaid: producto.categoriaid, talla, varianteid, ...valores,
  }, { transaction });
};

// Vincula compras de clientes que ya existían (sin pedido al proveedor) a un pedido abierto
const asignarCompras = async ({ ordenid, negocioid, pedidoids, transaction }) => {
  const orden = await cargarOrden(ordenid, negocioid, transaction);
  exigirAbierta(orden);
  const ids = [...new Set((pedidoids || []).map(Number).filter(Boolean))];
  if (ids.length === 0) throw new ErrorCompra('Selecciona al menos una compra');
  const compras = await Pedido.findAll({ where: { pedidoid: ids, negocioid }, transaction, lock: true });
  if (compras.length !== ids.length) throw new ErrorCompra('Alguna de las compras no existe', 404);
  for (const c of compras) {
    if (['entregado', 'anulado'].includes(c.estado)) throw new ErrorCompra(`La compra #${c.pedidoid} está ${c.estado}`);
    if (c.ordenid && Number(c.ordenid) !== Number(ordenid)) throw new ErrorCompra(`La compra #${c.pedidoid} ya pertenece a otro pedido`);
  }
  for (const c of compras) {
    const yaPedida = await Asignacion.count({ include: [{ model: PedidoDetalle, as: 'pedidoDetalle', where: { pedidoid: c.pedidoid }, attributes: [] }], transaction });
    if (yaPedida > 0) throw new ErrorCompra(`La compra #${c.pedidoid} ya tiene una orden de compra; no se puede mover`);
    await liberarReserva(c, negocioid, transaction);
    await c.update({ ordenid, estado: 'confirmado' }, { transaction });
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
  liberarReserva,
  enviarOrden,
  previewOrden,
  agregarLineaStock,
  asignarCompras,
};
