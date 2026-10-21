import { useState, useEffect } from 'react';
import { Plus, Tag, Search, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '../../../../hooks/useDebounce';
import { getCategoriesByUser, createCategory, updateCategory, deleteCategory } from '../../../../services/categoryServices';
import { useEsMovil } from '../../../../hooks/useEsMovil';
import ListaMovil from '../../../comunes/ListaMovil';
import PanelInferior, { DatoPanel } from '../../../comunes/PanelInferior';
import './categorias.css';
import { useFilasPorPagina } from '../../../../hooks/useFilasPorPagina';

function Categorias() {
  const esMovil = useEsMovil();
  const [seleccionada, setSeleccionada] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [busqueda, setBusqueda] = useState(() => localStorage.getItem('catSearchTerm') || '');
  const [paginaActual, setPaginaActual] = useState(() => parseInt(localStorage.getItem('catCurrentPage')) || 1);
  const { wrapRef: tablaWrapRef, filasPorPagina: registrosPorPagina, medido } = useFilasPorPagina(categorias.length, 10);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '' });
  const [cargando, setCargando] = useState(false);

  const debouncedBusqueda = useDebounce(busqueda, 300);

  useEffect(() => {
    fetchCategorias();
  }, []);

  const fetchCategorias = async () => {
    try {
      const data = await getCategoriesByUser();
      setCategorias(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Error al obtener categorías.');
    }
  };

  const handleSetBusqueda = (val) => {
    setBusqueda(val);
    setPaginaActual(1);
    localStorage.setItem('catSearchTerm', val);
    localStorage.setItem('catCurrentPage', 1);
  };

  const handleSetPagina = (val) => {
    setPaginaActual(val);
    localStorage.setItem('catCurrentPage', val);
  };

  const abrirCrear = () => {
    setCategoriaEditando(null);
    setForm({ nombre: '', descripcion: '' });
    setMostrarModal(true);
  };

  const abrirEditar = (categoria) => {
    setCategoriaEditando(categoria);
    setForm({ nombre: categoria.nombre, descripcion: categoria.descripcion });
    setMostrarModal(true);
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setCategoriaEditando(null);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      if (categoriaEditando) {
        await updateCategory(categoriaEditando.categoriaid, form);
        toast.success('Categoría actualizada.');
      } else {
        await createCategory(form);
        toast.success('Categoría registrada.');
      }
      await fetchCategorias();
      cerrarModal();
    } catch (error) {
      toast.error(error.mensaje || 'Error al guardar.');
    } finally {
      setCargando(false);
    }
  };

  const handleEliminar = (id, nombre) => {
    toast(`¿Eliminar "${nombre}"?`, {
      description: 'Esta acción podría afectar productos vinculados.',
      action: {
        label: 'Eliminar',
        onClick: async () => {
          try {
            await deleteCategory(id);
            setCategorias((prev) => prev.filter((c) => c.categoriaid !== id));
            toast.success('Categoría eliminada.');
          } catch {
            toast.error('No se pudo eliminar.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  const categoriasFiltradas = categorias.filter((c) =>
    c.nombre?.toLowerCase().includes(debouncedBusqueda.toLowerCase()) ||
    c.descripcion?.toLowerCase().includes(debouncedBusqueda.toLowerCase())
  );

  const listaMovil = [...categoriasFiltradas].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));

  const total = Math.ceil(categoriasFiltradas.length / registrosPorPagina);
  const inicio = (paginaActual - 1) * registrosPorPagina;
  const pagina = categoriasFiltradas.slice(inicio, inicio + registrosPorPagina);
  // Con la página llena, las filas se reparten el alto sobrante y la tabla llega hasta abajo
  const paginaLlena = medido && pagina.length === registrosPorPagina;

  // Si al cambiar el tamaño de pantalla la página actual deja de existir, vuelve a la última
  useEffect(() => {
    if (total > 0 && paginaActual > total) {
      setPaginaActual(total);
      localStorage.setItem('catCurrentPage', total);
    }
  }, [total, paginaActual]);

  return (
    <div className="categorias-main">
      <div className="categorias-header">
        <div className="categorias-header-left">
          <Tag size={18} className="categorias-header-icon" />
          <h2 className="categorias-titulo">Categorías</h2>
          <span className="categorias-badge">{categorias.length}</span>
        </div>
        <button className="categorias-btn-nuevo" onClick={abrirCrear}>
          <Plus size={14} />
          <span>Nueva Categoría</span>
        </button>
      </div>

      <div className="categorias-search-wrap">
        <Search size={14} className="categorias-search-icon" />
        <input
          type="text"
          className="categorias-search"
          placeholder="Buscar categorías..."
          value={busqueda}
          onChange={(e) => handleSetBusqueda(e.target.value)}
        />
      </div>

      {esMovil ? (
        <ListaMovil
          items={listaMovil}
          clave={(c) => c.categoriaid}
          vacio="No se encontraron categorías"
          onAbrir={setSeleccionada}
          fila={(c) => ({
            titulo: c.nombre,
            subtitulo: c.descripcion,
            derecha: `${c.totalProductos || 0}`,
            derechaSecundaria: Number(c.totalProductos || 0) === 1 ? 'producto' : 'productos',
          })}
        />
      ) : (
      <>
      <div className="categorias-table-wrap" ref={tablaWrapRef}>
        <table className={`categorias-table${paginaLlena ? ' categorias-table-llena' : ''}`}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th className="text-center">Productos</th>
              <th className="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pagina.length > 0 ? pagina.map((c) => (
              <tr key={c.categoriaid} data-fila>
                <td className="categorias-td-nombre" data-label="Nombre">{c.nombre}</td>
                <td data-label="Descripción" title={c.descripcion}>{c.descripcion}</td>
                <td className="text-center" data-label="Productos">
                  <span className="categorias-count-badge">{c.totalProductos || 0}</span>
                </td>
                <td className="categorias-td-acciones" data-label="Acciones">
                  <button className="categorias-btn-edit" onClick={() => abrirEditar(c)}><Edit2 size={13} /></button>
                  <button className="categorias-btn-del" onClick={() => handleEliminar(c.categoriaid, c.nombre)}><Trash2 size={13} /></button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="4" className="categorias-empty">
                  <Tag size={28} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                  <p>No se encontraron categorías</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 1 && (
        <div className="categorias-paginacion">
          <button onClick={() => handleSetPagina(paginaActual - 1)} disabled={paginaActual === 1}>Anterior</button>
          <span>Página {paginaActual} de {total}</span>
          <button onClick={() => handleSetPagina(paginaActual + 1)} disabled={paginaActual === total}>Siguiente</button>
        </div>
      )}

      </>
      )}

      <PanelInferior
        abierto={Boolean(seleccionada)}
        onCerrar={() => setSeleccionada(null)}
        titulo={seleccionada?.nombre}
        subtitulo="Categoría"
        acciones={seleccionada && (
          <>
            <button type="button" className="pi-accion pi-accion-primaria" onClick={() => { const c = seleccionada; setSeleccionada(null); abrirEditar(c); }}><Edit2 size={15} /> Editar</button>
            <button type="button" className="pi-accion pi-accion-peligro" onClick={() => { const c = seleccionada; setSeleccionada(null); handleEliminar(c.categoriaid, c.nombre); }}><Trash2 size={15} /> Eliminar</button>
          </>
        )}
      >
        {seleccionada && (
          <>
            <DatoPanel etiqueta="Descripción" valor={seleccionada.descripcion} />
            <DatoPanel etiqueta="Productos" valor={`${seleccionada.totalProductos || 0}`} />
          </>
        )}
      </PanelInferior>

      {mostrarModal && (
        <div className="categorias-overlay" onClick={cerrarModal}>
          <div className="categorias-modal" onClick={(e) => e.stopPropagation()}>
            <div className="categorias-modal-header">
              <h3>{categoriaEditando ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
              <button className="categorias-modal-close" onClick={cerrarModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="categorias-form">
              <div className="categorias-form-group">
                <label>Nombre de la categoría *</label>
                <input name="nombre" value={form.nombre} onChange={handleChange} required placeholder="Ej: Electrónica" />
              </div>
              <div className="categorias-form-group">
                <label>Descripción *</label>
                <textarea name="descripcion" value={form.descripcion} onChange={handleChange} required placeholder="Descripción..." rows="3" />
              </div>
              <div className="categorias-form-actions">
                <button type="button" className="categorias-btn-cancelar" onClick={cerrarModal}>Cancelar</button>
                <button type="submit" className="categorias-btn-guardar" disabled={cargando}>
                  {cargando ? 'Guardando...' : categoriaEditando ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Categorias;
