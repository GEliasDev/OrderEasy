import { useState, useEffect } from 'react';
import { Plus, Users, Search, Edit2, Trash2, Phone, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '../../../../hooks/useDebounce';
import { getClientes, createCliente, updateCliente, deleteCliente } from '../../../../services/clienteService';
import { getSaldoPorCobrar } from '../../../../services/pedidoService';
import { abrirWhatsApp } from '../../../../utils/whatsapp';
import { useEsMovil } from '../../../../hooks/useEsMovil';
import ListaMovil, { ChipsFiltro } from '../../../comunes/ListaMovil';
import PanelInferior, { DatoPanel } from '../../../comunes/PanelInferior';
import './clientes.css';
import { useFilasPorPagina } from '../../../../hooks/useFilasPorPagina';

const AVATAR_COLORS = ['#3B82F6','#8B5CF6','#EC4899','#F59E0B','#10B981','#06B6D4','#EF4444','#6366F1'];
const colorAvatar = (name) => AVATAR_COLORS[(name?.charCodeAt(0) || 65) % AVATAR_COLORS.length];
const iniciales = (name) => {
  const parts = (name || '?').trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (name || '?').slice(0, 2).toUpperCase();
};

const SkeletonRow = () => (
  <tr>
    {[60, 30, 50, 40, 20].map((w, i) => (
      <td key={i}>
        <div style={{ height: 12, borderRadius: 4, background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '800px 100%', animation: 'shimmer 1.4s infinite', width: `${w}%` }} />
      </td>
    ))}
  </tr>
);

const formatoMoneda = (valor) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(valor) || 0);

function Clientes() {
  const esMovil = useEsMovil();
  const [seleccionado, setSeleccionado] = useState(null);
  const [saldos, setSaldos] = useState({});
  const [filtroMovil, setFiltroMovil] = useState('todos');
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState(() => localStorage.getItem('cliSearchTerm') || '');
  const [paginaActual, setPaginaActual] = useState(() => parseInt(localStorage.getItem('cliCurrentPage')) || 1);
  const { wrapRef: tablaWrapRef, filasPorPagina: registrosPorPagina, medido } = useFilasPorPagina(clientes.length, 12);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [clienteEditando, setClienteEditando] = useState(null);
  const [form, setForm] = useState({ nombreCliente: '', telefono: '', correo: '', direccion: '' });
  const [cargando, setCargando] = useState(false);

  const debouncedBusqueda = useDebounce(busqueda, 300);

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    try {
      const data = await getClientes();
      setClientes(data);
      getSaldoPorCobrar().then((r) => setSaldos(r?.porCliente || {})).catch(() => {});
    } catch {
      toast.error('Error al obtener clientes.');
    } finally {
      setLoading(false);
    }
  };

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

  const abrirCrear = () => {
    setClienteEditando(null);
    setForm({ nombreCliente: '', telefono: '', correo: '', direccion: '' });
    setMostrarModal(true);
  };

  const abrirEditar = (cliente) => {
    setClienteEditando(cliente);
    setForm({ nombreCliente: cliente.nombreCliente, telefono: cliente.telefono ?? '', correo: cliente.correo ?? '', direccion: cliente.direccion ?? '' });
    setMostrarModal(true);
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setClienteEditando(null);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      if (clienteEditando) {
        await updateCliente(clienteEditando.clienteid, form);
        toast.success('Cliente actualizado.');
      } else {
        await createCliente(form);
        toast.success('Cliente registrado.');
      }
      await fetchClientes();
      cerrarModal();
    } catch (error) {
      toast.error(error.mensaje || 'Error al guardar.');
    } finally {
      setCargando(false);
    }
  };

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

  const clientesFiltrados = clientes.filter((c) =>
    c.nombreCliente?.toLowerCase().includes(debouncedBusqueda.toLowerCase()) ||
    c.correo?.toLowerCase().includes(debouncedBusqueda.toLowerCase()) ||
    c.telefono?.includes(debouncedBusqueda)
  );

  // En celular: orden alfabético y filtro rápido por saldo
  const listaMovil = clientesFiltrados
    .filter((c) => filtroMovil !== 'saldo' || Number(saldos[c.clienteid] || 0) > 0)
    .sort((a, b) => String(a.nombreCliente).localeCompare(String(b.nombreCliente), 'es'));

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
    <div className="clientes-main">
      <style>{`@keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }`}</style>

      <div className="clientes-header">
        <div>
          <h1 className="clientes-titulo">Clientes <span className="mod-count-badge">{clientes.length}</span></h1>
          <p className="clientes-subtitle">Gestiona tus clientes y su saldo por cobrar</p>
        </div>
        <button className="clientes-btn-nuevo" onClick={abrirCrear}>
          <Plus size={14} />
          <span>Nuevo cliente</span>
        </button>
      </div>

      <div className="clientes-search-wrap">
        <Search size={14} className="clientes-search-icon" />
        <input
          type="text"
          className="clientes-search"
          placeholder="Buscar por nombre, correo o teléfono..."
          value={busqueda}
          onChange={(e) => handleSetBusqueda(e.target.value)}
        />
      </div>

      {esMovil ? (
        <>
          <ChipsFiltro
            opciones={[{ id: 'todos', label: 'Todos' }, { id: 'saldo', label: 'Con saldo por cobrar' }]}
            valor={filtroMovil}
            onCambiar={setFiltroMovil}
          />
          <ListaMovil
            items={listaMovil}
            clave={(c) => c.clienteid}
            cargando={loading}
            letras
            vacio="No se encontraron clientes"
            onAbrir={setSeleccionado}
            fila={(c) => {
              const saldo = Number(saldos[c.clienteid] || 0);
              return {
                titulo: c.nombreCliente,
                subtitulo: c.telefono || c.correo || 'Sin datos de contacto',
                derecha: saldo > 0 ? formatoMoneda(saldo) : undefined,
                derechaSecundaria: saldo > 0 ? 'por cobrar' : undefined,
                tono: 'peligro',
              };
            }}
          />
        </>
      ) : (
      <>
      <div className="clientes-table-wrap" ref={tablaWrapRef}>
        <table className={`clientes-table${paginaLlena ? ' clientes-table-llena' : ''}`}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Correo</th>
              <th>Dirección</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            ) : pagina.length > 0 ? pagina.map((c) => (
              <tr key={c.clienteid} data-fila>
                <td className="clientes-td-nombre" data-label="Nombre">
                  <div className="tbl-main-cell">
                    <span className="tbl-avatar" style={{ background: colorAvatar(c.nombreCliente) }}>{iniciales(c.nombreCliente)}</span>
                    <div className="tbl-cell-texts">
                      <span className="tbl-cell-primary">{c.nombreCliente}</span>
                      {Number(saldos[c.clienteid] || 0) > 0 && (
                        <span className="tbl-badge tbl-badge--danger">{formatoMoneda(saldos[c.clienteid])} por cobrar</span>
                      )}
                    </div>
                  </div>
                </td>
                <td data-label="Teléfono">{c.telefono || <span className="tbl-vacio">—</span>}</td>
                <td data-label="Correo" title={c.correo}>{c.correo || <span className="tbl-vacio">—</span>}</td>
                <td data-label="Dirección" title={c.direccion}>{c.direccion || <span className="tbl-vacio">—</span>}</td>
                <td className="clientes-td-acciones" data-label="">
                  <div className="tbl-actions">
                    {c.telefono && (
                      <button className="tbl-icon-btn tbl-icon-btn--wa" title="WhatsApp" onClick={(e) => { e.stopPropagation(); abrirWhatsApp(c.telefono); }}>
                        <MessageCircle size={14} />
                      </button>
                    )}
                    <button className="tbl-icon-btn tbl-icon-btn--editar" title="Editar" onClick={(e) => { e.stopPropagation(); abrirEditar(c); }}>
                      <Edit2 size={14} />
                    </button>
                    <button className="tbl-icon-btn tbl-icon-btn--borrar" title="Eliminar" onClick={(e) => { e.stopPropagation(); handleEliminar(c.clienteid, c.nombreCliente); }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" className="clientes-empty">
                  <Users size={28} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                  <p>No se encontraron clientes</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!loading && total > 1 && (
        <div className="clientes-paginacion">
          <button onClick={() => handleSetPagina(paginaActual - 1)} disabled={paginaActual === 1}>Anterior</button>
          <span>Página {paginaActual} de {total}</span>
          <button onClick={() => handleSetPagina(paginaActual + 1)} disabled={paginaActual === total}>Siguiente</button>
        </div>
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
            <button type="button" className="pi-accion pi-accion-primaria" onClick={() => { const c = seleccionado; setSeleccionado(null); abrirEditar(c); }}><Edit2 size={15} /> Editar</button>
            <button type="button" className="pi-accion pi-accion-peligro" onClick={() => { const c = seleccionado; setSeleccionado(null); handleEliminar(c.clienteid, c.nombreCliente); }}><Trash2 size={15} /> Eliminar</button>
          </>
        )}
      >
        {seleccionado && (
          <>
            <DatoPanel etiqueta="Saldo por cobrar" valor={Number(saldos[seleccionado.clienteid] || 0) > 0 ? formatoMoneda(saldos[seleccionado.clienteid]) : 'Al día'} tono={Number(saldos[seleccionado.clienteid] || 0) > 0 ? 'peligro' : 'ok'} />
            <DatoPanel etiqueta="Teléfono" valor={seleccionado.telefono} enlace={seleccionado.telefono ? `tel:${seleccionado.telefono}` : undefined} />
            <DatoPanel etiqueta="Correo" valor={seleccionado.correo} enlace={seleccionado.correo ? `mailto:${seleccionado.correo}` : undefined} />
            <DatoPanel etiqueta="Dirección" valor={seleccionado.direccion} />
            {!seleccionado.telefono && !seleccionado.correo && !seleccionado.direccion && <p className="lm-vacio" style={{ border: 'none' }}>Este cliente solo tiene el nombre. Toca Editar para completar sus datos.</p>}
          </>
        )}
      </PanelInferior>

      {mostrarModal && (
        <div className="clientes-overlay" onClick={cerrarModal}>
          <div className="clientes-modal" onClick={(e) => e.stopPropagation()}>
            <div className="clientes-modal-header">
              <h3>{clienteEditando ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
              <button className="clientes-modal-close" onClick={cerrarModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="clientes-form">
              <div className="clientes-form-group">
                <label>Nombre del cliente *</label>
                <input name="nombreCliente" value={form.nombreCliente} onChange={handleChange} required placeholder="Nombre completo" />
              </div>
              <div className="clientes-form-row">
                <div className="clientes-form-group">
                  <label>Teléfono <span className="campo-opcional">(opcional)</span></label>
                  <input name="telefono" value={form.telefono} onChange={handleChange} placeholder="3001234567" />
                </div>
                <div className="clientes-form-group">
                  <label>Correo <span className="campo-opcional">(opcional)</span></label>
                  <input name="correo" type="email" value={form.correo} onChange={handleChange} placeholder="correo@email.com" />
                </div>
              </div>
              <div className="clientes-form-group">
                <label>Dirección <span className="campo-opcional">(opcional)</span></label>
                <input name="direccion" value={form.direccion} onChange={handleChange} placeholder="Dirección" />
              </div>
              <div className="clientes-form-actions">
                <button type="button" className="clientes-btn-cancelar" onClick={cerrarModal}>Cancelar</button>
                <button type="submit" className="clientes-btn-guardar" disabled={cargando}>
                  {cargando ? 'Guardando...' : clienteEditando ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Clientes;
