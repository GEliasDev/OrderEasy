import axiosInstance from '../api/axiosConfig';

export const getDashboardStats = async (year) => {
  const response = await axiosInstance.get('/api/stats/dashboard', { params: { year } });
  return response.data;
};
