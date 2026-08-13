import { useEffect, useState, useMemo } from "react";
import { Search, ShoppingCart, Trash2, Plus, Minus, AlertCircle, CheckCircle2, ArrowLeft, FileText, TrendingDown } from 'lucide-react';
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getCategoriesByUser } from "../../../../../services/categoryServices";
import { getAllProducts } from "../../../../../services/productServices";
import { createEgresoBatch } from "../../../../../services/egresoService";
import { getProveedores } from "../../../../../services/proveedorService";
import "./styles/CartStyles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const RegistrarEgresoForm = () => {
  const navigate = useNavigate();
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [proveedorId, setProveedorId] = useState("");
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
        const [categoriasData, productosData, proveedoresData] = await Promise.all([
          getCategoriesByUser(),
          getAllProducts(),
          getProveedores()
        ]);
        if (Array.isArray(categoriasData)) setCategorias(categoriasData);
        if (Array.isArray(productosData)) setProductos(productosData);
        if (Array.isArray(proveedoresData)) setProveedores(proveedoresData);
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
    setCarrito(prev => {
      const itemExistente = prev.find(item => item.productoid === producto.productoid);
      if (itemExistente) {
        return prev.map(item =>
          item.productoid === producto.productoid
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      return [...prev, { ...producto, cantidad: 1 }];
    });
  };

  const actualizarCantidad = (id, delta) => {
    setCarrito(prev => prev.map(item => {
      if (item.productoid === id) {
        const nuevaCantidad = item.cantidad + delta;
        if (nuevaCantidad > 0) return { ...item, cantidad: nuevaCantidad };
      }
      return item;
    }));
  };

  const setCantidadDirecta = (id, valor) => {
    const num = parseInt(valor, 10);
    if (isNaN(num)) return;
    setCarrito(prev => prev.map(item => {
      if (item.productoid === id) {
        return { ...item, cantidad: Math.max(1, num) };
      }
      return item;
    }));
  };

  const eliminarDelCarrito = (id) => {
    setCarrito(prev => prev.filter(item => item.productoid !== id));
  };

  const totalCarrito = carrito.reduce((sum, item) => sum + (Number(item.precioCompra) * item.cantidad), 0);

  const finalizarEgreso = async () => {
    if (carrito.length === 0) return;
    try {
      setProcesando(true);
      const items = carrito.map(item => ({
        productoNombre: item.nombre,
        cantidad: item.cantidad,
      }));
      await createEgresoBatch(items, proveedorId || null, descripcion);
      toast.success(`¡Egreso registrado! ${carrito.reduce((s, i) => s + i.cantidad, 0)} unidades registradas.`);
      navigate("/dashboard/balance");
    } catch (error) {
      toast.error(error?.mensaje || "Ocurrió un problema al registrar el egreso.");
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
              <TrendingDown size={24} style={{ color: 'var(--color-danger)' }} />
              <h2>Nuevo Egreso (Compra)</h2>
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
                <div className="loader-spinner" style={{ borderTopColor: 'var(--color-danger)' }}></div>
                <p>Cargando productos...</p>
              </div>
            ) : productosFiltrados.length > 0 ? (
              <div className="productos-container-cart">
                {productosFiltrados.map(p => (
                  <div key={p.productoid} className="producto-card" onClick={() => agregarAlCarrito(p)}>
                    <div className="producto-imagen-container">
                      <img
                        src={p.imagenes && p.imagenes.length > 0
                          ? (p.imagenes[0].startsWith("http") ? p.imagenes[0] : `${API_URL}/uploads/${p.imagenes[0]}`)
                          : "/images/default-product.png"}
                        alt={p.nombre}
                        className="producto-imagen"
                        onError={(e) => e.target.src = "/images/default-product.png"}
                      />
                      <div className="stock-badge-cart">
                        Stock: {p.cantidadDisponible}
                      </div>
                    </div>
                    <div className="product-info">
                      <h3 className="producto-nombre">{p.nombre}</h3>
                      {p.categoriaNombre && <span className="product-category">{p.categoriaNombre}</span>}
                      <span className="producto-precio-cart egreso-precio">{formatoMoneda(p.precioCompra)}</span>
                    </div>
                  </div>
                ))}
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
              <TrendingDown size={20} style={{ color: 'var(--color-danger)' }} />
              Lista de Compra
            </div>

            <div className="client-selection-cart">
              <label>Proveedor (Opcional)</label>
              <select
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                className="cart-select-input"
              >
                <option value="">Proveedor Genérico / Otros</option>
                {proveedores.map(p => (
                  <option key={p.proveedorid} value={p.proveedorid}>{p.nombreProveedor}</option>
                ))}
              </select>
            </div>

            <div className="cart-notes-section">
              <label><FileText size={11} /> Notas (Opcional)</label>
              <textarea
                className="cart-notes-input"
                placeholder="Descripción o referencia del egreso..."
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                rows={2}
              />
            </div>

            <div className="cart-items-list">
              {carrito.length === 0 ? (
                <div className="empty-cart-state">
                  <ShoppingCart size={40} strokeWidth={1.5} />
                  <p>La lista está vacía.<br />Selecciona productos a la izquierda.</p>
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
                      <span className="cart-item-price egreso-precio">{formatoMoneda(Number(item.precioCompra) * item.cantidad)}</span>
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
                          value={item.cantidad}
                          onChange={e => setCantidadDirecta(item.productoid, e.target.value)}
                        />
                        <button
                          className="qty-btn"
                          onClick={() => actualizarCantidad(item.productoid, 1)}
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
                <span className="total-label">Inversión Total</span>
                <span className="total-amount egreso-precio">{formatoMoneda(totalCarrito)}</span>
              </div>
              <button
                className={`checkout-button egreso-btn ${procesando ? 'loading' : ''}`}
                disabled={carrito.length === 0 || procesando}
                onClick={finalizarEgreso}
              >
                {procesando ? (
                  <>
                    <div className="loader-spinner"></div>
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} />
                    <span>Registrar Egreso</span>
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

export default RegistrarEgresoForm;
