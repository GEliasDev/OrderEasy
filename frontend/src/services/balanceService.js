import axiosInstance from '../api/axiosConfig';

export const getBalanceSummary = async (period = 'all') => {
  try {
    const response = await axiosInstance.get('/api/balance/summary', {
      params: { period }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { mensaje: 'Error al obtener el resumen de balance.' };
  }
};
