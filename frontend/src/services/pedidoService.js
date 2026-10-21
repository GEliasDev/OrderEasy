import axiosInstance from '../api/axiosConfig';

export const getPedidos = async (params = {}) => {
  const { data } = await axiosInstance.get('/api/pedidos', { params });
  return data;
};

export const getPedidoById = async (id) => {
  const { data } = await axiosInstance.get(`/api/pedidos/${id}`);
  return data;
};

export const createPedido = async (payload) => {
  const { data } = await axiosInstance.post('/api/pedidos', payload);
  return data;
};

export const updatePedido = async (id, payload) => {
  const { data } = await axiosInstance.patch(`/api/pedidos/${id}`, payload);
  return data;
};

export const confirmarPedido = async (id) => {
  const { data } = await axiosInstance.post(`/api/pedidos/${id}/confirmar`);
  return data;
};

// payload: { abonos: 'devolver' | 'saldo_a_favor', metodoDevolucion }
export const anularPedido = async (id, payload = {}) => {
  const { data } = await axiosInstance.post(`/api/pedidos/${id}/anular`, payload);
  return data;
};

// Entrega total o parcial. payload: { items?: [{ detalleid, cantidad }], pagos?: [{ metodo, monto }] }
export const entregarPedido = async (id, payload = {}) => {
  const { data } = await axiosInstance.post(`/api/pedidos/${id}/entregar`, payload);
  return data;
};

// Abono o devolución manual. payload: { tipo: 'abono' | 'devolucion', monto, metodo, nota }
export const registrarPagoPedido = async (id, payload) => {
  const { data } = await axiosInstance.post(`/api/pedidos/${id}/pagos`, payload);
  return data;
};

export const getSaldoFavor = async (clienteid) => {
  const { data } = await axiosInstance.get(`/api/pedidos/saldo-favor/${clienteid}`);
  return data;
};

export const usarSaldoFavor = async (id, monto) => {
  const { data } = await axiosInstance.post(`/api/pedidos/${id}/usar-saldo`, monto ? { monto } : {});
  return data;
};

export const convertirPedidoAVenta = async (id) => {
  const { data } = await axiosInstance.post(`/api/pedidos/${id}/convertir-venta`);
  return data;
};

export const generarOrdenCompra = async (id, payload) => {
  const { data } = await axiosInstance.post(`/api/pedidos/${id}/orden-compra`, payload);
  return data;
};

export const getOrdenesCompra = async (params = {}) => {
  const { data } = await axiosInstance.get('/api/ordenes-compra', { params });
  return data;
};

export const getOrdenCompra = async (id) => {
  const { data } = await axiosInstance.get(`/api/ordenes-compra/${id}`);
  return data;
};

// Qué hay que comprar para un grupo de pedidos (por producto y talla, con el reparto por cliente)
export const previewLoteCompra = async (pedidoids) => {
  const { data } = await axiosInstance.get('/api/ordenes-compra/lote/preview', { params: { pedidoids: pedidoids.join(',') } });
  return data;
};

// payload: { pedidoids, proveedorid?, descripcion? }
export const crearLoteCompra = async (payload) => {
  const { data } = await axiosInstance.post('/api/ordenes-compra/lote', payload);
  return data;
};

// items opcionales: [{ detalleid, cantidad, reparto: [{ asignacionid, cantidad }] }]. Sin items recibe todo lo pendiente.
export const recibirOrdenCompra = async (id, items) => {
  const { data } = await axiosInstance.post(`/api/ordenes-compra/${id}/recibir`, { items });
  return data;
};

export const anularOrdenCompra = async (id) => {
  const { data } = await axiosInstance.post(`/api/ordenes-compra/${id}/anular`);
  return data;
};

export const deletePedido = async (id) => {
  const { data } = await axiosInstance.delete(`/api/pedidos/${id}`);
  return data;
};

// ───── Pedido al proveedor (contenedor de las compras de los clientes) ─────

// payload: { proveedorid?, descripcion? }
export const crearPedidoProveedor = async (payload = {}) => {
  const { data } = await axiosInstance.post('/api/ordenes-compra', payload);
  return data;
};

export const actualizarPedidoProveedor = async (id, payload) => {
  const { data } = await axiosInstance.patch(`/api/ordenes-compra/${id}`, payload);
  return data;
};

// Productos para stock (sin cliente). payload: { items: [{ productoid, talla?, cantidad }] }
export const agregarStockPedido = async (id, payload) => {
  const { data } = await axiosInstance.post(`/api/ordenes-compra/${id}/stock`, payload);
  return data;
};

export const quitarStockPedido = async (id, detalleid) => {
  const { data } = await axiosInstance.delete(`/api/ordenes-compra/${id}/stock/${detalleid}`);
  return data;
};

// Agrega al pedido compras de clientes que ya existían
export const asignarComprasPedido = async (id, pedidoids) => {
  const { data } = await axiosInstance.post(`/api/ordenes-compra/${id}/compras`, { pedidoids });
  return data;
};

// Lo que se pedirá al proveedor al enviar (por producto y talla, con el reparto por cliente)
export const previewPedidoProveedor = async (id) => {
  const { data } = await axiosInstance.get(`/api/ordenes-compra/${id}/preview`);
  return data;
};

export const enviarPedidoProveedor = async (id) => {
  const { data } = await axiosInstance.post(`/api/ordenes-compra/${id}/enviar`);
  return data;
};

// Lo que los clientes le deben al negocio, sin importar el estado de los pedidos (compras de todos los pedidos y sueltas)
export const getSaldoPorCobrar = async () => {
  const { data } = await axiosInstance.get('/api/pedidos/saldo-por-cobrar');
  return data;
};

// Elimina el pedido al proveedor en cualquier estado (las compras de los clientes quedan sueltas)
export const eliminarPedidoProveedor = async (id) => {
  const { data } = await axiosInstance.delete(`/api/ordenes-compra/${id}`);
  return data;
};
