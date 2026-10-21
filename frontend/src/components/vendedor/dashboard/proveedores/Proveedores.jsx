import { useState, useEffect } from 'react';
import { Plus, Truck, Search, Edit2, Trash2, Phone, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '../../../../hooks/useDebounce';
import { getProveedores, createProveedor, updateProveedor, deleteProveedor } from '../../../../services/proveedorService';
import { useEsMovil } from '../../../../hooks/useEsMovil';
import ListaMovil, { ChipsFiltro } from '../../../comunes/ListaMovil';
import PanelInferior, { DatoPanel } from '../../../comunes/PanelInferior';
import { abrirWhatsApp } from '../../../../utils/whatsapp';
import './proveedores.css';
import { useFilasPorPagina } from '../../../../hooks/useFilasPorPagina';

const ESTADO_OPTS = ['Activo', 'Inactivo'];
const TIPO_CUENTA_OPTS = ['Ahorros', 'Corriente'];

const formInicial = {
  razonSocial: '', nombreProveedor: '', nit: '', telefono: '',
  correo: '', direccion: '', banco: '', numeroCuenta: '',
  tipoCuenta: '', categoriaSuministro: [], estado: 'Activo',
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
  const esMovil = useEsMovil();
  const [seleccionado, setSeleccionado] = useState(null);
  const [filtroMovil, setFiltroMovil] = useState('todos');
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState(() => localStorage.getItem('provSearchTerm') || '');
  const [paginaActual, setPaginaActual] = useState(() => parseInt(localStorage.getItem('provCurrentPage')) || 1);
  const { wrapRef: tablaWrapRef, filasPorPagina: registrosPorPagina, medido } = useFilasPorPagina(proveedores.length, 10);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [proveedorEditando, setProveedorEditando] = useState(null);
  const [form, setForm] = useState(formInicial);
  const [cargando, setCargando] = useState(false);

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
      tipoCuenta: p.tipoCuenta || '', categoriaSuministro: p.categoriaSuministro || [],
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

  // En celular: orden alfabético y filtro rápido por estado
  const listaMovil = filtrados
    .filter((p) => filtroMovil === 'todos' || (filtroMovil === 'activos' ? p.estado === 'Activo' : p.estado !== 'Activo'))
    .sort((a, b) => String(a.razonSocial).localeCompare(String(b.razonSocial), 'es'));

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

      {esMovil ? (
        <>
          <ChipsFiltro
            opciones={[{ id: 'todos', label: 'Todos' }, { id: 'activos', label: 'Activos' }, { id: 'inactivos', label: 'Inactivos' }]}
            valor={filtroMovil}
            onCambiar={setFiltroMovil}
          />
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
        </>
      ) : (
      <>
      <div className="proveedores-table-wrap" ref={tablaWrapRef}>
        <table className={`proveedores-table${paginaLlena ? ' proveedores-table-llena' : ''}`}>
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
              <tr key={p.proveedorid} data-fila>
                <td className="proveedores-td-razon" data-label="Razón Social">{p.razonSocial}</td>
                <td data-label="Nombre Contacto">{p.nombreProveedor}</td>
                <td data-label="NIT">{p.nit}</td>
                <td data-label="Teléfono">{p.telefono}</td>
                <td data-label="Banco">{p.banco}</td>
                <td data-label="Estado">
                  <span className={`proveedores-estado ${p.estado === 'Activo' ? 'activo' : 'inactivo'}`}>{p.estado}</span>
                </td>
                <td className="proveedores-td-acciones" data-label="Acciones">
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
            <button type="button" className="pi-accion pi-accion-primaria" onClick={() => { const p = seleccionado; setSeleccionado(null); abrirEditar(p); }}><Edit2 size={15} /> Editar</button>
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

      {mostrarModal && (
        <div className="proveedores-overlay" onClick={cerrarModal}>
          <div className="proveedores-modal" onClick={(e) => e.stopPropagation()}>
            <div className="proveedores-modal-header">
              <h3>{proveedorEditando ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
              <button className="proveedores-modal-close" onClick={cerrarModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="proveedores-form">
              <div className="proveedores-form-row">
                <div className="proveedores-form-group"><label>Nombre / Razón Social *</label><input name="razonSocial" value={form.razonSocial} onChange={handleChange} required /></div>
                <div className="proveedores-form-group"><label>Nombre Contacto <span className="campo-opcional">(opcional)</span></label><input name="nombreProveedor" value={form.nombreProveedor} onChange={handleChange} /></div>
              </div>
              <div className="proveedores-form-row">
                <div className="proveedores-form-group"><label>NIT <span className="campo-opcional">(opcional)</span></label><input name="nit" value={form.nit} onChange={handleChange} /></div>
                <div className="proveedores-form-group"><label>Teléfono <span className="campo-opcional">(opcional)</span></label><input name="telefono" value={form.telefono} onChange={handleChange} /></div>
              </div>
              <div className="proveedores-form-row">
                <div className="proveedores-form-group"><label>Correo <span className="campo-opcional">(opcional)</span></label><input name="correo" type="email" value={form.correo} onChange={handleChange} /></div>
                <div className="proveedores-form-group"><label>Dirección <span className="campo-opcional">(opcional)</span></label><input name="direccion" value={form.direccion} onChange={handleChange} /></div>
              </div>
              <div className="proveedores-form-row">
                <div className="proveedores-form-group"><label>Banco <span className="campo-opcional">(opcional)</span></label><input name="banco" value={form.banco} onChange={handleChange} /></div>
                <div className="proveedores-form-group"><label>Cuenta <span className="campo-opcional">(opcional)</span></label><input name="numeroCuenta" value={form.numeroCuenta} onChange={handleChange} /></div>
              </div>
              <div className="proveedores-form-row">
                <div className="proveedores-form-group">
                  <label>Tipo Cuenta <span className="campo-opcional">(opcional)</span></label>
                  <select name="tipoCuenta" value={form.tipoCuenta} onChange={handleChange}>
                    <option value="">Sin especificar</option>
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
