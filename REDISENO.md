# Rediseño de la interfaz

Registro de los módulos que ya se rediseñaron y de los que faltan. Se actualiza cada vez que se termina un módulo.

## Reglas de todo rediseño

1. **Responsive siempre.** Se revisa en 1920, 1440, 820 y 375 px de ancho, y en modo oscuro (escritorio y móvil). Sin desborde horizontal.
2. **Ancho completo.** El contenido usa todo el ancho disponible junto al menú lateral; no se fija un `max-width` en la página.
3. **Tokens del proyecto.** Colores, radios y sombras salen de `var(--color-*)`, `var(--neutral-*)`, `var(--surface)`, `var(--radius-*)` y `var(--shadow-*)` (`frontend/src/index.css`), así que el modo oscuro funciona solo. Nada de colores fijos en los componentes.
4. **Estilos con prefijo propio por módulo** (`stats-`, `bal-`...) o anidados bajo el contenedor del módulo, para no pisar a otras pantallas.
5. **Accesibilidad básica:** foco visible, objetivos táctiles de 44 px en móvil, `aria-label` en controles sin texto, tabla equivalente para las gráficas, contraste 4.5:1 y respeto de `prefers-reduced-motion`.
6. **Estados completos:** carga (esqueleto), vacío y error con reintento.
7. **Gráficas:** azul y ámbar para ingresos y egresos (se distinguen con daltonismo), cifras abreviadas en los ejes ($1,2 M) y tooltip con el detalle.
8. **Se revisa con Playwright** antes de dar un módulo por terminado (ver abajo).

## Cómo revisar con Playwright

Con el backend en `:3000` y el frontend en `:5173` (`npm run dev` en cada uno):

```bash
node scripts/capturas.cjs dashboard/balance
node scripts/capturas.cjs dashboard/balance dashboard/estadisticas --tamanos=movil,escritorio --sin-oscuro
```

Genera capturas en `capturas/` (ignorada por git) y avisa de desbordes horizontales y errores de consola. Usa la cuenta de prueba `gvaldelamar2003@gmail.com`; se puede cambiar con `CAPTURAS_CORREO` y `CAPTURAS_CLAVE`. Si Playwright no está instalado en el proyecto, se busca en la carpeta que indique `PLAYWRIGHT_DIR`.

## Módulos rediseñados

| Módulo | Ruta | Qué cambió |
|---|---|---|
| Estadísticas | `/dashboard/estadisticas` | Selector de año segmentado, 4 indicadores con tendencia, franja de datos complementarios, flujo de caja combinado (barras y balance acumulado), ranking de categorías y de productos, estados de carga, vacío y error. |
| Balance | `/dashboard/balance` | Encabezado con acciones, período segmentado con el rango de fechas, 4 indicadores (balance destacado), pestañas Ingresos/Egresos, tablas con filtros etiquetados, buscador con icono y paginación. Estilos de las tablas anidados bajo `.tabla-container`. |
| Clientes | `/dashboard/clientes` | Resumen (registrados, con saldo, total por cobrar), búsqueda con filtro de saldo en todas las pantallas, columna "Por cobrar", crear y editar como página (`/clientes/nuevo`, `/clientes/:id/editar`) en lugar de ventana emergente. Estilos compartidos en `comunes/contactos.css`. |
| Proveedores | `/dashboard/proveedores` | Resumen (registrados, activos, inactivos), filtro por estado, crear y editar como página (`/proveedores/nuevo`, `/proveedores/:id/editar`) con tarjetas de datos generales, contacto y datos bancarios. |
| Configuración | `/dashboard/configuracion` | Ficha de la empresa con logo y datos, accesos a Personal, Roles y permisos y Mi perfil, a todo el ancho. |
| Recibo de abono (dentro de Pedidos) | `/dashboard/pedido/:id/recibo/:pagoid` | Cabecera con logo y datos del negocio, importe en números y letras, resumen con saldo, listo para imprimir y exportar. |

## Módulos pendientes de rediseño

No tienen rediseño registrado todavía. Se aplican las reglas de arriba.

| Módulo | Ruta |
|---|---|
| Inicio | `/dashboard/inicio` |
| Inventario (tarjetas, crear y editar producto, detalle) | `/dashboard/inventario` |
| Productos (tabla) | `/dashboard/productos` |
| Categorías | `/dashboard/categorias` |
| Pedidos (lista, detalle, crear pedido al proveedor, carrito) | `/dashboard/pedidos` |
| Registrar venta y egreso (carrito del Balance) | `/dashboard/nueva-venta`, `/dashboard/nuevo-egreso` |
| Mi perfil | `/dashboard/perfil` |
| Usuarios y roles | `/dashboard/usuarios`, `/dashboard/roles` |
| Navbar y menú lateral | todas las pantallas |
| Login y registro | `/login`, `/registro` |
| Landing pública | `/` |

## Datos de ejemplo en la base local

Para revisar Balance y Estadísticas con movimiento hay ventas y egresos de ejemplo en la cuenta de prueba, todos con la descripción que empieza por `[demo]`. Se pueden borrar filtrando por ese texto en `ventas` y `egresos` (y sus detalles y pagos).
