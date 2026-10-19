const Pedido = require('../models/pedidoModel');
const PedidoDetalle = require('../models/pedidoDetalleModel');
const OrdenCompra = require('../models/ordenCompraModel');
const OrdenCompraDetalle = require('../models/ordenCompraDetalleModel');
const Producto = require('../models/productModel');
const Variante = require('../models/varianteModel');
const Venta = require('../models/ventaModel');
const VentaDetalle = require('../models/ventaDetalleModel');
const Cliente = require('../models/clientModel');
const Proveedor = require('../models/proveedorModel');
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const { ErrorStock, validarCantidad, resolverStock, resolverStockDeDetalle, guardarStock, disponibleReal, datosTalla, etiquetaDetalle } = require('../services/stockService');

class ErrorPedido extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

const includePedido = [
  {
    model: PedidoDetalle,
    as: 'detalles',
    include: [
      {
        model: Producto,
        as: 'producto',
        attributes: ['productoid', 'nombre', 'cantidadDisponible', 'cantidadReservada', 'unidadMedida', 'usaTallas'],
        include: [{ model: Variante, as: 'variantes' }],
      },
    ],
  },
  { model: Cliente, as: 'cliente', attributes: ['clienteid', 'nombreCliente'] },
  {
    model: OrdenCompra,
    as: 'ordenes',
    include: [
      { model: OrdenCompraDetalle, as: 'detalles' },
      { model: Proveedor, as: 'proveedor', attributes: ['proveedorid', 'nombreProveedor', 'razonSocial'] },
    ],
  },
];

const cargarPedido = async (id, negocioid) => {
  const pedido = await Pedido.findOne({
    where: { pedidoid: id, negocioid },
    include: includePedido,
  });
  if (!pedido) throw new ErrorPedido('Pedido no encontrado', 404);
  return pedido;
};

const buscarProducto = async (item, negocioid, transaction) => {
  const where = { negocioid };
  if (item.productoid) where.productoid = item.productoid;
  else if (item.productoNombre) where.nombre = item.productoNombre;
  else throw new ErrorPedido('Cada item debe incluir productoid o productoNombre');

  const producto = await Producto.findOne({ where, transaction, lock: true });
  if (!producto) {
    throw new ErrorPedido(`Producto no encontrado: ${item.productoNombre || item.productoid}`);
  }
  return producto;
};

const responderError = (res, error, mensaje) => {
  if (error.status) return res.status(error.status).json({ mensaje: error.message });
  return res.status(500).json({ mensaje });
};

const createPedido = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { clienteid, descripcion, fechaEntrega, items } = req.body;
    const { usuarioid, negocioid } = req.usuario;

    if (!Array.isArray(items) || items.length === 0) {
      throw new ErrorPedido('Debe incluir al menos un producto');
    }

    const pedido = await Pedido.create({
      usuarioid,
      negocioid,
      clienteid: clienteid || null,
      descripcion: descripcion || '',
      fechaEntrega: fechaEntrega || null,
      total: 0,
    }, { transaction: t });

    let total = 0;
    for (const item of items) {
      const producto = await buscarProducto(item, negocioid, t);
      const cantidad = validarCantidad(item.cantidad, producto);
      const stock = await resolverStock(producto, item.talla, t);
      const subtotal = cantidad * Number(producto.precioVenta);
      total += subtotal;

      await PedidoDetalle.create({
        pedidoid: pedido.pedidoid,
        productoid: producto.productoid,
        productoNombre: producto.nombre,
        cantidad,
        precioUnitario: producto.precioVenta,
        subtotal,
        categoriaid: producto.categoriaid,
        ...datosTalla(producto, stock),
      }, { transaction: t });
    }

    await pedido.update({ total }, { transaction: t });
    await t.commit();
    res.status(201).json(await cargarPedido(pedido.pedidoid, negocioid));
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al crear el pedido');
  }
};

const getPedidos = async (req, res) => {
  try {
    const { negocioid } = req.usuario;
    const { estado, from, to } = req.query;
    const where = { negocioid };

    if (estado) where.estado = estado;
    if (from && to) {
      where.createdAt = {
        [Op.between]: [
          new Date(from + 'T00:00:00.000Z'),
          new Date(to + 'T23:59:59.999Z'),
        ],
      };
    }

    const pedidos = await Pedido.findAll({
      where,
      include: includePedido,
      order: [['createdAt', 'DESC']],
    });
    res.json(pedidos);
  } catch {
    res.status(500).json({ mensaje: 'Error al obtener los pedidos' });
  }
};

const getPedidoById = async (req, res) => {
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;
    res.json(await cargarPedido(id, negocioid));
  } catch (error) {
    responderError(res, error, 'Error al obtener el pedido');
  }
};

const updatePedido = async (req, res) => {
  const t = await sequelize.transaction();
  let transaccionFinalizada = false;
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;
    const { descripcion, fechaEntrega, clienteid, items } = req.body;

    const pedido = await Pedido.findOne({
      where: { pedidoid: id, negocioid },
      transaction: t,
      lock: true,
    });
    if (!pedido) throw new ErrorPedido('Pedido no encontrado', 404);
    if (['entregado', 'anulado'].includes(pedido.estado)) {
      throw new ErrorPedido('No se puede editar un pedido entregado o anulado');
    }

    let total;
    if (items !== undefined) {
      if (pedido.estado !== 'pendiente') {
        throw new ErrorPedido('Solo se pueden modificar los productos de un pedido pendiente');
      }
      if (!Array.isArray(items) || items.length === 0) {
        throw new ErrorPedido('Debe incluir al menos un producto');
      }

      const ordenes = await OrdenCompra.count({ where: { pedidoid: id }, transaction: t });
      if (ordenes > 0) {
        throw new ErrorPedido('El pedido tiene órdenes de compra asociadas; no se pueden modificar los productos');
      }

      const detallesActuales = await PedidoDetalle.findAll({
        where: { pedidoid: id },
        transaction: t,
      });
      const preciosActuales = new Map(
        detallesActuales
          .filter((detalle) => detalle.productoid)
          .map((detalle) => [Number(detalle.productoid), Number(detalle.precioUnitario)])
      );

      const itemsPorProducto = new Map();
      for (const item of items) {
        const producto = await buscarProducto(item, negocioid, t);
        const cantidad = validarCantidad(item.cantidad, producto);
        const stock = await resolverStock(producto, item.talla, t);
        const clave = `${producto.productoid}:${stock.varianteid || ''}`;
        const previo = itemsPorProducto.get(clave);
        if (previo) {
          previo.cantidad = Math.round((previo.cantidad + cantidad) * 1000) / 1000;
        } else {
          itemsPorProducto.set(clave, { producto, stock, cantidad });
        }
      }

      await PedidoDetalle.destroy({ where: { pedidoid: id }, transaction: t });

      total = 0;
      for (const { producto, stock, cantidad } of itemsPorProducto.values()) {
        const precioUnitario = preciosActuales.get(Number(producto.productoid))
          ?? Number(producto.precioVenta);
        const subtotal = cantidad * precioUnitario;
        total += subtotal;

        await PedidoDetalle.create({
          pedidoid: pedido.pedidoid,
          productoid: producto.productoid,
          productoNombre: producto.nombre,
          cantidad,
          precioUnitario,
          subtotal,
          categoriaid: producto.categoriaid,
          ...datosTalla(producto, stock),
        }, { transaction: t });
      }
    }

    await pedido.update({
      descripcion: descripcion !== undefined ? descripcion : pedido.descripcion,
      fechaEntrega: fechaEntrega !== undefined ? (fechaEntrega || null) : pedido.fechaEntrega,
      clienteid: clienteid !== undefined ? (clienteid || null) : pedido.clienteid,
      ...(items !== undefined ? { total } : {}),
    }, { transaction: t });

    await t.commit();
    transaccionFinalizada = true;
    res.json(await cargarPedido(id, negocioid));
  } catch (error) {
    if (!transaccionFinalizada) await t.rollback();
    responderError(res, error, 'Error al actualizar el pedido');
  }
};

const confirmarPedido = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;

    const pedido = await Pedido.findOne({
      where: { pedidoid: id, negocioid },
      transaction: t,
      lock: true,
    });
    if (!pedido) throw new ErrorPedido('Pedido no encontrado', 404);
    if (pedido.estado !== 'pendiente') {
      throw new ErrorPedido('Solo se pueden confirmar pedidos pendientes');
    }

    const detalles = await PedidoDetalle.findAll({ where: { pedidoid: id }, transaction: t });
    for (const detalle of detalles) {
      if (!detalle.productoid) continue;
      const producto = await Producto.findOne({
        where: { productoid: detalle.productoid, negocioid },
        transaction: t,
        lock: true,
      });
      if (!producto) throw new ErrorPedido(`Producto no encontrado: ${detalle.productoNombre}`);

      const stock = await resolverStockDeDetalle(producto, detalle, t);
      await guardarStock(producto, stock, {
        cantidadReservada: Number(stock.cantidadReservada) + Number(detalle.cantidad),
      }, t);
    }

    await pedido.update({ estado: 'confirmado' }, { transaction: t });
    await t.commit();
    res.json(await cargarPedido(id, negocioid));
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al confirmar el pedido');
  }
};

const anularPedido = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;

    const pedido = await Pedido.findOne({
      where: { pedidoid: id, negocioid },
      transaction: t,
      lock: true,
    });
    if (!pedido) throw new ErrorPedido('Pedido no encontrado', 404);
    if (pedido.estado === 'anulado') {
      await t.rollback();
      return res.json(await cargarPedido(id, negocioid));
    }
    if (pedido.estado === 'entregado') {
      throw new ErrorPedido('No se puede anular un pedido ya entregado');
    }

    if (['confirmado', 'en_compra', 'recibido'].includes(pedido.estado)) {
      const detalles = await PedidoDetalle.findAll({ where: { pedidoid: id }, transaction: t });
      for (const detalle of detalles) {
        if (!detalle.productoid) continue;
        const producto = await Producto.findOne({
          where: { productoid: detalle.productoid, negocioid },
          transaction: t,
          lock: true,
        });
        if (producto) {
          const stock = await resolverStockDeDetalle(producto, detalle, t);
          await guardarStock(producto, stock, {
            cantidadReservada: Math.max(0, Number(stock.cantidadReservada) - Number(detalle.cantidad)),
          }, t);
        }
      }
    }

    const ordenes = await OrdenCompra.findAll({
      where: {
        pedidoid: id,
        negocioid,
        estado: { [Op.in]: ['borrador', 'enviada'] },
      },
      transaction: t,
    });
    for (const orden of ordenes) {
      await orden.update({ estado: 'anulada' }, { transaction: t });
    }

    await pedido.update({ estado: 'anulado' }, { transaction: t });
    await t.commit();
    res.json(await cargarPedido(id, negocioid));
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al anular el pedido');
  }
};

const convertirAVenta = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { negocioid, usuarioid } = req.usuario;

    const pedido = await Pedido.findOne({
      where: { pedidoid: id, negocioid },
      transaction: t,
      lock: true,
    });
    if (!pedido) throw new ErrorPedido('Pedido no encontrado', 404);
    if (pedido.estado === 'entregado') throw new ErrorPedido('El pedido ya fue convertido en venta');
    if (pedido.estado === 'anulado') throw new ErrorPedido('El pedido está anulado');

    const detalles = await PedidoDetalle.findAll({ where: { pedidoid: id }, transaction: t });
    if (detalles.length === 0) throw new ErrorPedido('El pedido no tiene productos');

    const venta = await Venta.create({
      usuarioid,
      negocioid,
      clienteid: pedido.clienteid || null,
      descripcion: pedido.descripcion || `Pedido #${pedido.pedidoid}`,
      total: 0,
      descuentoTotal: 0,
      descuentoTipoTotal: 'fijo',
    }, { transaction: t });

    let total = 0;
    for (const detalle of detalles) {
      if (!detalle.productoid) throw new ErrorPedido(`Producto no encontrado: ${detalle.productoNombre}`);
      const producto = await Producto.findOne({
        where: { productoid: detalle.productoid, negocioid },
        transaction: t,
        lock: true,
      });
      if (!producto) throw new ErrorPedido(`Producto no encontrado: ${detalle.productoNombre}`);
      const stock = await resolverStockDeDetalle(producto, detalle, t);
      if (Number(stock.cantidadDisponible) < Number(detalle.cantidad)) {
        throw new ErrorPedido(`Stock insuficiente para ${etiquetaDetalle(detalle)}. Recibe la compra antes de entregar.`);
      }

      const subtotal = Number(detalle.subtotal);
      const tasaIva = Number(producto.tasaIva || 0);
      const montoIva = tasaIva > 0 ? subtotal * tasaIva / (100 + tasaIva) : 0;

      await VentaDetalle.create({
        ventaid: venta.ventaid,
        productoNombre: detalle.productoNombre,
        cantidad: detalle.cantidad,
        precioUnitario: detalle.precioUnitario,
        subtotal,
        descuento: 0,
        descuentoTipo: 'fijo',
        categoriaid: detalle.categoriaid,
        tasaIva,
        montoIva: Number(montoIva.toFixed(2)),
        talla: detalle.talla,
        varianteid: detalle.varianteid,
      }, { transaction: t });

      await guardarStock(producto, stock, {
        cantidadDisponible: Number(stock.cantidadDisponible) - Number(detalle.cantidad),
        cantidadReservada: Math.max(0, Number(stock.cantidadReservada) - Number(detalle.cantidad)),
      }, t);

      total += subtotal;
    }

    await venta.update({ total }, { transaction: t });
    await pedido.update({ estado: 'entregado', ventaid: venta.ventaid }, { transaction: t });
    await t.commit();

    res.json({
      mensaje: 'Pedido convertido en venta',
      ventaid: venta.ventaid,
      pedido: await cargarPedido(id, negocioid),
    });
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al convertir el pedido en venta');
  }
};

const generarOrdenCompra = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { negocioid, usuarioid } = req.usuario;
    const { proveedorid, descripcion } = req.body;

    const pedido = await Pedido.findOne({
      where: { pedidoid: id, negocioid },
      transaction: t,
      lock: true,
    });
    if (!pedido) throw new ErrorPedido('Pedido no encontrado', 404);
    if (!['confirmado', 'en_compra', 'recibido'].includes(pedido.estado)) {
      throw new ErrorPedido('Confirma el pedido antes de generar la orden de compra');
    }

    const detalles = await PedidoDetalle.findAll({ where: { pedidoid: id }, transaction: t });
    const ordenesActivas = await OrdenCompra.findAll({
      where: {
        pedidoid: id,
        negocioid,
        estado: { [Op.in]: ['borrador', 'enviada', 'recibida_parcial'] },
      },
      include: [{ model: OrdenCompraDetalle, as: 'detalles' }],
      transaction: t,
    });

    // Una línea es "producto + talla": el faltante se calcula por talla
    const claveDetalle = (d) => `${d.productoid || d.productoNombre}:${d.varianteid || ''}`;

    const pendientesPorProducto = new Map();
    for (const orden of ordenesActivas) {
      for (const detalle of orden.detalles) {
        const key = claveDetalle(detalle);
        const pendiente = Number(detalle.cantidad) - Number(detalle.cantidadRecibida);
        pendientesPorProducto.set(key, (pendientesPorProducto.get(key) || 0) + pendiente);
      }
    }

    const orden = await OrdenCompra.create({
      negocioid,
      proveedorid: proveedorid || null,
      pedidoid: id,
      usuarioid,
      estado: 'enviada',
      descripcion: descripcion || `Pedido #${id}`,
      total: 0,
    }, { transaction: t });

    let total = 0;
    for (const detalle of detalles) {
      if (!detalle.productoid) continue;
      const producto = await Producto.findOne({
        where: { productoid: detalle.productoid, negocioid },
        transaction: t,
        lock: true,
      });
      if (!producto) throw new ErrorPedido(`Producto no encontrado: ${detalle.productoNombre}`);

      const stock = await resolverStockDeDetalle(producto, detalle, t);
      const key = claveDetalle(detalle);
      const yaPedido = pendientesPorProducto.get(key) || 0;
      const reservadoOtros = Math.max(
        0,
        Number(stock.cantidadReservada) - Number(detalle.cantidad)
      );
      const disponibleParaPedido = Math.max(
        0,
        Number(stock.cantidadDisponible) - reservadoOtros
      );
      const faltante = Math.max(
        0,
        Number(detalle.cantidad) - disponibleParaPedido - yaPedido
      );
      if (faltante <= 0) continue;

      const precioUnitario = Number(producto.precioCompra);
      const subtotal = faltante * precioUnitario;

      await OrdenCompraDetalle.create({
        ordenid: orden.ordenid,
        productoid: producto.productoid,
        productoNombre: producto.nombre,
        cantidad: faltante,
        cantidadRecibida: 0,
        precioUnitario,
        subtotal,
        categoriaid: producto.categoriaid,
        ...datosTalla(producto, stock),
      }, { transaction: t });

      total += subtotal;
    }

    if (total === 0) {
      throw new ErrorPedido('El stock actual y las órdenes existentes ya cubren este pedido');
    }

    await orden.update({ total }, { transaction: t });
    if (pedido.estado === 'confirmado') {
      await pedido.update({ estado: 'en_compra' }, { transaction: t });
    }
    await t.commit();

    const ordenCompleta = await OrdenCompra.findByPk(orden.ordenid, {
      include: [
        { model: OrdenCompraDetalle, as: 'detalles' },
        { model: Proveedor, as: 'proveedor', attributes: ['proveedorid', 'nombreProveedor', 'razonSocial'] },
      ],
    });
    res.status(201).json(ordenCompleta);
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al generar la orden de compra');
  }
};

const deletePedido = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;

    const pedido = await Pedido.findOne({
      where: { pedidoid: id, negocioid },
      transaction: t,
      lock: true,
    });
    if (!pedido) throw new ErrorPedido('Pedido no encontrado', 404);
    if (!['pendiente', 'anulado'].includes(pedido.estado)) {
      throw new ErrorPedido('Solo se pueden eliminar pedidos pendientes o anulados');
    }

    const ordenes = await OrdenCompra.count({ where: { pedidoid: id }, transaction: t });
    if (ordenes > 0) {
      throw new ErrorPedido('El pedido tiene órdenes de compra asociadas; anúlalo en lugar de eliminarlo');
    }

    await PedidoDetalle.destroy({ where: { pedidoid: id }, transaction: t });
    await pedido.destroy({ transaction: t });
    await t.commit();
    res.json({ mensaje: 'Pedido eliminado' });
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al eliminar el pedido');
  }
};

module.exports = {
  createPedido,
  getPedidos,
  getPedidoById,
  updatePedido,
  confirmarPedido,
  anularPedido,
  convertirAVenta,
  generarOrdenCompra,
  deletePedido,
};
