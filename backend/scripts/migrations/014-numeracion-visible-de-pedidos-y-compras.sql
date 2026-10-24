-- Migración 014: numeración visible y consecutiva por negocio.
-- Pedidos al proveedor (ordenes_compra) y compras de clientes (pedidos) reciben un `numero` propio del negocio (1, 2, 3...),
-- distinto del id interno, que deja de mostrarse. Lo existente se numera por fecha de creación.
-- Los contadores viven en negocios para no reutilizar nunca un número aunque se elimine un documento.
-- Es idempotente (se puede repetir sin efecto).

BEGIN;

ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS numero integer;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS numero integer;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS ultimo_numero_pedido integer NOT NULL DEFAULT 0;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS ultimo_numero_compra integer NOT NULL DEFAULT 0;

-- Numera lo que aún no tiene número, a continuación del mayor existente de cada negocio
UPDATE ordenes_compra o SET numero = x.n
FROM (
  SELECT ordenid, coalesce(max(numero) OVER (PARTITION BY negocioid), 0) + row_number() OVER (PARTITION BY negocioid ORDER BY created_at, ordenid) AS n
  FROM ordenes_compra
) x
WHERE o.ordenid = x.ordenid AND o.numero IS NULL AND NOT EXISTS (SELECT 1 FROM ordenes_compra y WHERE y.negocioid = o.negocioid AND y.numero IS NOT NULL);

UPDATE pedidos o SET numero = x.n
FROM (
  SELECT pedidoid, coalesce(max(numero) OVER (PARTITION BY negocioid), 0) + row_number() OVER (PARTITION BY negocioid ORDER BY created_at, pedidoid) AS n
  FROM pedidos
) x
WHERE o.pedidoid = x.pedidoid AND o.numero IS NULL AND NOT EXISTS (SELECT 1 FROM pedidos y WHERE y.negocioid = o.negocioid AND y.numero IS NOT NULL);

UPDATE negocios n SET ultimo_numero_pedido = greatest(n.ultimo_numero_pedido, coalesce((SELECT max(numero) FROM ordenes_compra o WHERE o.negocioid = n.negocioid), 0));
UPDATE negocios n SET ultimo_numero_compra = greatest(n.ultimo_numero_compra, coalesce((SELECT max(numero) FROM pedidos p WHERE p.negocioid = n.negocioid), 0));

CREATE UNIQUE INDEX IF NOT EXISTS ordenes_compra_negocio_numero ON ordenes_compra (negocioid, numero);
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_negocio_numero ON pedidos (negocioid, numero);

-- Textos guardados que mostraban el id interno
UPDATE ventas v SET descripcion = 'Compra ' || p.numero
FROM pedidos p WHERE v.pedidoid = p.pedidoid AND v.descripcion = 'Pedido #' || p.pedidoid;

UPDATE egresos e SET descripcion = 'Recepción del pedido ' || o.numero
FROM ordenes_compra o WHERE e.egresoid = o.egresoid AND e.descripcion = 'Recepción orden de compra #' || o.ordenid;

COMMIT;
