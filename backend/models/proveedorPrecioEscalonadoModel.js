const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Precio por volumen de un proveedor: desde `desdeCantidad` unidades pedidas en total (de cualquier producto),
// cada unidad cuesta `precio`. Ej.: desde 6 → $28.000, desde 12 → $26.000 (por debajo de 6, cada producto va a su precio normal).
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
  indexes: [{ unique: true, fields: ['proveedorid', 'desde_cantidad'] }],
});

module.exports = ProveedorPrecioEscalonado;
