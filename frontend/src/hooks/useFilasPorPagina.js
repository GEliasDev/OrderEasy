import { useEffect, useRef, useState } from 'react';

const MIN_FILAS = 5;

/**
 * Calcula cuántas filas de una tabla caben en el alto disponible, para que cada
 * página de la paginación llene la tabla hasta abajo sin hacer scroll.
 *
 * Uso: poner `ref={wrapRef}` en el contenedor de la tabla (el que tiene el alto),
 * `data-fila` en cada <tr> de datos y la clase `X-table-llena` en la tabla cuando
 * `medido` sea true y la página tenga `filasPorPagina` filas.
 *
 * @param {number} dependencia  cantidad de registros: re-mide cuando llegan los datos
 * @param {number} filasMovil   filas por página cuando la tabla se muestra como tarjetas (móvil)
 */
export function useFilasPorPagina(dependencia, filasMovil = 10) {
  const wrapRef = useRef(null);
  const altoFilaRef = useRef(0);
  const [filasPorPagina, setFilasPorPagina] = useState(filasMovil);
  const [medido, setMedido] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const medir = () => {
      const thead = wrap.querySelector('thead');
      if (!thead || getComputedStyle(thead).display === 'none') {
        setFilasPorPagina(filasMovil); // móvil: tarjetas apiladas, la página hace scroll
        setMedido(false);
        return;
      }
      if (!altoFilaRef.current) {
        const fila = wrap.querySelector('tbody tr[data-fila]');
        if (!fila) return; // aún no hay filas para medir; se reintenta cuando lleguen los datos
        altoFilaRef.current = fila.getBoundingClientRect().height;
      }
      const disponible = wrap.clientHeight - thead.getBoundingClientRect().height;
      const filas = Math.max(MIN_FILAS, Math.floor(disponible / altoFilaRef.current));
      setFilasPorPagina((prev) => (prev === filas ? prev : filas));
      setMedido(true);
    };

    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [dependencia, filasMovil]);

  return { wrapRef, filasPorPagina, medido };
}
