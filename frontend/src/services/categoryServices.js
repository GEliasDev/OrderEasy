import axiosInstance from '../api/axiosConfig';

export const createCategory = async (categoria) => {
  const response = await axiosInstance.post('/api/categorias', categoria);
  return response.data;
};

export const getCategoriesByUser = async () => {
  const response = await axiosInstance.get('/api/categorias');
  return response.data;
};

export const updateCategory = async (id, updatedCategoria) => {
  const response = await axiosInstance.put(`/api/categorias/${id}`, updatedCategoria);
  return response.data;
};

export const deleteCategory = async (id) => {
  const response = await axiosInstance.delete(`/api/categorias/${id}`);
  return response.data;
};
