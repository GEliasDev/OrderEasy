const express = require('express');
const { getNegocio, updateNegocio } = require('../controllers/negocioController');
const { verificarToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/multer');

const router = express.Router();

router.get('/', verificarToken, getNegocio);
// Logo opcional (una imagen); un archivo no válido responde 400 en vez de caer en el manejador genérico
const subirLogo = (req, res, next) =>
  upload.single('logo')(req, res, (error) => {
    if (error) return res.status(400).json({ mensaje: error.message || 'No se pudo leer el logo.' });
    next();
  });

router.put('/', verificarToken, subirLogo, updateNegocio);

module.exports = router;
