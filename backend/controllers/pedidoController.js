const Pedido = require('../models/pedidoModel');
const PedidoDetalle = require('../models/pedidoDetalleModel');
const OrdenCompra = require('../models/ordenCompraModel');
const OrdenCompraDetalle = require('../models/ordenCompraDetalleModel');
const Producto = require('../models/productModel');
const Variante = require('../models/varianteModel');
const Asignacion = require('../models/ordenCompraAsignacionModel');
const Venta = require('../models/ventaModel');
const PedidoPago = require('../models/pedidoPagoModel');
const PedidoDevolucion = require('../models/pedidoDevolucionModel');
const { devolverMercancia } = require('../services/pedidoDevolucionService');
const { crearOrdenDesdePedidos, resumenComprasPorDetalle } = require('../services/compraLoteService');
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
        attributes: ['productoid', 'nombre', 'cantidadDisponible', 'cantidadReservada', 'unidadMedida', 'usaTallas', 'imagenes'],
        include: [{ model: Variante, as: 'variantes' }],
      },
    ],
  },
  { model: Cliente, as: 'cliente', attributes: ['clienteid', 'nombreCliente', 'telefono'] },
  { model: PedidoPago, as: 'pagos' },
  { model: PedidoDevolucion, as: 'devoluciones' },
  { model: Venta, as: 'ventas', attributes: ['ventaid', 'total', 'createdAt'] },
  {
    model: OrdenCompra,
    as: 'ordenes',
    include: [
      { model: OrdenCompraDetalle, as: 'detalles' },
      { model: Proveedor, as: 'proveedor', attributes: ['proveedorid', 'nombreProveedor', 'razonSocial'] },
    ],
  },
  // Pedido al proveedor que contiene esta compra (pedido.ordenid), para saber si aún se puede editar
  { model: OrdenCompra, as: 'pedidoProveedor', attributes: ['ordenid', 'estado', 'nombre'] },
];

// Pedido en JSON con el resumen de dinero (abonado, saldo, entregado...) y los movimientos en orden
const conResumen = (pedido) => {
  const json = pedido.toJSON();
  json.pagos = (json.pagos || []).sort((a, b) => a.pagoid - b.pagoid);
  json.devoluciones = (json.devoluciones || []).sort((a, b) => a.devolucionid - b.devolucionid);
  json.ventas = (json.ventas || []).sort((a, b) => a.ventaid - b.ventaid);
  json.resumen = resumenPedido(json);
  return json;
};

// Por línea: cuánto viene en compras activas ('enCompra') y cuánto ya llegó para ella ('recibidoCompra')
const adjuntarCompras = async (jsons) => {
  const ids = jsons.flatMap((j) => (j.detalles || []).map((d) => d.detalleid));
  const mapa = await resumenComprasPorDetalle(ids);
  for (const json of jsons) {
    for (const detalle of json.detalles || []) {
      const compra = mapa.get(detalle.detalleid);
      detalle.enCompra = compra?.enCompra || 0;
      detalle.recibidoCompra = compra?.recibido || 0;
    }
  }
};

const cargarPedido = async (id, negocioid) => {
  const pedido = await Pedido.findOne({
    where: { pedidoid: id, negocioid },
    include: includePedido,
  });
  if (!pedido) throw new ErrorPedido('Pedido no encontrado', 404);
  const json = conResumen(pedido);
  await adjuntarCompras([json]);
  return json;
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
    const { clienteid, descripcion, fechaEntrega, items, abono, ordenid } = req.body;
    const { usuarioid, negocioid } = req.usuario;

    if (ordenid) {
      const orden = await OrdenCompra.findOne({ where: { ordenid, negocioid }, transaction: t });
      if (!orden) throw new ErrorPedido('Pedido al proveedor no encontrado', 404);
      if (orden.estado !== 'abierta') throw new ErrorPedido('Ese pedido ya fue enviado al proveedor; crea otro pedido para agregar más compras');
    }

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
      ordenid: ordenid || null,
      estado: ordenid ? 'confirmado' : 'pendiente',
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
        precioCompra: producto.precioCompra,
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
    const jsons = pedidos.map(conResumen);
    await adjuntarCompras(jsons);
    res.json(jsons);
  } catch {
    res.status(500).json({ mensaje: 'Error al obtener los pedidos' });
  }
};

// Lo que los clientes le deben al negocio: suma del saldo de TODAS sus compras, esté el pedido al proveedor
// abierto, enviado, recibido o anulado (y también las compras sin pedido). Una compra anulada solo deja saldo
// por lo ya entregado y no pagado.
const getSaldoPorCobrar = async (req, res) => {
  try {
    const { negocioid } = req.usuario;
    const compras = await Pedido.findAll({
      where: { negocioid },
      attributes: ['pedidoid', 'clienteid', 'estado', 'total'],
      include: [
        { model: PedidoDetalle, as: 'detalles', attributes: ['detalleid', 'cantidadEntregada', 'precioUnitario'] },
        { model: PedidoPago, as: 'pagos' },
      ],
    });
    let total = 0;
    let abonado = 0;
    const clientes = new Set();
    const porCliente = {};
    let conSaldo = 0;
    for (const compra of compras) {
      const resumen = resumenPedido(compra.toJSON());
      abonado += resumen.abonado;
      if (resumen.saldo > 0) {
        total += resumen.saldo;
        conSaldo += 1;
        if (compra.clienteid) {
          clientes.add(compra.clienteid);
          porCliente[compra.clienteid] = dos((porCliente[compra.clienteid] || 0) + resumen.saldo);
        }
      }
    }
    res.json({ total: dos(total), abonado: dos(abonado), compras: conSaldo, clientes: clientes.size, porCliente });
  } catch {
    res.status(500).json({ mensaje: 'Error al calcular el saldo por cobrar' });
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
    let reservarStock = false;
    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) {
        throw new ErrorPedido('Debe incluir al menos un producto');
      }

      const ordenContenedora = pedido.ordenid
        ? await OrdenCompra.findOne({ where: { ordenid: pedido.ordenid, negocioid }, transaction: t })
        : null;
      const ordenesVinculadas = await OrdenCompra.findAll({
        where: { pedidoid: id, negocioid },
        attributes: ['ordenid', 'estado'],
        transaction: t,
      });
      const ordenVinculadaVigente = ordenesVinculadas.find((orden) => orden.estado !== 'anulada');
      const enPedidoAbierto = ordenContenedora?.estado === 'abierta';
      const compraSueltaEditable = !pedido.ordenid && !ordenVinculadaVigente
        && ['pendiente', 'confirmado'].includes(pedido.estado);

      if (!enPedidoAbierto && !compraSueltaEditable) {
        if (ordenContenedora && ordenContenedora.estado !== 'abierta') {
          throw new ErrorPedido('El pedido ya fue enviado al proveedor; no se pueden modificar los productos de la compra');
        }
        if (ordenVinculadaVigente) {
          throw new ErrorPedido('La compra tiene una orden de compra activa; no se pueden modificar los productos');
        }
        throw new ErrorPedido('Solo se pueden modificar los productos de una compra pendiente o de un pedido aún no enviado');
      }

      const detallesActuales = await PedidoDetalle.findAll({
        where: { pedidoid: id },
        transaction: t,
        lock: true,
      });
      if (detallesActuales.some((detalle) => Number(detalle.cantidadEntregada || 0) > 0)) {
        throw new ErrorPedido('La compra ya tiene entregas registradas; no se pueden modificar los productos');
      }
      const asignaciones = await Asignacion.count({
        include: [{ model: PedidoDetalle, as: 'pedidoDetalle', where: { pedidoid: id }, attributes: [] }],
        transaction: t,
      });
      if (asignaciones > 0) {
        throw new ErrorPedido('La compra ya está en una orden enviada al proveedor; no se pueden modificar los productos');
      }

      // Una compra suelta confirmada tiene stock reservado: se libera y se vuelve a reservar con las nuevas cantidades.
      // Las compras dentro de un pedido al proveedor no usan inventario, así que no tocan el stock.
      reservarStock = !enPedidoAbierto && !pedido.ordenid && pedido.estado === 'confirmado';

      if (reservarStock) {
        for (const detalle of detallesActuales) {
          if (!detalle.productoid) continue;
          const producto = await Producto.findOne({
            where: { productoid: detalle.productoid, negocioid },
            transaction: t,
            lock: true,
          });
          if (!producto) continue;
          const stock = await resolverStockDeDetalle(producto, detalle, t);
          const pendiente = Math.max(0, Number(detalle.cantidad) - Number(detalle.cantidadEntregada || 0));
          if (pendiente > 0) {
            await guardarStock(producto, stock, {
              cantidadReservada: Math.max(0, Number(stock.cantidadReservada) - pendiente),
            }, t);
          }
        }
      }

      const preciosActuales = new Map(
        detallesActuales
          .filter((detalle) => detalle.productoid)
          .map((detalle) => [Number(detalle.productoid), Number(detalle.precioUnitario)])
      );

      const costosActuales = new Map(
        detallesActuales
          .filter((detalle) => detalle.productoid && detalle.precioCompra !== null && detalle.precioCompra !== undefined)
          .map((detalle) => [Number(detalle.productoid), Number(detalle.precioCompra)])
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
      const nuevosDetalles = [];
      for (const { producto, stock, cantidad } of itemsPorProducto.values()) {
        const precioUnitario = preciosActuales.get(Number(producto.productoid))
          ?? Number(producto.precioVenta);
        const subtotal = cantidad * precioUnitario;
        total += subtotal;

        const detalle = await PedidoDetalle.create({
          pedidoid: pedido.pedidoid,
          productoid: producto.productoid,
          productoNombre: producto.nombre,
          cantidad,
          precioUnitario,
          precioCompra: costosActuales.get(Number(producto.productoid)) ?? Number(producto.precioCompra),
          subtotal,
          categoriaid: producto.categoriaid,
          ...datosTalla(producto, stock),
        }, { transaction: t });
        nuevosDetalles.push(detalle);
      }

      if (reservarStock) {
        for (const detalle of nuevosDetalles) {
          if (!detalle.productoid) continue;
          const producto = await Producto.findOne({
            where: { productoid: detalle.productoid, negocioid },
            transaction: t,
            lock: true,
          });
          if (!producto) continue;
          const stock = await resolverStockDeDetalle(producto, detalle, t);
          await guardarStock(producto, stock, {
            cantidadReservada: Number(stock.cantidadReservada) + Number(detalle.cantidad),
          }, t);
        }
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
    if (pedido.ordenid) {
      throw new ErrorPedido('Las compras de un pedido al proveedor no se confirman: no usan tu inventario');
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
          let pendiente = Number(detalle.cantidad) - Number(detalle.cantidadEntregada || 0);
          // En un pedido al proveedor solo está reservado lo que ya llegó y aún no se entregó
          if (pedido.ordenid) {
            const llegado = (await resumenComprasPorDetalle([detalle.detalleid], t)).get(detalle.detalleid)?.recibido || 0;
            pendiente = Math.max(0, llegado - Number(detalle.cantidadEntregada || 0));
          }
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
    // En un pedido al proveedor solo se entrega lo que ya llegó
    const llegado = pedido.ordenid ? await resumenComprasPorDetalle(detalles.map((d) => d.detalleid), t) : null;
    const entregable = (d) => (llegado
      ? Math.min(pendienteDe(d), Math.max(0, Math.round(((llegado.get(d.detalleid)?.recibido || 0) - Number(d.cantidadEntregada || 0)) * 1000) / 1000))
      : pendienteDe(d));

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
        if (cantidad > entregable(detalle) + 0.0001) {
          throw new ErrorPedido(`${etiquetaDetalle(detalle)}: ${llegado ? 'solo han llegado' : 'solo quedan'} ${entregable(detalle)} por entregar`);
        }
        aEntregar.push({ detalle, cantidad });
      }
    } else {
      aEntregar = detalles.filter((d) => entregable(d) > 0).map((d) => ({ detalle: d, cantidad: entregable(d) }));
    }
    if (aEntregar.length === 0) throw new ErrorPedido(llegado ? 'Todavía no ha llegado mercancía para entregar' : 'No hay productos por entregar');

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

// Devolución de mercancía ya entregada. body: { items: [{ detalleid, cantidad }], motivo, nota, reingresarStock, reembolsar, metodo }
const devolverProductos = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { negocioid, usuarioid } = req.usuario;
    const { items, motivo, nota, reingresarStock, reembolsar, metodo } = req.body || {};

    const pedido = await Pedido.findOne({ where: { pedidoid: id, negocioid }, transaction: t, lock: true });
    if (!pedido) throw new ErrorPedido('Pedido no encontrado', 404);
    const detalles = await PedidoDetalle.findAll({ where: { pedidoid: id }, order: [['detalleid', 'ASC']], transaction: t, lock: true });

    const resultado = await devolverMercancia({
      pedido, detalles, items, motivo, nota,
      reingresarStock: reingresarStock !== false,
      reembolsar: Boolean(reembolsar),
      metodoReembolso: metodo,
      usuarioid,
      transaction: t,
    });
    await t.commit();
    res.status(201).json({ ...resultado, pedido: await cargarPedido(id, negocioid) });
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al registrar la devolución');
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
    const { proveedorid, descripcion } = req.body || {};

    const pedido = await Pedido.findOne({
      where: { pedidoid: id, negocioid },
      transaction: t,
      lock: true,
    });
    if (!pedido) throw new ErrorPedido('Pedido no encontrado', 404);
    if (!['confirmado', 'en_compra', 'recibido'].includes(pedido.estado)) {
      throw new ErrorPedido('Confirma el pedido antes de generar la orden de compra');
    }

    // Mismo cálculo que la compra por lote (con un solo pedido): descuenta stock libre y compras en curso
    const orden = await crearOrdenDesdePedidos({
      pedidoids: [Number(id)],
      proveedorid,
      descripcion: descripcion || `Pedido #${id}`,
      negocioid,
      usuarioid,
      transaction: t,
    });
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

// Elimina una compra de cliente en cualquier estado. Se libera el stock que tenía reservado, se borran sus abonos y su reparto
// del pedido al proveedor. Las ventas de entregas ya hechas NO se borran (son ventas reales): solo se desvinculan de la compra.
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

    const detalles = await PedidoDetalle.findAll({ where: { pedidoid: id }, transaction: t });
    const detalleids = detalles.map((d) => d.detalleid);

    // Stock reservado para el cliente (igual que al anular): en un pedido al proveedor solo lo que ya llegó y no se entregó
    if (['confirmado', 'en_compra', 'recibido'].includes(pedido.estado)) {
      const llegado = pedido.ordenid ? await resumenComprasPorDetalle(detalleids, t) : null;
      for (const detalle of detalles) {
        if (!detalle.productoid) continue;
        let reservado = Number(detalle.cantidad) - Number(detalle.cantidadEntregada || 0);
        if (llegado) reservado = Math.max(0, (llegado.get(detalle.detalleid)?.recibido || 0) - Number(detalle.cantidadEntregada || 0));
        if (reservado <= 0) continue;
        const producto = await Producto.findOne({ where: { productoid: detalle.productoid, negocioid }, transaction: t, lock: true });
        if (!producto) continue;
        const stock = await resolverStockDeDetalle(producto, detalle, t);
        await guardarStock(producto, stock, { cantidadReservada: Math.max(0, Number(stock.cantidadReservada) - reservado) }, t);
      }
    }

    // Referencias que apuntan a la compra
    await OrdenCompra.update({ pedidoid: null }, { where: { pedidoid: id }, transaction: t });
    // Las ventas de las entregas se conservan y siguen marcadas como venta de pedido (solo cuenta lo cobrado de ellas)
    await pedido.update({ ventaid: null }, { transaction: t });
    if (detalleids.length) await Asignacion.destroy({ where: { pedidodetalleid: detalleids }, transaction: t });
    await PedidoPago.destroy({ where: { pedidoid: id }, transaction: t });
    await PedidoDetalle.destroy({ where: { pedidoid: id }, transaction: t });
    await pedido.destroy({ transaction: t });

    await t.commit();
    res.json({ mensaje: 'Compra eliminada' });
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al eliminar el pedido');
  }
};

module.exports = {
  createPedido,
  getPedidos,
  getSaldoPorCobrar,
  getPedidoById,
  updatePedido,
  confirmarPedido,
  anularPedido,
  convertirAVenta: entregarPedido,
  entregarPedido,
  registrarPago,
  devolverProductos,
  getSaldoFavor,
  usarSaldo,
  generarOrdenCompra,
  deletePedido,
};
