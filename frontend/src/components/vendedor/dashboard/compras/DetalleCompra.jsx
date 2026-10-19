import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Hash, PackageCheck, Truck, User, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { anularOrdenCompra, getOrdenCompra, recibirOrdenCompra } from '../../../../services/pedidoService';
import {
  ESTADOS_COMPRA,
  asignacionActiva,
  etiquetaTalla,
  formatearFecha,
  formatoMoneda,
  pendienteAsignacion,
  repartoSugerido,
  restanteDetalle,
} from './comprasUtils';
import '../balance/vistas/styles/DetalleTransaccion.css';
import '../pedidos/Pedidos.css';
import './Compras.css';

const num = (valor) => Number(valor) || 0;
const redondear = (n) => Math.round(n * 1000) / 1000;

function DetalleCompra() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orden, setOrden] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [recepcion, setRecepcion] = useState({}); // detalleid -> { llegaron, reparto: { asignacionid: cantidad } }
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setLoading(true);
      setOrden(await getOrdenCompra(id));
    } catch {
      toast.error('No se pudo cargar la compra.');
      navigate('/dashboard/compras');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { cargar(); }, [cargar]);

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

  // Desde la ficha del pedido se llega con ?accion=recibir
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
      const cantidad = num(datos.reparto[asignacion.asignacionid]);
      if (cantidad < 0) error = 'Hay cantidades negativas.';
      if (cantidad > pendienteAsignacion(asignacion) + 0.0005) error = 'Asignaste más de lo que pidió un cliente.';
      asignado = redondear(asignado + cantidad);
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
    toast(`¿Anular la compra #${orden.ordenid}?`, {
      description: 'No se modifica el stock ya recibido. Los pedidos sin nada recibido vuelven a "confirmado".',
      action: {
        label: 'Sí, anular',
        onClick: async () => {
          try {
            await anularOrdenCompra(orden.ordenid);
            toast.success('Compra anulada.');
            cargar(true);
          } catch (error) {
            toast.error(error?.response?.data?.mensaje || 'No se pudo anular la compra.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  if (loading) return <div className="view-loading"><div className="loader-spinner-dark" /></div>;
  if (!orden) return null;

  const estado = ESTADOS_COMPRA[orden.estado] || { label: orden.estado, clase: 'anulado' };
  const detalles = orden.detalles || [];
  const comprados = detalles.reduce((s, d) => s + num(d.cantidad), 0);
  const recibidos = detalles.reduce((s, d) => s + num(d.cantidadRecibida), 0);
  const puedeRecibir = ['borrador', 'enviada', 'recibida_parcial'].includes(orden.estado) && recibidos < comprados;
  const puedeAnular = !['recibida', 'anulada'].includes(orden.estado);

  return (
    <div className="detalle-tx-view">
      <div className="detalle-tx-header">
        <button className="btn-circle-back" onClick={() => navigate('/dashboard/compras')}>
          <ArrowLeft size={18} />
        </button>
        <div className="detalle-tx-header-text">
          <div className="pedido-titulo-linea">
            <h1>Compra #{orden.ordenid}</h1>
            <span className={`pedido-estado pedido-estado-${estado.clase}`}>{estado.label}</span>
          </div>
          <div className="detalle-tx-breadcrumb">Compras / <span className="active">Compra #{orden.ordenid}</span></div>
        </div>
        <div className="pedido-detalle-acciones">
          {puedeRecibir && (
            <button className="pedidos-btn pedidos-btn-verde" onClick={() => abrirRecepcion(orden)}>
              <PackageCheck size={14} /><span>Registrar recepción</span>
            </button>
          )}
          {puedeAnular && (
            <button className="pedidos-btn pedidos-btn-peligro" onClick={handleAnular}>
              <XCircle size={14} /><span>Anular</span>
            </button>
          )}
        </div>
      </div>

      <div className="detalle-tx-summary">
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><Truck size={11} /> Total de la compra</div>
          <div className="detalle-tx-stat-value amount expense">{formatoMoneda(orden.total)}</div>
        </div>
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><User size={11} /> Proveedor</div>
          <div className={`detalle-tx-stat-value ${!orden.proveedor ? 'muted' : ''}`}>
            {orden.proveedor?.nombreProveedor || orden.proveedor?.razonSocial || 'Sin proveedor'}
          </div>
        </div>
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><Calendar size={11} /> Fecha</div>
          <div className="detalle-tx-stat-value">{formatearFecha(orden.createdAt)}</div>
        </div>
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><Hash size={11} /> Recibido</div>
          <div className="detalle-tx-stat-value">
            {recibidos.toLocaleString('es-CO', { maximumFractionDigits: 3 })} / {comprados.toLocaleString('es-CO', { maximumFractionDigits: 3 })}
          </div>
        </div>
      </div>

      {orden.descripcion && <p className="compras-nota">{orden.descripcion}</p>}

      <h2 className="compras-seccion-titulo"><Truck size={15} /> Reparto por cliente</h2>
      <p className="pedido-ayuda compras-seccion-ayuda">
        Cada par comprado está destinado a un cliente. Al registrar la recepción eliges a quién corresponde lo que llegó.
      </p>

      {detalles.map((detalle) => {
        const progreso = comprados === 0 ? 0 : (num(detalle.cantidadRecibida) / num(detalle.cantidad)) * 100;
        return (
          <div key={detalle.detalleid} className="compras-linea">
            <div className="compras-linea-header">
              <strong>
                {detalle.productoNombre}
                {detalle.talla && <span className="cart-item-talla">Talla {detalle.talla}</span>}
              </strong>
              <span>
                {num(detalle.cantidadRecibida)} de {num(detalle.cantidad)} recibidos · {formatoMoneda(detalle.precioUnitario)} c/u
              </span>
            </div>
            <div className="compras-barra"><div style={{ width: `${Math.min(100, progreso)}%` }} /></div>

            <div className="items-table-container">
              <table className="items-table">
                <thead>
                  <tr><th>Cliente</th><th>Pedido</th><th>Asignado</th><th>Recibido</th><th>Situación</th><th /></tr>
                </thead>
                <tbody>
                  {(detalle.asignaciones || []).map((asignacion) => {
                    const pedido = asignacion.pedidoDetalle?.pedido;
                    const activa = asignacionActiva(asignacion);
                    const recibido = num(asignacion.cantidadRecibida);
                    const completo = recibido >= num(asignacion.cantidad);
                    const entregado = num(asignacion.pedidoDetalle?.cantidadEntregada) >= num(asignacion.pedidoDetalle?.cantidad);
                    let situacion = { texto: 'Esperando al proveedor', clase: 'espera' };
                    if (!activa) situacion = { texto: 'Pedido cancelado', clase: 'cancelado' };
                    else if (entregado) situacion = { texto: 'Entregado', clase: 'entregado' };
                    else if (completo) situacion = { texto: 'Listo para entregar', clase: 'listo' };
                    else if (recibido > 0) situacion = { texto: 'Llegó parte', clase: 'parcial' };
                    return (
                      <tr key={asignacion.asignacionid} className={!activa ? 'compras-fila-cancelada' : ''}>
                        <td className="item-name">{pedido?.cliente?.nombreCliente || 'Sin cliente'}</td>
                        <td>
                          <button className="pedido-link-venta" onClick={() => navigate(`/dashboard/pedido/${pedido?.pedidoid}`)}>
                            #{pedido?.pedidoid}
                          </button>
                        </td>
                        <td className="item-qty">{num(asignacion.cantidad)}</td>
                        <td className="item-qty">{recibido}</td>
                        <td><span className={`compras-situacion compras-situacion-${situacion.clase}`}>{situacion.texto}</span></td>
                        <td>
                          {activa && !entregado && recibido > 0 && (
                            <button
                              className="pedidos-btn pedidos-btn-verde pedidos-btn-sm"
                              onClick={() => navigate(`/dashboard/pedido/${pedido.pedidoid}?accion=entregar`)}
                            >
                              Entregar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {(detalle.asignaciones || []).length === 0 && (
                    <tr><td colSpan="6" className="compras-vacio">Esta línea no tiene reparto por cliente (compra anterior al reparto).</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {modal === 'recibir' && (
        <div className="pedido-modal-overlay" onClick={() => setModal(null)}>
          <div className="pedido-modal pedido-modal-ancho" onClick={(e) => e.stopPropagation()}>
            <div className="pedido-modal-header">
              <h3>Registrar recepción</h3>
              <button className="pedido-modal-close" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <form className="pedido-modal-form" onSubmit={confirmarRecepcion}>
              <p className="pedido-modal-texto">
                Indica cuánto llegó de cada línea y a qué cliente corresponde. Por defecto se asigna al primero que pidió; puedes cambiarlo.
              </p>

              <div className="compras-recepcion">
                {detalles.filter((d) => restanteDetalle(d) > 0).map((detalle) => {
                  const datos = recepcion[detalle.detalleid];
                  if (!datos) return null;
                  const linea = estadoLinea(detalle);
                  const activas = (detalle.asignaciones || []).filter(asignacionActiva);
                  return (
                    <div key={detalle.detalleid} className="compras-recepcion-linea">
                      <div className="compras-recepcion-cabecera">
                        <strong>
                          {detalle.productoNombre}
                          {detalle.talla && <span className="cart-item-talla">Talla {detalle.talla}</span>}
                        </strong>
                        <label>
                          Llegaron
                          <input
                            type="number"
                            min="0"
                            max={restanteDetalle(detalle)}
                            step="any"
                            value={datos.llegaron}
                            onChange={(e) => cambiarLlegaron(detalle, e.target.value)}
                          />
                          <small>de {restanteDetalle(detalle)} pendientes</small>
                        </label>
                      </div>

                      {activas.length > 0 && num(datos.llegaron) > 0 && (
                        <div className="compras-reparto-grid">
                          {activas.map((asignacion) => {
                            const pendiente = pendienteAsignacion(asignacion);
                            return (
                              <label key={asignacion.asignacionid} className={`compras-reparto-fila ${pendiente <= 0 ? 'completo' : ''}`}>
                                <span>
                                  {asignacion.pedidoDetalle?.pedido?.cliente?.nombreCliente || 'Sin cliente'}
                                  <small> · pedido #{asignacion.pedidoDetalle?.pedidoid} · pendiente {pendiente}</small>
                                </span>
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
                              </label>
                            );
                          })}
                          {linea.error ? (
                            <p className="compras-reparto-error">{linea.error}</p>
                          ) : (
                            <p className="pedido-ayuda">
                              Asignado {linea.asignado} de {linea.llegaron}.
                              {linea.libre > 0 && ` Los ${linea.libre} restantes quedan como stock libre.`}
                            </p>
                          )}
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
