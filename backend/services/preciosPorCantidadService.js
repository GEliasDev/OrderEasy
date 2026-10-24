// Precios por cantidad de los proveedores: al pedir en total X unidades de las categorías que el proveedor suministra
// (cualquier producto y talla de esas categorías), TODAS esas unidades salen al precio fijo del escalón que se alcanza.
// La cantidad suma las compras de clientes y los productos para stock del mismo pedido. Un proveedor sin categorías no aplica
// escalones, y lo de otras categorías va a su precio normal. Solo cambia lo que se le paga al proveedor, no lo que se cobra a los clientes.

const ProveedorPrecioEscalonado = require('../models/proveedorPrecioEscalonadoModel');
const ProveedorCategoria = require('../models/proveedorCategoriaModel');
const { dos } = require('./pedidoPagoService');

// Escalones [{ desde, precio }] de menor a mayor cantidad y categorías vinculadas; sin categorías no hay escalones que aplicar
const cargarReglas = async ({ proveedorid, negocioid, transaction }) => {
  if (!proveedorid) return { escalones: [], categorias: new Set() };
  const [filas, vinculos] = await Promise.all([
    ProveedorPrecioEscalonado.findAll({ where: { proveedorid, negocioid }, order: [['desdeCantidad', 'ASC']], transaction }),
    ProveedorCategoria.findAll({ where: { proveedorid }, transaction }),
  ]);
  const categorias = new Set(vinculos.map((v) => Number(v.categoriaid)));
  const escalones = categorias.size ? filas.map((f) => ({ desde: Number(f.desdeCantidad), precio: Number(f.precio) })) : [];
  return { escalones, categorias };
};

// Escalón que corresponde a la cantidad (el de mayor "desde" que la cantidad alcanza), o null si no llega al primero
const escalonAplicable = (escalones, cantidad) => {
  let elegido = null;
  for (const e of escalones) if (cantidad >= e.desde) elegido = e;
  return elegido;
};

const siguienteEscalon = (escalones, cantidad) => escalones.find((e) => e.desde > cantidad) || null;

const sumar = (lista) => lista.reduce((s, x) => s + Number(x), 0);

// Pedido abierto: ajusta (solo en la respuesta) el precio de las líneas para stock y calcula el costo estimado con el escalón.
// `grupos` = lo que se pediría por las compras de clientes (calcularFaltantes). Devuelve costos y el aviso para la pantalla.
const estimarConEscalones = async ({ proveedorid, negocioid, detalles, grupos }) => {
  const { escalones, categorias } = await cargarReglas({ proveedorid, negocioid });
  const cuenta = (categoriaid) => categorias.has(Number(categoriaid));
  const cantidad = Math.round(sumar([
    ...detalles.filter((d) => cuenta(d.categoriaid)).map((d) => d.cantidad),
    ...grupos.filter((g) => cuenta(g.categoriaid)).map((g) => g.totalFaltante),
  ]) * 1000) / 1000;
  const escalon = escalonAplicable(escalones, cantidad);

  let costoStock = 0;
  for (const detalle of detalles) {
    if (escalon && cuenta(detalle.categoriaid)) detalle.precioUnitario = escalon.precio;
    detalle.subtotal = dos(Number(detalle.cantidad) * Number(detalle.precioUnitario));
    costoStock += detalle.subtotal;
  }
  const costoClientes = grupos.reduce((s, g) => s + (escalon && cuenta(g.categoriaid) ? dos(g.totalFaltante * escalon.precio) : Number(g.costo)), 0);

  const siguiente = siguienteEscalon(escalones, cantidad);
  const aviso = escalones.length === 0 ? null : {
    cantidad,
    precio: escalon ? escalon.precio : null,
    siguiente: siguiente ? { desde: siguiente.desde, precio: siguiente.precio, faltan: Math.round((siguiente.desde - cantidad) * 1000) / 1000 } : null,
  };
  return { costoStock: dos(costoStock), costoClientes: dos(costoClientes), aviso };
};

// Al enviar el pedido: fija en cada línea de las categorías del proveedor el precio del escalón que alcanza el total pedido
const aplicarEscalonesAlEnviar = async ({ orden, detalles, transaction }) => {
  const { escalones, categorias } = await cargarReglas({ proveedorid: orden.proveedorid, negocioid: orden.negocioid, transaction });
  const lineas = detalles.filter((d) => categorias.has(Number(d.categoriaid)));
  const escalon = escalonAplicable(escalones, sumar(lineas.map((d) => d.cantidad)));
  if (!escalon) return;
  for (const detalle of lineas) await detalle.update({ precioUnitario: escalon.precio }, { transaction });
};

module.exports = { cargarReglas, escalonAplicable, siguienteEscalon, estimarConEscalones, aplicarEscalonesAlEnviar };
