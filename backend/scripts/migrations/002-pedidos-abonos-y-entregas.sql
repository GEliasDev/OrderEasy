-- Migración 002: abonos, devoluciones y entregas parciales de pedidos.
-- En desarrollo sequelize.sync({ alter: true }) aplica estos cambios solo.
-- En producción: psql -U <usuario> -d <base> -f scripts/migrations/002-pedidos-abonos-y-entregas.sql
-- Es idempotente (se puede repetir sin efecto).

BEGIN;

-- Cuánto de cada línea del pedido ya se entregó
ALTER TABLE pedido_detalles ADD COLUMN IF NOT EXISTS cantidad_entregada double precision NOT NULL DEFAULT 0;
-- Los pedidos ya entregados tenían todo entregado
UPDATE pedido_detalles d SET cantidad_entregada = d.cantidad
  FROM pedidos p WHERE p.pedidoid = d.pedidoid AND p.estado = 'entregado' AND d.cantidad_entregada = 0;

-- Una venta puede venir de la entrega (total o parcial) de un pedido
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS pedidoid integer;
UPDATE ventas v SET pedidoid = p.pedidoid FROM pedidos p WHERE p.ventaid = v.ventaid AND v.pedidoid IS NULL;

-- Abonos, devoluciones y traslados de saldo a favor
DO $$ BEGIN
  CREATE TYPE enum_pedido_pagos_tipo AS ENUM ('abono', 'devolucion', 'traslado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE enum_pedido_pagos_metodo AS ENUM ('efectivo', 'tarjeta', 'transferencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS pedido_pagos (
  pagoid          serial PRIMARY KEY,
  pedidoid        integer NOT NULL REFERENCES pedidos(pedidoid) ON DELETE CASCADE,
  negocioid       integer REFERENCES negocios(negocioid),
  usuarioid       integer REFERENCES usuarios(usuarioid),
  tipo            enum_pedido_pagos_tipo NOT NULL,
  metodo          enum_pedido_pagos_metodo NOT NULL,
  monto           numeric(12,2) NOT NULL,
  monto_aplicado  numeric(12,2) NOT NULL DEFAULT 0,
  monto_devuelto  numeric(12,2) NOT NULL DEFAULT 0,
  nota            varchar(255),
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pedido_pagos_pedidoid ON pedido_pagos (pedidoid);

COMMIT;
