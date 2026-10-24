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
  // Número visible y consecutivo de la compra dentro del negocio (el id interno no se muestra)
  numero: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  // Pedido al proveedor al que pertenece esta compra (sin FK en el modelo para evitar la dependencia cíclica con ordenes_compra)
  ordenid: {
    type: DataTypes.INTEGER,
    allowNull: true
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
Pedido.hasMany(Venta, { foreignKey: 'pedidoid', as: 'ventas', constraints: false });
Pedido.hasMany(require('./pedidoPagoModel'), { foreignKey: 'pedidoid', as: 'pagos' });
Pedido.hasMany(require('./pedidoDevolucionModel'), { foreignKey: 'pedidoid', as: 'devoluciones' });
PedidoDetalle.belongsTo(Pedido, { foreignKey: 'pedidoid', as: 'pedido' });
Pedido.hasMany(OrdenCompra, { foreignKey: 'pedidoid', as: 'ordenes' });
Pedido.belongsTo(OrdenCompra, { foreignKey: 'ordenid', as: 'pedidoProveedor', constraints: false });
OrdenCompra.hasMany(Pedido, { foreignKey: 'ordenid', as: 'compras', constraints: false });
OrdenCompra.belongsTo(Pedido, { foreignKey: 'pedidoid', as: 'pedido' });

module.exports = Pedido;
