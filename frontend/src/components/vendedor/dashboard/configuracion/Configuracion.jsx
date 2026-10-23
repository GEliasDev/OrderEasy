import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ShieldCheck, ChevronRight, Building2, Pencil, UserRound, ImagePlus } from 'lucide-react';
import { getNegocio } from '../../../../services/negocioService';
import { imagenUrl } from '../../../../config';
import './configuracion.css';

const OPCIONES = [
  {
    ruta: '/dashboard/usuarios',
    icono: Users,
    titulo: 'Personal',
    texto: 'Los usuarios registrados en el sistema: edita sus datos y administra su acceso.',
  },
  {
    ruta: '/dashboard/roles',
    icono: ShieldCheck,
    titulo: 'Roles y permisos',
    texto: 'Crea roles personalizados y define a qué secciones puede entrar cada usuario.',
  },
  {
    ruta: '/dashboard/perfil',
    icono: UserRound,
    titulo: 'Mi perfil',
    texto: 'Tus datos personales, tu correo y la información de la empresa.',
  },
];

const Configuracion = () => {
  const navigate = useNavigate();
  const [negocio, setNegocio] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    getNegocio()
      .then(setNegocio)
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  const datos = [
    negocio?.nit && { etiqueta: 'NIT', valor: negocio.nit },
    negocio?.telefono && { etiqueta: 'Teléfono', valor: negocio.telefono },
    negocio?.direccion && { etiqueta: 'Dirección', valor: negocio.direccion },
  ].filter(Boolean);

  return (
    <div className="cfg-pagina">
      <header className="cfg-encabezado">
        <h1>Configuración</h1>
        <p>Administra tu negocio, el personal y los permisos del sistema.</p>
      </header>

      <section className="cfg-empresa" aria-labelledby="cfg-empresa-titulo">
        <div className="cfg-logo">
          {negocio?.logo
            ? <img src={imagenUrl(negocio.logo)} alt={`Logo de ${negocio.nombre}`} />
            : <Building2 size={30} aria-hidden="true" />}
        </div>

        <div className="cfg-empresa-info">
          <h2 id="cfg-empresa-titulo">{cargando ? <span className="cfg-esq" /> : negocio?.nombre || 'Mi negocio'}</h2>
          {datos.length > 0 ? (
            <dl className="cfg-datos">
              {datos.map((d) => (
                <div key={d.etiqueta}><dt>{d.etiqueta}</dt><dd>{d.valor}</dd></div>
              ))}
            </dl>
          ) : !cargando && <p className="cfg-ayuda">Completa el NIT, el teléfono y la dirección para que salgan en tus recibos.</p>}
          {!cargando && !negocio?.logo && (
            <p className="cfg-ayuda"><ImagePlus size={13} aria-hidden="true" /> Agrega el logo de tu empresa para que aparezca en los recibos.</p>
          )}
        </div>

        <button type="button" className="cfg-btn" onClick={() => navigate('/dashboard/perfil')}>
          <Pencil size={14} aria-hidden="true" />
          <span>Editar empresa</span>
        </button>
      </section>

      <section aria-labelledby="cfg-gestion-titulo">
        <h2 id="cfg-gestion-titulo" className="cfg-seccion">Gestión</h2>
        <div className="cfg-grid">
          {OPCIONES.map(({ ruta, icono: Icono, titulo, texto }) => (
            <button key={ruta} type="button" className="cfg-opcion" onClick={() => navigate(ruta)}>
              <span className="cfg-opcion-icono"><Icono size={20} aria-hidden="true" /></span>
              <span className="cfg-opcion-textos">
                <strong>{titulo}</strong>
                <span>{texto}</span>
              </span>
              <ChevronRight size={18} className="cfg-opcion-flecha" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Configuracion;
