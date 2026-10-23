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
const ProveedorForm = lazy(() => import('./components/vendedor/dashboard/proveedores/ProveedorForm'));
const ClienteForm = lazy(() => import('./components/vendedor/dashboard/clientes/ClienteForm'));
const NuevoPedido = lazy(() => import('./components/vendedor/dashboard/pedidos/NuevoPedido'));
const DetallePedido = lazy(() => import('./components/vendedor/dashboard/pedidos/DetallePedido'));
const Compras = lazy(() => import('./components/vendedor/dashboard/compras/Compras'));
const CrearPedidoProveedor = lazy(() => import('./components/vendedor/dashboard/compras/CrearPedidoProveedor'));
const DetalleCompra = lazy(() => import('./components/vendedor/dashboard/compras/DetalleCompra'));
const Login = lazy(() => import('./components/vendedor/login/Login'));
const Home = lazy(() => import('./components/inicio/landing'));
const Inicio = lazy(() => import('./components/vendedor/dashboard/inicio/Inicio'));
const Registro = lazy(() => import('./components/vendedor/login/Registro'));
const RegistrarIngresoForm = lazy(() => import('./components/vendedor/dashboard/balance/vistas/RegistrarIngresoForm'));
const RegistrarEgresoForm = lazy(() => import('./components/vendedor/dashboard/balance/vistas/RegistrarEgresoForm'));
const DetalleVenta = lazy(() => import('./components/vendedor/dashboard/balance/vistas/DetalleVenta'));
const DetalleEgreso = lazy(() => import('./components/vendedor/dashboard/balance/vistas/DetalleEgreso'));
const DetalleProducto = lazy(() => import('./components/vendedor/dashboard/inventario/vistas/DetalleProducto'));
const NuevoProducto = lazy(() => import('./components/vendedor/dashboard/inventario/vistas/NuevoProducto'));
const EditarProducto = lazy(() => import('./components/vendedor/dashboard/inventario/vistas/EditarProducto'));
const Categorias = lazy(() => import('./components/vendedor/dashboard/categorias/Categorias'));
const CategoriaForm = lazy(() => import('./components/vendedor/dashboard/categorias/CategoriaForm'));
const Usuarios = lazy(() => import('./components/vendedor/dashboard/usuarios/Usuario'));
const Roles = lazy(() => import('./components/vendedor/dashboard/roles/Roles'));
const UsuarioForm = lazy(() => import('./components/vendedor/dashboard/usuarios/UsuarioForm'));
const RolForm = lazy(() => import('./components/vendedor/dashboard/roles/RolForm'));
const Perfil = lazy(() => import('./components/vendedor/dashboard/perfil/Perfil'));
const Configuracion = lazy(() => import('./components/vendedor/dashboard/configuracion/Configuracion'));

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
    <div style={{ width: 36, height: 36, border: '3px solid #E2E8F0', borderTop: '3px solid #1565C0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const IndexRedirect = () => {
  const { user } = useAuth();
  if (user?.rol === 'administrador') return <Navigate to="inicio" replace />;
  const secciones = user?.secciones || [];
  const destino = ['inicio', 'pedidos', 'inventario', 'productos', 'balance', 'clientes', 'proveedores', 'estadisticas', 'categorias']
    .find((s) => secciones.includes(s));
  return <Navigate to={destino || 'inicio'} replace />;
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
                <Route path="categorias/nueva" element={<SeccionRoute seccion="categorias"><CategoriaForm /></SeccionRoute>} />
                <Route path="categorias/:id/editar" element={<SeccionRoute seccion="categorias"><CategoriaForm /></SeccionRoute>} />
                <Route path="pedidos" element={<SeccionRoute seccion="pedidos"><Compras /></SeccionRoute>} />
                <Route path="pedidos/nuevo" element={<SeccionRoute seccion="pedidos"><CrearPedidoProveedor /></SeccionRoute>} />
                <Route path="pedidos/:id/:vista?" element={<SeccionRoute seccion="pedidos"><DetalleCompra /></SeccionRoute>} />
                <Route path="nuevo-pedido" element={<SeccionRoute seccion="pedidos"><NuevoPedido /></SeccionRoute>} />
                <Route path="pedido/:id/:vista?/:pagoid?" element={<SeccionRoute seccion="pedidos"><DetallePedido /></SeccionRoute>} />
                <Route path="nuevo-producto" element={<SeccionRoute seccion="inventario"><NuevoProducto /></SeccionRoute>} />
                <Route path="producto/:id/editar" element={<SeccionRoute seccion="inventario"><EditarProducto /></SeccionRoute>} />
                <Route path="balance" element={<SeccionRoute seccion="balance"><Balance /></SeccionRoute>} />
                <Route path="estadisticas" element={<SeccionRoute seccion="estadisticas"><Estadisticas /></SeccionRoute>} />
                <Route path="nueva-venta" element={<SeccionRoute seccion="balance"><RegistrarIngresoForm /></SeccionRoute>} />
                <Route path="nuevo-egreso" element={<SeccionRoute seccion="balance"><RegistrarEgresoForm /></SeccionRoute>} />
                <Route path="venta/:id" element={<SeccionRoute seccion="balance"><DetalleVenta /></SeccionRoute>} />
                <Route path="egreso/:id" element={<SeccionRoute seccion="balance"><DetalleEgreso /></SeccionRoute>} />
                <Route path="proveedores" element={<SeccionRoute seccion="proveedores"><Proveedores /></SeccionRoute>} />
                <Route path="proveedores/nuevo" element={<SeccionRoute seccion="proveedores"><ProveedorForm /></SeccionRoute>} />
                <Route path="proveedores/:id/editar" element={<SeccionRoute seccion="proveedores"><ProveedorForm /></SeccionRoute>} />

                {/* Solo administrador del sistema */}
                <Route path="configuracion" element={<AdminRoute><Configuracion /></AdminRoute>} />
                <Route path="usuarios" element={<AdminRoute><Usuarios /></AdminRoute>} />
                <Route path="roles" element={<AdminRoute><Roles /></AdminRoute>} />
                <Route path="usuarios/nuevo" element={<AdminRoute><UsuarioForm /></AdminRoute>} />
                <Route path="usuarios/:id/editar" element={<AdminRoute><UsuarioForm /></AdminRoute>} />
                <Route path="roles/nuevo" element={<AdminRoute><RolForm /></AdminRoute>} />
                <Route path="roles/:id/editar" element={<AdminRoute><RolForm /></AdminRoute>} />

                {/* Accesibles por todos los roles autenticados */}
                <Route path="producto/:id" element={<DetalleProducto />} />
                <Route path="clientes" element={<Clientes />} />
                <Route path="clientes/nuevo" element={<ClienteForm />} />
                <Route path="clientes/:id/editar" element={<ClienteForm />} />
                <Route path="perfil" element={<Perfil />} />
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
