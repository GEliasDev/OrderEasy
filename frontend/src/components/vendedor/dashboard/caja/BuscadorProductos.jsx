import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, PackageSearch } from 'lucide-react';
import { buscarProductos, buscarPorCodigo } from '../../../../services/cajaService';
import { useDebounce } from '../../../../hooks/useDebounce';

function BuscadorProductos({ onAgregarProducto }) {
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const inputRef = useRef(null);
  const debouncedQuery = useDebounce(query, 200);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResultados([]);
      return;
    }
    setCargando(true);
    buscarProductos(debouncedQuery)
      .then(setResultados)
      .catch(() => setResultados([]))
      .finally(() => setCargando(false));
  }, [debouncedQuery]);

  const handleKeyDown = useCallback(async (e) => {
    if (e.key !== 'Enter' || !query.trim()) return;
    e.preventDefault();
    try {
      const encontrados = await buscarPorCodigo(query.trim());
      if (encontrados.length === 1) {
        onAgregarProducto(encontrados[0]);
        setQuery('');
        setResultados([]);
      }
    } catch {}
  }, [query, onAgregarProducto]);

  const handleSeleccionar = (producto) => {
    if (producto.cantidadDisponible === 0) return;
    onAgregarProducto(producto);
    setQuery('');
    setResultados([]);
  };

  return (
    <div className="buscador-container">
      <div className="buscador-header">
        <p className="buscador-label">Buscar producto</p>
        <div className="buscador-input-wrap">
          <Search size={14} className="buscador-input-icon" />
          <input
            ref={inputRef}
            type="text"
            className="buscador-input"
            placeholder="Nombre del producto o código de barras..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <p className="buscador-hint">Presiona Enter para buscar por código de barras exacto</p>
      </div>

      <div className="buscador-body">
        {cargando && <p className="buscador-cargando">Buscando...</p>}

        {!cargando && query.trim() && resultados.length === 0 && (
          <div className="buscador-empty-state">
            <PackageSearch size={32} className="buscador-empty-icon" />
            <p className="buscador-empty">Sin resultados para &ldquo;{query}&rdquo;</p>
          </div>
        )}

        {!cargando && !query.trim() && (
          <div className="buscador-empty-state">
            <Search size={32} className="buscador-empty-icon" />
            <p className="buscador-empty">Escribe para buscar productos</p>
          </div>
        )}

        {resultados.length > 0 && (
          <div className="buscador-grid">
            {resultados.map((p) => (
              <button
                key={p.productoid}
                className={`buscador-card${p.cantidadDisponible === 0 ? ' sin-stock' : ''}`}
                onClick={() => handleSeleccionar(p)}
                disabled={p.cantidadDisponible === 0}
              >
                <span className="buscador-card-nombre">{p.nombre}</span>
                {p.categoriaNombre && (
                  <span className="buscador-card-cat">{p.categoriaNombre}</span>
                )}
                <div className="buscador-card-footer">
                  <span className="buscador-card-precio">
                    ${Number(p.precioVenta).toLocaleString('es-CO')}
                  </span>
                  <span className={`buscador-card-stock-badge${p.cantidadDisponible === 0 ? ' agotado' : ''}`}>
                    {p.cantidadDisponible === 0 ? 'Agotado' : `${p.cantidadDisponible} uds`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BuscadorProductos;
