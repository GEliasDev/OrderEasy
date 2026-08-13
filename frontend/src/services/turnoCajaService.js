import axiosInstance from '../api/axiosConfig';

export const getTurnoActivo = async () => {
  const { data } = await axiosInstance.get('/api/turnos/activo');
  return data;
};

export const abrirTurno = async (montoInicial) => {
  const { data } = await axiosInstance.post('/api/turnos/abrir', { montoInicial });
  return data;
};

export const cerrarTurno = async (montoEfectivoReal) => {
  const { data } = await axiosInstance.post('/api/turnos/cerrar', { montoEfectivoReal });
  return data;
};
