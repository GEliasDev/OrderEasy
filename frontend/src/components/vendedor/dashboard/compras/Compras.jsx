import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, PackageCheck, Plus, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { getOrdenesCompra } from '../../../../services/pedidoService';
import { ESTADOS_COMPRA, asignacionActiva, formatearFecha, formatoMoneda } from './comprasUtils';
import '../pedidos/Pedidos.css';
import './Compras.css';

// Clientes a los que va destinada la compra (sin los que cancelaron)
const clientesDe = (orden) => {
  const nombres = new Set();
  for (const detalle of orden.detalles || []) {
    for (const asignacion of detalle.asignaciones || []) {
      if (!asignacionActiva(asignacion)) continue;
      const nombre = asignacion.pedidoDetalle?.pedido?.cliente?.nombreCliente;
      if (nombre) nombres.add(nombre);
    }
  }
  return [...nombres];
};

function Compras() {
  const navigate = useNavigate();
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('activas');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await getOrdenesCompra();
        setOrdenes(Array.isArray(data) ? data : []);
      } catch {
        toast.error('No se pudieron cargar las compras.');
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const filas = useMemo(() => ordenes.map((orden) => {
    const comprados = (orden.detalles || []).reduce((s, d) => s + Number(d.cantidad), 0);
    const recibidos = (orden.detalles || []).reduce((s, d) => s + Number(d.cantidadRecibida || 0), 0);
    return { orden, comprados, recibidos, clientes: clientesDe(orden) };
  }), [ordenes]);

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return filas.filter(({ orden, clientes }) => {
      const activa = ['borrador', 'enviada', 'recibida_parcial'].includes(orden.estado);
      const coincideEstado = filtroEstado === 'todas'
        || (filtroEstado === 'activas' ? activa : orden.estado === filtroEstado);
      const proveedor = orden.proveedor?.nombreProveedor || orden.proveedor?.razonSocial || '';
      const coincideTexto = !texto
        || String(orden.ordenid).includes(texto)
        || proveedor.toLowerCase().includes(texto)
        || (orden.descripcion || '').toLowerCase().includes(texto)
        || clientes.some((c) => c.toLowerCase().includes(texto));
      return coincideEstado && coincideTexto;
    });
  }, [filas, filtroEstado, busqueda]);

  const metricas = useMemo(() => {
    const activas = filas.filter(({ orden }) => ['enviada', 'recibida_parcial'].includes(orden.estado));
    return {
      enCamino: activas.length,
      porRecibir: activas.reduce((s, f) => s + (f.comprados - f.recibidos), 0),
      invertido: activas.reduce((s, f) => s + Number(f.orden.total), 0),
    };
  }, [filas]);

  return (
    <div className="pedidos-container">
      <div className="pedidos-header">
        <div className="compras-titulo-fila">
          <button className="btn-circle-back" onClick={() => navigate('/dashboard/pedidos')} title="Volver a pedidos">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="pedidos-title">Compras al proveedor</h1>
            <p className="pedidos-subtitle">Compra de una vez lo que necesitan varios pedidos y reparte lo que llega entre tus clientes.</p>
          </div>
        </div>
        <button className="pedidos-btn pedidos-btn-primary" onClick={() => navigate('/dashboard/nueva-compra')}>
          <Plus size={16} />
          <span>Nueva compra</span>
        </button>
      </div>

      <div className="pedidos-metricas">
        <div className="pedidos-metrica">
          <div className="pedidos-metrica-icon pedidos-icon-morado"><Truck size={18} /></div>
          <div><span>Compras en camino</span><strong>{metricas.enCamino}</strong></div>
        </div>
        <div className="pedidos-metrica">
          <div className="pedidos-metrica-icon pedidos-icon-verde"><PackageCheck size={18} /></div>
          <div><span>Unidades por recibir</span><strong>{metricas.porRecibir.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</strong></div>
        </div>
        <div className="pedidos-metrica">
          <div className="pedidos-metrica-icon pedidos-icon-ambar"><Truck size={18} /></div>
          <div><span>Invertido en camino</span><strong>{formatoMoneda(metricas.invertido)}</strong></div>
        </div>
      </div>

      <div className="pedidos-filtros">
        <input
          type="text"
          className="pedidos-buscador"
          placeholder="Buscar por número, proveedor, cliente o nota..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select className="pedidos-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="activas">Activas (por recibir)</option>
          <option value="todas">Todas</option>
          {Object.entries(ESTADOS_COMPRA).map(([key, c]) => <option key={key} value={key}>{c.label}</option>)}
        </select>
      </div>

      <div className="pedidos-tabla-wrapper">
        {loading ? (
          <div className="pedidos-vacio"><div className="pedidos-spinner"></div><p>Cargando compras...</p></div>
        ) : filtradas.length === 0 ? (
          <div className="pedidos-vacio">
            <Truck size={44} />
            <p>No hay compras que coincidan con el filtro.</p>
            <button className="pedidos-btn pedidos-btn-primary" onClick={() => navigate('/dashboard/nueva-compra')}>
              <Plus size={16} /><span>Crear una compra</span>
            </button>
          </div>
        ) : (
          <table className="pedidos-tabla">
            <thead>
              <tr>
                <th>Compra</th>
                <th>Proveedor</th>
                <th>Para</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Recibido</th>
                <th>Total</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(({ orden, comprados, recibidos, clientes }) => {
                const estado = ESTADOS_COMPRA[orden.estado] || { label: orden.estado, clase: 'anulado' };
                return (
                  <tr key={orden.ordenid} onClick={() => navigate(`/dashboard/compra/${orden.ordenid}`)}>
                    <td className="pedido-id">#{orden.ordenid}</td>
                    <td>{orden.proveedor?.nombreProveedor || orden.proveedor?.razonSocial || 'Sin proveedor'}</td>
                    <td className="compras-clientes">
                      {clientes.length === 0 ? '—' : `${clientes.slice(0, 2).join(', ')}${clientes.length > 2 ? ` +${clientes.length - 2}` : ''}`}
                    </td>
                    <td>{formatearFecha(orden.createdAt)}</td>
                    <td><span className={`pedido-estado pedido-estado-${estado.clase}`}>{estado.label}</span></td>
                    <td>{recibidos.toLocaleString('es-CO', { maximumFractionDigits: 3 })} / {comprados.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</td>
                    <td className="pedido-total">{formatoMoneda(orden.total)}</td>
                    <td>
                      <div className="pedidos-acciones" onClick={(e) => e.stopPropagation()}>
                        <button className="pedidos-accion pedidos-accion-ver" title="Ver detalle" onClick={() => navigate(`/dashboard/compra/${orden.ordenid}`)}>
                          <Eye size={14} />
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
    </div>
  );
}

export default Compras;
