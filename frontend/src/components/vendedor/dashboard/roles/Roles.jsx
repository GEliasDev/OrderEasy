import { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Edit2, Trash2, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '../../../../api/axiosConfig';
import './Roles.css';

const SECCIONES_CONFIG = [
  { key: 'inicio', label: 'Inicio' },
  { key: 'inventario', label: 'Inventario' },
  { key: 'productos', label: 'Productos' },
  { key: 'categorias', label: 'Categorías' },
  { key: 'caja', label: 'Caja' },
  { key: 'balance', label: 'Balance' },
  { key: 'estadisticas', label: 'Estadísticas' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'proveedores', label: 'Proveedores' },
  { key: 'asistente', label: 'Asistente IA' },
];

const FORM_VACIO = { nombre: '', secciones: [] };

const Roles = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { modo: 'crear' | 'editar', rol? }
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      const res = await axiosInstance.get('/api/roles');
      setRoles(res.data.roles || []);
    } catch {
      toast.error('No se pudieron cargar los roles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const abrirCrear = () => {
    setForm(FORM_VACIO);
    setModal({ modo: 'crear' });
  };

  const abrirEditar = (rol) => {
    setForm({
      nombre: rol.nombre,
      secciones: (rol.secciones || []).map((s) => s.seccion),
    });
    setModal({ modo: 'editar', rol });
  };

  const cerrar = () => setModal(null);

  const toggleSeccion = (key) => {
    setForm((prev) => ({
      ...prev,
      secciones: prev.secciones.includes(key)
        ? prev.secciones.filter((s) => s !== key)
        : [...prev.secciones, key],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      toast.error('El nombre del rol es obligatorio.');
      return;
    }
    setGuardando(true);
    try {
      if (modal.modo === 'crear') {
        const res = await axiosInstance.post('/api/roles', form);
        setRoles((prev) => [...prev, res.data.rol]);
        toast.success('Rol creado correctamente.');
      } else {
        const res = await axiosInstance.put(`/api/roles/${modal.rol.rolid}`, form);
        setRoles((prev) => prev.map((r) => r.rolid === modal.rol.rolid ? res.data.rol : r));
        toast.success('Rol actualizado correctamente.');
      }
      cerrar();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al guardar el rol.');
    } finally {
      setGuardando(false);
    }
  };

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

  const seccionesDeRol = (rol) =>
    (rol.secciones || []).map((s) => {
      const found = SECCIONES_CONFIG.find((c) => c.key === s.seccion);
      return found?.label || s.seccion;
    });

  if (loading) {
    return <div className="roles-loading"><div className="roles-spinner" /></div>;
  }

  return (
    <div className="roles-view">
      <div className="roles-header">
        <div className="roles-header-icon"><ShieldCheck size={20} /></div>
        <div className="roles-header-text">
          <h1>Roles</h1>
          <p>Define roles y controla el acceso de cada usuario</p>
        </div>
        <button className="roles-btn-nuevo" onClick={abrirCrear}>
          <Plus size={14} />
          <span>Nuevo rol</span>
        </button>
      </div>

      {roles.length === 0 ? (
        <div className="roles-empty">
          <ShieldCheck size={36} className="roles-empty-icon" />
          <p>No hay roles creados todavía.</p>
          <button className="roles-btn-nuevo" onClick={abrirCrear}>
            <Plus size={14} /> Crear primer rol
          </button>
        </div>
      ) : (
        <div className="roles-lista">
          {roles.map((rol) => {
            const etiquetas = seccionesDeRol(rol);
            return (
              <div key={rol.rolid} className="roles-card">
                <div className="roles-card-top">
                  <div className="roles-card-nombre">{rol.nombre}</div>
                  <div className="roles-card-acciones">
                    <button className="roles-btn-icon" onClick={() => abrirEditar(rol)} title="Editar">
                      <Edit2 size={14} />
                    </button>
                    <button className="roles-btn-icon danger" onClick={() => eliminar(rol)} title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="roles-card-secciones">
                  {etiquetas.length === 0 ? (
                    <span className="roles-sin-secciones">Sin secciones asignadas</span>
                  ) : (
                    etiquetas.map((label) => (
                      <span key={label} className="roles-seccion-tag">{label}</span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="roles-overlay" onClick={cerrar}>
          <div className="roles-modal" onClick={(e) => e.stopPropagation()}>
            <div className="roles-modal-header">
              <h3>{modal.modo === 'crear' ? 'Nuevo rol' : 'Editar rol'}</h3>
              <button className="roles-modal-close" onClick={cerrar}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} className="roles-form">
              <div className="roles-form-group">
                <label>Nombre del rol *</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Cajero, Supervisor..."
                  required
                />
              </div>

              <div className="roles-form-group">
                <label>Secciones accesibles</label>
                <div className="roles-secciones-grid">
                  {SECCIONES_CONFIG.map(({ key, label }) => {
                    const activo = form.secciones.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`roles-seccion-toggle ${activo ? 'activo' : ''}`}
                        onClick={() => toggleSeccion(key)}
                      >
                        <span className="roles-seccion-check">
                          {activo && <Check size={10} />}
                        </span>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="roles-form-actions">
                <button type="button" className="roles-btn-cancelar" onClick={cerrar}>Cancelar</button>
                <button type="submit" className="roles-btn-guardar" disabled={guardando}>
                  {guardando ? 'Guardando...' : modal.modo === 'crear' ? 'Crear rol' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Roles;
