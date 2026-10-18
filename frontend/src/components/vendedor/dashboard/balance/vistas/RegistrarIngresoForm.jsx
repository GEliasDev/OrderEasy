import { useEffect, useState, useMemo } from "react";
import { X, Search, ShoppingCart, Trash2, Plus, Minus, AlertCircle, CheckCircle2, ArrowLeft, FileText } from 'lucide-react';
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getCategoriesByUser } from "../../../../../services/categoryServices";
import { getAllProducts } from "../../../../../services/productServices";
import { createVentaBatch } from "../../../../../services/ventaService";
import { getClientes } from "../../../../../services/clienteService";
import "./styles/CartStyles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const RegistrarIngresoForm = () => {
  const navigate = useNavigate();
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [carrito, setCarrito] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setCargando(true);
        const [categoriasData, productosData, clientesData] = await Promise.all([
          getCategoriesByUser(),
          getAllProducts(),
          getClientes()
        ]);
        if (Array.isArray(categoriasData)) setCategorias(categoriasData);
        if (Array.isArray(productosData)) setProductos(productosData);
        if (Array.isArray(clientesData)) setClientes(clientesData);
      } catch {
        toast.error("No se pudieron cargar los productos.");
      } finally {
        setCargando(false);
      }
    };
    cargarDatos();
  }, []);

  const productosFiltrados = useMemo(() => {
    return productos.filter(p => {
      const coincideBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
      const coincideCategoria = categoriaSeleccionada ? String(p.categoriaid) === String(categoriaSeleccionada) : true;
      return coincideBusqueda && coincideCategoria;
    });
  }, [productos, busqueda, categoriaSeleccionada]);

  const agregarAlCarrito = (producto) => {
    if (producto.cantidadDisponible <= 0) return;

    setCarrito(prev => {
      const itemExistente = prev.find(item => item.productoid === producto.productoid);
      if (itemExistente) {
        if (itemExistente.cantidad < producto.cantidadDisponible) {
          return prev.map(item =>
            item.productoid === producto.productoid
              ? { ...item, cantidad: item.cantidad + 1 }
              : item
          );
        }
        return prev;
      }
      return [...prev, { ...producto, cantidad: 1 }];
    });
  };

  const actualizarCantidad = (id, delta) => {
    setCarrito(prev => prev.map(item => {
      if (item.productoid === id) {
        const nuevaCantidad = item.cantidad + delta;
        if (nuevaCantidad > 0 && nuevaCantidad <= item.cantidadDisponible) {
          return { ...item, cantidad: nuevaCantidad };
        }
      }
      return item;
    }));
  };

  const setCantidadDirecta = (id, valor) => {
    const num = parseInt(valor, 10);
    if (isNaN(num)) return;
    setCarrito(prev => prev.map(item => {
      if (item.productoid === id) {
        const clamped = Math.min(Math.max(1, num), item.cantidadDisponible);
        return { ...item, cantidad: clamped };
      }
      return item;
    }));
  };

  const eliminarDelCarrito = (id) => {
    setCarrito(prev => prev.filter(item => item.productoid !== id));
  };

  const totalCarrito = carrito.reduce((sum, item) => sum + (item.precioVenta * item.cantidad), 0);

  const finalizarVenta = async () => {
    if (carrito.length === 0) return;
    try {
      setProcesando(true);
      const items = carrito.map(item => ({
        productoNombre: item.nombre,
        cantidad: item.cantidad,
      }));
      await createVentaBatch(items, clienteId || null, descripcion);
      toast.success(`¡Venta completada! ${carrito.reduce((s, i) => s + i.cantidad, 0)} unidades registradas.`);
      navigate("/dashboard/balance");
    } catch (error) {
      toast.error(error?.mensaje || "Ocurrió un problema al registrar la venta.");
    } finally {
      setProcesando(false);
    }
  };

  const formatoMoneda = (valor) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);

  return (
    <div className="cart-page-container">
      <div className="cart-modal-container full-page">
        <div className="cart-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="back-button" onClick={() => navigate("/dashboard/balance")}>
              <ArrowLeft size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ShoppingCart size={24} style={{ color: 'var(--color-primary)' }} />
              <h2>Nueva Venta</h2>
            </div>
          </div>
        </div>

        <div className="cart-main-content">
          {/* LEFT: Product selection */}
          <div className="product-selection-panel">
            <div className="search-filter-bar">
              <div className="search-input-wrapper">
                <Search className="search-icon" size={18} />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                />
              </div>
              <select
                className="category-select"
                value={categoriaSeleccionada}
                onChange={e => setCategoriaSeleccionada(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {categorias.map(cat => (
                  <option key={cat.categoriaid} value={cat.categoriaid}>{cat.nombre}</option>
                ))}
              </select>
            </div>

            {cargando ? (
              <div className="empty-cart-state">
                <div className="loader-spinner" style={{ borderTopColor: 'var(--color-primary)' }}></div>
                <p>Cargando productos...</p>
              </div>
            ) : productosFiltrados.length > 0 ? (
              <div className="productos-container-cart">
                {productosFiltrados.map(p => {
                  const agotado = p.cantidadDisponible <= 0;
                  return (
                    <div
                      key={p.productoid}
                      className={`producto-card ${agotado ? 'producto-card-agotado' : ''}`}
                      onClick={() => !agotado && agregarAlCarrito(p)}
                    >
                      <div className="producto-imagen-container">
                        <img
                          src={p.imagenes && p.imagenes.length > 0
                            ? (p.imagenes[0].startsWith("http") ? p.imagenes[0] : `${API_URL}/uploads/${p.imagenes[0]}`)
                            : "/images/default-product.png"}
                          alt={p.nombre}
                          className="producto-imagen"
                          onError={(e) => e.target.src = "/images/default-product.png"}
                        />
                        {agotado ? (
                          <div className="stock-badge-cart stock-out-cart">Agotado</div>
                        ) : (
                          <div className={`stock-badge-cart ${p.cantidadDisponible < 5 ? 'stock-low-cart' : ''}`}>
                            Stock: {p.cantidadDisponible}
                          </div>
                        )}
                      </div>
                      <div className="product-info">
                        <h3 className="producto-nombre">{p.nombre}</h3>
                        {p.categoriaNombre && <span className="product-category">{p.categoriaNombre}</span>}
                        <span className="producto-precio-cart">{formatoMoneda(p.precioVenta)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-cart-state">
                <AlertCircle size={48} />
                <p>No se encontraron productos</p>
              </div>
            )}
          </div>

          {/* RIGHT: Cart summary */}
          <div className="cart-summary-panel">
            <div className="cart-title">
              <ShoppingCart size={20} />
              Carrito de Venta
            </div>

            <div className="client-selection-cart">
              <label>Cliente (Opcional)</label>
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="cart-select-input"
              >
                <option value="">Consumidor Final / General</option>
                {clientes.map(c => (
                  <option key={c.clienteid} value={c.clienteid}>{c.nombreCliente}</option>
                ))}
              </select>
            </div>

            <div className="cart-notes-section">
              <label><FileText size={11} /> Notas (Opcional)</label>
              <textarea
                className="cart-notes-input"
                placeholder="Descripción o referencia de la venta..."
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                rows={2}
              />
            </div>

            <div className="cart-items-list">
              {carrito.length === 0 ? (
                <div className="empty-cart-state">
                  <ShoppingCart size={40} strokeWidth={1.5} />
                  <p>El carrito está vacío.<br />Selecciona productos a la izquierda.</p>
                </div>
              ) : (
                carrito.map(item => (
                  <div key={item.productoid} className="cart-item">
                    <img
                      src={item.imagenes && item.imagenes.length > 0
                        ? (item.imagenes[0].startsWith("http") ? item.imagenes[0] : `${API_URL}/uploads/${item.imagenes[0]}`)
                        : "/images/default-product.png"}
                      className="cart-item-image"
                      alt={item.nombre}
                    />
                    <div className="cart-item-details">
                      <span className="cart-item-name">{item.nombre}</span>
                      <span className="cart-item-price">{formatoMoneda(item.precioVenta * item.cantidad)}</span>
                    </div>
                    <div className="cart-item-actions">
                      <Trash2
                        size={16}
                        className="remove-item"
                        onClick={() => eliminarDelCarrito(item.productoid)}
                      />
                      <div className="quantity-controls">
                        <button
                          className="qty-btn"
                          onClick={() => actualizarCantidad(item.productoid, -1)}
                          disabled={item.cantidad <= 1}
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          className="qty-input"
                          type="number"
                          min={1}
                          max={item.cantidadDisponible}
                          value={item.cantidad}
                          onChange={e => setCantidadDirecta(item.productoid, e.target.value)}
                        />
                        <button
                          className="qty-btn"
                          onClick={() => actualizarCantidad(item.productoid, 1)}
                          disabled={item.cantidad >= item.cantidadDisponible}
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
                <span className="total-label">Total a pagar</span>
                <span className="total-amount">{formatoMoneda(totalCarrito)}</span>
              </div>
              <button
                className={`checkout-button ${procesando ? 'loading' : ''}`}
                disabled={carrito.length === 0 || procesando}
                onClick={finalizarVenta}
              >
                {procesando ? (
                  <>
                    <div className="loader-spinner"></div>
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} />
                    <span>Registrar Venta</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrarIngresoForm;
