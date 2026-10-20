const Proveedor = require('../models/proveedorModel');

// Texto opcional: espacios -> null (así un campo se puede dejar vacío o borrar)
const limpio = (valor) => (typeof valor === 'string' ? (valor.trim() || null) : (valor ?? null));

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
      categoriaSuministro,
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
      categoriaSuministro,
      estado: estado || 'Activo',
      usuarioid,
      negocioid
    });

    res.status(201).json({ mensaje: 'Proveedor registrado exitosamente.', proveedor: nuevoProveedor });

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

    res.status(200).json(proveedores);
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
      categoriaSuministro,
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
      categoriaSuministro: categoriaSuministro || proveedor.categoriaSuministro,
      estado: estado || proveedor.estado,
    });

    res.status(200).json({ mensaje: 'Proveedor actualizado exitosamente.', proveedor });

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

module.exports = {
  createProveedor,
  getProveedores,
  updateProveedor,
  deleteProveedor
};
