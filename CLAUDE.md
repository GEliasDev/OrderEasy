# OrderEasy

Monorepo de gestión de inventario y punto de venta. `backend/` (Node + Express + Sequelize/PostgreSQL) y `frontend/` (React + Vite). Detalle de cada parte en `backend/CLAUDE.md` y `frontend/CLAUDE.md`; despliegue en `DEPLOY.md`.

## Ahorro de contexto

- No leer ni buscar dentro de `node_modules/`, `frontend/dist/`, `backend/uploads/` ni `shots/` (capturas). Al usar Glob/Grep, excluirlos.
- Buscar primero con Grep y leer solo el rango necesario; los componentes grandes están en `frontend/src/components/vendedor/dashboard/<modulo>/`.
- Antes de explorar, mirar el mapa de abajo.

## Mapa rápido

| Tema | Backend | Frontend |
|---|---|---|
| Productos | `controllers/productController.js`, `models/productModel.js` | `dashboard/inventario/` (tarjetas, crear, editar, detalle), `dashboard/productos/` (tabla) |
| Stock y tallas | `services/stockService.js`, `models/varianteModel.js` | `inventario/vistas/StockSection.jsx`, `utils/unidades.js` |
| Pedidos | `controllers/pedidoController.js` | `dashboard/pedidos/` |
| Ventas/egresos | controladores de ventas y egresos | `dashboard/balance/` |
| API cliente | `routes/*.js` | `src/services/*.js` (Axios) |

## Convenciones

- Código, textos de UI y mensajes en español.
- Columnas en BD: snake_case (`underscored: true`); en modelos y API: camelCase.
- Todo se filtra por `negocioid` (multi-tenant).
- El stock se mueve solo con `services/stockService.js`; nunca actualizar `cantidadDisponible` directo en controladores.
- Cambios de esquema = nueva migración idempotente en `backend/scripts/migrations/00N-*.sql` (en producción `sync()` no altera tablas).
- Formularios y acciones van como rutas completas, no como modales. El carrito usa panel derecho fijo.
- Estado del producto: `productos.activo` (por defecto `true`). Los inactivos siguen en el inventario pero no se ofrecen en pedidos ni ingresos.

## Git

- Un commit por cambio, mensajes en español (`feat(area): ...`, `fix(area): ...`).
- Autor `GEliasDev`: `git -c user.name=GEliasDev -c user.email=gvaldelamar2003@outlook.com commit`. No tocar la config global.
- Sin coautores ni referencias a herramientas de IA en mensajes ni en descripciones.
- No hacer push salvo que se pida.

## Verificar

- Frontend: `cd frontend && npx vite build`.
- Backend: `cd backend && npm run dev`; las migraciones corren al arrancar.
