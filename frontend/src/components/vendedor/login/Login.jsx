import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { loginUser } from '../../../services/authServices';
import { useAuth } from '../../../context/AuthContext';
import { AuthLayout, Campo } from './AuthLayout';

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
        error.response?.data?.mensaje
          || error.message
          || 'Usuario o contraseña incorrectos.',
        { id: toastId }
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      titulo="Iniciar sesión"
      subtitulo="Entra a tu panel para gestionar tu negocio."
      pie={<>¿No tienes cuenta? <Link to="/registro">Regístrate gratis</Link></>}
    >
      <form className="auth-form" onSubmit={handleLogin}>
        <Campo
          etiqueta="Correo electrónico"
          tipo="email"
          id="username"
          name="correo"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="correo@empresa.com"
          required
          autoFocus
        />
        <Campo
          etiqueta="Contraseña"
          tipo="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Tu contraseña"
          required
        />
        <button type="submit" className="auth-boton" disabled={loading}>
          {loading ? 'Iniciando...' : 'Iniciar sesión'}
        </button>
      </form>
    </AuthLayout>
  );
}

export default Login;
