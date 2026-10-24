-- Migración 012: precios por cantidad de cada proveedor (desde X unidades pedidas en total, cada unidad cuesta un precio fijo menor).
-- En desarrollo sequelize.sync({ alter: true }) crea la tabla solo. Es idempotente (se puede repetir sin efecto).

BEGIN;

CREATE TABLE IF NOT EXISTS proveedor_precios_escalonados (
  escalonid serial PRIMARY KEY,
  negocioid integer NOT NULL REFERENCES negocios(negocioid),
  proveedorid integer NOT NULL REFERENCES proveedor(proveedorid) ON DELETE CASCADE,
  desde_cantidad double precision NOT NULL,
  precio numeric(10, 2) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS proveedor_precios_escalonados_proveedorid_desde_cantidad
  ON proveedor_precios_escalonados (proveedorid, desde_cantidad);

COMMIT;
