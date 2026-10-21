import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { recargarPorChunk, marcarCargaCorrecta } from './utils/chunkReload'

// Vite avisa cuando un módulo precargado ya no se pudo descargar (por ejemplo,
// después de un despliegue o de un reinicio del servidor de desarrollo).
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  recargarPorChunk()
})

// Si la aplicación se mantiene funcionando, permitimos otra recarga automática en el futuro.
window.setTimeout(marcarCargaCorrecta, 30000)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
