const express = require('express');
const {
  createPedido,
  getPedidos,
  getSaldoPorCobrar,
  getPedidoById,
  updatePedido,
  confirmarPedido,
  anularPedido,
  convertirAVenta,
  entregarPedido,
  registrarPago,
  devolverProductos,
  getSaldoFavor,
  usarSaldo,
  generarOrdenCompra,
  deletePedido,
} = require('../controllers/pedidoController');
const { verificarToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', verificarToken, createPedido);
router.get('/', verificarToken, getPedidos);
router.get('/saldo-por-cobrar', verificarToken, getSaldoPorCobrar); // antes de /:id
router.get('/saldo-favor/:clienteid', verificarToken, getSaldoFavor); // antes de /:id
router.get('/:id', verificarToken, getPedidoById);
router.patch('/:id', verificarToken, updatePedido);
router.delete('/:id', verificarToken, deletePedido);
router.post('/:id/confirmar', verificarToken, confirmarPedido);
router.post('/:id/anular', verificarToken, anularPedido);
router.post('/:id/convertir-venta', verificarToken, convertirAVenta);
router.post('/:id/entregar', verificarToken, entregarPedido);
router.post('/:id/pagos', verificarToken, registrarPago);
router.post('/:id/devoluciones', verificarToken, devolverProductos);
router.post('/:id/usar-saldo', verificarToken, usarSaldo);
router.post('/:id/orden-compra', verificarToken, generarOrdenCompra);

module.exports = router;
