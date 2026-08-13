import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useDebounce } from '../../../../hooks/useDebounce';
import VisualizarProductos from './vistas/VisualizarProductos';
import { getCategoriesByUser } from '../../../../services/categoryServices';
import { getAllProducts } from '../../../../services/productServices';
import './inventario.css';

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
  const productosPorPagina = 10;

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

  const indexUltimo = currentPage * productosPorPagina;
  const indexPrimero = indexUltimo - productosPorPagina;
  const productosPaginados = productosFiltrados.slice(indexPrimero, indexUltimo);
  const totalPaginas = Math.ceil(productosFiltrados.length / productosPorPagina);

  const paginasAMostrar = (() => {
    const rangoInicio = Math.max(1, currentPage - 2);
    const rangoFin = Math.min(totalPaginas, rangoInicio + 4);
    return Array.from({ length: rangoFin - rangoInicio + 1 }, (_, i) => rangoInicio + i);
  })();

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

      <div className="inventario-products">
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <VisualizarProductos productos={productosPaginados} onRefresh={fetchProductos} />
        )}
      </div>

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
  );
}

export default Inventario;
