-- Migración 006: nombre opcional para cada pedido al proveedor.
-- En desarrollo sequelize.sync({ alter: true }) agrega la columna solo. Es idempotente (se puede repetir sin efecto).

BEGIN;

ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS nombre varchar(120);

COMMIT;
