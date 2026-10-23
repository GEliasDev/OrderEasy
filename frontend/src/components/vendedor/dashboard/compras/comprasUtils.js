// Utilidades compartidas por las pantallas de compras al proveedor.

export const ESTADOS_COMPRA = {
  abierta: { label: 'Abierto', clase: 'pendiente' },
  borrador: { label: 'Borrador', clase: 'pendiente' },
  enviada: { label: 'Enviado al proveedor', clase: 'en-compra' },
  recibida_parcial: { label: 'Recibido parcial', clase: 'confirmado' },
  recibida: { label: 'Recibido', clase: 'recibido' },
  anulada: { label: 'Anulado', clase: 'anulado' },
};

export const formatoMoneda = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(valor) || 0);

export const formatearFecha = (fecha) => {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

const redondear = (n) => Math.round(Number(n) * 1000) / 1000;

// Una asignación sigue "viva" mientras el pedido del cliente no esté anulado
export const asignacionActiva = (asignacion) => asignacion.pedidoDetalle?.pedido?.estado !== 'anulado';

export const pendienteAsignacion = (asignacion) =>
  redondear(Number(asignacion.cantidad) - Number(asignacion.cantidadRecibida || 0));

export const restanteDetalle = (detalle) =>
  redondear(Number(detalle.cantidad) - Number(detalle.cantidadRecibida || 0));

// Sugerencia de reparto: lo que llega se asigna por orden de pedido (el primero que pidió)
export const repartoSugerido = (detalle, llegaron) => {
  const reparto = {};
  let restante = redondear(llegaron);
  for (const asignacion of detalle.asignaciones || []) {
    if (!asignacionActiva(asignacion)) continue;
    const cantidad = Math.max(0, Math.min(pendienteAsignacion(asignacion), restante));
    reparto[asignacion.asignacionid] = String(cantidad);
    restante = redondear(restante - cantidad);
  }
  return reparto;
};

export const etiquetaTalla = (detalle) => (detalle.talla ? ` · Talla ${detalle.talla}` : '');

// Nombre con el que se muestra un pedido al proveedor
export const nombrePedido = (orden) => orden.nombre || `Pedido #${orden.ordenid}`;

// Estado de una compra de cliente (dentro de un pedido al proveedor)
export const ESTADOS_COMPRA_CLIENTE = {
  pendiente: 'Pendiente',
  confirmado: 'En el pedido',
  en_compra: 'En compra',
  recibido: 'Recibida',
  entregado: 'Entregada',
  anulado: 'Anulada',
};

// Por qué el cliente devuelve la mercancía (las claves las valida el backend)
export const MOTIVOS_DEVOLUCION = {
  color: 'No era el color',
  talla: 'No era la talla',
  modelo: 'No era el modelo',
  danado: 'Llegó dañado o con defecto',
  no_gusto: 'No le gustó',
  otro: 'Otro motivo',
};
