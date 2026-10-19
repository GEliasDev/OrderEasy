const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Usuario = require('./userModel');
const Cliente = require('./clientModel');
const Venta = require('./ventaModel');
const OrdenCompra = require('./ordenCompraModel');
const PedidoDetalle = require('./pedidoDetalleModel');

const Pedido = sequelize.define('Pedido', {
  pedidoid: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  negocioid: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'negocios',
      key: 'negocioid'
    }
  },
  clienteid: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'clientes',
      key: 'clienteid'
    }
  },
  usuarioid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'usuarios',
      key: 'usuarioid'
    }
  },
  ventaid: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'ventas',
      key: 'ventaid'
    }
  },
  estado: {
    type: DataTypes.ENUM('pendiente', 'confirmado', 'en_compra', 'recibido', 'entregado', 'anulado'),
    allowNull: false,
    defaultValue: 'pendiente'
  },
  fechaEntrega: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  descripcion: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'pedidos',
  timestamps: false
});

Pedido.belongsTo(Usuario, { foreignKey: 'usuarioid', as: 'usuario' });
Pedido.belongsTo(Cliente, { foreignKey: 'clienteid', as: 'cliente' });
Pedido.belongsTo(Venta, { foreignKey: 'ventaid', as: 'venta' });
Pedido.hasMany(PedidoDetalle, { foreignKey: 'pedidoid', as: 'detalles' });
PedidoDetalle.belongsTo(Pedido, { foreignKey: 'pedidoid', as: 'pedido' });
Pedido.hasMany(OrdenCompra, { foreignKey: 'pedidoid', as: 'ordenes' });
OrdenCompra.belongsTo(Pedido, { foreignKey: 'pedidoid', as: 'pedido' });

module.exports = Pedido;
