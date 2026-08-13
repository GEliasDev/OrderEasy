import { useRef } from 'react';
import { Check, Banknote, CreditCard, Smartphone, Wallet, Download, Printer } from 'lucide-react';

function ConfirmacionVenta({ venta, onNuevaVenta, negocio }) {
  const reciboRef = useRef(null);

  const sumPagos = venta.pagos?.reduce((acc, p) => acc + Number(p.monto), 0) || 0;
  const cambio = sumPagos - Number(venta.total);
  const tieneEfectivo = venta.pagos?.some((p) => p.metodo === 'efectivo');

  const iconForMetodo = {
    efectivo: <Banknote size={14} />,
    tarjeta: <CreditCard size={14} />,
    transferencia: <Smartphone size={14} />,
  };

  // Punto 4 — IVA desde venta.detalles (backend), no recalculado en frontend
  const ivaDesglose = (venta.detalles || []).reduce((acc, d) => {
    const tasa = Number(d.tasaIva || 0);
    const monto = Number(d.montoIva || 0);
    if (tasa > 0 && monto > 0) {
      const found = acc.find((x) => x.tasa === tasa);
      if (found) found.monto += monto;
      else acc.push({ tasa, monto });
    }
    return acc;
  }, []);

  const totalIva = ivaDesglose.reduce((acc, { monto }) => acc + monto, 0);
  const baseGravable = Number(venta.total) - totalIva;

  const fecha = new Date();
  const fechaStr = fecha.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const horaStr = fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  // Punto 2 — altura dinámica: mide el elemento antes de generar el PDF
  const handleDescargarPDF = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    const el = reciboRef.current;
    const heightMm = (el.scrollHeight * 25.4) / 96 + 6;
    html2pdf()
      .set({
        margin: 0,
        filename: `recibo-venta-${venta.ventaid}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: [80, heightMm], orientation: 'portrait' },
      })
      .from(el)
      .save();
  };

  // Punto 3 — imprimir: muestra solo el recibo vía CSS @media print
  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="confirmacion-overlay">
      <div className="confirmacion-card">
        <div className="confirmacion-icono"><Check size={32} strokeWidth={2.5} /></div>
        <h2 className="confirmacion-titulo">¡Venta registrada!</h2>
        <p className="confirmacion-numero">Venta #{venta.ventaid}</p>

        <div className="confirmacion-total">
          ${Number(venta.total).toLocaleString('es-CO')}
        </div>

        {venta.pagos?.length > 0 && (
          <div className="confirmacion-pagos">
            <p className="confirmacion-pagos-titulo">Detalle de cobro</p>
            {venta.pagos.map((p, i) => (
              <div key={i} className="confirmacion-pago-fila">
                <span className="confirmacion-metodo-icon-label">
                  {iconForMetodo[p.metodo] || <Wallet size={14} />}
                  {p.metodo.charAt(0).toUpperCase() + p.metodo.slice(1)}
                </span>
                <span>${Number(p.monto).toLocaleString('es-CO')}</span>
              </div>
            ))}
            {cambio > 0 && tieneEfectivo && (
              <div className="confirmacion-cambio">
                <span>Cambio</span>
                <span>${cambio.toLocaleString('es-CO')}</span>
              </div>
            )}
          </div>
        )}

        {ivaDesglose.length > 0 && (
          <div className="confirmacion-iva">
            <p className="confirmacion-pagos-titulo">Desglose de IVA</p>
            <div className="confirmacion-pago-fila">
              <span>Base gravable</span>
              <span>${Math.round(baseGravable).toLocaleString('es-CO')}</span>
            </div>
            {ivaDesglose.map(({ tasa, monto }) => (
              <div key={tasa} className="confirmacion-pago-fila">
                <span>IVA {tasa}%</span>
                <span>${Math.round(monto).toLocaleString('es-CO')}</span>
              </div>
            ))}
          </div>
        )}

        <div className="confirmacion-acciones">
          <div className="confirmacion-acciones-row">
            <button className="btn-descargar-pdf" onClick={handleDescargarPDF}>
              <Download size={14} />
              Descargar PDF
            </button>
            <button className="btn-imprimir" onClick={handleImprimir}>
              <Printer size={14} />
              Imprimir
            </button>
          </div>
          <button className="btn-nueva-venta" onClick={onNuevaVenta}>
            Nueva venta
          </button>
        </div>
      </div>

      {/* Plantilla del recibo — oculta en pantalla, visible al imprimir y para PDF */}
      <div className="recibo-print-wrapper">
        <div ref={reciboRef} className="recibo-pdf">
          {/* Punto 1 — datos reales del negocio */}
          <div className="recibo-header">
            <p className="recibo-negocio">{negocio?.nombre || 'Mi Negocio'}</p>
            {negocio?.nit && <p className="recibo-meta">NIT: {negocio.nit}</p>}
            {negocio?.direccion && <p className="recibo-meta">{negocio.direccion}</p>}
            {negocio?.telefono && <p className="recibo-meta">Tel: {negocio.telefono}</p>}
            <p className="recibo-fecha">{fechaStr} {horaStr}</p>
            <p className="recibo-venta">Venta #{venta.ventaid}</p>
          </div>

          <div className="recibo-divider" />

          {venta.detalles?.map((d, i) => (
            <div key={i} className="recibo-item">
              <span className="recibo-item-nombre">{d.productoNombre}</span>
              <div className="recibo-item-detalle">
                <span>{d.cantidad} × ${Number(d.precioUnitario).toLocaleString('es-CO')}</span>
                <span>${Number(d.subtotal).toLocaleString('es-CO')}</span>
              </div>
            </div>
          ))}

          <div className="recibo-divider" />

          {ivaDesglose.length > 0 && (
            <>
              <div className="recibo-fila">
                <span>Base gravable</span>
                <span>${Math.round(baseGravable).toLocaleString('es-CO')}</span>
              </div>
              {ivaDesglose.map(({ tasa, monto }) => (
                <div key={tasa} className="recibo-fila recibo-fila-iva">
                  <span>IVA {tasa}%</span>
                  <span>${Math.round(monto).toLocaleString('es-CO')}</span>
                </div>
              ))}
              <div className="recibo-divider recibo-divider-thin" />
            </>
          )}

          <div className="recibo-fila recibo-total">
            <span>TOTAL</span>
            <span>${Number(venta.total).toLocaleString('es-CO')}</span>
          </div>

          <div className="recibo-divider" />

          {venta.pagos?.map((p, i) => (
            <div key={i} className="recibo-fila">
              <span>{p.metodo.charAt(0).toUpperCase() + p.metodo.slice(1)}</span>
              <span>${Number(p.monto).toLocaleString('es-CO')}</span>
            </div>
          ))}
          {cambio > 0 && tieneEfectivo && (
            <div className="recibo-fila">
              <span>Cambio</span>
              <span>${cambio.toLocaleString('es-CO')}</span>
            </div>
          )}

          <div className="recibo-divider" />
          <p className="recibo-gracias">¡Gracias por su compra!</p>
        </div>
      </div>
    </div>
  );
}

export default ConfirmacionVenta;
