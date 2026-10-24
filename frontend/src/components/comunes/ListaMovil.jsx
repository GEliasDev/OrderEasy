import { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import './comunes.css';

const COLORES = ['#1565C0', '#0F766E', '#7C3AED', '#B45309', '#BE185D', '#475569', '#15803D', '#C2410C'];

// Color estable para cada nombre (el mismo nombre siempre tiene el mismo color)
const colorDe = (texto) => {
  let suma = 0;
  for (const letra of String(texto || '')) suma += letra.charCodeAt(0);
  return COLORES[suma % COLORES.length];
};

const iniciales = (texto) => {
  const palabras = String(texto || '').trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '?';
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[1][0]).toUpperCase();
};

const letraDe = (texto) => {
  const base = String(texto || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase();
  return /[A-Z]/.test(base) ? base : '#';
};

export function Avatar({ nombre, imagen, tamano = 40 }) {
  const [falla, setFalla] = useState(false);
  const estilo = { width: tamano, height: tamano, minWidth: tamano };
  if (imagen && !falla) {
    return <img className="lm-avatar lm-avatar-img" style={estilo} src={imagen} alt="" onError={() => setFalla(true)} />;
  }
  return (
    <span className="lm-avatar" style={{ ...estilo, background: colorDe(nombre), fontSize: tamano * 0.36 }} aria-hidden="true">
      {iniciales(nombre)}
    </span>
  );
}

// Filtros rápidos en forma de botones (Todos, Con saldo...). opciones: [{ id, label }]
export function ChipsFiltro({ opciones, valor, onCambiar }) {
  return (
    <div className="lm-chips" role="tablist">
      {opciones.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={valor === o.id} className={`lm-chip${valor === o.id ? ' lm-chip-activo' : ''}`} onClick={() => onCambiar(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Lista compacta para celular: una fila por elemento (avatar, título, línea secundaria y dato clave), que al tocarla abre su detalle.
 * Muestra los elementos por tandas ("Mostrar más") para que listas largas no obliguen a un scroll interminable.
 *
 * icono?: componente de lucide; con él la fila muestra una cajita cuadrada (para cosas, no personas) en lugar del círculo con iniciales; color? tiñe la cajita.
 * fila(item) => { nombre, imagen?, titulo, subtitulo?, derecha?, derechaSecundaria?, tono?: 'peligro' | 'ok' | 'aviso', insignia? }
 */
function ListaMovil({ items, clave, fila, onAbrir, paso = 30, letras = false, cargando = false, vacio = 'No hay resultados.' }) {
  const [visibles, setVisibles] = useState(paso);

  // Si cambia la búsqueda o el filtro, se vuelve al inicio de la lista
  useEffect(() => { setVisibles(paso); }, [items, paso]);

  const mostrados = useMemo(() => items.slice(0, visibles), [items, visibles]);
  const restantes = items.length - mostrados.length;

  if (cargando) {
    return (
      <div className="lm-lista" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="lm-fila lm-esqueleto"><span className="lm-avatar" /><div className="lm-textos"><i /><i /></div></div>
        ))}
      </div>
    );
  }

  if (items.length === 0) return <div className="lm-vacio">{vacio}</div>;

  let letraActual = null;
  return (
    <div className="lm-lista" role="list">
      {mostrados.map((item) => {
        const datos = fila(item);
        const letra = letras ? letraDe(datos.titulo) : null;
        const cabecera = letras && letra !== letraActual ? letra : null;
        if (letras) letraActual = letra;
        return (
          <div key={clave(item)} role="listitem">
            {cabecera && <div className="lm-letra">{cabecera}</div>}
            <button type="button" className="lm-fila" onClick={() => onAbrir(item)}>
              {datos.icono ? (
                <span className="caja-icono" style={{ '--caja': datos.color }} aria-hidden="true"><datos.icono size={20} /></span>
              ) : (
                <Avatar nombre={datos.nombre ?? datos.titulo} imagen={datos.imagen} />
              )}
              <span className="lm-textos">
                <span className="lm-titulo">{datos.titulo}</span>
                {datos.subtitulo && <span className="lm-subtitulo">{datos.subtitulo}</span>}
              </span>
              {(datos.derecha || datos.insignia) && (
                <span className="lm-derecha">
                  {datos.derecha && <span className={`lm-dato${datos.tono ? ` lm-${datos.tono}` : ''}`}>{datos.derecha}</span>}
                  {datos.derechaSecundaria && <span className="lm-subtitulo">{datos.derechaSecundaria}</span>}
                  {datos.insignia && <span className={`lm-insignia${datos.tono ? ` lm-${datos.tono}` : ''}`}>{datos.insignia}</span>}
                </span>
              )}
              <ChevronRight size={16} className="lm-flecha" aria-hidden="true" />
            </button>
          </div>
        );
      })}
      {restantes > 0 && (
        <button type="button" className="lm-mas" onClick={() => setVisibles((v) => v + paso)}>
          Mostrar más ({restantes} restantes)
        </button>
      )}
    </div>
  );
}

export default ListaMovil;
