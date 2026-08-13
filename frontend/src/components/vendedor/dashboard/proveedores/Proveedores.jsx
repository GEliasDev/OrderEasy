import { useState, useEffect } from 'react';
import { Plus, Truck, Search, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '../../../../hooks/useDebounce';
import { getProveedores, createProveedor, updateProveedor, deleteProveedor } from '../../../../services/proveedorService';
import './proveedores.css';

const ESTADO_OPTS = ['Activo', 'Inactivo'];
const TIPO_CUENTA_OPTS = ['Ahorros', 'Corriente'];

const formInicial = {
  razonSocial: '', nombreProveedor: '', nit: '', telefono: '',
  correo: '', direccion: '', banco: '', numeroCuenta: '',
  tipoCuenta: 'Ahorros', categoriaSuministro: [], estado: 'Activo',
};

const SkeletonRow = () => (
  <tr>
    {[55, 40, 25, 30, 30, 15, 15].map((w, i) => (
      <td key={i}>
        <div style={{ height: 12, borderRadius: 4, background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '800px 100%', animation: 'shimmer 1.4s infinite', width: `${w}%` }} />
      </td>
    ))}
  </tr>
);

function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState(() => localStorage.getItem('provSearchTerm') || '');
  const [paginaActual, setPaginaActual] = useState(() => parseInt(localStorage.getItem('provCurrentPage')) || 1);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [proveedorEditando, setProveedorEditando] = useState(null);
  const [form, setForm] = useState(formInicial);
  const [cargando, setCargando] = useState(false);
  const registrosPorPagina = 10;

  const debouncedBusqueda = useDebounce(busqueda, 300);

  useEffect(() => {
    fetchProveedores();
  }, []);

  const fetchProveedores = async () => {
    try {
      const data = await getProveedores();
      setProveedores(data);
    } catch {
      toast.error('Error al obtener proveedores.');
    } finally {
      setLoading(false);
    }
  };

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

  const abrirCrear = () => {
    setProveedorEditando(null);
    setForm(formInicial);
    setMostrarModal(true);
  };

  const abrirEditar = (p) => {
    setProveedorEditando(p);
    setForm({
      razonSocial: p.razonSocial || '', nombreProveedor: p.nombreProveedor || '',
      nit: p.nit || '', telefono: p.telefono || '', correo: p.correo || '',
      direccion: p.direccion || '', banco: p.banco || '', numeroCuenta: p.numeroCuenta || '',
      tipoCuenta: p.tipoCuenta || 'Ahorros', categoriaSuministro: p.categoriaSuministro || [],
      estado: p.estado || 'Activo',
    });
    setMostrarModal(true);
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setProveedorEditando(null);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      if (proveedorEditando) {
        await updateProveedor(proveedorEditando.proveedorid, form);
        toast.success('Proveedor actualizado.');
      } else {
        await createProveedor(form);
        toast.success('Proveedor registrado.');
      }
      await fetchProveedores();
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

  const filtrados = proveedores.filter((p) =>
    p.nombreProveedor?.toLowerCase().includes(debouncedBusqueda.toLowerCase()) ||
    p.razonSocial?.toLowerCase().includes(debouncedBusqueda.toLowerCase()) ||
    p.nit?.includes(debouncedBusqueda)
  );

  const total = Math.ceil(filtrados.length / registrosPorPagina);
  const inicio = (paginaActual - 1) * registrosPorPagina;
  const pagina = filtrados.slice(inicio, inicio + registrosPorPagina);

  return (
    <div className="proveedores-main">
      <style>{`@keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }`}</style>

      <div className="proveedores-header">
        <div className="proveedores-header-left">
          <Truck size={18} className="proveedores-header-icon" />
          <h2 className="proveedores-titulo">Proveedores</h2>
          <span className="proveedores-badge">{proveedores.length}</span>
        </div>
        <button className="proveedores-btn-nuevo" onClick={abrirCrear}>
          <Plus size={14} />
          <span>Nuevo Proveedor</span>
        </button>
      </div>

      <div className="proveedores-search-wrap">
        <Search size={14} className="proveedores-search-icon" />
        <input
          type="text"
          className="proveedores-search"
          placeholder="Buscar por nombre, razón social o NIT..."
          value={busqueda}
          onChange={(e) => handleSetBusqueda(e.target.value)}
        />
      </div>

      <div className="proveedores-table-wrap">
        <table className="proveedores-table">
          <thead>
            <tr>
              <th>Razón Social</th>
              <th>Nombre Contacto</th>
              <th>NIT</th>
              <th>Teléfono</th>
              <th>Banco</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : pagina.length > 0 ? pagina.map((p) => (
              <tr key={p.proveedorid}>
                <td className="proveedores-td-razon">{p.razonSocial}</td>
                <td>{p.nombreProveedor}</td>
                <td>{p.nit}</td>
                <td>{p.telefono}</td>
                <td>{p.banco}</td>
                <td>
                  <span className={`proveedores-estado ${p.estado === 'Activo' ? 'activo' : 'inactivo'}`}>{p.estado}</span>
                </td>
                <td className="proveedores-td-acciones">
                  <button className="proveedores-btn-edit" onClick={() => abrirEditar(p)}><Edit2 size={13} /></button>
                  <button className="proveedores-btn-del" onClick={() => handleEliminar(p.proveedorid, p.razonSocial)}><Trash2 size={13} /></button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="7" className="proveedores-empty">
                  <Truck size={28} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                  <p>No se encontraron proveedores</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!loading && total > 1 && (
        <div className="proveedores-paginacion">
          <button onClick={() => handleSetPagina(paginaActual - 1)} disabled={paginaActual === 1}>Anterior</button>
          <span>Página {paginaActual} de {total}</span>
          <button onClick={() => handleSetPagina(paginaActual + 1)} disabled={paginaActual === total}>Siguiente</button>
        </div>
      )}

      {mostrarModal && (
        <div className="proveedores-overlay" onClick={cerrarModal}>
          <div className="proveedores-modal" onClick={(e) => e.stopPropagation()}>
            <div className="proveedores-modal-header">
              <h3>{proveedorEditando ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
              <button className="proveedores-modal-close" onClick={cerrarModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="proveedores-form">
              <div className="proveedores-form-row">
                <div className="proveedores-form-group"><label>Razón Social *</label><input name="razonSocial" value={form.razonSocial} onChange={handleChange} required /></div>
                <div className="proveedores-form-group"><label>Nombre Contacto *</label><input name="nombreProveedor" value={form.nombreProveedor} onChange={handleChange} required /></div>
              </div>
              <div className="proveedores-form-row">
                <div className="proveedores-form-group"><label>NIT *</label><input name="nit" value={form.nit} onChange={handleChange} required /></div>
                <div className="proveedores-form-group"><label>Teléfono *</label><input name="telefono" value={form.telefono} onChange={handleChange} required /></div>
              </div>
              <div className="proveedores-form-row">
                <div className="proveedores-form-group"><label>Correo *</label><input name="correo" type="email" value={form.correo} onChange={handleChange} required /></div>
                <div className="proveedores-form-group"><label>Dirección *</label><input name="direccion" value={form.direccion} onChange={handleChange} required /></div>
              </div>
              <div className="proveedores-form-row">
                <div className="proveedores-form-group"><label>Banco *</label><input name="banco" value={form.banco} onChange={handleChange} required /></div>
                <div className="proveedores-form-group"><label>Cuenta *</label><input name="numeroCuenta" value={form.numeroCuenta} onChange={handleChange} required /></div>
              </div>
              <div className="proveedores-form-row">
                <div className="proveedores-form-group">
                  <label>Tipo Cuenta *</label>
                  <select name="tipoCuenta" value={form.tipoCuenta} onChange={handleChange} required>
                    {TIPO_CUENTA_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="proveedores-form-group">
                  <label>Estado *</label>
                  <select name="estado" value={form.estado} onChange={handleChange} required>
                    {ESTADO_OPTS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              <div className="proveedores-form-actions">
                <button type="button" className="proveedores-btn-cancelar" onClick={cerrarModal}>Cancelar</button>
                <button type="submit" className="proveedores-btn-guardar" disabled={cargando}>{cargando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Proveedores;
