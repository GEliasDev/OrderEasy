import { MessageCircle, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { abrirWhatsApp, mensajeRecibo } from '../../../../utils/whatsapp';
import EncabezadoPagina from '../../../comunes/EncabezadoPagina';
import './Pedidos.css';
import './Recibo.css';

const formatoMoneda = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(valor) || 0);

const METODOS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

const TIPOS = {
  abono: { titulo: 'Recibo de abono', verbo: 'Recibimos de' },
  devolucion: { titulo: 'Comprobante de devolución', verbo: 'Devolvimos a' },
  traslado: { titulo: 'Comprobante de traslado de saldo', verbo: 'Trasladamos a favor de' },
};

// Saldo del pedido justo después de este movimiento (con los movimientos anteriores y este)
const saldoDespues = (pedido, pago) => {
  const hasta = (pedido.pagos || []).filter((p) => p.pagoid <= pago.pagoid);
  const abonado = hasta.reduce((s, p) => s + (p.tipo === 'abono' ? Number(p.monto) : -Number(p.monto)), 0);
  return Math.max(0, Math.round((Number(pedido.total) - abonado) * 100) / 100);
};

/**
 * Pantalla del recibo imprimible de un abono (o comprobante de devolución) de un pedido, con envío por WhatsApp.
 */
function ReciboPagina({ pedido, pago, negocio, onVolver }) {
  const tipo = TIPOS[pago.tipo] || TIPOS.abono;
  const nombreNegocio = negocio?.nombre || '';
  const saldo = saldoDespues(pedido, pago);
  const cliente = pedido.cliente?.nombreCliente || 'Cliente';
  const fecha = new Date(pago.createdAt).toLocaleString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const enviar = () => {
    const ok = abrirWhatsApp(pedido.cliente?.telefono, mensajeRecibo({
      negocio: nombreNegocio,
      cliente,
      pedidoid: pedido.pedidoid,
      reciboid: pago.pagoid,
      tipo: pago.tipo,
      monto: pago.monto,
      metodo: METODOS[pago.metodo] || pago.metodo,
      saldo,
    }));
    if (!ok) toast.error('Este cliente no tiene un teléfono válido para WhatsApp.');
  };

  return (
    <div className="pedido-pagina recibo-pagina">
      <div className="no-imprimir">
        <EncabezadoPagina onVolver={onVolver} migas={<>Pedidos / Compra #{pedido.pedidoid}</>}>{tipo.titulo}</EncabezadoPagina>
        <div className="recibo-barra-acciones">
          <button className="pedidos-btn pedidos-btn-secundario" onClick={enviar}>
            <MessageCircle size={14} /><span>Enviar por WhatsApp</span>
          </button>
          <button className="pedidos-btn pedidos-btn-primary" onClick={() => window.print()}>
            <Printer size={14} /><span>Imprimir</span>
          </button>
        </div>
      </div>

      <div className="recibo-contenedor">
        <article className="recibo-hoja">
          <header className="recibo-encabezado">
            <h2>{nombreNegocio || 'OrderEasy'}</h2>
            {(negocio?.nit || negocio?.telefono) && (
              <p>{[negocio?.nit && `NIT ${negocio.nit}`, negocio?.telefono && `Tel. ${negocio.telefono}`].filter(Boolean).join(' · ')}</p>
            )}
            {negocio?.direccion && <p>{negocio.direccion}</p>}
          </header>

          <div className="recibo-titulo">
            <strong>{tipo.titulo}</strong>
            <span>N° {String(pago.pagoid).padStart(5, '0')}</span>
          </div>

          <dl className="recibo-datos">
            <div><dt>Fecha</dt><dd>{fecha}</dd></div>
            <div><dt>Cliente</dt><dd>{cliente}{pedido.cliente?.telefono ? ` · ${pedido.cliente.telefono}` : ''}</dd></div>
            <div><dt>Pedido</dt><dd>#{pedido.pedidoid}</dd></div>
            <div><dt>Método</dt><dd>{METODOS[pago.metodo] || pago.metodo}</dd></div>
            {pago.nota && <div><dt>Nota</dt><dd>{pago.nota}</dd></div>}
          </dl>

          <p className="recibo-concepto">
            {tipo.verbo} <strong>{cliente}</strong> la suma de:
          </p>
          <p className="recibo-monto">{formatoMoneda(pago.monto)}</p>

          <table className="recibo-productos">
            <thead><tr><th>Producto del pedido</th><th>Cant.</th><th>Valor</th></tr></thead>
            <tbody>
              {(pedido.detalles || []).map((d) => (
                <tr key={d.detalleid}>
                  <td>{d.productoNombre}{d.talla ? ` (talla ${d.talla})` : ''}</td>
                  <td>{d.cantidad}</td>
                  <td>{formatoMoneda(d.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="recibo-resumen">
            <div><span>Total del pedido</span><strong>{formatoMoneda(pedido.total)}</strong></div>
            <div><span>Saldo pendiente</span><strong>{saldo > 0 ? formatoMoneda(saldo) : 'Pagado'}</strong></div>
          </div>

          <div className="recibo-firmas">
            <div><span>Recibió</span></div>
            <div><span>Cliente</span></div>
          </div>
          <p className="recibo-pie">Gracias por tu compra.</p>
        </article>
      </div>
    </div>
  );
}

export default ReciboPagina;
