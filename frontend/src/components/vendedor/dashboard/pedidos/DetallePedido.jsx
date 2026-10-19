import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Check, ClipboardList, Edit2, FileText, Hash, Minus, Package, Plus, Search, ShoppingBag, Trash2, Truck, User, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  anularOrdenCompra,
  anularPedido,
  confirmarPedido,
  convertirPedidoAVenta,
  generarOrdenCompra,
  getPedidoById,
  recibirOrdenCompra,
  updatePedido,
} from '../../../../services/pedidoService';
import { getClientes } from '../../../../services/clienteService';
import { getProveedores } from '../../../../services/proveedorService';
import { getAllProducts } from '../../../../services/productServices';
import { pasoDe, minimoDe } from '../../../../hooks/useCarrito';
import { stepCantidad, formatearCantidad, admiteDecimales } from '../../../../utils/unidades';
import SelectorTalla from '../balance/vistas/SelectorTalla';
import '../balance/vistas/styles/DetalleTransaccion.css';
import './Pedidos.css';

// Una línea del pedido es "producto + talla"
const claveEdicion = (productoid, talla) => `${productoid}:${talla ?? ''}`;

// Stock físico de una línea: el de su talla si el producto maneja tallas, o el total del producto
const stockFisicoDe = (detalle) => {
  const producto = detalle.producto;
  if (!producto) return 0;
  if (detalle.varianteid || detalle.talla) {
    const variante = (producto.variantes || []).find(
      (v) => (detalle.varianteid && v.varianteid === detalle.varianteid) || v.talla === detalle.talla
    );
    if (variante) return Number(variante.cantidadDisponible || 0);
  }
  return Number(producto.cantidadDisponible || 0);
};

const ESTADOS = {
  pendiente: { label: 'Pendiente', clase: 'pendiente' },
  confirmado: { label: 'Confirmado', clase: 'confirmado' },
  en_compra: { label: 'En compra', clase: 'en-compra' },
  recibido: { label: 'Recibido', clase: 'recibido' },
  entregado: { label: 'Entregado', clase: 'entregado' },
  anulado: { label: 'Anulado', clase: 'anulado' },
};

const ESTADOS_ORDEN = {
  borrador: { label: 'Borrador', clase: 'pendiente' },
  enviada: { label: 'Enviada', clase: 'en-compra' },
  recibida_parcial: { label: 'Recibida parcial', clase: 'confirmado' },
  recibida: { label: 'Recibida', clase: 'recibido' },
  anulada: { label: 'Anulada', clase: 'anulado' },
};

const formatoMoneda = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(valor) || 0);

const formatearFecha = (fecha, conHora = false) => {
  if (!fecha) return 'Sin fecha';
  return new Date(`${fecha}`.length === 10 ? `${fecha}T12:00:00` : fecha)
    .toLocaleDateString('es-CO', conHora
      ? { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: 'long', year: 'numeric' });
};

function DetallePedido() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [proveedores, setProveedores] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [editForm, setEditForm] = useState({ clienteid: '', fechaEntrega: '', descripcion: '' });
  const [editItems, setEditItems] = useState([]);
  const [productoParaTalla, setProductoParaTalla] = useState(null);
  const [productos, setProductos] = useState([]);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [cargandoProductos, setCargandoProductos] = useState(false);
  const [ocForm, setOcForm] = useState({ proveedorid: '', descripcion: '' });

  const cargarPedido = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setLoading(true);
      const data = await getPedidoById(id);
      setPedido(data);
    } catch {
      toast.error('No se pudo cargar el pedido.');
      navigate('/dashboard/pedidos');
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    cargarPedido();
  }, [cargarPedido]);

  useEffect(() => {
    Promise.all([getClientes(), getProveedores()])
      .then(([clientesData, proveedoresData]) => {
        if (Array.isArray(clientesData)) setClientes(clientesData);
        if (Array.isArray(proveedoresData)) setProveedores(proveedoresData);
      })
      .catch(() => {});
  }, []);

  const productosFiltrados = useMemo(() => {
    const termino = busquedaProducto.trim().toLowerCase();
    if (!termino) return [];
    return productos
      .filter((producto) => producto.nombre.toLowerCase().includes(termino))
      .slice(0, 8);
  }, [productos, busquedaProducto]);

  const cargarProductos = async () => {
    try {
      setCargandoProductos(true);
      const data = await getAllProducts();
      if (Array.isArray(data)) setProductos(data);
    } catch {
      toast.error('No se pudieron cargar los productos.');
    } finally {
      setCargandoProductos(false);
    }
  };

  const abrirEditar = () => {
    setEditForm({
      clienteid: pedido.clienteid || '',
      fechaEntrega: pedido.fechaEntrega || '',
      descripcion: pedido.descripcion || '',
    });
    setEditItems(
      (pedido.detalles || [])
        .filter((detalle) => detalle.productoid)
        .map((detalle) => ({
          clave: claveEdicion(detalle.productoid, detalle.talla),
          productoid: detalle.productoid,
          talla: detalle.talla || null,
          unidadMedida: detalle.producto?.unidadMedida,
          nombre: detalle.productoNombre,
          cantidad: Number(detalle.cantidad),
          precioUnitario: Number(detalle.precioUnitario),
        }))
    );
    setBusquedaProducto('');
    setModal('editar');
    if (pedido.estado === 'pendiente' && productos.length === 0) {
      cargarProductos();
    }
  };

  const agregarProductoEdicion = (producto, variante = null) => {
    const talla = variante ? variante.talla : null;
    const clave = claveEdicion(producto.productoid, talla);
    setEditItems((prev) => {
      const existente = prev.find((item) => item.clave === clave);
      if (existente) {
        return prev.map((item) => (
          item.clave === clave
            ? { ...item, cantidad: Math.round((item.cantidad + pasoDe(item)) * 1000) / 1000 }
            : item
        ));
      }

      const original = (pedido.detalles || []).find(
        (detalle) => Number(detalle.productoid) === Number(producto.productoid)
      );
      return [...prev, {
        clave,
        productoid: producto.productoid,
        talla,
        unidadMedida: producto.unidadMedida,
        nombre: producto.nombre,
        cantidad: 1,
        precioUnitario: original ? Number(original.precioUnitario) : Number(producto.precioVenta),
      }];
    });
    setBusquedaProducto('');
  };

  // Click en un resultado de búsqueda: con tallas abre el selector de talla
  const elegirProductoEdicion = (producto) => {
    if (producto.usaTallas) setProductoParaTalla(producto);
    else agregarProductoEdicion(producto);
  };

  const elegirTallaEdicion = (variante) => {
    if (productoParaTalla) agregarProductoEdicion(productoParaTalla, variante);
    setProductoParaTalla(null);
  };

  const actualizarCantidadEdicion = (clave, direccion) => {
    setEditItems((prev) => prev.map((item) => {
      if (item.clave !== clave) return item;
      const nueva = Math.round((item.cantidad + direccion * pasoDe(item)) * 1000) / 1000;
      return nueva >= minimoDe(item) ? { ...item, cantidad: nueva } : item;
    }));
  };

  const setCantidadEdicion = (clave, valor) => {
    setEditItems((prev) => prev.map((item) => {
      if (item.clave !== clave) return item;
      const numero = admiteDecimales(item.unidadMedida) ? parseFloat(valor) : parseInt(valor, 10);
      if (Number.isNaN(numero)) return item;
      return { ...item, cantidad: Math.max(minimoDe(item), Math.round(numero * 1000) / 1000) };
    }));
  };

  const eliminarProductoEdicion = (clave) => {
    setEditItems((prev) => prev.filter((item) => item.clave !== clave));
  };

  const totalEdicion = editItems.reduce(
    (sum, item) => sum + Number(item.precioUnitario) * item.cantidad,
    0
  );

  const abrirOrdenCompra = () => {
    setOcForm({ proveedorid: '', descripcion: `Compra para pedido #${pedido.pedidoid}` });
    setModal('orden');
  };

  const handleConfirmar = async () => {
    try {
      await confirmarPedido(pedido.pedidoid);
      toast.success('Pedido confirmado y stock reservado.');
      cargarPedido(true);
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo confirmar el pedido.');
    }
  };

  const handleAnular = () => {
    toast('¿Anular este pedido?', {
      description: 'Se liberará el stock reservado y se anularán las órdenes de compra pendientes.',
      action: {
        label: 'Sí, anular',
        onClick: async () => {
          try {
            await anularPedido(pedido.pedidoid);
            toast.success('Pedido anulado.');
            cargarPedido(true);
          } catch (error) {
            toast.error(error?.response?.data?.mensaje || 'No se pudo anular el pedido.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  const handleConvertir = () => {
    toast('¿Convertir en venta?', {
      description: 'Se descontará el stock físico y se registrará la venta.',
      action: {
        label: 'Sí, convertir',
        onClick: async () => {
          try {
            const data = await convertirPedidoAVenta(pedido.pedidoid);
            toast.success('Pedido entregado y convertido en venta.');
            navigate(`/dashboard/venta/${data.ventaid}`);
          } catch (error) {
            toast.error(error?.response?.data?.mensaje || 'No se pudo convertir el pedido.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    if (pedido.estado === 'pendiente' && editItems.length === 0) {
      toast.error('El pedido debe tener al menos un producto.');
      return;
    }

    try {
      setGuardando(true);
      const payload = {
        clienteid: editForm.clienteid || null,
        fechaEntrega: editForm.fechaEntrega || null,
        descripcion: editForm.descripcion,
      };
      if (pedido.estado === 'pendiente') {
        payload.items = editItems.map((item) => ({
          productoid: item.productoid,
          talla: item.talla,
          cantidad: item.cantidad,
        }));
      }
      await updatePedido(pedido.pedidoid, payload);
      setModal(null);
      toast.success('Pedido actualizado.');
      cargarPedido(true);
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo actualizar el pedido.');
    } finally {
      setGuardando(false);
    }
  };

  const handleGenerarOrden = async (e) => {
    e.preventDefault();
    try {
      setGuardando(true);
      const orden = await generarOrdenCompra(pedido.pedidoid, {
        proveedorid: ocForm.proveedorid || null,
        descripcion: ocForm.descripcion,
      });
      setModal(null);
      toast.success(`Orden de compra #${orden.ordenid} generada por los faltantes.`);
      cargarPedido(true);
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo generar la orden de compra.');
    } finally {
      setGuardando(false);
    }
  };

  const handleRecibirOrden = (orden) => {
    toast('¿Registrar recepción completa?', {
      description: 'Se sumará el stock físico de todos los productos pendientes de esta orden.',
      action: {
        label: 'Sí, recibir',
        onClick: async () => {
          try {
            await recibirOrdenCompra(orden.ordenid);
            toast.success('Recepción registrada y stock actualizado.');
            cargarPedido(true);
          } catch (error) {
            toast.error(error?.response?.data?.mensaje || 'No se pudo registrar la recepción.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  const handleAnularOrden = (orden) => {
    toast(`¿Anular la orden #${orden.ordenid}?`, {
      description: 'No se modificará el stock ya recibido.',
      action: {
        label: 'Sí, anular',
        onClick: async () => {
          try {
            await anularOrdenCompra(orden.ordenid);
            toast.success('Orden de compra anulada.');
            cargarPedido(true);
          } catch (error) {
            toast.error(error?.response?.data?.mensaje || 'No se pudo anular la orden.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  if (loading) return <div className="view-loading"><div className="loader-spinner-dark" /></div>;
  if (!pedido) return null;

  const totalItems = (pedido.detalles || []).reduce((sum, detalle) => sum + Number(detalle.cantidad), 0);
  const itemsSinStock = (pedido.detalles || []).filter(
    (detalle) => Number(detalle.cantidad) > stockFisicoDe(detalle)
  );
  const puedeConvertir = ['confirmado', 'en_compra', 'recibido'].includes(pedido.estado) && itemsSinStock.length === 0;
  const puedeEditar = !['entregado', 'anulado'].includes(pedido.estado);
  const puedeGenerarCompra = ['confirmado', 'en_compra'].includes(pedido.estado);
  const estadoConfig = ESTADOS[pedido.estado] || { label: pedido.estado, clase: 'anulado' };

  return (
    <div className="detalle-tx-view">
      <div className="detalle-tx-header">
        <button className="btn-circle-back" onClick={() => navigate('/dashboard/pedidos')}>
          <ArrowLeft size={18} />
        </button>
        <div className="detalle-tx-header-text">
          <div className="pedido-titulo-linea">
            <h1>Pedido #{pedido.pedidoid}</h1>
            <span className={`pedido-estado pedido-estado-${estadoConfig.clase}`}>{estadoConfig.label}</span>
          </div>
          <div className="detalle-tx-breadcrumb">
            Pedidos / <span className="active">Pedido #{pedido.pedidoid}</span>
          </div>
        </div>
        <div className="pedido-detalle-acciones">
          {pedido.estado === 'pendiente' && (
            <button className="pedidos-btn pedidos-btn-primary" onClick={handleConfirmar}>
              <Check size={14} />
              <span>Confirmar</span>
            </button>
          )}
          {puedeGenerarCompra && (
            <button className="pedidos-btn pedidos-btn-secundario" onClick={abrirOrdenCompra}>
              <Truck size={14} />
              <span>Generar compra</span>
            </button>
          )}
          {puedeConvertir && (
            <button className="pedidos-btn pedidos-btn-verde" onClick={handleConvertir}>
              <ShoppingBag size={14} />
              <span>Convertir en venta</span>
            </button>
          )}
          {puedeEditar && (
            <button className="pedidos-btn pedidos-btn-secundario" onClick={abrirEditar}>
              <Edit2 size={14} />
              <span>Editar</span>
            </button>
          )}
          {puedeEditar && (
            <button className="pedidos-btn pedidos-btn-peligro" onClick={handleAnular}>
              <XCircle size={14} />
              <span>Anular</span>
            </button>
          )}
        </div>
      </div>

      {itemsSinStock.length > 0 && ['confirmado', 'en_compra', 'recibido'].includes(pedido.estado) && (
        <div className="pedido-alerta-stock">
          <Truck size={16} />
          <span>
            Faltan {itemsSinStock.length} producto(s) por recibir. Genera o recibe la compra antes de convertir el pedido en venta.
          </span>
        </div>
      )}

      <div className="detalle-tx-summary">
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><ClipboardList size={11} /> Total del pedido</div>
          <div className="detalle-tx-stat-value amount income">{formatoMoneda(pedido.total)}</div>
        </div>
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><User size={11} /> Cliente</div>
          <div className={`detalle-tx-stat-value ${!pedido.cliente ? 'muted' : ''}`}>
            {pedido.cliente?.nombreCliente || 'Consumidor Final'}
          </div>
        </div>
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><Calendar size={11} /> Fecha del pedido</div>
          <div className="detalle-tx-stat-value">{formatearFecha(pedido.createdAt)}</div>
        </div>
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><Hash size={11} /> Items</div>
          <div className="detalle-tx-stat-value">
            {totalItems} <small style={{ fontWeight: 500, fontSize: '0.72rem', color: 'var(--neutral-500)' }}>unds.</small>
          </div>
        </div>
      </div>

      <div className="pedido-datos-extra">
        <div className="pedido-dato">
          <span>Entrega</span>
          <strong>{pedido.fechaEntrega ? formatearFecha(pedido.fechaEntrega) : 'Sin fecha definida'}</strong>
        </div>
        {pedido.ventaid && (
          <div className="pedido-dato">
            <span>Venta generada</span>
            <button className="pedido-link-venta" onClick={() => navigate(`/dashboard/venta/${pedido.ventaid}`)}>
              Ver venta #{pedido.ventaid}
            </button>
          </div>
        )}
      </div>

      <div className="detalle-tx-description">
        <div className="detalle-tx-description-label"><FileText size={11} /> Notas</div>
        <div className={`detalle-tx-description-text ${!pedido.descripcion ? 'muted' : ''}`}>
          {pedido.descripcion || 'Sin notas registradas.'}
        </div>
      </div>

      <div className="detalle-items-section">
        <div className="detalle-items-header">
          <Package size={15} /> Productos del pedido
        </div>
        <div className="items-table-container">
          <table className="items-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cant.</th>
                <th>Stock físico</th>
                <th>Precio Unit.</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(pedido.detalles || []).map((item) => {
                const stockFisico = stockFisicoDe(item);
                const faltante = Math.max(0, Number(item.cantidad) - stockFisico);
                return (
                  <tr key={item.detalleid}>
                    <td className="item-name">
                      <div className="item-icon"><Package size={13} /></div>
                      {item.productoNombre}
                      {item.talla && <span className="cart-item-talla">Talla {item.talla}</span>}
                    </td>
                    <td className="item-qty">{formatearCantidad(item.cantidad, item.producto?.unidadMedida)}</td>
                    <td>
                      {faltante > 0 ? (
                        <span className="pedido-stock-faltante">Faltan {formatearCantidad(faltante, item.producto?.unidadMedida)}</span>
                      ) : (
                        <span className="pedido-stock-ok">{formatearCantidad(stockFisico, item.producto?.unidadMedida)} disp.</span>
                      )}
                    </td>
                    <td className="item-price">{formatoMoneda(item.precioUnitario)}</td>
                    <td className="item-subtotal">{formatoMoneda(item.subtotal)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="4" className="footer-label">Total</td>
                <td className="footer-value">{formatoMoneda(pedido.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="pedido-ordenes-section">
        <div className="pedido-ordenes-header">
          <div>
            <h2><Truck size={16} /> Órdenes de compra</h2>
            <p>Solo se compra al proveedor lo que falta para cubrir este pedido.</p>
          </div>
          {puedeGenerarCompra && (
            <button className="pedidos-btn pedidos-btn-secundario" onClick={abrirOrdenCompra}>
              <Truck size={14} />
              <span>Nueva orden</span>
            </button>
          )}
        </div>

        {(pedido.ordenes || []).length === 0 ? (
          <div className="pedido-ordenes-vacio">
            <Truck size={32} />
            <p>No hay órdenes de compra para este pedido.</p>
          </div>
        ) : (
          <div className="pedido-ordenes-lista">
            {pedido.ordenes.map((orden) => {
              const pendiente = ['borrador', 'enviada', 'recibida_parcial'].includes(orden.estado)
                && orden.detalles?.some((detalle) => Number(detalle.cantidadRecibida) < Number(detalle.cantidad));
              const anulable = !['recibida', 'anulada'].includes(orden.estado);
              const ordenEstadoConfig = ESTADOS_ORDEN[orden.estado] || { label: orden.estado, clase: 'anulado' };
              return (
                <div key={orden.ordenid} className="pedido-orden-card">
                  <div className="pedido-orden-top">
                    <div>
                      <strong>Orden #{orden.ordenid}</strong>
                      <span>{orden.proveedor?.nombreProveedor || orden.proveedor?.razonSocial || 'Sin proveedor'}</span>
                    </div>
                    <div className="pedido-orden-meta">
                      <span className={`pedido-estado pedido-estado-${ordenEstadoConfig.clase}`}>{ordenEstadoConfig.label}</span>
                      <strong>{formatoMoneda(orden.total)}</strong>
                    </div>
                  </div>
                  <div className="pedido-orden-items">
                    {(orden.detalles || []).map((detalle) => (
                      <div key={detalle.detalleid} className="pedido-orden-item">
                        <span>{detalle.productoNombre}{detalle.talla ? ` · Talla ${detalle.talla}` : ''}</span>
                        <span>{detalle.cantidadRecibida}/{detalle.cantidad}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pedido-orden-acciones">
                    <span className="pedido-orden-fecha">Creada el {formatearFecha(orden.createdAt)}</span>
                    <div>
                      {pendiente && (
                        <button className="pedidos-btn pedidos-btn-verde pedidos-btn-sm" onClick={() => handleRecibirOrden(orden)}>
                          <Check size={13} />
                          <span>Recibir</span>
                        </button>
                      )}
                      {anulable && (
                        <button className="pedidos-btn pedidos-btn-peligro pedidos-btn-sm" onClick={() => handleAnularOrden(orden)}>
                          <XCircle size={13} />
                          <span>Anular</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal === 'editar' && (
        <div className="pedido-modal-overlay" onClick={() => setModal(null)}>
          <div className="pedido-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pedido-modal-header">
              <h3>Editar pedido</h3>
              <button className="pedido-modal-close" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <form className="pedido-modal-form" onSubmit={handleGuardarEdicion}>
              <div className="pedido-form-group">
                <label>Cliente</label>
                <select
                  value={editForm.clienteid}
                  onChange={(e) => setEditForm({ ...editForm, clienteid: e.target.value })}
                >
                  <option value="">Consumidor Final / General</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.clienteid} value={cliente.clienteid}>{cliente.nombreCliente}</option>
                  ))}
                </select>
              </div>
              <div className="pedido-form-group">
                <label>Fecha de entrega</label>
                <input
                  type="date"
                  value={editForm.fechaEntrega || ''}
                  onChange={(e) => setEditForm({ ...editForm, fechaEntrega: e.target.value })}
                />
              </div>

              {pedido.estado === 'pendiente' ? (
                <div className="pedido-form-group">
                  <label>Productos del pedido</label>
                  <div className="pedido-edit-items">
                    {editItems.length === 0 ? (
                      <p className="pedido-edit-hint">El pedido no tiene productos. Agrega al menos uno.</p>
                    ) : editItems.map((item) => (
                      <div key={item.clave} className="pedido-edit-item">
                        <div className="pedido-edit-item-info">
                          <span className="pedido-edit-item-name">
                            {item.nombre}
                            {item.talla && <span className="cart-item-talla">Talla {item.talla}</span>}
                          </span>
                          <span className="pedido-edit-item-price">
                            {formatoMoneda(item.precioUnitario)} c/u
                          </span>
                        </div>
                        <div className="pedido-edit-item-actions">
                          <button
                            type="button"
                            className="pedido-edit-qty-btn"
                            onClick={() => actualizarCantidadEdicion(item.clave, -1)}
                            disabled={item.cantidad - pasoDe(item) < minimoDe(item)}
                            aria-label={`Quitar una unidad de ${item.nombre}`}
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            min={minimoDe(item)}
                            step={stepCantidad(item.unidadMedida)}
                            className="pedido-edit-qty-input"
                            value={item.cantidad}
                            onChange={(e) => setCantidadEdicion(item.clave, e.target.value)}
                            aria-label={`Cantidad de ${item.nombre}`}
                          />
                          <button
                            type="button"
                            className="pedido-edit-qty-btn"
                            onClick={() => actualizarCantidadEdicion(item.clave, 1)}
                            aria-label={`Agregar una unidad de ${item.nombre}`}
                          >
                            <Plus size={12} />
                          </button>
                          <button
                            type="button"
                            className="pedido-edit-remove"
                            onClick={() => eliminarProductoEdicion(item.clave)}
                            aria-label={`Eliminar ${item.nombre}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pedido-edit-search">
                    <Search size={14} className="pedido-edit-search-icon" />
                    <input
                      type="text"
                      placeholder="Buscar producto para agregar..."
                      value={busquedaProducto}
                      onChange={(e) => setBusquedaProducto(e.target.value)}
                    />
                  </div>

                  {cargandoProductos ? (
                    <p className="pedido-edit-hint">Cargando productos...</p>
                  ) : busquedaProducto.trim() !== '' && (
                    productosFiltrados.length === 0 ? (
                      <p className="pedido-edit-hint">No se encontraron productos.</p>
                    ) : (
                      <div className="pedido-edit-resultados">
                        {productosFiltrados.map((producto) => (
                          <button
                            type="button"
                            key={producto.productoid}
                            className="pedido-edit-resultado"
                            onClick={() => elegirProductoEdicion(producto)}
                          >
                            <span>{producto.nombre}</span>
                            <span className="pedido-edit-resultado-precio">
                              {formatoMoneda(producto.precioVenta)}
                            </span>
                            <Plus size={13} />
                          </button>
                        ))}
                      </div>
                    )
                  )}

                  <div className="pedido-edit-total">
                    <span>Total actualizado</span>
                    <strong>{formatoMoneda(totalEdicion)}</strong>
                  </div>
                </div>
              ) : (
                <p className="pedido-edit-hint">
                  Los productos solo se pueden modificar mientras el pedido está pendiente.
                </p>
              )}

              <div className="pedido-form-group">
                <label>Notas</label>
                <textarea
                  rows={3}
                  value={editForm.descripcion}
                  onChange={(e) => setEditForm({ ...editForm, descripcion: e.target.value })}
                />
              </div>
              <div className="pedido-modal-footer">
                <button type="button" className="pedidos-btn pedidos-btn-secundario" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="pedidos-btn pedidos-btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'orden' && (
        <div className="pedido-modal-overlay" onClick={() => setModal(null)}>
          <div className="pedido-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pedido-modal-header">
              <h3>Generar orden de compra</h3>
              <button className="pedido-modal-close" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <form className="pedido-modal-form" onSubmit={handleGenerarOrden}>
              <p className="pedido-modal-texto">
                La orden incluirá automáticamente solo los productos que faltan para cubrir el pedido.
              </p>
              <div className="pedido-form-group">
                <label>Proveedor</label>
                <select
                  value={ocForm.proveedorid}
                  onChange={(e) => setOcForm({ ...ocForm, proveedorid: e.target.value })}
                >
                  <option value="">Sin proveedor asignado</option>
                  {proveedores.map((proveedor) => (
                    <option key={proveedor.proveedorid} value={proveedor.proveedorid}>
                      {proveedor.nombreProveedor || proveedor.razonSocial}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pedido-form-group">
                <label>Descripción</label>
                <input
                  value={ocForm.descripcion}
                  onChange={(e) => setOcForm({ ...ocForm, descripcion: e.target.value })}
                />
              </div>
              <div className="pedido-modal-footer">
                <button type="button" className="pedidos-btn pedidos-btn-secundario" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="pedidos-btn pedidos-btn-primary" disabled={guardando}>
                  {guardando ? 'Generando...' : 'Generar orden'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {productoParaTalla && (
        <SelectorTalla
          producto={productoParaTalla}
          modo="pedido"
          onSelect={elegirTallaEdicion}
          onClose={() => setProductoParaTalla(null)}
        />
      )}
    </div>
  );
}

export default DetallePedido;
