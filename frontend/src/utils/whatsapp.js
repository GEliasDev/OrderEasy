// Mensajes y enlaces de WhatsApp para avisar a los clientes (entrega lista, saldo pendiente, recibos).

const formatoMoneda = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(valor) || 0);

// Número listo para wa.me: celular colombiano de 10 dígitos -> prefijo 57. Devuelve null si no parece un teléfono.
export const telefonoWhatsApp = (telefono) => {
  const digitos = String(telefono || '').replace(/\D/g, '');
  if (!digitos) return null;
  if (digitos.length === 10 && digitos.startsWith('3')) return `57${digitos}`;
  if (digitos.length === 12 && digitos.startsWith('57')) return digitos;
  return digitos.length >= 8 ? digitos : null;
};

export const enlaceWhatsApp = (telefono, mensaje) => {
  const numero = telefonoWhatsApp(telefono);
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}` : null;
};

// Abre WhatsApp con el mensaje escrito. Devuelve false si el cliente no tiene un teléfono válido.
export const abrirWhatsApp = (telefono, mensaje) => {
  const enlace = enlaceWhatsApp(telefono, mensaje);
  if (!enlace) return false;
  window.open(enlace, '_blank', 'noopener,noreferrer');
  return true;
};

const saludo = (cliente) => `Hola ${String(cliente || '').split(' ')[0] || ''}`.trim();
const firma = (negocio) => (negocio ? `\n\n${negocio}` : '');

const listaProductos = (lineas) =>
  lineas.map((l) => `• ${l.productoNombre}${l.talla ? ` (talla ${l.talla})` : ''} x${l.cantidad}`).join('\n');

export const mensajeListoParaEntregar = ({ negocio, cliente, numero, lineas, saldo }) =>
  `${saludo(cliente)} 👋 Te escribimos de ${negocio || 'la tienda'}. Tu compra N° ${numero} ya está lista para entregar:\n${listaProductos(lineas)}`
  + (saldo > 0 ? `\n\nSaldo pendiente: ${formatoMoneda(saldo)}.` : '')
  + `\n\n¿Cuándo te queda bien recibirlo? 😊${firma(negocio)}`;

export const mensajeRecordatorioSaldo = ({ negocio, cliente, numero, total, abonado, saldo }) =>
  `${saludo(cliente)} 👋 Te recordamos que tu compra N° ${numero} tiene un saldo pendiente de ${formatoMoneda(saldo)} `
  + `(total ${formatoMoneda(total)}, abonado ${formatoMoneda(abonado)}).\n\n¡Gracias por tu compra! 🙏${firma(negocio)}`;

export const mensajeRecibo = ({ negocio, cliente, numero, reciboid, tipo, monto, metodo, saldo }) =>
  `${saludo(cliente)} 👋 ${tipo === 'abono' ? 'Recibimos tu abono' : 'Registramos la devolución'} de ${formatoMoneda(monto)} (${metodo}) `
  + `de tu compra N° ${numero}. Recibo N° ${reciboid}.\n`
  + (saldo > 0 ? `Saldo pendiente: ${formatoMoneda(saldo)}.` : 'Tu compra no tiene saldo pendiente ✅')
  + `\n\n¡Gracias!${firma(negocio)}`;

export const mensajeComprobante = ({ negocio, cliente, numero, lineas, total, fechaEntrega }) =>
  `${saludo(cliente)} 👋 Este es el resumen de tu compra N° ${numero}:
${listaProductos(lineas)}

`
  + `Total: ${formatoMoneda(total)}`
  + (fechaEntrega ? `
Entrega estimada: ${fechaEntrega}.` : '')
  + `

¡Gracias por tu compra! 🙏${firma(negocio)}`;
