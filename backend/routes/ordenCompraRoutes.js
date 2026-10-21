const express = require('express');
const {
  eliminarOrden,
  crearPedido,
  actualizarPedido,
  agregarStock,
  quitarStock,
  asignarComprasAPedido,
  previewPedido,
  enviarPedido,
  getOrdenes,
  getOrdenById,
  previewLote,
  crearLote,
  recibirOrden,
  anularOrden,
} = require('../controllers/ordenCompraController');
const { verificarToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', verificarToken, crearPedido);
router.get('/', verificarToken, getOrdenes);
router.get('/lote/preview', verificarToken, previewLote); // antes de /:id
router.post('/lote', verificarToken, crearLote);
router.get('/:id', verificarToken, getOrdenById);
router.patch('/:id', verificarToken, actualizarPedido);
router.post('/:id/stock', verificarToken, agregarStock);
router.delete('/:id/stock/:detalleid', verificarToken, quitarStock);
router.post('/:id/compras', verificarToken, asignarComprasAPedido);
router.get('/:id/preview', verificarToken, previewPedido);
router.post('/:id/enviar', verificarToken, enviarPedido);
router.delete('/:id', verificarToken, eliminarOrden);
router.post('/:id/recibir', verificarToken, recibirOrden);
router.post('/:id/anular', verificarToken, anularOrden);

module.exports = router;
