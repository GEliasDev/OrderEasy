const OrdenCompra = require('../models/ordenCompraModel');
const OrdenCompraDetalle = require('../models/ordenCompraDetalleModel');
const Producto = require('../models/productModel');
const Egreso = require('../models/egresoModel');
const EgresoDetalle = require('../models/egresoDetalleModel');
const Proveedor = require('../models/proveedorModel');
const Pedido = require('../models/pedidoModel');
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const { resolverStockDeDetalle, guardarStock } = require('../services/stockService');

class ErrorOrden extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

const includeOrden = [
  { model: OrdenCompraDetalle, as: 'detalles' },
  { model: Proveedor, as: 'proveedor', attributes: ['proveedorid', 'nombreProveedor', 'razonSocial'] },
  { model: Pedido, as: 'pedido', attributes: ['pedidoid', 'estado'] },
];

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
    res.json(ordenes);
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
    res.json(orden);
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
        solicitudes.set(String(item.detalleid), Number(item.cantidad));
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
      const solicitado = solicitudes.size > 0
        ? (solicitudes.get(String(detalle.detalleid)) || 0)
        : restante;

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

    if (completa && orden.pedidoid) {
      const otrasActivas = await OrdenCompra.count({
        where: {
          pedidoid: orden.pedidoid,
          negocioid,
          ordenid: { [Op.ne]: orden.ordenid },
          estado: { [Op.in]: ['borrador', 'enviada', 'recibida_parcial'] },
        },
        transaction: t,
      });

      if (otrasActivas === 0) {
        const pedido = await Pedido.findOne({
          where: { pedidoid: orden.pedidoid, negocioid },
          transaction: t,
          lock: true,
        });
        if (pedido && ['confirmado', 'en_compra'].includes(pedido.estado)) {
          await pedido.update({ estado: 'recibido' }, { transaction: t });
        }
      }
    }

    await t.commit();
    res.json(await OrdenCompra.findByPk(id, { include: includeOrden }));
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

    if (orden.pedidoid) {
      const activas = await OrdenCompra.count({
        where: {
          pedidoid: orden.pedidoid,
          negocioid,
          estado: { [Op.in]: ['borrador', 'enviada', 'recibida_parcial'] },
        },
        transaction: t,
      });

      if (activas === 0) {
        const pedido = await Pedido.findOne({
          where: { pedidoid: orden.pedidoid, negocioid },
          transaction: t,
          lock: true,
        });
        if (pedido && pedido.estado === 'en_compra') {
          await pedido.update({ estado: 'confirmado' }, { transaction: t });
        }
      }
    }

    await t.commit();
    res.json(await OrdenCompra.findByPk(id, { include: includeOrden }));
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al anular la orden de compra');
  }
};

module.exports = {
  getOrdenes,
  getOrdenById,
  recibirOrden,
  anularOrden,
};
