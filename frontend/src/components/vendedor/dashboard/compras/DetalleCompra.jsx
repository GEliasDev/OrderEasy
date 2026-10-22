import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Eye, Hash, MoreHorizontal, Package, PackageCheck, Pencil, Plus, Send, Trash2, Truck, User, Users, X, XCircle } from 'lucide-react';
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

// Pedido al proveedor: contiene las compras de los clientes (con sus abonos y entregas) y los productos para stock
function DetalleCompra() {
  const esMovil = useEsMovil();
  const [compraSel, setCompraSel] = useState(null);
  const [lineaSel, setLineaSel] = useState(null);
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orden, setOrden] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'recibir' | 'enviar' | 'existentes' | 'nombre'
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
  }, []);

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

  return (
    <div className="detalle-tx-view detalle-ancho">
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
            <button className="pedidos-btn pedidos-btn-secundario pedido-btn-mas" onClick={() => setModal('mas')} aria-label="Más acciones">
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
        </div>
      </div>

      {orden.descripcion && <p className="compras-nota">{orden.descripcion}</p>}

      <h2 className="compras-seccion-titulo"><Users size={15} /> Compras de clientes ({resumen.cantidad})</h2>
      <p className="pedido-ayuda compras-seccion-ayuda">
        {abierto
          ? 'Agrega las compras que te hacen los clientes. Dentro de cada una registras sus abonos, pagos y entregas, y puedes editar sus productos mientras el pedido no se haya enviado.'
          : 'Abre una compra para ver y registrar sus abonos, pagos y entrega.'}
        {resumen.cantidad > 0 && ` Entre todas: abonado ${formatoMoneda(resumen.abonado)} · por cobrar ${formatoMoneda(resumen.saldo)}.`}
      </p>

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

      {abierto ? (
        <>
          <h2 className="compras-seccion-titulo"><Truck size={15} /> Productos para stock</h2>
          <p className="pedido-ayuda compras-seccion-ayuda">
            Pares extra que pides sin cliente asignado: al recibirlos suben directo al stock.
          </p>
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
          <h2 className="compras-seccion-titulo"><Truck size={15} /> Lo pedido al proveedor y su reparto</h2>
          <p className="pedido-ayuda compras-seccion-ayuda">
            Cada par está destinado a un cliente; lo que no tiene cliente va al stock. Al registrar la recepción eliges a quién corresponde lo que llegó.
          </p>

          {detalles.map((detalle) => {
            const progreso = num(detalle.cantidad) === 0 ? 0 : (num(detalle.cantidadRecibida) / num(detalle.cantidad)) * 100;
            const activas = (detalle.asignaciones || []).filter(asignacionActiva);
            const paraStock = redondear(num(detalle.cantidad) - activas.reduce((s, a) => s + num(a.cantidad), 0));
            return (
              <div key={detalle.detalleid} className="compras-linea">
                <div className="compras-linea-producto">
                  <span className="compras-producto-miniatura compras-linea-miniatura" aria-hidden="true">
                    <Package size={16} />
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
                  <div className="compras-linea-info">
                    <div className="compras-linea-titulo">
                      <strong>{detalle.productoNombre}</strong>
                      {detalle.talla && <span className="cart-item-talla">Talla {detalle.talla}</span>}
                    </div>
                    <div className="compras-linea-meta">
                      <span>{cantidad(detalle.cantidad)} und</span>
                      <span>{formatoMoneda(detalle.precioUnitario)} c/u</span>
                      <span>Total {formatoMoneda(detalle.subtotal)}</span>
                    </div>
                  </div>
                  <div className="compras-linea-recibido">
                    <strong>{num(detalle.cantidadRecibida)} / {cantidad(detalle.cantidad)}</strong>
                    <span>recibidos</span>
                  </div>
                </div>

                <div className="compras-linea-progreso">
                  <div className="compras-barra"><div style={{ width: `${Math.min(100, progreso)}%` }} /></div>
                </div>

                <div className="compras-reparto">
                  <div className="compras-reparto-titulo">Reparto por cliente</div>
                  <div className="compras-reparto-cabecera" aria-hidden="true">
                    <span>Cliente</span>
                    <span className="compras-reparto-cabecera-datos"><span>Asignado</span><span>Recibido</span></span>
                    <span>Situación</span>
                    <span />
                  </div>
                  {(detalle.asignaciones || []).map((asignacion) => {
                    const compra = asignacion.pedidoDetalle?.pedido;
                    const activa = asignacionActiva(asignacion);
                    const recibido = num(asignacion.cantidadRecibida);
                    const completo = recibido >= num(asignacion.cantidad);
                    const entregado = num(asignacion.pedidoDetalle?.cantidadEntregada) >= num(asignacion.pedidoDetalle?.cantidad);
                    let situacion = { texto: 'Esperando al proveedor', clase: 'espera' };
                    if (!activa) situacion = { texto: 'Compra cancelada', clase: 'cancelado' };
                    else if (entregado) situacion = { texto: 'Entregado', clase: 'entregado' };
                    else if (completo) situacion = { texto: 'Listo para entregar', clase: 'listo' };
                    else if (recibido > 0) situacion = { texto: 'Llegó parte', clase: 'parcial' };
                    return (
                      <div key={asignacion.asignacionid} className={`compras-reparto-item${!activa ? ' compras-reparto-cancelada' : ''}`}>
                        <span className="compras-reparto-cliente">
                          <button type="button" className="pedido-link-venta" onClick={() => navigate(`/dashboard/pedido/${compra?.pedidoid}`)}>
                            {compra?.cliente?.nombreCliente || 'Sin cliente'}
                          </button>
                          <small>Pedido #{compra?.pedidoid || '—'}</small>
                        </span>
                        <span className="compras-reparto-datos">
                          <span><strong>{num(asignacion.cantidad)}</strong><small>asignado</small></span>
                          <span><strong>{recibido}</strong><small>recibido</small></span>
                        </span>
                        <span className="compras-reparto-estado">
                          <span className={`compras-situacion compras-situacion-${situacion.clase}`}>{situacion.texto}</span>
                        </span>
                        <span className="compras-reparto-accion">
                          {activa && !entregado && recibido > 0 && (
                            <button
                              type="button"
                              className="pedidos-btn pedidos-btn-verde pedidos-btn-sm"
                              onClick={() => navigate(`/dashboard/pedido/${compra.pedidoid}?accion=entregar`)}
                            >
                              Entregar
                            </button>
                          )}
                        </span>
                      </div>
                    );
                  })}
                  {paraStock > 0 && (
                    <div className="compras-reparto-item compras-reparto-stock">
                      <span className="compras-reparto-cliente">
                        <strong>Stock (sin cliente)</strong>
                        <small>Va directo al inventario</small>
                      </span>
                      <span className="compras-reparto-datos">
                        <span><strong>{paraStock}</strong><small>asignado</small></span>
                        <span><strong>—</strong><small>recibido</small></span>
                      </span>
                      <span className="compras-reparto-estado">
                        <span className="compras-situacion compras-situacion-espera">Va directo al stock</span>
                      </span>
                      <span className="compras-reparto-accion" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      <PanelInferior abierto={modal === 'mas'} onCerrar={() => setModal(null)} titulo="Más acciones" subtitulo={nombrePedido(orden)} nombreAvatar="Pedido">
        <div className="pi-lista-acciones">
          {abierto && (
            <button type="button" className="pi-accion" onClick={() => { setModal(null); navigate(`/dashboard/nuevo-pedido?pedido=${orden.ordenid}&tipo=stock`); }}><Plus size={15} /> Productos para stock</button>
          )}
          {abierto && (
            <button type="button" className="pi-accion" onClick={() => { setModal(null); abrirExistentes(); }}><Users size={15} /> Agregar compra existente</button>
          )}
          {!['recibida', 'anulada'].includes(orden.estado) && (
            <button type="button" className="pi-accion" onClick={() => { setNombreEdicion(orden.nombre || ''); setModal('nombre'); }}><Pencil size={15} /> Cambiar nombre</button>
          )}
          {puedeAnular && (
            <button type="button" className="pi-accion" onClick={() => { setModal(null); handleAnular(); }}><XCircle size={15} /> Anular pedido</button>
          )}
          <button type="button" className="pi-accion pi-accion-peligro" onClick={() => { setModal(null); handleEliminar(); }}><Trash2 size={15} /> Eliminar pedido</button>
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

      {modal === 'nombre' && (
        <div className="pedido-modal-overlay" onClick={() => setModal(null)}>
          <div className="pedido-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pedido-modal-header">
              <h3>Nombre del pedido</h3>
              <button className="pedido-modal-close" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
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
        <div className="pedido-modal-overlay" onClick={() => setModal(null)}>
          <div className="pedido-modal pedido-modal-ancho" onClick={(e) => e.stopPropagation()}>
            <div className="pedido-modal-header">
              <h3>Agregar compras existentes</h3>
              <button className="pedido-modal-close" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
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
        <div className="pedido-modal-overlay" onClick={() => setModal(null)}>
          <div className="pedido-modal pedido-modal-ancho" onClick={(e) => e.stopPropagation()}>
            <div className="pedido-modal-header">
              <h3>Enviar {nombrePedido(orden)} al proveedor</h3>
              <button className="pedido-modal-close" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
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
        <div className="pedido-modal-overlay" onClick={() => setModal(null)}>
          <div className="pedido-modal pedido-modal-ancho" onClick={(e) => e.stopPropagation()}>
            <div className="pedido-modal-header">
              <h3>Registrar recepción</h3>
              <button className="pedido-modal-close" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
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
