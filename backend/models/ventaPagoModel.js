const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VentaPago = sequelize.define('VentaPago', {
  pagoid: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  ventaid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'ventas',
      key: 'ventaid',
    },
    onDelete: 'CASCADE',
  },
  metodo: {
    type: DataTypes.ENUM('efectivo', 'tarjeta', 'transferencia'),
    allowNull: false,
  },
  monto: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  // Cuándo se recibió el dinero (en las entregas de pedidos puede ser después de la entrega)
  createdAt: {
    type: DataTypes.DATE,
    allowNull: true, // los pagos anteriores se fechan con la migración 008
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'venta_pagos',
  timestamps: false,
});

module.exports = VentaPago;
