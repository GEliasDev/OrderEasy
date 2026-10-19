import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, Eye, MessageCircle, PackageCheck, Plus, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { getPedidos } from '../../../../services/pedidoService';
import { getNegocio } from '../../../../services/negocioService';
import { useAuth } from '../../../../context/AuthContext';
import { abrirWhatsApp, mensajeListoParaEntregar, mensajeRecordatorioSaldo } from '../../../../utils/whatsapp';
import { formatearCantidad } from '../../../../utils/unidades';
import {
  ESTADOS_ENTREGABLES,
  agruparPorCliente,
  lineasPendientes,
  repartirStock,
  urgenciaEntrega,
} from './seguimientoUtils';
import '../pedidos/Pedidos.css';
import './Seguimiento.css';

const formatoMoneda = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(valor) || 0);

const ESTADOS_LABEL = {
  pendiente: 'Pendiente', confirmado: 'Confirmado', en_compra: 'En compra',
  recibido: 'Recibido', entregado: 'Entregado', anulado: 'Anulado',
};

function Seguimiento() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const vista = searchParams.get('vista') === 'cobrar' ? 'cobrar' : 'entregar';
  const [pedidos, setPedidos] = useState([]);
  const [nombreNegocio, setNombreNegocio] = useState(user?.nombreNegocio || '');
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [soloListos, setSoloListos] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        const [pedidosData, negocio] = await Promise.all([getPedidos(), getNegocio().catch(() => null)]);
        setPedidos(Array.isArray(pedidosData) ? pedidosData : []);
        if (negocio?.nombre) setNombreNegocio(negocio.nombre);
      } catch {
        toast.error('No se pudo cargar el seguimiento.');
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const cambiarVista = (nueva) => setSearchParams(nueva === 'entregar' ? {} : { vista: nueva }, { replace: true });

  // ───── Por entregar ─────
  const porEntregar = useMemo(() => repartirStock(
    pedidos
      .filter((p) => ESTADOS_ENTREGABLES.includes(p.estado))
      .map((p) => ({ pedido: p, lineas: lineasPendientes(p), urgencia: urgenciaEntrega(p.fechaEntrega) }))
      .filter((f) => f.lineas.length > 0)
  ), [pedidos]);

  // ───── Por cobrar ─────
  const porCobrar = useMemo(() => pedidos
    .filter((p) => p.estado !== 'anulado' && Number(p.resumen?.saldo) > 0)
    .map((p) => ({ pedido: p, urgencia: urgenciaEntrega(p.fechaEntrega) })), [pedidos]);

  const filas = vista === 'entregar' ? porEntregar : porCobrar;

  const grupos = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const visibles = filas.filter((f) => {
      const cliente = (f.pedido.cliente?.nombreCliente || '').toLowerCase();
      const coincide = !texto || cliente.includes(texto) || String(f.pedido.pedidoid).includes(texto);
      const lista = vista !== 'entregar' || !soloListos || f.lineas.some((l) => l.hayAlgo);
      return coincide && lista;
    });
    const porCliente = agruparPorCliente(visibles.map((f) => ({ ...f.pedido, _fila: f })));
    if (vista === 'entregar') {
      // Lo más urgente primero: fecha de entrega más próxima (sin fecha al final)
      const fecha = (g) => Math.min(...g.pedidos.map((p) => p._fila.urgencia?.dias ?? 9999));
      return porCliente.sort((a, b) => fecha(a) - fecha(b) || a.cliente.localeCompare(b.cliente));
    }
    const saldo = (g) => g.pedidos.reduce((s, p) => s + Number(p.resumen?.saldo || 0), 0);
    return porCliente.sort((a, b) => saldo(b) - saldo(a));
  }, [filas, busqueda, soloListos, vista]);

  const metricas = useMemo(() => ({
    pedidosPorEntregar: porEntregar.length,
    listos: porEntregar.filter((f) => f.lineas.some((l) => l.hayAlgo)).length,
    vencidos: porEntregar.filter((f) => f.urgencia?.clase === 'vencida').length,
    totalPorCobrar: porCobrar.reduce((s, f) => s + Number(f.pedido.resumen?.saldo || 0), 0),
    clientesConSaldo: new Set(porCobrar.map((f) => f.pedido.clienteid || f.pedido.pedidoid)).size,
  }), [porEntregar, porCobrar]);

  // ───── WhatsApp ─────
  const avisarListo = (fila) => {
    const listas = fila.lineas.filter((l) => l.hayAlgo);
    const ok = abrirWhatsApp(fila.pedido.cliente?.telefono, mensajeListoParaEntregar({
      negocio: nombreNegocio,
      cliente: fila.pedido.cliente?.nombreCliente,
      pedidoid: fila.pedido.pedidoid,
      lineas: listas.map((l) => ({ productoNombre: l.productoNombre, talla: l.talla, cantidad: Math.min(l.pendiente, l.stock) })),
      saldo: Number(fila.pedido.resumen?.saldo || 0),
    }));
    if (!ok) toast.error('Este cliente no tiene un teléfono válido para WhatsApp.');
  };

  const recordarSaldo = (pedido) => {
    const r = pedido.resumen || {};
    const ok = abrirWhatsApp(pedido.cliente?.telefono, mensajeRecordatorioSaldo({
      negocio: nombreNegocio,
      cliente: pedido.cliente?.nombreCliente,
      pedidoid: pedido.pedidoid,
      total: r.total,
      abonado: r.abonado,
      saldo: r.saldo,
    }));
    if (!ok) toast.error('Este cliente no tiene un teléfono válido para WhatsApp.');
  };

  return (
    <div className="pedidos-container">
      <div className="pedidos-header">
        <div className="compras-titulo-fila">
          <button className="btn-circle-back" onClick={() => navigate('/dashboard/pedidos')} title="Volver a pedidos">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="pedidos-title">Seguimiento de clientes</h1>
            <p className="pedidos-subtitle">A quién entregarle y a quién cobrarle, con aviso por WhatsApp en un clic.</p>
          </div>
        </div>
      </div>

      <div className="pedidos-metricas">
        <div className="pedidos-metrica">
          <div className="pedidos-metrica-icon pedidos-icon-verde"><PackageCheck size={18} /></div>
          <div><span>Pedidos por entregar</span><strong>{metricas.pedidosPorEntregar}</strong></div>
        </div>
        <div className="pedidos-metrica">
          <div className="pedidos-metrica-icon pedidos-icon-verde"><Check size={18} /></div>
          <div><span>Con algo listo</span><strong>{metricas.listos}</strong></div>
        </div>
        <div className="pedidos-metrica">
          <div className="pedidos-metrica-icon pedidos-icon-ambar"><AlertCircle size={18} /></div>
          <div><span>Entregas vencidas</span><strong>{metricas.vencidos}</strong></div>
        </div>
        <div className="pedidos-metrica">
          <div className="pedidos-metrica-icon pedidos-icon-ambar"><Wallet size={18} /></div>
          <div><span>Por cobrar ({metricas.clientesConSaldo} clientes)</span><strong>{formatoMoneda(metricas.totalPorCobrar)}</strong></div>
        </div>
      </div>

      <div className="seg-tabs" role="tablist">
        <button role="tab" aria-selected={vista === 'entregar'} className={`seg-tab ${vista === 'entregar' ? 'activa' : ''}`} onClick={() => cambiarVista('entregar')}>
          <PackageCheck size={15} /> Por entregar <span>{porEntregar.length}</span>
        </button>
        <button role="tab" aria-selected={vista === 'cobrar'} className={`seg-tab ${vista === 'cobrar' ? 'activa' : ''}`} onClick={() => cambiarVista('cobrar')}>
          <Wallet size={15} /> Por cobrar <span>{porCobrar.length}</span>
        </button>
      </div>

      <div className="pedidos-filtros">
        <input
          type="text"
          className="pedidos-buscador"
          placeholder="Buscar por cliente o número de pedido..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {vista === 'entregar' && (
          <label className="seg-check">
            <input type="checkbox" checked={soloListos} onChange={(e) => setSoloListos(e.target.checked)} />
            <span>Solo con algo listo para entregar</span>
          </label>
        )}
      </div>

      {loading ? (
        <div className="pedidos-vacio"><div className="pedidos-spinner"></div><p>Cargando...</p></div>
      ) : grupos.length === 0 ? (
        <div className="pedidos-vacio">
          {vista === 'entregar' ? <PackageCheck size={44} /> : <Wallet size={44} />}
          <p>{vista === 'entregar' ? 'No hay pedidos por entregar.' : 'No hay saldos por cobrar. ¡Todo al día!'}</p>
        </div>
      ) : (
        <div className="seg-grupos">
          {grupos.map((grupo) => {
            const saldoCliente = grupo.pedidos.reduce((s, p) => s + Number(p.resumen?.saldo || 0), 0);
            return (
              <section key={grupo.clave} className="seg-cliente">
                <header className="seg-cliente-header">
                  <div>
                    <strong>{grupo.cliente}</strong>
                    <small>{grupo.telefono || 'Sin teléfono'} · {grupo.pedidos.length} pedido{grupo.pedidos.length > 1 ? 's' : ''}</small>
                  </div>
                  {saldoCliente > 0 && (
                    <span className="seg-saldo">
                      Debe <b>{formatoMoneda(saldoCliente)}</b>
                    </span>
                  )}
                </header>

                {grupo.pedidos.map((pedido) => {
                  const fila = pedido._fila;
                  const r = pedido.resumen || {};
                  const urg = fila.urgencia;
                  return (
                    <div key={pedido.pedidoid} className="seg-pedido">
                      <div className="seg-pedido-info">
                        <div className="seg-pedido-titulo">
                          <button className="pedido-link-venta" onClick={() => navigate(`/dashboard/pedido/${pedido.pedidoid}`)}>
                            Pedido #{pedido.pedidoid}
                          </button>
                          <span className={`pedido-estado pedido-estado-${pedido.estado.replace('_', '-')}`}>{ESTADOS_LABEL[pedido.estado]}</span>
                          {urg && <span className={`seg-urgencia seg-urgencia-${urg.clase}`}>{urg.etiqueta}</span>}
                        </div>

                        {vista === 'entregar' ? (
                          <ul className="seg-lineas">
                            {fila.lineas.map((l) => (
                              <li key={l.detalleid} className={l.lista ? 'lista' : l.hayAlgo ? 'parcial' : 'espera'}>
                                <span className="seg-punto" aria-hidden="true" />
                                {l.productoNombre}{l.talla ? ` (talla ${l.talla})` : ''} x{formatearCantidad(l.pendiente, l.producto?.unidadMedida)}
                                <small>
                                  {l.lista ? ' · listo para entregar' : l.hayAlgo ? ` · hay ${formatearCantidad(l.stock, l.producto?.unidadMedida)} para este pedido` : (l.stockTotal > 0 ? ' · el stock actual es de otro pedido' : (Number(l.enCompra) > 0 ? ' · en camino' : ' · falta comprar'))}
                                </small>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="seg-dinero">
                            <span>Total {formatoMoneda(r.total)}</span>
                            <span>Abonado {formatoMoneda(r.abonado)}</span>
                            <span className="seg-dinero-saldo">Saldo {formatoMoneda(r.saldo)}</span>
                          </div>
                        )}
                      </div>

                      <div className="seg-acciones">
                        {vista === 'entregar' ? (
                          <>
                            <button
                              className="pedidos-btn pedidos-btn-verde pedidos-btn-sm"
                              disabled={!fila.lineas.some((l) => l.hayAlgo)}
                              onClick={() => navigate(`/dashboard/pedido/${pedido.pedidoid}?accion=entregar`)}
                            >
                              <PackageCheck size={13} /><span>Entregar</span>
                            </button>
                            <button
                              className="pedidos-btn pedidos-btn-secundario pedidos-btn-sm"
                              disabled={!fila.lineas.some((l) => l.hayAlgo)}
                              onClick={() => avisarListo(fila)}
                              title="Avisar por WhatsApp que ya puede recogerlo"
                            >
                              <MessageCircle size={13} /><span>Avisar</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="pedidos-btn pedidos-btn-primary pedidos-btn-sm"
                              onClick={() => navigate(`/dashboard/pedido/${pedido.pedidoid}?accion=abono`)}
                            >
                              <Plus size={13} /><span>Registrar abono</span>
                            </button>
                            <button className="pedidos-btn pedidos-btn-secundario pedidos-btn-sm" onClick={() => recordarSaldo(pedido)} title="Recordar el saldo por WhatsApp">
                              <MessageCircle size={13} /><span>Recordar</span>
                            </button>
                          </>
                        )}
                        <button className="pedidos-accion pedidos-accion-ver" title="Ver pedido" onClick={() => navigate(`/dashboard/pedido/${pedido.pedidoid}`)}>
                          <Eye size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Seguimiento;
