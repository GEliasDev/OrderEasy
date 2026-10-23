-- Migración 010: cada línea de una compra de cliente guarda el precio de compra (costo al proveedor) vigente al crearla.
-- Así, cambiar el precio de compra en el inventario no altera lo que cuesta un pedido ya armado.
-- En desarrollo sequelize.sync({ alter: true }) agrega la columna solo. Es idempotente (se puede repetir sin efecto).

BEGIN;

ALTER TABLE pedido_detalles ADD COLUMN IF NOT EXISTS precio_compra numeric(10,2);

-- Las líneas que ya existían toman el precio de compra actual del producto (es el único dato disponible)
UPDATE pedido_detalles d
   SET precio_compra = p.precio_compra
  FROM productos p
 WHERE p.productoid = d.productoid AND d.precio_compra IS NULL;

COMMIT;
