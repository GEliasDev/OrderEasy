import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ClipboardList, Eye, Plus, ShoppingBag, Truck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  anularPedido,
  confirmarPedido,
  convertirPedidoAVenta,
  getPedidos,
} from '../../../../services/pedidoService';
import './Pedidos.css';

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

const formatearFecha = (fecha) => {
  if (!fecha) return 'Sin fecha';
  return new Date(`${fecha}`.length === 10 ? `${fecha}T12:00:00` : fecha)
    .toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

function Pedidos() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  const cargarPedidos = async () => {
    try {
      setLoading(true);
      const data = await getPedidos();
      setPedidos(Array.isArray(data) ? data : []);
    } catch {
      toast.error('No se pudieron cargar los pedidos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPedidos();
  }, []);

  const pedidosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return pedidos.filter((pedido) => {
      const coincideEstado = filtroEstado === 'todos' || pedido.estado === filtroEstado;
      const cliente = pedido.cliente?.nombreCliente || 'Consumidor final';
      const coincideBusqueda = !texto
        || cliente.toLowerCase().includes(texto)
        || String(pedido.pedidoid).includes(texto)
        || (pedido.descripcion || '').toLowerCase().includes(texto);
      return coincideEstado && coincideBusqueda;
    });
  }, [pedidos, filtroEstado, busqueda]);

  const metricas = useMemo(() => ({
    total: pedidos.length,
    pendientes: pedidos.filter((pedido) => pedido.estado === 'pendiente').length,
    enCompra: pedidos.filter((pedido) => pedido.estado === 'en_compra').length,
    porEntregar: pedidos.filter((pedido) => ['confirmado', 'recibido'].includes(pedido.estado)).length,
  }), [pedidos]);

  const handleConfirmar = async (pedido) => {
    try {
      await confirmarPedido(pedido.pedidoid);
      toast.success('Pedido confirmado y stock reservado.');
      cargarPedidos();
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo confirmar el pedido.');
    }
  };

  const handleAnular = (pedido) => {
    toast('¿Anular este pedido?', {
      description: 'Se liberará el stock reservado y se anularán las órdenes de compra pendientes.',
      action: {
        label: 'Sí, anular',
        onClick: async () => {
          try {
            await anularPedido(pedido.pedidoid);
            toast.success('Pedido anulado.');
            cargarPedidos();
          } catch (error) {
            toast.error(error?.response?.data?.mensaje || 'No se pudo anular el pedido.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  const handleConvertir = (pedido) => {
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

  return (
    <div className="pedidos-container">
      <div className="pedidos-header">
        <div>
          <h1 className="pedidos-title">Pedidos</h1>
          <p className="pedidos-subtitle">Registra pedidos de clientes y compra al proveedor solo lo que falte.</p>
        </div>
        <button className="pedidos-btn pedidos-btn-primary" onClick={() => navigate('/dashboard/nuevo-pedido')}>
          <Plus size={16} />
          <span>Nuevo pedido</span>
        </button>
      </div>

      <div className="pedidos-metricas">
        <div className="pedidos-metrica">
          <div className="pedidos-metrica-icon"><ClipboardList size={18} /></div>
          <div>
            <span>Total pedidos</span>
            <strong>{metricas.total}</strong>
          </div>
        </div>
        <div className="pedidos-metrica">
          <div className="pedidos-metrica-icon pedidos-icon-ambar"><ShoppingBag size={18} /></div>
          <div>
            <span>Pendientes</span>
            <strong>{metricas.pendientes}</strong>
          </div>
        </div>
        <div className="pedidos-metrica">
          <div className="pedidos-metrica-icon pedidos-icon-morado"><Truck size={18} /></div>
          <div>
            <span>En compra</span>
            <strong>{metricas.enCompra}</strong>
          </div>
        </div>
        <div className="pedidos-metrica">
          <div className="pedidos-metrica-icon pedidos-icon-verde"><Check size={18} /></div>
          <div>
            <span>Por entregar</span>
            <strong>{metricas.porEntregar}</strong>
          </div>
        </div>
      </div>

      <div className="pedidos-filtros">
        <input
          type="text"
          className="pedidos-buscador"
          placeholder="Buscar por cliente, número o nota..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select
          className="pedidos-select"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="todos">Todos los estados</option>
          {Object.entries(ESTADOS).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
      </div>

      <div className="pedidos-tabla-wrapper">
        {loading ? (
          <div className="pedidos-vacio">
            <div className="pedidos-spinner"></div>
            <p>Cargando pedidos...</p>
          </div>
        ) : pedidosFiltrados.length === 0 ? (
          <div className="pedidos-vacio">
            <ClipboardList size={44} />
            <p>No hay pedidos que coincidan con el filtro.</p>
            <button className="pedidos-btn pedidos-btn-primary" onClick={() => navigate('/dashboard/nuevo-pedido')}>
              <Plus size={16} />
              <span>Crear el primero</span>
            </button>
          </div>
        ) : (
          <table className="pedidos-tabla">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Entrega</th>
                <th>Estado</th>
                <th>Items</th>
                <th>Total</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pedidosFiltrados.map((pedido) => {
                const items = (pedido.detalles || []).reduce((sum, detalle) => sum + Number(detalle.cantidad), 0);
                const estadoConfig = ESTADOS[pedido.estado] || { label: pedido.estado, clase: 'anulado' };
                return (
                  <tr key={pedido.pedidoid} onClick={() => navigate(`/dashboard/pedido/${pedido.pedidoid}`)}>
                    <td className="pedido-id">#{pedido.pedidoid}</td>
                    <td>{pedido.cliente?.nombreCliente || 'Consumidor final'}</td>
                    <td>{formatearFecha(pedido.createdAt)}</td>
                    <td>{pedido.fechaEntrega ? formatearFecha(pedido.fechaEntrega) : 'Sin fecha'}</td>
                    <td><span className={`pedido-estado pedido-estado-${estadoConfig.clase}`}>{estadoConfig.label}</span></td>
                    <td>{items}</td>
                    <td className="pedido-total">{formatoMoneda(pedido.total)}</td>
                    <td>
                      <div className="pedidos-acciones" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="pedidos-accion pedidos-accion-ver"
                          title="Ver detalle"
                          onClick={() => navigate(`/dashboard/pedido/${pedido.pedidoid}`)}
                        >
                          <Eye size={14} />
                        </button>
                        {pedido.estado === 'pendiente' && (
                          <button
                            className="pedidos-accion pedidos-accion-confirmar"
                            title="Confirmar y reservar stock"
                            onClick={() => handleConfirmar(pedido)}
                          >
                            <Check size={14} />
                          </button>
                        )}
                        {['confirmado', 'en_compra', 'recibido'].includes(pedido.estado) && (
                          <button
                            className="pedidos-accion pedidos-accion-venta"
                            title="Convertir en venta"
                            onClick={() => handleConvertir(pedido)}
                          >
                            <ShoppingBag size={14} />
                          </button>
                        )}
                        {!['entregado', 'anulado'].includes(pedido.estado) && (
                          <button
                            className="pedidos-accion pedidos-accion-anular"
                            title="Anular pedido"
                            onClick={() => handleAnular(pedido)}
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Pedidos;
