import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calendar, CheckCircle2, ClipboardList, FileText, Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getCategoriesByUser } from '../../../../services/categoryServices';
import { getAllProducts } from '../../../../services/productServices';
import { getClientes } from '../../../../services/clienteService';
import { createPedido } from '../../../../services/pedidoService';
import { useCarrito, pasoDe, minimoDe } from '../../../../hooks/useCarrito';
import { stepCantidad, formatearCantidad } from '../../../../utils/unidades';
import SelectorTalla from '../balance/vistas/SelectorTalla';
import '../balance/vistas/styles/CartStyles.css';
import './Pedidos.css';
import { API_URL } from '../../../../config';

const formatoMoneda = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor);

function NuevoPedido() {
  const navigate = useNavigate();
  // ?pedido=ID: la compra se crea dentro de ese pedido al proveedor y se vuelve a él al terminar
  const [searchParams] = useSearchParams();
  const ordenid = Number(searchParams.get('pedido')) || null;
  const destino = ordenid ? `/dashboard/pedidos/${ordenid}` : '/dashboard/compras';
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [abonoMonto, setAbonoMonto] = useState('');
  const [abonoMetodo, setAbonoMetodo] = useState('efectivo');
  const {
    carrito, productoParaTalla, elegirProducto, elegirTalla, cerrarSelectorTalla,
    actualizarCantidad, setCantidadDirecta, eliminarDelCarrito,
  } = useCarrito({ limitarPorStock: false });
  const [busqueda, setBusqueda] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setCargando(true);
        const [categoriasData, productosData, clientesData] = await Promise.all([
          getCategoriesByUser(),
          getAllProducts(),
          getClientes(),
        ]);
        if (Array.isArray(categoriasData)) setCategorias(categoriasData);
        if (Array.isArray(productosData)) setProductos(productosData);
        if (Array.isArray(clientesData)) setClientes(clientesData);
      } catch {
        toast.error('No se pudieron cargar los productos.');
      } finally {
        setCargando(false);
      }
    };
    cargarDatos();
  }, []);

  const productosFiltrados = useMemo(() => {
    return productos
      .filter((producto) => {
        const coincideBusqueda = producto.nombre.toLowerCase().includes(busqueda.toLowerCase());
        const coincideCategoria = categoriaSeleccionada
          ? String(producto.categoriaid) === String(categoriaSeleccionada)
          : true;
        return coincideBusqueda && coincideCategoria;
      })
      .map((producto) => ({
        ...producto,
        stockDisponible: Math.max(0, Number(producto.cantidadDisponible) - Number(producto.cantidadReservada || 0)),
      }));
  }, [productos, busqueda, categoriaSeleccionada]);

  const totalCarrito = carrito.reduce((sum, item) => sum + Number(item.precioVenta) * item.cantidad, 0);

  const finalizarPedido = async () => {
    if (carrito.length === 0) return;
    if (!clienteId) {
      toast.error('Selecciona el cliente del pedido.');
      return;
    }
    if (Number(abonoMonto) > totalCarrito) {
      toast.error('El abono no puede superar el total del pedido.');
      return;
    }
    try {
      setProcesando(true);
      await createPedido({
        clienteid: clienteId,
        ordenid: ordenid || undefined,
        descripcion,
        fechaEntrega: fechaEntrega || null,
        abono: Number(abonoMonto) > 0 ? { monto: Number(abonoMonto), metodo: abonoMetodo } : undefined,
        items: carrito.map((item) => ({
          productoid: item.productoid,
          talla: item.talla,
          cantidad: item.cantidad,
        })),
      });
      toast.success(ordenid ? `Compra agregada al pedido #${ordenid}.` : 'Compra creada. Confírmala para reservar el stock.');
      navigate(destino);
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo crear el pedido.');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="cart-page-container">
      <div className="cart-modal-container full-page">
        <div className="cart-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="back-button" onClick={() => navigate(destino)}>
              <ArrowLeft size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ClipboardList size={24} style={{ color: 'var(--color-primary)' }} />
              <h2>{ordenid ? `Nueva compra · Pedido #${ordenid}` : 'Nueva compra de cliente'}</h2>
            </div>
          </div>
        </div>

        <div className="cart-main-content">
          <div className="product-selection-panel">
            <div className="search-filter-bar">
              <div className="search-input-wrapper">
                <Search className="search-icon" size={18} />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
              <select
                className="category-select"
                value={categoriaSeleccionada}
                onChange={(e) => setCategoriaSeleccionada(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {categorias.map((categoria) => (
                  <option key={categoria.categoriaid} value={categoria.categoriaid}>{categoria.nombre}</option>
                ))}
              </select>
            </div>

            <p className="pedido-aviso">
              Puedes pedir más unidades que el stock actual. Al confirmar el pedido se reserva el stock y puedes generar la compra al proveedor por los faltantes.
            </p>

            {cargando ? (
              <div className="empty-cart-state">
                <div className="loader-spinner" style={{ borderTopColor: 'var(--color-primary)' }}></div>
                <p>Cargando productos...</p>
              </div>
            ) : productosFiltrados.length > 0 ? (
              <div className="productos-container-cart">
                {productosFiltrados.map((producto) => (
                  <div
                    key={producto.productoid}
                    className="producto-card"
                    onClick={() => elegirProducto(producto)}
                  >
                    <div className="producto-imagen-container">
                      <img
                        src={producto.imagenes && producto.imagenes.length > 0
                          ? (producto.imagenes[0].startsWith('http') ? producto.imagenes[0] : `${API_URL}/uploads/${producto.imagenes[0]}`)
                          : '/images/default-product.png'}
                        alt={producto.nombre}
                        className="producto-imagen"
                        onError={(e) => { e.target.src = '/images/default-product.png'; }}
                      />
                      <div className={`stock-badge-cart ${producto.stockDisponible <= 0 ? 'stock-out-cart' : ''}`}>
                        {producto.stockDisponible > 0 ? `Disponible: ${formatearCantidad(producto.stockDisponible, producto.unidadMedida)}` : 'Bajo pedido'}
                      </div>
                    </div>
                    <div className="product-info">
                      <h3 className="producto-nombre">{producto.nombre}</h3>
                      {producto.categoriaNombre && <span className="product-category">{producto.categoriaNombre}</span>}
                      <span className="producto-precio-cart">{formatoMoneda(producto.precioVenta)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-cart-state">
                <ClipboardList size={48} />
                <p>No se encontraron productos</p>
              </div>
            )}
          </div>

          <div className="cart-summary-panel">
            <div className="cart-title">
              <ClipboardList size={20} />
              Pedido
            </div>

            <div className="client-selection-cart">
              <label>Cliente</label>
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="cart-select-input"
              >
                <option value="">Selecciona un cliente...</option>
                {clientes.map((cliente) => (
                  <option key={cliente.clienteid} value={cliente.clienteid}>{cliente.nombreCliente}</option>
                ))}
              </select>
            </div>

            <div className="client-selection-cart">
              <label>Abono inicial (Opcional)</label>
              <div className="pedido-abono-inicial">
                <input
                  type="number"
                  min="0"
                  max={totalCarrito || undefined}
                  className="cart-select-input"
                  placeholder="$ 0"
                  value={abonoMonto}
                  onChange={(e) => setAbonoMonto(e.target.value)}
                />
                <select className="cart-select-input" value={abonoMetodo} onChange={(e) => setAbonoMetodo(e.target.value)}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>
            </div>

            <div className="client-selection-cart">
              <label><Calendar size={11} /> Fecha de entrega (Opcional)</label>
              <input
                type="date"
                className="cart-select-input"
                value={fechaEntrega}
                onChange={(e) => setFechaEntrega(e.target.value)}
              />
            </div>

            <div className="cart-notes-section">
              <label><FileText size={11} /> Notas (Opcional)</label>
              <textarea
                className="cart-notes-input"
                placeholder="Referencia del pedido, condiciones, etc."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
              />
            </div>

            <div className="cart-items-list">
              {carrito.length === 0 ? (
                <div className="empty-cart-state">
                  <ShoppingCart size={40} strokeWidth={1.5} />
                  <p>El pedido está vacío.<br />Selecciona productos a la izquierda.</p>
                </div>
              ) : (
                carrito.map((item) => (
                  <div key={item.clave} className="cart-item">
                    <img
                      src={item.imagenes && item.imagenes.length > 0
                        ? (item.imagenes[0].startsWith('http') ? item.imagenes[0] : `${API_URL}/uploads/${item.imagenes[0]}`)
                        : '/images/default-product.png'}
                      className="cart-item-image"
                      alt={item.nombre}
                    />
                    <div className="cart-item-details">
                      <span className="cart-item-name">
                        {item.nombre}
                        {item.talla && <span className="cart-item-talla">Talla {item.talla}</span>}
                      </span>
                      <span className="cart-item-price">{formatoMoneda(Number(item.precioVenta) * item.cantidad)}</span>
                    </div>
                    <div className="cart-item-actions">
                      <Trash2
                        size={16}
                        className="remove-item"
                        onClick={() => eliminarDelCarrito(item.clave)}
                      />
                      <div className="quantity-controls">
                        <button
                          className="qty-btn"
                          onClick={() => actualizarCantidad(item.clave, -1)}
                          disabled={item.cantidad - pasoDe(item) < minimoDe(item)}
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          className="qty-input"
                          type="number"
                          min={minimoDe(item)}
                          step={stepCantidad(item.unidadMedida)}
                          value={item.cantidad}
                          onChange={(e) => setCantidadDirecta(item.clave, e.target.value)}
                        />
                        <button
                          className="qty-btn"
                          onClick={() => actualizarCantidad(item.clave, 1)}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="cart-footer">
              <div className="cart-total-row">
                <span className="total-label">Total del pedido</span>
                <span className="total-amount">{formatoMoneda(totalCarrito)}</span>
              </div>
              <button
                className={`checkout-button ${procesando ? 'loading' : ''}`}
                disabled={carrito.length === 0 || !clienteId || procesando}
                onClick={finalizarPedido}
              >
                {procesando ? (
                  <>
                    <div className="loader-spinner"></div>
                    <span>Creando pedido...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} />
                    <span>Crear Pedido</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {productoParaTalla && (
        <SelectorTalla
          producto={productoParaTalla}
          modo="pedido"
          onSelect={elegirTalla}
          onClose={cerrarSelectorTalla}
        />
      )}
    </div>
  );
}

export default NuevoPedido;
