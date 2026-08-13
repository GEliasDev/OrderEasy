import axiosInstance from '../api/axiosConfig';

export const createProveedor = async (proveedor) => {
  const response = await axiosInstance.post('/api/proveedores', proveedor);
  return response.data;
};

export const getProveedores = async () => {
  const response = await axiosInstance.get('/api/proveedores');
  return response.data;
};

export const updateProveedor = async (id, proveedor) => {
  const response = await axiosInstance.patch(`/api/proveedores/${id}`, proveedor);
  return response.data;
};

export const deleteProveedor = async (id) => {
  const response = await axiosInstance.delete(`/api/proveedores/${id}`);
  return response.data;
};
