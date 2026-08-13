import { useState, useEffect } from 'react';
import { Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { loginUser } from '../../../services/authServices';
import { useAuth } from '../../../context/AuthContext';
import './styles/Login.css';
import logo from './LoginAssets/logo.png';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard/inicio', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error('Por favor, completa todos los campos.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Iniciando sesión...');

    try {
      const data = await loginUser(username, password);
      login(data);
      toast.success('¡Bienvenido al panel de control!', { id: toastId });
      navigate('/dashboard/inicio');
    } catch (error) {
      toast.error(
        error.response?.data?.mensaje || 'Usuario o contraseña incorrectos.',
        { id: toastId }
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <button className="boton-home" onClick={() => navigate('/')}>
        <Home className="icono-home" />
        <span>Volver al Inicio</span>
      </button>

      <div className="login-wrapper">
        <div className="imagen-seccion">
          <div className="imagen-overlay" />
          <img
            src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2340&q=80"
            alt="Gestión de Inventario"
            className="imagen-fondo"
          />
          <div className="imagen-contenido">
            <h2>Sistema de Gestión de Inventarios</h2>
            <p>Optimiza tu inventario y mejora la eficiencia de tu negocio con nuestra solución gratuita.</p>
          </div>
        </div>

        <div className="formulario-seccion">
          <div className="formulario-contenedor">
            <div className="encabezado">
              <button className="logo-boton" onClick={() => navigate('/')}>
                <img src={logo} alt="Logo" className="logo-login" />
              </button>
              <h2>Iniciar Sesión</h2>
            </div>

            <form onSubmit={handleLogin}>
              <div className="input-grupo">
                <label htmlFor="username">Correo Electrónico</label>
                <input
                  type="email"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="correo@empresa.com"
                  required
                />
              </div>

              <div className="input-grupo">
                <label htmlFor="password">Contraseña</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <button type="submit" className="boton-submit" disabled={loading}>
                {loading ? 'Iniciando...' : 'Iniciar Sesión'}
              </button>
            </form>

            <div className="registro-link">
              <button className="boton-registro" onClick={() => navigate('/registro')}>
                ¿No tienes cuenta? Regístrate
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
