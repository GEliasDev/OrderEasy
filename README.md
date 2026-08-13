# OrderEasy

Sistema de gestión de inventario y punto de venta. Monorepo con backend (API REST) y frontend (SPA).

## Estructura

- [`backend/`](backend/) — API REST (Node.js + Express + Sequelize/PostgreSQL).
- [`frontend/`](frontend/) — SPA (React + Vite).

Cada carpeta tiene su propio `README.md` y `CLAUDE.md` con detalle de comandos y arquitectura.

## Desarrollo local

```bash
# Backend
cd backend
npm install
cp .env.example .env
npm run dev

# Frontend
cd frontend
npm install
cp .env.example .env
npm run dev
```
