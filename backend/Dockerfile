# OrderEasy API — imagen de producción
# Construir:  docker build -t ordereasy-api ./backend
# Ejecutar:   docker run --env-file backend/.env.production -p 3000:3000 ordereasy-api
FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# Dependencias primero (aprovecha la caché de capas). bcrypt y sharp traen binarios precompilados para Linux.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Carpeta de imágenes locales (solo si no se usa Cloudinary; en discos efímeros se pierde al redesplegar)
RUN mkdir -p uploads && chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
