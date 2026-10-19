-- Migración 003: compra al proveedor por lote (reparto de lo comprado entre los clientes de los pedidos).
-- En desarrollo sequelize.sync({ alter: true }) crea la tabla sola.
-- En producción: psql -U <usuario> -d <base> -f scripts/migrations/003-compras-por-lote.sql
-- Es idempotente (se puede repetir sin efecto).

BEGIN;

CREATE TABLE IF NOT EXISTS orden_compra_asignaciones (
  asignacionid     serial PRIMARY KEY,
  ordendetalleid   integer NOT NULL REFERENCES orden_compra_detalles(detalleid) ON DELETE CASCADE,
  pedidodetalleid  integer NOT NULL REFERENCES pedido_detalles(detalleid) ON DELETE CASCADE,
  cantidad         double precision NOT NULL,
  cantidad_recibida double precision NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS orden_compra_asignaciones_ordendetalleid_pedidodetalleid
  ON orden_compra_asignaciones (ordendetalleid, pedidodetalleid);

-- Las órdenes de compra anteriores (una por pedido) se vinculan a las líneas de su pedido
-- (mismo producto y talla) para que aparezcan en el reparto por cliente.
INSERT INTO orden_compra_asignaciones (ordendetalleid, pedidodetalleid, cantidad, cantidad_recibida)
SELECT d.detalleid, pd.detalleid, d.cantidad, d.cantidad_recibida
  FROM orden_compra_detalles d
  JOIN ordenes_compra o ON o.ordenid = d.ordenid AND o.pedidoid IS NOT NULL
  JOIN pedido_detalles pd ON pd.pedidoid = o.pedidoid
   AND pd.productoid = d.productoid
   AND COALESCE(pd.varianteid, 0) = COALESCE(d.varianteid, 0)
ON CONFLICT DO NOTHING;

COMMIT;
