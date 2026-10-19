// Utilidades compartidas por las pantallas de compras al proveedor.

export const ESTADOS_COMPRA = {
  borrador: { label: 'Borrador', clase: 'pendiente' },
  enviada: { label: 'Pedida al proveedor', clase: 'en-compra' },
  recibida_parcial: { label: 'Recibida parcial', clase: 'confirmado' },
  recibida: { label: 'Recibida', clase: 'recibido' },
  anulada: { label: 'Anulada', clase: 'anulado' },
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
