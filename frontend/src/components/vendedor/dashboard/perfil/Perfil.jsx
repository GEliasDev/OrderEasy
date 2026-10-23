import { useEffect, useState } from 'react';
import { Building2, ImagePlus, Save, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '../../../../api/axiosConfig';
import { useAuth } from '../../../../context/AuthContext';
import { colorAvatar, iniciales } from '../../../../utils/avatar';
import { imagenUrl } from '../../../../config';
import '../pedidos/Pedidos.css';
import './perfil.css';

const PERFIL_VACIO = { primerNombre: '', segundoNombre: '', primerApellido: '', segundoApellido: '', correo: '', telefono: '' };
const EMPRESA_VACIA = { nombre: '', nit: '', telefono: '', direccion: '' };

// Mi perfil: cualquier usuario edita sus datos personales y la información de la empresa
function Perfil() {
  const { user, actualizarUsuario } = useAuth();
  const [perfil, setPerfil] = useState(PERFIL_VACIO);
  const [empresa, setEmpresa] = useState(EMPRESA_VACIA);
  const [cargando, setCargando] = useState(true);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [guardandoEmpresa, setGuardandoEmpresa] = useState(false);
  const [logoActual, setLogoActual] = useState(''); // ruta guardada en el servidor
  const [logoNuevo, setLogoNuevo] = useState(null); // archivo elegido, aún sin guardar
  const [logoPrevia, setLogoPrevia] = useState('');
  const [quitarLogo, setQuitarLogo] = useState(false);

  useEffect(() => {
    Promise.all([axiosInstance.get('/api/usuarios/me'), axiosInstance.get('/api/negocio')])
      .then(([resPerfil, resNegocio]) => {
        setPerfil({ ...PERFIL_VACIO, ...resPerfil.data.perfil });
        const n = resNegocio.data.negocio || {};
        setEmpresa({ nombre: n.nombre || '', nit: n.nit || '', telefono: n.telefono || '', direccion: n.direccion || '' });
        setLogoActual(n.logo || '');
      })
      .catch(() => toast.error('No se pudo cargar tu perfil.'))
      .finally(() => setCargando(false));
  }, []);

  const cambiarPerfil = (e) => setPerfil({ ...perfil, [e.target.name]: e.target.value });
  const cambiarEmpresa = (e) => setEmpresa({ ...empresa, [e.target.name]: e.target.value });

  useEffect(() => () => { if (logoPrevia) URL.revokeObjectURL(logoPrevia); }, [logoPrevia]);

  const elegirLogo = (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) {
      toast.error('El logo debe ser una imagen.');
      return;
    }
    if (archivo.size > 5 * 1024 * 1024) {
      toast.error('El logo pesa más de 5 MB.');
      return;
    }
    setLogoNuevo(archivo);
    setLogoPrevia(URL.createObjectURL(archivo));
    setQuitarLogo(false);
  };

  const quitarLogoElegido = () => {
    setLogoNuevo(null);
    setLogoPrevia('');
    setQuitarLogo(true);
  };

  const logoVisible = logoPrevia || (quitarLogo ? '' : imagenUrl(logoActual || null));
  const hayLogo = Boolean(logoPrevia || (logoActual && !quitarLogo));

  const guardarPerfil = async (e) => {
    e.preventDefault();
    try {
      setGuardandoPerfil(true);
      const { data } = await axiosInstance.put('/api/usuarios/me', perfil);
      setPerfil({ ...PERFIL_VACIO, ...data.perfil });
      actualizarUsuario({ primerNombre: data.perfil.primerNombre, correo: data.perfil.correo }, data.token);
      toast.success('Tus datos se actualizaron.');
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudieron guardar tus datos.');
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const guardarEmpresa = async (e) => {
    e.preventDefault();
    if (!empresa.nombre.trim()) {
      toast.error('El nombre de la empresa es obligatorio.');
      return;
    }
    try {
      setGuardandoEmpresa(true);
      const formData = new FormData();
      Object.entries(empresa).forEach(([clave, valor]) => formData.append(clave, valor));
      if (logoNuevo) formData.append('logo', logoNuevo);
      else if (quitarLogo) formData.append('quitarLogo', 'true');
      const { data } = await axiosInstance.put('/api/negocio', formData);
      actualizarUsuario({ nombreNegocio: data.negocio.nombre });
      setLogoActual(data.negocio.logo || '');
      setLogoNuevo(null);
      setLogoPrevia('');
      setQuitarLogo(false);
      toast.success('La información de la empresa se actualizó.');
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo actualizar la empresa.');
    } finally {
      setGuardandoEmpresa(false);
    }
  };

  const nombreCompleto = [perfil.primerNombre, perfil.segundoNombre, perfil.primerApellido, perfil.segundoApellido].filter(Boolean).join(' ');

  if (cargando) return <div className="view-loading"><div className="loader-spinner-dark" /></div>;

  return (
    <div className="perfil-view">
      <div className="mod-page-header">
        <div>
          <h1 className="mod-page-title">Mi perfil</h1>
          <p className="mod-page-subtitle">Actualiza tus datos personales y la información de la empresa</p>
        </div>
      </div>

      <div className="perfil-resumen">
        <span className="tbl-avatar perfil-avatar" style={{ background: colorAvatar(perfil.primerNombre) }}>
          {iniciales(`${perfil.primerNombre} ${perfil.primerApellido}`)}
        </span>
        <div>
          <div className="perfil-resumen-nombre">{nombreCompleto || 'Usuario'}</div>
          <div className="perfil-resumen-meta">
            {perfil.correo}
            <span className={`tbl-badge ${user?.rol === 'administrador' ? 'tbl-badge--primary' : 'tbl-badge--neutral'}`}>
              {user?.rol === 'administrador' ? 'Administrador' : 'Vendedor'}
            </span>
          </div>
        </div>
      </div>

      <div className="perfil-grid">
        <form className="perfil-card" onSubmit={guardarPerfil}>
          <div className="mod-seccion perfil-card-titulo">
            <span className="mod-seccion-icono"><UserRound size={16} /></span>
            <div className="mod-seccion-textos">
              <h2>Mis datos</h2>
              <p>Tu nombre completo y los datos con los que inicias sesión.</p>
            </div>
          </div>

          <div className="perfil-fila">
            <div className="perfil-campo">
              <label htmlFor="primerNombre">Primer nombre *</label>
              <input id="primerNombre" name="primerNombre" value={perfil.primerNombre} onChange={cambiarPerfil} required minLength={2} maxLength={50} />
            </div>
            <div className="perfil-campo">
              <label htmlFor="segundoNombre">Segundo nombre</label>
              <input id="segundoNombre" name="segundoNombre" value={perfil.segundoNombre} onChange={cambiarPerfil} maxLength={50} />
            </div>
          </div>
          <div className="perfil-fila">
            <div className="perfil-campo">
              <label htmlFor="primerApellido">Primer apellido *</label>
              <input id="primerApellido" name="primerApellido" value={perfil.primerApellido} onChange={cambiarPerfil} required minLength={2} maxLength={50} />
            </div>
            <div className="perfil-campo">
              <label htmlFor="segundoApellido">Segundo apellido</label>
              <input id="segundoApellido" name="segundoApellido" value={perfil.segundoApellido} onChange={cambiarPerfil} maxLength={50} />
            </div>
          </div>
          <div className="perfil-fila">
            <div className="perfil-campo">
              <label htmlFor="correo">Correo *</label>
              <input id="correo" name="correo" type="email" value={perfil.correo} onChange={cambiarPerfil} required maxLength={100} />
            </div>
            <div className="perfil-campo">
              <label htmlFor="telefonoPerfil">Teléfono</label>
              <input id="telefonoPerfil" name="telefono" value={perfil.telefono} onChange={cambiarPerfil} placeholder="3001234567" maxLength={15} />
            </div>
          </div>

          <div className="perfil-acciones">
            <button type="submit" className="pedidos-btn pedidos-btn-primary" disabled={guardandoPerfil}>
              <Save size={14} /><span>{guardandoPerfil ? 'Guardando...' : 'Guardar mis datos'}</span>
            </button>
          </div>
        </form>

        <form className="perfil-card" onSubmit={guardarEmpresa}>
          <div className="mod-seccion perfil-card-titulo">
            <span className="mod-seccion-icono"><Building2 size={16} /></span>
            <div className="mod-seccion-textos">
              <h2>Información de la empresa</h2>
              <p>Aparece en los recibos y en los mensajes que envías a tus clientes.</p>
            </div>
          </div>

          <div className="perfil-logo">
            <div className="perfil-logo-caja">
              {hayLogo ? <img src={logoVisible} alt="Logo de la empresa" /> : <Building2 size={26} />}
            </div>
            <div className="perfil-logo-acciones">
              <span className="perfil-logo-titulo">Logo de la empresa</span>
              <span className="perfil-logo-ayuda">Sale en el encabezado de los recibos. PNG, JPG o WebP, máx. 5 MB.</span>
              <div className="perfil-logo-botones">
                <label className="pedidos-btn pedidos-btn-secundario perfil-logo-subir">
                  <ImagePlus size={14} /><span>{hayLogo ? 'Cambiar logo' : 'Subir logo'}</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={elegirLogo} hidden />
                </label>
                {hayLogo && (
                  <button type="button" className="pedidos-btn pedidos-btn-secundario" onClick={quitarLogoElegido}>
                    <Trash2 size={14} /><span>Quitar</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="perfil-campo">
            <label htmlFor="nombreEmpresa">Nombre de la empresa *</label>
            <input id="nombreEmpresa" name="nombre" value={empresa.nombre} onChange={cambiarEmpresa} required maxLength={100} />
          </div>
          <div className="perfil-fila">
            <div className="perfil-campo">
              <label htmlFor="nit">NIT</label>
              <input id="nit" name="nit" value={empresa.nit} onChange={cambiarEmpresa} placeholder="900123456-7" maxLength={20} />
            </div>
            <div className="perfil-campo">
              <label htmlFor="telefonoEmpresa">Teléfono</label>
              <input id="telefonoEmpresa" name="telefono" value={empresa.telefono} onChange={cambiarEmpresa} placeholder="3001234567" maxLength={20} />
            </div>
          </div>
          <div className="perfil-campo">
            <label htmlFor="direccion">Dirección</label>
            <input id="direccion" name="direccion" value={empresa.direccion} onChange={cambiarEmpresa} placeholder="Calle 123 #45-67" maxLength={255} />
          </div>

          <div className="perfil-acciones">
            <button type="submit" className="pedidos-btn pedidos-btn-primary" disabled={guardandoEmpresa}>
              <Save size={14} /><span>{guardandoEmpresa ? 'Guardando...' : 'Guardar empresa'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Perfil;
