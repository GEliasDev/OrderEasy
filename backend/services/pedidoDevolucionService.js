// Devolución de mercancía que el cliente ya recibió.
//
// - La línea del pedido baja (cantidad y cantidadEntregada) y el total del pedido baja con ella.
// - Si el producto está en buen estado vuelve al inventario; si llegó dañado solo se registra.
// - La venta generada al entregar se corrige (líneas y total). Si el cliente ya había pagado más de lo que
//   queda de la venta, ese dinero se libera de la venta y vuelve a ser abono disponible del pedido:
//   se puede reembolsar (devolución de dinero) o dejarlo a favor del cliente para un cambio.

const PedidoDevolucion = require('../models/pedidoDevolucionModel');
const PedidoPago = require('../models/pedidoPagoModel');
const Producto = require('../models/productModel');
const Venta = require('../models/ventaModel');
const VentaDetalle = require('../models/ventaDetalleModel');
const VentaPago = require('../models/ventaPagoModel');
const { dos, resumenPedido, registrarMovimiento } = require('./pedidoPagoService');
const { validarCantidad, resolverStockDeDetalle, guardarStock, etiquetaDetalle } = require('./stockService');
const { redondear } = require('../utils/unidades');

class ErrorDevolucion extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

const MOTIVOS = ['color', 'talla', 'modelo', 'danado', 'no_gusto', 'otro'];

// Saca de las ventas del pedido (más recientes primero) las unidades devueltas de una línea
const ajustarVentas = async ({ pedido, detalle, cantidad, transaction }) => {
  const ventas = await Venta.findAll({
    where: { pedidoid: pedido.pedidoid, negocioid: pedido.negocioid },
    order: [['ventaid', 'DESC']],
    transaction,
    lock: true,
  });

  let restante = cantidad;
  for (const venta of ventas) {
    if (restante <= 0) break;
    const lineas = await VentaDetalle.findAll({ where: { ventaid: venta.ventaid }, transaction });
    const coincide = (l) => l.productoNombre === detalle.productoNombre
      && (l.varianteid || null) === (detalle.varianteid || null);

    let tocada = false;
    for (const linea of lineas.filter(coincide)) {
      if (restante <= 0) break;
      const tomar = Math.min(restante, Number(linea.cantidad));
      const nueva = redondear(Number(linea.cantidad) - tomar);
      if (nueva <= 0) {
        await linea.destroy({ transaction });
      } else {
        const subtotal = dos(nueva * Number(linea.precioUnitario));
        const tasa = Number(linea.tasaIva || 0);
        await linea.update({
          cantidad: nueva,
          subtotal,
          montoIva: tasa > 0 ? dos(subtotal * tasa / (100 + tasa)) : 0,
        }, { transaction });
      }
      restante = redondear(restante - tomar);
      tocada = true;
    }
    if (!tocada) continue;

    const quedan = await VentaDetalle.findAll({ where: { ventaid: venta.ventaid }, transaction });
    if (quedan.length === 0) {
      await liberarPagos({ pedido, venta, exceso: Infinity, transaction });
      if (Number(pedido.ventaid) === Number(venta.ventaid)) await pedido.update({ ventaid: null }, { transaction });
      await venta.destroy({ transaction });
      continue;
    }

    const nuevoTotal = dos(quedan.reduce((s, l) => s + Number(l.subtotal), 0));
    await venta.update({ total: nuevoTotal }, { transaction });
    const pagos = await VentaPago.findAll({ where: { ventaid: venta.ventaid }, transaction });
    const pagado = dos(pagos.reduce((s, p) => s + Number(p.monto), 0));
    if (pagado > nuevoTotal) await liberarPagos({ pedido, venta, exceso: dos(pagado - nuevoTotal), transaction });
  }
};

// Quita `exceso` de los pagos de la venta (los más recientes primero) y lo devuelve a los abonos del pedido
const liberarPagos = async ({ pedido, venta, exceso, transaction }) => {
  const pagos = await VentaPago.findAll({ where: { ventaid: venta.ventaid }, order: [['pagoid', 'DESC']], transaction });
  const abonos = await PedidoPago.findAll({
    where: { pedidoid: pedido.pedidoid, tipo: 'abono' },
    order: [['pagoid', 'DESC']],
    transaction,
    lock: true,
  });

  let porLiberar = exceso;
  for (const pago of pagos) {
    if (porLiberar <= 0) break;
    const tomar = dos(Math.min(porLiberar, Number(pago.monto)));
    if (tomar >= Number(pago.monto)) await pago.destroy({ transaction });
    else await pago.update({ monto: dos(Number(pago.monto) - tomar) }, { transaction });

    // Primero los abonos del mismo método con que se cobró; si no alcanzan, cualquiera
    let faltante = tomar;
    const candidatos = [...abonos.filter((a) => a.metodo === pago.metodo), ...abonos.filter((a) => a.metodo !== pago.metodo)];
    for (const abono of candidatos) {
      if (faltante <= 0) break;
      const aplicado = Number(abono.montoAplicado);
      if (aplicado <= 0) continue;
      const devolver = dos(Math.min(aplicado, faltante));
      await abono.update({ montoAplicado: dos(aplicado - devolver) }, { transaction });
      faltante = dos(faltante - devolver);
    }
    porLiberar = dos(porLiberar - tomar);
  }
};

// items: [{ detalleid, cantidad }]. Devuelve { valorDevuelto, reembolsado }.
const devolverMercancia = async ({ pedido, detalles, items, motivo, nota, reingresarStock = true, reembolsar = false, metodoReembolso, usuarioid, transaction }) => {
  if (!MOTIVOS.includes(motivo)) throw new ErrorDevolucion('Indica el motivo de la devolución');
  if (pedido.estado === 'anulado') throw new ErrorDevolucion('El pedido está anulado');
  if (!Array.isArray(items) || items.length === 0) throw new ErrorDevolucion('Indica qué productos se devuelven');

  const notaLimpia = nota ? String(nota).trim().slice(0, 255) : null;
  const disponibleAntes = resumenPedido({
    estado: pedido.estado, total: pedido.total, detalles,
    pagos: await PedidoPago.findAll({ where: { pedidoid: pedido.pedidoid }, transaction }),
  }).disponibleAbonos;
  let valorDevuelto = 0;
  const vistos = new Set();

  for (const item of items) {
    const detalle = detalles.find((d) => Number(d.detalleid) === Number(item.detalleid));
    if (!detalle) throw new ErrorDevolucion('Una de las líneas no pertenece al pedido');
    if (vistos.has(detalle.detalleid)) throw new ErrorDevolucion('Hay una línea repetida en la devolución');
    vistos.add(detalle.detalleid);

    const solicitada = Number(item.cantidad);
    if (!Number.isFinite(solicitada) || solicitada <= 0) continue;
    const entregada = Number(detalle.cantidadEntregada || 0);
    if (solicitada > entregada + 0.0001) {
      throw new ErrorDevolucion(`${etiquetaDetalle(detalle)}: solo se han entregado ${entregada}, no se pueden devolver ${solicitada}`);
    }

    const producto = detalle.productoid
      ? await Producto.findOne({ where: { productoid: detalle.productoid, negocioid: pedido.negocioid }, transaction, lock: true })
      : null;
    const cantidad = producto ? validarCantidad(solicitada, producto) : redondear(solicitada);
    const precio = Number(detalle.precioUnitario);

    await detalle.update({
      cantidad: redondear(Number(detalle.cantidad) - cantidad),
      cantidadEntregada: redondear(entregada - cantidad),
      subtotal: dos(redondear(Number(detalle.cantidad) - cantidad) * precio),
    }, { transaction });

    if (reingresarStock && producto) {
      const stock = await resolverStockDeDetalle(producto, detalle, transaction);
      await guardarStock(producto, stock, { cantidadDisponible: Number(stock.cantidadDisponible) + cantidad }, transaction);
    }

    await ajustarVentas({ pedido, detalle, cantidad, transaction });

    await PedidoDevolucion.create({
      pedidoid: pedido.pedidoid,
      detalleid: detalle.detalleid,
      negocioid: pedido.negocioid,
      usuarioid,
      productoNombre: detalle.productoNombre,
      talla: detalle.talla,
      cantidad,
      precioUnitario: precio,
      motivo,
      nota: notaLimpia,
      reingresaStock: Boolean(reingresarStock),
    }, { transaction });

    valorDevuelto = dos(valorDevuelto + cantidad * precio);
  }

  if (valorDevuelto <= 0) throw new ErrorDevolucion('Indica la cantidad de al menos un producto a devolver');
  await pedido.update({ total: dos(Math.max(0, Number(pedido.total) - valorDevuelto)) }, { transaction });

  // Reembolso del dinero en el mismo paso: solo lo que esta devolución liberó de la venta, no los anticipos previos
  let reembolsado = 0;
  if (reembolsar) {
    const pagos = await PedidoPago.findAll({ where: { pedidoid: pedido.pedidoid }, transaction });
    const { disponibleAbonos } = resumenPedido({ estado: pedido.estado, total: pedido.total, detalles, pagos });
    const monto = dos(Math.min(valorDevuelto, Math.max(0, disponibleAbonos - disponibleAntes)));
    if (monto > 0) {
      await registrarMovimiento({
        pedido, detalles, tipo: 'devolucion', monto, metodo: metodoReembolso,
        nota: 'Devolución de producto', usuarioid, transaction,
      });
      reembolsado = monto;
    }
  }

  return { valorDevuelto, reembolsado };
};

module.exports = { ErrorDevolucion, MOTIVOS, devolverMercancia };
