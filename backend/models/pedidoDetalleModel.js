const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PedidoDetalle = sequelize.define('PedidoDetalle', {
  detalleid: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  pedidoid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'pedidos',
      key: 'pedidoid'
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
  // Cuánto de la línea ya se entregó al cliente (entregas parciales)
  cantidadEntregada: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    defaultValue: 0
  },
  talla: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  varianteid: {
    type: DataTypes.INTEGER,
    allowNull: true
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
  tableName: 'pedido_detalles',
  timestamps: false
});

PedidoDetalle.belongsTo(require('./productModel'), { foreignKey: 'productoid', as: 'producto' });
PedidoDetalle.belongsTo(require('./categoryModel'), { foreignKey: 'categoriaid', as: 'categoria' });

module.exports = PedidoDetalle;
