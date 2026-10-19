const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Usuario = require('./userModel');
const Proveedor = require('./proveedorModel');
const Egreso = require('./egresoModel');
const OrdenCompraDetalle = require('./ordenCompraDetalleModel');

const OrdenCompra = sequelize.define('OrdenCompra', {
  ordenid: {
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
  proveedorid: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'proveedor',
      key: 'proveedorid'
    }
  },
  pedidoid: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'pedidos',
      key: 'pedidoid'
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
  egresoid: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'egresos',
      key: 'egresoid'
    }
  },
  estado: {
    type: DataTypes.ENUM('borrador', 'enviada', 'recibida_parcial', 'recibida', 'anulada'),
    allowNull: false,
    defaultValue: 'borrador'
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
  tableName: 'ordenes_compra',
  timestamps: false
});

OrdenCompra.belongsTo(Usuario, { foreignKey: 'usuarioid', as: 'usuario' });
OrdenCompra.belongsTo(Proveedor, { foreignKey: 'proveedorid', as: 'proveedor' });
OrdenCompra.belongsTo(Egreso, { foreignKey: 'egresoid', as: 'egreso' });
OrdenCompra.hasMany(OrdenCompraDetalle, { foreignKey: 'ordenid', as: 'detalles' });
OrdenCompraDetalle.belongsTo(OrdenCompra, { foreignKey: 'ordenid', as: 'orden' });

module.exports = OrdenCompra;
