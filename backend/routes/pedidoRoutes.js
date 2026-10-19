const express = require('express');
const {
  createPedido,
  getPedidos,
  getPedidoById,
  updatePedido,
  confirmarPedido,
  anularPedido,
  convertirAVenta,
  generarOrdenCompra,
  deletePedido,
} = require('../controllers/pedidoController');
const { verificarToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', verificarToken, createPedido);
router.get('/', verificarToken, getPedidos);
router.get('/:id', verificarToken, getPedidoById);
router.patch('/:id', verificarToken, updatePedido);
router.delete('/:id', verificarToken, deletePedido);
router.post('/:id/confirmar', verificarToken, confirmarPedido);
router.post('/:id/anular', verificarToken, anularPedido);
router.post('/:id/convertir-venta', verificarToken, convertirAVenta);
router.post('/:id/orden-compra', verificarToken, generarOrdenCompra);

module.exports = router;
