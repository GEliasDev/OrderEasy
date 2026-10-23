import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Users, ShieldCheck, ChevronRight, Building2, Edit2 } from 'lucide-react';
import axiosInstance from '../../../../api/axiosConfig';
import './configuracion.css';

const Configuracion = () => {
  const navigate = useNavigate();
  const [negocio, setNegocio] = useState(null);

  useEffect(() => {
    axiosInstance
      .get('/api/negocio')
      .then((res) => setNegocio(res.data.negocio))
      .catch(() => {});
  }, []);

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
        <button className="config-negocio-btn" onClick={() => navigate('/dashboard/perfil')}>
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

      </div>
    </div>
  );
};

export default Configuracion;
