// Configuración del frontend que depende del entorno (se resuelve al compilar con Vite).
//
//  - Desarrollo: sin VITE_API_URL el frontend busca el backend en el mismo equipo, puerto 3000.
//  - Producción: VITE_API_URL debe apuntar al backend (ej. https://ordereasy-api.onrender.com), sin barra final.
//    Si el frontend y el backend se sirven desde el mismo dominio (proxy), VITE_API_URL puede ir vacío ("")
//    y las peticiones usan rutas relativas.

const desdeEntorno = import.meta.env.VITE_API_URL;

if (import.meta.env.PROD && desdeEntorno === undefined) {
  // Evita publicar una compilación que llame a localhost por descuido
  console.error('VITE_API_URL no está definida: define la URL del backend antes de compilar (npm run build).');
}

export const API_URL = (desdeEntorno ?? `http://${window.location.hostname}:3000`).replace(/\/+$/, '');

// URL de una imagen de producto: Cloudinary y blobs vienen completas; las guardadas en el servidor son rutas relativas
export const imagenUrl = (ruta) => {
  if (!ruta) return '/images/default-product.png';
  if (/^(https?:|blob:|data:)/.test(ruta)) return ruta;
  return `${API_URL}/uploads/${ruta}`;
};
