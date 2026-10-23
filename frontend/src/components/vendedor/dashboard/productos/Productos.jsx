import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, FileSpreadsheet, Eye, Package, Boxes, Coins, PackageX, TriangleAlert } from 'lucide-react';
import { getAllProducts } from '../../../../services/productServices';
import { useFilasPorPagina } from '../../../../hooks/useFilasPorPagina';
import { formatearCantidad } from '../../../../utils/unidades';
import { exportarProductosPorPaginas } from './exportarExcel';
import { imagenUrl } from '../../../../config';
import { useEsMovil } from '../../../../hooks/useEsMovil';
import ListaMovil, { ChipsFiltro } from '../../../comunes/ListaMovil';
import PanelInferior, { DatoPanel } from '../../../comunes/PanelInferior';
import '../../../comunes/contactos.css';

// Filas por página al exportar a Excel (la tabla en pantalla ajusta las suyas al alto disponible)
const FILAS_EXPORTACION = 20;
// Filas por página en móvil (las filas se muestran como tarjetas y la página hace scroll)
const FILAS_MOVIL = 20;
const STOCK_BAJO = 5;

const CAT_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#EF4444', '#6366F1', '#14B8A6', '#F97316'];
const colorCategoria = (cat) => CAT_COLORS[Math.abs((cat || '').split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % CAT_COLORS.length];

const formatoPeso = (valor) => `$${Number(valor).toLocaleString('es-CO')}`;
const formatoCompacto = (valor) => `$${new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(valor) || 0)}`;
const activo = (p) => p.activo !== false;
const textoStock = (p) => `${formatearCantidad(p.cantidadDisponible, p.unidadMedida)}${p.usaTallas ? ` · ${p.variantes?.length || 0} tallas` : ''}`;

const FilaEsqueleto = () => (
  <tr>{[45, 20, 15, 15, 8].map((w, i) => <td key={i}><span className="ct-esq" style={{ width: `${w}%` }} /></td>)}</tr>
);

const Productos = () => {
  const esMovil = useEsMovil();
  const navigate = useNavigate();
  const [seleccionado, setSeleccionado] = useState(null);
  const [filtroStock, setFiltroStock] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('prodSearchTerm') || '');
  const [categoriaFiltro, setCategoriaFiltro] = useState(() => localStorage.getItem('prodCatFilter') || 'Todas');
  const [paginaActual, setPaginaActual] = useState(() => parseInt(localStorage.getItem('prodCurrentPage')) || 1);
  const [paginasAExportar, setPaginasAExportar] = useState(1);
  const { wrapRef: tablaWrapRef, filasPorPagina: productosPorPagina, medido } = useFilasPorPagina(productos.length, FILAS_MOVIL);

  useEffect(() => {
    (async () => {
      try {
        setProductos(await getAllProducts());
      } catch (error) {
        console.error('Error al obtener productos:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSetSearch = (val) => {
    setSearchTerm(val);
    setPaginaActual(1);
    localStorage.setItem('prodSearchTerm', val);
    localStorage.setItem('prodCurrentPage', 1);
  };

  const handleSetCategory = (val) => {
    setCategoriaFiltro(val);
    setPaginaActual(1);
    localStorage.setItem('prodCatFilter', val);
    localStorage.setItem('prodCurrentPage', 1);
  };

  const handleSetPagina = (val) => {
    setPaginaActual(val);
    localStorage.setItem('prodCurrentPage', val);
  };

  const cambiarFiltro = (setter) => (val) => {
    setter(val);
    handleSetPagina(1);
  };

  const formatFecha = (fecha) => {
    const f = new Date(fecha);
    return `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`;
  };

  const resumen = useMemo(() => {
    const vigentes = productos.filter(activo);
    return {
      valorInventario: vigentes.reduce((s, p) => s + Number(p.cantidadDisponible) * Number(p.precioCompra), 0),
      sinStock: vigentes.filter((p) => Number(p.cantidadDisponible) <= 0).length,
      stockBajo: vigentes.filter((p) => Number(p.cantidadDisponible) > 0 && Number(p.cantidadDisponible) < STOCK_BAJO).length,
    };
  }, [productos]);

  const categoriasUnicas = ['Todas', ...new Set(productos.map((p) => p.categoriaNombre).filter(Boolean))];

  const productosFiltrados = productos.filter((p) => {
    const coincideNombre = p.nombre?.toLowerCase().includes(searchTerm.toLowerCase());
    const coincideCategoria = categoriaFiltro === 'Todas' || p.categoriaNombre === categoriaFiltro;
    const coincideEstado = filtroEstado === 'todos' || (filtroEstado === 'activo') === activo(p);
    const stock = Number(p.cantidadDisponible);
    const coincideStock = filtroStock === 'todos'
      || (filtroStock === 'con' && stock > 0)
      || (filtroStock === 'sin' && stock <= 0)
      || (filtroStock === 'bajo' && stock > 0 && stock < STOCK_BAJO);
    return coincideNombre && coincideCategoria && coincideEstado && coincideStock;
  });

  const listaMovil = [...productosFiltrados].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));

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
      localStorage.setItem('prodCurrentPage', totalPaginas);
    }
  }, [totalPaginas, paginaActual]);

  const verProducto = (p) => navigate(`/dashboard/producto/${p.productoid}`);

  return (
    <div className="ct-pagina">
      <header className="ct-encabezado">
        <div>
          <h1>Productos <span className="mod-count-badge">{productos.length}</span></h1>
          <p>Inventario de productos, precios y existencias por categoría.</p>
        </div>
        <div className="ct-acciones-encabezado">
          <select className="ct-select" aria-label="Páginas a exportar" value={paginasAExportar} onChange={(e) => setPaginasAExportar(Number(e.target.value))}>
            {Array.from({ length: totalPaginasExportacion || 1 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1} {i === 0 ? 'página' : 'páginas'}</option>
            ))}
          </select>
          <button
            type="button"
            className="ct-btn ct-btn--primario"
            disabled={productosFiltrados.length === 0}
            onClick={() => exportarProductosPorPaginas(productosFiltrados.slice(0, paginasAExportar * FILAS_EXPORTACION))}
          >
            <FileSpreadsheet size={16} aria-hidden="true" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </header>

      <section className="ct-resumen ct-resumen--cuatro" aria-label="Resumen del inventario">
        <div className="ct-dato">
          <span className="ct-dato-icono"><Boxes size={18} aria-hidden="true" /></span>
          <div><span>Productos</span><strong>{productos.length}</strong></div>
        </div>
        <div className="ct-dato ct-dato--ok">
          <span className="ct-dato-icono"><Coins size={18} aria-hidden="true" /></span>
          <div><span>Valor del inventario (costo)</span><strong title={formatoPeso(resumen.valorInventario)}>{formatoCompacto(resumen.valorInventario)}</strong></div>
        </div>
        <div className={`ct-dato ${resumen.stockBajo > 0 ? 'ct-dato--aviso' : ''}`}>
          <span className="ct-dato-icono"><TriangleAlert size={18} aria-hidden="true" /></span>
          <div><span>Stock bajo (menos de {STOCK_BAJO})</span><strong>{resumen.stockBajo}</strong></div>
        </div>
        <div className={`ct-dato ${resumen.sinStock > 0 ? 'ct-dato--peligro' : ''}`}>
          <span className="ct-dato-icono"><PackageX size={18} aria-hidden="true" /></span>
          <div><span>Sin stock</span><strong>{resumen.sinStock}</strong></div>
        </div>
      </section>

      <div className="ct-barra">
        <div className="ct-busqueda">
          <Search size={16} aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar productos..."
            aria-label="Buscar productos"
            value={searchTerm}
            onChange={(e) => handleSetSearch(e.target.value)}
          />
        </div>
        <select className="ct-select" aria-label="Categoría" value={categoriaFiltro} onChange={(e) => handleSetCategory(e.target.value)}>
          {categoriasUnicas.map((cat) => <option key={cat} value={cat}>{cat === 'Todas' ? 'Todas las categorías' : cat}</option>)}
        </select>
        <select className="ct-select" aria-label="Estado" value={filtroEstado} onChange={(e) => cambiarFiltro(setFiltroEstado)(e.target.value)}>
          <option value="todos">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
        <ChipsFiltro
          opciones={[{ id: 'todos', label: 'Todos' }, { id: 'con', label: 'Con stock' }, { id: 'bajo', label: 'Stock bajo' }, { id: 'sin', label: 'Sin stock' }]}
          valor={filtroStock}
          onCambiar={cambiarFiltro(setFiltroStock)}
        />
      </div>

      {esMovil ? (
        <ListaMovil
          items={listaMovil}
          clave={(p) => p.productoid}
          cargando={loading}
          vacio="No se encontraron productos"
          onAbrir={setSeleccionado}
          fila={(p) => ({
            nombre: p.nombre,
            imagen: p.imagenes?.[0] ? imagenUrl(p.imagenes[0]) : undefined,
            titulo: p.nombre,
            subtitulo: `${p.categoriaNombre || 'Sin categoría'} · ${formatearCantidad(p.cantidadDisponible, p.unidadMedida)}${activo(p) ? '' : ' · Inactivo'}`,
            derecha: formatoPeso(p.precioVenta),
            derechaSecundaria: Number(p.cantidadDisponible) <= 0 ? 'Agotado' : undefined,
            tono: Number(p.cantidadDisponible) <= 0 ? 'peligro' : undefined,
          })}
        />
      ) : (
        <>
          <div className="ct-tabla-wrap" ref={tablaWrapRef}>
            <table className={`ct-tabla${paginaLlena ? ' ct-tabla-llena' : ''}`}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Stock</th>
                  <th className="ct-num">Precio compra</th>
                  <th className="ct-num">Precio venta</th>
                  <th><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <FilaEsqueleto key={i} />)
                ) : pagina.length > 0 ? pagina.map((p) => {
                  const stock = Number(p.cantidadDisponible);
                  const stockTono = stock <= 0 ? 'tbl-badge--danger' : stock < STOCK_BAJO ? 'tbl-badge--warning' : 'tbl-badge--ok';
                  return (
                    <tr key={p.productoid} data-fila className="ct-fila-click" onClick={() => verProducto(p)}>
                      <td>
                        <div className="tbl-main-cell">
                          {p.imagenes?.[0] ? (
                            <img src={imagenUrl(p.imagenes[0])} className="ct-miniatura" alt="" loading="lazy" />
                          ) : (
                            <span className="tbl-avatar" style={{ background: colorCategoria(p.categoriaNombre), borderRadius: '10px', width: 38, height: 38 }}>
                              <Package size={15} aria-hidden="true" />
                            </span>
                          )}
                          <div className="tbl-cell-texts">
                            <span className="tbl-cell-primary">
                              {p.nombre}
                              {!activo(p) && <span className="tbl-badge tbl-badge--neutral" style={{ marginLeft: '0.4rem' }}>Inactivo</span>}
                            </span>
                            <span className="tbl-cell-secondary">{p.categoriaNombre || 'Sin categoría'}</span>
                          </div>
                        </div>
                      </td>
                      <td title={p.usaTallas ? (p.variantes || []).map((v) => `${v.talla}: ${v.cantidadDisponible}`).join(' · ') : undefined}>
                        <span className={`tbl-badge ${stockTono}`}>{textoStock(p)}</span>
                      </td>
                      <td className="ct-num">{formatoPeso(p.precioCompra)}</td>
                      <td className="ct-num"><strong>{formatoPeso(p.precioVenta)}</strong></td>
                      <td className="ct-acciones">
                        <div className="tbl-actions">
                          <button type="button" className="tbl-icon-btn tbl-icon-btn--ver" title="Ver detalle" aria-label={`Ver ${p.nombre}`} onClick={(e) => { e.stopPropagation(); verProducto(p); }}>
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan="5" className="ct-vacio">
                      <ShoppingCart size={28} style={{ opacity: 0.35 }} aria-hidden="true" />
                      <p>No se encontraron productos con esos filtros</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!loading && totalPaginas > 1 && (
            <nav className="ct-paginacion" aria-label="Paginación">
              <button type="button" onClick={() => handleSetPagina(paginaActual - 1)} disabled={paginaActual === 1}>Anterior</button>
              <span>Página {paginaActual} de {totalPaginas}</span>
              <button type="button" onClick={() => handleSetPagina(paginaActual + 1)} disabled={paginaActual === totalPaginas}>Siguiente</button>
            </nav>
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
          <button type="button" className="pi-accion pi-accion-primaria" onClick={() => verProducto(seleccionado)}><Eye size={15} /> Ver producto completo</button>
        )}
      >
        {seleccionado && (
          <>
            <DatoPanel etiqueta="Estado" valor={activo(seleccionado) ? 'Activo' : 'Inactivo'} />
            <DatoPanel etiqueta="Descripción" valor={seleccionado.descripcion} />
            <DatoPanel etiqueta="Stock" valor={textoStock(seleccionado)} tono={Number(seleccionado.cantidadDisponible) <= 0 ? 'peligro' : undefined} />
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
