import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SeccionRoute = ({ seccion, children }) => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.rol === 'administrador') return children;
  if (seccion && user?.secciones?.includes(seccion)) return children;
  return <Navigate to="/dashboard/caja" replace />;
};

export default SeccionRoute;
