const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Movimientos de dinero de un pedido: abonos del cliente y devoluciones.
// montoAplicado = parte del abono ya cobrada dentro de una venta (entrega); montoDevuelto = parte devuelta al cliente.
// Lo que sigue "en poder del negocio" de un abono es monto - montoAplicado - montoDevuelto (ver services/pedidoPagoService.js).
const PedidoPago = sequelize.define('PedidoPago', {
  pagoid: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  pedidoid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'pedidos', key: 'pedidoid' },
    onDelete: 'CASCADE',
  },
  negocioid: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'negocios', key: 'negocioid' },
  },
  usuarioid: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'usuarios', key: 'usuarioid' },
  },
  tipo: {
    type: DataTypes.ENUM('abono', 'devolucion', 'traslado'),
    allowNull: false,
  },
  // Mismos métodos que los pagos de una venta: al entregar, los abonos se copian a la venta con su método
  metodo: {
    type: DataTypes.ENUM('efectivo', 'tarjeta', 'transferencia'),
    allowNull: false,
  },
  monto: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  montoAplicado: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  montoDevuelto: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  nota: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'pedido_pagos',
  timestamps: false,
});

module.exports = PedidoPago;
