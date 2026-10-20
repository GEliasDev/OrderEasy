const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Asegúrate de tener la configuración de Sequelize
const Usuario = require('./userModel');

const Proveedor = sequelize.define('Proveedor',{
   proveedorid: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  razonSocial: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'razon_social'
  },

  nombreProveedor: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'nombre_proveedor'
  },

  nit: {
    type: DataTypes.STRING(20),
    allowNull: true
  },

  telefono: {
    type: DataTypes.STRING(20),
    allowNull: true
  },

  correo: {
    type: DataTypes.STRING(100),
    allowNull: true
  },

  direccion: {
    type: DataTypes.STRING(100),
    allowNull: true
  },

  banco: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  numeroCuenta: {
    type: DataTypes.STRING(30),
    allowNull: true,
    field: 'numero_cuenta'
  },

  // Corriente o Ahorros
  tipoCuenta: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'tipo_cuenta'
  },

  categoriaSuministro: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    field: 'categoria_suministro'
  },

  // Activo o Inactivo
  estado: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'Activo'
  },

  usuarioid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'usuarios',
      key: 'usuarioid',
    },
  },
  negocioid: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'negocios',
      key: 'negocioid'
    }
  }

}, {
    timestamps: true,
    tableName: 'proveedor',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
})

module.exports = Proveedor;