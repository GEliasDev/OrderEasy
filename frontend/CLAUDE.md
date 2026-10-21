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
- `src/components/vendedor/dashboard/` — dashboard autenticado: inicio, inventario, productos, categorías, pedidos, balance, estadísticas, clientes, proveedores, usuarios, roles, configuración.
- `src/components/AdminRoute.jsx` / `SeccionRoute.jsx` / `ProtectedRoute.jsx` — guards de rutas: administrador exacto, sección asignada por rol, o solo autenticado. Nota: estas restricciones son solo de UI, el backend no las revalida.
- `src/context/AuthContext.jsx` — sesión (JWT en `localStorage`).
- `src/services/` — clientes Axios por dominio, apuntando a `VITE_API_URL`.

## Pedidos

- `components/vendedor/dashboard/pedidos/DetallePedido.jsx`: el modal **Editar** permite agregar, quitar y cambiar cantidades de productos solo cuando el pedido está `pendiente`; muestra el total recalculado y conserva el precio de los productos que ya estaban en el pedido. En estados posteriores solo permite editar cliente, fecha de entrega y notas.
- `NuevoPedido.jsx` acumula en una sola línea las unidades repetidas del mismo producto.

⚠️ `.env.example` todavía declara `VITE_PREDICCION_URL`, residuo de un módulo de predicción ML eliminado — no lo reintroduzcas sin revisar primero si el módulo se va a reconstruir.
