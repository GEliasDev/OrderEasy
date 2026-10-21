import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useEsMovil } from '../../hooks/useEsMovil';
import './comunes.css';

// Agrupa campos de un formulario. En celular se pliega bajo un título para acortar el formulario; en pantallas grandes
// se muestra siempre completo. Los campos plegados siguen en el estado del formulario (solo se ocultan).
function SeccionPlegable({ titulo, resumen, abiertaInicial = false, children }) {
  const esMovil = useEsMovil();
  const [abierta, setAbierta] = useState(abiertaInicial);

  if (!esMovil) return <>{children}</>;

  return (
    <div className={`sp${abierta ? ' sp-abierta' : ''}`}>
      <button type="button" className="sp-cabecera" onClick={() => setAbierta((a) => !a)} aria-expanded={abierta}>
        <span className="sp-titulo">{titulo}</span>
        {resumen && !abierta && <span className="sp-resumen">{resumen}</span>}
        <ChevronDown size={16} className="sp-flecha" aria-hidden="true" />
      </button>
      {abierta && <div className="sp-cuerpo">{children}</div>}
    </div>
  );
}

export default SeccionPlegable;
