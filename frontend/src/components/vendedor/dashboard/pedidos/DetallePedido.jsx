import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, ClipboardList, Edit2, FileText, Hash, MessageCircle, MoreHorizontal, Package, Plus, Receipt, RotateCcw, ShoppingBag, Trash2, Truck, Undo2, User, Wallet, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  deletePedido,
  anularPedido,
  devolverProductosPedido,
  entregarPedido,
  getSaldoFavor,
  registrarPagoPedido,
  usarSaldoFavor,
  getPedidoById,
  updatePedido,
} from '../../../../services/pedidoService';
import { getClientes } from '../../../../services/clienteService';
import { stepCantidad, formatearCantidad } from '../../../../utils/unidades';
import { imagenUrl } from '../../../../config';
import ReciboPagina from './ReciboPagina';
import ComprobanteCompra from './ComprobanteCompra';
import EncabezadoPagina from '../../../comunes/EncabezadoPagina';
import { getNegocio } from '../../../../services/negocioService';
import { abrirWhatsApp, mensajeListoParaEntregar, mensajeRecordatorioSaldo } from '../../../../utils/whatsapp';
import '../balance/vistas/styles/DetalleTransaccion.css';
import { useEsMovil } from '../../../../hooks/useEsMovil';
import PanelInferior from '../../../comunes/PanelInferior';
import './Pedidos.css';

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

// Por qué el cliente devuelve la mercancía (las claves las valida el backend)
const MOTIVOS_DEVOLUCION = [
  { value: 'color', label: 'No era el color' },
  { value: 'talla', label: 'No era la talla' },
  { value: 'modelo', label: 'No era el modelo' },
  { value: 'danado', label: 'Llegó dañado o con defecto' },
  { value: 'no_gusto', label: 'No le gustó' },
  { value: 'otro', label: 'Otro motivo' },
];
const etiquetaMotivo = (valor) => MOTIVOS_DEVOLUCION.find((m) => m.value === valor)?.label || valor;

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

const formatoMoneda = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(valor) || 0);

const formatearFecha = (fecha, conHora = false) => {
  if (!fecha) return 'Sin fecha';
  return new Date(`${fecha}`.length === 10 ? `${fecha}T12:00:00` : fecha)
    .toLocaleDateString('es-CO', conHora
      ? { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: 'long', year: 'numeric' });
};

// Pantallas de formulario del pedido (antes ventanas emergentes): cada una es una ruta /dashboard/pedido/:id/<vista>
const VISTAS = ['editar', 'pago', 'entrega', 'devolucion', 'anular', 'recibo', 'comprobante'];

function DetallePedido() {
  const { id, vista, pagoid } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const modal = VISTAS.includes(vista) ? vista : null;
  const sinNavegar = useRef(false);
  const rutaBase = `/dashboard/pedido/${id}`;
  // Abre una pantalla de formulario; `desde` permite volver con la flecha del navegador sin dejar historial de sobra
  const setModal = (destino, consulta = '') => {
    if (sinNavegar.current) return;
    if (destino) navigate(`${rutaBase}/${destino}${consulta}`, { state: { desde: true } });
    else if (location.state?.desde) navigate(-1);
    else if (location.state?.volverA) navigate(location.state.volverA, { replace: true });
    else navigate(rutaBase, { replace: true });
  };
  const volver = () => setModal(null);
  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [editForm, setEditForm] = useState({ clienteid: '', fechaEntrega: '', descripcion: '' });
  const [searchParams, setSearchParams] = useSearchParams();
  const [saldoFavor, setSaldoFavor] = useState({ total: 0, pedidos: [] });
  const [pagoForm, setPagoForm] = useState({ tipo: 'abono', monto: '', metodo: 'efectivo', nota: '' });
  const [entregaItems, setEntregaItems] = useState({}); // detalleid -> cantidad a entregar (texto)
  const [entregaPago, setEntregaPago] = useState({ monto: '', metodo: 'efectivo' });
  const [anularForm, setAnularForm] = useState({ abonos: 'devolver', metodo: 'efectivo' });
  const [devolForm, setDevolForm] = useState({ items: {}, motivo: '', nota: '', reingresar: true, reembolsar: false, metodo: 'efectivo' });
  const [negocio, setNegocio] = useState(null);

  // Datos del negocio para los recibos y los mensajes de WhatsApp
  useEffect(() => {
    getNegocio().then(setNegocio).catch(() => setNegocio(null));
  }, []);

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
    getClientes()
      .then((clientesData) => {
        if (Array.isArray(clientesData)) setClientes(clientesData);
      })
      .catch(() => {});
  }, []);

  const abrirEditar = () => {
    if (puedeEditarProductosDe(pedido)) {
      const params = new URLSearchParams();
      params.set('editar', String(pedido.pedidoid));
      if (pedido.ordenid) params.set('pedido', String(pedido.ordenid));
      navigate(`/dashboard/nuevo-pedido?${params.toString()}`);
      return;
    }

    setEditForm({
      clienteid: pedido.clienteid || '',
      fechaEntrega: pedido.fechaEntrega || '',
      descripcion: pedido.descripcion || '',
    });
    setModal('editar');
  };

  // ───── Pagos ─────
  const abrirPago = (tipo = 'abono') => {
    const resumen = pedido.resumen || {};
    const sugerido = tipo === 'abono' ? resumen.saldo : resumen.disponibleAbonos;
    setPagoForm({ tipo, monto: sugerido > 0 ? String(sugerido) : '', metodo: 'efectivo', nota: '' });
    setModal('pago', `?tipo=${tipo}`);
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

  // ───── Devolución de mercancía ya entregada ─────
  // `detalleid` (opcional) deja marcada una unidad de esa línea, para devolver un producto en específico
  const abrirDevolucion = (detalleid) => {
    const linea = detalleid ? (pedido.detalles || []).find((d) => Number(d.detalleid) === Number(detalleid)) : null;
    const items = linea && Number(linea.cantidadEntregada) > 0 ? { [linea.detalleid]: '1' } : {};
    setDevolForm({ items, motivo: '', nota: '', reingresar: true, reembolsar: false, metodo: 'efectivo' });
    setModal('devolucion');
  };

  // Si la cantidad se pasa de lo entregado, se ajusta al máximo
  const cambiarCantidadDevuelta = (detalle, valor) => {
    let nuevo = valor;
    if (valor !== '') {
      const n = Number(valor);
      const maximo = Number(detalle.cantidadEntregada);
      if (!Number.isFinite(n) || n < 0) nuevo = '0';
      else if (n > maximo) nuevo = String(maximo);
    }
    setDevolForm((prev) => ({ ...prev, items: { ...prev.items, [detalle.detalleid]: nuevo } }));
  };

  const cambiarMotivoDevolucion = (motivo) => {
    // Un producto dañado no vuelve al inventario por defecto
    setDevolForm((prev) => ({ ...prev, motivo, reingresar: motivo !== 'danado' }));
  };

  const handleDevolver = async (e) => {
    e.preventDefault();
    const items = Object.entries(devolForm.items)
      .map(([detalleid, cantidad]) => ({ detalleid: Number(detalleid), cantidad: Number(cantidad) || 0 }))
      .filter((item) => item.cantidad > 0);
    if (items.length === 0) {
      toast.error('Indica la cantidad de al menos un producto devuelto.');
      return;
    }
    if (!devolForm.motivo) {
      toast.error('Elige el motivo de la devolución.');
      return;
    }
    try {
      setGuardando(true);
      const data = await devolverProductosPedido(pedido.pedidoid, {
        items,
        motivo: devolForm.motivo,
        nota: devolForm.nota,
        reingresarStock: devolForm.reingresar,
        reembolsar: devolForm.reembolsar,
        metodo: devolForm.metodo,
      });
      setModal(null);
      toast.success(data.reembolsado > 0
        ? `Devolución registrada. Se reembolsaron ${formatoMoneda(data.reembolsado)} al cliente.`
        : 'Devolución registrada.');
      cargarPedido(true);
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo registrar la devolución.');
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
    const detalleParam = searchParams.get('detalle');
    setSearchParams({}, { replace: true });
    if (accion === 'devolver' && pedido.estado !== 'anulado') abrirDevolucion(detalleParam);
    if (accion === 'entregar' && ['confirmado', 'en_compra', 'recibido'].includes(pedido.estado)) abrirEntrega();
    if (accion === 'anular' && !['entregado', 'anulado'].includes(pedido.estado)) abrirAnular();
    if (accion === 'abono' && pedido.estado !== 'anulado' && Number(pedido.resumen?.saldo) > 0) abrirPago('abono');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, searchParams]);

  useEffect(() => {
    if (!pedido || !modal || location.state?.desde) return;
    sinNavegar.current = true;
    if (modal === 'editar') abrirEditar();
    if (modal === 'pago') abrirPago(searchParams.get('tipo') === 'devolucion' ? 'devolucion' : 'abono');
    if (modal === 'entrega') abrirEntrega();
    if (modal === 'devolucion') abrirDevolucion(searchParams.get('detalle'));
    if (modal === 'anular') abrirAnular();
    sinNavegar.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.pedidoid, modal]);

  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    try {
      setGuardando(true);
      await updatePedido(pedido.pedidoid, {
        clienteid: editForm.clienteid || null,
        fechaEntrega: editForm.fechaEntrega || null,
        descripcion: editForm.descripcion,
      });
      setModal(null);
      toast.success('Pedido actualizado.');
      cargarPedido(true);
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo actualizar el pedido.');
    } finally {
      setGuardando(false);
    }
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
  const pagoRecibo = (pedido.pagos || []).find((p) => String(p.pagoid) === String(pagoid));
  // Las devoluciones se muestran como estado de cada producto (con su motivo), no como una sección aparte
  const devolucionesPorLinea = new Map();
  for (const dev of pedido.devoluciones || []) {
    if (!devolucionesPorLinea.has(dev.detalleid)) devolucionesPorLinea.set(dev.detalleid, []);
    devolucionesPorLinea.get(dev.detalleid).push(dev);
  }
  const lineasDevolvibles = (pedido.detalles || []).filter((d) => Number(d.cantidadEntregada) > 0);
  const puedeDevolver = pedido.estado !== 'anulado' && lineasDevolvibles.length > 0;
  const devolValor = lineasDevolvibles.reduce(
    (sum, d) => sum + (Number(devolForm.items[d.detalleid]) || 0) * Number(d.precioUnitario), 0
  );
  const entregaValor = (pedido.detalles || []).reduce(
    (sum, d) => sum + (Number(entregaItems[d.detalleid]) || 0) * Number(d.precioUnitario), 0
  );
  const entregaCubierto = Math.min(entregaValor, resumen.disponibleAbonos);
  const entregaPorCobrar = Math.max(0, Math.round((entregaValor - entregaCubierto) * 100) / 100);
  const puedeEditar = !['entregado', 'anulado'].includes(pedido.estado);
  // Dentro de un pedido al proveedor no hay paso de confirmar: la compra simplemente está en el pedido
  const estadoConfig = pedido.ordenid && pedido.estado === 'confirmado'
    ? { label: 'En el pedido', clase: 'pendiente' }
    : (ESTADOS[pedido.estado] || { label: pedido.estado, clase: 'anulado' });

  return (
    <div className="detalle-tx-view detalle-ancho">
      {!modal && (<>
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
          {puedeConvertir && (
            <button className="pedidos-btn pedidos-btn-verde" onClick={abrirEntrega}>
              <ShoppingBag size={14} />
              <span>Entregar</span>
            </button>
          )}
          <button className="pedidos-btn pedidos-btn-secundario" onClick={() => setModal('comprobante')} title="Resumen de la compra para enviarle al cliente">
            <Receipt size={14} />
            <span>Recibo de compra</span>
          </button>
          {puedeDevolver && (
            <button className="pedidos-btn pedidos-btn-secundario" onClick={() => abrirDevolucion()} title="El cliente devuelve productos que ya recibió">
              <Undo2 size={14} />
              <span>Devolución</span>
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
          <button type="button" className="pi-accion" onClick={() => { setMenuMas(false); setModal('comprobante'); }}><Receipt size={15} /> Recibo de compra</button>
          {puedeDevolver && (
            <button type="button" className="pi-accion" onClick={() => { setMenuMas(false); abrirDevolucion(); }}><Undo2 size={15} /> Registrar devolución de productos</button>
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
            {`Faltan ${itemsSinStock.length} línea(s) por llegar del proveedor.${hayParaEntregar ? ' Puedes entregar ahora lo que ya llegó.' : ' Podrás entregar cuando llegue la mercancía.'}`}
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
                  const badgeMov = tipo.clase === 'abono' ? 'tbl-badge--ok' : tipo.clase === 'devolucion' ? 'tbl-badge--danger' : 'tbl-badge--neutral';
                  return (
                    <tr key={pago.pagoid}>
                      <td>{formatearFecha(pago.createdAt, true)}</td>
                      <td><span className={`tbl-badge ${badgeMov}`}>{tipo.label}</span></td>
                      <td>{metodoLabel(pago.metodo)}</td>
                      <td className="pedido-mov-nota">{pago.nota || <span className="tbl-vacio">—</span>}</td>
                      <td className={`item-subtotal pedido-mov-monto-${tipo.clase}`}>{tipo.signo} {formatoMoneda(pago.monto)}</td>
                      <td>
                        <button className="tbl-icon-btn" style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)' }} onClick={() => setModal(`recibo/${pago.pagoid}`)} title="Ver o imprimir el recibo" aria-label={`Recibo ${pago.pagoid}`}>
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
                const devs = devolucionesPorLinea.get(item.detalleid) || [];
                const devuelta = devs.reduce((acc, dev) => acc + Number(dev.cantidad), 0);
                const pidio = Math.round((Number(item.cantidad) + devuelta) * 1000) / 1000;
                const todoDevuelto = devuelta > 0 && Number(item.cantidad) <= 0;
                return (
                  <tr key={item.detalleid}>
                    <td className="item-name">
                      <div className="tbl-main-cell">
                        <span className="tbl-avatar" style={{ background: '#6366F1', borderRadius: '10px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                          <Package size={14} style={{ opacity: item.producto?.imagenes?.[0] ? 0 : 1 }} />
                          {item.producto?.imagenes?.[0] && (
                            <img
                              src={imagenUrl(item.producto.imagenes[0])}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
                        </span>
                        <div className="tbl-cell-texts">
                          <span className="tbl-cell-primary">
                            {item.productoNombre}
                            {item.talla && <span className="cart-item-talla" style={{ marginLeft: '0.4rem' }}>Talla {item.talla}</span>}
                          </span>
                          {devs.map((dev) => (
                            <span key={dev.devolucionid} className="compras-producto-devolucion">
                              <Undo2 size={11} />
                              Devolución de {formatearCantidad(dev.cantidad, item.producto?.unidadMedida)}: {etiquetaMotivo(dev.motivo)}
                              {dev.nota ? ` · ${dev.nota}` : ''}
                              {!dev.reingresaStock ? ' · No volvió al inventario' : ''}
                            </span>
                          ))}
                          {(Number(item.enCompra) > 0 || Number(item.recibidoCompra) > 0) && (
                            <span className="tbl-cell-secondary">
                              {Number(item.enCompra) > 0 && `En compra: ${item.enCompra}`}
                              {Number(item.enCompra) > 0 && Number(item.recibidoCompra) > 0 && ' · '}
                              {Number(item.recibidoCompra) > 0 && `Llegó: ${item.recibidoCompra}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="item-qty">{formatearCantidad(pidio, item.producto?.unidadMedida)}</td>
                    <td>
                      <span className={`pedido-entrega-estado ${pendiente <= 0 ? 'completa' : Number(item.cantidadEntregada) > 0 ? 'parcial' : ''}`}>
                        {formatearCantidad(item.cantidadEntregada || 0, item.producto?.unidadMedida)} / {formatearCantidad(pidio, item.producto?.unidadMedida)}
                      </span>
                    </td>
                    <td>
                      {todoDevuelto ? (
                        <span className="compras-situacion compras-situacion-devolucion">Devolución</span>
                      ) : pendiente <= 0 ? (
                        <>
                          <span className="pedido-stock-ok">Entregado</span>
                          {devuelta > 0 && <span className="compras-situacion compras-situacion-devolucion" style={{ marginLeft: '0.35rem' }}>Devolución · {formatearCantidad(devuelta, item.producto?.unidadMedida)}</span>}
                        </>
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

      </>)}

      {modal === 'editar' && (
        <div className="pedido-pagina">
          <EncabezadoPagina onVolver={volver} migas={<>Pedidos / Compra #{pedido.pedidoid}</>}>Editar pedido</EncabezadoPagina>
          <div className="pedido-pagina-card">
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

              <p className="pedido-edit-hint">
                Los productos ya no se pueden modificar porque la compra ya fue enviada al proveedor,
                está en una orden activa o tiene entregas registradas.
              </p>

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

      {modal === 'pago' && (
        <div className="pedido-pagina">
          <EncabezadoPagina onVolver={volver} migas={<>Pedidos / Compra #{pedido.pedidoid}</>}>{pagoForm.tipo === 'abono' ? 'Registrar abono' : 'Devolver dinero al cliente'}</EncabezadoPagina>
          <div className="pedido-pagina-card">
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
        <div className="pedido-pagina">
          <EncabezadoPagina onVolver={volver} migas={<>Pedidos / Compra #{pedido.pedidoid}</>}>Entregar productos</EncabezadoPagina>
          <div className="pedido-pagina-card pedido-pagina-ancha">
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

      {modal === 'devolucion' && (
        <div className="pedido-pagina">
          <EncabezadoPagina onVolver={volver} migas={<>Pedidos / Compra #{pedido.pedidoid}</>}>Devolución de productos</EncabezadoPagina>
          <div className="pedido-pagina-card pedido-pagina-ancha">
            <form className="pedido-modal-form" onSubmit={handleDevolver}>
              <p className="pedido-modal-texto">
                Indica cuánto devuelve el cliente de cada producto que ya recibió.
              </p>
              <div className="pedido-entrega-lineas">
                {lineasDevolvibles.map((detalle) => {
                  const unidad = detalle.producto?.unidadMedida;
                  return (
                    <div key={detalle.detalleid} className="pedido-entrega-linea">
                      <div className="pedido-entrega-info">
                        <strong>
                          {detalle.productoNombre}
                          {detalle.talla && <span className="cart-item-talla">Talla {detalle.talla}</span>}
                        </strong>
                        <small>
                          Recibió {formatearCantidad(detalle.cantidadEntregada, unidad)} · {formatoMoneda(detalle.precioUnitario)} c/u
                        </small>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max={detalle.cantidadEntregada}
                        step={stepCantidad(unidad)}
                        value={devolForm.items[detalle.detalleid] ?? ''}
                        onChange={(e) => cambiarCantidadDevuelta(detalle, e.target.value)}
                        aria-label={`Cantidad devuelta de ${detalle.productoNombre}`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="pedido-form-group">
                <label>¿Por qué lo devuelve?</label>
                <div className="devolucion-motivos">
                  {MOTIVOS_DEVOLUCION.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      className={`tbl-chip${devolForm.motivo === m.value ? ' tbl-chip--activo' : ''}`}
                      onClick={() => cambiarMotivoDevolucion(m.value)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pedido-form-group">
                <label>Nota (opcional)</label>
                <input
                  type="text"
                  maxLength={255}
                  placeholder="Ej. quería el mismo modelo en negro"
                  value={devolForm.nota}
                  onChange={(e) => setDevolForm({ ...devolForm, nota: e.target.value })}
                />
              </div>

              <label className="pedido-opcion">
                <input
                  type="checkbox"
                  checked={devolForm.reingresar}
                  onChange={(e) => setDevolForm({ ...devolForm, reingresar: e.target.checked })}
                />
                <span>
                  <strong>Volver a ponerlo en el inventario</strong>
                  <small>Desmarca esta opción si el producto no se puede volver a vender.</small>
                </span>
              </label>

              <label className="pedido-opcion">
                <input
                  type="checkbox"
                  checked={devolForm.reembolsar}
                  onChange={(e) => setDevolForm({ ...devolForm, reembolsar: e.target.checked })}
                />
                <span>
                  <strong>Reembolsar el dinero al cliente</strong>
                  <small>Devuelve lo que ya pagó por estos productos. Si no, queda como abono a favor suyo (por ejemplo, para un cambio).</small>
                </span>
              </label>
              {devolForm.reembolsar && (
                <div className="pedido-form-group">
                  <label>Método del reembolso</label>
                  <select value={devolForm.metodo} onChange={(e) => setDevolForm({ ...devolForm, metodo: e.target.value })}>
                    {METODOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              )}

              <div className="pedido-entrega-resumen">
                <div><span>Valor devuelto</span><strong>{formatoMoneda(devolValor)}</strong></div>
              </div>

              <div className="pedido-modal-footer">
                <button type="button" className="pedidos-btn pedidos-btn-secundario" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="pedidos-btn pedidos-btn-primary" disabled={guardando || devolValor <= 0 || !devolForm.motivo}>
                  {guardando ? 'Registrando...' : 'Registrar devolución'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'anular' && (
        <div className="pedido-pagina">
          <EncabezadoPagina onVolver={volver} migas={<>Pedidos / Compra #{pedido.pedidoid}</>}>Anular pedido #{pedido.pedidoid}</EncabezadoPagina>
          <div className="pedido-pagina-card">
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

      {modal === 'comprobante' && (
        <ComprobanteCompra pedido={pedido} negocio={negocio} onVolver={volver} />
      )}

      {modal === 'recibo' && pagoRecibo && (
        <ReciboPagina pedido={pedido} pago={pagoRecibo} negocio={negocio} onVolver={volver} />
      )}
    </div>
  );
}

export default DetallePedido;
