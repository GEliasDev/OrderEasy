-- Migración 001: productos por talla y unidades de medida con decimales.
-- En desarrollo (NODE_ENV != production) sequelize.sync({ alter: true }) aplica estos cambios solo.
-- En producción el esquema no se altera automáticamente: ejecutar este script una vez
--   psql -U <usuario> -d <base> -f scripts/migrations/001-tallas-y-unidades.sql
-- Es idempotente (se puede repetir sin efecto).

BEGIN;

-- Stock decimal + unidad de medida + bandera de tallas
ALTER TABLE productos ALTER COLUMN cantidad_disponible TYPE double precision;
ALTER TABLE productos ALTER COLUMN cantidad_reservada TYPE double precision;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS unidad_medida varchar(10) NOT NULL DEFAULT 'und';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS usa_tallas boolean NOT NULL DEFAULT false;

-- Stock por talla
CREATE TABLE IF NOT EXISTS producto_variantes (
  varianteid          serial PRIMARY KEY,
  productoid          integer NOT NULL REFERENCES productos(productoid) ON DELETE CASCADE,
  negocioid           integer REFERENCES negocios(negocioid),
  talla               varchar(20) NOT NULL,
  cantidad_disponible double precision NOT NULL DEFAULT 0,
  cantidad_reservada  double precision NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS producto_variantes_productoid_talla ON producto_variantes (productoid, talla);

-- Talla y cantidades decimales en los detalles de venta, pedido, orden de compra y egreso
ALTER TABLE venta_detalles ALTER COLUMN cantidad TYPE double precision;
ALTER TABLE venta_detalles ADD COLUMN IF NOT EXISTS talla varchar(20);
ALTER TABLE venta_detalles ADD COLUMN IF NOT EXISTS varianteid integer;

ALTER TABLE pedido_detalles ALTER COLUMN cantidad TYPE double precision;
ALTER TABLE pedido_detalles ADD COLUMN IF NOT EXISTS talla varchar(20);
ALTER TABLE pedido_detalles ADD COLUMN IF NOT EXISTS varianteid integer;

ALTER TABLE orden_compra_detalles ALTER COLUMN cantidad TYPE double precision;
ALTER TABLE orden_compra_detalles ALTER COLUMN cantidad_recibida TYPE double precision;
ALTER TABLE orden_compra_detalles ADD COLUMN IF NOT EXISTS talla varchar(20);
ALTER TABLE orden_compra_detalles ADD COLUMN IF NOT EXISTS varianteid integer;

ALTER TABLE egreso_detalles ALTER COLUMN cantidad TYPE double precision;
ALTER TABLE egreso_detalles ADD COLUMN IF NOT EXISTS talla varchar(20);
ALTER TABLE egreso_detalles ADD COLUMN IF NOT EXISTS varianteid integer;

COMMIT;
