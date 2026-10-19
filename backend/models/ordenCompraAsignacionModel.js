const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const OrdenCompraDetalle = require('./ordenCompraDetalleModel');
const PedidoDetalle = require('./pedidoDetalleModel');

// Reparto de una línea de compra al proveedor entre las líneas de pedido (clientes) a las que va destinada.
// Ej.: la compra de 3 pares talla 38 se reparte así: Ana 1, Luis 1, María 1.
// cantidadRecibida = cuántos de esos pares ya llegaron "para" ese cliente (el reparto al recibir lo elige el usuario).
const OrdenCompraAsignacion = sequelize.define('OrdenCompraAsignacion', {
  asignacionid: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  ordendetalleid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'orden_compra_detalles', key: 'detalleid' },
    onDelete: 'CASCADE',
  },
  pedidodetalleid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'pedido_detalles', key: 'detalleid' },
    onDelete: 'CASCADE',
  },
  cantidad: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  cantidadRecibida: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'orden_compra_asignaciones',
  timestamps: false,
  indexes: [{ unique: true, fields: ['ordendetalleid', 'pedidodetalleid'] }],
});

OrdenCompraDetalle.hasMany(OrdenCompraAsignacion, { foreignKey: 'ordendetalleid', as: 'asignaciones' });
OrdenCompraAsignacion.belongsTo(OrdenCompraDetalle, { foreignKey: 'ordendetalleid', as: 'ordenDetalle' });
PedidoDetalle.hasMany(OrdenCompraAsignacion, { foreignKey: 'pedidodetalleid', as: 'asignaciones' });
OrdenCompraAsignacion.belongsTo(PedidoDetalle, { foreignKey: 'pedidodetalleid', as: 'pedidoDetalle' });

module.exports = OrdenCompraAsignacion;
