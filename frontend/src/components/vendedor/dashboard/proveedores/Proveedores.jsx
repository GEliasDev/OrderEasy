import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Truck, Search, Edit2, Trash2, Phone, MessageCircle, CheckCircle2, PauseCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '../../../../hooks/useDebounce';
import { getProveedores, deleteProveedor } from '../../../../services/proveedorService';
import { abrirWhatsApp } from '../../../../utils/whatsapp';
import { colorAvatar, iniciales } from '../../../../utils/avatar';
import { useEsMovil } from '../../../../hooks/useEsMovil';
import { useFilasPorPagina } from '../../../../hooks/useFilasPorPagina';
import ListaMovil, { ChipsFiltro } from '../../../comunes/ListaMovil';
import PanelInferior, { DatoPanel } from '../../../comunes/PanelInferior';
import '../../../comunes/contactos.css';

const FilaEsqueleto = () => (
  <tr>
    {[55, 30, 30, 30, 20, 10].map((w, i) => (
      <td key={i}><span className="ct-esq" style={{ width: `${w}%` }} /></td>
    ))}
  </tr>
);

function Proveedores() {
  const navigate = useNavigate();
  const esMovil = useEsMovil();
  const [seleccionado, setSeleccionado] = useState(null);
  const [filtro, setFiltro] = useState('todos');
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState(() => localStorage.getItem('provSearchTerm') || '');
  const [paginaActual, setPaginaActual] = useState(() => parseInt(localStorage.getItem('provCurrentPage')) || 1);
  const { wrapRef: tablaWrapRef, filasPorPagina: registrosPorPagina, medido } = useFilasPorPagina(proveedores.length, 10);

  const debouncedBusqueda = useDebounce(busqueda, 300);

  useEffect(() => {
    (async () => {
      try {
        setProveedores(await getProveedores());
      } catch {
        toast.error('Error al obtener proveedores.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSetBusqueda = (val) => {
    setBusqueda(val);
    setPaginaActual(1);
    localStorage.setItem('provSearchTerm', val);
    localStorage.setItem('provCurrentPage', 1);
  };

  const handleSetPagina = (val) => {
    setPaginaActual(val);
    localStorage.setItem('provCurrentPage', val);
  };

  const handleSetFiltro = (val) => {
    setFiltro(val);
    handleSetPagina(1);
  };

  const irACrear = () => navigate('/dashboard/proveedores/nuevo');
  const irAEditar = (p) => navigate(`/dashboard/proveedores/${p.proveedorid}/editar`);

  const handleEliminar = (id, nombre) => {
    toast(`¿Eliminar a ${nombre}?`, {
      action: {
        label: 'Eliminar',
        onClick: async () => {
          try {
            await deleteProveedor(id);
            setProveedores((prev) => prev.filter((p) => p.proveedorid !== id));
            toast.success('Proveedor eliminado.');
          } catch {
            toast.error('No se pudo eliminar.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  const resumen = useMemo(() => {
    const activos = proveedores.filter((p) => p.estado === 'Activo').length;
    return { activos, inactivos: proveedores.length - activos };
  }, [proveedores]);

  const filtrados = proveedores
    .filter((p) => {
      const t = debouncedBusqueda.toLowerCase();
      return p.nombreProveedor?.toLowerCase().includes(t) || p.razonSocial?.toLowerCase().includes(t) || p.nit?.includes(debouncedBusqueda);
    })
    .filter((p) => filtro === 'todos' || (filtro === 'activos' ? p.estado === 'Activo' : p.estado !== 'Activo'));

  const listaMovil = [...filtrados].sort((a, b) => String(a.razonSocial).localeCompare(String(b.razonSocial), 'es'));

  const total = Math.ceil(filtrados.length / registrosPorPagina);
  const inicio = (paginaActual - 1) * registrosPorPagina;
  const pagina = filtrados.slice(inicio, inicio + registrosPorPagina);
  // Con la página llena, las filas se reparten el alto sobrante y la tabla llega hasta abajo
  const paginaLlena = medido && pagina.length === registrosPorPagina;

  // Si al cambiar el tamaño de pantalla la página actual deja de existir, vuelve a la última
  useEffect(() => {
    if (total > 0 && paginaActual > total) {
      setPaginaActual(total);
      localStorage.setItem('provCurrentPage', total);
    }
  }, [total, paginaActual]);

  return (
    <div className="ct-pagina">
      <header className="ct-encabezado">
        <div>
          <h1>Proveedores <span className="mod-count-badge">{proveedores.length}</span></h1>
          <p>Empresas y contactos a quienes les haces pedidos.</p>
        </div>
        <button type="button" className="ct-btn ct-btn--primario" onClick={irACrear}>
          <Plus size={16} aria-hidden="true" />
          <span>Nuevo proveedor</span>
        </button>
      </header>

      <section className="ct-resumen" aria-label="Resumen de proveedores">
        <div className="ct-dato">
          <span className="ct-dato-icono"><Truck size={18} aria-hidden="true" /></span>
          <div><span>Proveedores registrados</span><strong>{proveedores.length}</strong></div>
        </div>
        <div className="ct-dato ct-dato--ok">
          <span className="ct-dato-icono"><CheckCircle2 size={18} aria-hidden="true" /></span>
          <div><span>Activos</span><strong>{resumen.activos}</strong></div>
        </div>
        <div className={`ct-dato ${resumen.inactivos > 0 ? 'ct-dato--aviso' : ''}`}>
          <span className="ct-dato-icono"><PauseCircle size={18} aria-hidden="true" /></span>
          <div><span>Inactivos</span><strong>{resumen.inactivos}</strong></div>
        </div>
      </section>

      <div className="ct-barra">
        <div className="ct-busqueda">
          <Search size={16} aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar por nombre, razón social o NIT..."
            aria-label="Buscar proveedores"
            value={busqueda}
            onChange={(e) => handleSetBusqueda(e.target.value)}
          />
        </div>
        <ChipsFiltro
          opciones={[{ id: 'todos', label: 'Todos' }, { id: 'activos', label: 'Activos' }, { id: 'inactivos', label: 'Inactivos' }]}
          valor={filtro}
          onCambiar={handleSetFiltro}
        />
      </div>

      {esMovil ? (
        <ListaMovil
          items={listaMovil}
          clave={(p) => p.proveedorid}
          cargando={loading}
          letras
          vacio="No se encontraron proveedores"
          onAbrir={setSeleccionado}
          fila={(p) => ({
            titulo: p.razonSocial,
            subtitulo: [p.nombreProveedor !== p.razonSocial ? p.nombreProveedor : null, p.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto',
            insignia: p.estado,
            tono: p.estado === 'Activo' ? 'ok' : 'aviso',
          })}
        />
      ) : (
        <>
          <div className="ct-tabla-wrap" ref={tablaWrapRef}>
            <table className={`ct-tabla${paginaLlena ? ' ct-tabla-llena' : ''}`}>
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>NIT</th>
                  <th>Teléfono</th>
                  <th>Banco</th>
                  <th>Estado</th>
                  <th><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <FilaEsqueleto key={i} />)
                ) : pagina.length > 0 ? pagina.map((p) => (
                  <tr key={p.proveedorid} data-fila>
                    <td>
                      <div className="tbl-main-cell">
                        <span className="tbl-avatar" style={{ background: colorAvatar(p.razonSocial) }}>{iniciales(p.razonSocial)}</span>
                        <div className="tbl-cell-texts">
                          <span className="tbl-cell-primary">{p.razonSocial}</span>
                          {p.nombreProveedor && p.nombreProveedor !== p.razonSocial && (
                            <span className="tbl-cell-secondary">{p.nombreProveedor}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{p.nit || <span className="tbl-vacio">—</span>}</td>
                    <td>{p.telefono || <span className="tbl-vacio">—</span>}</td>
                    <td>{p.banco || <span className="tbl-vacio">—</span>}</td>
                    <td><span className={`tbl-badge ${p.estado === 'Activo' ? 'tbl-badge--ok' : 'tbl-badge--neutral'}`}>{p.estado}</span></td>
                    <td className="ct-acciones">
                      <div className="tbl-actions">
                        {p.telefono && (
                          <button type="button" className="tbl-icon-btn tbl-icon-btn--wa" title="WhatsApp" aria-label={`WhatsApp a ${p.razonSocial}`} onClick={() => { if (!abrirWhatsApp(p.telefono, `Hola ${p.nombreProveedor || p.razonSocial}`)) toast.error('El teléfono no parece válido para WhatsApp.'); }}>
                            <MessageCircle size={14} />
                          </button>
                        )}
                        <button type="button" className="tbl-icon-btn tbl-icon-btn--editar" title="Editar" aria-label={`Editar a ${p.razonSocial}`} onClick={() => irAEditar(p)}>
                          <Edit2 size={14} />
                        </button>
                        <button type="button" className="tbl-icon-btn tbl-icon-btn--borrar" title="Eliminar" aria-label={`Eliminar a ${p.razonSocial}`} onClick={() => handleEliminar(p.proveedorid, p.razonSocial)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6" className="ct-vacio">
                      <Truck size={28} style={{ opacity: 0.35 }} aria-hidden="true" />
                      <p>{busqueda || filtro !== 'todos' ? 'No hay proveedores con esos filtros' : 'Aún no tienes proveedores registrados'}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!loading && total > 1 && (
            <nav className="ct-paginacion" aria-label="Paginación">
              <button type="button" onClick={() => handleSetPagina(paginaActual - 1)} disabled={paginaActual === 1}>Anterior</button>
              <span>Página {paginaActual} de {total}</span>
              <button type="button" onClick={() => handleSetPagina(paginaActual + 1)} disabled={paginaActual === total}>Siguiente</button>
            </nav>
          )}
        </>
      )}

      <PanelInferior
        abierto={Boolean(seleccionado)}
        onCerrar={() => setSeleccionado(null)}
        titulo={seleccionado?.razonSocial}
        subtitulo={seleccionado ? `Proveedor · ${seleccionado.estado}` : ''}
        acciones={seleccionado && (
          <>
            {seleccionado.telefono && <a className="pi-accion" href={`tel:${seleccionado.telefono}`}><Phone size={15} /> Llamar</a>}
            {seleccionado.telefono && (
              <button type="button" className="pi-accion pi-accion-whatsapp" onClick={() => { if (!abrirWhatsApp(seleccionado.telefono, `Hola ${seleccionado.nombreProveedor || seleccionado.razonSocial}`)) toast.error('El teléfono no parece válido para WhatsApp.'); }}>
                <MessageCircle size={15} /> WhatsApp
              </button>
            )}
            <button type="button" className="pi-accion pi-accion-primaria" onClick={() => { const p = seleccionado; setSeleccionado(null); irAEditar(p); }}><Edit2 size={15} /> Editar</button>
            <button type="button" className="pi-accion pi-accion-peligro" onClick={() => { const p = seleccionado; setSeleccionado(null); handleEliminar(p.proveedorid, p.razonSocial); }}><Trash2 size={15} /> Eliminar</button>
          </>
        )}
      >
        {seleccionado && (
          <>
            <DatoPanel etiqueta="Contacto" valor={seleccionado.nombreProveedor} />
            <DatoPanel etiqueta="NIT" valor={seleccionado.nit} />
            <DatoPanel etiqueta="Teléfono" valor={seleccionado.telefono} enlace={seleccionado.telefono ? `tel:${seleccionado.telefono}` : undefined} />
            <DatoPanel etiqueta="Correo" valor={seleccionado.correo} enlace={seleccionado.correo ? `mailto:${seleccionado.correo}` : undefined} />
            <DatoPanel etiqueta="Dirección" valor={seleccionado.direccion} />
            <DatoPanel etiqueta="Banco" valor={seleccionado.banco} />
            <DatoPanel etiqueta="Cuenta" valor={[seleccionado.tipoCuenta, seleccionado.numeroCuenta].filter(Boolean).join(' · ')} />
            <DatoPanel etiqueta="Suministra" valor={Array.isArray(seleccionado.categoriaSuministro) ? seleccionado.categoriaSuministro.join(', ') : seleccionado.categoriaSuministro} />
          </>
        )}
      </PanelInferior>
    </div>
  );
}

export default Proveedores;
