import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Avatar } from './ListaMovil';
import './comunes.css';

// Fila "etiqueta: valor" del panel. Si no hay valor no se muestra.
export function DatoPanel({ etiqueta, valor, tono, enlace }) {
  if (valor === undefined || valor === null || valor === '') return null;
  return (
    <div className="pi-dato">
      <span className="pi-etiqueta">{etiqueta}</span>
      {enlace ? <a href={enlace} className="pi-valor pi-enlace">{valor}</a> : <span className={`pi-valor${tono ? ` lm-${tono}` : ''}`}>{valor}</span>}
    </div>
  );
}

/**
 * Panel que sube desde abajo con el detalle de un elemento y sus acciones (patrón estándar en celular).
 * Se cierra con la X, tocando fuera o con Escape.
 */
function PanelInferior({ abierto, onCerrar, titulo, subtitulo, nombreAvatar, imagen, children, acciones }) {
  useEffect(() => {
    if (!abierto) return undefined;
    const alTeclear = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return createPortal(
    <div className="pi-fondo" onClick={onCerrar}>
      <div className="pi-panel" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="pi-asa" aria-hidden="true" />
        <div className="pi-cabecera">
          <Avatar nombre={nombreAvatar ?? titulo} imagen={imagen} tamano={48} />
          <div className="pi-titulos">
            <h3>{titulo}</h3>
            {subtitulo && <span>{subtitulo}</span>}
          </div>
          <button type="button" className="pi-cerrar" onClick={onCerrar} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="pi-cuerpo">{children}</div>
        {acciones && <div className="pi-acciones">{acciones}</div>}
      </div>
    </div>,
    document.body,
  );
}

export default PanelInferior;
