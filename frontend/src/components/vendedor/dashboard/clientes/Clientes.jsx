import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Search, Edit2, Trash2, Phone, MessageCircle, Wallet, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '../../../../hooks/useDebounce';
import { getClientes, deleteCliente } from '../../../../services/clienteService';
import { getSaldoPorCobrar } from '../../../../services/pedidoService';
import { abrirWhatsApp } from '../../../../utils/whatsapp';
import { colorAvatar, iniciales } from '../../../../utils/avatar';
import { useEsMovil } from '../../../../hooks/useEsMovil';
import { useFilasPorPagina } from '../../../../hooks/useFilasPorPagina';
import ListaMovil, { ChipsFiltro } from '../../../comunes/ListaMovil';
import PanelInferior, { DatoPanel } from '../../../comunes/PanelInferior';
import '../../../comunes/contactos.css';

const formatoMoneda = (valor) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(valor) || 0);

const FilaEsqueleto = () => (
  <tr>
    {[60, 30, 50, 40, 20, 10].map((w, i) => (
      <td key={i}><span className="ct-esq" style={{ width: `${w}%` }} /></td>
    ))}
  </tr>
);

function Clientes() {
  const navigate = useNavigate();
  const esMovil = useEsMovil();
  const [seleccionado, setSeleccionado] = useState(null);
  const [saldos, setSaldos] = useState({});
  const [filtro, setFiltro] = useState('todos');
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState(() => localStorage.getItem('cliSearchTerm') || '');
  const [paginaActual, setPaginaActual] = useState(() => parseInt(localStorage.getItem('cliCurrentPage')) || 1);
  const { wrapRef: tablaWrapRef, filasPorPagina: registrosPorPagina, medido } = useFilasPorPagina(clientes.length, 12);

  const debouncedBusqueda = useDebounce(busqueda, 300);

  useEffect(() => {
    (async () => {
      try {
        setClientes(await getClientes());
        getSaldoPorCobrar().then((r) => setSaldos(r?.porCliente || {})).catch(() => {});
      } catch {
        toast.error('Error al obtener clientes.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSetBusqueda = (val) => {
    setBusqueda(val);
    setPaginaActual(1);
    localStorage.setItem('cliSearchTerm', val);
    localStorage.setItem('cliCurrentPage', 1);
  };

  const handleSetPagina = (val) => {
    setPaginaActual(val);
    localStorage.setItem('cliCurrentPage', val);
  };

  const handleSetFiltro = (val) => {
    setFiltro(val);
    handleSetPagina(1);
  };

  const irACrear = () => navigate('/dashboard/clientes/nuevo');
  const irAEditar = (c) => navigate(`/dashboard/clientes/${c.clienteid}/editar`);

  const handleEliminar = (id, nombre) => {
    toast(`¿Eliminar a ${nombre}?`, {
      action: {
        label: 'Eliminar',
        onClick: async () => {
          try {
            await deleteCliente(id);
            setClientes((prev) => prev.filter((c) => c.clienteid !== id));
            toast.success('Cliente eliminado.');
          } catch {
            toast.error('No se pudo eliminar el cliente.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  const saldoDe = (c) => Number(saldos[c.clienteid] || 0);

  const resumen = useMemo(() => {
    const conSaldo = clientes.filter((c) => Number(saldos[c.clienteid] || 0) > 0);
    return {
      conSaldo: conSaldo.length,
      totalPorCobrar: conSaldo.reduce((s, c) => s + Number(saldos[c.clienteid] || 0), 0),
    };
  }, [clientes, saldos]);

  const clientesFiltrados = clientes
    .filter((c) => {
      const t = debouncedBusqueda.toLowerCase();
      return c.nombreCliente?.toLowerCase().includes(t) || c.correo?.toLowerCase().includes(t) || c.telefono?.includes(debouncedBusqueda);
    })
    .filter((c) => filtro !== 'saldo' || saldoDe(c) > 0);

  const listaMovil = [...clientesFiltrados].sort((a, b) => String(a.nombreCliente).localeCompare(String(b.nombreCliente), 'es'));

  const total = Math.ceil(clientesFiltrados.length / registrosPorPagina);
  const inicio = (paginaActual - 1) * registrosPorPagina;
  const pagina = clientesFiltrados.slice(inicio, inicio + registrosPorPagina);
  // Con la página llena, las filas se reparten el alto sobrante y la tabla llega hasta abajo
  const paginaLlena = medido && pagina.length === registrosPorPagina;

  // Si al cambiar el tamaño de pantalla la página actual deja de existir, vuelve a la última
  useEffect(() => {
    if (total > 0 && paginaActual > total) {
      setPaginaActual(total);
      localStorage.setItem('cliCurrentPage', total);
    }
  }, [total, paginaActual]);

  return (
    <div className="ct-pagina">
      <header className="ct-encabezado">
        <div>
          <h1>Clientes <span className="mod-count-badge">{clientes.length}</span></h1>
          <p>Tus clientes, cómo contactarlos y cuánto te deben.</p>
        </div>
        <button type="button" className="ct-btn ct-btn--primario" onClick={irACrear}>
          <Plus size={16} aria-hidden="true" />
          <span>Nuevo cliente</span>
        </button>
      </header>

      <section className="ct-resumen" aria-label="Resumen de clientes">
        <div className="ct-dato">
          <span className="ct-dato-icono"><Users size={18} aria-hidden="true" /></span>
          <div><span>Clientes registrados</span><strong>{clientes.length}</strong></div>
        </div>
        <div className={`ct-dato ${resumen.conSaldo > 0 ? 'ct-dato--aviso' : 'ct-dato--ok'}`}>
          <span className="ct-dato-icono"><UserCheck size={18} aria-hidden="true" /></span>
          <div><span>Con saldo por cobrar</span><strong>{resumen.conSaldo}</strong></div>
        </div>
        <div className={`ct-dato ${resumen.totalPorCobrar > 0 ? 'ct-dato--peligro' : 'ct-dato--ok'}`}>
          <span className="ct-dato-icono"><Wallet size={18} aria-hidden="true" /></span>
          <div><span>Total por cobrar</span><strong>{formatoMoneda(resumen.totalPorCobrar)}</strong></div>
        </div>
      </section>

      <div className="ct-barra">
        <div className="ct-busqueda">
          <Search size={16} aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar por nombre, correo o teléfono..."
            aria-label="Buscar clientes"
            value={busqueda}
            onChange={(e) => handleSetBusqueda(e.target.value)}
          />
        </div>
        <ChipsFiltro
          opciones={[{ id: 'todos', label: 'Todos' }, { id: 'saldo', label: 'Con saldo por cobrar' }]}
          valor={filtro}
          onCambiar={handleSetFiltro}
        />
      </div>

      {esMovil ? (
        <ListaMovil
          items={listaMovil}
          clave={(c) => c.clienteid}
          cargando={loading}
          letras
          vacio="No se encontraron clientes"
          onAbrir={setSeleccionado}
          fila={(c) => {
            const saldo = saldoDe(c);
            return {
              titulo: c.nombreCliente,
              subtitulo: c.telefono || c.correo || 'Sin datos de contacto',
              derecha: saldo > 0 ? formatoMoneda(saldo) : undefined,
              derechaSecundaria: saldo > 0 ? 'por cobrar' : undefined,
              tono: 'peligro',
            };
          }}
        />
      ) : (
        <>
          <div className="ct-tabla-wrap" ref={tablaWrapRef}>
            <table className={`ct-tabla${paginaLlena ? ' ct-tabla-llena' : ''}`}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>Correo</th>
                  <th>Dirección</th>
                  <th className="ct-num">Por cobrar</th>
                  <th><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <FilaEsqueleto key={i} />)
                ) : pagina.length > 0 ? pagina.map((c) => (
                  <tr key={c.clienteid} data-fila>
                    <td>
                      <div className="tbl-main-cell">
                        <span className="tbl-avatar" style={{ background: colorAvatar(c.nombreCliente) }}>{iniciales(c.nombreCliente)}</span>
                        <div className="tbl-cell-texts"><span className="tbl-cell-primary">{c.nombreCliente}</span></div>
                      </div>
                    </td>
                    <td>{c.telefono || <span className="tbl-vacio">—</span>}</td>
                    <td title={c.correo}>{c.correo || <span className="tbl-vacio">—</span>}</td>
                    <td title={c.direccion}>{c.direccion || <span className="tbl-vacio">—</span>}</td>
                    <td className="ct-num">
                      {saldoDe(c) > 0 ? <span className="ct-por-cobrar">{formatoMoneda(saldoDe(c))}</span> : <span className="tbl-badge tbl-badge--ok">Al día</span>}
                    </td>
                    <td className="ct-acciones">
                      <div className="tbl-actions">
                        {c.telefono && (
                          <button type="button" className="tbl-icon-btn tbl-icon-btn--wa" title="WhatsApp" aria-label={`WhatsApp a ${c.nombreCliente}`} onClick={() => abrirWhatsApp(c.telefono)}>
                            <MessageCircle size={14} />
                          </button>
                        )}
                        <button type="button" className="tbl-icon-btn tbl-icon-btn--editar" title="Editar" aria-label={`Editar a ${c.nombreCliente}`} onClick={() => irAEditar(c)}>
                          <Edit2 size={14} />
                        </button>
                        <button type="button" className="tbl-icon-btn tbl-icon-btn--borrar" title="Eliminar" aria-label={`Eliminar a ${c.nombreCliente}`} onClick={() => handleEliminar(c.clienteid, c.nombreCliente)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6" className="ct-vacio">
                      <Users size={28} style={{ opacity: 0.35 }} aria-hidden="true" />
                      <p>{busqueda || filtro !== 'todos' ? 'No hay clientes con esos filtros' : 'Aún no tienes clientes registrados'}</p>
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
        titulo={seleccionado?.nombreCliente}
        subtitulo="Cliente"
        acciones={seleccionado && (
          <>
            {seleccionado.telefono && <a className="pi-accion" href={`tel:${seleccionado.telefono}`}><Phone size={15} /> Llamar</a>}
            {seleccionado.telefono && (
              <button type="button" className="pi-accion pi-accion-whatsapp" onClick={() => { if (!abrirWhatsApp(seleccionado.telefono, `Hola ${String(seleccionado.nombreCliente).split(' ')[0]}`)) toast.error('El teléfono no parece válido para WhatsApp.'); }}>
                <MessageCircle size={15} /> WhatsApp
              </button>
            )}
            <button type="button" className="pi-accion pi-accion-primaria" onClick={() => { const c = seleccionado; setSeleccionado(null); irAEditar(c); }}><Edit2 size={15} /> Editar</button>
            <button type="button" className="pi-accion pi-accion-peligro" onClick={() => { const c = seleccionado; setSeleccionado(null); handleEliminar(c.clienteid, c.nombreCliente); }}><Trash2 size={15} /> Eliminar</button>
          </>
        )}
      >
        {seleccionado && (
          <>
            <DatoPanel etiqueta="Saldo por cobrar" valor={saldoDe(seleccionado) > 0 ? formatoMoneda(saldoDe(seleccionado)) : 'Al día'} tono={saldoDe(seleccionado) > 0 ? 'peligro' : 'ok'} />
            <DatoPanel etiqueta="Teléfono" valor={seleccionado.telefono} enlace={seleccionado.telefono ? `tel:${seleccionado.telefono}` : undefined} />
            <DatoPanel etiqueta="Correo" valor={seleccionado.correo} enlace={seleccionado.correo ? `mailto:${seleccionado.correo}` : undefined} />
            <DatoPanel etiqueta="Dirección" valor={seleccionado.direccion} />
            {!seleccionado.telefono && !seleccionado.correo && !seleccionado.direccion && <p className="lm-vacio" style={{ border: 'none' }}>Este cliente solo tiene el nombre. Toca Editar para completar sus datos.</p>}
          </>
        )}
      </PanelInferior>
    </div>
  );
}

export default Clientes;
