import axiosInstance from '../api/axiosConfig';

export const createCliente = async (cliente) => {
  const response = await axiosInstance.post('/api/clientes', cliente);
  return response.data;
};

export const getClientes = async () => {
  const response = await axiosInstance.get('/api/clientes');
  return response.data.clientes || response.data;
};

export const updateCliente = async (id, cliente) => {
  const response = await axiosInstance.patch(`/api/clientes/${id}`, cliente);
  return response.data;
};

export const deleteCliente = async (id) => {
  const response = await axiosInstance.delete(`/api/clientes/${id}`);
  return response.data;
};
