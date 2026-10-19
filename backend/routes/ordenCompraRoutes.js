const express = require('express');
const {
  getOrdenes,
  getOrdenById,
  previewLote,
  crearLote,
  recibirOrden,
  anularOrden,
} = require('../controllers/ordenCompraController');
const { verificarToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', verificarToken, getOrdenes);
router.get('/lote/preview', verificarToken, previewLote); // antes de /:id
router.post('/lote', verificarToken, crearLote);
router.get('/:id', verificarToken, getOrdenById);
router.post('/:id/recibir', verificarToken, recibirOrden);
router.post('/:id/anular', verificarToken, anularOrden);

module.exports = router;
