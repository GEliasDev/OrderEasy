import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check, ChevronDown, Edit2, FileText, MessageCircle, Package, Plus, Receipt, RotateCcw, ShoppingBag, Trash2, Undo2, Wallet, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { imagenUrl } from '../../../../config';
import { getSaldoFavor, usarSaldoFavor } from '../../../../services/pedidoService';
import { abrirWhatsApp, mensajeListoParaEntregar, mensajeRecordatorioSaldo } from '../../../../utils/whatsapp';
import { colorAvatar, iniciales } from '../../../../utils/avatar';
import { ESTADOS_COMPRA_CLIENTE, formatearFecha, formatoMoneda } from './comprasUtils';

const num = (valor) => Number(valor) || 0;
const redondear = (n) => Math.round(n * 1000) / 1000;
const cantidad = (n) => num(n).toLocaleString('es-CO', { maximumFractionDigits: 3 });

const BADGE_ESTADO = {
  pendiente: 'tbl-badge--warning',
  confirmado: 'tbl-badge--primary',
  en_compra: 'tbl-badge--primary',
  recibido: 'tbl-badge--ok',
  entregado: 'tbl-badge--ok',
  anulado: 'tbl-badge--neutral',
};

const TIPO_MOVIMIENTO = {
  abono: { label: 'Abono', badge: 'tbl-badge--ok', signo: '+' },
  devolucion: { label: 'Devolución de dinero', badge: 'tbl-badge--danger', signo: '-' },
  traslado: { label: 'Saldo trasladado', badge: 'tbl-badge--neutral', signo: '-' },
};

const METODOS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

const MOTIVOS_DEVOLUCION = {
  color: 'No era el color',
  talla: 'No era la talla',
  modelo: 'No era el modelo',
  danado: 'Llegó dañado o con defecto',
  no_gusto: 'No le gustó',
  otro: 'Otro motivo',
};

const fechaHora = (fecha) => (fecha
  ? new Date(fecha).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

const fechaSola = (fecha) => (fecha ? formatearFecha(`${fecha}`.length === 10 ? `${fecha}T12:00:00` : fecha) : 'Sin fecha definida');

const miniatura = (ruta) => (
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

// Lo que ya llegó del proveedor para una línea y todavía no se ha entregado (sin pasarse de lo pendiente)
const entregableDe = (detalle) => {
  const pendiente = redondear(num(detalle.cantidad) - num(detalle.cantidadEntregada));
  return Math.max(0, Math.min(pendiente, redondear(num(detalle.recibidoCompra) - num(detalle.cantidadEntregada))));
};

const situacionDe = (detalle, { anulada, pedidoAbierto }) => {
  if (anulada) return { texto: 'Compra cancelada', clase: 'cancelado' };
  if (num(detalle.cantidadEntregada) >= num(detalle.cantidad)) return { texto: 'Entregado', clase: 'entregado' };
  if (pedidoAbierto) return { texto: 'En el pedido', clase: 'espera' };
  if (num(detalle.recibidoCompra) >= num(detalle.cantidad)) return { texto: 'Listo para entregar', clase: 'listo' };
  if (num(detalle.recibidoCompra) > 0) return { texto: 'Llegó parte', clase: 'parcial' };
  return { texto: 'Esperando al proveedor', clase: 'espera' };
};

/**
 * Una compra de cliente dentro del pedido al proveedor: su dinero, sus productos (lo pedido, lo que llegó y lo entregado),
 * y todo lo que antes se hacía en la pantalla de la compra: abonos, recibos, entregas, devoluciones y avisos por WhatsApp.
 * Los formularios abren como pantallas completas y regresan a este pedido.
 */
function TarjetaCompra({ compra, pedidoAbierto, costos, rutaPedido, negocio, onEliminar, onRecargar }) {
  const navigate = useNavigate();
  const [expandida, setExpandida] = useState(false);
  const [saldoFavor, setSaldoFavor] = useState(0);

  const anulada = compra.estado === 'anulado';
  const estado = compra.estado || 'pendiente';
  const clienteNombre = compra.cliente?.nombreCliente || 'Sin cliente';
  const telefono = compra.cliente?.telefono;
  const resumen = compra.resumen || {};
  const saldo = num(resumen.saldo);
  const detalles = compra.detalles || [];
  const pagos = compra.pagos || [];
  const devoluciones = compra.devoluciones || [];
  const ventas = compra.ventas || [];

  const lineasEntregables = detalles.filter((d) => entregableDe(d) > 0);
  const puedeEntregar = !anulada && ['confirmado', 'en_compra', 'recibido'].includes(estado) && lineasEntregables.length > 0;
  const puedeAbonar = !anulada && saldo > 0;
  const puedeDevolverProductos = !anulada && detalles.some((d) => num(d.cantidadEntregada) > 0);
  const puedeEditar = !['entregado', 'anulado'].includes(estado);

  useEffect(() => {
    if (!expandida || !compra.clienteid || anulada) return undefined;
    let activo = true;
    getSaldoFavor(compra.clienteid).then((data) => { if (activo) setSaldoFavor(num(data?.total)); }).catch(() => {});
    return () => { activo = false; };
  }, [expandida, compra.clienteid, anulada]);

  // Los formularios son pantallas de la compra; al terminar regresan a este pedido
  const ir = (vista, consulta = '') => navigate(`/dashboard/pedido/${compra.pedidoid}/${vista}${consulta}`, { state: { volverA: rutaPedido } });

  const editar = () => {
    if (pedidoAbierto && !detalles.some((d) => num(d.cantidadEntregada) > 0)) {
      navigate(`/dashboard/nuevo-pedido?editar=${compra.pedidoid}&pedido=${compra.ordenid}`);
    } else {
      ir('editar');
    }
  };

  const usarSaldo = async () => {
    try {
      await usarSaldoFavor(compra.pedidoid);
      toast.success('Saldo a favor aplicado como abono.');
      onRecargar();
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo usar el saldo a favor.');
    }
  };

  const avisarListo = () => {
    const listas = lineasEntregables.map((d) => ({ productoNombre: d.productoNombre, talla: d.talla, cantidad: entregableDe(d) }));
    const ok = abrirWhatsApp(telefono, mensajeListoParaEntregar({
      negocio: negocio?.nombre, cliente: clienteNombre, pedidoid: compra.pedidoid, lineas: listas, saldo,
    }));
    if (!ok) toast.error('Este cliente no tiene un teléfono válido para WhatsApp.');
  };

  const recordarSaldo = () => {
    const ok = abrirWhatsApp(telefono, mensajeRecordatorioSaldo({
      negocio: negocio?.nombre, cliente: clienteNombre, pedidoid: compra.pedidoid, total: resumen.total, abonado: resumen.abonado, saldo,
    }));
    if (!ok) toast.error('Este cliente no tiene un teléfono válido para WhatsApp.');
  };

  return (
    <div className={`compras-cliente${anulada ? ' compras-cliente-anulada' : ''}`}>
      <div className="compras-cliente-cabecera">
        <div className="tbl-main-cell compras-cliente-id">
          <span className="tbl-avatar" style={{ background: colorAvatar(clienteNombre), opacity: anulada ? 0.5 : 1 }}>{iniciales(clienteNombre)}</span>
          <div className="tbl-cell-texts">
            <span className="tbl-cell-primary compras-cliente-nombre">{clienteNombre}</span>
            <span className="tbl-cell-secondary">
              Compra #{compra.pedidoid} · <span className={`tbl-badge ${BADGE_ESTADO[estado] || 'tbl-badge--neutral'}`}>{ESTADOS_COMPRA_CLIENTE[estado] || estado}</span>
            </span>
          </div>
        </div>
        <div className="compras-cliente-dinero">
          <span><small>Total</small><strong>{formatoMoneda(compra.total)}</strong></span>
          <span><small>Abonado</small><strong>{formatoMoneda(resumen.abonado)}</strong></span>
          <span><small>Saldo</small>
            {anulada ? <strong className="tbl-vacio">—</strong>
              : saldo > 0 ? <strong className="compras-saldo-pendiente">{formatoMoneda(saldo)}</strong>
                : <span className="tbl-badge tbl-badge--ok">Pagado</span>}
          </span>
        </div>
        <div className="tbl-actions">
          {puedeAbonar && (
            <button type="button" className="pedidos-btn pedidos-btn-primary pedidos-btn-sm" onClick={() => ir('pago', '?tipo=abono')}>
              <Plus size={13} /><span>Abonar</span>
            </button>
          )}
          {puedeEntregar && (
            <button type="button" className="pedidos-btn pedidos-btn-verde pedidos-btn-sm" onClick={() => ir('entrega')}>
              <ShoppingBag size={13} /><span>Entregar</span>
            </button>
          )}
          <button
            type="button"
            className={`pedidos-btn pedidos-btn-secundario pedidos-btn-sm compras-cliente-toggle${expandida ? ' abierto' : ''}`}
            onClick={() => setExpandida((v) => !v)}
            aria-expanded={expandida}
          >
            <span>{expandida ? 'Ocultar' : 'Abonos y más'}</span><ChevronDown size={14} />
          </button>
        </div>
      </div>

      <div className="compras-cliente-lineas">
        <div className="compras-cliente-linea compras-cliente-linea-cabecera" aria-hidden="true">
          <span>Producto</span><span>Pidió</span><span>Llegó</span><span>Entregado</span><span>Situación</span><span />
        </div>
        {detalles.map((d) => {
          const situacion = situacionDe(d, { anulada, pedidoAbierto });
          const costo = costos?.get(`${d.productoid}:${d.varianteid || ''}`);
          return (
            <div key={d.detalleid} className="compras-cliente-linea">
              <span className="compras-cliente-producto">
                {miniatura(d.producto?.imagenes?.[0])}
                <span className="compras-producto-info">
                  <span className="compras-producto-nombre">
                    {d.productoNombre}
                    {d.talla && <span className="cart-item-talla" style={{ marginLeft: '0.4rem' }}>Talla {d.talla}</span>}
                  </span>
                  <span className="compras-producto-meta">
                    Venta {formatoMoneda(d.precioUnitario)} c/u{costo !== undefined ? ` · Costo ${formatoMoneda(costo)} c/u` : ''}
                  </span>
                </span>
              </span>
              <span className="compras-cliente-cifra" data-etiqueta="Pidió"><strong>{cantidad(d.cantidad)}</strong></span>
              <span className="compras-cliente-cifra" data-etiqueta="Llegó"><strong>{pedidoAbierto ? '—' : cantidad(Math.min(num(d.recibidoCompra), num(d.cantidad)))}</strong></span>
              <span className="compras-cliente-cifra" data-etiqueta="Entregado"><strong>{cantidad(d.cantidadEntregada)}</strong></span>
              <span className="compras-reparto-estado">
                <span className={`compras-situacion compras-situacion-${situacion.clase}`}>{situacion.texto}</span>
              </span>
              <span className="compras-reparto-accion">
                {!anulada && num(d.cantidadEntregada) > 0 && (
                  <button
                    type="button"
                    className="pedidos-btn pedidos-btn-secundario pedidos-btn-sm"
                    title="El cliente devuelve este producto"
                    onClick={() => ir('devolucion', `?detalle=${d.detalleid}`)}
                  >
                    <Undo2 size={13} /><span>Devolución</span>
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {expandida && (
        <div className="compras-cliente-extra">
          <div className="pedido-pagos-grid">
            <div className="pedido-pago-stat"><span>Abonado</span><strong>{formatoMoneda(resumen.abonado)}</strong></div>
            <div className={`pedido-pago-stat ${saldo > 0 && !anulada ? 'pedido-pago-stat-alerta' : ''}`}>
              <span>Saldo por cobrar</span><strong>{anulada ? '—' : formatoMoneda(saldo)}</strong>
            </div>
            <div className="pedido-pago-stat"><span>Entregado</span><strong>{formatoMoneda(resumen.entregado)}</strong></div>
            <div className="pedido-pago-stat"><span>Por entregar</span><strong>{formatoMoneda(resumen.porEntregar)}</strong></div>
          </div>

          <div className="pedido-datos-extra">
            <div className="pedido-dato"><span>Entrega</span><strong>{fechaSola(compra.fechaEntrega)}</strong></div>
            <div className="pedido-dato"><span>Creada</span><strong>{formatearFecha(compra.createdAt)}</strong></div>
            {ventas.length > 0 && (
              <div className="pedido-dato">
                <span>Entregas realizadas</span>
                <div className="pedido-entregas-lista">
                  {ventas.map((venta) => (
                    <button key={venta.ventaid} type="button" className="pedido-link-venta" onClick={() => navigate(`/dashboard/venta/${venta.ventaid}`)}>
                      Venta #{venta.ventaid} · {formatoMoneda(venta.total)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {compra.descripcion && (
            <div className="compras-nota-bloque"><FileText size={14} /><span>{compra.descripcion}</span></div>
          )}

          <div className="compras-cliente-subtitulo"><Wallet size={14} /> Abonos y recibos</div>
          {pagos.length === 0 ? (
            <p className="pedido-pagos-vacio">Aún no hay abonos registrados en esta compra.</p>
          ) : (
            <div className="items-table-container">
              <table className="items-table pedido-movimientos tabla-tarjetas">
                <thead>
                  <tr><th>Fecha</th><th>Movimiento</th><th>Método</th><th>Nota</th><th>Monto</th><th>Recibo</th></tr>
                </thead>
                <tbody>
                  {pagos.map((pago) => {
                    const tipo = TIPO_MOVIMIENTO[pago.tipo] || TIPO_MOVIMIENTO.abono;
                    return (
                      <tr key={pago.pagoid}>
                        <td>{fechaHora(pago.createdAt)}</td>
                        <td><span className={`tbl-badge ${tipo.badge}`}>{tipo.label}</span></td>
                        <td>{METODOS[pago.metodo] || pago.metodo}</td>
                        <td className="pedido-mov-nota">{pago.nota || <span className="tbl-vacio">—</span>}</td>
                        <td className="item-subtotal">{tipo.signo} {formatoMoneda(pago.monto)}</td>
                        <td>
                          <button
                            type="button"
                            className="pedidos-btn pedidos-btn-secundario pedidos-btn-sm"
                            title="Ver, imprimir o enviar el recibo"
                            onClick={() => ir(`recibo/${pago.pagoid}`)}
                          >
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

          {devoluciones.length > 0 && (
            <>
              <div className="compras-cliente-subtitulo"><Undo2 size={14} /> Devoluciones de productos</div>
              <div className="items-table-container">
                <table className="items-table tabla-tarjetas">
                  <thead>
                    <tr><th>Fecha</th><th>Producto</th><th>Cant.</th><th>Motivo</th><th>Nota</th><th>Valor</th></tr>
                  </thead>
                  <tbody>
                    {devoluciones.map((dev) => (
                      <tr key={dev.devolucionid}>
                        <td>{fechaHora(dev.createdAt)}</td>
                        <td>{dev.productoNombre}{dev.talla ? ` · Talla ${dev.talla}` : ''}</td>
                        <td>{cantidad(dev.cantidad)}</td>
                        <td>
                          <span className={`tbl-badge ${dev.motivo === 'danado' ? 'tbl-badge--danger' : 'tbl-badge--warning'}`}>{MOTIVOS_DEVOLUCION[dev.motivo] || dev.motivo}</span>
                          {!dev.reingresaStock && <small className="compras-nota-corta">No volvió al inventario</small>}
                        </td>
                        <td className="pedido-mov-nota">{dev.nota || <span className="tbl-vacio">—</span>}</td>
                        <td className="item-subtotal">{formatoMoneda(num(dev.cantidad) * num(dev.precioUnitario))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="compras-cliente-acciones">
            {puedeAbonar && saldoFavor > 0 && (
              <button type="button" className="pedidos-btn pedidos-btn-verde pedidos-btn-sm" onClick={usarSaldo}>
                <Wallet size={13} /><span>Usar saldo a favor ({formatoMoneda(saldoFavor)})</span>
              </button>
            )}
            {num(resumen.disponibleAbonos) > 0 && !anulada && (
              <button type="button" className="pedidos-btn pedidos-btn-secundario pedidos-btn-sm" onClick={() => ir('pago', '?tipo=devolucion')}>
                <RotateCcw size={13} /><span>Devolver dinero</span>
              </button>
            )}
            {puedeDevolverProductos && (
              <button type="button" className="pedidos-btn pedidos-btn-secundario pedidos-btn-sm" onClick={() => ir('devolucion')}>
                <Undo2 size={13} /><span>Devolución de productos</span>
              </button>
            )}
            {puedeAbonar && telefono && (
              <button type="button" className="pedidos-btn pedidos-btn-secundario pedidos-btn-sm" onClick={recordarSaldo}>
                <MessageCircle size={13} /><span>Recordar saldo</span>
              </button>
            )}
            {puedeEntregar && telefono && (
              <button type="button" className="pedidos-btn pedidos-btn-secundario pedidos-btn-sm" onClick={avisarListo}>
                <Check size={13} /><span>Avisar que está listo</span>
              </button>
            )}
            {puedeEditar && (
              <button type="button" className="pedidos-btn pedidos-btn-secundario pedidos-btn-sm" onClick={editar}>
                <Edit2 size={13} /><span>Editar</span>
              </button>
            )}
            {puedeEditar && (
              <button type="button" className="pedidos-btn pedidos-btn-secundario pedidos-btn-sm" onClick={() => ir('anular')}>
                <XCircle size={13} /><span>Anular compra</span>
              </button>
            )}
            <button type="button" className="pedidos-btn pedidos-btn-peligro pedidos-btn-sm" onClick={() => onEliminar(compra)}>
              <Trash2 size={13} /><span>Eliminar</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TarjetaCompra;
