import axiosInstance from '../api/axiosConfig';

export const createProduct = async (producto) => {
  const response = await axiosInstance.post('/api/productos', producto);
  return response.data;
};

export const getAllProducts = async () => {
  const response = await axiosInstance.get('/api/productos');
  return response.data;
};

export const getProductById = async (id) => {
  const response = await axiosInstance.get(`/api/productos/${id}`);
  return response.data;
};

export const updateProduct = async (id, updatedProduct) => {
  const response = await axiosInstance.put(`/api/productos/${id}`, updatedProduct);
  return response.data;
};

export const deleteProduct = async (id) => {
  const response = await axiosInstance.delete(`/api/productos/${id}`);
  return response.data;
};
