const Usuario = require('../models/userModel');
const Rol = require('../models/rolModel');
const RolSeccion = require('../models/roleSeccionModel');
const bcrypt = require('bcrypt');
const { generarToken } = require('../utils/jwt');

const getAllUsers = async (req, res) => {
  try {
    const { negocioid } = req.usuario;
    const usuarios = await Usuario.findAll({
      where: { negocioid },
      attributes: { exclude: ['contraseña'] },
      include: [{
        model: Rol,
        as: 'rolCustom',
        attributes: ['rolid', 'nombre'],
        include: [{ model: RolSeccion, as: 'secciones', attributes: ['seccion'] }],
      }],
    });
    res.status(200).json({ usuarios });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ mensaje: 'Error al obtener usuarios.' });
  }
};

const createUser = async (req, res) => {
  try {
    const { negocioid } = req.usuario;
    const { primerNombre, primerApellido, correo, telefono, contraseña, rolid } = req.body;

    if (!primerNombre || !primerApellido || !correo || !contraseña) {
      return res.status(400).json({ mensaje: 'Nombre, apellido, correo y contraseña son obligatorios.' });
    }

    const existe = await Usuario.findOne({ where: { correo } });
    if (existe) return res.status(400).json({ mensaje: 'El correo ya está registrado.' });

    if (rolid) {
      const rol = await Rol.findOne({ where: { rolid, negocioid } });
      if (!rol) return res.status(400).json({ mensaje: 'Rol no válido para este negocio.' });
    }

    const contraseñaEncriptada = await bcrypt.hash(contraseña, 10);
    const usuario = await Usuario.create({
      primer_nombre: primerNombre,
      primer_apellido: primerApellido,
      correo,
      telefono: telefono || null,
      contraseña: contraseñaEncriptada,
      rol: 'vendedor',
      negocioid,
      rolid: rolid || null,
    });

    const usuarioResponse = await Usuario.findByPk(usuario.usuarioid, {
      attributes: { exclude: ['contraseña'] },
      include: [{
        model: Rol,
        as: 'rolCustom',
        attributes: ['rolid', 'nombre'],
        include: [{ model: RolSeccion, as: 'secciones', attributes: ['seccion'] }],
      }],
    });

    res.status(201).json({ mensaje: 'Usuario creado exitosamente.', usuario: usuarioResponse });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ mensaje: 'Error al crear el usuario.' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;
    const { primerNombre, primerApellido, correo, telefono, contraseña, rolid } = req.body;

    const usuario = await Usuario.findOne({ where: { usuarioid: id, negocioid } });
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado en este negocio.' });

    if (rolid !== undefined && rolid !== null) {
      const rol = await Rol.findOne({ where: { rolid, negocioid } });
      if (!rol) return res.status(400).json({ mensaje: 'Rol no válido para este negocio.' });
    }

    const contraseñaFinal = contraseña ? await bcrypt.hash(contraseña, 10) : usuario.contraseña;

    await usuario.update({
      primer_nombre: primerNombre || usuario.primer_nombre,
      primer_apellido: primerApellido || usuario.primer_apellido,
      correo: correo || usuario.correo,
      telefono: telefono !== undefined ? telefono : usuario.telefono,
      contraseña: contraseñaFinal,
      rolid: rolid !== undefined ? rolid : usuario.rolid,
    });

    const usuarioActualizado = await Usuario.findByPk(id, {
      attributes: { exclude: ['contraseña'] },
      include: [{
        model: Rol,
        as: 'rolCustom',
        attributes: ['rolid', 'nombre'],
        include: [{ model: RolSeccion, as: 'secciones', attributes: ['seccion'] }],
      }],
    });

    res.status(200).json({ mensaje: 'Usuario actualizado exitosamente.', usuario: usuarioActualizado });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ mensaje: 'Error al actualizar el usuario.' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;

    const usuario = await Usuario.findOne({ where: { usuarioid: id, negocioid } });
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado en este negocio.' });

    if (usuario.usuarioid === req.usuario.usuarioid) {
      return res.status(400).json({ mensaje: 'No puedes eliminarte a ti mismo.' });
    }

    await usuario.destroy();
    res.status(200).json({ mensaje: 'Usuario eliminado exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ mensaje: 'Error al eliminar el usuario.' });
  }
};

// ===============================================
// 👤 PERFIL PROPIO: cualquier usuario ve y edita sus datos (no cambia su rol ni su negocio)
// ===============================================
const perfilDe = (usuario) => ({
  id: usuario.usuarioid,
  primerNombre: usuario.primer_nombre,
  segundoNombre: usuario.segundo_nombre || '',
  primerApellido: usuario.primer_apellido,
  segundoApellido: usuario.segundo_apellido || '',
  correo: usuario.correo,
  telefono: usuario.telefono || '',
  rol: usuario.rol,
});

const getMiPerfil = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.usuario.usuarioid);
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    res.status(200).json({ perfil: perfilDe(usuario) });
  } catch (error) {
    console.error('Error al obtener el perfil:', error);
    res.status(500).json({ mensaje: 'Error al obtener el perfil.' });
  }
};

const updateMiPerfil = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.usuario.usuarioid);
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });

    const limpio = (valor) => (typeof valor === 'string' ? valor.trim() : '');
    const primerNombre = limpio(req.body.primerNombre);
    const primerApellido = limpio(req.body.primerApellido);
    const correo = limpio(req.body.correo).toLowerCase();
    const telefono = limpio(req.body.telefono).replace(/[\s-]/g, '');

    if (primerNombre.length < 2) return res.status(400).json({ mensaje: 'El primer nombre debe tener al menos 2 caracteres.' });
    if (primerApellido.length < 2) return res.status(400).json({ mensaje: 'El primer apellido debe tener al menos 2 caracteres.' });
    if (!/^\S+@\S+\.\S+$/.test(correo)) return res.status(400).json({ mensaje: 'Ingresa un correo válido.' });
    if (telefono && !/^\+?[1-9]\d{1,14}$/.test(telefono)) return res.status(400).json({ mensaje: 'El teléfono no es válido (solo números, con indicativo opcional).' });

    const existente = await Usuario.findOne({ where: { correo } });
    if (existente && existente.usuarioid !== usuario.usuarioid) {
      return res.status(409).json({ mensaje: 'Ese correo ya está registrado por otro usuario.' });
    }

    await usuario.update({
      primer_nombre: primerNombre,
      segundo_nombre: limpio(req.body.segundoNombre) || null,
      primer_apellido: primerApellido,
      segundo_apellido: limpio(req.body.segundoApellido) || null,
      correo,
      telefono: telefono || null,
    });

    // El token lleva el correo: se emite uno nuevo para que quede al día
    const token = generarToken({
      usuarioid: usuario.usuarioid,
      negocioid: usuario.negocioid,
      rol: usuario.rol,
      correo: usuario.correo,
    });

    res.status(200).json({ mensaje: 'Perfil actualizado correctamente.', perfil: perfilDe(usuario), token });
  } catch (error) {
    console.error('Error al actualizar el perfil:', error);
    res.status(500).json({ mensaje: 'Error al actualizar el perfil.' });
  }
};

module.exports = { getAllUsers, createUser, updateUser, deleteUser, getMiPerfil, updateMiPerfil };
