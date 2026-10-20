# Despliegue de OrderEasy

OrderEasy son **dos aplicaciones independientes** que se despliegan por separado:

| Parte | Carpeta | Qué es | Dónde (recomendado) |
|---|---|---|---|
| **API** | `backend/` | Node + Express + Sequelize | Render *Web Service* (o Docker) |
| **Web** | `frontend/` | React + Vite (archivos estáticos) | Render *Static Site* (o Vercel / Netlify / Nginx) |
| **Base de datos** | — | PostgreSQL | Supabase |

`render.yaml` (en la raíz) crea ambos servicios de Render de una vez. Cada servicio tiene su propio `rootDir`, así que se redespliega, escala o reinicia uno sin tocar el otro.

---

## 1. Base de datos (Supabase)

### ¿Se puede crear otra base de datos dentro del proyecto de Debti?

**No otra base de datos, sí una separación interna equivalente.** Un proyecto de Supabase expone **una sola base de datos** (`postgres`); no permite crear más ni el pooler enruta hacia otras. Lo que sí se puede es separar dentro de esa base:

| Opción | Aislamiento | Cambios | Cuándo |
|---|---|---|---|
| **A. Schema propio + rol propio** (preconfigurado) | Tablas separadas (`ordereasy.*`) y un rol que no puede leer ni modificar las tablas de Debti | Ninguno: ya está soportado con `DB_SCHEMA` | Quieres usar el mismo proyecto de Debti sin costo extra |
| **B. Un segundo proyecto de Supabase** | Total (otra base, otras credenciales, otros backups) | Ninguno | Si tu cuenta gratuita aún tiene un proyecto libre (el plan gratis permite 2 activos) |

Los archivos `.env.production` vienen configurados para la **opción A** sobre el proyecto de Debti. Para la opción B basta con cambiar `DB_HOST`, `DB_USER` y `DB_PASSWORD` por los del proyecto nuevo y dejar `DB_SCHEMA` vacío.

**Lo que se comparte en la opción A:** el límite de 500 MB del plan gratuito, las conexiones, la CPU, las copias de seguridad y la pausa por inactividad (si el proyecto se pausa, se pausan las dos apps). Además, los tipos `enum_*` que crea Sequelize quedan en el schema `public` con prefijo `enum_` (no chocan con las tablas de Debti, pero no están dentro de `ordereasy`).

### Pasos (opción A)

1. En Supabase abre el proyecto de Debti → **SQL Editor** → pega el contenido de [`backend/scripts/supabase-setup.sql`](backend/scripts/supabase-setup.sql).
2. **Cambia la clave** `CAMBIA_ESTA_CLAVE_POR_UNA_LARGA_Y_UNICA` por una contraseña larga propia y ejecuta. Crea el schema `ordereasy` y el rol `ordereasy_app`.
3. Esa clave va en `DB_PASSWORD` del backend. El usuario de conexión es `ordereasy_app.<ref-del-proyecto>`; para el proyecto de Debti ya está escrito en `backend/.env.production` (`ordereasy_app.wirudpopjdjhwkfeeybd`).
4. Usa el **pooler en modo sesión** (puerto `5432`), igual que Debti. No uses el modo transacción (`6543`).

No hace falta crear las tablas a mano: al arrancar, el backend crea las tablas y aplica las migraciones (`backend/scripts/migrations/*.sql`) dentro del schema `ordereasy`.

---

## 2. Backend (API)

### Variables de entorno

Los valores listos están en `backend/.env.production` (archivo local, **ignorado por git**). Se copian al panel de la plataforma.

| Variable | Obligatoria | Descripción |
|---|---|---|
| `NODE_ENV` | sí | `production` |
| `DB_HOST` `DB_PORT` `DB_NAME` | sí | Conexión a PostgreSQL (Supabase: pooler en modo sesión, puerto 5432, base `postgres`) |
| `DB_USER` `DB_PASSWORD` | sí | Credenciales del rol `ordereasy_app` |
| `DB_SCHEMA` | opción A | `ordereasy`. Vacío = schema `public` |
| `DB_SSL` | no | Se activa solo si el host no es local; `true`/`false` lo fuerza |
| `JWT_SECRET` | sí | Mínimo 32 caracteres (ya generado, 96) |
| `CORS_ORIGIN` | sí | URL del frontend, sin barra final. Varias separadas por coma |
| `CLOUDINARY_*` | recomendado | Sin Cloudinary las imágenes se guardan en disco y **se pierden en cada redeploy** en Render |
| `OPENROUTER_API_KEY` | no | Asistente de IA |
| `RUN_MIGRATIONS` | no | `true` por defecto: aplica las migraciones al arrancar |
| `PORT` | no | Render lo define solo |

### Render (recomendado)

1. Sube el repositorio a GitHub.
2. Render → **New → Blueprint** → elige el repositorio. Lee `render.yaml` y propone `ordereasy-api` y `ordereasy-web`.
3. Completa las variables marcadas como "sync: false" con los valores de `backend/.env.production`.
4. Verifica: `https://<tu-api>.onrender.com/health` debe responder `{"ok":true,...}`.

> Plan gratuito de Render: el servicio se "duerme" tras 15 min sin tráfico y la primera petición tarda ~30 s en despertar.

### Docker (alternativa)

```bash
docker build -t ordereasy-api ./backend
docker run -d --env-file backend/.env.production -p 3000:3000 ordereasy-api
```

---

## 3. Frontend (Web)

`VITE_API_URL` se **incrusta al compilar**: si cambia la URL de la API hay que volver a compilar/desplegar el frontend.

### Render Static Site (incluido en `render.yaml`)

Variable: `VITE_API_URL=https://<tu-api>.onrender.com` (sin barra final). Build `npm ci && npm run build`, publica `dist`. Las rutas de la SPA (`/dashboard/...`) ya vienen redirigidas a `index.html`.

### Otras opciones

- **Vercel**: Root Directory `frontend`, variable `VITE_API_URL`. `frontend/vercel.json` ya trae las reglas de la SPA.
- **Netlify / Cloudflare Pages**: Base directory `frontend`, build `npm run build`, publish `dist`. `public/_redirects` ya trae la regla de la SPA.
- **Docker + Nginx**:
  ```bash
  docker build --build-arg VITE_API_URL=https://<tu-api> -t ordereasy-web ./frontend
  docker run -d -p 8080:80 ordereasy-web
  ```

---

## 4. Orden de despliegue y verificación

1. Base de datos: ejecutar `supabase-setup.sql` (una vez).
2. Desplegar el **backend** y comprobar `/health`.
3. Con la URL real de la API, poner `VITE_API_URL` y desplegar el **frontend**.
4. Con la URL real del frontend, poner `CORS_ORIGIN` en el backend y reiniciarlo.
5. Abrir el frontend → **Registro**: el primer registro crea el negocio y su administrador.
6. Crear una categoría y un producto con imagen (confirma Cloudinary).

> Los nombres `ordereasy-api` / `ordereasy-web` generan las URLs `https://ordereasy-api.onrender.com` y `https://ordereasy-web.onrender.com` (si el nombre está libre). Si Render te asigna otras, ajusta `CORS_ORIGIN` y `VITE_API_URL`.

### Problemas frecuentes

| Síntoma | Causa |
|---|---|
| El frontend muestra errores de red / CORS | `CORS_ORIGIN` no coincide exactamente con la URL del frontend (con `https://`, sin barra final) |
| `password authentication failed` | `DB_PASSWORD` distinta a la del rol; o el usuario no lleva el `.<ref>` del proyecto |
| `self-signed certificate` | `DB_SSL` en `false` con un host remoto |
| Las imágenes desaparecen tras un redeploy | Falta Cloudinary |
| `permission denied for schema` | No se ejecutó `supabase-setup.sql` completo |
| 429 "Demasiados intentos" en el login | Límite de 20 intentos por 15 min por IP |

---

## 5. Cambios de esquema a futuro

En producción `sequelize.sync()` solo crea tablas faltantes y **nunca altera las existentes**. Los cambios en tablas existentes se escriben como un nuevo archivo `backend/scripts/migrations/00N-nombre.sql` (idempotente) y se aplican solos al arrancar el servidor (o con `npm run migrate`). Se registran en la tabla `schema_migrations`.
