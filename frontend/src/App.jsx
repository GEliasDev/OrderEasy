import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import SeccionRoute from './components/SeccionRoute';
import ErrorBoundary from './components/ErrorBoundary';
import NotFound from './components/NotFound';

const Dashboard = lazy(() => import('./components/vendedor/dashboard/Dashboard'));
const Inventario = lazy(() => import('./components/vendedor/dashboard/inventario/Inventario'));
const Productos = lazy(() => import('./components/vendedor/dashboard/productos/Productos'));
const Balance = lazy(() => import('./components/vendedor/dashboard/balance/Balance'));
const Estadisticas = lazy(() => import('./components/vendedor/dashboard/estadisticas/Estadisticas'));
const Clientes = lazy(() => import('./components/vendedor/dashboard/clientes/Clientes'));
const Proveedores = lazy(() => import('./components/vendedor/dashboard/proveedores/Proveedores'));
const Login = lazy(() => import('./components/vendedor/login/Login'));
const Home = lazy(() => import('./components/inicio/landing'));
const Inicio = lazy(() => import('./components/vendedor/dashboard/inicio/Inicio'));
const Registro = lazy(() => import('./components/vendedor/login/Registro'));
const RegistrarEgresoForm = lazy(() => import('./components/vendedor/dashboard/balance/vistas/RegistrarEgresoForm'));
const DetalleVenta = lazy(() => import('./components/vendedor/dashboard/balance/vistas/DetalleVenta'));
const DetalleEgreso = lazy(() => import('./components/vendedor/dashboard/balance/vistas/DetalleEgreso'));
const DetalleProducto = lazy(() => import('./components/vendedor/dashboard/inventario/vistas/DetalleProducto'));
const NuevoProducto = lazy(() => import('./components/vendedor/dashboard/inventario/vistas/NuevoProducto'));
const EditarProducto = lazy(() => import('./components/vendedor/dashboard/inventario/vistas/EditarProducto'));
const Categorias = lazy(() => import('./components/vendedor/dashboard/categorias/Categorias'));
const Usuarios = lazy(() => import('./components/vendedor/dashboard/usuarios/Usuario'));
const Roles = lazy(() => import('./components/vendedor/dashboard/roles/Roles'));
const Configuracion = lazy(() => import('./components/vendedor/dashboard/configuracion/Configuracion'));
const ChatPage = lazy(() => import('./components/chat/ChatPage'));
const Caja = lazy(() => import('./components/vendedor/dashboard/caja/Caja'));
const HistorialTurnos = lazy(() => import('./components/vendedor/dashboard/caja/HistorialTurnos'));

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
    <div style={{ width: 36, height: 36, border: '3px solid #E2E8F0', borderTop: '3px solid #1565C0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const IndexRedirect = () => {
  const { user } = useAuth();
  return <Navigate to={user?.rol === 'administrador' ? 'inicio' : 'caja'} replace />;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors closeButton />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/home" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/registro" element={<Registro />} />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              >
                <Route index element={<IndexRedirect />} />

                {/* Rutas basadas en sección asignada (admin siempre pasa) */}
                <Route path="inicio" element={<SeccionRoute seccion="inicio"><Inicio /></SeccionRoute>} />
                <Route path="inventario" element={<SeccionRoute seccion="inventario"><Inventario /></SeccionRoute>} />
                <Route path="productos" element={<SeccionRoute seccion="productos"><Productos /></SeccionRoute>} />
                <Route path="categorias" element={<SeccionRoute seccion="categorias"><Categorias /></SeccionRoute>} />
                <Route path="nuevo-producto" element={<SeccionRoute seccion="inventario"><NuevoProducto /></SeccionRoute>} />
                <Route path="producto/:id/editar" element={<SeccionRoute seccion="inventario"><EditarProducto /></SeccionRoute>} />
                <Route path="balance" element={<SeccionRoute seccion="balance"><Balance /></SeccionRoute>} />
                <Route path="estadisticas" element={<SeccionRoute seccion="estadisticas"><Estadisticas /></SeccionRoute>} />
                <Route path="nuevo-egreso" element={<SeccionRoute seccion="balance"><RegistrarEgresoForm /></SeccionRoute>} />
                <Route path="venta/:id" element={<SeccionRoute seccion="balance"><DetalleVenta /></SeccionRoute>} />
                <Route path="egreso/:id" element={<SeccionRoute seccion="balance"><DetalleEgreso /></SeccionRoute>} />
                <Route path="proveedores" element={<SeccionRoute seccion="proveedores"><Proveedores /></SeccionRoute>} />

                {/* Solo administrador del sistema */}
                <Route path="configuracion" element={<AdminRoute><Configuracion /></AdminRoute>} />
                <Route path="usuarios" element={<AdminRoute><Usuarios /></AdminRoute>} />
                <Route path="roles" element={<AdminRoute><Roles /></AdminRoute>} />
                <Route path="turnos" element={<AdminRoute><HistorialTurnos /></AdminRoute>} />

                {/* Accesibles por todos los roles autenticados */}
                <Route path="producto/:id" element={<DetalleProducto />} />
                <Route path="caja" element={<Caja />} />
                <Route path="clientes" element={<Clientes />} />
                <Route path="asistente" element={<ChatPage />} />
              </Route>

              <Route path="/admin/*" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
