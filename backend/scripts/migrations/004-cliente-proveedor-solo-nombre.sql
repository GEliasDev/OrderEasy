-- Migración 004: clientes y proveedores se pueden crear solo con el nombre.
-- En desarrollo sequelize.sync({ alter: true }) aplica estos cambios solo; en producción corre al arrancar el servidor
-- (o con: npm run migrate). Es idempotente (se puede repetir sin efecto).

BEGIN;

-- Cliente: el teléfono, el correo y la dirección pasan a ser opcionales
ALTER TABLE clientes ALTER COLUMN telefono DROP NOT NULL;
ALTER TABLE clientes ALTER COLUMN correo DROP NOT NULL;
ALTER TABLE clientes ALTER COLUMN direccion DROP NOT NULL;

-- Proveedor: solo son obligatorios el nombre (razón social) y el estado (por defecto 'Activo')
ALTER TABLE proveedor ALTER COLUMN nit DROP NOT NULL;
ALTER TABLE proveedor ALTER COLUMN telefono DROP NOT NULL;
ALTER TABLE proveedor ALTER COLUMN correo DROP NOT NULL;
ALTER TABLE proveedor ALTER COLUMN direccion DROP NOT NULL;
ALTER TABLE proveedor ALTER COLUMN banco DROP NOT NULL;
ALTER TABLE proveedor ALTER COLUMN numero_cuenta DROP NOT NULL;
ALTER TABLE proveedor ALTER COLUMN tipo_cuenta DROP NOT NULL;
ALTER TABLE proveedor ALTER COLUMN estado SET DEFAULT 'Activo';

COMMIT;
