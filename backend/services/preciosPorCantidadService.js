// Precios por cantidad de los proveedores: al pedir en total X unidades (de cualquier producto, tallas incluidas),
// TODAS las unidades salen al precio fijo del escalón que se alcanza. La cantidad suma las compras de clientes y los
// productos para stock del mismo pedido. Solo cambia lo que se le paga al proveedor; lo que se cobra a los clientes no se toca.

const ProveedorPrecioEscalonado = require('../models/proveedorPrecioEscalonadoModel');
const { dos } = require('./pedidoPagoService');

// Escalones del proveedor [{ desde, precio }] de menor a mayor cantidad
const cargarEscalones = async ({ proveedorid, negocioid, transaction }) => {
  if (!proveedorid) return [];
  const filas = await ProveedorPrecioEscalonado.findAll({ where: { proveedorid, negocioid }, order: [['desdeCantidad', 'ASC']], transaction });
  return filas.map((f) => ({ desde: Number(f.desdeCantidad), precio: Number(f.precio) }));
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
  const escalones = await cargarEscalones({ proveedorid, negocioid });
  const cantidad = Math.round(sumar([...detalles.map((d) => d.cantidad), ...grupos.map((g) => g.totalFaltante)]) * 1000) / 1000;
  const escalon = escalonAplicable(escalones, cantidad);

  let costoStock = 0;
  for (const detalle of detalles) {
    if (escalon) detalle.precioUnitario = escalon.precio;
    detalle.subtotal = dos(Number(detalle.cantidad) * Number(detalle.precioUnitario));
    costoStock += detalle.subtotal;
  }
  const costoClientes = grupos.reduce((s, g) => s + (escalon ? dos(g.totalFaltante * escalon.precio) : Number(g.costo)), 0);

  const siguiente = siguienteEscalon(escalones, cantidad);
  const aviso = escalones.length === 0 ? null : {
    cantidad,
    precio: escalon ? escalon.precio : null,
    siguiente: siguiente ? { desde: siguiente.desde, precio: siguiente.precio, faltan: Math.round((siguiente.desde - cantidad) * 1000) / 1000 } : null,
  };
  return { costoStock: dos(costoStock), costoClientes: dos(costoClientes), aviso };
};

// Al enviar el pedido: fija en cada línea el precio del escalón que alcanza el total pedido
const aplicarEscalonesAlEnviar = async ({ orden, detalles, transaction }) => {
  const escalones = await cargarEscalones({ proveedorid: orden.proveedorid, negocioid: orden.negocioid, transaction });
  const escalon = escalonAplicable(escalones, sumar(detalles.map((d) => d.cantidad)));
  if (!escalon) return;
  for (const detalle of detalles) await detalle.update({ precioUnitario: escalon.precio }, { transaction });
};

module.exports = { cargarEscalones, escalonAplicable, siguienteEscalon, estimarConEscalones, aplicarEscalonesAlEnviar };
