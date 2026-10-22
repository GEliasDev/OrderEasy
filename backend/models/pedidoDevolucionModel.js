const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Mercancía que el cliente devuelve después de recibirla, con el motivo (ver services/pedidoDevolucionService.js).
// Guarda copia del producto y precio para que el historial no dependa de cambios posteriores.
const PedidoDevolucion = sequelize.define('PedidoDevolucion', {
  devolucionid: {
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
  detalleid: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'pedido_detalles', key: 'detalleid' },
    onDelete: 'SET NULL',
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
  productoNombre: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  talla: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  cantidad: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  precioUnitario: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  motivo: {
    type: DataTypes.STRING(30),
    allowNull: false,
  },
  nota: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  // false cuando el producto vuelve dañado: se registra la devolución pero no sube al inventario
  reingresaStock: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'pedido_devoluciones',
  timestamps: false,
});

module.exports = PedidoDevolucion;
