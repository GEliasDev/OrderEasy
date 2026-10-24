const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Categorías que suministra cada proveedor (vínculo muchos a muchos). Los precios por cantidad solo
// cuentan las unidades de estas categorías; un proveedor sin categorías no aplica escalones.
const ProveedorCategoria = sequelize.define('ProveedorCategoria', {
  proveedorid: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: { model: 'proveedor', key: 'proveedorid' },
    onDelete: 'CASCADE',
  },
  categoriaid: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: { model: 'categorias', key: 'categoriaid' },
    onDelete: 'CASCADE',
  },
}, {
  tableName: 'proveedor_categorias',
  timestamps: false,
});

module.exports = ProveedorCategoria;
