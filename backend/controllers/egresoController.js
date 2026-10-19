const Egreso = require('../models/egresoModel');
const EgresoDetalle = require('../models/egresoDetalleModel');
const Producto = require('../models/productModel');
const OrdenCompra = require('../models/ordenCompraModel');
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const { ErrorStock, validarCantidad, resolverStock, resolverStockDeDetalle, guardarStock, disponibleReal, datosTalla, etiquetaDetalle } = require('../services/stockService');

// ========================================================
// ➕ Crear Egreso (Soporta uno o muchos productos)
// ========================================================
const createEgreso = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { proveedorid, descripcion, items } = req.body;
    const { usuarioid, negocioid } = req.usuario;

    let productosAProcesar = Array.isArray(items) ? items : [];
    if (productosAProcesar.length === 0) {
      await t.rollback();
      return res.status(400).json({ mensaje: 'Debe incluir al menos un producto' });
    }

    const nuevoEgreso = await Egreso.create({
      usuarioid,
      negocioid,
      proveedorid: proveedorid || null,
      descripcion: descripcion || '',
      total: 0
    }, { transaction: t });

    let totalEgreso = 0;

    for (const item of productosAProcesar) {
      const { productoNombre, talla } = item;

      const producto = await Producto.findOne({
        where: { nombre: productoNombre, negocioid },
        transaction: t,
        lock: true
      });

      if (!producto) {
        throw new Error(`Producto no encontrado: ${productoNombre}`);
      }

      const cantidad = validarCantidad(item.cantidad, producto);
      const stock = await resolverStock(producto, talla, t);
      const subtotal = cantidad * producto.precioCompra;
      totalEgreso += subtotal;

      await EgresoDetalle.create({
        egresoid: nuevoEgreso.egresoid,
        productoNombre,
        cantidad,
        precioUnitario: producto.precioCompra,
        subtotal,
        categoriaid: producto.categoriaid,
        ...datosTalla(producto, stock),
      }, { transaction: t });

      await guardarStock(producto, stock, {
        cantidadDisponible: Number(stock.cantidadDisponible) + cantidad
      }, t);
    }

    await nuevoEgreso.update({ total: totalEgreso }, { transaction: t });
    await t.commit();

    const egresoCompleto = await Egreso.findByPk(nuevoEgreso.egresoid, {
      include: [
        { model: EgresoDetalle, as: 'detalles' }, 
        { model: require('../models/proveedorModel'), as: 'proveedor', attributes: ['nombreProveedor'] }
      ]
    });

    res.status(201).json(egresoCompleto);
  } catch (error) {
    await t.rollback();
    if (error instanceof ErrorStock || error.message.includes('no encontrado')) {
      return res.status(400).json({ mensaje: error.message });
    }
    res.status(500).json({ mensaje: 'Error al registrar el egreso' });
  }
};

// ========================================================
// 🔍 Obtener todos los egresos del NEGOCIO
// ========================================================
const getEgresos = async (req, res) => {
  try {
    const { negocioid } = req.usuario;
    const { from, to } = req.query;

    const where = { negocioid };
    if (from && to) {
      where.createdAt = {
        [Op.between]: [
          new Date(from + 'T00:00:00.000Z'),
          new Date(to + 'T23:59:59.999Z')
        ]
      };
    }

    const egresos = await Egreso.findAll({
      where,
      include: [
        { model: EgresoDetalle, as: 'detalles' },
        { model: require('../models/proveedorModel'), as: 'proveedor', attributes: ['nombreProveedor'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(egresos);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener los egresos' });
  }
};

// ========================================================
// 🔍 Obtener un egreso por ID
// ========================================================
const getEgresoById = async (req, res) => {
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;

    const egreso = await Egreso.findOne({
      where: { egresoid: id, negocioid },
      include: [
        { model: EgresoDetalle, as: 'detalles' },
        { model: require('../models/proveedorModel'), as: 'proveedor', attributes: ['nombreProveedor'] }
      ]
    });

    if (!egreso) return res.status(404).json({ mensaje: 'Egreso no encontrada' });
    res.json(egreso);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener el egreso' });
  }
};

// ========================================================
// ✏️ Actualizar Egreso (PATCH)
// ========================================================
const updateEgreso = async (req, res) => {
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;
    const { descripcion, proveedorid } = req.body;

    const egreso = await Egreso.findOne({ where: { egresoid: id, negocioid } });
    if (!egreso) return res.status(404).json({ mensaje: 'Egreso no encontrado' });

    await egreso.update({
      descripcion: descripcion !== undefined ? descripcion : egreso.descripcion,
      proveedorid: proveedorid !== undefined ? proveedorid : egreso.proveedorid
    });

    res.json(egreso);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar el egreso' });
  }
};

// ========================================================
// 🗑️ Eliminar Egreso (Revierte Stock)
// ========================================================
const deleteEgreso = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;

    const egreso = await Egreso.findOne({
      where: { egresoid: id, negocioid },
      include: [{ model: EgresoDetalle, as: 'detalles' }],
      transaction: t
    });

    if (!egreso) {
      await t.rollback();
      return res.status(404).json({ mensaje: 'Egreso no encontrado' });
    }

    const orden = await OrdenCompra.findOne({
      where: { egresoid: egreso.egresoid, negocioid },
      transaction: t,
    });
    if (orden) {
      await t.rollback();
      return res.status(400).json({ mensaje: 'Este egreso proviene de una orden de compra y no se puede eliminar directamente.' });
    }

    for (const detalle of egreso.detalles) {
      const producto = await Producto.findOne({
        where: { nombre: detalle.productoNombre, negocioid },
        transaction: t
      });
      if (producto) {
        const stock = await resolverStockDeDetalle(producto, detalle, t);
        await guardarStock(producto, stock, {
          cantidadDisponible: Number(stock.cantidadDisponible) - Number(detalle.cantidad)
        }, t);
      }
    }

    await egreso.destroy({ transaction: t });
    await t.commit();
    res.json({ mensaje: 'Egreso eliminado y stock revertido' });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ mensaje: 'Error al eliminar el egreso' });
  }
};

module.exports = {
  createEgreso,
  getEgresos,
  getEgresoById,
  updateEgreso,
  deleteEgreso
};
