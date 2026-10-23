import { ArrowLeft } from 'lucide-react';
import '../vendedor/dashboard/balance/vistas/styles/DetalleTransaccion.css';

// Encabezado de las pantallas de formulario (lo que antes eran ventanas emergentes): flecha para volver, título y ruta de navegación
function EncabezadoPagina({ onVolver, migas, children }) {
  return (
    <div className="detalle-tx-header">
      <button type="button" className="btn-circle-back" onClick={onVolver} aria-label="Volver">
        <ArrowLeft size={18} />
      </button>
      <div className="detalle-tx-header-text">
        <div className="pedido-titulo-linea"><h1>{children}</h1></div>
        {migas && <div className="detalle-tx-breadcrumb">{migas}</div>}
      </div>
    </div>
  );
}

export default EncabezadoPagina;
