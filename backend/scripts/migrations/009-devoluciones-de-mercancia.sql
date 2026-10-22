-- Migración 009: devoluciones de mercancía entregada, con el motivo por el que el cliente la devolvió.
-- En desarrollo sequelize.sync({ alter: true }) crea la tabla solo. Es idempotente (se puede repetir sin efecto).

BEGIN;

CREATE TABLE IF NOT EXISTS pedido_devoluciones (
  devolucionid    serial PRIMARY KEY,
  pedidoid        integer NOT NULL REFERENCES pedidos(pedidoid) ON DELETE CASCADE,
  detalleid       integer REFERENCES pedido_detalles(detalleid) ON DELETE SET NULL,
  negocioid       integer REFERENCES negocios(negocioid),
  usuarioid       integer REFERENCES usuarios(usuarioid),
  producto_nombre varchar(100) NOT NULL,
  talla           varchar(20),
  cantidad        double precision NOT NULL,
  precio_unitario numeric(10,2) NOT NULL,
  motivo          varchar(30) NOT NULL,
  nota            varchar(255),
  reingresa_stock boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pedido_devoluciones_pedidoid ON pedido_devoluciones (pedidoid);

COMMIT;
