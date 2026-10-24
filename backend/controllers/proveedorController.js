const Proveedor = require('../models/proveedorModel');
const ProveedorPrecioEscalonado = require('../models/proveedorPrecioEscalonadoModel');
const ProveedorCategoria = require('../models/proveedorCategoriaModel');
const Categoria = require('../models/categoryModel');
const sequelize = require('../config/database');

// Texto opcional: espacios -> null (así un campo se puede dejar vacío o borrar)
const limpio = (valor) => (typeof valor === 'string' ? (valor.trim() || null) : (valor ?? null));

// Reemplaza las categorías que suministra el proveedor (solo se aceptan categorías del mismo negocio)
const guardarCategorias = async (proveedorid, negocioid, categoriaids, transaction) => {
  const ids = [...new Set((Array.isArray(categoriaids) ? categoriaids : []).map(Number).filter(Boolean))];
  const validas = ids.length ? await Categoria.findAll({ where: { categoriaid: ids, negocioid }, attributes: ['categoriaid'], transaction }) : [];
  await ProveedorCategoria.destroy({ where: { proveedorid }, transaction });
  if (validas.length) await ProveedorCategoria.bulkCreate(validas.map((c) => ({ proveedorid, categoriaid: c.categoriaid })), { transaction });
};

// Agrega a cada proveedor sus categorías: [{ categoriaid, nombre }]
const conCategorias = async (proveedores, negocioid) => {
  const ids = proveedores.map((p) => p.proveedorid);
  const vinculos = ids.length ? await ProveedorCategoria.findAll({ where: { proveedorid: ids } }) : [];
  const categorias = vinculos.length
    ? await Categoria.findAll({ where: { categoriaid: [...new Set(vinculos.map((v) => v.categoriaid))], negocioid }, attributes: ['categoriaid', 'nombre'] })
    : [];
  const porId = new Map(categorias.map((c) => [c.categoriaid, { categoriaid: c.categoriaid, nombre: c.nombre }]));
  return proveedores.map((p) => {
    const json = typeof p.toJSON === 'function' ? p.toJSON() : p;
    json.categorias = vinculos.filter((v) => v.proveedorid === json.proveedorid).map((v) => porId.get(v.categoriaid)).filter(Boolean)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return json;
  });
};

// ========================================================
// ➕ Crear un nuevo proveedor
// ========================================================
const createProveedor = async (req, res) => {
  try {
    const {
      nit,
      telefono,
      correo,
      direccion,
      banco,
      numeroCuenta,
      tipoCuenta,
      categoriaids,
      estado
    } = req.body;
    const razonSocial = String(req.body.razonSocial ?? '').trim();
    // El contacto es opcional: si no se indica, se usa el nombre del proveedor (así listados y compras siempre lo muestran)
    const nombreProveedor = String(req.body.nombreProveedor ?? '').trim() || razonSocial;

    const { usuarioid, negocioid } = req.usuario;

    // Solo el nombre es obligatorio; NIT, contacto, datos bancarios y demás se pueden completar después
    if (!razonSocial) {
      return res.status(400).json({ mensaje: 'El nombre del proveedor es obligatorio.' });
    }

    const proveedorExistente = await Proveedor.findOne({
      where: { razonSocial, negocioid }
    });

    if (proveedorExistente) {
      return res.status(400).json({ mensaje: 'Ya existe un proveedor con este nombre en tu negocio.' });
    }

    const nuevoProveedor = await Proveedor.create({
      razonSocial,
      nombreProveedor,
      nit: limpio(nit),
      telefono: limpio(telefono),
      correo: limpio(correo),
      direccion: limpio(direccion),
      banco: limpio(banco),
      numeroCuenta: limpio(numeroCuenta),
      tipoCuenta: limpio(tipoCuenta),
      estado: estado || 'Activo',
      usuarioid,
      negocioid
    });
    await guardarCategorias(nuevoProveedor.proveedorid, negocioid, categoriaids);

    res.status(201).json({ mensaje: 'Proveedor registrado exitosamente.', proveedor: (await conCategorias([nuevoProveedor], negocioid))[0] });

  } catch (error) {
    res.status(500).json({ mensaje: 'Error al registrar al proveedor.' });
  }
};

// ========================================================
// 📄 Obtener todos los proveedores del NEGOCIO
// ========================================================
const getProveedores = async (req, res) => {
  try {
    const { negocioid } = req.usuario;

    const proveedores = await Proveedor.findAll({
      where: { negocioid },
      order: [['razon_social', 'ASC']]
    });

    res.status(200).json(await conCategorias(proveedores, negocioid));
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener los proveedores' });
  }
};

// ========================================================
// ✏️ Actualizar proveedor
// ========================================================
const updateProveedor = async (req, res) => {
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;
    const {
      razonSocial,
      nombreProveedor,
      nit,
      telefono,
      correo,
      direccion,
      banco,
      numeroCuenta,
      tipoCuenta,
      categoriaids,
      estado
    } = req.body;

    const proveedor = await Proveedor.findOne({
      where: { proveedorid: id, negocioid }
    });

    if (!proveedor) {
      return res.status(404).json({ mensaje: 'Proveedor no encontrado.' });
    }

    await proveedor.update({
      razonSocial: razonSocial || proveedor.razonSocial,
      nombreProveedor: nombreProveedor || razonSocial || proveedor.nombreProveedor,
      nit: nit !== undefined ? limpio(nit) : proveedor.nit,
      telefono: telefono !== undefined ? limpio(telefono) : proveedor.telefono,
      correo: correo !== undefined ? limpio(correo) : proveedor.correo,
      direccion: direccion !== undefined ? limpio(direccion) : proveedor.direccion,
      banco: banco !== undefined ? limpio(banco) : proveedor.banco,
      numeroCuenta: numeroCuenta !== undefined ? limpio(numeroCuenta) : proveedor.numeroCuenta,
      tipoCuenta: tipoCuenta !== undefined ? limpio(tipoCuenta) : proveedor.tipoCuenta,
      estado: estado || proveedor.estado,
    });
    if (categoriaids !== undefined) await guardarCategorias(proveedor.proveedorid, negocioid, categoriaids);

    res.status(200).json({ mensaje: 'Proveedor actualizado exitosamente.', proveedor: (await conCategorias([proveedor], negocioid))[0] });

  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar el proveedor' });
  }
};

// ========================================================
// 🗑️ Eliminar proveedor
// ========================================================
const deleteProveedor = async (req, res) => {
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;

    const resultado = await Proveedor.destroy({
      where: { proveedorid: id, negocioid }
    });

    if (!resultado) {
      return res.status(404).json({ mensaje: 'Proveedor no encontrado.' });
    }

    res.status(200).json({ mensaje: 'Proveedor eliminado correctamente.' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar el proveedor.' });
  }
};

// ========================================================
// 💲 Precios por cantidad del proveedor (desde X unidades pedidas en total, cada unidad cuesta menos)
// ========================================================
const getPrecios = async (req, res) => {
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;
    const proveedor = await Proveedor.findOne({ where: { proveedorid: id, negocioid } });
    if (!proveedor) return res.status(404).json({ mensaje: 'Proveedor no encontrado.' });

    const filas = await ProveedorPrecioEscalonado.findAll({ where: { proveedorid: id, negocioid }, order: [['desdeCantidad', 'ASC']] });
    res.json({ escalones: filas.map((f) => ({ desde: Number(f.desdeCantidad), precio: Number(f.precio) })) });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener los precios por cantidad.' });
  }
};

// Reemplaza los escalones del proveedor (lista vacía = quitarlos)
const guardarPrecios = async (req, res) => {
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;
    const proveedor = await Proveedor.findOne({ where: { proveedorid: id, negocioid } });
    if (!proveedor) return res.status(404).json({ mensaje: 'Proveedor no encontrado.' });

    const escalones = Array.isArray(req.body?.escalones) ? req.body.escalones : [];
    if (escalones.length > 10) return res.status(400).json({ mensaje: 'Máximo 10 escalones.' });
    const filas = [];
    const vistos = new Set();
    for (const e of escalones) {
      const desde = Number(e.desde);
      const precio = Number(e.precio);
      if (!Number.isFinite(desde) || desde <= 0) return res.status(400).json({ mensaje: 'La cantidad de cada escalón debe ser mayor a 0.' });
      if (!Number.isFinite(precio) || precio < 0) return res.status(400).json({ mensaje: 'El precio de cada escalón no es válido.' });
      if (vistos.has(desde)) return res.status(400).json({ mensaje: `La cantidad ${desde} está repetida.` });
      vistos.add(desde);
      filas.push({ negocioid, proveedorid: Number(id), desdeCantidad: desde, precio: Math.round(precio * 100) / 100 });
    }

    await sequelize.transaction(async (transaction) => {
      await ProveedorPrecioEscalonado.destroy({ where: { proveedorid: id, negocioid }, transaction });
      if (filas.length) await ProveedorPrecioEscalonado.bulkCreate(filas, { transaction });
    });
    res.json({ mensaje: filas.length ? 'Precios por cantidad guardados.' : 'Precios por cantidad quitados.' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al guardar los precios por cantidad.' });
  }
};

module.exports = {
  getPrecios,
  guardarPrecios,
  createProveedor,
  getProveedores,
  updateProveedor,
  deleteProveedor
};
