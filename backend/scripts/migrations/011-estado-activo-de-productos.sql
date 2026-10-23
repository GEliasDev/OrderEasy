-- Migración 011: los productos tienen estado activo/inactivo (un producto inactivo no se ofrece para vender ni pedir).
-- En desarrollo sequelize.sync({ alter: true }) agrega la columna solo. Es idempotente (se puede repetir sin efecto).

BEGIN;

ALTER TABLE productos ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

COMMIT;
