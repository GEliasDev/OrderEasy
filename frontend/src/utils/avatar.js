const COLORES = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#EF4444', '#6366F1'];

// Color estable del círculo con las iniciales de una persona
export const colorAvatar = (nombre) => COLORES[(nombre?.charCodeAt(0) || 65) % COLORES.length];

export const iniciales = (nombre) => {
  const partes = (nombre || '?').trim().split(/\s+/);
  return partes.length >= 2
    ? (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
    : (nombre || '?').slice(0, 2).toUpperCase();
};
