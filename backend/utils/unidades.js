// Unidades de medida y tipos de talla soportados por los productos.
// El frontend mantiene la misma lista en src/utils/unidades.js.

const UNIDADES = {
  und: { nombre: 'Unidad', decimales: false },
  par: { nombre: 'Par', decimales: false },
  caja: { nombre: 'Caja', decimales: false },
  kg: { nombre: 'Kilogramo', decimales: true },
  g: { nombre: 'Gramo', decimales: true },
  m: { nombre: 'Metro', decimales: true },
  l: { nombre: 'Litro', decimales: true },
};

const UNIDAD_POR_DEFECTO = 'und';

const unidadValida = (unidad) => Object.prototype.hasOwnProperty.call(UNIDADES, unidad);

const admiteDecimales = (unidad) => Boolean(UNIDADES[unidad]?.decimales);

// Las cantidades decimales se guardan como DOUBLE: se redondea a 3 decimales para evitar 0.1 + 0.2 = 0.30000000000000004
const redondear = (valor) => Math.round(Number(valor) * 1000) / 1000;

module.exports = { UNIDADES, UNIDAD_POR_DEFECTO, unidadValida, admiteDecimales, redondear };
