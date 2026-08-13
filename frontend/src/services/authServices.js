import axiosInstance from '../api/axiosConfig';

const loginUser = async (correo, contraseña) => {
  try {
    const response = await axiosInstance.post('/api/auth/login', { correo, contraseña });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.mensaje || 'Error al conectar con el servidor.');
  }
};

const registerUser = async (usuarioData) => {
  try {
    const response = await axiosInstance.post('/api/auth/register-public', usuarioData);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.mensaje || 'Error al conectar con el servidor.');
  }
};

export { loginUser, registerUser };
