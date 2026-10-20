import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Eye, PackageCheck, Plus, Truck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { crearPedidoProveedor, getOrdenesCompra } from '../../../../services/pedidoService';
import { ESTADOS_COMPRA, formatearFecha, formatoMoneda } from './comprasUtils';
import '../pedidos/Pedidos.css';
import './Compras.css';

const ESTADOS_ACTIVOS = ['abierta', 'borrador', 'enviada', 'recibida_parcial'];

// Pedidos al proveedor (Pedido 1, Pedido 2...): cada uno contiene las compras de varios clientes
function Compras() {
  const navigate = useNavigate();
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creando, setCreando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('activas');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await getOrdenesCompra();
        setOrdenes(Array.isArray(data) ? data : []);
      } catch {
        toast.error('No se pudieron cargar los pedidos.');
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const crearPedido = async () => {
    try {
      setCreando(true);
      const orden = await crearPedidoProveedor();
      toast.success(`Pedido #${orden.ordenid} creado. Agrégale las compras de tus clientes.`);
      navigate(`/dashboard/pedidos/${orden.ordenid}`);
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo crear el pedido.');
      setCreando(false);
    }
  };

  const filas = useMemo(() => ordenes.map((orden) => {
    const pedidos = (orden.detalles || []).reduce((s, d) => s + Number(d.cantidad), 0);
    const recibidos = (orden.detalles || []).reduce((s, d) => s + Number(d.cantidadRecibida || 0), 0);
    const clientes = [...new Set((orden.compras || []).filter((c) => c.estado !== 'anulado').map((c) => c.cliente?.nombreCliente).filter(Boolean))];
    return { orden, pedidos, recibidos, clientes };
  }), [ordenes]);

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return filas.filter(({ orden, clientes }) => {
      const coincideEstado = filtroEstado === 'todas'
        || (filtroEstado === 'activas' ? ESTADOS_ACTIVOS.includes(orden.estado) : orden.estado === filtroEstado);
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
    const enCamino = filas.filter(({ orden }) => ['enviada', 'recibida_parcial'].includes(orden.estado));
    return {
      abiertos: filas.filter(({ orden }) => orden.estado === 'abierta').length,
      enCamino: enCamino.length,
      porRecibir: enCamino.reduce((s, f) => s + (f.pedidos - f.recibidos), 0),
      saldoClientes: filas
        .filter(({ orden }) => ESTADOS_ACTIVOS.includes(orden.estado))
        .reduce((s, f) => s + Number(f.orden.resumenCompras?.saldo || 0), 0),
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
          <button className="pedidos-btn pedidos-btn-secundario" onClick={() => navigate('/dashboard/seguimiento')}>
            <Users size={16} />
            <span>Seguimiento de clientes</span>
          </button>
          <button className="pedidos-btn pedidos-btn-secundario" onClick={() => navigate('/dashboard/compras')}>
            <ClipboardList size={16} />
            <span>Compras de clientes</span>
          </button>
          <button className="pedidos-btn pedidos-btn-primary" onClick={crearPedido} disabled={creando}>
            <Plus size={16} />
            <span>{creando ? 'Creando...' : 'Crear pedido'}</span>
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
          <div><span>Saldo por cobrar a clientes</span><strong>{formatoMoneda(metricas.saldoClientes)}</strong></div>
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
          <option value="activas">Activos</option>
          <option value="todas">Todos</option>
          {Object.entries(ESTADOS_COMPRA).filter(([key]) => key !== 'borrador').map(([key, c]) => <option key={key} value={key}>{c.label}</option>)}
        </select>
      </div>

      <div className="pedidos-tabla-wrapper">
        {loading ? (
          <div className="pedidos-vacio"><div className="pedidos-spinner"></div><p>Cargando pedidos...</p></div>
        ) : filtradas.length === 0 ? (
          <div className="pedidos-vacio">
            <Truck size={44} />
            <p>No hay pedidos que coincidan con el filtro.</p>
            <button className="pedidos-btn pedidos-btn-primary" onClick={crearPedido} disabled={creando}>
              <Plus size={16} /><span>Crear pedido</span>
            </button>
          </div>
        ) : (
          <table className="pedidos-tabla">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Proveedor</th>
                <th>Clientes</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Recibido</th>
                <th>Costo al proveedor</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(({ orden, pedidos, recibidos, clientes }) => {
                const estado = ESTADOS_COMPRA[orden.estado] || { label: orden.estado, clase: 'anulado' };
                const abierto = orden.estado === 'abierta';
                return (
                  <tr key={orden.ordenid} onClick={() => navigate(`/dashboard/pedidos/${orden.ordenid}`)}>
                    <td className="pedido-id">
                      #{orden.ordenid}
                      {orden.descripcion && <small className="compras-nota-corta">{orden.descripcion}</small>}
                    </td>
                    <td>{orden.proveedor?.nombreProveedor || orden.proveedor?.razonSocial || 'Sin proveedor'}</td>
                    <td className="compras-clientes">
                      {clientes.length === 0 ? '—' : `${clientes.slice(0, 2).join(', ')}${clientes.length > 2 ? ` +${clientes.length - 2}` : ''}`}
                      {(orden.resumenCompras?.cantidad || 0) > 0 && <small className="compras-nota-corta">{orden.resumenCompras.cantidad} compra(s)</small>}
                    </td>
                    <td>{formatearFecha(orden.createdAt)}</td>
                    <td><span className={`pedido-estado pedido-estado-${estado.clase}`}>{estado.label}</span></td>
                    <td>{abierto ? '—' : `${cantidad(recibidos)} / ${cantidad(pedidos)}`}</td>
                    <td className="pedido-total">{abierto ? '—' : formatoMoneda(orden.total)}</td>
                    <td>
                      <div className="pedidos-acciones" onClick={(e) => e.stopPropagation()}>
                        <button className="pedidos-accion pedidos-accion-ver" title="Abrir pedido" onClick={() => navigate(`/dashboard/pedidos/${orden.ordenid}`)}>
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
