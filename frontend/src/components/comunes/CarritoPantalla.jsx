import { useEffect } from 'react';
import { X, Search, ShoppingCart, Trash2, Plus, Minus, PackageSearch, CheckCircle2, ArrowLeft, FileText } from 'lucide-react';
import BarraCarrito from './BarraCarrito';
import SelectorTalla from '../vendedor/dashboard/balance/vistas/SelectorTalla';
import { pasoDe, minimoDe } from '../../hooks/useCarrito';
import { stepCantidad, formatearCantidad } from '../../utils/unidades';
import { imagenUrl } from '../../config';
import '../vendedor/dashboard/balance/vistas/styles/CartStyles.css';

const formatoMoneda = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(valor) || 0);

/**
 * Pantalla de carrito (catálogo a la izquierda, carrito fijo a la derecha; en celular el carrito sube desde abajo).
 * La usan Registrar venta y Registrar egreso; cada una aporta sus datos y su acción de cierre.
 *
 * tono: 'venta' | 'egreso'  (cambia el color del precio y del botón)
 * precioDe(item): precio unitario que se muestra y suma (venta o compra)
 * mostrarStock: en una venta se ve el stock y no se agregan agotados
 * modoTalla: modo del selector de tallas ('venta' bloquea tallas sin stock; 'compra' deja elegir cualquiera)
 */
function CarritoPantalla({
  tono = 'venta', titulo, subtitulo, icono: Icono = ShoppingCart, onVolver,
  tituloCarrito, textoBoton, etiquetaBarra, textoTotal = 'Total',
  mostrarStock = false, precioDe, modoTalla = 'venta',
  productos, cargando, busqueda, onBusqueda, categorias, categoriaSeleccionada, onCategoria,
  contactoEtiqueta, contactoVacio, contactos, contactoId, onContacto, notas, onNotas, notasPlaceholder,
  carrito, totalCarrito, onAgregar, onCantidad, onCantidadDirecta, onEliminar,
  procesando, onFinalizar, esMovil, abierto, onAbrir, onCerrar,
  productoParaTalla, onElegirTalla, onCerrarTalla,
}) {
  // Con el carrito abierto en celular: Esc lo cierra y la página de atrás no hace scroll
  useEffect(() => {
    if (!esMovil || !abierto) return undefined;
    const alTeclear = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [esMovil, abierto, onCerrar]);

  const unidades = carrito.reduce((s, i) => s + i.cantidad, 0);
  const enCarrito = (p) => carrito.filter((i) => i.productoid === p.productoid).reduce((s, i) => s + i.cantidad, 0);
  const hoja = esMovil ? ' cart-sheet' : '';

  return (
    <div className={`cart-page-container cart-tono-${tono}`}>
      <div className="cart-modal-container full-page">
        <header className="cart-modal-header">
          <button type="button" className="back-button" onClick={onVolver} aria-label="Volver">
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <span className="cart-modal-icono"><Icono size={20} aria-hidden="true" /></span>
          <div className="cart-modal-textos">
            <h1>{titulo}</h1>
            {subtitulo && <p>{subtitulo}</p>}
          </div>
        </header>

        <div className="cart-main-content">
          {/* Catálogo */}
          <section className="product-selection-panel" aria-label="Productos">
            <div className="search-filter-bar">
              <div className="search-input-wrapper">
                <Search className="search-icon" size={18} aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  aria-label="Buscar producto"
                  value={busqueda}
                  onChange={(e) => onBusqueda(e.target.value)}
                />
              </div>
              <select className="category-select" aria-label="Categoría" value={categoriaSeleccionada} onChange={(e) => onCategoria(e.target.value)}>
                <option value="">Todas las categorías</option>
                {categorias.map((cat) => <option key={cat.categoriaid} value={cat.categoriaid}>{cat.nombre}</option>)}
              </select>
            </div>

            {cargando ? (
              <div className="empty-cart-state" role="status">
                <div className="loader-spinner" />
                <p>Cargando productos...</p>
              </div>
            ) : productos.length > 0 ? (
              <div className="productos-container-cart">
                {productos.map((p) => {
                  const agotado = mostrarStock && p.stockDisponible <= 0;
                  const cantidadEnCarrito = enCarrito(p);
                  return (
                    <button
                      type="button"
                      key={p.productoid}
                      className={`producto-card ${agotado ? 'producto-card-agotado' : ''}`}
                      disabled={agotado}
                      onClick={() => onAgregar(p)}
                      aria-label={`${agotado ? 'Agotado: ' : 'Agregar '}${p.nombre}, ${formatoMoneda(precioDe(p))}`}
                    >
                      <span className="producto-imagen-container">
                        <img
                          src={imagenUrl(p.imagenes?.[0])}
                          alt=""
                          className="producto-imagen"
                          loading="lazy"
                          onError={(e) => { e.currentTarget.src = '/images/default-product.png'; }}
                        />
                        {cantidadEnCarrito > 0 && <span className="producto-en-carrito">× {formatearCantidad(cantidadEnCarrito, p.unidadMedida)}</span>}
                        {mostrarStock && (agotado ? (
                          <span className="stock-badge-cart stock-out-cart">Agotado</span>
                        ) : (
                          <span className={`stock-badge-cart ${p.stockDisponible < 5 ? 'stock-low-cart' : ''}`}>
                            Stock: {formatearCantidad(p.stockDisponible, p.unidadMedida)}
                          </span>
                        ))}
                      </span>
                      <span className="product-info">
                        <span className="producto-nombre">{p.nombre}</span>
                        {p.categoriaNombre && <span className="product-category">{p.categoriaNombre}</span>}
                        <span className="producto-precio-cart">{formatoMoneda(precioDe(p))}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="empty-cart-state">
                <PackageSearch size={44} strokeWidth={1.5} aria-hidden="true" />
                <p>No se encontraron productos</p>
              </div>
            )}
          </section>

          {/* Carrito */}
          <aside
            className={`cart-summary-panel${hoja}${abierto ? ' abierto' : ''}`}
            aria-label={tituloCarrito}
            {...(esMovil ? { role: 'dialog', 'aria-modal': abierto ? 'true' : undefined } : {})}
          >
            <div className="cart-title">
              <ShoppingCart size={18} aria-hidden="true" />
              <span>{tituloCarrito}</span>
              {unidades > 0 && <span className="cart-title-cuenta">{unidades}</span>}
              {esMovil && (
                <button type="button" className="cart-sheet-cerrar" onClick={onCerrar} aria-label="Cerrar carrito"><X size={18} aria-hidden="true" /></button>
              )}
            </div>

            <div className="client-selection-cart">
              <label htmlFor="cart-contacto">{contactoEtiqueta} <span className="cart-opcional">(opcional)</span></label>
              <select id="cart-contacto" value={contactoId} onChange={(e) => onContacto(e.target.value)} className="cart-select-input">
                <option value="">{contactoVacio}</option>
                {contactos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            <div className="cart-notes-section">
              <label htmlFor="cart-notas"><FileText size={12} aria-hidden="true" /> Notas <span className="cart-opcional">(opcional)</span></label>
              <textarea id="cart-notas" className="cart-notes-input" placeholder={notasPlaceholder} value={notas} onChange={(e) => onNotas(e.target.value)} rows={2} />
            </div>

            <div className="cart-items-list">
              {carrito.length === 0 ? (
                <div className="empty-cart-state">
                  <ShoppingCart size={40} strokeWidth={1.5} aria-hidden="true" />
                  <p>El carrito está vacío.<br />Toca un producto para agregarlo.</p>
                </div>
              ) : carrito.map((item) => (
                <div key={item.clave} className="cart-item">
                  <img src={imagenUrl(item.imagenes?.[0])} className="cart-item-image" alt="" />
                  <div className="cart-item-details">
                    <span className="cart-item-name">{item.nombre}</span>
                    {item.talla && <span className="cart-item-talla">Talla {item.talla}</span>}
                    <span className="cart-item-price">{formatoMoneda(precioDe(item) * item.cantidad)}</span>
                  </div>
                  <div className="cart-item-actions">
                    <button type="button" className="remove-item" onClick={() => onEliminar(item.clave)} aria-label={`Quitar ${item.nombre}${item.talla ? ` talla ${item.talla}` : ''}`}>
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                    <div className="quantity-controls">
                      <button type="button" className="qty-btn" onClick={() => onCantidad(item.clave, -1)} disabled={item.cantidad - pasoDe(item) < minimoDe(item)} aria-label="Quitar una unidad">
                        <Minus size={14} aria-hidden="true" />
                      </button>
                      <input
                        className="qty-input"
                        type="number"
                        aria-label={`Cantidad de ${item.nombre}`}
                        min={minimoDe(item)}
                        step={stepCantidad(item.unidadMedida)}
                        max={mostrarStock ? item.stockDisponible : undefined}
                        value={item.cantidad}
                        onChange={(e) => onCantidadDirecta(item.clave, e.target.value)}
                      />
                      <button type="button" className="qty-btn" onClick={() => onCantidad(item.clave, 1)} disabled={mostrarStock && item.cantidad + pasoDe(item) > item.stockDisponible} aria-label="Agregar una unidad">
                        <Plus size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-footer">
              <div className="cart-total-row" aria-live="polite">
                <span className="total-label">{textoTotal} · {unidades} {unidades === 1 ? 'unidad' : 'unidades'}</span>
                <span className="total-amount">{formatoMoneda(totalCarrito)}</span>
              </div>
              <button type="button" className={`checkout-button ${tono === 'egreso' ? 'egreso-btn' : ''} ${procesando ? 'loading' : ''}`} disabled={carrito.length === 0 || procesando} onClick={onFinalizar}>
                {procesando ? (
                  <><span className="loader-spinner loader-spinner--boton" /><span>Procesando...</span></>
                ) : (
                  <><CheckCircle2 size={20} aria-hidden="true" /><span>{textoBoton}</span></>
                )}
              </button>
            </div>
          </aside>
        </div>
      </div>

      {esMovil && abierto && <div className="cart-sheet-fondo" onClick={onCerrar} />}
      {esMovil && !abierto && (
        <BarraCarrito cantidad={carrito.length} total={formatoMoneda(totalCarrito)} etiqueta={etiquetaBarra} tono={tono} onAbrir={onAbrir} />
      )}

      {productoParaTalla && (
        <SelectorTalla producto={productoParaTalla} modo={modoTalla} onSelect={onElegirTalla} onClose={onCerrarTalla} />
      )}
    </div>
  );
}

export default CarritoPantalla;
