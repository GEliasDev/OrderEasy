import { useState } from 'react';
import { Banknote, CreditCard, Smartphone, Wallet, X, CheckCircle2 } from 'lucide-react';

const METODOS = [
  { key: 'efectivo',       label: 'Efectivo',   Icon: Banknote },
  { key: 'tarjeta',        label: 'Tarjeta',    Icon: CreditCard },
  { key: 'transferencia',  label: 'Transfer.',  Icon: Smartphone },
];

function PanelPago({ total, pagos, onAgregarPago, onEliminarPago, onRegistrar, cargando }) {
  const [metodoPendiente, setMetodoPendiente] = useState(null);
  const [montoPendiente, setMontoPendiente] = useState('');

  const sumPagos = pagos.reduce((acc, p) => acc + Number(p.monto), 0);
  const diferencia = sumPagos - total;
  const tieneEfectivo = pagos.some((p) => p.metodo === 'efectivo');
  const puedeRegistrar = sumPagos >= total && pagos.length > 0 && !cargando;

  const handleAgregar = () => {
    const monto = Number(montoPendiente);
    if (!monto || monto <= 0 || !metodoPendiente) return;
    onAgregarPago(metodoPendiente, monto);
    setMetodoPendiente(null);
    setMontoPendiente('');
  };

  const toggleMetodo = (m) => {
    if (metodoPendiente === m) {
      setMetodoPendiente(null);
      setMontoPendiente('');
    } else {
      setMetodoPendiente(m);
      setMontoPendiente('');
    }
  };

  const getIconForMetodo = (metodo) => {
    const found = METODOS.find((m) => m.key === metodo);
    if (!found) return <Wallet size={14} />;
    const { Icon } = found;
    return <Icon size={14} />;
  };

  return (
    <div className="panel-pago">
      <div className="panel-pago-header">
        <h3 className="panel-pago-titulo">Cobro</h3>
      </div>

      <div className="panel-pago-body">
        {/* Total a cobrar */}
        <div className="pago-total-display">
          <span className="pago-total-label">Total a cobrar</span>
          <span className="pago-total-monto">${total.toLocaleString('es-CO')}</span>
        </div>

        {/* Métodos de pago */}
        <div>
          <p className="metodos-label">Método de pago</p>
          <div className="metodos-pago-btns">
            {METODOS.map((m) => (
              <button
                key={m.key}
                className={`metodo-btn${metodoPendiente === m.key ? ' activo' : ''}`}
                onClick={() => toggleMetodo(m.key)}
              >
                <span className="metodo-btn-icon"><m.Icon size={16} /></span>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input de monto */}
        {metodoPendiente && (
          <div className="monto-input-row">
            <input
              type="number"
              min="0"
              className="monto-input"
              placeholder={`Monto en ${metodoPendiente}`}
              value={montoPendiente}
              onChange={(e) => setMontoPendiente(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAgregar()}
            />
            <button className="btn-agregar-pago" onClick={handleAgregar}>
              Agregar
            </button>
          </div>
        )}

        {/* Lista de pagos agregados */}
        {pagos.length > 0 && (
          <div className="pagos-lista">
            <p className="pagos-lista-titulo">Pagos agregados</p>
            {pagos.map((p, i) => (
              <div key={i} className="pago-item">
                <span className="pago-metodo-icon">{getIconForMetodo(p.metodo)}</span>
                <span className="pago-metodo">
                  {p.metodo.charAt(0).toUpperCase() + p.metodo.slice(1)}
                </span>
                <span className="pago-monto">
                  ${Number(p.monto).toLocaleString('es-CO')}
                </span>
                <button
                  className="pago-eliminar"
                  onClick={() => onEliminarPago(i)}
                  aria-label="Eliminar pago"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Indicador dinámico */}
        <div className="pago-indicador">
          {pagos.length === 0 ? (
            <span className="indicador-neutral">Selecciona un método de pago</span>
          ) : diferencia < 0 ? (
            <span className="indicador-falta">
              Faltan ${Math.abs(diferencia).toLocaleString('es-CO')}
            </span>
          ) : diferencia === 0 ? (
            <span className="indicador-exacto">Pago exacto ✓</span>
          ) : (
            <span className="indicador-cambio">
              {tieneEfectivo
                ? `Cambio: $${diferencia.toLocaleString('es-CO')}`
                : `Excedente: $${diferencia.toLocaleString('es-CO')}`}
            </span>
          )}
        </div>

        <button
          className="btn-registrar"
          disabled={!puedeRegistrar}
          onClick={onRegistrar}
        >
          {cargando ? (
            'Registrando...'
          ) : (
            <>
              <CheckCircle2 size={16} />
              Registrar venta
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default PanelPago;
