// Operaciones de stock compartidas por ventas, pedidos, compras, egresos y el asistente.
//
// Un producto maneja su stock de dos maneras:
//  - sin tallas (usaTallas = false): el stock está en el propio producto.
//  - con tallas (usaTallas = true): el stock vive en producto_variantes (una fila por talla) y
//    productos.cantidadDisponible/cantidadReservada guardan el total, para que listados,
//    estadísticas y reportes sigan funcionando sin conocer las variantes.
//
// `resolverStock` devuelve "el objeto que tiene el stock" (producto o variante); ambos exponen
// cantidadDisponible/cantidadReservada y se actualizan con `guardarStock`.

const Variante = require('../models/varianteModel');
const { admiteDecimales, redondear } = require('../utils/unidades');

class ErrorStock extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

const nombreStock = (producto, stock) =>
  stock && stock !== producto ? `${producto.nombre} (talla ${stock.talla})` : producto.nombre;

// Valida y normaliza una cantidad según la unidad del producto (enteros salvo kg, g, m, l)
const validarCantidad = (cantidad, producto) => {
  const n = Number(cantidad);
  if (!Number.isFinite(n) || n <= 0) {
    throw new ErrorStock(`La cantidad de ${producto.nombre} debe ser mayor a 0`);
  }
  if (!admiteDecimales(producto.unidadMedida) && !Number.isInteger(n)) {
    throw new ErrorStock(`La cantidad de ${producto.nombre} debe ser un número entero (se mide en ${producto.unidadMedida || 'und'})`);
  }
  return redondear(n);
};

// Devuelve el registro que tiene el stock para esta línea. `talla` solo aplica a productos con tallas.
const resolverStock = async (producto, talla, transaction) => {
  if (!producto.usaTallas) return producto;

  if (talla === undefined || talla === null || String(talla).trim() === '') {
    throw new ErrorStock(`Debe indicar la talla de ${producto.nombre}`);
  }
  const variante = await Variante.findOne({
    where: { productoid: producto.productoid, talla: String(talla).trim() },
    transaction,
    lock: transaction ? true : undefined,
  });
  if (!variante) {
    throw new ErrorStock(`La talla ${talla} no existe para ${producto.nombre}`);
  }
  return variante;
};

// Igual que resolverStock pero para líneas ya guardadas (confirmar, anular, entregar, revertir):
// usa la talla/variante registrada en el detalle. Si el detalle es anterior a las tallas, usa el producto.
const resolverStockDeDetalle = async (producto, detalle, transaction) => {
  if (!producto.usaTallas || (!detalle.varianteid && !detalle.talla)) return producto;

  const where = detalle.varianteid
    ? { varianteid: detalle.varianteid }
    : { productoid: producto.productoid, talla: detalle.talla };
  const variante = await Variante.findOne({ where, transaction, lock: transaction ? true : undefined });
  return variante || producto;
};

const sincronizarTotales = async (producto, transaction) => {
  const variantes = await Variante.findAll({ where: { productoid: producto.productoid }, transaction });
  await producto.update({
    cantidadDisponible: redondear(variantes.reduce((acc, v) => acc + Number(v.cantidadDisponible), 0)),
    cantidadReservada: redondear(variantes.reduce((acc, v) => acc + Number(v.cantidadReservada), 0)),
  }, { transaction });
};

// Aplica cambios ({ cantidadDisponible, cantidadReservada }) al stock y mantiene los totales del producto
const guardarStock = async (producto, stock, cambios, transaction) => {
  const normalizados = {};
  for (const [campo, valor] of Object.entries(cambios)) normalizados[campo] = redondear(valor);

  await stock.update(normalizados, { transaction });
  if (stock !== producto) await sincronizarTotales(producto, transaction);
};

const disponibleReal = (stock) =>
  Number(stock.cantidadDisponible) - Number(stock.cantidadReservada || 0);

// Datos de talla para guardar en el detalle de una venta, pedido, compra o egreso
const datosTalla = (producto, stock) =>
  stock !== producto ? { talla: stock.talla, varianteid: stock.varianteid } : { talla: null, varianteid: null };

// Texto "Producto (talla 38)" para mensajes y listados
const etiquetaDetalle = (detalle) =>
  detalle.talla ? `${detalle.productoNombre} (talla ${detalle.talla})` : detalle.productoNombre;

module.exports = {
  ErrorStock,
  nombreStock,
  validarCantidad,
  resolverStock,
  resolverStockDeDetalle,
  sincronizarTotales,
  guardarStock,
  disponibleReal,
  datosTalla,
  etiquetaDetalle,
};
