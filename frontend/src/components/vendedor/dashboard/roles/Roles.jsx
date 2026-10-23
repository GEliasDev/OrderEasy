import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Plus, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '../../../../api/axiosConfig';
import { SECCIONES_CONFIG } from './secciones';
import '../../../comunes/contactos.css';
import './Roles.css';

const etiquetaDe = (clave) => SECCIONES_CONFIG.find((c) => c.key === clave)?.label || clave;

const Roles = () => {
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await axiosInstance.get('/api/roles');
        setRoles(res.data.roles || []);
      } catch {
        toast.error('No se pudieron cargar los roles.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const irACrear = () => navigate('/dashboard/roles/nuevo');
  const irAEditar = (rol) => navigate(`/dashboard/roles/${rol.rolid}/editar`);

  const eliminar = (rol) => {
    toast(`¿Eliminar el rol "${rol.nombre}"?`, {
      action: {
        label: 'Eliminar',
        onClick: async () => {
          try {
            await axiosInstance.delete(`/api/roles/${rol.rolid}`);
            setRoles((prev) => prev.filter((r) => r.rolid !== rol.rolid));
            toast.success('Rol eliminado.');
          } catch (err) {
            toast.error(err.response?.data?.mensaje || 'Error al eliminar.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
      duration: 5000,
    });
  };

  return (
    <div className="ct-pagina rol-pagina">
      <header className="ct-encabezado">
        <div>
          <h1>Roles y permisos <span className="mod-count-badge">{roles.length}</span></h1>
          <p>Crea roles y elige a qué secciones puede entrar cada uno. El administrador siempre tiene acceso a todo.</p>
        </div>
        <button type="button" className="ct-btn ct-btn--primario" onClick={irACrear}>
          <Plus size={16} aria-hidden="true" />
          <span>Nuevo rol</span>
        </button>
      </header>

      {loading ? (
        <div className="rol-grid" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="rol-tarjeta rol-tarjeta--esq" />)}
        </div>
      ) : roles.length === 0 ? (
        <div className="rol-vacio">
          <span className="rol-vacio-icono"><ShieldCheck size={26} aria-hidden="true" /></span>
          <h2>Aún no hay roles</h2>
          <p>Con un rol decides qué ve cada persona de tu equipo, por ejemplo un cajero que solo vende.</p>
          <button type="button" className="ct-btn ct-btn--primario" onClick={irACrear}>
            <Plus size={16} aria-hidden="true" />
            <span>Crear el primer rol</span>
          </button>
        </div>
      ) : (
        <div className="rol-grid">
          {roles.map((rol) => {
            const secciones = (rol.secciones || []).map((s) => etiquetaDe(s.seccion));
            return (
              <article key={rol.rolid} className="rol-tarjeta">
                <header>
                  <span className="rol-icono"><ShieldCheck size={18} aria-hidden="true" /></span>
                  <div>
                    <h2>{rol.nombre}</h2>
                    <span className="rol-conteo">{secciones.length} de {SECCIONES_CONFIG.length} secciones</span>
                  </div>
                  <div className="tbl-actions">
                    <button type="button" className="tbl-icon-btn tbl-icon-btn--editar" title="Editar" aria-label={`Editar el rol ${rol.nombre}`} onClick={() => irAEditar(rol)}>
                      <Edit2 size={14} />
                    </button>
                    <button type="button" className="tbl-icon-btn tbl-icon-btn--borrar" title="Eliminar" aria-label={`Eliminar el rol ${rol.nombre}`} onClick={() => eliminar(rol)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </header>
                <div className="rol-secciones">
                  {secciones.length === 0
                    ? <span className="rol-sin">Sin secciones asignadas</span>
                    : secciones.map((s) => <span key={s} className="rol-etiqueta">{s}</span>)}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Roles;
