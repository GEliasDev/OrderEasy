// ======================================================
// 👥 CONTROLADOR DE CLIENTES
// ======================================================

const Cliente = require('../models/clientModel');

// ===============================================
// ➕ Crear un nuevo cliente
// ===============================================
// Texto opcional: espacios -> null (así un campo se puede dejar vacío o borrar)
const limpio = (valor) => (typeof valor === 'string' ? (valor.trim() || null) : (valor ?? null));

const createClient = async (req, res) => {
  try {
    const { telefono, correo, direccion } = req.body;
    const nombreCliente = String(req.body.nombreCliente ?? '').trim();
    const { usuarioid, negocioid } = req.usuario;

    // Solo el nombre es obligatorio; teléfono, correo y dirección se pueden completar después
    if (!nombreCliente) {
      return res.status(400).json({ mensaje: 'El nombre del cliente es obligatorio.' });
    }

    const clienteExistente = await Cliente.findOne({
      where: { nombreCliente, negocioid }
    });

    if (clienteExistente) {
      return res.status(400).json({ mensaje: 'Ya existe un cliente con este nombre en tu negocio.' });
    }

    const nuevoCliente = await Cliente.create({
      nombreCliente,
      telefono: limpio(telefono),
      correo: limpio(correo),
      direccion: limpio(direccion),
      usuarioid,
      negocioid
    });

    res.status(201).json({ mensaje: 'Cliente registrado exitosamente.', cliente: nuevoCliente });

  } catch (error) {
    res.status(500).json({ mensaje: 'Error al registrar al cliente.' });
  }
};

// ===============================================
// 📄 Obtener todos los clientes del NEGOCIO
// ===============================================
const getClientes = async (req, res) => {
  try {
    const { negocioid } = req.usuario;

    const clientes = await Cliente.findAll({
      where: { negocioid },
      order: [['nombre_cliente', 'ASC']]
    });

    res.status(200).json(clientes);

  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener los clientes' });
  }
};

// ===============================================
// ✏️ Actualizar un cliente por ID
// ===============================================
const updateCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;
    const { nombreCliente, telefono, correo, direccion } = req.body;

    const cliente = await Cliente.findOne({
      where: { clienteid: id, negocioid }
    });

    if (!cliente) {
      return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    }

    await cliente.update({
      nombreCliente: nombreCliente || cliente.nombreCliente,
      telefono: telefono !== undefined ? limpio(telefono) : cliente.telefono,
      correo: correo !== undefined ? limpio(correo) : cliente.correo,
      direccion: direccion !== undefined ? limpio(direccion) : cliente.direccion
    });

    res.status(200).json({ mensaje: 'Cliente actualizado exitosamente', cliente });

  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar el cliente' });
  }
};

// ===============================================
// 🗑️ Eliminar un cliente por ID
// ===============================================
const deleteCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;

    const resultado = await Cliente.destroy({
      where: { clienteid: id, negocioid }
    });

    if (!resultado) {
      return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    }

    res.status(200).json({ mensaje: 'Cliente eliminado correctamente' });

  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar el cliente.' });
  }
};

module.exports = {
  createClient,
  getClientes,
  updateCliente,
  deleteCliente
};
