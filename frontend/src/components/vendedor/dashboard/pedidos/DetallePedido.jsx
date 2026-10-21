import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Check, ClipboardList, Edit2, FileText, Hash, Minus, MessageCircle, MoreHorizontal, Package, Plus, Receipt, RotateCcw, Search, ShoppingBag, Trash2, Truck, User, Wallet, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  anularOrdenCompra,
  deletePedido,
  anularPedido,
  confirmarPedido,
  entregarPedido,
  getSaldoFavor,
  registrarPagoPedido,
  usarSaldoFavor,
  generarOrdenCompra,
  getPedidoById,
  updatePedido,
} from '../../../../services/pedidoService';
import { getClientes } from '../../../../services/clienteService';
import { getProveedores } from '../../../../services/proveedorService';
import { getAllProducts } from '../../../../services/productServices';
import { pasoDe, minimoDe } from '../../../../hooks/useCarrito';
import { stepCantidad, formatearCantidad, admiteDecimales } from '../../../../utils/unidades';
import SelectorTalla from '../balance/vistas/SelectorTalla';
import ReciboModal from './ReciboModal';
import { getNegocio } from '../../../../services/negocioService';
import { abrirWhatsApp, mensajeListoParaEntregar, mensajeRecordatorioSaldo } from '../../../../utils/whatsapp';
import '../balance/vistas/styles/DetalleTransaccion.css';
import { useEsMovil } from '../../../../hooks/useEsMovil';
import PanelInferior from '../../../comunes/PanelInferior';
import './Pedidos.css';

// Una línea del pedido es "producto + talla"
const claveEdicion = (productoid, talla) => `${productoid}:${talla ?? ''}`;

// Compras dentro de un pedido al proveedor: no se entrega del inventario sino lo que ya llegó para el cliente
const conLlegado = (pedido) => {
  if (!pedido?.ordenid) return pedido;
  return {
    ...pedido,
    detalles: (pedido.detalles || []).map((d) => ({
      ...d,
      llegadoPorEntregar: Math.max(0, Math.round((Number(d.recibidoCompra || 0) - Number(d.cantidadEntregada || 0)) * 1000) / 1000),
    })),
  };
};

// Los productos se pueden cambiar mientras la compra no se haya enviado al proveedor
// y no tenga entregas ni unidades comprometidas en una orden ya enviada.
const puedeEditarProductosDe = (pedido) => {
  if (!pedido || ['entregado', 'anulado'].includes(pedido.estado)) return false;
  if ((pedido.detalles || []).some((detalle) => Number(detalle.cantidadEntregada || 0) > 0)) return false;
  if ((pedido.detalles || []).some(
    (detalle) => Number(detalle.enCompra || 0) > 0 || Number(detalle.recibidoCompra || 0) > 0
  )) return false;

  const ordenesVinculadas = (pedido.ordenes || []).filter((orden) => orden.estado !== 'anulada');
  if (ordenesVinculadas.length > 0) return false;

  if (pedido.pedidoProveedor?.estado === 'abierta') return true;
  if (!pedido.ordenid && ['pendiente', 'confirmado'].includes(pedido.estado)) return true;
  return false;
};

// Stock físico de una línea: el de su talla si el producto maneja tallas, o el total del producto
// (en una compra dentro de un pedido al proveedor, lo que ya llegó y falta entregar)
const stockFisicoDe = (detalle) => {
  if (detalle.llegadoPorEntregar !== undefined) return detalle.llegadoPorEntregar;
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

const METODOS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
];
const metodoLabel = (metodo) => METODOS.find((m) => m.value === metodo)?.label || metodo;

const TIPO_MOVIMIENTO = {
  abono: { label: 'Abono', clase: 'abono', signo: '+' },
  devolucion: { label: 'Devolución', clase: 'devolucion', signo: '-' },
  traslado: { label: 'Saldo trasladado', clase: 'traslado', signo: '-' },
};

// Lo que falta por entregar de una línea
const pendienteDe = (detalle) =>
  Math.round((Number(detalle.cantidad) - Number(detalle.cantidadEntregada || 0)) * 1000) / 1000;

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [saldoFavor, setSaldoFavor] = useState({ total: 0, pedidos: [] });
  const [pagoForm, setPagoForm] = useState({ tipo: 'abono', monto: '', metodo: 'efectivo', nota: '' });
  const [entregaItems, setEntregaItems] = useState({}); // detalleid -> cantidad a entregar (texto)
  const [entregaPago, setEntregaPago] = useState({ monto: '', metodo: 'efectivo' });
  const [anularForm, setAnularForm] = useState({ abonos: 'devolver', metodo: 'efectivo' });
  const [reciboPago, setReciboPago] = useState(null);
  const [negocio, setNegocio] = useState(null);

  // Datos del negocio para los recibos y los mensajes de WhatsApp
  useEffect(() => {
    getNegocio().then(setNegocio).catch(() => setNegocio(null));
  }, []);
  const [productos, setProductos] = useState([]);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [cargandoProductos, setCargandoProductos] = useState(false);
  const [ocForm, setOcForm] = useState({ proveedorid: '', descripcion: '' });

  const cargarPedido = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setLoading(true);
      const data = await getPedidoById(id);
      setPedido(conLlegado(data));
      if (data.clienteid && data.estado !== 'anulado') {
        getSaldoFavor(data.clienteid).then(setSaldoFavor).catch(() => setSaldoFavor({ total: 0, pedidos: [] }));
      } else {
        setSaldoFavor({ total: 0, pedidos: [] });
      }
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
    if (puedeEditarProductosDe(pedido) && productos.length === 0) {
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

  // ───── Pagos ─────
  const abrirPago = (tipo = 'abono') => {
    const resumen = pedido.resumen || {};
    const sugerido = tipo === 'abono' ? resumen.saldo : resumen.disponibleAbonos;
    setPagoForm({ tipo, monto: sugerido > 0 ? String(sugerido) : '', metodo: 'efectivo', nota: '' });
    setModal('pago');
  };

  const handleGuardarPago = async (e) => {
    e.preventDefault();
    try {
      setGuardando(true);
      await registrarPagoPedido(pedido.pedidoid, {
        tipo: pagoForm.tipo,
        monto: Number(pagoForm.monto),
        metodo: pagoForm.metodo,
        nota: pagoForm.nota,
      });
      setModal(null);
      toast.success(pagoForm.tipo === 'abono' ? 'Abono registrado.' : 'Devolución registrada.');
      cargarPedido(true);
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo registrar el movimiento.');
    } finally {
      setGuardando(false);
    }
  };

  const handleUsarSaldo = async () => {
    try {
      const actualizado = await usarSaldoFavor(pedido.pedidoid);
      toast.success('Saldo a favor aplicado como abono.');
      setPedido(conLlegado(actualizado));
      cargarPedido(true);
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo usar el saldo a favor.');
    }
  };

  // ───── Entrega (total o parcial por línea) ─────
  const abrirEntrega = () => {
    const cantidades = {};
    for (const detalle of pedido.detalles || []) {
      const pendiente = pendienteDe(detalle);
      if (pendiente <= 0) continue;
      // Por defecto se entrega lo que hay en stock, hasta lo pendiente
      cantidades[detalle.detalleid] = String(Math.max(0, Math.min(pendiente, stockFisicoDe(detalle))));
    }
    setEntregaItems(cantidades);
    setEntregaPago({ monto: '', metodo: 'efectivo' });
    setModal('entrega');
  };

  const handleEntregar = async (e) => {
    e.preventDefault();
    const items = Object.entries(entregaItems)
      .map(([detalleid, cantidad]) => ({ detalleid: Number(detalleid), cantidad: Number(cantidad) || 0 }))
      .filter((item) => item.cantidad > 0);
    if (items.length === 0) {
      toast.error('Indica la cantidad de al menos una línea a entregar.');
      return;
    }
    try {
      setGuardando(true);
      const data = await entregarPedido(pedido.pedidoid, {
        items,
        pagos: Number(entregaPago.monto) > 0 ? [{ metodo: entregaPago.metodo, monto: Number(entregaPago.monto) }] : [],
      });
      setModal(null);
      toast.success(data.mensaje);
      cargarPedido(true);
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo registrar la entrega.');
    } finally {
      setGuardando(false);
    }
  };

  // ───── Anular (con decisión sobre los abonos) ─────
  const abrirAnular = () => {
    setAnularForm({ abonos: 'devolver', metodo: 'efectivo' });
    setModal('anular');
  };
  const esMovil = useEsMovil();
  const [menuMas, setMenuMas] = useState(false);

  const handleAnular = abrirAnular;

  // Elimina la compra en cualquier estado (a diferencia de anular, no queda registro de ella)
  const handleEliminar = () => {
    toast(`¿Eliminar la compra #${pedido.pedidoid}?`, {
      description: 'Se borran la compra y sus abonos. Las ventas de entregas ya hechas se conservan y el stock reservado se libera. Esta acción no se puede deshacer.',
      action: {
        label: 'Sí, eliminar',
        onClick: async () => {
          try {
            await deletePedido(pedido.pedidoid);
            toast.success('Compra eliminada.');
            navigate(pedido.ordenid ? `/dashboard/pedidos/${pedido.ordenid}` : '/dashboard/pedidos');
          } catch (error) {
            toast.error(error?.response?.data?.mensaje || 'No se pudo eliminar la compra.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  const handleConfirmarAnulacion = async (e) => {
    e.preventDefault();
    try {
      setGuardando(true);
      const data = await anularPedido(pedido.pedidoid, {
        abonos: anularForm.abonos,
        metodoDevolucion: anularForm.metodo,
      });
      setModal(null);
      if (data.devuelto > 0) toast.success(`Pedido anulado. Devuelve ${formatoMoneda(data.devuelto)} al cliente.`);
      else if (data.saldoAFavor > 0) toast.success(`Pedido anulado. ${formatoMoneda(data.saldoAFavor)} quedan como saldo a favor del cliente.`);
      else toast.success('Pedido anulado.');
      cargarPedido(true);
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo anular el pedido.');
    } finally {
      setGuardando(false);
    }
  };

  // ───── WhatsApp ─────
  const avisarListo = () => {
    const listas = (pedido.detalles || [])
      .filter((d) => pendienteDe(d) > 0 && stockFisicoDe(d) > 0)
      .map((d) => ({ productoNombre: d.productoNombre, talla: d.talla, cantidad: Math.min(pendienteDe(d), stockFisicoDe(d)) }));
    const ok = abrirWhatsApp(pedido.cliente?.telefono, mensajeListoParaEntregar({
      negocio: negocio?.nombre,
      cliente: pedido.cliente?.nombreCliente,
      pedidoid: pedido.pedidoid,
      lineas: listas,
      saldo: pedido.resumen?.saldo,
    }));
    if (!ok) toast.error('Este cliente no tiene un teléfono válido para WhatsApp.');
  };

  const recordarSaldo = () => {
    const r = pedido.resumen || {};
    const ok = abrirWhatsApp(pedido.cliente?.telefono, mensajeRecordatorioSaldo({
      negocio: negocio?.nombre,
      cliente: pedido.cliente?.nombreCliente,
      pedidoid: pedido.pedidoid,
      total: r.total,
      abonado: r.abonado,
      saldo: r.saldo,
    }));
    if (!ok) toast.error('Este cliente no tiene un teléfono válido para WhatsApp.');
  };

  // Desde el listado se llega con ?accion=entregar|anular para abrir directamente el modal
  useEffect(() => {
    const accion = searchParams.get('accion');
    if (!accion || !pedido) return;
    setSearchParams({}, { replace: true });
    if (accion === 'entregar' && ['confirmado', 'en_compra', 'recibido'].includes(pedido.estado)) abrirEntrega();
    if (accion === 'anular' && !['entregado', 'anulado'].includes(pedido.estado)) abrirAnular();
    if (accion === 'abono' && pedido.estado !== 'anulado' && Number(pedido.resumen?.saldo) > 0) abrirPago('abono');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, searchParams]);

  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    const editarProductos = puedeEditarProductosDe(pedido);
    if (editarProductos && editItems.length === 0) {
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
      if (editarProductos) {
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

  // La recepción se hace en la pantalla de la compra, donde se elige a qué cliente corresponde lo que llega
  const handleRecibirOrden = (orden) => navigate(`/dashboard/pedidos/${orden.ordenid}?accion=recibir`);

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
  const resumen = pedido.resumen || { total: 0, abonado: 0, entregado: 0, porEntregar: 0, saldo: 0, disponibleAbonos: 0 };
  const itemsSinStock = (pedido.detalles || []).filter(
    (detalle) => pendienteDe(detalle) > stockFisicoDe(detalle)
  );
  // Se puede entregar en cuanto haya al menos una línea con stock (entrega parcial)
  const hayParaEntregar = (pedido.detalles || []).some((d) => pendienteDe(d) > 0 && stockFisicoDe(d) > 0);
  const puedeConvertir = ['confirmado', 'en_compra', 'recibido'].includes(pedido.estado) && hayParaEntregar;
  const puedeAbonar = pedido.estado !== 'anulado' && resumen.saldo > 0;
  const entregaValor = (pedido.detalles || []).reduce(
    (sum, d) => sum + (Number(entregaItems[d.detalleid]) || 0) * Number(d.precioUnitario), 0
  );
  const entregaCubierto = Math.min(entregaValor, resumen.disponibleAbonos);
  const entregaPorCobrar = Math.max(0, Math.round((entregaValor - entregaCubierto) * 100) / 100);
  const puedeEditar = !['entregado', 'anulado'].includes(pedido.estado);
  const editarProductos = puedeEditarProductosDe(pedido);
  const puedeGenerarCompra = ['confirmado', 'en_compra'].includes(pedido.estado) && !pedido.ordenid;
  // Dentro de un pedido al proveedor no hay paso de confirmar: la compra simplemente está en el pedido
  const estadoConfig = pedido.ordenid && pedido.estado === 'confirmado'
    ? { label: 'En el pedido', clase: 'pendiente' }
    : (ESTADOS[pedido.estado] || { label: pedido.estado, clase: 'anulado' });

  return (
    <div className="detalle-tx-view detalle-ancho">
      <div className="detalle-tx-header">
        <button className="btn-circle-back" onClick={() => navigate(pedido.ordenid ? `/dashboard/pedidos/${pedido.ordenid}` : '/dashboard/pedidos')}>
          <ArrowLeft size={18} />
        </button>
        <div className="detalle-tx-header-text">
          <div className="pedido-titulo-linea">
            <h1>Compra #{pedido.pedidoid}</h1>
            <span className={`pedido-estado pedido-estado-${estadoConfig.clase}`}>{estadoConfig.label}</span>
          </div>
          <div className="detalle-tx-breadcrumb">
            {pedido.ordenid ? (
              <>
                <button className="pedido-link-venta" onClick={() => navigate('/dashboard/pedidos')}>Pedidos</button>
                {' / '}
                <button className="pedido-link-venta" onClick={() => navigate(`/dashboard/pedidos/${pedido.ordenid}`)}>Pedido #{pedido.ordenid}</button>
                {' / '}
              </>
            ) : 'Pedidos / '}
            <span className="active">Compra #{pedido.pedidoid}</span>
          </div>
        </div>
        {esMovil ? (
          <div className="pedido-detalle-acciones pedido-acciones-compactas">
            {pedido.estado === 'pendiente' && !pedido.ordenid && (
              <button className="pedidos-btn pedidos-btn-primary" onClick={handleConfirmar}><Check size={14} /><span>Confirmar</span></button>
            )}
            {puedeConvertir && (
              <button className="pedidos-btn pedidos-btn-verde" onClick={abrirEntrega}><ShoppingBag size={14} /><span>Entregar</span></button>
            )}
            {puedeAbonar && (
              <button className="pedidos-btn pedidos-btn-primary" onClick={() => abrirPago('abono')}><Plus size={14} /><span>Abonar</span></button>
            )}
            <button className="pedidos-btn pedidos-btn-secundario pedido-btn-mas" onClick={() => setMenuMas(true)} aria-label="Más acciones">
              <MoreHorizontal size={16} />
            </button>
          </div>
        ) : (
        <div className="pedido-detalle-acciones">
          {pedido.estado === 'pendiente' && !pedido.ordenid && (
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
            <button className="pedidos-btn pedidos-btn-verde" onClick={abrirEntrega}>
              <ShoppingBag size={14} />
              <span>Entregar</span>
            </button>
          )}
          {puedeConvertir && pedido.cliente?.telefono && (
            <button className="pedidos-btn pedidos-btn-secundario" onClick={avisarListo} title="Avisar por WhatsApp que ya puede recogerlo">
              <MessageCircle size={14} />
              <span>Avisar</span>
            </button>
          )}
          {puedeEditar && (
            <button className="pedidos-btn pedidos-btn-secundario" onClick={abrirEditar}>
              <Edit2 size={14} />
              <span>Editar</span>
            </button>
          )}
          {puedeEditar && (
            <button className="pedidos-btn pedidos-btn-secundario" onClick={handleAnular}>
              <XCircle size={14} />
              <span>Anular</span>
            </button>
          )}
          <button className="pedidos-btn pedidos-btn-peligro" onClick={handleEliminar}>
            <Trash2 size={14} />
            <span>Eliminar</span>
          </button>
        </div>
        )}
      </div>

      <PanelInferior abierto={menuMas} onCerrar={() => setMenuMas(false)} titulo="Más acciones" subtitulo={`Compra #${pedido.pedidoid}`} nombreAvatar={pedido.cliente?.nombreCliente || 'Compra'}>
        <div className="pi-lista-acciones">
          {puedeGenerarCompra && (
            <button type="button" className="pi-accion" onClick={() => { setMenuMas(false); abrirOrdenCompra(); }}><Truck size={15} /> Generar compra al proveedor</button>
          )}
          {puedeConvertir && pedido.cliente?.telefono && (
            <button type="button" className="pi-accion" onClick={() => { setMenuMas(false); avisarListo(); }}><MessageCircle size={15} /> Avisar por WhatsApp que está listo</button>
          )}
          {puedeAbonar && pedido.cliente?.telefono && (
            <button type="button" className="pi-accion" onClick={() => { setMenuMas(false); recordarSaldo(); }}><MessageCircle size={15} /> Recordar saldo por WhatsApp</button>
          )}
          {puedeAbonar && saldoFavor.total > 0 && (
            <button type="button" className="pi-accion" onClick={() => { setMenuMas(false); handleUsarSaldo(); }}><Wallet size={15} /> Usar saldo a favor ({formatoMoneda(saldoFavor.total)})</button>
          )}
          {resumen.disponibleAbonos > 0 && pedido.estado !== 'anulado' && (
            <button type="button" className="pi-accion" onClick={() => { setMenuMas(false); abrirPago('devolucion'); }}><RotateCcw size={15} /> Devolver dinero</button>
          )}
          {puedeEditar && (
            <button type="button" className="pi-accion" onClick={() => { setMenuMas(false); abrirEditar(); }}><Edit2 size={15} /> Editar compra</button>
          )}
          {puedeEditar && (
            <button type="button" className="pi-accion" onClick={() => { setMenuMas(false); handleAnular(); }}><XCircle size={15} /> Anular compra</button>
          )}
          <button type="button" className="pi-accion pi-accion-peligro" onClick={() => { setMenuMas(false); handleEliminar(); }}><Trash2 size={15} /> Eliminar compra</button>
        </div>
      </PanelInferior>

      {itemsSinStock.length > 0 && ['confirmado', 'en_compra', 'recibido'].includes(pedido.estado) && (
        <div className="pedido-alerta-stock">
          <Truck size={16} />
          <span>
            {pedido.ordenid
              ? `Faltan ${itemsSinStock.length} línea(s) por llegar del proveedor.${hayParaEntregar ? ' Puedes entregar ahora lo que ya llegó.' : ' Podrás entregar cuando llegue la mercancía.'}`
              : `Faltan ${itemsSinStock.length} línea(s) por recibir.${hayParaEntregar ? ' Puedes entregar ahora lo que ya tienes en stock.' : ' Genera o recibe la compra para poder entregar.'}`}
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

      <div className="pedido-pagos">
        <div className="pedido-pagos-grid">
          <div className="pedido-pago-stat">
            <span>Abonado</span>
            <strong>{formatoMoneda(resumen.abonado)}</strong>
          </div>
          <div className={`pedido-pago-stat ${resumen.saldo > 0 && pedido.estado !== 'anulado' ? 'pedido-pago-stat-alerta' : ''}`}>
            <span>Saldo por cobrar</span>
            <strong>{pedido.estado === 'anulado' ? '—' : formatoMoneda(resumen.saldo)}</strong>
          </div>
          <div className="pedido-pago-stat">
            <span>Entregado</span>
            <strong>{formatoMoneda(resumen.entregado)}</strong>
          </div>
          <div className="pedido-pago-stat">
            <span>Por entregar</span>
            <strong>{formatoMoneda(resumen.porEntregar)}</strong>
          </div>
        </div>

        <div className="pedido-pagos-header">
          <span><Wallet size={14} /> Pagos del cliente</span>
          <div className="pedido-pagos-acciones">
            {puedeAbonar && (
              <button className="pedidos-btn pedidos-btn-primary pedidos-btn-sm" onClick={() => abrirPago('abono')}>
                <Plus size={13} /><span>Registrar abono</span>
              </button>
            )}
            {puedeAbonar && saldoFavor.total > 0 && (
              <button className="pedidos-btn pedidos-btn-verde pedidos-btn-sm" onClick={handleUsarSaldo}>
                <Wallet size={13} /><span>Usar saldo a favor ({formatoMoneda(saldoFavor.total)})</span>
              </button>
            )}
            {puedeAbonar && pedido.cliente?.telefono && (
              <button className="pedidos-btn pedidos-btn-secundario pedidos-btn-sm" onClick={recordarSaldo} title="Recordar el saldo por WhatsApp">
                <MessageCircle size={13} /><span>Recordar saldo</span>
              </button>
            )}
            {resumen.disponibleAbonos > 0 && pedido.estado !== 'anulado' && (
              <button className="pedidos-btn pedidos-btn-secundario pedidos-btn-sm" onClick={() => abrirPago('devolucion')}>
                <RotateCcw size={13} /><span>Devolver dinero</span>
              </button>
            )}
          </div>
        </div>

        {(pedido.pagos || []).length === 0 ? (
          <p className="pedido-pagos-vacio">Aún no hay abonos registrados en este pedido.</p>
        ) : (
          <div className="items-table-container">
            <table className="items-table pedido-movimientos tabla-tarjetas">
              <thead>
                <tr><th>Fecha</th><th>Movimiento</th><th>Método</th><th>Nota</th><th>Monto</th><th /></tr>
              </thead>
              <tbody>
                {pedido.pagos.map((pago) => {
                  const tipo = TIPO_MOVIMIENTO[pago.tipo] || TIPO_MOVIMIENTO.abono;
                  return (
                    <tr key={pago.pagoid}>
                      <td>{formatearFecha(pago.createdAt, true)}</td>
                      <td><span className={`pedido-mov pedido-mov-${tipo.clase}`}>{tipo.label}</span></td>
                      <td>{metodoLabel(pago.metodo)}</td>
                      <td className="pedido-mov-nota">{pago.nota || '—'}</td>
                      <td className={`item-subtotal pedido-mov-monto-${tipo.clase}`}>{tipo.signo} {formatoMoneda(pago.monto)}</td>
                      <td>
                        <button className="pedido-recibo-btn" onClick={() => setReciboPago(pago)} title="Ver o imprimir el recibo" aria-label={`Recibo ${pago.pagoid}`}>
                          <Receipt size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pedido-datos-extra">
        <div className="pedido-dato">
          <span>Entrega</span>
          <strong>{pedido.fechaEntrega ? formatearFecha(pedido.fechaEntrega) : 'Sin fecha definida'}</strong>
        </div>
        {(pedido.ventas || []).length > 0 && (
          <div className="pedido-dato">
            <span>Entregas realizadas</span>
            <div className="pedido-entregas-lista">
              {pedido.ventas.map((venta) => (
                <button key={venta.ventaid} className="pedido-link-venta" onClick={() => navigate(`/dashboard/venta/${venta.ventaid}`)}>
                  Venta #{venta.ventaid} · {formatoMoneda(venta.total)}
                </button>
              ))}
            </div>
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
          <table className="items-table tabla-tarjetas">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cant.</th>
                <th>Entregado</th>
                <th>{pedido.ordenid ? 'Llegado' : 'Stock físico'}</th>
                <th>Precio Unit.</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(pedido.detalles || []).map((item) => {
                const stockFisico = stockFisicoDe(item);
                const pendiente = pendienteDe(item);
                const faltante = Math.max(0, pendiente - stockFisico);
                return (
                  <tr key={item.detalleid}>
                    <td className="item-name">
                      <div className="item-icon"><Package size={13} /></div>
                      {item.productoNombre}
                      {item.talla && <span className="cart-item-talla">Talla {item.talla}</span>}
                      {(Number(item.enCompra) > 0 || Number(item.recibidoCompra) > 0) && (
                        <span className="pedido-compra-estado">
                          {Number(item.enCompra) > 0 && `En compra: ${item.enCompra}`}
                          {Number(item.enCompra) > 0 && Number(item.recibidoCompra) > 0 && ' · '}
                          {Number(item.recibidoCompra) > 0 && `Llegó: ${item.recibidoCompra}`}
                        </span>
                      )}
                    </td>
                    <td className="item-qty">{formatearCantidad(item.cantidad, item.producto?.unidadMedida)}</td>
                    <td>
                      <span className={`pedido-entrega-estado ${pendiente <= 0 ? 'completa' : Number(item.cantidadEntregada) > 0 ? 'parcial' : ''}`}>
                        {formatearCantidad(item.cantidadEntregada || 0, item.producto?.unidadMedida)} / {formatearCantidad(item.cantidad, item.producto?.unidadMedida)}
                      </span>
                    </td>
                    <td>
                      {pendiente <= 0 ? (
                        <span className="pedido-stock-ok">Entregado</span>
                      ) : faltante > 0 ? (
                        <span className="pedido-stock-faltante">{pedido.ordenid ? 'Por llegar' : 'Faltan'} {formatearCantidad(faltante, item.producto?.unidadMedida)}</span>
                      ) : (
                        <span className="pedido-stock-ok">{formatearCantidad(stockFisico, item.producto?.unidadMedida)} {pedido.ordenid ? 'por entregar' : 'disp.'}</span>
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
                <td colSpan="5" className="footer-label">Total</td>
                <td className="footer-value">{formatoMoneda(pedido.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {pedido.ordenid ? (
        <div className="pedido-ordenes-section">
          <div className="pedido-ordenes-header">
            <div>
              <h2><Truck size={16} /> Pedido al proveedor</h2>
              <p>Esta compra va dentro del pedido #{pedido.ordenid}: lo que falta se pide al proveedor desde allí y lo que llega se reparte entre los clientes.</p>
            </div>
            <button className="pedidos-btn pedidos-btn-secundario" onClick={() => navigate(`/dashboard/pedidos/${pedido.ordenid}`)}>
              <Truck size={14} />
              <span>Ver pedido #{pedido.ordenid}</span>
            </button>
          </div>
        </div>
      ) : (
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
                    <span className="pedido-orden-fecha">
                      Creada el {formatearFecha(orden.createdAt)} ·{' '}
                      <button className="pedido-link-venta" onClick={() => navigate(`/dashboard/pedidos/${orden.ordenid}`)}>Ver pedido #{orden.ordenid}</button>
                    </span>
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
      )}

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

              {editarProductos ? (
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
                  Los productos ya no se pueden modificar porque la compra ya fue enviada al proveedor,
                  está en una orden activa o tiene entregas registradas.
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

      {modal === 'pago' && (
        <div className="pedido-modal-overlay" onClick={() => setModal(null)}>
          <div className="pedido-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pedido-modal-header">
              <h3>{pagoForm.tipo === 'abono' ? 'Registrar abono' : 'Devolver dinero al cliente'}</h3>
              <button className="pedido-modal-close" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <form className="pedido-modal-form" onSubmit={handleGuardarPago}>
              <p className="pedido-modal-texto">
                {pagoForm.tipo === 'abono'
                  ? `Saldo pendiente del pedido: ${formatoMoneda(resumen.saldo)}.`
                  : `Dinero de abonos que aún no se cobra en una entrega: ${formatoMoneda(resumen.disponibleAbonos)}.`}
              </p>
              <div className="pedido-form-group">
                <label>Monto</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  autoFocus
                  value={pagoForm.monto}
                  onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })}
                />
              </div>
              <div className="pedido-form-group">
                <label>Método</label>
                <select value={pagoForm.metodo} onChange={(e) => setPagoForm({ ...pagoForm, metodo: e.target.value })}>
                  {METODOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="pedido-form-group">
                <label>Nota (opcional)</label>
                <input
                  value={pagoForm.nota}
                  maxLength={255}
                  onChange={(e) => setPagoForm({ ...pagoForm, nota: e.target.value })}
                  placeholder="Ej: transferencia Nequi, recibo #123"
                />
              </div>
              <div className="pedido-modal-footer">
                <button type="button" className="pedidos-btn pedidos-btn-secundario" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="pedidos-btn pedidos-btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : pagoForm.tipo === 'abono' ? 'Registrar abono' : 'Registrar devolución'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'entrega' && (
        <div className="pedido-modal-overlay" onClick={() => setModal(null)}>
          <div className="pedido-modal pedido-modal-ancho" onClick={(e) => e.stopPropagation()}>
            <div className="pedido-modal-header">
              <h3>Entregar productos</h3>
              <button className="pedido-modal-close" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <form className="pedido-modal-form" onSubmit={handleEntregar}>
              <p className="pedido-modal-texto">
                Indica cuánto de cada línea entregas ahora. Lo demás queda pendiente y puedes entregarlo después.
              </p>
              <div className="pedido-entrega-lineas">
                {(pedido.detalles || []).filter((d) => pendienteDe(d) > 0).map((detalle) => {
                  const stock = stockFisicoDe(detalle);
                  const maximo = Math.min(pendienteDe(detalle), stock);
                  const unidad = detalle.producto?.unidadMedida;
                  return (
                    <div key={detalle.detalleid} className="pedido-entrega-linea">
                      <div className="pedido-entrega-info">
                        <strong>
                          {detalle.productoNombre}
                          {detalle.talla && <span className="cart-item-talla">Talla {detalle.talla}</span>}
                        </strong>
                        <small>
                          Pendiente {formatearCantidad(pendienteDe(detalle), unidad)} · Stock {formatearCantidad(stock, unidad)} · {formatoMoneda(detalle.precioUnitario)} c/u
                        </small>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max={maximo}
                        step={stepCantidad(unidad)}
                        disabled={maximo <= 0}
                        value={entregaItems[detalle.detalleid] ?? ''}
                        onChange={(e) => setEntregaItems({ ...entregaItems, [detalle.detalleid]: e.target.value })}
                        aria-label={`Cantidad a entregar de ${detalle.productoNombre}`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="pedido-entrega-resumen">
                <div><span>Valor de esta entrega</span><strong>{formatoMoneda(entregaValor)}</strong></div>
                <div><span>Cubierto con abonos</span><strong>{formatoMoneda(entregaCubierto)}</strong></div>
                <div><span>Por cobrar ahora</span><strong>{formatoMoneda(entregaPorCobrar)}</strong></div>
              </div>

              {entregaPorCobrar > 0 && (
                <div className="pedido-form-group">
                  <label>Pago recibido en la entrega (opcional)</label>
                  <div className="pedido-abono-inicial">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder={`Hasta ${formatoMoneda(Math.min(entregaPorCobrar, resumen.saldo))}`}
                      value={entregaPago.monto}
                      onChange={(e) => setEntregaPago({ ...entregaPago, monto: e.target.value })}
                    />
                    <select value={entregaPago.metodo} onChange={(e) => setEntregaPago({ ...entregaPago, metodo: e.target.value })}>
                      {METODOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <small className="pedido-ayuda">Lo que no se cobre ahora queda como saldo por cobrar del pedido.</small>
                </div>
              )}

              <div className="pedido-modal-footer">
                <button type="button" className="pedidos-btn pedidos-btn-secundario" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="pedidos-btn pedidos-btn-verde" disabled={guardando || entregaValor <= 0}>
                  {guardando ? 'Registrando...' : 'Registrar entrega'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'anular' && (
        <div className="pedido-modal-overlay" onClick={() => setModal(null)}>
          <div className="pedido-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pedido-modal-header">
              <h3>Anular pedido #{pedido.pedidoid}</h3>
              <button className="pedido-modal-close" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <form className="pedido-modal-form" onSubmit={handleConfirmarAnulacion}>
              <p className="pedido-modal-texto">
                Se liberará el stock reservado de lo que falte por entregar y se anularán las órdenes de compra pendientes.
              </p>

              {resumen.disponibleAbonos > 0 ? (
                <>
                  <div className="pedido-form-group">
                    <label>El cliente tiene {formatoMoneda(resumen.disponibleAbonos)} en abonos. ¿Qué haces con ese dinero?</label>
                    <label className="pedido-opcion">
                      <input
                        type="radio"
                        name="destino-abonos"
                        checked={anularForm.abonos === 'devolver'}
                        onChange={() => setAnularForm({ ...anularForm, abonos: 'devolver' })}
                      />
                      <span><strong>Devolver el dinero</strong><small>Se registra la devolución al cliente.</small></span>
                    </label>
                    <label className={`pedido-opcion ${!pedido.clienteid ? 'deshabilitada' : ''}`}>
                      <input
                        type="radio"
                        name="destino-abonos"
                        disabled={!pedido.clienteid}
                        checked={anularForm.abonos === 'saldo_a_favor'}
                        onChange={() => setAnularForm({ ...anularForm, abonos: 'saldo_a_favor' })}
                      />
                      <span><strong>Dejarlo como saldo a favor</strong><small>El cliente lo podrá usar como abono en otro pedido.</small></span>
                    </label>
                  </div>
                  {anularForm.abonos === 'devolver' && (
                    <div className="pedido-form-group">
                      <label>Método de la devolución</label>
                      <select value={anularForm.metodo} onChange={(e) => setAnularForm({ ...anularForm, metodo: e.target.value })}>
                        {METODOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                  )}
                </>
              ) : (
                <p className="pedido-ayuda">Este pedido no tiene abonos pendientes de devolver.</p>
              )}

              <div className="pedido-modal-footer">
                <button type="button" className="pedidos-btn pedidos-btn-secundario" onClick={() => setModal(null)}>Volver</button>
                <button type="submit" className="pedidos-btn pedidos-btn-peligro" disabled={guardando}>
                  {guardando ? 'Anulando...' : 'Anular pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reciboPago && (
        <ReciboModal pedido={pedido} pago={reciboPago} negocio={negocio} onClose={() => setReciboPago(null)} />
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
