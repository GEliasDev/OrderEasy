import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useDebounce } from '../../../../hooks/useDebounce';
import VisualizarProductos from './vistas/VisualizarProductos';
import { getCategoriesByUser } from '../../../../services/categoryServices';
import { getAllProducts } from '../../../../services/productServices';
import './inventario.css';

const GRID_GAP = 14;
const CARD_MIN_WIDTH = 160;
const CARD_MAX_HEIGHT = 195;

const SkeletonCard = () => (
  <div style={{ background: 'white', borderRadius: 8, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
    {[80, 60, 40].map((w, i) => (
      <div key={i} style={{ height: 14, borderRadius: 4, background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '800px 100%', animation: 'shimmer 1.4s infinite', width: `${w}%`, marginBottom: i < 2 ? '0.5rem' : 0 }} />
    ))}
  </div>
);

function Inventario() {
  const navigate = useNavigate();

  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoriaId, setSelectedCategoriaId] = useState(() => localStorage.getItem('invFilterCategory') || '');
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('invSearchTerm') || '');
  const [currentPage, setCurrentPage] = useState(() => parseInt(localStorage.getItem('invCurrentPage')) || 1);
  const [gridMetrics, setGridMetrics] = useState({ columns: 5, rows: 2 });
  const productsRef = useRef(null);

  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    Promise.all([getCategoriesByUser(), getAllProducts()])
      .then(([cats, prods]) => {
        setCategorias(Array.isArray(cats) ? cats : []);
        setProductos(Array.isArray(prods) ? prods : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCategoriaId]);

  useEffect(() => {
    const element = productsRef.current;
    if (!element) return;

    const updateMetrics = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;

      const columns = Math.max(1, Math.floor((width + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP)));
      const rows = Math.max(1, Math.floor((height + GRID_GAP) / (CARD_MAX_HEIGHT + GRID_GAP)));

      setGridMetrics((prev) => (
        prev.columns === columns && prev.rows === rows ? prev : { columns, rows }
      ));
    };

    updateMetrics();
    const observer = new ResizeObserver(updateMetrics);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fetchProductos = async () => {
    const data = await getAllProducts();
    setProductos(Array.isArray(data) ? data : []);
  };

  const productosFiltrados = productos.filter((producto) => {
    const coincideCategoria = selectedCategoriaId
      ? String(producto.categoriaid) === String(selectedCategoriaId)
      : true;
    const coincideNombre = debouncedSearch
      ? producto.nombre.toLowerCase().includes(debouncedSearch.toLowerCase())
      : true;
    return coincideCategoria && coincideNombre;
  });

  const totalFilas = Math.ceil(productosFiltrados.length / gridMetrics.columns);
  const totalPaginas = Math.max(1, Math.ceil(totalFilas / gridMetrics.rows));
  const filasPorPagina = Math.ceil(totalFilas / totalPaginas);
  const productosPorPagina = Math.max(1, filasPorPagina * gridMetrics.columns);
  const indexUltimo = currentPage * productosPorPagina;
  const indexPrimero = indexUltimo - productosPorPagina;
  const productosPaginados = productosFiltrados.slice(indexPrimero, indexUltimo);

  const paginasAMostrar = (() => {
    const rangoInicio = Math.max(1, currentPage - 2);
    const rangoFin = Math.min(totalPaginas, rangoInicio + 4);
    return Array.from({ length: rangoFin - rangoInicio + 1 }, (_, i) => rangoInicio + i);
  })();

  useEffect(() => {
    if (currentPage > totalPaginas) {
      setCurrentPage(totalPaginas);
      localStorage.setItem('invCurrentPage', totalPaginas);
    }
  }, [currentPage, totalPaginas]);

  const cambiarPagina = (nuevaPagina) => {
    if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
      setCurrentPage(nuevaPagina);
      localStorage.setItem('invCurrentPage', nuevaPagina);
    }
  };

  const handleSetSearch = (val) => {
    setSearchTerm(val);
    localStorage.setItem('invSearchTerm', val);
  };

  const handleSetCategory = (val) => {
    setSelectedCategoriaId(val);
    localStorage.setItem('invFilterCategory', val);
  };

  return (
    <div className="inventario-main">
      <style>{`@keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }`}</style>

      <div className="inventario-top">
        <div className="inventario-buttons-left">
          <button
            className="inventario-btn inventario-btn-primary"
            onClick={() => navigate('/dashboard/nuevo-producto')}
          >
            <Plus size={18} />
            <span>Agregar Producto</span>
          </button>
        </div>

        <div className="inventario-filters-right">
          <select
            className="inventario-select"
            value={selectedCategoriaId}
            onChange={(e) => handleSetCategory(e.target.value)}
          >
            <option value="">Seleccione una categoría</option>
            {categorias.map((categoria) => (
              <option key={categoria.categoriaid} value={categoria.categoriaid}>
                {categoria.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="inventario-search-sticky">
        <input
          type="text"
          className="inventario-search-input"
          placeholder="Buscar Producto"
          value={searchTerm}
          onChange={(e) => handleSetSearch(e.target.value)}
        />
      </div>

      <div className="inventario-products" ref={productsRef}>
        {loading ? (
          <div className="productos-container">
            {Array.from({ length: gridMetrics.columns * gridMetrics.rows }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <VisualizarProductos productos={productosPaginados} onRefresh={fetchProductos} />
        )}
      </div>

      <div className="paginacion-slot">
        {!loading && totalPaginas > 1 && (
          <div className="paginacion">
            <button className="paginacion-btn" onClick={() => cambiarPagina(currentPage - 1)} disabled={currentPage === 1}>
              Anterior
            </button>
            {paginasAMostrar.map((pagina) => (
              <button
                key={pagina}
                className={`paginacion-btn ${currentPage === pagina ? 'activo' : ''}`}
                onClick={() => cambiarPagina(pagina)}
              >
                {pagina}
              </button>
            ))}
            <button className="paginacion-btn" onClick={() => cambiarPagina(currentPage + 1)} disabled={currentPage === totalPaginas}>
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Inventario;
