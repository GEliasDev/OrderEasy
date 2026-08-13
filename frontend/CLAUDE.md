# OrderEasy Frontend

SPA en React del sistema de gestión de inventario y punto de venta **OrderEasy**. Consume la API de `backend/` (mismo repositorio).

## Comandos de desarrollo

```bash
npm install
cp .env.example .env   # VITE_API_URL, por defecto localhost:3000
npm run dev              # Vite dev server
npm run build             # build de producción a dist/
npm run lint               # ESLint
npm run preview             # sirve el build de dist/ localmente
```

## Estructura

- `src/components/inicio/landing.jsx` — landing page pública.
- `src/components/vendedor/dashboard/` — dashboard autenticado: inventario, productos, categorías, caja (POS), balance, estadísticas, clientes, proveedores, usuarios, roles, configuración.
- `src/components/chat/` — UI del asistente de IA conversacional (streaming SSE, flujo de confirmación para acciones críticas).
- `src/components/AdminRoute.jsx` / `SeccionRoute.jsx` / `ProtectedRoute.jsx` — guards de rutas: administrador exacto, sección asignada por rol, o solo autenticado. Nota: estas restricciones son solo de UI, el backend no las revalida.
- `src/context/AuthContext.jsx` — sesión (JWT en `localStorage`), `src/context/ChatContext.jsx` — estado del asistente de IA.
- `src/services/` — clientes Axios por dominio, apuntando a `VITE_API_URL`.

⚠️ `.env.example` todavía declara `VITE_PREDICCION_URL`, residuo de un módulo de predicción ML eliminado — no lo reintroduzcas sin revisar primero si el módulo se va a reconstruir.
