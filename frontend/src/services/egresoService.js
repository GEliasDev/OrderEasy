import axiosInstance from '../api/axiosConfig';

export const getEgresos = async (params = {}) => {
  const response = await axiosInstance.get('/api/egresos', { params });
  return response.data;
};

export const getEgresoById = async (id) => {
  const response = await axiosInstance.get(`/api/egresos/${id}`);
  return response.data;
};

export const createEgresoBatch = async (items, proveedorid, descripcion = '') => {
  const response = await axiosInstance.post('/api/egresos', { items, proveedorid, descripcion });
  return response.data;
};

export const updateEgreso = async (id, data) => {
  const response = await axiosInstance.patch(`/api/egresos/${id}`, data);
  return response.data;
};

export const deleteEgreso = async (id) => {
  const response = await axiosInstance.delete(`/api/egresos/${id}`);
  return response.data;
};
