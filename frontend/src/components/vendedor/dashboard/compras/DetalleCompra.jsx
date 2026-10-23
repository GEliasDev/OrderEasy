import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Eye, Hash, MoreHorizontal, Package, PackageCheck, Pencil, Plus, Send, Trash2, FileText, Truck, Undo2, User, Users, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { imagenUrl } from '../../../../config';
import {
  actualizarPedidoProveedor,
  anularOrdenCompra,
  eliminarPedidoProveedor,
  asignarComprasPedido,
  enviarPedidoProveedor,
  getOrdenCompra,
  getPedidos,
  previewPedidoProveedor,
  quitarStockPedido,
  recibirOrdenCompra,
} from '../../../../services/pedidoService';
import { getProveedores } from '../../../../services/proveedorService';
import {
  ESTADOS_COMPRA,
  asignacionActiva,
  etiquetaTalla,
  formatearFecha,
  formatoMoneda,
  nombrePedido,
  pendienteAsignacion,
  repartoSugerido,
  restanteDetalle,
} from './comprasUtils';
import '../balance/vistas/styles/DetalleTransaccion.css';
import '../pedidos/Pedidos.css';
import { useEsMovil } from '../../../../hooks/useEsMovil';
import ListaMovil from '../../../comunes/ListaMovil';
import PanelInferior, { DatoPanel } from '../../../comunes/PanelInferior';
import EncabezadoPagina from '../../../comunes/EncabezadoPagina';
import { deletePedido } from '../../../../services/pedidoService';
import './Compras.css';

const num = (valor) => Number(valor) || 0;
const redondear = (n) => Math.round(n * 1000) / 1000;
const cantidad = (n) => num(n).toLocaleString('es-CO', { maximumFractionDigits: 3 });

const AVATAR_COLORS = ['#3B82F6','#8B5CF6','#EC4899','#F59E0B','#10B981','#06B6D4','#EF4444','#6366F1'];
const colorAvatar = (name) => AVATAR_COLORS[(name?.charCodeAt(0) || 65) % AVATAR_COLORS.length];
const iniciales = (name) => {
  const parts = (name || '?').trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (name || '?').slice(0, 2).toUpperCase();
};

const BADGE_ESTADO_CLIENTE = {
  pendiente: 'tbl-badge--warning',
  confirmado: 'tbl-badge--primary',
  en_compra: 'tbl-badge--primary',
  recibido: 'tbl-badge--ok',
  entregado: 'tbl-badge--ok',
  anulado: 'tbl-badge--neutral',
};

const ESTADOS_COMPRA_CLIENTE = {
  pendiente: 'Pendiente',
  confirmado: 'En el pedido',
  en_compra: 'En compra',
  recibido: 'Recibida',
  entregado: 'Entregada',
  anulado: 'Anulada',
};

// Resumen corto de lo que compró el cliente: "2× Camille · 38, 1× Linda · 39"
const resumenProductos = (compra) => (compra.detalles || [])
  .map((d) => `${cantidad(d.cantidad)}× ${d.productoNombre}${d.talla ? ` · ${d.talla}` : ''}`)
  .join(', ');

const miniaturaProducto = (ruta) => (
  <span className="compras-producto-miniatura" aria-hidden="true">
    <Package size={15} />
    {ruta && (
      <img
        src={imagenUrl(ruta)}
        alt=""
        loading="lazy"
        decoding="async"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    )}
  </span>
);

// En qué punto va lo que un cliente pidió de un producto: esperando al proveedor, llegó, entregado...
const situacionDe = (asignacion) => {
  if (!asignacionActiva(asignacion)) return { texto: 'Compra cancelada', clase: 'cancelado' };
  const recibido = num(asignacion.cantidadRecibida);
  const entregado = num(asignacion.pedidoDetalle?.cantidadEntregada) >= num(asignacion.pedidoDetalle?.cantidad);
  if (entregado) return { texto: 'Entregado', clase: 'entregado' };
  if (recibido >= num(asignacion.cantidad)) return { texto: 'Listo para entregar', clase: 'listo' };
  if (recibido > 0) return { texto: 'Llegó parte', clase: 'parcial' };
  return { texto: 'Esperando al proveedor', clase: 'espera' };
};

// Desglose de productos de una compra de cliente, con una miniatura de cada producto
const desgloseProductos = (compra) => (
  <div className="compras-productos-desglose">
    {(compra.detalles || []).map((d) => {
      const ruta = d.producto?.imagenes?.[0];
      return (
        <div className="compras-producto-linea" key={d.detalleid}>
          <span className="compras-producto-miniatura" aria-hidden="true">
            <Package size={15} />
            {ruta && (
              <img
                src={imagenUrl(ruta)}
                alt=""
                loading="lazy"
                decoding="async"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
          </span>
          <span className="compras-producto-info">
            <span className="compras-producto-nombre">{d.productoNombre}</span>
            <span className="compras-producto-meta">
              {cantidad(d.cantidad)} × {d.talla ? `Talla ${d.talla}` : 'Sin talla'}
            </span>
          </span>
        </div>
      );
    })}
  </div>
);

// Pantallas de formulario del pedido (antes ventanas emergentes): cada una es una ruta /dashboard/pedidos/:id/<vista>
const VISTAS = ['nombre', 'existentes', 'enviar', 'recibir'];

// Pedido al proveedor: contiene las compras de los clientes (con sus abonos y entregas) y los productos para stock
function DetalleCompra() {
  const esMovil = useEsMovil();
  const [compraSel, setCompraSel] = useState(null);
  const [lineaSel, setLineaSel] = useState(null);
  const { id, vista } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const modal = VISTAS.includes(vista) ? vista : null;
  const sinNavegar = useRef(false);
  const rutaBase = `/dashboard/pedidos/${id}`;
  // Abre una pantalla de formulario; `desde` permite volver con la flecha del navegador sin dejar historial de sobra
  const setModal = useCallback((destino) => {
    if (sinNavegar.current) return;
    if (destino) navigate(`${rutaBase}/${destino}`, { state: { desde: true } });
    else if (location.state?.desde) navigate(-1);
    else navigate(rutaBase, { replace: true });
  }, [navigate, rutaBase, location.state]);
  const volver = () => setModal(null);
  const [masAbierto, setMasAbierto] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [orden, setOrden] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nombreEdicion, setNombreEdicion] = useState('');
  const [recepcion, setRecepcion] = useState({}); // detalleid -> { llegaron, reparto: { asignacionid: cantidad } }
  const [guardando, setGuardando] = useState(false);
  const [proveedores, setProveedores] = useState([]);
  const [preview, setPreview] = useState(null);
  const [sueltas, setSueltas] = useState([]);
  const [marcadas, setMarcadas] = useState(() => new Set());

  const cargar = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setLoading(true);
      setOrden(await getOrdenCompra(id));
    } catch {
      toast.error('No se pudo cargar el pedido.');
      navigate('/dashboard/pedidos');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    getProveedores().then((data) => { if (Array.isArray(data)) setProveedores(data); }).catch(() => {});
  }, []);

  const abrirRecepcion = useCallback((ordenActual) => {
    const inicial = {};
    for (const detalle of ordenActual.detalles || []) {
      const restante = restanteDetalle(detalle);
      if (restante <= 0) continue;
      inicial[detalle.detalleid] = { llegaron: String(restante), reparto: repartoSugerido(detalle, restante) };
    }
    setRecepcion(inicial);
    setModal('recibir');
  }, [setModal]);

  // Desde la ficha de una compra de cliente se llega con ?accion=recibir
  useEffect(() => {
    if (!orden || searchParams.get('accion') !== 'recibir') return;
    setSearchParams({}, { replace: true });
    if (['enviada', 'borrador', 'recibida_parcial'].includes(orden.estado)) abrirRecepcion(orden);
  }, [orden, searchParams, setSearchParams, abrirRecepcion]);

  const cambiarLlegaron = (detalle, valor) => {
    const llegaron = Math.min(Math.max(0, num(valor)), restanteDetalle(detalle));
    setRecepcion((prev) => ({
      ...prev,
      [detalle.detalleid]: { llegaron: valor === '' ? '' : String(llegaron), reparto: repartoSugerido(detalle, llegaron) },
    }));
  };

  const cambiarReparto = (detalleid, asignacionid, valor) => {
    setRecepcion((prev) => ({
      ...prev,
      [detalleid]: { ...prev[detalleid], reparto: { ...prev[detalleid].reparto, [asignacionid]: valor } },
    }));
  };

  // Validación del reparto de cada línea
  const estadoLinea = (detalle) => {
    const datos = recepcion[detalle.detalleid];
    if (!datos) return { llegaron: 0, asignado: 0, error: null, libre: 0 };
    const llegaron = num(datos.llegaron);
    const activas = (detalle.asignaciones || []).filter(asignacionActiva);
    let asignado = 0;
    let error = null;
    for (const asignacion of activas) {
      const cant = num(datos.reparto[asignacion.asignacionid]);
      if (cant < 0) error = 'Hay cantidades negativas.';
      if (cant > pendienteAsignacion(asignacion) + 0.0005) error = 'Asignaste más de lo que pidió un cliente.';
      asignado = redondear(asignado + cant);
    }
    if (asignado > llegaron + 0.0005) error = 'Asignaste más de lo que llegó.';
    return { llegaron, asignado, error, libre: redondear(Math.max(0, llegaron - asignado)) };
  };

  const confirmarRecepcion = async (e) => {
    e.preventDefault();
    const items = [];
    for (const detalle of orden.detalles) {
      const datos = recepcion[detalle.detalleid];
      if (!datos || num(datos.llegaron) <= 0) continue;
      const linea = estadoLinea(detalle);
      if (linea.error) {
        toast.error(`${detalle.productoNombre}${etiquetaTalla(detalle)}: ${linea.error}`);
        return;
      }
      items.push({
        detalleid: detalle.detalleid,
        cantidad: num(datos.llegaron),
        reparto: (detalle.asignaciones || [])
          .filter(asignacionActiva)
          .map((a) => ({ asignacionid: a.asignacionid, cantidad: num(datos.reparto[a.asignacionid]) }))
          .filter((r) => r.cantidad > 0),
      });
    }
    if (items.length === 0) {
      toast.error('Indica cuánto llegó de al menos una línea.');
      return;
    }
    try {
      setGuardando(true);
      await recibirOrdenCompra(orden.ordenid, items);
      setModal(null);
      toast.success('Recepción registrada: el stock y el reparto por cliente quedaron actualizados.');
      cargar(true);
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo registrar la recepción.');
    } finally {
      setGuardando(false);
    }
  };

  const handleAnular = () => {
    toast(`¿Anular el pedido #${orden.ordenid}?`, {
      description: 'Las compras de los clientes siguen vigentes pero quedan sin pedido.',
      action: {
        label: 'Sí, anular',
        onClick: async () => {
          try {
            await anularOrdenCompra(orden.ordenid);
            toast.success('Pedido anulado.');
            cargar(true);
          } catch (error) {
            toast.error(error?.response?.data?.mensaje || 'No se pudo anular el pedido.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  const guardarNombre = async (e) => {
    e.preventDefault();
    try {
      setGuardando(true);
      setOrden(await actualizarPedidoProveedor(orden.ordenid, { nombre: nombreEdicion }));
      setModal(null);
      toast.success('Nombre actualizado.');
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo cambiar el nombre.');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = () => {
    toast(`¿Eliminar ${nombrePedido(orden)}?`, {
      description: 'Las compras de los clientes no se borran: quedan sueltas con sus abonos. Lo ya recibido en el inventario y los egresos no se revierten.',
      action: {
        label: 'Sí, eliminar',
        onClick: async () => {
          try {
            await eliminarPedidoProveedor(orden.ordenid);
            toast.success('Pedido eliminado.');
            navigate('/dashboard/pedidos');
          } catch (error) {
            toast.error(error?.response?.data?.mensaje || 'No se pudo eliminar el pedido.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  const eliminarCompra = (compra) => {
    toast(`¿Eliminar la compra de ${compra.cliente?.nombreCliente || 'este cliente'}?`, {
      description: 'Se borran la compra y sus abonos. Las ventas de entregas ya hechas se conservan. No se puede deshacer.',
      action: {
        label: 'Sí, eliminar',
        onClick: async () => {
          try {
            await deletePedido(compra.pedidoid);
            toast.success('Compra eliminada.');
            cargar(true);
          } catch (error) {
            toast.error(error?.response?.data?.mensaje || 'No se pudo eliminar la compra.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  const cambiarProveedor = async (valor) => {
    try {
      setOrden(await actualizarPedidoProveedor(orden.ordenid, { proveedorid: valor || null }));
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo cambiar el proveedor.');
    }
  };

  const quitarStock = async (detalle) => {
    try {
      setOrden(await quitarStockPedido(orden.ordenid, detalle.detalleid));
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo quitar la línea.');
    }
  };

  // ── Compras de clientes que ya existían ──
  const abrirExistentes = async () => {
    setMarcadas(new Set());
    setModal('existentes');
    try {
      const data = await getPedidos();
      setSueltas((Array.isArray(data) ? data : []).filter((p) => !p.ordenid && ['pendiente', 'confirmado'].includes(p.estado)));
    } catch {
      toast.error('No se pudieron cargar las compras.');
    }
  };

  const agregarExistentes = async () => {
    if (marcadas.size === 0) return toast.error('Marca al menos una compra.');
    try {
      setGuardando(true);
      setOrden(await asignarComprasPedido(orden.ordenid, [...marcadas]));
      setModal(null);
      toast.success('Compras agregadas al pedido.');
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudieron agregar las compras.');
    } finally {
      setGuardando(false);
    }
  };

  // ── Enviar al proveedor ──
  const abrirEnviar = async () => {
    setPreview(null);
    setModal('enviar');
    try {
      setPreview(await previewPedidoProveedor(orden.ordenid));
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo calcular el pedido.');
      setModal(null);
    }
  };

  // Líneas de la vista previa: lo de clientes + lo de stock, por producto y talla
  const lineasEnvio = useMemo(() => {
    if (!preview || !orden) return [];
    const mapa = new Map();
    const clave = (productoid, varianteid) => `${productoid}:${varianteid || ''}`;
    for (const g of preview.grupos) {
      mapa.set(clave(g.productoid, g.varianteid), {
        key: g.key, nombre: g.productoNombre, talla: g.talla, imagen: g.imagen, precio: g.precioCompra, clientes: g.lineas.filter((l) => l.faltante > 0), cubiertos: g.lineas.filter((l) => l.cubiertoStock > 0), delCliente: g.totalFaltante, deStock: 0,
      });
    }
    for (const d of orden.detalles || []) {
      const k = clave(d.productoid, d.varianteid);
      const actual = mapa.get(k) || { key: k, nombre: d.productoNombre, talla: d.talla, imagen: d.producto?.imagenes?.[0] || null, precio: num(d.precioUnitario), clientes: [], cubiertos: [], delCliente: 0, deStock: 0 };
      actual.deStock += num(d.cantidad);
      mapa.set(k, actual);
    }
    return [...mapa.values()];
  }, [preview, orden]);

  const costoEnvio = lineasEnvio.reduce((s, l) => s + (l.delCliente + l.deStock) * l.precio, 0);

  const confirmarEnvio = async () => {
    try {
      setGuardando(true);
      setOrden(await enviarPedidoProveedor(orden.ordenid));
      setModal(null);
      toast.success('Pedido enviado al proveedor. Cuando llegue la mercancía registra la recepción.');
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo enviar el pedido.');
    } finally {
      setGuardando(false);
    }
  };

  useEffect(() => {
    if (!orden || !modal || location.state?.desde) return;
    sinNavegar.current = true;
    if (modal === 'nombre') setNombreEdicion(orden.nombre || '');
    if (modal === 'existentes') abrirExistentes();
    if (modal === 'enviar') abrirEnviar();
    if (modal === 'recibir') abrirRecepcion(orden);
    sinNavegar.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orden?.ordenid, modal]);

  if (loading) return <div className="view-loading"><div className="loader-spinner-dark" /></div>;
  if (!orden) return null;

  const estado = ESTADOS_COMPRA[orden.estado] || { label: orden.estado, clase: 'anulado' };
  const detalles = orden.detalles || [];
  const compras = orden.compras || [];
  const abierto = orden.estado === 'abierta';
  const pedidos = detalles.reduce((s, d) => s + num(d.cantidad), 0);
  const recibidos = detalles.reduce((s, d) => s + num(d.cantidadRecibida), 0);
  const puedeRecibir = ['borrador', 'enviada', 'recibida_parcial'].includes(orden.estado) && recibidos < pedidos;
  const puedeAnular = !['recibida', 'anulada'].includes(orden.estado);
  const puedeCambiarProveedor = !['recibida', 'anulada'].includes(orden.estado);
  const resumen = orden.resumenCompras || { cantidad: 0, total: 0, abonado: 0, saldo: 0 };

  // Lo pedido al proveedor, repartido por compra de cliente; lo que no tiene cliente va al stock
  const lineasPorCompra = new Map();
  const lineasStock = [];
  for (const detalle of detalles) {
    const activas = (detalle.asignaciones || []).filter(asignacionActiva);
    for (const asignacion of detalle.asignaciones || []) {
      const compraid = asignacion.pedidoDetalle?.pedido?.pedidoid;
      if (!compraid) continue;
      if (!lineasPorCompra.has(compraid)) lineasPorCompra.set(compraid, []);
      lineasPorCompra.get(compraid).push({ detalle, asignacion });
    }
    const paraStock = redondear(num(detalle.cantidad) - activas.reduce((s, a) => s + num(a.cantidad), 0));
    if (paraStock > 0) lineasStock.push({ detalle, cantidad: paraStock });
  }

  return (
    <div className="detalle-tx-view detalle-ancho">
      {!modal && (<>
      <div className="detalle-tx-header">
        <button className="btn-circle-back" onClick={() => navigate('/dashboard/pedidos')}>
          <ArrowLeft size={18} />
        </button>
        <div className="detalle-tx-header-text">
          <div className="pedido-titulo-linea">
            <h1>{nombrePedido(orden)}</h1>
            {!['recibida', 'anulada'].includes(orden.estado) && (
              <button className="pedido-modal-close" title="Cambiar nombre" onClick={() => { setNombreEdicion(orden.nombre || ''); setModal('nombre'); }}>
                <Pencil size={14} />
              </button>
            )}
            <span className={`pedido-estado pedido-estado-${estado.clase}`}>{estado.label}</span>
          </div>
          <div className="detalle-tx-breadcrumb">Pedidos / <span className="active">{orden.nombre ? `${orden.nombre} · #${orden.ordenid}` : `Pedido #${orden.ordenid}`}</span></div>
        </div>
        {esMovil ? (
          <div className="pedido-detalle-acciones pedido-acciones-compactas">
            {abierto && (
              <>
                <button className="pedidos-btn pedidos-btn-primary" onClick={() => navigate(`/dashboard/nuevo-pedido?pedido=${orden.ordenid}`)}>
                  <Plus size={14} /><span>Crear compra</span>
                </button>
                <button className="pedidos-btn pedidos-btn-verde" onClick={abrirEnviar} disabled={compras.length === 0 && detalles.length === 0}>
                  <Send size={14} /><span>Enviar</span>
                </button>
              </>
            )}
            {puedeRecibir && (
              <button className="pedidos-btn pedidos-btn-verde" onClick={() => abrirRecepcion(orden)}>
                <PackageCheck size={14} /><span>Registrar recepción</span>
              </button>
            )}
            <button className="pedidos-btn pedidos-btn-secundario pedido-btn-mas" onClick={() => setMasAbierto(true)} aria-label="Más acciones">
              <MoreHorizontal size={16} />
            </button>
          </div>
        ) : (
        <div className="pedido-detalle-acciones">
          {abierto && (
            <>
              <button className="pedidos-btn pedidos-btn-secundario" onClick={() => navigate(`/dashboard/nuevo-pedido?pedido=${orden.ordenid}&tipo=stock`)}>
                <Plus size={14} /><span>Para stock</span>
              </button>
              <button className="pedidos-btn pedidos-btn-secundario" onClick={abrirExistentes}>
                <Users size={14} /><span>Agregar compra existente</span>
              </button>
              <button className="pedidos-btn pedidos-btn-primary" onClick={() => navigate(`/dashboard/nuevo-pedido?pedido=${orden.ordenid}`)}>
                <Plus size={14} /><span>Crear compra</span>
              </button>
              <button className="pedidos-btn pedidos-btn-verde" onClick={abrirEnviar} disabled={compras.length === 0 && detalles.length === 0}>
                <Send size={14} /><span>Enviar al proveedor</span>
              </button>
            </>
          )}
          {puedeRecibir && (
            <button className="pedidos-btn pedidos-btn-verde" onClick={() => abrirRecepcion(orden)}>
              <PackageCheck size={14} /><span>Registrar recepción</span>
            </button>
          )}
          {puedeAnular && (
            <button className="pedidos-btn pedidos-btn-secundario" onClick={handleAnular}>
              <XCircle size={14} /><span>Anular</span>
            </button>
          )}
          <button className="pedidos-btn pedidos-btn-peligro" onClick={handleEliminar}>
            <Trash2 size={14} /><span>Eliminar</span>
          </button>
        </div>
        )}
      </div>

      <div className="detalle-tx-summary">
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><Truck size={11} /> Costo al proveedor</div>
          <div className="detalle-tx-stat-value amount expense">{formatoMoneda(abierto ? orden.costoEstimado : orden.total)}</div>
        </div>
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><User size={11} /> Proveedor</div>
          {puedeCambiarProveedor ? (
            <select className="pedidos-select compras-select-proveedor" value={orden.proveedorid || ''} onChange={(e) => cambiarProveedor(e.target.value)}>
              <option value="">Sin proveedor</option>
              {proveedores.map((p) => <option key={p.proveedorid} value={p.proveedorid}>{p.nombreProveedor || p.razonSocial}</option>)}
            </select>
          ) : (
            <div className={`detalle-tx-stat-value ${!orden.proveedor ? 'muted' : ''}`}>
              {orden.proveedor?.nombreProveedor || orden.proveedor?.razonSocial || 'Sin proveedor'}
            </div>
          )}
        </div>
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><Calendar size={11} /> Fecha</div>
          <div className="detalle-tx-stat-value">{formatearFecha(orden.createdAt)}</div>
        </div>
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><Hash size={11} /> Recibido</div>
          <div className="detalle-tx-stat-value">{abierto ? '—' : `${cantidad(recibidos)} / ${cantidad(pedidos)}`}</div>
          {!abierto && pedidos > 0 && (
            <div className={`compras-barra compras-barra-mini${recibidos < pedidos ? ' compras-barra-parcial' : ''}`}><div style={{ width: `${Math.min(100, (recibidos / pedidos) * 100)}%` }} /></div>
          )}
        </div>
        {resumen.cantidad > 0 && (
          <div className="detalle-tx-stat">
            <div className="detalle-tx-stat-label"><Users size={11} /> Por cobrar a clientes</div>
            <div className={`detalle-tx-stat-value amount ${resumen.saldo > 0 ? 'expense' : 'income'}`}>{resumen.saldo > 0 ? formatoMoneda(resumen.saldo) : 'Al día'}</div>
          </div>
        )}
      </div>

      {orden.descripcion && (
        <div className="compras-nota-bloque"><FileText size={14} /><span>{orden.descripcion}</span></div>
      )}

      {abierto && (<>
      <div className="mod-seccion">
        <span className="mod-seccion-icono"><Users size={16} /></span>
        <div className="mod-seccion-textos">
          <h2>Compras de clientes <span className="mod-count-badge">{resumen.cantidad}</span></h2>
          <p>
            {abierto
              ? 'Agrega las compras de tus clientes. Dentro de cada una registras sus abonos, pagos y entregas, y puedes editar sus productos mientras el pedido no se haya enviado.'
              : 'Abre una compra para ver y registrar sus abonos, pagos y entrega.'}
          </p>
        </div>
        {resumen.cantidad > 0 && (
          <div className="mod-seccion-chips">
            <span className="tbl-badge tbl-badge--ok">Abonado {formatoMoneda(resumen.abonado)}</span>
            <span className={`tbl-badge ${resumen.saldo > 0 ? 'tbl-badge--danger' : 'tbl-badge--neutral'}`}>Por cobrar {formatoMoneda(resumen.saldo)}</span>
          </div>
        )}
      </div>

      {compras.length === 0 ? (
        <div className="pedido-ordenes-vacio">
          <Users size={32} />
          <p>Este pedido todavía no tiene compras de clientes.</p>
        </div>
      ) : (
        esMovil ? (
          <ListaMovil
            items={compras}
            clave={(c) => c.pedidoid}
            letras={false}
            onAbrir={setCompraSel}
            fila={(c) => {
              const saldo = Number(c.resumen?.saldo || 0);
              const anulada = c.estado === 'anulado';
              return {
                nombre: c.cliente?.nombreCliente,
                titulo: c.cliente?.nombreCliente || 'Sin cliente',
                subtitulo: resumenProductos(c),
                derecha: anulada ? undefined : (saldo > 0 ? formatoMoneda(saldo) : 'Pagado'),
                derechaSecundaria: anulada ? undefined : (saldo > 0 ? 'por cobrar' : undefined),
                insignia: anulada ? 'Anulada' : undefined,
                tono: anulada ? 'peligro' : (saldo > 0 ? 'peligro' : 'ok'),
              };
            }}
          />
        ) : (
        <div className="items-table-container">
          <table className="tabla-tarjetas items-table compras-tabla">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="col-num">Total</th>
                <th className="col-num">Abonado</th>
                <th className="col-num">Saldo</th>
                <th className="col-centro">Estado</th>
                <th className="col-num"></th>
              </tr>
            </thead>
            <tbody>
              {compras.map((compra) => {
                const anulada = compra.estado === 'anulado';
                const estadoCompra = compra.estado || 'pendiente';
                const badgeClase = BADGE_ESTADO_CLIENTE[estadoCompra] || 'tbl-badge--neutral';
                const clienteNombre = compra.cliente?.nombreCliente || 'Sin cliente';
                const saldo = Number(compra.resumen?.saldo || 0);
                return (
                  <tr key={compra.pedidoid} className={`compras-fila-link ${anulada ? 'compras-fila-cancelada' : ''}`} onClick={() => navigate(`/dashboard/pedido/${compra.pedidoid}`)}>
                    <td className="compras-compra" data-label="Cliente">
                      <div className="tbl-main-cell">
                        <span className="tbl-avatar" style={{ background: colorAvatar(clienteNombre), opacity: anulada ? 0.5 : 1 }}>{iniciales(clienteNombre)}</span>
                        <span className="tbl-cell-primary">{clienteNombre}</span>
                      </div>
                      {desgloseProductos(compra)}
                    </td>
                    <td className="col-num" data-label="Total">{formatoMoneda(compra.total)}</td>
                    <td className="col-num" data-label="Abonado">{formatoMoneda(compra.resumen?.abonado)}</td>
                    <td className="col-num" data-label="Saldo">
                      {anulada ? <span className="tbl-vacio">—</span>
                        : saldo > 0
                          ? <span className="tbl-badge tbl-badge--danger">{formatoMoneda(saldo)}</span>
                          : <span className="tbl-badge tbl-badge--ok">Pagado</span>}
                    </td>
                    <td className="col-centro" data-label="Estado">
                      <span className={`tbl-badge ${badgeClase}`}>{ESTADOS_COMPRA_CLIENTE[estadoCompra] || estadoCompra}</span>
                    </td>
                    <td className="col-num" data-label="" onClick={(e) => e.stopPropagation()}>
                      <div className="tbl-actions">
                        {!anulada && saldo > 0 && (
                          <button className="tbl-icon-btn tbl-icon-btn--ok" title="Registrar abono" style={{ background: '#DCFCE7', color: '#15803D' }} onClick={() => navigate(`/dashboard/pedido/${compra.pedidoid}?accion=abono`)}>
                            <Plus size={14} />
                          </button>
                        )}
                        <button className="tbl-icon-btn tbl-icon-btn--ver" title="Ver detalle" onClick={() => navigate(`/dashboard/pedido/${compra.pedidoid}`)}>
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )
      )}
      </>)}

      {abierto ? (
        <>
          <div className="mod-seccion">
            <span className="mod-seccion-icono"><Package size={16} /></span>
            <div className="mod-seccion-textos">
              <h2>Productos para stock <span className="mod-count-badge">{detalles.length}</span></h2>
              <p>Pares extra que pides sin cliente asignado: al recibirlos suben directo al inventario.</p>
            </div>
          </div>
          {detalles.length === 0 ? (
            <div className="pedido-ordenes-vacio"><p>No hay productos para stock en este pedido.</p></div>
          ) : (
            esMovil ? (
              <ListaMovil
                items={detalles}
                clave={(d) => d.detalleid}
                onAbrir={setLineaSel}
                fila={(d) => ({
                  nombre: d.productoNombre,
                  titulo: d.productoNombre,
                  subtitulo: d.talla ? `Talla ${d.talla}` : 'Sin talla',
                  derecha: `${cantidad(d.cantidad)} und`,
                  derechaSecundaria: formatoMoneda(d.subtotal),
                })}
              />
            ) : (
            <div className="items-table-container">
              <table className="tabla-tarjetas items-table compras-tabla">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="col-centro">Talla</th>
                    <th className="col-centro">Cantidad</th>
                    <th className="col-num">Costo</th>
                    <th className="col-num" />
                  </tr>
                </thead>
                <tbody>
                  {detalles.map((d) => (
                    <tr key={d.detalleid}>
                      <td className="col-nombre">{d.productoNombre}</td>
                      <td className="col-centro">{d.talla || '—'}</td>
                      <td className="col-centro">{cantidad(d.cantidad)}</td>
                      <td className="col-num">{formatoMoneda(d.subtotal)}</td>
                      <td className="col-num">
                        <button className="pedidos-btn pedidos-btn-peligro pedidos-btn-sm" onClick={() => quitarStock(d)} title="Quitar">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )
          )}
        </>
      ) : (
        <>
          <div className="mod-seccion">
            <span className="mod-seccion-icono"><Users size={16} /></span>
            <div className="mod-seccion-textos">
              <h2>Clientes y lo pedido al proveedor <span className="mod-count-badge">{resumen.cantidad}</span></h2>
              <p>Cada compra de cliente con sus productos: lo que pediste al proveedor, cuánto ha llegado y qué ya puedes entregar. Lo que no tiene cliente va al stock. Al registrar la recepción eliges a quién corresponde lo que llegó.</p>
            </div>
            <div className="mod-seccion-chips">
              {pedidos > 0 && (
                <span className={`tbl-badge ${recibidos >= pedidos ? 'tbl-badge--ok' : recibidos > 0 ? 'tbl-badge--warning' : 'tbl-badge--neutral'}`}>
                  Recibido {cantidad(recibidos)} / {cantidad(pedidos)}
                </span>
              )}
              {resumen.cantidad > 0 && (
                <>
                  <span className="tbl-badge tbl-badge--ok">Abonado {formatoMoneda(resumen.abonado)}</span>
                  <span className={`tbl-badge ${resumen.saldo > 0 ? 'tbl-badge--danger' : 'tbl-badge--neutral'}`}>Por cobrar {formatoMoneda(resumen.saldo)}</span>
                </>
              )}
            </div>
          </div>

          {compras.length === 0 && lineasStock.length === 0 && (
            <div className="pedido-ordenes-vacio">
              <Users size={32} />
              <p>Este pedido no tiene compras de clientes ni productos.</p>
            </div>
          )}

          {compras.map((compra) => {
            const anulada = compra.estado === 'anulado';
            const estadoCompra = compra.estado || 'pendiente';
            const clienteNombre = compra.cliente?.nombreCliente || 'Sin cliente';
            const saldo = Number(compra.resumen?.saldo || 0);
            const lineas = lineasPorCompra.get(compra.pedidoid) || [];
            return (
              <div key={compra.pedidoid} className={`compras-cliente${anulada ? ' compras-cliente-anulada' : ''}`}>
                <div className="compras-cliente-cabecera">
                  <div className="tbl-main-cell compras-cliente-id">
                    <span className="tbl-avatar" style={{ background: colorAvatar(clienteNombre), opacity: anulada ? 0.5 : 1 }}>{iniciales(clienteNombre)}</span>
                    <div className="tbl-cell-texts">
                      <button type="button" className="pedido-link-venta compras-cliente-nombre" onClick={() => navigate(`/dashboard/pedido/${compra.pedidoid}`)}>{clienteNombre}</button>
                      <span className="tbl-cell-secondary">
                        Compra #{compra.pedidoid} · <span className={`tbl-badge ${BADGE_ESTADO_CLIENTE[estadoCompra] || 'tbl-badge--neutral'}`}>{ESTADOS_COMPRA_CLIENTE[estadoCompra] || estadoCompra}</span>
                      </span>
                    </div>
                  </div>
                  <div className="compras-cliente-dinero">
                    <span><small>Total</small><strong>{formatoMoneda(compra.total)}</strong></span>
                    <span><small>Abonado</small><strong>{formatoMoneda(compra.resumen?.abonado)}</strong></span>
                    <span><small>Saldo</small>
                      {anulada ? <strong className="tbl-vacio">—</strong>
                        : saldo > 0 ? <strong className="compras-saldo-pendiente">{formatoMoneda(saldo)}</strong>
                          : <span className="tbl-badge tbl-badge--ok">Pagado</span>}
                    </span>
                  </div>
                  <div className="tbl-actions">
                    {!anulada && saldo > 0 && (
                      <button className="pedidos-btn pedidos-btn-secundario pedidos-btn-sm" onClick={() => navigate(`/dashboard/pedido/${compra.pedidoid}?accion=abono`)}>
                        <Plus size={13} /><span>Abonar</span>
                      </button>
                    )}
                    <button className="pedidos-btn pedidos-btn-secundario pedidos-btn-sm" onClick={() => navigate(`/dashboard/pedido/${compra.pedidoid}`)}>
                      <Eye size={13} /><span>Detalle</span>
                    </button>
                  </div>
                </div>

                {lineas.length === 0 ? (
                  <div className="compras-cliente-lineas">{desgloseProductos(compra)}</div>
                ) : (
                  <div className="compras-cliente-lineas">
                    <div className="compras-cliente-linea compras-cliente-linea-cabecera" aria-hidden="true">
                      <span>Producto</span><span>Asignado</span><span>Recibido</span><span>Situación</span><span />
                    </div>
                    {lineas.map(({ detalle, asignacion }) => {
                      const activa = asignacionActiva(asignacion);
                      const recibido = num(asignacion.cantidad) > 0 ? num(asignacion.cantidadRecibida) : 0;
                      const entregada = num(asignacion.pedidoDetalle?.cantidadEntregada);
                      const situacion = situacionDe(asignacion);
                      return (
                        <div key={asignacion.asignacionid} className={`compras-cliente-linea${!activa ? ' compras-reparto-cancelada' : ''}`}>
                          <span className="compras-cliente-producto">
                            {miniaturaProducto(detalle.producto?.imagenes?.[0])}
                            <span className="compras-producto-info">
                              <span className="compras-producto-nombre">
                                {detalle.productoNombre}
                                {detalle.talla && <span className="cart-item-talla" style={{ marginLeft: '0.4rem' }}>Talla {detalle.talla}</span>}
                              </span>
                              <span className="compras-producto-meta">{formatoMoneda(detalle.precioUnitario)} c/u al proveedor</span>
                            </span>
                          </span>
                          <span className="compras-cliente-cifra" data-etiqueta="Asignado"><strong>{num(asignacion.cantidad)}</strong></span>
                          <span className="compras-cliente-cifra" data-etiqueta="Recibido"><strong>{recibido}</strong></span>
                          <span className="compras-reparto-estado">
                            <span className={`compras-situacion compras-situacion-${situacion.clase}`}>{situacion.texto}</span>
                          </span>
                          <span className="compras-reparto-accion">
                            {activa && entregada < num(asignacion.pedidoDetalle?.cantidad) && recibido > 0 && (
                              <button type="button" className="pedidos-btn pedidos-btn-verde pedidos-btn-sm" onClick={() => navigate(`/dashboard/pedido/${compra.pedidoid}?accion=entregar`)}>
                                Entregar
                              </button>
                            )}
                            {activa && entregada > 0 && (
                              <button
                                type="button"
                                className="pedidos-btn pedidos-btn-secundario pedidos-btn-sm"
                                title="El cliente devuelve este producto"
                                onClick={() => navigate(`/dashboard/pedido/${compra.pedidoid}?accion=devolver&detalle=${asignacion.pedidoDetalle.detalleid}`)}
                              >
                                <Undo2 size={13} /><span>Devolución</span>
                              </button>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {lineasStock.length > 0 && (
            <div className="compras-cliente">
              <div className="compras-cliente-cabecera">
                <div className="tbl-main-cell compras-cliente-id">
                  <span className="tbl-avatar compras-reparto-avatar-stock"><Package size={15} /></span>
                  <div className="tbl-cell-texts">
                    <span className="tbl-cell-primary">Stock (sin cliente)</span>
                    <span className="tbl-cell-secondary">Lo que no tiene cliente va directo al inventario</span>
                  </div>
                </div>
              </div>
              <div className="compras-cliente-lineas">
                {lineasStock.map(({ detalle, cantidad: paraStock }) => (
                  <div key={detalle.detalleid} className="compras-cliente-linea">
                    <span className="compras-cliente-producto">
                      {miniaturaProducto(detalle.producto?.imagenes?.[0])}
                      <span className="compras-producto-info">
                        <span className="compras-producto-nombre">
                          {detalle.productoNombre}
                          {detalle.talla && <span className="cart-item-talla" style={{ marginLeft: '0.4rem' }}>Talla {detalle.talla}</span>}
                        </span>
                        <span className="compras-producto-meta">{formatoMoneda(detalle.precioUnitario)} c/u al proveedor</span>
                      </span>
                    </span>
                    <span className="compras-cliente-cifra" data-etiqueta="Asignado"><strong>{paraStock}</strong></span>
                    <span className="compras-cliente-cifra" data-etiqueta="Recibido"><strong>—</strong></span>
                    <span className="compras-reparto-estado">
                      <span className="compras-situacion compras-situacion-espera">Va directo al stock</span>
                    </span>
                    <span className="compras-reparto-accion" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <PanelInferior abierto={masAbierto} onCerrar={() => setMasAbierto(false)} titulo="Más acciones" subtitulo={nombrePedido(orden)} nombreAvatar="Pedido">
        <div className="pi-lista-acciones">
          {abierto && (
            <button type="button" className="pi-accion" onClick={() => { setMasAbierto(false); navigate(`/dashboard/nuevo-pedido?pedido=${orden.ordenid}&tipo=stock`); }}><Plus size={15} /> Productos para stock</button>
          )}
          {abierto && (
            <button type="button" className="pi-accion" onClick={() => { setMasAbierto(false); abrirExistentes(); }}><Users size={15} /> Agregar compra existente</button>
          )}
          {!['recibida', 'anulada'].includes(orden.estado) && (
            <button type="button" className="pi-accion" onClick={() => { setMasAbierto(false); setNombreEdicion(orden.nombre || ''); setModal('nombre'); }}><Pencil size={15} /> Cambiar nombre</button>
          )}
          {puedeAnular && (
            <button type="button" className="pi-accion" onClick={() => { setMasAbierto(false); handleAnular(); }}><XCircle size={15} /> Anular pedido</button>
          )}
          <button type="button" className="pi-accion pi-accion-peligro" onClick={() => { setMasAbierto(false); handleEliminar(); }}><Trash2 size={15} /> Eliminar pedido</button>
        </div>
      </PanelInferior>

      <PanelInferior
        abierto={Boolean(compraSel)}
        onCerrar={() => setCompraSel(null)}
        titulo={compraSel?.cliente?.nombreCliente || 'Compra'}
        subtitulo={compraSel ? (ESTADOS_COMPRA_CLIENTE[compraSel.estado] || compraSel.estado) : ''}
        acciones={compraSel && (
          <>
            {compraSel.estado !== 'anulado' && Number(compraSel.resumen?.saldo || 0) > 0 && (
              <button type="button" className="pi-accion pi-accion-primaria" onClick={() => navigate(`/dashboard/pedido/${compraSel.pedidoid}?accion=abono`)}>Abonar</button>
            )}
            <button type="button" className="pi-accion" onClick={() => navigate(`/dashboard/pedido/${compraSel.pedidoid}`)}>Ver detalle</button>
            <button type="button" className="pi-accion pi-accion-peligro" onClick={() => { const c = compraSel; setCompraSel(null); eliminarCompra(c); }}><Trash2 size={15} /> Eliminar</button>
          </>
        )}
      >
        {compraSel && (
          <>
            <DatoPanel etiqueta="Productos" valor={resumenProductos(compraSel)} />
            <DatoPanel etiqueta="Total" valor={formatoMoneda(compraSel.total)} />
            <DatoPanel etiqueta="Abonado" valor={formatoMoneda(compraSel.resumen?.abonado)} />
            <DatoPanel etiqueta="Saldo" valor={compraSel.estado === 'anulado' ? '—' : formatoMoneda(compraSel.resumen?.saldo)} tono={Number(compraSel.resumen?.saldo || 0) > 0 ? 'peligro' : 'ok'} />
          </>
        )}
      </PanelInferior>

      <PanelInferior
        abierto={Boolean(lineaSel)}
        onCerrar={() => setLineaSel(null)}
        titulo={lineaSel?.productoNombre || ''}
        subtitulo="Para stock"
        acciones={lineaSel && (
          <button type="button" className="pi-accion pi-accion-peligro" onClick={() => { const d = lineaSel; setLineaSel(null); quitarStock(d); }}><Trash2 size={15} /> Quitar del pedido</button>
        )}
      >
        {lineaSel && (
          <>
            <DatoPanel etiqueta="Talla" valor={lineaSel.talla || 'Sin talla'} />
            <DatoPanel etiqueta="Cantidad" valor={`${cantidad(lineaSel.cantidad)} und`} />
            <DatoPanel etiqueta="Costo" valor={formatoMoneda(lineaSel.subtotal)} />
          </>
        )}
      </PanelInferior>

      </>)}

      {modal === 'nombre' && (
        <div className="pedido-pagina">
          <EncabezadoPagina onVolver={volver} migas={<>Pedidos / {nombrePedido(orden)}</>}>Nombre del pedido</EncabezadoPagina>
          <div className="pedido-pagina-card">
            <form className="pedido-modal-form" onSubmit={guardarNombre}>
              <label>
                Nombre
                <input type="text" maxLength={120} autoFocus placeholder={`Pedido #${orden.ordenid}`} value={nombreEdicion} onChange={(e) => setNombreEdicion(e.target.value)} />
              </label>
              <div className="pedido-modal-footer">
                <button type="button" className="pedidos-btn pedidos-btn-secundario" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="pedidos-btn pedidos-btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'existentes' && (
        <div className="pedido-pagina">
          <EncabezadoPagina onVolver={volver} migas={<>Pedidos / {nombrePedido(orden)}</>}>Agregar compras existentes</EncabezadoPagina>
          <div className="pedido-pagina-card pedido-pagina-ancha">
            <div className="pedido-modal-form">
              {sueltas.length === 0 ? (
                <p className="pedido-modal-texto">No hay compras de clientes sin pedido.</p>
              ) : (
                <div className="compras-lista-pedidos">
                  {sueltas.map((c) => (
                    <label key={c.pedidoid} className={`compras-pedido ${marcadas.has(c.pedidoid) ? 'marcado' : ''}`}>
                      <input
                        type="checkbox"
                        checked={marcadas.has(c.pedidoid)}
                        onChange={() => setMarcadas((prev) => {
                          const sig = new Set(prev);
                          if (sig.has(c.pedidoid)) sig.delete(c.pedidoid); else sig.add(c.pedidoid);
                          return sig;
                        })}
                      />
                      <div className="compras-pedido-info">
                        <strong>#{c.pedidoid} · {c.cliente?.nombreCliente || 'Sin cliente'}</strong>
                        <span>{resumenProductos(c)}</span>
                        <small>{formatoMoneda(c.total)} · {ESTADOS_COMPRA_CLIENTE[c.estado]}</small>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              <div className="pedido-modal-footer">
                <button type="button" className="pedidos-btn pedidos-btn-secundario" onClick={() => setModal(null)}>Cancelar</button>
                <button type="button" className="pedidos-btn pedidos-btn-primary" onClick={agregarExistentes} disabled={guardando || sueltas.length === 0}>
                  {guardando ? 'Agregando...' : 'Agregar al pedido'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal === 'enviar' && (
        <div className="pedido-pagina">
          <EncabezadoPagina onVolver={volver} migas={<>Pedidos / {nombrePedido(orden)}</>}>Enviar {nombrePedido(orden)} al proveedor</EncabezadoPagina>
          <div className="pedido-pagina-card pedido-pagina-ancha">
            <div className="pedido-modal-form">
              {!preview ? (
                <p className="pedido-modal-texto">Calculando lo que hay que pedir...</p>
              ) : lineasEnvio.length === 0 ? (
                <p className="pedido-modal-texto">No hay nada que pedir: el stock actual ya cubre las compras de los clientes.</p>
              ) : (
                <>
                  <p className="pedido-modal-texto">
                    Esto es lo que le pedirás al proveedor: todo lo que compraron tus clientes más lo que quieras para stock. Tu inventario no se toca; el stock sube cuando recibas la mercancía.
                  </p>
                  <div className="compras-recepcion">
                    {lineasEnvio.map((l) => (
                      <div key={l.key} className="compras-recepcion-linea">
                        <div className="compras-envio-linea">
                          <span className="compras-producto-miniatura" aria-hidden="true">
                            <Package size={15} />
                            {l.imagen && (
                              <img
                                src={imagenUrl(l.imagen)}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            )}
                          </span>
                          <div className="compras-envio-linea-cuerpo">
                            <div className="compras-recepcion-cabecera">
                              <strong>
                                {l.nombre}
                                {l.talla && <span className="cart-item-talla">Talla {l.talla}</span>}
                              </strong>
                              <span>Pedir {cantidad(l.delCliente + l.deStock)} · {formatoMoneda((l.delCliente + l.deStock) * l.precio)}</span>
                            </div>
                            <p className="pedido-ayuda">
                              {[
                                ...l.clientes.map((c) => `${c.cliente}: ${cantidad(c.faltante)}`),
                                l.deStock > 0 ? `Para stock: ${cantidad(l.deStock)}` : null,
                                l.cubiertos.length > 0 ? `(${l.cubiertos.map((c) => `${c.cliente}: ${cantidad(c.cubiertoStock)}`).join(', ')} se cubre con stock actual)` : null,
                              ].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="compras-total-envio">Costo total al proveedor: <strong>{formatoMoneda(costoEnvio)}</strong></p>
                </>
              )}
              <div className="pedido-modal-footer">
                <button type="button" className="pedidos-btn pedidos-btn-secundario" onClick={() => setModal(null)}>Cancelar</button>
                <button type="button" className="pedidos-btn pedidos-btn-verde" onClick={confirmarEnvio} disabled={guardando || !preview}>
                  {guardando ? 'Enviando...' : 'Enviar al proveedor'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal === 'recibir' && (
        <div className="pedido-pagina">
          <EncabezadoPagina onVolver={volver} migas={<>Pedidos / {nombrePedido(orden)}</>}>Registrar recepción</EncabezadoPagina>
          <div className="pedido-pagina-card pedido-pagina-ancha">
            <form className="pedido-modal-form" onSubmit={confirmarRecepcion}>
              <p className="pedido-modal-texto">
                Indica cuánto llegó de cada línea y a qué cliente corresponde. Por defecto se asigna al primero que pidió; lo que no se asigne queda como stock libre.
              </p>

              <div className="compras-recepcion">
                {detalles.filter((d) => restanteDetalle(d) > 0).map((detalle) => {
                  const datos = recepcion[detalle.detalleid];
                  if (!datos) return null;
                  const linea = estadoLinea(detalle);
                  const activas = (detalle.asignaciones || []).filter(asignacionActiva);
                  const pendienteTotal = restanteDetalle(detalle);
                  return (
                    <div key={detalle.detalleid} className="compras-recepcion-linea">
                      <div className="compras-recepcion-producto">
                        <span className="compras-producto-miniatura compras-recepcion-miniatura" aria-hidden="true">
                          <Package size={15} />
                          {detalle.producto?.imagenes?.[0] && (
                            <img
                              src={imagenUrl(detalle.producto.imagenes[0])}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
                        </span>
                        <div className="compras-recepcion-info">
                          <div className="compras-recepcion-titulo">
                            <strong>{detalle.productoNombre}</strong>
                            {detalle.talla && <span className="cart-item-talla">Talla {detalle.talla}</span>}
                          </div>
                          <div className="compras-recepcion-meta">
                            <span>{cantidad(pendienteTotal)} pendientes</span>
                            <span>{formatoMoneda(detalle.precioUnitario)} c/u</span>
                          </div>
                        </div>
                        <label className="compras-recepcion-llegaron">
                          <span>Llegaron</span>
                          <span className="compras-recepcion-llegaron-control">
                            <input
                              type="number"
                              min="0"
                              max={pendienteTotal}
                              step="any"
                              value={datos.llegaron}
                              onChange={(e) => cambiarLlegaron(detalle, e.target.value)}
                            />
                            <small>de {cantidad(pendienteTotal)}</small>
                          </span>
                        </label>
                      </div>

                      {activas.length > 0 && num(datos.llegaron) > 0 && (
                        <div className="compras-recepcion-reparto">
                          <div className="compras-recepcion-reparto-titulo">
                            <span>Asignar a clientes</span>
                            <span>Asignado {cantidad(linea.asignado)} de {cantidad(linea.llegaron)}</span>
                          </div>
                          {activas.map((asignacion) => {
                            const pendiente = pendienteAsignacion(asignacion);
                            return (
                              <label key={asignacion.asignacionid} className={`compras-recepcion-reparto-fila ${pendiente <= 0 ? 'completo' : ''}`}>
                                <span className="compras-recepcion-cliente">
                                  <strong>{asignacion.pedidoDetalle?.pedido?.cliente?.nombreCliente || 'Sin cliente'}</strong>
                                  <small>Pedido #{asignacion.pedidoDetalle?.pedidoid || '—'} · pendiente {cantidad(pendiente)}</small>
                                </span>
                                <span className="compras-recepcion-reparto-cantidad">
                                  <input
                                    type="number"
                                    min="0"
                                    max={pendiente}
                                    step="any"
                                    disabled={pendiente <= 0}
                                    value={datos.reparto[asignacion.asignacionid] ?? '0'}
                                    onChange={(e) => cambiarReparto(detalle.detalleid, asignacion.asignacionid, e.target.value)}
                                    aria-label={`Cantidad para ${asignacion.pedidoDetalle?.pedido?.cliente?.nombreCliente || 'cliente'}`}
                                  />
                                  <small>unid.</small>
                                </span>
                              </label>
                            );
                          })}
                          {linea.error ? (
                            <p className="compras-reparto-error">{linea.error}</p>
                          ) : linea.libre > 0 ? (
                            <p className="compras-recepcion-resumen">
                              {cantidad(linea.libre)} sin asignar quedan como stock libre.
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pedido-modal-footer">
                <button type="button" className="pedidos-btn pedidos-btn-secundario" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="pedidos-btn pedidos-btn-verde" disabled={guardando}>
                  {guardando ? 'Registrando...' : 'Registrar recepción'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DetalleCompra;
