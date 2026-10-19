const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrdenCompraDetalle = sequelize.define('OrdenCompraDetalle', {
  detalleid: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ordenid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'ordenes_compra',
      key: 'ordenid'
    },
    onDelete: 'CASCADE'
  },
  productoid: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'productos',
      key: 'productoid'
    }
  },
  productoNombre: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  cantidad: {
    type: DataTypes.DOUBLE,
    allowNull: false
  },
  talla: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  varianteid: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  cantidadRecibida: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    defaultValue: 0
  },
  precioUnitario: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  categoriaid: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'orden_compra_detalles',
  timestamps: false
});

OrdenCompraDetalle.belongsTo(require('./productModel'), { foreignKey: 'productoid', as: 'producto' });
OrdenCompraDetalle.belongsTo(require('./categoryModel'), { foreignKey: 'categoriaid', as: 'categoria' });

module.exports = OrdenCompraDetalle;
