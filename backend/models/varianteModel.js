const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Producto = require('./productModel');

// Variante de un producto que se maneja por talla (p. ej. sandalias 35-40).
// El stock vive aquí; productos.cantidadDisponible/Reservada guardan el total (suma de variantes).
const ProductoVariante = sequelize.define('ProductoVariante', {
  varianteid: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  productoid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'productos', key: 'productoid' },
    onDelete: 'CASCADE',
  },
  negocioid: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'negocios', key: 'negocioid' },
  },
  talla: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: { notEmpty: true },
  },
  cantidadDisponible: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    defaultValue: 0,
  },
  cantidadReservada: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'producto_variantes',
  timestamps: false,
  indexes: [{ unique: true, fields: ['productoid', 'talla'] }],
});

Producto.hasMany(ProductoVariante, { foreignKey: 'productoid', as: 'variantes', onDelete: 'CASCADE' });
ProductoVariante.belongsTo(Producto, { foreignKey: 'productoid', as: 'producto' });

module.exports = ProductoVariante;
