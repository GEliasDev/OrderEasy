import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { toast } from 'sonner';
import { registerUser } from '../../../services/authServices';
import './styles/Registro.css';
import logo from './LoginAssets/logo.png'

function Registro() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nombreNegocio: '',
    nit: '',
    primerNombre: '',
    primerApellido: '',
    correo: '',
    telefono: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Registrando negocio...');

    try {
      await registerUser({
        nombreNegocio: formData.nombreNegocio,
        nit: formData.nit,
        primerNombre: formData.primerNombre,
        primerApellido: formData.primerApellido,
        correo: formData.correo,
        telefono: formData.telefono,
        contraseña: formData.password
      });

      toast.success('Negocio registrado. Redirigiendo al login...', { id: toastId });
      setTimeout(() => navigate('/login'), 1500);

    } catch (error) {
      toast.error(error.response?.data?.mensaje || error.message || 'Ocurrió un problema al registrar el negocio.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="registro-container">
      <button
        className="boton-home"
        onClick={() => navigate('/')}
      >
        <Home className="icono-home" />
        <span>Volver al Inicio</span>
      </button>
      <div className="registro-wrapper">
        <div className="imagen-seccion">
          <div className="imagen-overlay" />
          <img
            src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2340&q=80"
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
              <h2>Registro de Negocio</h2>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Campos de Negocio */}
              <div className="input-grupo">
                <label htmlFor="nombreNegocio">Nombre del Negocio</label>
                <input
                  type="text"
                  id="nombreNegocio"
                  name="nombreNegocio"
                  value={formData.nombreNegocio}
                  onChange={handleChange}
                  placeholder="Nombre de tu empresa"
                  required
                />
              </div>

              <div className="input-grupo">
                <label htmlFor="nit">NIT / RUT</label>
                <input
                  type="text"
                  id="nit"
                  name="nit"
                  value={formData.nit}
                  onChange={handleChange}
                  placeholder="900123456-1"
                  required
                />
              </div>

              {/* Campos de Usuario */}
              <div className="grupo-inputs">
                <div className="input-grupo">
                  <label htmlFor="primerNombre">Primer Nombre</label>
                  <input
                    type="text"
                    id="primerNombre"
                    name="primerNombre"
                    value={formData.primerNombre}
                    onChange={handleChange}
                    placeholder="Juan"
                    required
                  />
                </div>

                <div className="input-grupo">
                  <label htmlFor="primerApellido">Primer Apellido</label>
                  <input
                    type="text"
                    id="primerApellido"
                    name="primerApellido"
                    value={formData.primerApellido}
                    onChange={handleChange}
                    placeholder="Pérez"
                    required
                  />
                </div>
              </div>

              <div className="input-grupo">
                <label htmlFor="correo">Correo Electrónico</label>
                <input
                  type="email"
                  id="correo"
                  name="correo"
                  value={formData.correo}
                  onChange={handleChange}
                  placeholder="correo@empresa.com"
                  required
                />
              </div>

              <div className="input-grupo">
                <label htmlFor="telefono">Teléfono</label>
                <input
                  type="tel"
                  id="telefono"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  placeholder="+1234567890"
                  required
                />
              </div>

              <div className="input-grupo">
                <label htmlFor="password">Contraseña</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="input-grupo">
                <label htmlFor="confirmPassword">Confirmar Contraseña</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                />
              </div>

              <button type="submit" className="boton-submit" disabled={loading}>
                {loading ? 'Registrando...' : 'Crear Cuenta'}
              </button>
            </form>

            <div className="volver-login">
              <button
                className="boton-volver"
                onClick={() => navigate('/login')}
              >
                ¿Ya tienes cuenta? Iniciar Sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Registro;