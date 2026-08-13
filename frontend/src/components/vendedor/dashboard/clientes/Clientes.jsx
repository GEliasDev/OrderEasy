import { useState, useEffect } from 'react';
import { Plus, Users, Search, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '../../../../hooks/useDebounce';
import { getClientes, createCliente, updateCliente, deleteCliente } from '../../../../services/clienteService';
import './clientes.css';

const SkeletonRow = () => (
  <tr>
    {[60, 30, 50, 40, 20].map((w, i) => (
      <td key={i}>
        <div style={{ height: 12, borderRadius: 4, background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '800px 100%', animation: 'shimmer 1.4s infinite', width: `${w}%` }} />
      </td>
    ))}
  </tr>
);

function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState(() => localStorage.getItem('cliSearchTerm') || '');
  const [paginaActual, setPaginaActual] = useState(() => parseInt(localStorage.getItem('cliCurrentPage')) || 1);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [clienteEditando, setClienteEditando] = useState(null);
  const [form, setForm] = useState({ nombreCliente: '', telefono: '', correo: '', direccion: '' });
  const [cargando, setCargando] = useState(false);
  const registrosPorPagina = 12;

  const debouncedBusqueda = useDebounce(busqueda, 300);

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    try {
      const data = await getClientes();
      setClientes(data);
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
    setForm({ nombreCliente: cliente.nombreCliente, telefono: cliente.telefono, correo: cliente.correo, direccion: cliente.direccion });
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

  const total = Math.ceil(clientesFiltrados.length / registrosPorPagina);
  const inicio = (paginaActual - 1) * registrosPorPagina;
  const pagina = clientesFiltrados.slice(inicio, inicio + registrosPorPagina);

  return (
    <div className="clientes-main">
      <style>{`@keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }`}</style>

      <div className="clientes-header">
        <div className="clientes-header-left">
          <Users size={18} className="clientes-header-icon" />
          <h2 className="clientes-titulo">Clientes</h2>
          <span className="clientes-badge">{clientes.length}</span>
        </div>
        <button className="clientes-btn-nuevo" onClick={abrirCrear}>
          <Plus size={14} />
          <span>Nuevo Cliente</span>
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

      <div className="clientes-table-wrap">
        <table className="clientes-table">
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
              <tr key={c.clienteid}>
                <td className="clientes-td-nombre">{c.nombreCliente}</td>
                <td>{c.telefono}</td>
                <td>{c.correo}</td>
                <td>{c.direccion}</td>
                <td className="clientes-td-acciones">
                  <button className="clientes-btn-edit" onClick={() => abrirEditar(c)}><Edit2 size={13} /></button>
                  <button className="clientes-btn-del" onClick={() => handleEliminar(c.clienteid, c.nombreCliente)}><Trash2 size={13} /></button>
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
                  <label>Teléfono *</label>
                  <input name="telefono" value={form.telefono} onChange={handleChange} required placeholder="3001234567" />
                </div>
                <div className="clientes-form-group">
                  <label>Correo *</label>
                  <input name="correo" type="email" value={form.correo} onChange={handleChange} required placeholder="correo@email.com" />
                </div>
              </div>
              <div className="clientes-form-group">
                <label>Dirección *</label>
                <input name="direccion" value={form.direccion} onChange={handleChange} required placeholder="Dirección" />
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
