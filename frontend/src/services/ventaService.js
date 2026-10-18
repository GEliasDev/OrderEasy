import axiosInstance from '../api/axiosConfig';

export const getVentas = async (params = {}) => {
  const response = await axiosInstance.get('/api/ventas', { params });
  return response.data;
};

export const getVentaById = async (id) => {
  const response = await axiosInstance.get(`/api/ventas/${id}`);
  return response.data;
};

export const createVentaBatch = async (items, clienteid, descripcion = '') => {
  const response = await axiosInstance.post('/api/ventas', { items, clienteid, descripcion });
  return response.data;
};

export const updateVenta = async (id, data) => {
  const response = await axiosInstance.patch(`/api/ventas/${id}`, data);
  return response.data;
};

export const deleteVenta = async (id) => {
  const response = await axiosInstance.delete(`/api/ventas/${id}`);
  return response.data;
};
