import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import axiosInstance from '../../../../api/axiosConfig';
import EncabezadoPagina from '../../../comunes/EncabezadoPagina';
import '../../../comunes/contactos.css';

const VACIO = { primerNombre: '', primerApellido: '', correo: '', telefono: '', contraseña: '', rolid: '' };
const RUTA_LISTA = '/dashboard/usuarios';

// Crear o editar un usuario del negocio: pantalla completa (ruta), no ventana emergente
function UsuarioForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editando = Boolean(id);
  const [form, setForm] = useState(VACIO);
  const [roles, setRoles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [uRes, rRes] = await Promise.all([axiosInstance.get('/api/usuarios'), axiosInstance.get('/api/roles')]);
        setRoles(rRes.data.roles || []);
        if (editando) {
          const u = (uRes.data.usuarios || []).find((x) => String(x.usuarioid) === String(id));
          if (!u || u.rol === 'administrador') {
            toast.error(u ? 'El administrador no se edita desde aquí.' : 'No se encontró el usuario.');
            navigate(RUTA_LISTA, { replace: true });
            return;
          }
          setForm({
            primerNombre: u.primer_nombre || '',
            primerApellido: u.primer_apellido || '',
            correo: u.correo || '',
            telefono: u.telefono || '',
            contraseña: '',
            rolid: u.rolid || '',
          });
        }
      } catch {
        toast.error('No se pudo cargar la información.');
        navigate(RUTA_LISTA, { replace: true });
      } finally {
        setCargando(false);
      }
    })();
  }, [id, editando, navigate]);

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const payload = { ...form, rolid: form.rolid || null };
      if (editando) {
        await axiosInstance.put(`/api/usuarios/${id}`, payload);
        toast.success('Usuario actualizado correctamente.');
      } else {
        await axiosInstance.post('/api/usuarios', payload);
        toast.success('Usuario creado correctamente.');
      }
      navigate(RUTA_LISTA);
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al guardar el usuario.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <div className="view-loading"><div className="loader-spinner-dark" /></div>;

  return (
    <div className="ct-form-pagina">
      <EncabezadoPagina onVolver={() => navigate(RUTA_LISTA)} migas={<>Configuración / Personal / {editando ? 'Editar' : 'Nuevo'}</>}>
        {editando ? 'Editar usuario' : 'Nuevo usuario'}
      </EncabezadoPagina>

      <form className="ct-form" onSubmit={guardar}>
        <section className="ct-form-tarjeta">
          <h2>Datos personales</h2>
          <div className="ct-campos">
            <div className="ct-campo">
              <label htmlFor="usr-nombre">Nombre *</label>
              <input id="usr-nombre" name="primerNombre" value={form.primerNombre} onChange={cambiar} required autoFocus placeholder="Nombre" />
            </div>
            <div className="ct-campo">
              <label htmlFor="usr-apellido">Apellido *</label>
              <input id="usr-apellido" name="primerApellido" value={form.primerApellido} onChange={cambiar} required placeholder="Apellido" />
            </div>
            <div className="ct-campo">
              <label htmlFor="usr-correo">Correo *</label>
              <input id="usr-correo" name="correo" type="email" value={form.correo} onChange={cambiar} required placeholder="correo@email.com" />
            </div>
            <div className="ct-campo">
              <label htmlFor="usr-telefono">Teléfono <span className="campo-opcional">(opcional)</span></label>
              <input id="usr-telefono" name="telefono" type="tel" inputMode="tel" value={form.telefono} onChange={cambiar} placeholder="3001234567" />
            </div>
          </div>
        </section>

        <section className="ct-form-tarjeta">
          <h2>Acceso</h2>
          <p>Con la contraseña inicia sesión; el rol define a qué secciones puede entrar.</p>
          <div className="ct-campos">
            <div className="ct-campo ct-campo--completo">
              <label htmlFor="usr-clave">
                {editando ? 'Nueva contraseña' : 'Contraseña *'}
                {editando && <span className="campo-opcional"> (vacío = no cambiar)</span>}
              </label>
              <input id="usr-clave" name="contraseña" type="password" autoComplete="new-password" value={form.contraseña} onChange={cambiar} required={!editando} placeholder="••••••••" />
            </div>
            <div className="ct-campo ct-campo--completo">
              <label htmlFor="usr-rol">Rol</label>
              <select id="usr-rol" name="rolid" value={form.rolid} onChange={cambiar}>
                <option value="">Sin rol asignado</option>
                {roles.map((r) => <option key={r.rolid} value={r.rolid}>{r.nombre}</option>)}
              </select>
            </div>
          </div>
        </section>

        <div className="ct-form-acciones">
          <button type="button" className="ct-btn ct-btn--neutro" onClick={() => navigate(RUTA_LISTA)}>Cancelar</button>
          <button type="submit" className="ct-btn ct-btn--primario" disabled={guardando}>
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default UsuarioForm;
