// Cálculos compartidos por el seguimiento de clientes (por entregar / por cobrar) y el listado de pedidos.

export const redondear = (n) => Math.round(Number(n) * 1000) / 1000;

// Lo que falta por entregar de una línea
export const pendienteDe = (detalle) => redondear(Number(detalle.cantidad) - Number(detalle.cantidadEntregada || 0));

// Stock físico de la línea: el de su talla si el producto maneja tallas, o el total del producto
export const stockFisicoDe = (detalle) => {
  const producto = detalle.producto;
  if (!producto) return 0;
  if (detalle.varianteid || detalle.talla) {
    const variante = (producto.variantes || []).find(
      (v) => (detalle.varianteid && v.varianteid === detalle.varianteid) || v.talla === detalle.talla
    );
    if (variante) return Number(variante.cantidadDisponible || 0);
  }
  return Number(producto.cantidadDisponible || 0);
};

export const ESTADOS_ENTREGABLES = ['confirmado', 'en_compra', 'recibido'];

// Urgencia de la fecha de entrega respecto a hoy. null si el pedido no tiene fecha.
export const urgenciaEntrega = (fechaEntrega, ahora = new Date()) => {
  if (!fechaEntrega) return null;
  const [anio, mes, dia] = String(fechaEntrega).slice(0, 10).split('-').map(Number);
  const entrega = new Date(anio, mes - 1, dia);
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const dias = Math.round((entrega - hoy) / 86400000);
  if (dias < 0) return { dias, clase: 'vencida', etiqueta: `Vencida hace ${-dias} ${dias === -1 ? 'día' : 'días'}` };
  if (dias === 0) return { dias, clase: 'hoy', etiqueta: 'Hoy' };
  if (dias === 1) return { dias, clase: 'pronto', etiqueta: 'Mañana' };
  if (dias <= 7) return { dias, clase: 'pronto', etiqueta: `En ${dias} días` };
  return { dias, clase: 'normal', etiqueta: entrega.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) };
};

// Líneas pendientes de un pedido con su disponibilidad ("lista" si hay stock para todo lo pendiente)
export const lineasPendientes = (pedido) =>
  (pedido.detalles || [])
    .filter((d) => pendienteDe(d) > 0)
    .map((d) => {
      const pendiente = pendienteDe(d);
      const stock = stockFisicoDe(d);
      return { ...d, pendiente, stock, stockTotal: stock, lista: stock >= pendiente, hayAlgo: stock > 0 };
    });

// Agrupa pedidos por cliente conservando el orden en que aparece cada cliente
export const agruparPorCliente = (pedidos) => {
  const grupos = new Map();
  for (const pedido of pedidos) {
    const clave = pedido.clienteid || `sin-${pedido.pedidoid}`;
    if (!grupos.has(clave)) {
      grupos.set(clave, { clave, cliente: pedido.cliente?.nombreCliente || 'Sin cliente', telefono: pedido.cliente?.telefono, pedidos: [] });
    }
    grupos.get(clave).pedidos.push(pedido);
  }
  return [...grupos.values()];
};

// Varios pedidos pueden querer el mismo par: el stock se reparte entre ellos (primero la entrega más urgente,
// luego el pedido más antiguo) para no marcar como "listos" más pares de los que hay.
export const repartirStock = (filas) => {
  const orden = [...filas].sort(
    (a, b) => (a.urgencia?.dias ?? 9999) - (b.urgencia?.dias ?? 9999) || a.pedido.pedidoid - b.pedido.pedidoid
  );
  const restante = new Map();
  for (const fila of orden) {
    for (const linea of fila.lineas) {
      const clave = `${linea.productoid}:${linea.varianteid || ''}`;
      if (!restante.has(clave)) restante.set(clave, linea.stockTotal);
      const disponible = restante.get(clave);
      const asignado = Math.min(disponible, linea.pendiente);
      restante.set(clave, redondear(disponible - asignado));
      linea.stock = asignado;
      linea.lista = asignado >= linea.pendiente;
      linea.hayAlgo = asignado > 0;
    }
  }
  return filas;
};
