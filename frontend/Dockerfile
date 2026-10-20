# OrderEasy Web — imagen de producción (Vite compila; Nginx sirve los archivos estáticos)
# Construir:  docker build --build-arg VITE_API_URL=https://ordereasy-api.onrender.com -t ordereasy-web ./frontend
# Ejecutar:   docker run -p 8080:80 ordereasy-web
#
# VITE_API_URL se incrusta al compilar: si cambia la URL del backend hay que volver a construir la imagen.
# Con VITE_API_URL vacío (--build-arg VITE_API_URL=) el frontend llama a rutas relativas (misma dominio / proxy).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://127.0.0.1/ || exit 1
