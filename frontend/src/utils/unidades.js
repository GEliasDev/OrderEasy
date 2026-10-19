// Unidades de medida y tallas de los productos. Misma lista que backend/utils/unidades.js.

export const UNIDADES = [
  { value: 'und', label: 'Unidad', abrev: 'und', decimales: false },
  { value: 'par', label: 'Par', abrev: 'par', decimales: false },
  { value: 'caja', label: 'Caja', abrev: 'caja', decimales: false },
  { value: 'kg', label: 'Kilogramo', abrev: 'kg', decimales: true },
  { value: 'g', label: 'Gramo', abrev: 'g', decimales: true },
  { value: 'm', label: 'Metro', abrev: 'm', decimales: true },
  { value: 'l', label: 'Litro', abrev: 'l', decimales: true },
];

export const TALLAS_PRESET = [
  { key: 'calzado', label: 'Calzado 35–40', tallas: ['35', '36', '37', '38', '39', '40'] },
  { key: 'ropa', label: 'Ropa XS–XL', tallas: ['XS', 'S', 'M', 'L', 'XL'] },
];

export const unidadInfo = (unidad) => UNIDADES.find((u) => u.value === unidad) || UNIDADES[0];

export const admiteDecimales = (unidad) => unidadInfo(unidad).decimales;

// Paso del input numérico: enteros salvo kg, g, m y l
export const stepCantidad = (unidad) => (admiteDecimales(unidad) ? '0.001' : '1');

// "2,5 kg" / "10 und"
export const formatearCantidad = (cantidad, unidad) =>
  `${Number(cantidad || 0).toLocaleString('es-CO', { maximumFractionDigits: 3 })} ${unidadInfo(unidad).abrev}`;

// Orden natural de tallas: numéricas de menor a mayor y luego las de letras (XS, S, M, L, XL...)
const ORDEN_LETRAS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
export const compararTallas = (a, b) => {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  if (!Number.isNaN(na)) return -1;
  if (!Number.isNaN(nb)) return 1;
  const ia = ORDEN_LETRAS.indexOf(String(a).toUpperCase());
  const ib = ORDEN_LETRAS.indexOf(String(b).toUpperCase());
  if (ia !== -1 && ib !== -1) return ia - ib;
  return String(a).localeCompare(String(b));
};

// Tallas de un producto ordenadas; [] si no maneja tallas
export const tallasOrdenadas = (producto) =>
  producto?.usaTallas ? [...(producto.variantes || [])].sort((a, b) => compararTallas(a.talla, b.talla)) : [];
