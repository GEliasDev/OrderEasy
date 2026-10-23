import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Edit2, Trash2, ShieldCheck, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '../../../../api/axiosConfig';
import { colorAvatar } from '../../../../utils/avatar';
import { useEsMovil } from '../../../../hooks/useEsMovil';
import ListaMovil from '../../../comunes/ListaMovil';
import PanelInferior, { DatoPanel } from '../../../comunes/PanelInferior';
import '../../../comunes/contactos.css';

const nombreCompleto = (u) => `${u.primer_nombre || ''} ${u.primer_apellido || ''}`.trim();
const inicialesDe = (u) => `${u.primer_nombre?.[0] || ''}${u.primer_apellido?.[0] || ''}`.toUpperCase();
const esAdmin = (u) => u.rol === 'administrador';
const nombreRol = (u) => (esAdmin(u) ? 'Administrador' : u.rolCustom?.nombre || 'Sin rol');

const FilaEsqueleto = () => (
  <tr>{[50, 40, 25, 25, 10].map((w, i) => <td key={i}><span className="ct-esq" style={{ width: `${w}%` }} /></td>)}</tr>
);

const Personal = () => {
  const navigate = useNavigate();
  const esMovil = useEsMovil();
  const [seleccionado, setSeleccionado] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await axiosInstance.get('/api/usuarios');
        setUsuarios(res.data.usuarios || []);
      } catch {
        toast.error('No se pudo cargar la información.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const irACrear = () => navigate('/dashboard/usuarios/nuevo');
  const irAEditar = (u) => navigate(`/dashboard/usuarios/${u.usuarioid}/editar`);

  const eliminar = (u) => {
    toast(`¿Eliminar a ${nombreCompleto(u)}?`, {
      action: {
        label: 'Eliminar',
        onClick: async () => {
          try {
            await axiosInstance.delete(`/api/usuarios/${u.usuarioid}`);
            setUsuarios((prev) => prev.filter((x) => x.usuarioid !== u.usuarioid));
            toast.success('Usuario eliminado.');
          } catch (err) {
            toast.error(err.response?.data?.mensaje || 'Error al eliminar.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
      duration: 5000,
    });
  };

  const ordenados = useMemo(
    () => [...usuarios].sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es')),
    [usuarios]
  );
  const admins = usuarios.filter(esAdmin).length;
  const sinRol = usuarios.filter((u) => !esAdmin(u) && !u.rolCustom).length;

  return (
    <div className="ct-pagina">
      <header className="ct-encabezado">
        <div>
          <h1>Personal <span className="mod-count-badge">{usuarios.length}</span></h1>
          <p>Las personas que usan el sistema, su rol y a qué secciones pueden entrar.</p>
        </div>
        <button type="button" className="ct-btn ct-btn--primario" onClick={irACrear}>
          <Plus size={16} aria-hidden="true" />
          <span>Nuevo usuario</span>
        </button>
      </header>

      <section className="ct-resumen" aria-label="Resumen del personal">
        <div className="ct-dato">
          <span className="ct-dato-icono"><Users size={18} aria-hidden="true" /></span>
          <div><span>Usuarios</span><strong>{usuarios.length}</strong></div>
        </div>
        <div className="ct-dato ct-dato--aviso">
          <span className="ct-dato-icono"><ShieldCheck size={18} aria-hidden="true" /></span>
          <div><span>Administradores</span><strong>{admins}</strong></div>
        </div>
        <div className={`ct-dato ${sinRol > 0 ? 'ct-dato--peligro' : 'ct-dato--ok'}`}>
          <span className="ct-dato-icono"><UserCog size={18} aria-hidden="true" /></span>
          <div><span>Sin rol asignado</span><strong>{sinRol}</strong></div>
        </div>
      </section>

      {esMovil ? (
        <ListaMovil
          items={ordenados}
          clave={(u) => u.usuarioid}
          cargando={loading}
          letras
          vacio="Aún no hay usuarios"
          onAbrir={setSeleccionado}
          fila={(u) => ({
            titulo: nombreCompleto(u),
            subtitulo: u.correo,
            insignia: nombreRol(u),
            tono: esAdmin(u) ? 'aviso' : undefined,
          })}
        />
      ) : (
        <div className="ct-tabla-wrap ct-tabla-wrap--auto">
          <table className="ct-tabla">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Teléfono</th>
                <th>Rol</th>
                <th><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <FilaEsqueleto key={i} />)
              ) : ordenados.length > 0 ? ordenados.map((u) => (
                <tr key={u.usuarioid}>
                  <td>
                    <div className="tbl-main-cell">
                      <span className="tbl-avatar" style={{ background: colorAvatar(u.primer_nombre) }}>{inicialesDe(u)}</span>
                      <div className="tbl-cell-texts"><span className="tbl-cell-primary">{nombreCompleto(u)}</span></div>
                    </div>
                  </td>
                  <td title={u.correo}>{u.correo}</td>
                  <td>{u.telefono || <span className="tbl-vacio">—</span>}</td>
                  <td>
                    <span className={`ct-rol${esAdmin(u) ? ' ct-rol--admin' : !u.rolCustom ? ' ct-rol--sin' : ''}`}>
                      {esAdmin(u) && <ShieldCheck size={12} aria-hidden="true" />}
                      {nombreRol(u)}
                    </span>
                  </td>
                  <td className="ct-acciones">
                    {!esAdmin(u) && (
                      <div className="tbl-actions">
                        <button type="button" className="tbl-icon-btn tbl-icon-btn--editar" title="Editar" aria-label={`Editar a ${nombreCompleto(u)}`} onClick={() => irAEditar(u)}>
                          <Edit2 size={14} />
                        </button>
                        <button type="button" className="tbl-icon-btn tbl-icon-btn--borrar" title="Eliminar" aria-label={`Eliminar a ${nombreCompleto(u)}`} onClick={() => eliminar(u)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="ct-vacio">
                    <Users size={28} style={{ opacity: 0.35 }} aria-hidden="true" />
                    <p>Aún no hay usuarios</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <PanelInferior
        abierto={Boolean(seleccionado)}
        onCerrar={() => setSeleccionado(null)}
        titulo={seleccionado ? nombreCompleto(seleccionado) : ''}
        subtitulo={seleccionado ? nombreRol(seleccionado) : ''}
        acciones={seleccionado && !esAdmin(seleccionado) && (
          <>
            <button type="button" className="pi-accion pi-accion-primaria" onClick={() => { const u = seleccionado; setSeleccionado(null); irAEditar(u); }}><Edit2 size={15} /> Editar</button>
            <button type="button" className="pi-accion pi-accion-peligro" onClick={() => { const u = seleccionado; setSeleccionado(null); eliminar(u); }}><Trash2 size={15} /> Eliminar</button>
          </>
        )}
      >
        {seleccionado && (
          <>
            <DatoPanel etiqueta="Correo" valor={seleccionado.correo} enlace={`mailto:${seleccionado.correo}`} />
            <DatoPanel etiqueta="Teléfono" valor={seleccionado.telefono} enlace={seleccionado.telefono ? `tel:${seleccionado.telefono}` : undefined} />
            <DatoPanel etiqueta="Rol" valor={nombreRol(seleccionado)} />
          </>
        )}
      </PanelInferior>
    </div>
  );
};

export default Personal;
