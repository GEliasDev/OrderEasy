import { useRef, useState } from 'react';
import { FileDown, Image as ImagenIcono, MessageCircle, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { exportarRecibo } from '../../../../utils/exportarRecibo';
import { abrirWhatsApp, mensajeComprobante } from '../../../../utils/whatsapp';
import { imagenUrl } from '../../../../config';
import { pesosEnLetras } from '../../../../utils/numeroALetras';
import EncabezadoPagina from '../../../comunes/EncabezadoPagina';
import './Pedidos.css';
import './Recibo.css';

const formatoMoneda = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(valor) || 0);

const fechaLarga = (fecha, conHora = false) => {
  if (!fecha) return '';
  const f = new Date(`${fecha}`.length === 10 ? `${fecha}T12:00:00` : fecha);
  return f.toLocaleDateString('es-CO', conHora
    ? { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'long', year: 'numeric' });
};

/**
 * Comprobante de una compra de cliente: solo lo que pidió y el total. No es un estado de cuenta (abonos y saldos no van aquí).
 * Es el documento que se le envía al cliente al hacer la compra (PDF, imagen, impresión o WhatsApp).
 */
function ComprobanteCompra({ pedido, negocio, onVolver }) {
  const hojaRef = useRef(null);
  const [exportando, setExportando] = useState(null);

  const nombreNegocio = negocio?.nombre || '';
  const cliente = pedido.cliente?.nombreCliente || 'Cliente';
  const total = Number(pedido.total) || 0;
  const anulada = pedido.estado === 'anulado';
  const detalles = (pedido.detalles || []).filter((d) => Number(d.cantidad) > 0);
  const numero = String(pedido.numero).padStart(5, '0');

  const exportar = async (formato) => {
    if (!hojaRef.current) return;
    const nombreArchivo = `Compra-${numero}-${cliente.replace(/[^\p{L}\p{N}]+/gu, '_')}`;
    try {
      setExportando(formato);
      await exportarRecibo(hojaRef.current, nombreArchivo, formato);
    } catch {
      toast.error('No se pudo generar el archivo del comprobante.');
    } finally {
      setExportando(null);
    }
  };

  const enviar = () => {
    const ok = abrirWhatsApp(pedido.cliente?.telefono, mensajeComprobante({
      negocio: nombreNegocio,
      cliente,
      numero: pedido.numero,
      lineas: detalles,
      total,
      fechaEntrega: pedido.fechaEntrega ? fechaLarga(pedido.fechaEntrega) : '',
    }));
    if (!ok) toast.error('Este cliente no tiene un teléfono válido para WhatsApp.');
  };

  return (
    <div className="pedido-pagina recibo-pagina">
      <div className="no-imprimir">
        <EncabezadoPagina onVolver={onVolver} migas={<>Pedidos / Compra {pedido.numero}</>}>Comprobante de compra</EncabezadoPagina>
        <div className="recibo-barra-acciones">
          <button type="button" className="pedidos-btn pedidos-btn-secundario" onClick={enviar}>
            <MessageCircle size={14} /><span>Enviar por WhatsApp</span>
          </button>
          <button type="button" className="pedidos-btn pedidos-btn-secundario" onClick={() => exportar('pdf')} disabled={Boolean(exportando)}>
            <FileDown size={14} /><span>{exportando === 'pdf' ? 'Generando...' : 'Descargar PDF'}</span>
          </button>
          <button type="button" className="pedidos-btn pedidos-btn-secundario" onClick={() => exportar('png')} disabled={Boolean(exportando)}>
            <ImagenIcono size={14} /><span>{exportando === 'png' ? 'Generando...' : 'Descargar imagen'}</span>
          </button>
          <button type="button" className="pedidos-btn pedidos-btn-primary" onClick={() => window.print()}>
            <Printer size={14} /><span>Imprimir</span>
          </button>
        </div>
      </div>

      <div className="recibo-contenedor">
        <article className="recibo-hoja" ref={hojaRef}>
          <header className="recibo-cabecera">
            <div className="recibo-marca">
              {negocio?.logo && (
                <img className="recibo-logo" src={imagenUrl(negocio.logo)} alt={`Logo de ${nombreNegocio}`} crossOrigin="anonymous" />
              )}
              <div className="recibo-negocio">
                <h2>{nombreNegocio || 'OrderEasy'}</h2>
                {(negocio?.nit || negocio?.telefono) && (
                  <p>{[negocio?.nit && `NIT ${negocio.nit}`, negocio?.telefono && `Tel. ${negocio.telefono}`].filter(Boolean).join(' · ')}</p>
                )}
                {negocio?.direccion && <p>{negocio.direccion}</p>}
              </div>
            </div>
            <div className="recibo-doc">
              <span className="recibo-doc-tipo">Comprobante de compra</span>
              <strong className="recibo-doc-numero">N° {numero}</strong>
              <span className="recibo-doc-fecha">{fechaLarga(pedido.createdAt, true)}</span>
            </div>
          </header>

          <dl className="recibo-partes">
            <div><dt>Cliente</dt><dd>{cliente}{pedido.cliente?.telefono ? ` · ${pedido.cliente.telefono}` : ''}</dd></div>
            <div><dt>Entrega</dt><dd>{pedido.fechaEntrega ? fechaLarga(pedido.fechaEntrega) : 'Por definir'}</dd></div>
            {pedido.descripcion && <div><dt>Notas</dt><dd>{pedido.descripcion}</dd></div>}
          </dl>

          <table className="recibo-productos">
            <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Valor</th></tr></thead>
            <tbody>
              {detalles.map((d) => (
                <tr key={d.detalleid}>
                  <td>{d.productoNombre}{d.talla ? <span className="recibo-talla"> · talla {d.talla}</span> : ''}</td>
                  <td>{d.cantidad}</td>
                  <td>{formatoMoneda(d.precioUnitario)}</td>
                  <td>{formatoMoneda(d.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <section className="recibo-importe comprobante-importe">
            {anulada ? (
              <p className="recibo-concepto">Esta compra fue <strong>anulada</strong>.</p>
            ) : (
              <>
                <p className="recibo-concepto">Total a pagar</p>
                <p className="recibo-monto">{formatoMoneda(total)}</p>
                <p className="recibo-letras">Son: {pesosEnLetras(total)} M/CTE.</p>
              </>
            )}
          </section>

          <p className="recibo-pie">
            Gracias por tu compra{nombreNegocio ? ` en ${nombreNegocio}` : ''}.
            {negocio?.telefono && <span> Consultas: {negocio.telefono}</span>}
          </p>
        </article>
      </div>
    </div>
  );
}

export default ComprobanteCompra;
