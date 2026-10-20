const OrdenCompra = require('../models/ordenCompraModel');
const OrdenCompraDetalle = require('../models/ordenCompraDetalleModel');
const Producto = require('../models/productModel');
const Egreso = require('../models/egresoModel');
const EgresoDetalle = require('../models/egresoDetalleModel');
const Proveedor = require('../models/proveedorModel');
const Pedido = require('../models/pedidoModel');
const PedidoDetalle = require('../models/pedidoDetalleModel');
const Cliente = require('../models/clientModel');
const Asignacion = require('../models/ordenCompraAsignacionModel');
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const { resolverStockDeDetalle, guardarStock } = require('../services/stockService');
const PedidoPago = require('../models/pedidoPagoModel');
const { resumenPedido } = require('../services/pedidoPagoService');
const {
  calcularFaltantes, crearOrdenDesdePedidos, repartirRecepcion, sincronizarEstadoPedido, pedidoidsDeOrden,
  resumenComprasPorDetalle, enviarOrden, previewOrden, agregarLineaStock, asignarCompras,
} = require('../services/compraLoteService');

class ErrorOrden extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

const includeOrden = [
  {
    model: OrdenCompraDetalle,
    as: 'detalles',
    include: [{
      model: Asignacion,
      as: 'asignaciones',
      include: [{
        model: PedidoDetalle,
        as: 'pedidoDetalle',
        attributes: ['detalleid', 'pedidoid', 'cantidad', 'cantidadEntregada'],
        include: [{
          model: Pedido,
          as: 'pedido',
          attributes: ['pedidoid', 'estado', 'clienteid'],
        }],
      }],
    }],
  },
  { model: Proveedor, as: 'proveedor', attributes: ['proveedorid', 'nombreProveedor', 'razonSocial'] },
  { model: Pedido, as: 'pedido', attributes: ['pedidoid', 'estado'] },
];

// Orden en JSON con el reparto de cada línea en orden estable
const aJson = (orden) => {
  const json = orden.toJSON();
  json.detalles = (json.detalles || []).sort((a, b) => a.detalleid - b.detalleid);
  for (const detalle of json.detalles) {
    detalle.asignaciones = (detalle.asignaciones || []).sort((a, b) => a.asignacionid - b.asignacionid);
  }
  return json;
};

// El cliente se carga aparte: anidado tan profundo, Postgres trunca los alias de columnas (límite de 63 caracteres)
const ordenesJson = async (ordenes) => {
  const jsons = ordenes.map(aJson);
  const pedidos = jsons.flatMap((o) => (o.detalles || []).flatMap((d) => (d.asignaciones || []).map((a) => a.pedidoDetalle?.pedido)));
  const clienteids = [...new Set(pedidos.filter(Boolean).map((p) => p.clienteid).filter(Boolean))];
  const clientes = clienteids.length
    ? await Cliente.findAll({ where: { clienteid: clienteids }, attributes: ['clienteid', 'nombreCliente', 'telefono'] })
    : [];
  const porId = new Map(clientes.map((c) => [c.clienteid, c.toJSON()]));
  for (const pedido of pedidos) {
    if (pedido) pedido.cliente = porId.get(pedido.clienteid) || null;
  }
  return jsons;
};
const ordenJson = async (orden) => (await ordenesJson([orden]))[0];

const responderError = (res, error, mensaje) => {
  if (error.status) return res.status(error.status).json({ mensaje: error.message });
  return res.status(500).json({ mensaje });
};

// Compras de clientes de cada pedido (con su resumen de dinero). Se cargan aparte para no anidar tanto el include.
const comprasDeOrdenes = async (ordenids) => {
  const mapa = new Map(ordenids.map((id) => [id, []]));
  if (!ordenids.length) return mapa;
  const compras = await Pedido.findAll({
    where: { ordenid: ordenids },
    include: [
      { model: PedidoDetalle, as: 'detalles' },
      { model: PedidoPago, as: 'pagos' },
      { model: Cliente, as: 'cliente', attributes: ['clienteid', 'nombreCliente', 'telefono'] },
    ],
    order: [['pedidoid', 'ASC']],
  });
  const jsons = compras.map((c) => {
    const json = c.toJSON();
    json.resumen = resumenPedido(json);
    return json;
  });
  const enCompra = await resumenComprasPorDetalle(jsons.flatMap((j) => j.detalles.map((d) => d.detalleid)));
  for (const json of jsons) {
    for (const detalle of json.detalles) {
      detalle.enCompra = enCompra.get(detalle.detalleid)?.enCompra || 0;
      detalle.recibidoCompra = enCompra.get(detalle.detalleid)?.recibido || 0;
    }
    mapa.get(json.ordenid)?.push(json);
  }
  return mapa;
};

// Mientras el pedido está abierto, el costo al proveedor se calcula solo con el precio de compra vigente de cada producto:
// lo que piden los clientes (sin descontar inventario) + los productos para stock.
const conCostoEstimado = async (json) => {
  if (json.estado !== 'abierta') return;
  const productoids = [...new Set((json.detalles || []).map((d) => d.productoid).filter(Boolean))];
  const productos = productoids.length
    ? await Producto.findAll({ where: { productoid: productoids }, attributes: ['productoid', 'precioCompra'] })
    : [];
  const precios = new Map(productos.map((p) => [p.productoid, Number(p.precioCompra)]));
  let costoStock = 0;
  for (const detalle of json.detalles || []) {
    const precio = precios.get(detalle.productoid) ?? Number(detalle.precioUnitario);
    detalle.precioUnitario = precio;
    detalle.subtotal = Math.round(Number(detalle.cantidad) * precio * 100) / 100;
    costoStock += detalle.subtotal;
  }
  const clientes = (json.compras || []).some((c) => c.estado !== 'anulado' && c.estado !== 'entregado')
    ? await previewOrden({ ordenid: json.ordenid, negocioid: json.negocioid })
    : { total: 0 };
  json.costoEstimado = Math.round((costoStock + Number(clientes.total || 0)) * 100) / 100;
};

const conCompras = async (jsons) => {
  const mapa = await comprasDeOrdenes(jsons.map((j) => j.ordenid));
  for (const json of jsons) {
    json.compras = mapa.get(json.ordenid) || [];
    const vigentes = json.compras.filter((c) => c.estado !== 'anulado');
    json.resumenCompras = {
      cantidad: vigentes.length,
      total: vigentes.reduce((s, c) => s + Number(c.total), 0),
      abonado: vigentes.reduce((s, c) => s + c.resumen.abonado, 0),
      saldo: vigentes.reduce((s, c) => s + c.resumen.saldo, 0),
    };
    await conCostoEstimado(json);
  }
  return jsons;
};

const cargarPedidoCompleto = async (id) => {
  const orden = await OrdenCompra.findByPk(id, { include: includeOrden });
  const [json] = await conCompras(await ordenesJson([orden]));
  return json;
};

// Crea un pedido al proveedor vacío (abierto) para ir agregándole las compras de los clientes
const crearPedido = async (req, res) => {
  try {
    const { negocioid, usuarioid } = req.usuario;
    const { proveedorid, descripcion, nombre } = req.body || {};
    if (proveedorid) {
      const proveedor = await Proveedor.findOne({ where: { proveedorid, negocioid } });
      if (!proveedor) throw new ErrorOrden('Proveedor no encontrado', 404);
    }
    const orden = await OrdenCompra.create({
      negocioid, usuarioid, proveedorid: proveedorid || null, estado: 'abierta', nombre: String(nombre || '').trim().slice(0, 120) || null, descripcion: descripcion || '', total: 0,
    });
    res.status(201).json(await cargarPedidoCompleto(orden.ordenid));
  } catch (error) {
    responderError(res, error, 'Error al crear el pedido');
  }
};

const actualizarPedido = async (req, res) => {
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;
    const { proveedorid, descripcion, nombre } = req.body || {};
    const orden = await OrdenCompra.findOne({ where: { ordenid: id, negocioid } });
    if (!orden) throw new ErrorOrden('Pedido no encontrado', 404);
    if (['recibida', 'anulada'].includes(orden.estado)) throw new ErrorOrden('El pedido ya no se puede modificar');
    if (proveedorid) {
      const proveedor = await Proveedor.findOne({ where: { proveedorid, negocioid } });
      if (!proveedor) throw new ErrorOrden('Proveedor no encontrado', 404);
    }
    await orden.update({
      proveedorid: proveedorid !== undefined ? (proveedorid || null) : orden.proveedorid,
      descripcion: descripcion !== undefined ? descripcion : orden.descripcion,
      nombre: nombre !== undefined ? (String(nombre || '').trim().slice(0, 120) || null) : orden.nombre,
    });
    res.json(await cargarPedidoCompleto(id));
  } catch (error) {
    responderError(res, error, 'Error al actualizar el pedido');
  }
};

// Productos para stock (sin cliente). body: { items: [{ productoid, talla?, cantidad }] }
const agregarStock = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;
    const items = Array.isArray(req.body?.items) ? req.body.items : [req.body];
    if (!items.length) throw new ErrorOrden('Indica al menos un producto');
    for (const item of items) await agregarLineaStock({ ordenid: id, negocioid, item, transaction: t });
    await t.commit();
    res.status(201).json(await cargarPedidoCompleto(id));
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al agregar productos para stock');
  }
};

const quitarStock = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id, detalleid } = req.params;
    const { negocioid } = req.usuario;
    const orden = await OrdenCompra.findOne({ where: { ordenid: id, negocioid }, transaction: t, lock: true });
    if (!orden) throw new ErrorOrden('Pedido no encontrado', 404);
    if (orden.estado !== 'abierta') throw new ErrorOrden('El pedido ya fue enviado al proveedor');
    const borrados = await OrdenCompraDetalle.destroy({ where: { detalleid, ordenid: id }, transaction: t });
    if (!borrados) throw new ErrorOrden('Línea no encontrada', 404);
    await t.commit();
    res.json(await cargarPedidoCompleto(id));
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al quitar la línea');
  }
};

// Agrega al pedido compras de clientes que ya existen. body: { pedidoids: [] }
const asignarComprasAPedido = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;
    await asignarCompras({ ordenid: id, negocioid, pedidoids: req.body?.pedidoids, transaction: t });
    await t.commit();
    res.json(await cargarPedidoCompleto(id));
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al agregar las compras al pedido');
  }
};

const previewPedido = async (req, res) => {
  try {
    res.json(await previewOrden({ ordenid: req.params.id, negocioid: req.usuario.negocioid }));
  } catch (error) {
    responderError(res, error, 'Error al calcular el pedido');
  }
};

const enviarPedido = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    await enviarOrden({ ordenid: id, negocioid: req.usuario.negocioid, transaction: t });
    await t.commit();
    res.json(await cargarPedidoCompleto(id));
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al enviar el pedido');
  }
};

const getOrdenes = async (req, res) => {
  try {
    const { negocioid } = req.usuario;
    const { pedidoid, proveedorid, estado } = req.query;
    const where = { negocioid };

    if (pedidoid) where.pedidoid = pedidoid;
    if (proveedorid) where.proveedorid = proveedorid;
    if (estado) where.estado = estado;

    const ordenes = await OrdenCompra.findAll({
      where,
      include: includeOrden,
      order: [['createdAt', 'DESC']],
    });
    res.json(await conCompras(await ordenesJson(ordenes)));
  } catch {
    res.status(500).json({ mensaje: 'Error al obtener las órdenes de compra' });
  }
};

const getOrdenById = async (req, res) => {
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;
    const orden = await OrdenCompra.findOne({
      where: { ordenid: id, negocioid },
      include: includeOrden,
    });
    if (!orden) throw new ErrorOrden('Orden de compra no encontrada', 404);
    res.json((await conCompras([await ordenJson(orden)]))[0]);
  } catch (error) {
    responderError(res, error, 'Error al obtener la orden de compra');
  }
};

const recibirOrden = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { negocioid, usuarioid } = req.usuario;
    const { items } = req.body;

    const orden = await OrdenCompra.findOne({
      where: { ordenid: id, negocioid },
      transaction: t,
      lock: true,
    });
    if (!orden) throw new ErrorOrden('Orden de compra no encontrada', 404);
    if (!['enviada', 'recibida_parcial', 'borrador'].includes(orden.estado)) {
      throw new ErrorOrden(orden.estado === 'abierta' ? 'Envía el pedido al proveedor antes de recibirlo' : 'La orden no está disponible para recepción');
    }

    const detalles = await OrdenCompraDetalle.findAll({
      where: { ordenid: id },
      transaction: t,
      lock: true,
    });

    const solicitudes = new Map();
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        solicitudes.set(String(item.detalleid), { cantidad: Number(item.cantidad), reparto: item.reparto });
      }
    }

    const egreso = await Egreso.create({
      usuarioid,
      negocioid,
      proveedorid: orden.proveedorid || null,
      descripcion: `Recepción orden de compra #${orden.ordenid}`,
      total: 0,
    }, { transaction: t });

    let totalRecibido = 0;
    let totalEgreso = 0;

    for (const detalle of detalles) {
      const restante = Number(detalle.cantidad) - Number(detalle.cantidadRecibida);
      const solicitud = solicitudes.get(String(detalle.detalleid));
      const solicitado = solicitudes.size > 0 ? (solicitud?.cantidad || 0) : restante;

      if (solicitado <= 0) continue;
      if (solicitado > restante) {
        throw new ErrorOrden(`La cantidad a recibir de ${detalle.productoNombre} supera lo pendiente`);
      }
      if (!detalle.productoid) {
        throw new ErrorOrden(`Producto no encontrado: ${detalle.productoNombre}`);
      }

      const producto = await Producto.findOne({
        where: { productoid: detalle.productoid, negocioid },
        transaction: t,
        lock: true,
      });
      if (!producto) throw new ErrorOrden(`Producto no encontrado: ${detalle.productoNombre}`);

      // A qué clientes corresponde lo que llegó (lo elige el usuario o, sin indicar, por orden de pedido)
      const paraClientes = await repartirRecepcion({ detalle, cantidad: solicitado, reparto: solicitud?.reparto, transaction: t });

      // Entra al inventario y lo asignado a clientes queda reservado para ellos
      const stock = await resolverStockDeDetalle(producto, detalle, t);
      await guardarStock(producto, stock, {
        cantidadDisponible: Number(stock.cantidadDisponible) + solicitado,
        cantidadReservada: Number(stock.cantidadReservada) + paraClientes,
      }, t);

      const subtotal = solicitado * Number(detalle.precioUnitario);
      await EgresoDetalle.create({
        egresoid: egreso.egresoid,
        productoNombre: detalle.productoNombre,
        cantidad: solicitado,
        precioUnitario: detalle.precioUnitario,
        subtotal,
        categoriaid: detalle.categoriaid,
        talla: detalle.talla,
        varianteid: detalle.varianteid,
      }, { transaction: t });

      await detalle.update({
        cantidadRecibida: Number(detalle.cantidadRecibida) + solicitado,
      }, { transaction: t });

      totalRecibido += solicitado;
      totalEgreso += subtotal;
    }

    if (totalRecibido === 0) {
      throw new ErrorOrden('No hay cantidades pendientes por recibir');
    }

    await egreso.update({ total: totalEgreso }, { transaction: t });

    const detallesActualizados = await OrdenCompraDetalle.findAll({
      where: { ordenid: id },
      transaction: t,
    });
    const completa = detallesActualizados.every(
      (detalle) => Number(detalle.cantidadRecibida) >= Number(detalle.cantidad)
    );

    await orden.update({
      estado: completa ? 'recibida' : 'recibida_parcial',
      egresoid: egreso.egresoid,
    }, { transaction: t });

    // El estado de cada pedido involucrado se recalcula con sus asignaciones (en compra / recibido)
    for (const pedidoid of await pedidoidsDeOrden(orden.ordenid, t)) {
      await sincronizarEstadoPedido(pedidoid, t);
    }

    await t.commit();
    res.json(await cargarPedidoCompleto(id));
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al recibir la orden de compra');
  }
};

const anularOrden = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;

    const orden = await OrdenCompra.findOne({
      where: { ordenid: id, negocioid },
      transaction: t,
      lock: true,
    });
    if (!orden) throw new ErrorOrden('Orden de compra no encontrada', 404);
    if (['recibida', 'anulada'].includes(orden.estado)) {
      throw new ErrorOrden('No se puede anular una orden recibida o anulada');
    }
    if (orden.estado === 'recibida_parcial') {
      throw new ErrorOrden('Ya llegó parte de la mercancía; no se puede anular el pedido');
    }

    await orden.update({ estado: 'anulada' }, { transaction: t });

    for (const pedidoid of await pedidoidsDeOrden(orden.ordenid, t)) {
      await sincronizarEstadoPedido(pedidoid, t);
    }
    // Las compras de clientes siguen vigentes pero quedan sin pedido al proveedor
    await Pedido.update({ ordenid: null }, { where: { ordenid: orden.ordenid }, transaction: t });

    await t.commit();
    res.json(await cargarPedidoCompleto(id));
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al anular la orden de compra');
  }
};

// Vista previa de lo que hay que comprar para un grupo de pedidos (por producto y talla, con el reparto por cliente)
const previewLote = async (req, res) => {
  try {
    const { negocioid } = req.usuario;
    const pedidoids = String(req.query.pedidoids || '').split(',').map(Number).filter(Boolean);
    res.json(await calcularFaltantes({ pedidoids, negocioid }));
  } catch (error) {
    responderError(res, error, 'Error al calcular la compra');
  }
};

// Crea una sola orden de compra para varios pedidos. body: { pedidoids: [], proveedorid?, descripcion? }
const crearLote = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { negocioid, usuarioid } = req.usuario;
    const { pedidoids, proveedorid, descripcion } = req.body || {};

    const orden = await crearOrdenDesdePedidos({ pedidoids, proveedorid, descripcion, negocioid, usuarioid, transaction: t });
    await t.commit();
    res.status(201).json(await ordenJson(await OrdenCompra.findByPk(orden.ordenid, { include: includeOrden })));
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al crear la compra');
  }
};

module.exports = {
  crearPedido,
  actualizarPedido,
  agregarStock,
  quitarStock,
  asignarComprasAPedido,
  previewPedido,
  enviarPedido,
  previewLote,
  crearLote,
  getOrdenes,
  getOrdenById,
  recibirOrden,
  anularOrden,
};
