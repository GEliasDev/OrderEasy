const Pedido = require('../models/pedidoModel');
const PedidoDetalle = require('../models/pedidoDetalleModel');
const OrdenCompra = require('../models/ordenCompraModel');
const OrdenCompraDetalle = require('../models/ordenCompraDetalleModel');
const Producto = require('../models/productModel');
const Variante = require('../models/varianteModel');
const Venta = require('../models/ventaModel');
const PedidoPago = require('../models/pedidoPagoModel');
const VentaDetalle = require('../models/ventaDetalleModel');
const Cliente = require('../models/clientModel');
const Proveedor = require('../models/proveedorModel');
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const { ErrorPago, dos, resumenPedido, registrarMovimiento, aplicarAbonosAVenta, saldoAFavorDeCliente, usarSaldoAFavor } = require('../services/pedidoPagoService');
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
  { model: Cliente, as: 'cliente', attributes: ['clienteid', 'nombreCliente', 'telefono'] },
  { model: PedidoPago, as: 'pagos' },
  { model: Venta, as: 'ventas', attributes: ['ventaid', 'total', 'createdAt'] },
  {
    model: OrdenCompra,
    as: 'ordenes',
    include: [
      { model: OrdenCompraDetalle, as: 'detalles' },
      { model: Proveedor, as: 'proveedor', attributes: ['proveedorid', 'nombreProveedor', 'razonSocial'] },
    ],
  },
];

// Pedido en JSON con el resumen de dinero (abonado, saldo, entregado...) y los movimientos en orden
const conResumen = (pedido) => {
  const json = pedido.toJSON();
  json.pagos = (json.pagos || []).sort((a, b) => a.pagoid - b.pagoid);
  json.ventas = (json.ventas || []).sort((a, b) => a.ventaid - b.ventaid);
  json.resumen = resumenPedido(json);
  return json;
};

const cargarPedido = async (id, negocioid) => {
  const pedido = await Pedido.findOne({
    where: { pedidoid: id, negocioid },
    include: includePedido,
  });
  if (!pedido) throw new ErrorPedido('Pedido no encontrado', 404);
  return conResumen(pedido);
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
    const { clienteid, descripcion, fechaEntrega, items, abono } = req.body;
    const { usuarioid, negocioid } = req.usuario;

    if (!clienteid) {
      throw new ErrorPedido('Selecciona el cliente del pedido');
    }
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

    await pedido.update({ total: dos(total) }, { transaction: t });

    if (abono && Number(abono.monto) > 0) {
      const detallesCreados = await PedidoDetalle.findAll({ where: { pedidoid: pedido.pedidoid }, transaction: t });
      await registrarMovimiento({
        pedido, detalles: detallesCreados, tipo: 'abono', monto: abono.monto, metodo: abono.metodo,
        nota: abono.nota || 'Abono inicial', usuarioid, transaction: t,
      });
    }

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
    res.json(pedidos.map(conResumen));
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

      const pagosPedido = await PedidoPago.findAll({ where: { pedidoid: id }, transaction: t });
      const { abonado } = resumenPedido({ estado: pedido.estado, total, detalles: [], pagos: pagosPedido });
      if (abonado > dos(total) + 0.001) {
        throw new ErrorPedido('Los abonos registrados superan el nuevo total del pedido');
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
          const pendiente = Number(detalle.cantidad) - Number(detalle.cantidadEntregada || 0);
          if (pendiente > 0) {
            await guardarStock(producto, stock, {
              cantidadReservada: Math.max(0, Number(stock.cantidadReservada) - pendiente),
            }, t);
          }
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

    // Dinero de los abonos que no se cobró en entregas: se devuelve al cliente o queda como saldo a favor
    const { abonos: destinoAbonos = 'devolver', metodoDevolucion } = req.body || {};
    const detallesAnulacion = await PedidoDetalle.findAll({ where: { pedidoid: id }, transaction: t });
    const pagosAnulacion = await PedidoPago.findAll({ where: { pedidoid: id }, transaction: t });
    const { disponibleAbonos } = resumenPedido({ estado: 'anulado', total: pedido.total, detalles: detallesAnulacion, pagos: pagosAnulacion });

    let devuelto = 0;
    let saldoAFavor = 0;
    if (disponibleAbonos > 0) {
      if (destinoAbonos === 'saldo_a_favor') {
        if (!pedido.clienteid) throw new ErrorPedido('Para dejar saldo a favor el pedido debe tener cliente');
        saldoAFavor = disponibleAbonos;
      } else {
        await registrarMovimiento({
          pedido, detalles: detallesAnulacion, tipo: 'devolucion', monto: disponibleAbonos, metodo: metodoDevolucion,
          nota: 'Devolución por anulación del pedido', usuarioid: req.usuario.usuarioid, transaction: t,
        });
        devuelto = disponibleAbonos;
      }
    }

    await t.commit();
    res.json({ ...(await cargarPedido(id, negocioid)), devuelto, saldoAFavor });
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al anular el pedido');
  }
};

// Entrega total o parcial: crea una venta con las líneas entregadas, descuenta stock y cobra con los abonos disponibles.
// body: { items?: [{ detalleid, cantidad }], pagos?: [{ metodo, monto }] }. Sin items se entrega todo lo pendiente.
const entregarPedido = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { negocioid, usuarioid } = req.usuario;
    const { items, pagos } = req.body || {};

    const pedido = await Pedido.findOne({
      where: { pedidoid: id, negocioid },
      transaction: t,
      lock: true,
    });
    if (!pedido) throw new ErrorPedido('Pedido no encontrado', 404);
    if (pedido.estado === 'entregado') throw new ErrorPedido('El pedido ya fue entregado por completo');
    if (pedido.estado === 'anulado') throw new ErrorPedido('El pedido está anulado');
    if (!['confirmado', 'en_compra', 'recibido'].includes(pedido.estado)) {
      throw new ErrorPedido('Confirma el pedido antes de entregarlo');
    }

    const detalles = await PedidoDetalle.findAll({ where: { pedidoid: id }, order: [['detalleid', 'ASC']], transaction: t, lock: true });
    if (detalles.length === 0) throw new ErrorPedido('El pedido no tiene productos');
    const pendienteDe = (d) => Math.round((Number(d.cantidad) - Number(d.cantidadEntregada || 0)) * 1000) / 1000;

    // Qué líneas (y cuánto de cada una) se entregan ahora
    let aEntregar;
    if (Array.isArray(items) && items.length > 0) {
      aEntregar = [];
      const vistos = new Set();
      for (const item of items) {
        const detalle = detalles.find((d) => Number(d.detalleid) === Number(item.detalleid));
        if (!detalle) throw new ErrorPedido('Una de las líneas a entregar no pertenece al pedido');
        if (vistos.has(detalle.detalleid)) throw new ErrorPedido('Hay una línea repetida en la entrega');
        vistos.add(detalle.detalleid);
        const cantidad = Number(item.cantidad);
        if (!Number.isFinite(cantidad) || cantidad <= 0) continue; // 0 = esa línea no se entrega ahora
        if (cantidad > pendienteDe(detalle) + 0.0001) {
          throw new ErrorPedido(`${etiquetaDetalle(detalle)}: solo quedan ${pendienteDe(detalle)} por entregar`);
        }
        aEntregar.push({ detalle, cantidad });
      }
    } else {
      aEntregar = detalles.filter((d) => pendienteDe(d) > 0).map((d) => ({ detalle: d, cantidad: pendienteDe(d) }));
    }
    if (aEntregar.length === 0) throw new ErrorPedido('No hay productos por entregar');

    const venta = await Venta.create({
      usuarioid,
      negocioid,
      clienteid: pedido.clienteid || null,
      descripcion: pedido.descripcion || `Pedido #${pedido.pedidoid}`,
      total: 0,
      descuentoTotal: 0,
      descuentoTipoTotal: 'fijo',
      pedidoid: pedido.pedidoid,
    }, { transaction: t });

    let total = 0;
    for (const { detalle, cantidad: solicitada } of aEntregar) {
      if (!detalle.productoid) throw new ErrorPedido(`Producto no encontrado: ${detalle.productoNombre}`);
      const producto = await Producto.findOne({
        where: { productoid: detalle.productoid, negocioid },
        transaction: t,
        lock: true,
      });
      if (!producto) throw new ErrorPedido(`Producto no encontrado: ${detalle.productoNombre}`);

      const cantidad = validarCantidad(solicitada, producto);
      const stock = await resolverStockDeDetalle(producto, detalle, t);
      if (Number(stock.cantidadDisponible) < cantidad) {
        throw new ErrorPedido(`Stock insuficiente para ${etiquetaDetalle(detalle)}. Recibe la compra antes de entregar.`);
      }

      const subtotal = dos(cantidad * Number(detalle.precioUnitario));
      const tasaIva = Number(producto.tasaIva || 0);
      const montoIva = tasaIva > 0 ? subtotal * tasaIva / (100 + tasaIva) : 0;

      await VentaDetalle.create({
        ventaid: venta.ventaid,
        productoNombre: detalle.productoNombre,
        cantidad,
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
        cantidadDisponible: Number(stock.cantidadDisponible) - cantidad,
        cantidadReservada: Math.max(0, Number(stock.cantidadReservada) - cantidad),
      }, t);

      await detalle.update({
        cantidadEntregada: Math.round((Number(detalle.cantidadEntregada || 0) + cantidad) * 1000) / 1000,
      }, { transaction: t });

      total += subtotal;
    }
    total = dos(total);
    await venta.update({ total }, { transaction: t });

    // Pagos recibidos en el momento de la entrega: entran como abonos y se aplican junto con los anteriores
    if (Array.isArray(pagos)) {
      for (const pago of pagos) {
        if (Number(pago.monto) > 0) {
          await registrarMovimiento({
            pedido, detalles, tipo: 'abono', monto: pago.monto, metodo: pago.metodo,
            nota: 'Pago en la entrega', usuarioid, transaction: t,
          });
        }
      }
    }
    await aplicarAbonosAVenta({ pedidoid: pedido.pedidoid, venta, totalVenta: total, transaction: t });

    const completo = detalles.every((d) => pendienteDe(d) <= 0);
    await pedido.update({
      estado: completo ? 'entregado' : pedido.estado,
      ventaid: pedido.ventaid || venta.ventaid,
    }, { transaction: t });
    await t.commit();

    res.json({
      mensaje: completo ? 'Pedido entregado por completo' : 'Entrega parcial registrada',
      ventaid: venta.ventaid,
      pedido: await cargarPedido(id, negocioid),
    });
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al entregar el pedido');
  }
};

// Abonos y devoluciones manuales. body: { tipo: 'abono' | 'devolucion', monto, metodo, nota }
const registrarPago = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { negocioid, usuarioid } = req.usuario;
    const { tipo = 'abono', monto, metodo, nota } = req.body || {};
    if (!['abono', 'devolucion'].includes(tipo)) throw new ErrorPedido('El tipo de movimiento no es válido');

    const pedido = await Pedido.findOne({ where: { pedidoid: id, negocioid }, transaction: t, lock: true });
    if (!pedido) throw new ErrorPedido('Pedido no encontrado', 404);
    const detalles = await PedidoDetalle.findAll({ where: { pedidoid: id }, transaction: t });

    await registrarMovimiento({ pedido, detalles, tipo, monto, metodo, nota, usuarioid, transaction: t });
    await t.commit();
    res.status(201).json(await cargarPedido(id, negocioid));
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al registrar el movimiento');
  }
};

// Saldo a favor del cliente (dinero de abonos de pedidos anulados que se dejó como crédito)
const getSaldoFavor = async (req, res) => {
  try {
    const { negocioid } = req.usuario;
    res.json(await saldoAFavorDeCliente({ clienteid: req.params.clienteid, negocioid }));
  } catch {
    res.status(500).json({ mensaje: 'Error al consultar el saldo a favor' });
  }
};

// Usa el saldo a favor del cliente como abono de este pedido. body: { monto? } (sin monto usa lo que alcance)
const usarSaldo = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { negocioid, usuarioid } = req.usuario;

    const pedido = await Pedido.findOne({ where: { pedidoid: id, negocioid }, transaction: t, lock: true });
    if (!pedido) throw new ErrorPedido('Pedido no encontrado', 404);
    const detalles = await PedidoDetalle.findAll({ where: { pedidoid: id }, transaction: t });

    await usarSaldoAFavor({ pedido, detalles, monto: req.body?.monto, usuarioid, transaction: t });
    await t.commit();
    res.status(201).json(await cargarPedido(id, negocioid));
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al usar el saldo a favor');
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

      const pendienteEntrega = Number(detalle.cantidad) - Number(detalle.cantidadEntregada || 0);
      if (pendienteEntrega <= 0) continue;
      const stock = await resolverStockDeDetalle(producto, detalle, t);
      const key = claveDetalle(detalle);
      const yaPedido = pendientesPorProducto.get(key) || 0;
      const reservadoOtros = Math.max(
        0,
        Number(stock.cantidadReservada) - pendienteEntrega
      );
      const disponibleParaPedido = Math.max(
        0,
        Number(stock.cantidadDisponible) - reservadoOtros
      );
      const faltante = Math.max(
        0,
        pendienteEntrega - disponibleParaPedido - yaPedido
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

    const movimientos = await PedidoPago.count({ where: { pedidoid: id }, transaction: t });
    if (movimientos > 0) {
      throw new ErrorPedido('El pedido tiene abonos registrados; anúlalo para devolver el dinero en lugar de eliminarlo');
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
  convertirAVenta: entregarPedido,
  entregarPedido,
  registrarPago,
  getSaldoFavor,
  usarSaldo,
  generarOrdenCompra,
  deletePedido,
};
