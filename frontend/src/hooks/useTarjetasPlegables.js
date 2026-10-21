import { useEffect } from 'react';

// Convierte las tarjetas `.form-card-minimal` de un formulario en secciones plegables (solo celular).
// `cerradas` = posiciones (0, 1, 2...) de las tarjetas que empiezan plegadas. Tocar el título las abre o cierra.
export const useTarjetasPlegables = (ref, { activo, cerradas = [] }) => {
  useEffect(() => {
    const raiz = ref.current;
    if (!raiz) return undefined;
    const tarjetas = [...raiz.querySelectorAll('.form-card-minimal')];
    if (!activo) {
      tarjetas.forEach((t) => { t.classList.remove('plegable', 'plegada'); delete t.dataset.plInit; });
      return undefined;
    }
    tarjetas.forEach((t, i) => {
      t.classList.add('plegable');
      if (!t.dataset.plInit) {
        t.dataset.plInit = '1';
        if (cerradas.includes(i)) t.classList.add('plegada');
      }
    });
    const alTocar = (e) => {
      const cabecera = e.target.closest('.card-header-minimal');
      if (cabecera && raiz.contains(cabecera)) cabecera.parentElement.classList.toggle('plegada');
    };
    raiz.addEventListener('click', alTocar);
    return () => raiz.removeEventListener('click', alTocar);
  });
};
