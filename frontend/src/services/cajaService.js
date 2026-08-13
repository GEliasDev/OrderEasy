import axiosInstance from '../api/axiosConfig';

export const getNegocio = async () => {
  const { data } = await axiosInstance.get('/api/negocio');
  return data.negocio;
};

export const buscarProductos = async (q) => {
  const { data } = await axiosInstance.get('/api/productos/buscar', { params: { q } });
  return data;
};

export const buscarPorCodigo = async (codigo) => {
  const { data } = await axiosInstance.get('/api/productos/buscar', { params: { codigo } });
  return data;
};

export const registrarVenta = async (payload) => {
  const { data } = await axiosInstance.post('/api/ventas', payload);
  return data;
};
