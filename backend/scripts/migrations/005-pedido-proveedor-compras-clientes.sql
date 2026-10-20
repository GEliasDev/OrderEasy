-- Migración 005: el pedido al proveedor (ordenes_compra) pasa a ser el contenedor de las compras de los clientes (pedidos).
-- En desarrollo sequelize.sync({ alter: true }) agrega la columna y el estado solo; esto agrega la FK y vincula lo anterior.
-- Es idempotente (se puede repetir sin efecto).

BEGIN;

-- Cada compra de cliente pertenece (opcionalmente) a un pedido al proveedor
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS ordenid integer;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_ordenid_fkey') THEN
    ALTER TABLE pedidos ADD CONSTRAINT pedidos_ordenid_fkey
      FOREIGN KEY (ordenid) REFERENCES ordenes_compra(ordenid) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pedidos_ordenid ON pedidos (ordenid);

-- Nuevo estado: el pedido al proveedor se crea "abierta" mientras se le agregan compras de clientes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_ordenes_compra_estado') THEN
    ALTER TYPE enum_ordenes_compra_estado ADD VALUE IF NOT EXISTS 'abierta';
  END IF;
END $$;

-- Las compras de clientes que ya estaban en una orden de compra activa se vinculan a ella
UPDATE pedidos p
   SET ordenid = x.ordenid
  FROM (
    SELECT DISTINCT ON (pd.pedidoid) pd.pedidoid, d.ordenid
      FROM orden_compra_asignaciones a
      JOIN orden_compra_detalles d ON d.detalleid = a.ordendetalleid
      JOIN ordenes_compra o ON o.ordenid = d.ordenid AND o.estado::text <> 'anulada'
      JOIN pedido_detalles pd ON pd.detalleid = a.pedidodetalleid
     ORDER BY pd.pedidoid, d.ordenid
  ) x
 WHERE p.pedidoid = x.pedidoid AND p.ordenid IS NULL;

COMMIT;
