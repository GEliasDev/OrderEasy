-- Migración 013: cada proveedor se vincula a las categorías que suministra (antes era un texto libre sin uso).
-- Los precios por cantidad solo cuentan las unidades de esas categorías. Es idempotente (se puede repetir sin efecto).
-- La columna vieja proveedor.categoria_suministro se conserva sin usar: de ella solo se copian los nombres que coinciden con una categoría.

BEGIN;

CREATE TABLE IF NOT EXISTS proveedor_categorias (
  proveedorid integer NOT NULL REFERENCES proveedor(proveedorid) ON DELETE CASCADE,
  categoriaid integer NOT NULL REFERENCES categorias(categoriaid) ON DELETE CASCADE,
  PRIMARY KEY (proveedorid, categoriaid)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proveedor' AND column_name = 'categoria_suministro') THEN
    INSERT INTO proveedor_categorias (proveedorid, categoriaid)
    SELECT DISTINCT p.proveedorid, c.categoriaid
    FROM proveedor p
    CROSS JOIN LATERAL unnest(p.categoria_suministro) AS n(nombre)
    JOIN categorias c ON lower(trim(c.nombre)) = lower(trim(n.nombre)) AND c.negocioid = p.negocioid
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

COMMIT;
