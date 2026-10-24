// Precios por cantidad de los proveedores: desde X unidades de un producto, TODAS las unidades salen al precio del escalón.
// La cantidad cuenta por producto (suma de tallas, compras de clientes y productos para stock del mismo pedido).
// Solo cambia lo que se le paga al proveedor; lo que se le cobra a los clientes no se toca.

const ProveedorPrecioEscalonado = require('../models/proveedorPrecioEscalonadoModel');
const { dos } = require('./pedidoPagoService');

// Mapa productoid -> escalones [{ desde, precio }] ordenados de menor a mayor cantidad
const cargarEscalones = async ({ proveedorid, negocioid, productoids, transaction }) => {
  const mapa = new Map();
  const ids = [...new Set((productoids || []).map(Number).filter(Boolean))];
  if (!proveedorid || ids.length === 0) return mapa;
  const filas = await ProveedorPrecioEscalonado.findAll({
    where: { proveedorid, negocioid, productoid: ids },
    order: [['desdeCantidad', 'ASC']],
    transaction,
  });
  for (const fila of filas) {
    if (!mapa.has(fila.productoid)) mapa.set(fila.productoid, []);
    mapa.get(fila.productoid).push({ desde: Number(fila.desdeCantidad), precio: Number(fila.precio) });
  }
  return mapa;
};

// Escalón que corresponde a la cantidad (el de mayor "desde" que la cantidad alcanza), o null si no llega al primero
const escalonAplicable = (escalones, cantidad) => {
  let elegido = null;
  for (const e of escalones || []) if (cantidad >= e.desde) elegido = e;
  return elegido;
};

const siguienteEscalon = (escalones, cantidad) => (escalones || []).find((e) => e.desde > cantidad) || null;

const sumarPorProducto = (...listas) => {
  const total = new Map();
  for (const lista of listas) {
    for (const { productoid, cantidad } of lista) {
      if (!productoid) continue;
      total.set(Number(productoid), (total.get(Number(productoid)) || 0) + Number(cantidad));
    }
  }
  return total;
};

// Pedido abierto: ajusta (solo en la respuesta) el precio de las líneas para stock y calcula el costo estimado con escalones.
// `grupos` = lo que se pediría por las compras de clientes (calcularFaltantes). Devuelve costos y avisos por producto.
const estimarConEscalones = async ({ proveedorid, negocioid, detalles, grupos }) => {
  const cantidades = sumarPorProducto(
    detalles.map((d) => ({ productoid: d.productoid, cantidad: d.cantidad })),
    grupos.map((g) => ({ productoid: g.productoid, cantidad: g.totalFaltante })),
  );
  const escalones = await cargarEscalones({ proveedorid, negocioid, productoids: [...cantidades.keys()] });

  let costoStock = 0;
  for (const detalle of detalles) {
    const escalon = escalonAplicable(escalones.get(Number(detalle.productoid)), cantidades.get(Number(detalle.productoid)));
    if (escalon) detalle.precioUnitario = escalon.precio;
    detalle.subtotal = dos(Number(detalle.cantidad) * Number(detalle.precioUnitario));
    costoStock += detalle.subtotal;
  }

  let costoClientes = 0;
  for (const grupo of grupos) {
    const escalon = escalonAplicable(escalones.get(Number(grupo.productoid)), cantidades.get(Number(grupo.productoid)));
    costoClientes += escalon ? dos(grupo.totalFaltante * escalon.precio) : Number(grupo.costo);
  }

  const nombres = new Map([...detalles, ...grupos].map((x) => [Number(x.productoid), x.productoNombre]));
  const avisos = [];
  for (const [productoid, lista] of escalones) {
    const cantidad = cantidades.get(productoid);
    const actual = escalonAplicable(lista, cantidad);
    const siguiente = siguienteEscalon(lista, cantidad);
    avisos.push({
      productoid,
      productoNombre: nombres.get(productoid),
      cantidad,
      precio: actual ? actual.precio : null,
      siguiente: siguiente ? { desde: siguiente.desde, precio: siguiente.precio, faltan: Math.round((siguiente.desde - cantidad) * 1000) / 1000 } : null,
    });
  }
  return { costoStock: dos(costoStock), costoClientes: dos(costoClientes), avisos };
};

// Al enviar el pedido: fija en cada línea el precio del escalón que alcanza el total del producto
const aplicarEscalonesAlEnviar = async ({ orden, detalles, transaction }) => {
  const cantidades = sumarPorProducto(detalles.map((d) => ({ productoid: d.productoid, cantidad: d.cantidad })));
  const escalones = await cargarEscalones({ proveedorid: orden.proveedorid, negocioid: orden.negocioid, productoids: [...cantidades.keys()], transaction });
  for (const detalle of detalles) {
    const escalon = escalonAplicable(escalones.get(Number(detalle.productoid)), cantidades.get(Number(detalle.productoid)));
    if (escalon) await detalle.update({ precioUnitario: escalon.precio }, { transaction });
  }
};

module.exports = { cargarEscalones, escalonAplicable, siguienteEscalon, estimarConEscalones, aplicarEscalonesAlEnviar };
