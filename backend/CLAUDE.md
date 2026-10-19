# OrderEasy Backend

API REST del sistema de gestión de inventario y punto de venta **OrderEasy**. Node.js + Express + Sequelize (PostgreSQL), arquitectura multi-tenant (`negocioid` en cada tabla), con un asistente de IA conversacional (OpenRouter) capaz de leer y escribir datos del negocio mediante function calling.

## Comandos de desarrollo

```bash
npm install
cp .env.example .env   # completar DB_*, JWT_SECRET, CLOUDINARY_*, OPENROUTER_*
npm run dev              # nodemon server.js, http://localhost:3000
npm start                 # producción, sin watch
```

No hay script de migraciones ni de seed: el esquema se sincroniza automáticamente vía `sequelize.sync()` en `server.js` (con `alter: true` solo fuera de producción).

## Estructura

- `controllers/` — lógica de negocio por dominio (productos, ventas, egresos, pedidos, órdenes de compra, clientes, proveedores, categorías, roles, usuarios, negocio, chat, balance, stats).
- `models/` — modelos Sequelize, todos con `negocioid` para aislamiento multi-tenant.
- `routes/` — un router por dominio, montado en `server.js`.
- `middleware/authMiddleware.js` — `verificarToken` (JWT) y `verificarAdmin` (rol exacto `administrador`); no hay middleware de autorización por sección/rol dinámico pese a que el modelo `Rol`/`RolSeccion` existe.
- `config/chatTools.js` + `services/chatService.js` + `controllers/chatController.js` — asistente de IA con function calling sobre OpenRouter.
- `utils/cloudinary.js` — procesa imágenes con Sharp (WebP) y las sube a Cloudinary; si Cloudinary falla, las guarda en `backend/uploads/<carpeta>` y devuelve la ruta relativa para servirla desde `/uploads`.

## Pedidos y órdenes de compra

- `PATCH /api/pedidos/:id` edita cliente, fecha de entrega y notas en cualquier estado distinto de `entregado`/`anulado`.
- Si el payload incluye `items`, el pedido debe estar `pendiente`: se reemplazan/combinan las líneas, se conserva el precio unitario original de los productos ya existentes, se recalcula el total y se exige al menos un producto.
- Confirmar un pedido reserva `cantidadReservada`; las órdenes de compra cubren únicamente los faltantes. La edición de productos no está permitida después de confirmar.

## Tallas y unidades de medida

- `productos.usaTallas = true` → el stock vive en `producto_variantes` (una fila por talla, con `cantidadDisponible`/`cantidadReservada`) y `productos.cantidadDisponible/cantidadReservada` guardan el **total** (suma de tallas), así listados y estadísticas no cambian. Sin tallas, el stock sigue en el propio producto.
- Todo movimiento de stock (ventas, egresos, pedidos, órdenes de compra, asistente) pasa por `services/stockService.js`: `resolverStock` / `resolverStockDeDetalle` devuelven el registro que tiene el stock (producto o variante) y `guardarStock` lo actualiza y re-sincroniza el total. No actualizar `cantidadDisponible` directamente en controladores.
- Las líneas de venta, pedido, orden de compra y egreso guardan `talla` y `varianteid`; los items de la API reciben `talla` (obligatoria solo si el producto usa tallas).
- `productos.unidadMedida` (und, par, caja, kg, g, m, l; ver `utils/unidades.js`). Las cantidades son `DOUBLE` y solo kg, g, m y l admiten decimales (se validan en `validarCantidad`).
- Producción no altera el esquema automáticamente: aplicar `scripts/migrations/001-tallas-y-unidades.sql` (idempotente).
