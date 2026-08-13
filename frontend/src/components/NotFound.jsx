import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '4rem', margin: 0, color: '#1565C0', fontWeight: 800 }}>404</h1>
      <h2 style={{ color: '#0F172A', margin: 0 }}>Página no encontrada</h2>
      <p style={{ color: '#64748B', margin: 0 }}>La ruta que buscas no existe.</p>
      <button
        onClick={() => navigate('/')}
        style={{ padding: '0.5rem 1.5rem', background: '#1565C0', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
      >
        Volver al inicio
      </button>
    </div>
  );
};

export default NotFound;
