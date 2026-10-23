import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, FileSpreadsheet, Eye, Package } from 'lucide-react';

const CAT_COLORS = ['#3B82F6','#8B5CF6','#EC4899','#F59E0B','#10B981','#06B6D4','#EF4444','#6366F1','#14B8A6','#F97316'];
const colorCategoria = (cat) => CAT_COLORS[Math.abs((cat || '').split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % CAT_COLORS.length];
import { getAllProducts } from '../../../../services/productServices';
import { useFilasPorPagina } from '../../../../hooks/useFilasPorPagina';
import { formatearCantidad } from '../../../../utils/unidades';
import { exportarProductosPorPaginas } from './exportarExcel';
import { imagenUrl } from '../../../../config';
import { useEsMovil } from '../../../../hooks/useEsMovil';
import ListaMovil, { ChipsFiltro } from '../../../comunes/ListaMovil';
import PanelInferior, { DatoPanel } from '../../../comunes/PanelInferior';
import './Productos.css';

// Filas por página al exportar a Excel (la tabla en pantalla ajusta las suyas al alto disponible)
const FILAS_EXPORTACION = 20;
// Filas por página en móvil (las filas se muestran como tarjetas y la página hace scroll)
const FILAS_MOVIL = 20;

const formatoPeso = (valor) => `$${Number(valor).toLocaleString('es-CO')}`;

const Productos = () => {
  const esMovil = useEsMovil();
  const navigate = useNavigate();
  const [seleccionado, setSeleccionado] = useState(null);
  const [filtroStock, setFiltroStock] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [cargadoMovil, setCargadoMovil] = useState(false);
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
      } finally {
        setCargadoMovil(true);
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
    const coincideEstado = filtroEstado === 'todos' || (filtroEstado === 'activo') === (p.activo !== false);
    return coincideNombre && coincideCategoria && coincideEstado;
  });

  // En celular: orden alfabético y filtro rápido por existencias
  const listaMovil = productosFiltrados
    .filter((p) => filtroStock === 'todos' || (filtroStock === 'con' ? Number(p.cantidadDisponible) > 0 : Number(p.cantidadDisponible) <= 0))
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));

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
        <div>
          <h1 className="productos-titulo">Productos <span className="mod-count-badge">{productos.length}</span></h1>
          <p className="productos-subtitle">Inventario de productos, precios y existencias por categoría</p>
        </div>
        <div className="productos-header-right">
          <select
            className="productos-select"
            value={filtroEstado}
            onChange={(e) => { setFiltroEstado(e.target.value); setPaginaActual(1); }}
          >
            <option value="todos">Todos los estados</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
          </select>
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

      {esMovil ? (
        <>
          <ChipsFiltro
            opciones={[{ id: 'todos', label: 'Todos' }, { id: 'con', label: 'Con stock' }, { id: 'sin', label: 'Sin stock' }]}
            valor={filtroStock}
            onCambiar={setFiltroStock}
          />
          <ListaMovil
            items={listaMovil}
            clave={(p) => p.productoid}
            cargando={!cargadoMovil}
            vacio="No se encontraron productos"
            onAbrir={setSeleccionado}
            fila={(p) => ({
              nombre: p.nombre,
              imagen: p.imagenes?.[0] ? imagenUrl(p.imagenes[0]) : undefined,
              titulo: p.nombre,
              subtitulo: `${p.categoriaNombre || 'Sin categoría'} · ${formatearCantidad(p.cantidadDisponible, p.unidadMedida)}`,
              derecha: formatoPeso(p.precioVenta),
              derechaSecundaria: Number(p.cantidadDisponible) <= 0 ? 'Agotado' : undefined,
              tono: Number(p.cantidadDisponible) <= 0 ? 'peligro' : undefined,
            })}
          />
        </>
      ) : (
      <>
      <div className="productos-table-wrap" ref={tablaWrapRef}>
        <table className={`productos-table${paginaLlena ? ' productos-table-llena' : ''}`}>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Stock</th>
              <th>Precio compra</th>
              <th>Precio venta</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pagina.length > 0 ? pagina.map((p) => {
              const stock = Number(p.cantidadDisponible);
              const stockTono = stock <= 0 ? 'tbl-badge--danger' : stock < 5 ? 'tbl-badge--warning' : 'tbl-badge--ok';
              const stockLabel = `${formatearCantidad(p.cantidadDisponible, p.unidadMedida)}${p.usaTallas ? ` · ${p.variantes?.length || 0} tallas` : ''}`;
              return (
              <tr key={p.productoid} data-fila onClick={() => navigate(`/dashboard/producto/${p.productoid}`)}>
                <td className="productos-td-producto" data-label="Producto">
                  <div className="tbl-main-cell">
                    {p.imagenes?.[0] ? (
                      <img src={imagenUrl(p.imagenes[0])} className="prod-img-mini" alt={p.nombre} />
                    ) : (
                      <span className="tbl-avatar" style={{ background: colorCategoria(p.categoriaNombre), borderRadius: '10px' }}>
                        <Package size={14} />
                      </span>
                    )}
                    <div className="tbl-cell-texts">
                      <span className="tbl-cell-primary">{p.nombre}{p.activo === false && <span className="tbl-badge" style={{ marginLeft: '0.4rem' }}>Inactivo</span>}</span>
                      <span className="tbl-cell-secondary">{p.categoriaNombre || 'Sin categoría'}</span>
                    </div>
                  </div>
                </td>
                <td data-label="Stock" title={p.usaTallas ? (p.variantes || []).map((v) => `${v.talla}: ${v.cantidadDisponible}`).join(' · ') : undefined}>
                  <span className={`tbl-badge ${stockTono}`}>{stockLabel}</span>
                </td>
                <td data-label="Precio compra">${Number(p.precioCompra).toLocaleString('es-CO')}</td>
                <td data-label="Precio venta" style={{ fontWeight: 600 }}>${Number(p.precioVenta).toLocaleString('es-CO')}</td>
                <td className="productos-td-acciones" data-label="">
                  <div className="tbl-actions">
                    <button className="tbl-icon-btn tbl-icon-btn--ver" title="Ver detalle" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/producto/${p.productoid}`); }}>
                      <Eye size={14} />
                    </button>
                  </div>
                </td>
              </tr>
              );
            }) : (
              <tr>
                <td colSpan="5" className="productos-empty">
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
      </>
      )}

      <PanelInferior
        abierto={Boolean(seleccionado)}
        onCerrar={() => setSeleccionado(null)}
        titulo={seleccionado?.nombre}
        subtitulo={seleccionado?.categoriaNombre || 'Sin categoría'}
        imagen={seleccionado?.imagenes?.[0] ? imagenUrl(seleccionado.imagenes[0]) : undefined}
        acciones={seleccionado && (
          <button type="button" className="pi-accion pi-accion-primaria" onClick={() => navigate(`/dashboard/producto/${seleccionado.productoid}`)}><Eye size={15} /> Ver producto completo</button>
        )}
      >
        {seleccionado && (
          <>
            <DatoPanel etiqueta="Descripción" valor={seleccionado.descripcion} />
            <DatoPanel etiqueta="Stock" valor={`${formatearCantidad(seleccionado.cantidadDisponible, seleccionado.unidadMedida)}${seleccionado.usaTallas ? ` · ${seleccionado.variantes?.length || 0} tallas` : ''}`} tono={Number(seleccionado.cantidadDisponible) <= 0 ? 'peligro' : undefined} />
            {seleccionado.usaTallas && (
              <DatoPanel etiqueta="Por talla" valor={(seleccionado.variantes || []).map((v) => `${v.talla}: ${v.cantidadDisponible}`).join(' · ')} />
            )}
            <DatoPanel etiqueta="Precio de compra" valor={formatoPeso(seleccionado.precioCompra)} />
            <DatoPanel etiqueta="Precio de venta" valor={formatoPeso(seleccionado.precioVenta)} />
            <DatoPanel etiqueta="IVA" valor={`${seleccionado.tasaIva ?? 0}%`} />
            <DatoPanel etiqueta="Código de barras" valor={seleccionado.codigoBarras} />
            <DatoPanel etiqueta="Creado" valor={formatFecha(seleccionado.createdat)} />
          </>
        )}
      </PanelInferior>
    </div>
  );
};

export default Productos;
