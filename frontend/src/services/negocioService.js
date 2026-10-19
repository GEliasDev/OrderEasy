import axiosInstance from '../api/axiosConfig';

export const getNegocio = async () => {
  const { data } = await axiosInstance.get('/api/negocio');
  return data.negocio;
};
