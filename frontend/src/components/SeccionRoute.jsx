import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SeccionRoute = ({ seccion, children }) => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.rol === 'administrador') return children;
  if (seccion && user?.secciones?.includes(seccion)) return children;
  const fallback = user?.secciones?.[0];
  return <Navigate to={fallback ? `/dashboard/${fallback}` : '/login'} replace />;
};

export default SeccionRoute;
