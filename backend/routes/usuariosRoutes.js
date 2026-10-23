const express = require('express');
const { getAllUsers, createUser, updateUser, deleteUser, getMiPerfil, updateMiPerfil } = require('../controllers/usuariosController');
const { verificarToken, verificarAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Perfil propio: cualquier usuario autenticado (antes de las rutas /:id)
router.get('/me', verificarToken, getMiPerfil);
router.put('/me', verificarToken, updateMiPerfil);

router.get('/', verificarToken, verificarAdmin, getAllUsers);
router.post('/', verificarToken, verificarAdmin, createUser);
router.put('/:id', verificarToken, verificarAdmin, updateUser);
router.delete('/:id', verificarToken, verificarAdmin, deleteUser);

module.exports = router;
