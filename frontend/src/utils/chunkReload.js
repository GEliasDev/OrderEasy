// Errores que significan que un módulo cargado bajo demanda (un chunk) ya no está disponible.
// Pasa, por ejemplo, cuando se despliega una versión nueva y el navegador todavía tiene el index
// anterior, o cuando el servidor de desarrollo se reinicia mientras la pestaña sigue abierta.
const MENSAJES_DE_CARGA = [
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'error loading dynamically imported module',
  'failed to load module script',
  'chunkloaderror',
];

export const esErrorDeCarga = (error) => {
  const mensaje = String(error?.message || error || '').toLowerCase();
  return MENSAJES_DE_CARGA.some((texto) => mensaje.includes(texto));
};

const CLAVE = 'ordereasy:recarga-por-chunk';
const ESPERA_MS = 10000;

// Marca que se va a intentar una recarga. Devuelve false si ya se intentó hace poco,
// para no entrar en un ciclo de recargas.
export const puedeRecargarPorChunk = () => {
  try {
    const ultimo = Number(sessionStorage.getItem(CLAVE) || 0);
    if (ultimo && Date.now() - ultimo < ESPERA_MS) return false;
    sessionStorage.setItem(CLAVE, String(Date.now()));
    return true;
  } catch {
    // Sin sessionStorage no podemos evitar un ciclo: mejor mostrar el aviso que recargar sin control.
    return false;
  }
};

// Recarga una sola vez para buscar los archivos de la versión actual.
export const recargarPorChunk = (demoraMs = 0) => {
  if (!puedeRecargarPorChunk()) return false;
  if (demoraMs > 0) window.setTimeout(() => window.location.reload(), demoraMs);
  else window.location.reload();
  return true;
};

// Si la aplicación lleva un rato funcionando bien, se borra la marca para permitir
// otra recarga automática en el futuro.
export const marcarCargaCorrecta = () => {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    // Sin sessionStorage no hay nada que limpiar.
  }
};
