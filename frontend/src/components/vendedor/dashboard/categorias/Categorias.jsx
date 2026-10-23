import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Tag, Search, Edit2, Trash2, Package, PackageOpen } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '../../../../hooks/useDebounce';
import { getCategoriesByUser, deleteCategory } from '../../../../services/categoryServices';
import { useEsMovil } from '../../../../hooks/useEsMovil';
import { useFilasPorPagina } from '../../../../hooks/useFilasPorPagina';
import ListaMovil from '../../../comunes/ListaMovil';
import PanelInferior, { DatoPanel } from '../../../comunes/PanelInferior';
import '../../../comunes/contactos.css';

const FilaEsqueleto = () => (
  <tr>{[25, 55, 10, 10].map((w, i) => <td key={i}><span className="ct-esq" style={{ width: `${w}%` }} /></td>)}</tr>
);

function Categorias() {
  const navigate = useNavigate();
  const esMovil = useEsMovil();
  const [seleccionada, setSeleccionada] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState(() => localStorage.getItem('catSearchTerm') || '');
  const [paginaActual, setPaginaActual] = useState(() => parseInt(localStorage.getItem('catCurrentPage')) || 1);
  const { wrapRef: tablaWrapRef, filasPorPagina: registrosPorPagina, medido } = useFilasPorPagina(categorias.length, 10);

  const debouncedBusqueda = useDebounce(busqueda, 300);

  useEffect(() => {
    (async () => {
      try {
        const data = await getCategoriesByUser();
        setCategorias(Array.isArray(data) ? data : []);
      } catch {
        toast.error('Error al obtener categorías.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  const irACrear = () => navigate('/dashboard/categorias/nueva');
  const irAEditar = (c) => navigate(`/dashboard/categorias/${c.categoriaid}/editar`);

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

  const resumen = useMemo(() => {
    const conProductos = categorias.filter((c) => Number(c.totalProductos || 0) > 0).length;
    return { conProductos, vacias: categorias.length - conProductos };
  }, [categorias]);

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
    <div className="ct-pagina">
      <header className="ct-encabezado">
        <div>
          <h1>Categorías <span className="mod-count-badge">{categorias.length}</span></h1>
          <p>Agrupa tus productos para encontrarlos y analizarlos más fácil.</p>
        </div>
        <button type="button" className="ct-btn ct-btn--primario" onClick={irACrear}>
          <Plus size={16} aria-hidden="true" />
          <span>Nueva categoría</span>
        </button>
      </header>

      <section className="ct-resumen" aria-label="Resumen de categorías">
        <div className="ct-dato">
          <span className="ct-dato-icono"><Tag size={18} aria-hidden="true" /></span>
          <div><span>Categorías</span><strong>{categorias.length}</strong></div>
        </div>
        <div className="ct-dato ct-dato--ok">
          <span className="ct-dato-icono"><Package size={18} aria-hidden="true" /></span>
          <div><span>Con productos</span><strong>{resumen.conProductos}</strong></div>
        </div>
        <div className={`ct-dato ${resumen.vacias > 0 ? 'ct-dato--aviso' : ''}`}>
          <span className="ct-dato-icono"><PackageOpen size={18} aria-hidden="true" /></span>
          <div><span>Sin productos</span><strong>{resumen.vacias}</strong></div>
        </div>
      </section>

      <div className="ct-barra">
        <div className="ct-busqueda">
          <Search size={16} aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar categorías..."
            aria-label="Buscar categorías"
            value={busqueda}
            onChange={(e) => handleSetBusqueda(e.target.value)}
          />
        </div>
      </div>

      {esMovil ? (
        <ListaMovil
          items={listaMovil}
          clave={(c) => c.categoriaid}
          cargando={loading}
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
          <div className="ct-tabla-wrap" ref={tablaWrapRef}>
            <table className={`ct-tabla${paginaLlena ? ' ct-tabla-llena' : ''}`}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th className="ct-num">Productos</th>
                  <th><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <FilaEsqueleto key={i} />)
                ) : pagina.length > 0 ? pagina.map((c) => (
                  <tr key={c.categoriaid} data-fila>
                    <td><span className="tbl-cell-primary">{c.nombre}</span></td>
                    <td title={c.descripcion}>{c.descripcion || <span className="tbl-vacio">—</span>}</td>
                    <td className="ct-num">
                      <span className={`tbl-badge ${Number(c.totalProductos || 0) > 0 ? 'tbl-badge--primary' : 'tbl-badge--neutral'}`}>{c.totalProductos || 0}</span>
                    </td>
                    <td className="ct-acciones">
                      <div className="tbl-actions">
                        <button type="button" className="tbl-icon-btn tbl-icon-btn--editar" title="Editar" aria-label={`Editar la categoría ${c.nombre}`} onClick={() => irAEditar(c)}>
                          <Edit2 size={14} />
                        </button>
                        <button type="button" className="tbl-icon-btn tbl-icon-btn--borrar" title="Eliminar" aria-label={`Eliminar la categoría ${c.nombre}`} onClick={() => handleEliminar(c.categoriaid, c.nombre)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" className="ct-vacio">
                      <Tag size={28} style={{ opacity: 0.35 }} aria-hidden="true" />
                      <p>{busqueda ? 'No hay categorías con esa búsqueda' : 'Aún no tienes categorías'}</p>
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
        abierto={Boolean(seleccionada)}
        onCerrar={() => setSeleccionada(null)}
        titulo={seleccionada?.nombre}
        subtitulo="Categoría"
        acciones={seleccionada && (
          <>
            <button type="button" className="pi-accion pi-accion-primaria" onClick={() => { const c = seleccionada; setSeleccionada(null); irAEditar(c); }}><Edit2 size={15} /> Editar</button>
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
    </div>
  );
}

export default Categorias;
