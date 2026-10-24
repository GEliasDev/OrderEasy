const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Precio por volumen de un proveedor: desde `desdeCantidad` unidades de un producto, cada unidad cuesta `precio`.
// Ej.: producto A con proveedor P → desde 1: $30.000, desde 6: $28.000, desde 12: $26.000.
const ProveedorPrecioEscalonado = sequelize.define('ProveedorPrecioEscalonado', {
  escalonid: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  negocioid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'negocios', key: 'negocioid' },
  },
  proveedorid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'proveedor', key: 'proveedorid' },
    onDelete: 'CASCADE',
  },
  productoid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'productos', key: 'productoid' },
    onDelete: 'CASCADE',
  },
  desdeCantidad: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  precio: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
}, {
  tableName: 'proveedor_precios_escalonados',
  timestamps: false,
  indexes: [{ unique: true, fields: ['proveedorid', 'productoid', 'desde_cantidad'] }],
});

module.exports = ProveedorPrecioEscalonado;
