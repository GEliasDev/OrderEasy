import { useState } from 'react';
import { Lock, Banknote, CreditCard, Smartphone, TrendingUp, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cerrarTurno } from '../../../../services/turnoCajaService';

const fmt = (n) => Number(n || 0).toLocaleString('es-CO');

function CierreCaja({ turno, resumen, onCerrado, onCancelar }) {
  const [montoReal, setMontoReal] = useState('');
  const [cargando, setCargando] = useState(false);

  const montoRealNum = montoReal === '' ? null : Number(montoReal);
  const diferencia = montoRealNum !== null ? montoRealNum - resumen.efectivoEsperado : null;

  const fechaApertura = new Date(turno.fechaApertura);
  const fechaStr = fechaApertura.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const horaStr = fechaApertura.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  const handleCerrar = async (e) => {
    e.preventDefault();
    if (montoRealNum === null || isNaN(montoRealNum) || montoRealNum < 0) {
      toast.error('Ingresa el efectivo real en caja.');
      return;
    }
    setCargando(true);
    try {
      const data = await cerrarTurno(montoRealNum);
      toast.success('Turno cerrado correctamente.');
      onCerrado(data.reporte);
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al cerrar el turno.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="cierre-overlay">
      <div className="cierre-card">
        <div className="cierre-header">
          <div className="cierre-header-left">
            <div className="cierre-icono"><Lock size={18} /></div>
            <div>
              <h2 className="cierre-titulo">Cierre de Turno</h2>
              <p className="cierre-subtitulo">Apertura: {fechaStr} {horaStr}</p>
            </div>
          </div>
          <button className="cierre-btn-cancelar-top" onClick={onCancelar}><X size={16} /></button>
        </div>

        <div className="cierre-resumen">
          <div className="cierre-fila">
            <span className="cierre-fila-label"><Banknote size={14} /> Efectivo</span>
            <span className="cierre-fila-valor">${fmt(resumen.efectivo)}</span>
          </div>
          <div className="cierre-fila">
            <span className="cierre-fila-label"><CreditCard size={14} /> Tarjeta</span>
            <span className="cierre-fila-valor">${fmt(resumen.tarjeta)}</span>
          </div>
          <div className="cierre-fila">
            <span className="cierre-fila-label"><Smartphone size={14} /> Transferencia</span>
            <span className="cierre-fila-valor">${fmt(resumen.transferencia)}</span>
          </div>

          <div className="cierre-divider" />

          <div className="cierre-fila cierre-fila-total">
            <span className="cierre-fila-label"><TrendingUp size={14} /> Total vendido</span>
            <span className="cierre-fila-valor">${fmt(resumen.totalVendido)}</span>
          </div>
          <div className="cierre-fila">
            <span className="cierre-fila-label cierre-label-meta">Ventas registradas</span>
            <span className="cierre-fila-valor">{resumen.totalVentas}</span>
          </div>

          <div className="cierre-divider" />

          <div className="cierre-fila">
            <span className="cierre-fila-label cierre-label-meta">Monto inicial</span>
            <span className="cierre-fila-valor">${fmt(turno.montoInicial)}</span>
          </div>
          <div className="cierre-fila cierre-fila-esperado">
            <span className="cierre-fila-label cierre-label-meta">Efectivo esperado en caja</span>
            <span className="cierre-fila-valor">${fmt(resumen.efectivoEsperado)}</span>
          </div>
        </div>

        <form onSubmit={handleCerrar} className="cierre-form">
          <label className="cierre-label">Efectivo real en caja</label>
          <div className="cierre-input-group">
            <span className="cierre-input-prefix">$</span>
            <input
              type="number"
              min="0"
              step="100"
              className="cierre-input"
              placeholder="0"
              value={montoReal}
              onChange={(e) => setMontoReal(e.target.value)}
              autoFocus
            />
          </div>

          {diferencia !== null && (
            <div className={`cierre-diferencia ${diferencia === 0 ? 'ok' : diferencia > 0 ? 'sobre' : 'faltante'}`}>
              {diferencia === 0
                ? <><CheckCircle2 size={14} /> Cuadre perfecto</>
                : diferencia > 0
                  ? <><AlertCircle size={14} /> Sobrante: ${fmt(Math.abs(diferencia))}</>
                  : <><AlertCircle size={14} /> Faltante: ${fmt(Math.abs(diferencia))}</>
              }
            </div>
          )}

          <button type="submit" className="cierre-btn-confirmar" disabled={cargando || montoRealNum === null}>
            {cargando ? 'Cerrando...' : 'Confirmar cierre'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CierreCaja;
