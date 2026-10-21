import { useEffect, useState } from 'react';

// Pantallas de celular y tablet vertical: aquí las tablas se reemplazan por listas compactas con panel de detalle.
const CONSULTA = '(max-width: 768px)';

export const useEsMovil = () => {
  const [esMovil, setEsMovil] = useState(() => typeof window !== 'undefined' && window.matchMedia(CONSULTA).matches);

  useEffect(() => {
    const medida = window.matchMedia(CONSULTA);
    const alCambiar = () => setEsMovil(medida.matches);
    alCambiar();
    medida.addEventListener('change', alCambiar);
    return () => medida.removeEventListener('change', alCambiar);
  }, []);

  return esMovil;
};
