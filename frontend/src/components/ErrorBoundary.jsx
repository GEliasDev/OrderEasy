import { Component } from 'react';
import { esErrorDeCarga, puedeRecargarPorChunk } from '../utils/chunkReload';

const estilos = {
  contenedor: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '1rem',
    padding: '2rem',
    fontFamily: 'sans-serif',
    textAlign: 'center',
  },
  titulo: { color: '#0F172A', margin: 0 },
  texto: { color: '#64748B', margin: 0, maxWidth: 520 },
  boton: {
    padding: '0.5rem 1.5rem',
    background: '#1565C0',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  detalles: { marginTop: '1rem', maxWidth: 'min(760px, 90vw)', textAlign: 'left' },
  resumen: { cursor: 'pointer', color: '#334155', fontWeight: 600 },
  pre: {
    marginTop: '0.5rem',
    padding: '0.75rem',
    background: '#F1F5F9',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    color: '#334155',
    fontSize: '0.75rem',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    maxHeight: '45vh',
    overflow: 'auto',
  },
};

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, recargando: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);

    // Un chunk que ya no existe no es un error de la pantalla: se recarga para
    // cargar los archivos de la versión desplegada. Si ya se intentó hace poco,
    // se muestra el aviso en vez de entrar en un ciclo de recargas.
    if (esErrorDeCarga(error) && puedeRecargarPorChunk()) {
      this.setState({ recargando: true });
      window.setTimeout(() => window.location.reload(), 250);
      // Si el navegador bloquea la recarga, no dejamos el aviso para siempre.
      window.setTimeout(() => this.setState({ recargando: false }), 4000);
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, recargando } = this.state;
    const errorDeCarga = esErrorDeCarga(error);

    if (recargando) {
      return (
        <div style={estilos.contenedor}>
          <h2 style={estilos.titulo}>Actualizando la aplicación…</h2>
          <p style={estilos.texto}>Estamos cargando la versión más reciente.</p>
        </div>
      );
    }

    return (
      <div style={estilos.contenedor}>
        <h2 style={estilos.titulo}>Algo salió mal</h2>
        <p style={estilos.texto}>
          {errorDeCarga
            ? 'La aplicación se actualizó o se perdió la conexión con el servidor. Recarga para continuar.'
            : 'Recarga la página o contacta soporte si el problema persiste.'}
        </p>
        <button onClick={() => window.location.reload()} style={estilos.boton}>
          Recargar
        </button>
        {import.meta.env.DEV && error && (
          <details style={estilos.detalles}>
            <summary style={estilos.resumen}>Detalles del error</summary>
            <pre style={estilos.pre}>{String(error.stack || error.message || error)}</pre>
          </details>
        )}
      </div>
    );
  }
}

export default ErrorBoundary;
