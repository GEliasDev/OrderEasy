import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '../../../../api/axiosConfig';
import EncabezadoPagina from '../../../comunes/EncabezadoPagina';
import { SECCIONES_CONFIG } from './secciones';
import '../../../comunes/contactos.css';
import './Roles.css';

const RUTA_LISTA = '/dashboard/roles';

// Crear o editar un rol: pantalla completa (ruta), no ventana emergente
function RolForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editando = Boolean(id);
  const [nombre, setNombre] = useState('');
  const [secciones, setSecciones] = useState([]);
  const [cargando, setCargando] = useState(editando);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!editando) return;
    (async () => {
      try {
        const res = await axiosInstance.get('/api/roles');
        const rol = (res.data.roles || []).find((r) => String(r.rolid) === String(id));
        if (!rol) {
          toast.error('No se encontró el rol.');
          navigate(RUTA_LISTA, { replace: true });
          return;
        }
        setNombre(rol.nombre);
        setSecciones((rol.secciones || []).map((s) => s.seccion));
      } catch {
        toast.error('No se pudo cargar el rol.');
        navigate(RUTA_LISTA, { replace: true });
      } finally {
        setCargando(false);
      }
    })();
  }, [id, editando, navigate]);

  const alternar = (clave) =>
    setSecciones((prev) => (prev.includes(clave) ? prev.filter((s) => s !== clave) : [...prev, clave]));

  const todas = secciones.length === SECCIONES_CONFIG.length;
  const alternarTodas = () => setSecciones(todas ? [] : SECCIONES_CONFIG.map((s) => s.key));

  const guardar = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error('El nombre del rol es obligatorio.');
      return;
    }
    setGuardando(true);
    try {
      const payload = { nombre, secciones };
      if (editando) {
        await axiosInstance.put(`/api/roles/${id}`, payload);
        toast.success('Rol actualizado correctamente.');
      } else {
        await axiosInstance.post('/api/roles', payload);
        toast.success('Rol creado correctamente.');
      }
      navigate(RUTA_LISTA);
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al guardar el rol.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <div className="view-loading"><div className="loader-spinner-dark" /></div>;

  return (
    <div className="ct-form-pagina">
      <EncabezadoPagina onVolver={() => navigate(RUTA_LISTA)} migas={<>Configuración / Roles / {editando ? 'Editar' : 'Nuevo'}</>}>
        {editando ? 'Editar rol' : 'Nuevo rol'}
      </EncabezadoPagina>

      <form className="ct-form" onSubmit={guardar}>
        <section className="ct-form-tarjeta ct-form-tarjeta--ancha">
          <h2>Nombre del rol</h2>
          <div className="ct-campos">
            <div className="ct-campo ct-campo--completo">
              <label htmlFor="rol-nombre">Nombre *</label>
              <input id="rol-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus placeholder="Ej: Cajero, Supervisor..." />
            </div>
          </div>
        </section>

        <section className="ct-form-tarjeta ct-form-tarjeta--ancha">
          <div className="rol-selector-cabecera">
            <div>
              <h2>Secciones accesibles</h2>
              <p>{secciones.length} de {SECCIONES_CONFIG.length} seleccionadas</p>
            </div>
            <button type="button" className="rol-todas" onClick={alternarTodas}>{todas ? 'Quitar todas' : 'Seleccionar todas'}</button>
          </div>
          <div className="rol-opciones">
            {SECCIONES_CONFIG.map(({ key, label }) => {
              const activa = secciones.includes(key);
              return (
                <label key={key} className={`rol-opcion${activa ? ' activa' : ''}`}>
                  <input type="checkbox" checked={activa} onChange={() => alternar(key)} />
                  <span className="rol-caja" aria-hidden="true">{activa && <Check size={13} strokeWidth={3} />}</span>
                  {label}
                </label>
              );
            })}
          </div>
        </section>

        <div className="ct-form-acciones">
          <button type="button" className="ct-btn ct-btn--neutro" onClick={() => navigate(RUTA_LISTA)}>Cancelar</button>
          <button type="submit" className="ct-btn ct-btn--primario" disabled={guardando}>
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear rol'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default RolForm;
