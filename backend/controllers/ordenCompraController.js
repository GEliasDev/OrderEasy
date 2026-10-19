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
const { calcularFaltantes, crearOrdenDesdePedidos, repartirRecepcion, sincronizarEstadoPedido, pedidoidsDeOrden } = require('../services/compraLoteService');

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
    res.json(await ordenesJson(ordenes));
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
    res.json(await ordenJson(orden));
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
    if (['recibida', 'anulada'].includes(orden.estado)) {
      throw new ErrorOrden('La orden no está disponible para recepción');
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

      const stock = await resolverStockDeDetalle(producto, detalle, t);
      await guardarStock(producto, stock, {
        cantidadDisponible: Number(stock.cantidadDisponible) + solicitado,
      }, t);

      // A qué clientes corresponde lo que llegó (lo elige el usuario o, sin indicar, por orden de pedido)
      await repartirRecepcion({ detalle, cantidad: solicitado, reparto: solicitud?.reparto, transaction: t });

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
    res.json(await ordenJson(await OrdenCompra.findByPk(id, { include: includeOrden })));
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

    await orden.update({ estado: 'anulada' }, { transaction: t });

    for (const pedidoid of await pedidoidsDeOrden(orden.ordenid, t)) {
      await sincronizarEstadoPedido(pedidoid, t);
    }

    await t.commit();
    res.json(await ordenJson(await OrdenCompra.findByPk(id, { include: includeOrden })));
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
  previewLote,
  crearLote,
  getOrdenes,
  getOrdenById,
  recibirOrden,
  anularOrden,
};
