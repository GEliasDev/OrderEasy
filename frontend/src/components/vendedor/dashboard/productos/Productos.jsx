import React, { useState, useEffect } from 'react';
import { ShoppingCart, Search, FileSpreadsheet } from 'lucide-react';
import { getAllProducts } from '../../../../services/productServices';
import { useFilasPorPagina } from '../../../../hooks/useFilasPorPagina';
import { exportarProductosPorPaginas } from './exportarExcel';
import './Productos.css';

// Filas por página al exportar a Excel (la tabla en pantalla ajusta las suyas al alto disponible)
const FILAS_EXPORTACION = 20;
// Filas por página en móvil (las filas se muestran como tarjetas y la página hace scroll)
const FILAS_MOVIL = 20;

const Productos = () => {
  const [productos, setProductos] = useState([]);
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem("prodSearchTerm") || "");
  const [categoriaFiltro, setCategoriaFiltro] = useState(() => localStorage.getItem("prodCatFilter") || "Todas");
  const [paginaActual, setPaginaActual] = useState(() => parseInt(localStorage.getItem("prodCurrentPage")) || 1);
  const [paginasAExportar, setPaginasAExportar] = useState(1);
  const { wrapRef: tablaWrapRef, filasPorPagina: productosPorPagina, medido } = useFilasPorPagina(productos.length, FILAS_MOVIL);


  useEffect(() => {
    const fetchProductos = async () => {
      try {
        const data = await getAllProducts();
        setProductos(data);
      } catch (error) {
        console.error('Error al obtener productos:', error);
      }
    };
    fetchProductos();
  }, []);

  const handleSetSearch = (val) => {
    setSearchTerm(val);
    setPaginaActual(1);
    localStorage.setItem("prodSearchTerm", val);
    localStorage.setItem("prodCurrentPage", 1);
  };

  const handleSetCategory = (val) => {
    setCategoriaFiltro(val);
    setPaginaActual(1);
    localStorage.setItem("prodCatFilter", val);
    localStorage.setItem("prodCurrentPage", 1);
  };

  const handleSetPagina = (val) => {
    setPaginaActual(val);
    localStorage.setItem("prodCurrentPage", val);
  };

  const formatFecha = (fecha) => {
    const f = new Date(fecha);
    const dia = String(f.getDate()).padStart(2, '0');
    const mes = String(f.getMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}/${f.getFullYear()}`;
  };

  const categoriasUnicas = ['Todas', ...new Set(productos.map(p => p.categoriaNombre).filter(Boolean))];

  const productosFiltrados = productos.filter((p) => {
    const coincideNombre = p.nombre?.toLowerCase().includes(searchTerm.toLowerCase());
    const coincideCategoria = categoriaFiltro === 'Todas' || p.categoriaNombre === categoriaFiltro;
    return coincideNombre && coincideCategoria;
  });

  const totalPaginas = Math.ceil(productosFiltrados.length / productosPorPagina);
  const totalPaginasExportacion = Math.ceil(productosFiltrados.length / FILAS_EXPORTACION);
  const inicio = (paginaActual - 1) * productosPorPagina;
  const pagina = productosFiltrados.slice(inicio, inicio + productosPorPagina);
  // Con la página llena, las filas se reparten el alto sobrante para llegar hasta abajo
  const paginaLlena = medido && pagina.length === productosPorPagina;

  // Si al cambiar el tamaño de pantalla la página actual deja de existir, vuelve a la última
  useEffect(() => {
    if (totalPaginas > 0 && paginaActual > totalPaginas) {
      setPaginaActual(totalPaginas);
      localStorage.setItem("prodCurrentPage", totalPaginas);
    }
  }, [totalPaginas, paginaActual]);

  return (
    <div className="productos-main">
      <div className="productos-header">
        <div className="productos-header-left">
          <ShoppingCart size={18} className="productos-header-icon" />
          <h2 className="productos-titulo">Productos</h2>
          <span className="productos-badge">{productos.length}</span>
        </div>
        <div className="productos-header-right">
          <select
            className="productos-select"
            value={categoriaFiltro}
            onChange={(e) => handleSetCategory(e.target.value)}
          >
            {categoriasUnicas.map((cat, i) => (
              <option key={i} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            className="productos-select"
            value={paginasAExportar}
            onChange={(e) => setPaginasAExportar(Number(e.target.value))}
          >
            {Array.from({ length: totalPaginasExportacion || 1 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1} pág.</option>
            ))}
          </select>
          <button
            className="productos-btn-exportar"
            onClick={() => exportarProductosPorPaginas(productosFiltrados.slice(0, paginasAExportar * FILAS_EXPORTACION))}
          >
            <FileSpreadsheet size={14} />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      <div className="productos-search-wrap">
        <Search size={14} className="productos-search-icon" />
        <input
          type="text"
          className="productos-search"
          placeholder="Buscar productos..."
          value={searchTerm}
          onChange={(e) => handleSetSearch(e.target.value)}
        />
      </div>

      <div className="productos-table-wrap" ref={tablaWrapRef}>
        <table className={`productos-table${paginaLlena ? ' productos-table-llena' : ''}`}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th>Cód. Barras</th>
              <th>IVA</th>
              <th>Stock</th>
              <th>Compra</th>
              <th>Venta</th>
            </tr>
          </thead>
          <tbody>
            {pagina.length > 0 ? pagina.map((p) => (
              <tr key={p.productoid} data-fila>
                <td data-label="Fecha">{formatFecha(p.createdat)}</td>
                <td className="productos-td-nombre" data-label="Nombre">{p.nombre}</td>
                <td className="productos-td-descripcion" data-label="Descripción" title={p.descripcion}>{p.descripcion}</td>
                <td data-label="Categoría">{p.categoriaNombre}</td>
                <td className="productos-td-barcode" data-label="Cód. Barras">{p.codigoBarras || <span className="productos-td-empty">—</span>}</td>
                <td data-label="IVA">{p.tasaIva ?? 0}%</td>
                <td data-label="Stock">{p.cantidadDisponible}</td>
                <td data-label="Compra">${Number(p.precioCompra).toLocaleString('es-CO')}</td>
                <td data-label="Venta">${Number(p.precioVenta).toLocaleString('es-CO')}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="9" className="productos-empty">
                  <ShoppingCart size={28} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                  <p>No se encontraron productos</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="productos-paginacion">
          <button onClick={() => handleSetPagina(paginaActual - 1)} disabled={paginaActual === 1}>Anterior</button>
          <span>Página {paginaActual} de {totalPaginas}</span>
          <button onClick={() => handleSetPagina(paginaActual + 1)} disabled={paginaActual === totalPaginas}>Siguiente</button>
        </div>
      )}
    </div>
  );
};

export default Productos;
