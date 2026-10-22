-- Migración 008: cada pago de una venta guarda su fecha.
-- Las entregas de pedidos se cobran en abonos posteriores: el ingreso se reconoce cuando se recibe el dinero.
-- En desarrollo sequelize.sync({ alter: true }) agrega la columna solo. Es idempotente (se puede repetir sin efecto).

BEGIN;

ALTER TABLE venta_pagos ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Los pagos que ya existían se fechan con la venta a la que pertenecen
UPDATE venta_pagos vp
   SET created_at = v.created_at
  FROM ventas v
 WHERE v.ventaid = vp.ventaid;

COMMIT;
