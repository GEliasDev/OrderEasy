import { useState } from 'react';
import { Unlock, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { abrirTurno } from '../../../../services/turnoCajaService';
import { useAuth } from '../../../../context/AuthContext';

function AperturaCaja({ onTurnoAbierto }) {
  const { user } = useAuth();
  const [monto, setMonto] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleAbrir = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      const montoNum = monto === '' ? 0 : Number(monto);
      if (isNaN(montoNum) || montoNum < 0) {
        toast.error('Ingresa un monto válido.');
        return;
      }
      const data = await abrirTurno(montoNum);
      toast.success('Turno abierto correctamente.');
      onTurnoAbierto(data.turno);
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al abrir el turno.');
    } finally {
      setCargando(false);
    }
  };

  const nombre = user?.primerNombre || 'Cajero';

  return (
    <div className="apertura-overlay">
      <div className="apertura-card">
        <div className="apertura-icono">
          <Unlock size={28} strokeWidth={2} />
        </div>
        <h2 className="apertura-titulo">Apertura de Caja</h2>
        <p className="apertura-saludo">Bienvenido, <strong>{nombre}</strong>. Indica el efectivo inicial para comenzar el turno.</p>

        <form onSubmit={handleAbrir} className="apertura-form">
          <div className="apertura-input-group">
            <span className="apertura-input-prefix"><DollarSign size={15} /></span>
            <input
              type="number"
              min="0"
              step="100"
              className="apertura-input"
              placeholder="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              autoFocus
            />
          </div>
          <p className="apertura-hint">Puedes dejarlo en 0 si no hay efectivo inicial.</p>
          <button type="submit" className="apertura-btn" disabled={cargando}>
            {cargando ? 'Abriendo...' : 'Abrir turno'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AperturaCaja;
