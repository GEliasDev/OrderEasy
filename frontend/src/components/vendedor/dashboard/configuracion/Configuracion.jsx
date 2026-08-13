import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Users, ShieldCheck, ChevronRight, Building2, Edit2, History } from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '../../../../api/axiosConfig';
import './configuracion.css';

const Configuracion = () => {
  const navigate = useNavigate();
  const [negocio, setNegocio] = useState(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({ nombre: '', nit: '', telefono: '', direccion: '' });

  useEffect(() => {
    axiosInstance
      .get('/api/negocio')
      .then((res) => setNegocio(res.data.negocio))
      .catch(() => {});
  }, []);

  const abrirEditar = () => {
    setForm({
      nombre: negocio?.nombre || '',
      nit: negocio?.nit || '',
      telefono: negocio?.telefono || '',
      direccion: negocio?.direccion || '',
    });
    setMostrarModal(true);
  };

  const cerrarModal = () => setMostrarModal(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const res = await axiosInstance.put('/api/negocio', form);
      setNegocio(res.data.negocio);
      cerrarModal();
      toast.success('Negocio actualizado correctamente.');
    } catch {
      toast.error('No se pudo actualizar el negocio.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="config-view">
      <div className="config-header">
        <div className="config-header-icon">
          <Settings size={20} />
        </div>
        <div className="config-header-text">
          <h1>Configuración</h1>
          <p>Administra el negocio y las opciones del sistema</p>
        </div>
      </div>

      {/* ── Negocio ── */}
      <p className="config-section-label">Negocio</p>
      <div className="config-negocio-card">
        <div className="config-negocio-icon">
          <Building2 size={20} />
        </div>
        <div className="config-negocio-info">
          <div className="config-negocio-nombre">{negocio?.nombre || '—'}</div>
          <div className="config-negocio-meta">
            {negocio?.nit && <span>NIT {negocio.nit}</span>}
            {negocio?.telefono && <span>{negocio.telefono}</span>}
            {negocio?.direccion && <span>{negocio.direccion}</span>}
          </div>
        </div>
        <button className="config-negocio-btn" onClick={abrirEditar}>
          <Edit2 size={13} />
          <span>Editar</span>
        </button>
      </div>

      {/* ── Gestión ── */}
      <p className="config-section-label" style={{ marginTop: '1.5rem' }}>Gestión</p>
      <div className="config-cards-grid">

        <div className="config-card">
          <div className="config-card-icon">
            <Users size={20} />
          </div>
          <div className="config-card-body">
            <h3 className="config-card-title">Personal</h3>
            <p className="config-card-desc">
              Gestiona los usuarios registrados en el sistema: edita datos y administra el acceso.
            </p>
          </div>
          <button className="config-card-btn" onClick={() => navigate('/dashboard/usuarios')}>
            <span>Gestionar</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="config-card">
          <div className="config-card-icon">
            <ShieldCheck size={20} />
          </div>
          <div className="config-card-body">
            <h3 className="config-card-title">Roles y Permisos</h3>
            <p className="config-card-desc">
              Define roles personalizados y controla a qué secciones tiene acceso cada usuario.
            </p>
          </div>
          <button className="config-card-btn" onClick={() => navigate('/dashboard/roles')}>
            <span>Gestionar</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="config-card">
          <div className="config-card-icon">
            <History size={20} />
          </div>
          <div className="config-card-body">
            <h3 className="config-card-title">Historial de Turnos</h3>
            <p className="config-card-desc">
              Consulta los turnos de caja registrados: apertura, cierre, ventas por método y diferencias de efectivo.
            </p>
          </div>
          <button className="config-card-btn" onClick={() => navigate('/dashboard/turnos')}>
            <span>Ver historial</span>
            <ChevronRight size={14} />
          </button>
        </div>

      </div>

      {/* ── Modal editar negocio ── */}
      {mostrarModal && (
        <div className="config-overlay" onClick={cerrarModal}>
          <div className="config-modal" onClick={(e) => e.stopPropagation()}>
            <div className="config-modal-header">
              <h3>Editar negocio</h3>
              <button className="config-modal-close" onClick={cerrarModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="config-form">
              <div className="config-form-group">
                <label>Nombre del negocio *</label>
                <input name="nombre" value={form.nombre} onChange={handleChange} required placeholder="Mi Negocio" />
              </div>
              <div className="config-form-row">
                <div className="config-form-group">
                  <label>NIT</label>
                  <input name="nit" value={form.nit} onChange={handleChange} placeholder="900123456-7" />
                </div>
                <div className="config-form-group">
                  <label>Teléfono</label>
                  <input name="telefono" value={form.telefono} onChange={handleChange} placeholder="3001234567" />
                </div>
              </div>
              <div className="config-form-group">
                <label>Dirección</label>
                <input name="direccion" value={form.direccion} onChange={handleChange} placeholder="Calle 123 #45-67" />
              </div>
              <div className="config-form-actions">
                <button type="button" className="config-btn-cancelar" onClick={cerrarModal}>Cancelar</button>
                <button type="submit" className="config-btn-guardar" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Configuracion;
