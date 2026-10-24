import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Eye, Package, PackageCheck, Plus, Trash2, Truck } from 'lucide-react';

const BADGE_ORDEN = {
  abierta: 'tbl-badge--warning',
  borrador: 'tbl-badge--neutral',
  enviada: 'tbl-badge--primary',
  recibida_parcial: 'tbl-badge--warning',
  recibida: 'tbl-badge--ok',
  anulada: 'tbl-badge--neutral',
};

const ORDEN_COLORS = ['#3B82F6','#8B5CF6','#EC4899','#F59E0B','#10B981','#06B6D4','#EF4444','#6366F1'];
const colorOrden = (id) => ORDEN_COLORS[(Number(id) || 0) % ORDEN_COLORS.length];
import { toast } from 'sonner';
import { eliminarPedidoProveedor, getOrdenesCompra, getSaldoPorCobrar } from '../../../../services/pedidoService';
import { ESTADOS_COMPRA, formatearFecha, formatoMoneda, nombrePedido } from './comprasUtils';
import { useEsMovil } from '../../../../hooks/useEsMovil';
import ListaMovil from '../../../comunes/ListaMovil';
import '../pedidos/Pedidos.css';
import './Compras.css';


// Pedidos al proveedor (Pedido 1, Pedido 2...): cada uno contiene las compras de varios clientes
const TONO_ESTADO = { abierta: 'aviso', enviada: undefined, recibida_parcial: 'aviso', recibida: 'ok', anulada: 'peligro' };

function Compras() {
  const esMovil = useEsMovil();
  const navigate = useNavigate();
  const [ordenes, setOrdenes] = useState([]);
  const [saldoPorCobrar, setSaldoPorCobrar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('todas');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    const cargar = async () => {
      try {
        const [data, saldo] = await Promise.all([getOrdenesCompra(), getSaldoPorCobrar().catch(() => null)]);
        setOrdenes(Array.isArray(data) ? data : []);
        setSaldoPorCobrar(saldo);
      } catch {
        toast.error('No se pudieron cargar los pedidos.');
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const eliminarPedido = (orden) => {
    toast(`¿Eliminar ${nombrePedido(orden)}?`, {
      description: 'Las compras de los clientes no se borran: quedan sueltas con sus abonos. Lo ya recibido en el inventario y los egresos no se revierten.',
      action: {
        label: 'Sí, eliminar',
        onClick: async () => {
          try {
            await eliminarPedidoProveedor(orden.ordenid);
            setOrdenes((prev) => prev.filter((o) => o.ordenid !== orden.ordenid));
            getSaldoPorCobrar().then(setSaldoPorCobrar).catch(() => {});
            toast.success('Pedido eliminado.');
          } catch (error) {
            toast.error(error?.response?.data?.mensaje || 'No se pudo eliminar el pedido.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  const filas = useMemo(() => ordenes.map((orden) => {
    const pedidos = (orden.detalles || []).reduce((s, d) => s + Number(d.cantidad), 0);
    const recibidos = (orden.detalles || []).reduce((s, d) => s + Number(d.cantidadRecibida || 0), 0);
    const comprasVigentes = (orden.compras || []).filter((c) => c.estado !== 'anulado');
    const clientes = [...new Set(comprasVigentes.map((c) => c.cliente?.nombreCliente).filter(Boolean))];
    // Unidades compradas por los clientes (lo que se les puede entregar)
    const productosClientes = comprasVigentes.reduce(
      (s, c) => s + (c.detalles || []).reduce((ss, d) => ss + Number(d.cantidad || 0), 0),
      0
    );
    // En un pedido abierto las líneas al proveedor aún no existen: se suman las compras de clientes.
    // En uno enviado, `detalles` ya incluye clientes y stock.
    const productos = orden.estado === 'abierta' ? pedidos + productosClientes : pedidos;
    const saldo = Number(
      orden.resumenCompras?.saldo
      ?? comprasVigentes.reduce((s, c) => s + Number(c.resumen?.saldo || 0), 0)
    );
    return { orden, pedidos, recibidos, clientes, productos, saldo };
  }), [ordenes]);

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return filas.filter(({ orden, clientes }) => {
      const coincideEstado = filtroEstado === 'todas'
        || orden.estado === filtroEstado;
      const proveedor = orden.proveedor?.nombreProveedor || orden.proveedor?.razonSocial || '';
      const coincideTexto = !texto
        || String(orden.ordenid).includes(texto)
        || (orden.nombre || '').toLowerCase().includes(texto)
        || proveedor.toLowerCase().includes(texto)
        || (orden.descripcion || '').toLowerCase().includes(texto)
        || clientes.some((c) => c.toLowerCase().includes(texto));
      return coincideEstado && coincideTexto;
    });
  }, [filas, filtroEstado, busqueda]);

  const metricas = useMemo(() => {
    const enCamino = filas.filter(({ orden }) => ['enviada', 'recibida_parcial'].includes(orden.estado));
    return {
      abiertos: filas.filter(({ orden }) => orden.estado === 'abierta').length,
      enCamino: enCamino.length,
      porRecibir: enCamino.reduce((s, f) => s + (f.pedidos - f.recibidos), 0),
    };
  }, [filas]);

  const cantidad = (n) => n.toLocaleString('es-CO', { maximumFractionDigits: 3 });

  return (
    <div className="pedidos-container">
      <div className="pedidos-header">
        <div>
          <h1 className="pedidos-title">Pedidos</h1>
          <p className="pedidos-subtitle">Cada pedido es lo que le haces al proveedor. Dentro agregas las compras de tus clientes y llevas sus abonos y entregas.</p>
        </div>
        <div className="pedidos-header-acciones">
          <button className="pedidos-btn pedidos-btn-primary" onClick={() => navigate('/dashboard/pedidos/nuevo')}>
            <Plus size={16} />
            <span>Crear pedido</span>
          </button>
        </div>
      </div>

      <div className="pedidos-metricas">
        <div className="pedidos-metrica">
          <div className="pedidos-metrica-icon pedidos-icon-ambar"><ClipboardList size={18} /></div>
          <div><span>Pedidos abiertos</span><strong>{metricas.abiertos}</strong></div>
        </div>
        <div className="pedidos-metrica">
          <div className="pedidos-metrica-icon pedidos-icon-morado"><Truck size={18} /></div>
          <div><span>En camino · por recibir</span><strong>{metricas.enCamino} · {cantidad(metricas.porRecibir)} und</strong></div>
        </div>
        <div className="pedidos-metrica">
          <div className="pedidos-metrica-icon pedidos-icon-verde"><PackageCheck size={18} /></div>
          <div><span>Saldo por cobrar a clientes</span><strong>{formatoMoneda(saldoPorCobrar?.total)}</strong></div>
        </div>
      </div>

      <div className="pedidos-filtros">
        <input
          type="text"
          className="pedidos-buscador"
          placeholder="Buscar por nombre, número, proveedor o cliente..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select className="pedidos-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="todas">Todos</option>
          {Object.entries(ESTADOS_COMPRA).filter(([key]) => key !== 'borrador').map(([key, c]) => <option key={key} value={key}>{c.label}</option>)}
        </select>
      </div>

      {esMovil ? (
        <ListaMovil
          items={filtradas}
          clave={(f) => f.orden.ordenid}
          cargando={loading}
          vacio="No hay pedidos que coincidan con el filtro."
          onAbrir={(f) => navigate(`/dashboard/pedidos/${f.orden.ordenid}`)}
          fila={({ orden, productos, saldo }) => {
            const estado = ESTADOS_COMPRA[orden.estado] || { label: orden.estado };
            const proveedor = orden.proveedor?.nombreProveedor || orden.proveedor?.razonSocial;
            const compras = orden.resumenCompras?.cantidad || 0;
            return {
              nombre: nombrePedido(orden),
              icono: Package,
              color: colorOrden(orden.ordenid),
              titulo: nombrePedido(orden),
              subtitulo: [
                proveedor || 'Sin proveedor',
                productos > 0 ? `${cantidad(productos)} producto${productos === 1 ? '' : 's'}` : 'Sin productos',
                `${compras} compra${compras === 1 ? '' : 's'}`,
              ].filter(Boolean).join(' · '),
              derecha: formatoMoneda(orden.estado === 'abierta' ? orden.costoEstimado : orden.total),
              derechaSecundaria: saldo > 0 ? `Saldo ${formatoMoneda(saldo)}` : undefined,
              insignia: estado.label,
              tono: TONO_ESTADO[orden.estado],
            };
          }}
        />
      ) : (
      <div className="pedidos-tabla-wrapper">
        {loading ? (
          <div className="pedidos-vacio"><div className="pedidos-spinner"></div><p>Cargando pedidos...</p></div>
        ) : filtradas.length === 0 ? (
          <div className="pedidos-vacio">
            <Truck size={44} />
            <p>No hay pedidos que coincidan con el filtro.</p>
            <button className="pedidos-btn pedidos-btn-primary" onClick={() => navigate('/dashboard/pedidos/nuevo')}>
              <Plus size={16} /><span>Crear pedido</span>
            </button>
          </div>
        ) : (
          <table className="pedidos-tabla tabla-tarjetas">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Proveedor</th>
                <th>Clientes</th>
                <th title="Unidades totales del pedido (compras de clientes y productos para stock)">Productos</th>
                <th>Estado</th>
                <th>Costo</th>
                <th title="Saldo pendiente de las compras de clientes en este pedido">Saldo por cobrar</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(({ orden, clientes, productos, saldo }) => {
                const estado = ESTADOS_COMPRA[orden.estado] || { label: orden.estado, clase: 'anulado' };
                const abierto = orden.estado === 'abierta';
                const badgeClase = BADGE_ORDEN[orden.estado] || 'tbl-badge--neutral';
                const comprasCount = orden.resumenCompras?.cantidad || 0;
                return (
                  <tr key={orden.ordenid} data-fila onClick={() => navigate(`/dashboard/pedidos/${orden.ordenid}`)}>
                    <td data-label="Pedido">
                      <div className="tbl-main-cell">
                        <span className="caja-icono" style={{ '--caja': colorOrden(orden.ordenid) }} aria-hidden="true"><Package size={20} /></span>
                        <div className="tbl-cell-texts">
                          <span className="tbl-cell-primary">{nombrePedido(orden)}</span>
                          <span className="tbl-cell-secondary">#{orden.ordenid} · {formatearFecha(orden.createdAt)}{orden.descripcion ? ` · ${orden.descripcion}` : ''}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label="Proveedor">{orden.proveedor?.nombreProveedor || orden.proveedor?.razonSocial || <span className="tbl-vacio">—</span>}</td>
                    <td data-label="Clientes" className="compras-clientes">
                      {clientes.length === 0 ? <span className="tbl-vacio">—</span> : `${clientes.slice(0, 2).join(', ')}${clientes.length > 2 ? ` +${clientes.length - 2}` : ''}`}
                      {comprasCount > 0 && <small className="compras-nota-corta">{comprasCount} compra{comprasCount !== 1 ? 's' : ''}</small>}
                    </td>
                    <td data-label="Productos">{cantidad(productos)}</td>
                    <td data-label="Estado"><span className={`tbl-badge ${badgeClase}`}>{estado.label}</span></td>
                    <td data-label="Costo" className="pedido-total">{formatoMoneda(abierto ? orden.costoEstimado : orden.total)}</td>
                    <td data-label="Saldo por cobrar">
                      {saldo > 0
                        ? <span className="tbl-badge tbl-badge--danger">{formatoMoneda(saldo)}</span>
                        : <span className="tbl-vacio">—</span>}
                    </td>
                    <td data-label="" onClick={(e) => e.stopPropagation()}>
                      <div className="tbl-actions">
                        <button className="tbl-icon-btn tbl-icon-btn--ver" title="Abrir pedido" onClick={() => navigate(`/dashboard/pedidos/${orden.ordenid}`)}>
                          <Eye size={14} />
                        </button>
                        <button className="tbl-icon-btn tbl-icon-btn--borrar" title="Eliminar pedido" onClick={() => eliminarPedido(orden)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      )}

    </div>
  );
}

export default Compras;
