// En pantallas pequeñas las tablas con la clase `tabla-tarjetas` se muestran como tarjetas (una por fila).
// Cada celda toma su etiqueta del encabezado de su columna: se calcula aquí para no repetirla a mano en cada celda.

export const etiquetarTablas = (raiz = document) => {
  raiz.querySelectorAll('table.tabla-tarjetas').forEach((tabla) => {
    const etiquetas = [...tabla.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    tabla.querySelectorAll('tbody tr').forEach((fila) => {
      [...fila.children].forEach((celda, i) => {
        if (celda.colSpan > 1) return;
        const etiqueta = etiquetas[i];
        if (etiqueta !== undefined && celda.getAttribute('data-label') !== etiqueta) celda.setAttribute('data-label', etiqueta);
      });
    });
  });
};

// Vigila el documento y etiqueta las tablas nuevas o que se vuelven a pintar. Devuelve la función para dejar de vigilar.
export const vigilarTablas = () => {
  let pendiente = false;
  const programar = () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => { pendiente = false; etiquetarTablas(); });
  };
  const observador = new MutationObserver(programar);
  observador.observe(document.body, { childList: true, subtree: true });
  etiquetarTablas();
  return () => observador.disconnect();
};
