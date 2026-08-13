import { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, X, User, Mail, Phone, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '../../../../api/axiosConfig';
import './Usuarios.css';

const VACIO = { primerNombre: '', primerApellido: '', correo: '', telefono: '', contraseña: '', rolid: '' };

const Personal = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { modo: 'crear' | 'editar', usuario? }
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      const [uRes, rRes] = await Promise.all([
        axiosInstance.get('/api/usuarios'),
        axiosInstance.get('/api/roles'),
      ]);
      setUsuarios(uRes.data.usuarios || []);
      setRoles(rRes.data.roles || []);
    } catch {
      toast.error('No se pudo cargar la información.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const abrirCrear = () => {
    setForm(VACIO);
    setModal({ modo: 'crear' });
  };

  const abrirEditar = (u) => {
    setForm({
      primerNombre: u.primer_nombre || '',
      primerApellido: u.primer_apellido || '',
      correo: u.correo || '',
      telefono: u.telefono || '',
      contraseña: '',
      rolid: u.rolid || '',
    });
    setModal({ modo: 'editar', usuario: u });
  };

  const cerrar = () => setModal(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const payload = { ...form, rolid: form.rolid || null };
      if (modal.modo === 'crear') {
        const res = await axiosInstance.post('/api/usuarios', payload);
        setUsuarios((prev) => [...prev, res.data.usuario]);
        toast.success('Usuario creado correctamente.');
      } else {
        const res = await axiosInstance.put(`/api/usuarios/${modal.usuario.usuarioid}`, payload);
        setUsuarios((prev) => prev.map((u) => u.usuarioid === modal.usuario.usuarioid ? res.data.usuario : u));
        toast.success('Usuario actualizado correctamente.');
      }
      cerrar();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al guardar el usuario.');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = (u) => {
    toast(`¿Eliminar a ${u.primer_nombre} ${u.primer_apellido}?`, {
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

  const iniciales = (u) =>
    `${u.primer_nombre?.[0] || ''}${u.primer_apellido?.[0] || ''}`.toUpperCase();

  const nombreRol = (u) => {
    if (u.rol === 'administrador') return 'Administrador';
    return u.rolCustom?.nombre || 'Sin rol';
  };

  if (loading) {
    return <div className="personal-loading"><div className="personal-spinner" /></div>;
  }

  return (
    <div className="personal-view">
      <div className="personal-header">
        <div className="personal-header-icon"><Users size={20} /></div>
        <div className="personal-header-text">
          <h1>Personal</h1>
          <p>Gestiona los usuarios del negocio</p>
        </div>
        <button className="personal-btn-nuevo" onClick={abrirCrear}>
          <Plus size={14} />
          <span>Nuevo usuario</span>
        </button>
      </div>

      <div className="personal-lista">
        {usuarios.map((u) => (
          <div key={u.usuarioid} className="personal-card">
            <div className="personal-card-top">
              <div className="personal-avatar">{iniciales(u)}</div>
              <div className="personal-card-info">
                <div className="personal-nombre">{u.primer_nombre} {u.primer_apellido}</div>
                <span className={`personal-role-badge ${u.rol === 'administrador' ? 'admin' : ''}`}>
                  <ShieldCheck size={10} />
                  {nombreRol(u)}
                </span>
              </div>
              {u.rol !== 'administrador' && (
                <div className="personal-acciones">
                  <button className="personal-btn-icon" onClick={() => abrirEditar(u)} title="Editar">
                    <Edit2 size={14} />
                  </button>
                  <button className="personal-btn-icon danger" onClick={() => eliminar(u)} title="Eliminar">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>

            <div className="personal-divider" />

            <div className="personal-fields">
              <div className="personal-field">
                <span className="personal-field-label"><Mail size={12} /> Correo</span>
                <span className="personal-field-value">{u.correo}</span>
              </div>
              {u.telefono && (
                <div className="personal-field">
                  <span className="personal-field-label"><Phone size={12} /> Teléfono</span>
                  <span className="personal-field-value">{u.telefono}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="personal-overlay" onClick={cerrar}>
          <div className="personal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="personal-modal-header">
              <h3>{modal.modo === 'crear' ? 'Nuevo usuario' : 'Editar usuario'}</h3>
              <button className="personal-modal-close" onClick={cerrar}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} className="personal-form">
              <div className="personal-form-row">
                <div className="personal-form-group">
                  <label>Nombre *</label>
                  <input name="primerNombre" value={form.primerNombre} onChange={handleChange} required placeholder="Nombre" />
                </div>
                <div className="personal-form-group">
                  <label>Apellido *</label>
                  <input name="primerApellido" value={form.primerApellido} onChange={handleChange} required placeholder="Apellido" />
                </div>
              </div>
              <div className="personal-form-row">
                <div className="personal-form-group">
                  <label>Correo *</label>
                  <input name="correo" type="email" value={form.correo} onChange={handleChange} required placeholder="correo@email.com" />
                </div>
                <div className="personal-form-group">
                  <label>Teléfono</label>
                  <input name="telefono" value={form.telefono} onChange={handleChange} placeholder="3001234567" />
                </div>
              </div>
              <div className="personal-form-group">
                <label>
                  {modal.modo === 'crear' ? 'Contraseña *' : 'Nueva contraseña'}
                  {modal.modo === 'editar' && <span className="personal-label-hint"> (vacío = no cambiar)</span>}
                </label>
                <input name="contraseña" type="password" value={form.contraseña} onChange={handleChange} required={modal.modo === 'crear'} placeholder="••••••••" />
              </div>
              <div className="personal-form-group">
                <label>Rol</label>
                <select name="rolid" value={form.rolid} onChange={handleChange}>
                  <option value="">Sin rol asignado</option>
                  {roles.map((r) => (
                    <option key={r.rolid} value={r.rolid}>{r.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="personal-form-actions">
                <button type="button" className="personal-btn-cancelar" onClick={cerrar}>Cancelar</button>
                <button type="submit" className="personal-btn-guardar" disabled={guardando}>
                  {guardando ? 'Guardando...' : modal.modo === 'crear' ? 'Crear usuario' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Personal;
