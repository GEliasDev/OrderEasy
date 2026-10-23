import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { registerUser } from '../../../services/authServices';
import { AuthLayout, Campo } from './AuthLayout';

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
  const [errorClave, setErrorClave] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value
    }));
    if (name === 'password' || name === 'confirmPassword') setErrorClave('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setErrorClave('Las contraseñas no coinciden.');
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
    <AuthLayout
      ancho
      titulo="Crea la cuenta de tu negocio"
      subtitulo="Es gratis. Registras tu negocio y tu usuario administrador en un solo paso."
      pie={<>¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></>}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <fieldset className="auth-grupo">
          <legend>Tu negocio</legend>
          <div className="auth-fila">
            <Campo etiqueta="Nombre del negocio" name="nombreNegocio" autoComplete="organization" value={formData.nombreNegocio} onChange={handleChange} placeholder="Nombre de tu empresa" required />
            <Campo etiqueta="NIT / RUT" name="nit" value={formData.nit} onChange={handleChange} placeholder="900123456-1" required />
          </div>
        </fieldset>

        <fieldset className="auth-grupo">
          <legend>Administrador</legend>
          <div className="auth-fila">
            <Campo etiqueta="Primer nombre" name="primerNombre" autoComplete="given-name" value={formData.primerNombre} onChange={handleChange} placeholder="Juan" required />
            <Campo etiqueta="Primer apellido" name="primerApellido" autoComplete="family-name" value={formData.primerApellido} onChange={handleChange} placeholder="Pérez" required />
            <Campo etiqueta="Correo electrónico" tipo="email" name="correo" autoComplete="email" value={formData.correo} onChange={handleChange} placeholder="correo@empresa.com" required />
            <Campo etiqueta="Teléfono" tipo="tel" name="telefono" autoComplete="tel" inputMode="tel" value={formData.telefono} onChange={handleChange} placeholder="3001234567" required />
            <Campo etiqueta="Contraseña" tipo="password" name="password" autoComplete="new-password" value={formData.password} onChange={handleChange} placeholder="Crea una contraseña" required />
            <Campo
              etiqueta="Confirmar contraseña"
              tipo="password"
              name="confirmPassword"
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Repite la contraseña"
              aria-invalid={Boolean(errorClave)}
              ayuda={errorClave || undefined}
              required
            />
          </div>
        </fieldset>

        <button type="submit" className="auth-boton" disabled={loading}>
          {loading ? 'Registrando...' : 'Crear cuenta'}
        </button>
      </form>
    </AuthLayout>
  );
}

export default Registro;
