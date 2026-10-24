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

Para las páginas públicas (login, registro y landing) se agrega `--publica` y se escriben los nombres sin barra: `node scripts/capturas.cjs login registro landing --publica`. Para páginas con scroll interno sirven los tamaños `largo` y `movillargo`.

Genera capturas en `capturas/` (ignorada por git) y avisa de desbordes horizontales y errores de consola. Usa la cuenta de prueba `gvaldelamar2003@gmail.com`; se puede cambiar con `CAPTURAS_CORREO` y `CAPTURAS_CLAVE`. Si Playwright no está instalado en el proyecto, se busca en la carpeta que indique `PLAYWRIGHT_DIR`.

## Módulos rediseñados

| Módulo | Ruta | Qué cambió |
|---|---|---|
| Estadísticas | `/dashboard/estadisticas` | Selector de año segmentado, 4 indicadores con tendencia, franja de datos complementarios, flujo de caja combinado (barras y balance acumulado), ranking de categorías y de productos, estados de carga, vacío y error. |
| Balance | `/dashboard/balance` | Encabezado con acciones, período segmentado con el rango de fechas, 4 indicadores (balance destacado), pestañas Ingresos/Egresos, tablas con filtros etiquetados, buscador con icono y paginación. Estilos de las tablas anidados bajo `.tabla-container`. |
| Clientes | `/dashboard/clientes` | Resumen (registrados, con saldo, total por cobrar), búsqueda con filtro de saldo en todas las pantallas, columna "Por cobrar", crear y editar como página (`/clientes/nuevo`, `/clientes/:id/editar`) en lugar de ventana emergente. Estilos compartidos en `comunes/contactos.css` (también sirve a Usuarios, Roles y Perfil: página, tabla, tarjetas de formulario y botones). |
| Proveedores | `/dashboard/proveedores` | Resumen (registrados, activos, inactivos), filtro por estado, crear y editar como página (`/proveedores/nuevo`, `/proveedores/:id/editar`) con tarjetas de datos generales, contacto y datos bancarios. |
| Configuración | `/dashboard/configuracion` | Ficha de la empresa con logo y datos, accesos a Personal, Roles y permisos y Mi perfil, a todo el ancho. |
| Usuarios (Personal) | `/dashboard/usuarios` | Resumen (usuarios, administradores, sin rol), tabla con rol en etiqueta, crear y editar como página (`/usuarios/nuevo`, `/usuarios/:id/editar`) con tarjetas de datos personales y acceso. |
| Roles y permisos | `/dashboard/roles` | Tarjetas por rol con sus secciones, estado vacío con acción, crear y editar como página (`/roles/nuevo`, `/roles/:id/editar`) con casillas accesibles y "Seleccionar todas". |
| Mi perfil | `/dashboard/perfil` | Resumen de la cuenta, tarjetas "Mis datos" y "Información de la empresa" con el bloque del logo, a todo el ancho y apiladas en móvil. |
| Inicio | `/dashboard/inicio` | Saludo con accesos rápidos (venta, pedido, egreso), 5 indicadores (ventas hoy, balance del mes, por cobrar, productos, stock crítico), gráfica de ventas de los últimos 7 días, stock crítico y últimas ventas clicables. Los ingresos usan lo cobrado, igual que Balance; el stock crítico ignora productos inactivos. |
| Categorías | `/dashboard/categorias` | Resumen (categorías, con y sin productos), búsqueda, tabla con conteo de productos, crear y editar como página (`/categorias/nueva`, `/categorias/:id/editar`). |
| Productos | `/dashboard/productos` | Resumen (productos, valor del inventario a costo, stock bajo, sin stock), filtros por categoría, estado y stock, exportación a Excel, tabla con miniaturas y filas clicables. |
| Menú lateral y barra superior | todas las pantallas | Menú con ficha del negocio (logo y nombre), opciones activas también en subpantallas (por ejemplo Balance en Registrar venta), `aria-current`, panel móvil con Esc, sin scroll de fondo y oculto al teclado cuando está cerrado. Barra con el nombre de la pantalla, menú de cuenta accesible (Esc, `aria-expanded`), objetivos de 44 px en móvil y enlace "Saltar al contenido". Buscador Ctrl+K con roles de diálogo y combobox. |
| Carrito de venta y de egreso | `/dashboard/nueva-venta`, `/dashboard/nuevo-egreso` | Pantalla compartida `comunes/CarritoPantalla.jsx`: catálogo con fotos que se desplaza, tarjetas con la cantidad ya agregada, carrito fijo a la derecha con total y botón siempre visibles, hoja inferior en celular (Esc la cierra), botones y cantidades accesibles. Los estilos (`CartStyles.css`) también los usa el carrito de compras de Pedidos. |
| Iniciar sesión y Registro | `/login`, `/registro` | Marco compartido `login/AuthLayout.jsx` con panel de marca (sin imágenes externas), campos con etiqueta, mostrar y ocultar contraseña, `autocomplete`, error junto al campo, formulario de registro en dos grupos. |
| Landing pública | `/` | Clases propias con prefijo `land-` (antes chocaban con el panel), "Cómo funciona" en lugar de testimonios, textos ajustados a lo que el sistema hace, pie con enlaces reales, `main`, foco visible y respeto de "reducir movimiento". |
| Listado de Pedidos | `/dashboard/pedidos` | Cada pedido lleva una cajita cuadrada azul con ícono de paquete, para no confundirlo con las personas (círculo con iniciales). El número va en la línea secundaria. Igual en escritorio y celular (`caja-icono` en `comunes.css`). |
| Detalle del pedido (dentro de Pedidos) | `/dashboard/pedidos/:id` | Una fila compacta por compra (cliente, estado, total, abonado y saldo) que abre el detalle de la compra, donde se gestiona todo. Crear compra, Enviar al proveedor y Registrar recepción como botones a la vista; el resto en el menú "Pedido" (panel inferior en celular). Encabezados "Pedidos para clientes" y "Pedidos para stock", sin descripción. |
| Detalle de la compra (dentro de Pedidos) | `/dashboard/pedido/:id` | Una sola franja de datos (cliente y entrega, total, abonado, saldo y a favor), tabla de productos con Pidió, Llegó, Entregado y Situación, botón Devolución por producto, entregas realizadas y abonos con su recibo. Solo Entregar y Abonar a la vista; el resto en el menú Más (panel inferior en celular). Sin la sección "Pedido al proveedor" ni datos repetidos. |
| Comprobante de compra (dentro de Pedidos) | `/dashboard/pedido/:id/comprobante` | Solo el recibo de la compra: negocio, cliente, productos con precio y total (en números y letras). Sin abonos, saldos ni saldo a favor: el estado de cuenta será un documento aparte, pendiente. Botón "Comprobante de Compra" a la vista en el detalle de la compra (ya no está en el menú Más); se envía por WhatsApp, PDF, imagen o impresión. |
| Recibo de abono (dentro de Pedidos) | `/dashboard/pedido/:id/recibo/:pagoid` | Cabecera con logo y datos del negocio, importe en números y letras, resumen con saldo, listo para imprimir y exportar. |

## Módulos pendientes de rediseño

No tienen rediseño registrado todavía. Se aplican las reglas de arriba.

| Módulo | Ruta |
|---|---|
| Inventario (tarjetas, crear y editar producto, detalle) | `/dashboard/inventario` |
| Pedidos (lista, detalle, crear pedido al proveedor, carrito) | `/dashboard/pedidos` |

## Datos de ejemplo en la base local

También hay 3 roles (Cajero, Supervisor, Bodega) y 3 usuarios con correo `@demo.local` para ver Personal y Roles con contenido.

Para revisar Balance y Estadísticas con movimiento hay ventas y egresos de ejemplo en la cuenta de prueba, todos con la descripción que empieza por `[demo]`. Se pueden borrar filtrando por ese texto en `ventas` y `egresos` (y sus detalles y pagos).
