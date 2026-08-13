import { AlertTriangle } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

function ConfirmActionCard({ description }) {
  const { confirmAction, cancelAction, isLoading } = useChat();

  return (
    <div style={{
      background: '#fff8e1',
      border: '1px solid #f59e0b',
      borderRadius: 10,
      padding: '12px 14px',
      marginTop: 4
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <AlertTriangle size={16} color="#f59e0b" />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
          Acción que requiere confirmación
        </span>
      </div>
      <p style={{ fontSize: 13, color: '#78350f', margin: '0 0 12px' }}>{description}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={cancelAction}
          disabled={isLoading}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 7, border: '1px solid #d1d5db',
            background: 'white', fontSize: 13, cursor: 'pointer', fontWeight: 500
          }}
        >
          Cancelar
        </button>
        <button
          onClick={confirmAction}
          disabled={isLoading}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 7, border: 'none',
            background: '#dc2626', color: 'white', fontSize: 13,
            cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 500,
            opacity: isLoading ? 0.7 : 1
          }}
        >
          {isLoading ? 'Ejecutando...' : 'Confirmar'}
        </button>
      </div>
    </div>
  );
}

export default ConfirmActionCard;
