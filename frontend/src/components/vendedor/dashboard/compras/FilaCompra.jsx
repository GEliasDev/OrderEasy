import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { colorAvatar, iniciales } from '../../../../utils/avatar';
import { ESTADOS_COMPRA_CLIENTE, formatoMoneda } from './comprasUtils';

const num = (valor) => Number(valor) || 0;
const cantidad = (n) => num(n).toLocaleString('es-CO', { maximumFractionDigits: 3 });

const BADGE_ESTADO = {
  pendiente: 'tbl-badge--warning',
  confirmado: 'tbl-badge--primary',
  en_compra: 'tbl-badge--primary',
  recibido: 'tbl-badge--ok',
  entregado: 'tbl-badge--ok',
  anulado: 'tbl-badge--neutral',
};

/**
 * Una compra de cliente dentro del pedido, en una sola fila: quién es, en qué estado está y cuánto debe.
 * Al tocarla se abre el detalle de la compra, donde se gestiona todo (abonos, entregas, devoluciones, recibos).
 */
function FilaCompra({ compra, rutaPedido }) {
  const navigate = useNavigate();
  const anulada = compra.estado === 'anulado';
  const estado = compra.estado || 'pendiente';
  const cliente = compra.cliente?.nombreCliente || 'Sin cliente';
  const resumen = compra.resumen || {};
  const saldo = num(resumen.saldo);
  // Dinero que el cliente pagó de más (p. ej. tras devolver mercancía ya pagada)
  const aFavor = Math.max(0, num(resumen.disponibleAbonos) - num(resumen.porEntregar));
  const unidades = (compra.detalles || []).reduce((s, d) => s + num(d.cantidad), 0);

  const abrir = () => navigate(`/dashboard/pedido/${compra.pedidoid}`, { state: { volverA: rutaPedido } });

  return (
    <button
      type="button"
      className={`fila-compra${anulada ? ' fila-compra--anulada' : ''}`}
      onClick={abrir}
      aria-label={`Abrir la compra ${compra.numero} de ${cliente}`}
    >
      <span className="tbl-avatar" style={{ background: colorAvatar(cliente), opacity: anulada ? 0.5 : 1 }} aria-hidden="true">{iniciales(cliente)}</span>

      <span className="fila-compra-id">
        <strong>{cliente}</strong>
        <small>Compra {compra.numero} · {cantidad(unidades)} {unidades === 1 ? 'unidad' : 'unidades'}<span className="fila-compra-estado-movil"> · {ESTADOS_COMPRA_CLIENTE[estado] || estado}</span></small>
      </span>

      <span className={`tbl-badge fila-compra-estado ${BADGE_ESTADO[estado] || 'tbl-badge--neutral'}`}>{ESTADOS_COMPRA_CLIENTE[estado] || estado}</span>

      <span className="fila-compra-montos">
        <span><small>Total</small><strong>{formatoMoneda(compra.total)}</strong></span>
        <span><small>Abonado</small><strong>{formatoMoneda(resumen.abonado)}</strong></span>
        <span>
          <small>Saldo</small>
          {anulada ? <strong className="tbl-vacio">—</strong>
            : saldo > 0 ? <strong className="fila-compra-debe">{formatoMoneda(saldo)}</strong>
              : <span className="tbl-badge tbl-badge--ok">Pagado</span>}
        </span>
        {aFavor > 0.009 && (
          <span><small>A favor</small><strong className="fila-compra-favor">{formatoMoneda(aFavor)}</strong></span>
        )}
      </span>

      <ChevronRight size={18} className="fila-compra-flecha" aria-hidden="true" />
    </button>
  );
}

export default FilaCompra;
