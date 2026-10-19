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

export const anularPedido = async (id) => {
  const { data } = await axiosInstance.post(`/api/pedidos/${id}/anular`);
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
