import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Edit2, FileText, Hash, MessageCircle, MoreHorizontal, Package, Plus, Receipt, RotateCcw, ShoppingBag, Trash2, Undo2, User, Wallet, XCircle } from 'lucide-react';
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
import { nombrePedido } from '../compras/comprasUtils';
import '../compras/Compras.css';
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
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef(null);
  const botonMenuRef = useRef(null);

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

  // El menú "Más" (escritorio) se cierra al hacer clic fuera o con Esc, devolviendo el foco al botón
  useEffect(() => {
    if (!menuAbierto) return undefined;
    const alHacerClic = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAbierto(false); };
    const alTeclear = (e) => { if (e.key === 'Escape') { setMenuAbierto(false); botonMenuRef.current?.focus(); } };
    document.addEventListener('mousedown', alHacerClic);
    document.addEventListener('keydown', alTeclear);
    return () => { document.removeEventListener('mousedown', alHacerClic); document.removeEventListener('keydown', alTeclear); };
  }, [menuAbierto]);

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
    toast(`¿Eliminar la compra ${pedido.numero}?`, {
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
      numero: pedido.numero,
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
      numero: pedido.numero,
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
  const anulada = pedido.estado === 'anulado';
  const pedidoAbierto = pedido.pedidoProveedor?.estado === 'abierta';
  // Dinero que el cliente pagó de más (p. ej. tras devolver mercancía ya pagada)
  const aFavor = Math.max(0, Number(resumen.disponibleAbonos || 0) - Number(resumen.porEntregar || 0));
  // En qué va cada producto: esperando al proveedor, listo para entregar, entregado o devuelto
  const situacionDe = (d, devuelta) => {
    if (anulada) return { texto: 'Compra cancelada', clase: 'cancelado' };
    if (devuelta > 0 && Number(d.cantidad) <= 0) return { texto: 'Devolución', clase: 'devolucion' };
    if (Number(d.cantidadEntregada || 0) >= Number(d.cantidad)) return { texto: 'Entregado', clase: 'entregado' };
    if (pedidoAbierto) return { texto: 'En el pedido', clase: 'espera' };
    if (Number(d.recibidoCompra || 0) >= Number(d.cantidad)) return { texto: 'Listo para entregar', clase: 'listo' };
    if (Number(d.recibidoCompra || 0) > 0) return { texto: 'Llegó parte', clase: 'parcial' };
    return { texto: 'Esperando al proveedor', clase: 'espera' };
  };
  // Todas las acciones de la compra, salvo Abonar y Entregar, viven en un solo menú
  const accionesMas = [
    puedeDevolver && { clave: 'devolucion', etiqueta: 'Devolución de productos', icono: Undo2, ir: () => abrirDevolucion() },
    resumen.disponibleAbonos > 0 && !anulada && { clave: 'dinero', etiqueta: 'Devolver dinero', icono: RotateCcw, ir: () => abrirPago('devolucion') },
    puedeAbonar && saldoFavor.total > 0 && { clave: 'saldo', etiqueta: `Usar saldo a favor (${formatoMoneda(saldoFavor.total)})`, icono: Wallet, ir: handleUsarSaldo },
    puedeConvertir && pedido.cliente?.telefono && { clave: 'listo', etiqueta: 'Avisar por WhatsApp que está listo', icono: MessageCircle, ir: avisarListo },
    puedeAbonar && pedido.cliente?.telefono && { clave: 'recordar', etiqueta: 'Recordar saldo por WhatsApp', icono: MessageCircle, ir: recordarSaldo },
    puedeEditar && { clave: 'editar', etiqueta: 'Editar compra', icono: Edit2, ir: abrirEditar },
    puedeEditar && { clave: 'anular', etiqueta: 'Anular compra', icono: XCircle, ir: handleAnular },
    { clave: 'eliminar', etiqueta: 'Eliminar compra', icono: Trash2, ir: handleEliminar, peligro: true },
  ].filter(Boolean);
  const ejecutarMas = (accion) => { setMenuAbierto(false); setMenuMas(false); accion.ir(); };
  // Dentro de un pedido al proveedor no hay paso de confirmar: la compra simplemente está en el pedido
  const estadoConfig = pedido.ordenid && pedido.estado === 'confirmado'
    ? { label: 'En el pedido', clase: 'pendiente' }
    : (ESTADOS[pedido.estado] || { label: pedido.estado, clase: 'anulado' });

  return (
    <div className="detalle-tx-view detalle-ancho">
      {!modal && (<>
      <div className="detalle-tx-header">
        <button className="btn-circle-back" onClick={() => navigate(pedido.ordenid ? `/dashboard/pedidos/${pedido.ordenid}` : '/dashboard/pedidos')} aria-label="Volver">
          <ArrowLeft size={18} />
        </button>
        <div className="detalle-tx-header-text">
          <div className="pedido-titulo-linea">
            <h1>{pedido.cliente?.nombreCliente || 'Consumidor final'} <span className="pedido-titulo-numero">· Compra {pedido.numero}</span></h1>
            <span className={`pedido-estado pedido-estado-${estadoConfig.clase}`}>{estadoConfig.label}</span>
          </div>
          <div className="detalle-tx-breadcrumb">
            <button className="pedido-link-venta" onClick={() => navigate('/dashboard/pedidos')}>Pedidos</button>
            {pedido.ordenid && (
              <>
                {' / '}
                <button className="pedido-link-venta" onClick={() => navigate(`/dashboard/pedidos/${pedido.ordenid}`)}>{pedido.pedidoProveedor ? nombrePedido(pedido.pedidoProveedor) : 'Pedido'}</button>
              </>
            )}
          </div>
        </div>
        <div className="pedido-detalle-acciones">
          {puedeConvertir && (
            <button type="button" className="pedidos-btn pedidos-btn-verde" onClick={abrirEntrega}><ShoppingBag size={14} /><span>Entregar</span></button>
          )}
          {puedeAbonar && (
            <button type="button" className="pedidos-btn pedidos-btn-primary" onClick={() => abrirPago('abono')}><Plus size={14} /><span>Abonar</span></button>
          )}
          <button type="button" className="pedidos-btn pedidos-btn-secundario" onClick={() => setModal('comprobante')}><Receipt size={14} /><span>Comprobante de Compra</span></button>
          <div className="pedido-menu" ref={menuRef}>
            <button
              type="button"
              ref={botonMenuRef}
              className="pedidos-btn pedidos-btn-secundario"
              aria-haspopup="menu"
              aria-expanded={esMovil ? menuMas : menuAbierto}
              onClick={() => (esMovil ? setMenuMas(true) : setMenuAbierto((o) => !o))}
            >
              <MoreHorizontal size={16} aria-hidden="true" />
              <span>Más</span>
            </button>
            {!esMovil && menuAbierto && (
              <div className="pedido-menu-lista" role="menu" aria-label="Acciones de la compra">
                {accionesMas.map((a) => {
                  const Icono = a.icono;
                  return (
                    <button key={a.clave} type="button" role="menuitem" className={`pedido-menu-item${a.peligro ? ' peligro' : ''}`} onClick={() => ejecutarMas(a)}>
                      <Icono size={15} aria-hidden="true" /><span>{a.etiqueta}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <PanelInferior abierto={menuMas} onCerrar={() => setMenuMas(false)} titulo="Compra" subtitulo={`Compra ${pedido.numero}`} nombreAvatar={pedido.cliente?.nombreCliente || 'Compra'}>
        <div className="pi-lista-acciones">
          {accionesMas.map((a) => {
            const Icono = a.icono;
            return (
              <button key={a.clave} type="button" className={`pi-accion${a.peligro ? ' pi-accion-peligro' : ''}`} onClick={() => ejecutarMas(a)}>
                <Icono size={15} /> {a.etiqueta}
              </button>
            );
          })}
        </div>
      </PanelInferior>

      <div className="detalle-tx-summary">
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><User size={11} /> Cliente</div>
          <div className={`detalle-tx-stat-value ${!pedido.cliente ? 'muted' : ''}`}>{pedido.cliente?.nombreCliente || 'Consumidor final'}</div>
          <div className="detalle-tx-stat-sub">
            {pedido.cliente?.telefono ? `${pedido.cliente.telefono} · ` : ''}Entrega: {pedido.fechaEntrega ? formatearFecha(pedido.fechaEntrega) : 'sin fecha'}
          </div>
        </div>
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><ClipboardList size={11} /> Total</div>
          <div className="detalle-tx-stat-value amount income">{formatoMoneda(pedido.total)}</div>
          <div className="detalle-tx-stat-sub">{totalItems} {totalItems === 1 ? 'unidad' : 'unidades'}</div>
        </div>
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><Wallet size={11} /> Abonado</div>
          <div className="detalle-tx-stat-value">{formatoMoneda(resumen.abonado)}</div>
        </div>
        <div className={`detalle-tx-stat ${resumen.saldo > 0 && !anulada ? 'detalle-tx-stat-alerta' : ''}`}>
          <div className="detalle-tx-stat-label"><Hash size={11} /> Saldo por cobrar</div>
          <div className={`detalle-tx-stat-value amount ${resumen.saldo > 0 && !anulada ? 'expense' : ''}`}>
            {anulada ? '—' : resumen.saldo > 0 ? formatoMoneda(resumen.saldo) : 'Pagado'}
          </div>
          {aFavor > 0.009 && !anulada && <div className="detalle-tx-stat-sub">A favor del cliente: {formatoMoneda(aFavor)}</div>}
        </div>
      </div>

      {pedido.descripcion && (
        <div className="compras-nota-bloque"><FileText size={14} /><span>{pedido.descripcion}</span></div>
      )}

      <div className="mod-seccion">
        <span className="mod-seccion-icono"><Package size={16} /></span>
        <div className="mod-seccion-textos">
          <h2>Productos <span className="mod-count-badge">{(pedido.detalles || []).length}</span></h2>
        </div>
        <div className="mod-seccion-chips">
          <span className="tbl-badge tbl-badge--neutral">Entregado {formatoMoneda(resumen.entregado)}</span>
          {resumen.porEntregar > 0 && !anulada && <span className="tbl-badge tbl-badge--warning">Por entregar {formatoMoneda(resumen.porEntregar)}</span>}
        </div>
      </div>

      <div className="compras-cliente">
        <div className="compras-cliente-lineas">
          <div className="compras-cliente-linea compras-cliente-linea-cabecera" aria-hidden="true">
            <span>Producto</span><span>Pidió</span><span>Llegó</span><span>Entregado</span><span>Situación</span><span />
          </div>
          {(pedido.detalles || []).map((d) => {
            const devs = devolucionesPorLinea.get(d.detalleid) || [];
            const devuelta = devs.reduce((acc, dev) => acc + Number(dev.cantidad), 0);
            const pidio = Math.round((Number(d.cantidad) + devuelta) * 1000) / 1000;
            const situacion = situacionDe(d, devuelta);
            const unidad = d.producto?.unidadMedida;
            return (
              <div key={d.detalleid} className="compras-cliente-linea">
                <span className="compras-cliente-producto">
                  <span className="compras-producto-miniatura" aria-hidden="true">
                    <Package size={15} />
                    {d.producto?.imagenes?.[0] && (
                      <img src={imagenUrl(d.producto.imagenes[0])} alt="" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    )}
                  </span>
                  <span className="compras-producto-info">
                    <span className="compras-producto-nombre">
                      {d.productoNombre}
                      {d.talla && <span className="cart-item-talla" style={{ marginLeft: '0.4rem' }}>Talla {d.talla}</span>}
                    </span>
                    <span className="compras-producto-meta">{formatoMoneda(d.precioUnitario)} c/u · {formatoMoneda(d.subtotal)}</span>
                    {devs.map((dev) => (
                      <span key={dev.devolucionid} className="compras-producto-devolucion">
                        <Undo2 size={11} />
                        Devolución de {formatearCantidad(dev.cantidad, unidad)}: {etiquetaMotivo(dev.motivo)}
                        {dev.nota ? ` · ${dev.nota}` : ''}
                        {!dev.reingresaStock ? ' · No volvió al inventario' : ''}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="compras-cliente-cifra" data-etiqueta="Pidió"><strong>{formatearCantidad(pidio, unidad)}</strong></span>
                <span className="compras-cliente-cifra" data-etiqueta="Llegó"><strong>{pedidoAbierto ? '—' : formatearCantidad(Math.min(Number(d.recibidoCompra || 0), pidio), unidad)}</strong></span>
                <span className="compras-cliente-cifra" data-etiqueta="Entregado"><strong>{formatearCantidad(d.cantidadEntregada || 0, unidad)}</strong></span>
                <span className="compras-reparto-estado">
                  <span className={`compras-situacion compras-situacion-${situacion.clase}`}>{situacion.texto}</span>
                  {devuelta > 0 && situacion.clase !== 'devolucion' && (
                    <span className="compras-situacion compras-situacion-devolucion">Devolución · {formatearCantidad(devuelta, unidad)}</span>
                  )}
                </span>
                <span className="compras-reparto-accion">
                  {!anulada && Number(d.cantidadEntregada) > 0 && (
                    <button type="button" className="pedidos-btn pedidos-btn-secundario pedidos-btn-sm" title="El cliente devuelve este producto" onClick={() => abrirDevolucion(d.detalleid)}>
                      <Undo2 size={13} /><span>Devolución</span>
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        {(pedido.ventas || []).length > 0 && (
          <div className="pedido-entregas-fila">
            <span>Entregas realizadas</span>
            {pedido.ventas.map((venta) => (
              <button key={venta.ventaid} type="button" className="pedido-link-venta" onClick={() => navigate(`/dashboard/venta/${venta.ventaid}`)}>
                Venta #{venta.ventaid} · {formatoMoneda(venta.total)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mod-seccion">
        <span className="mod-seccion-icono"><Wallet size={16} /></span>
        <div className="mod-seccion-textos">
          <h2>Abonos y recibos <span className="mod-count-badge">{(pedido.pagos || []).length}</span></h2>
        </div>
      </div>
      {(pedido.pagos || []).length === 0 ? (
        <p className="pedido-pagos-vacio">Aún no hay abonos registrados.</p>
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
                      <button type="button" className="pedidos-btn pedidos-btn-secundario pedidos-btn-sm" onClick={() => setModal(`recibo/${pago.pagoid}`)} title="Ver, imprimir o enviar el recibo" aria-label={`Recibo ${pago.pagoid}`}>
                        <Receipt size={13} /><span>Recibo</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      </>)}

      {modal === 'editar' && (
        <div className="pedido-pagina">
          <EncabezadoPagina onVolver={volver} migas={<>Pedidos / Compra {pedido.numero}</>}>Editar pedido</EncabezadoPagina>
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
          <EncabezadoPagina onVolver={volver} migas={<>Pedidos / Compra {pedido.numero}</>}>{pagoForm.tipo === 'abono' ? 'Registrar abono' : 'Devolver dinero al cliente'}</EncabezadoPagina>
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
          <EncabezadoPagina onVolver={volver} migas={<>Pedidos / Compra {pedido.numero}</>}>Entregar productos</EncabezadoPagina>
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
          <EncabezadoPagina onVolver={volver} migas={<>Pedidos / Compra {pedido.numero}</>}>Devolución de productos</EncabezadoPagina>
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
          <EncabezadoPagina onVolver={volver} migas={<>Pedidos / Compra {pedido.numero}</>}>Anular compra {pedido.numero}</EncabezadoPagina>
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
