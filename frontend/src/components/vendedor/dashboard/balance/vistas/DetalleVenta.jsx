import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, TrendingUp, User, Package, Calendar, FileText, Hash, Trash2, Edit2, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { getVentaById, deleteVenta, updateVenta } from '../../../../../services/ventaService';
import { getClientes } from '../../../../../services/clienteService';
import EditTransaccionModal from './EditTransaccionModal';
import './styles/DetalleTransaccion.css';

const formatoMoneda = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

const formatearFecha = (fecha) => {
  const d = new Date(fecha);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function DetalleVenta() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [venta, setVenta] = useState(location.state?.venta ?? null);
  const [loading, setLoading] = useState(!location.state?.venta || !location.state?.venta?.detalles);
  const [showEditModal, setShowEditModal] = useState(false);
  const [clientes, setClientes] = useState([]);

  useEffect(() => {
    if (location.state?.venta?.detalles) {
      setVenta(location.state.venta);
      setLoading(false);
      return;
    }
    const fetchVenta = async () => {
      try {
        setLoading(true);
        const data = await getVentaById(id);
        setVenta(data);
      } catch {
        toast.error('No se pudo cargar la venta.');
        navigate('/dashboard/balance');
      } finally {
        setLoading(false);
      }
    };
    fetchVenta();
  }, [id, navigate, location.state]);

  useEffect(() => {
    getClientes().then(setClientes).catch(() => {});
  }, []);

  const handleEliminar = () => {
    toast('¿Anular esta venta?', {
      description: 'El stock de todos los productos será devuelto al inventario.',
      action: {
        label: 'Sí, anular',
        onClick: async () => {
          try {
            await deleteVenta(id);
            toast.success('Venta anulada. El stock ha sido revertido.');
            navigate('/dashboard/balance');
          } catch {
            toast.error('No se pudo anular la venta.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  const handleEditar = () => setShowEditModal(true);

  const handleSaveEdit = async (data) => {
    try {
      await updateVenta(id, data);
      const clienteObj = clientes.find((c) => String(c.clienteid) === String(data.clienteid));
      setVenta((prev) => ({ ...prev, descripcion: data.descripcion, clienteid: data.clienteid, cliente: clienteObj || null }));
      toast.success('Venta actualizada.');
    } catch {
      toast.error('No se pudo actualizar.');
      throw new Error();
    }
  };

  if (loading) return <div className="view-loading"><div className="loader-spinner-dark" /></div>;
  if (!venta) return null;

  const totalItems = venta.detalles?.reduce((acc, d) => acc + d.cantidad, 0) || 0;

  return (
    <div className="detalle-tx-view">
      <div className="detalle-tx-header">
        <button className="btn-circle-back" onClick={() => navigate('/dashboard/balance')}>
          <ArrowLeft size={18} />
        </button>
        <div className="detalle-tx-header-text">
          <h1>Detalle de Venta</h1>
          <div className="detalle-tx-breadcrumb">
            Balance / Ingresos / <span className="active">Transacción #{venta.ventaid}</span>
          </div>
        </div>
        <div className="detalle-tx-header-actions">
          <button className="btn-edit-tx" onClick={handleEditar}>
            <Edit2 size={13} />
            <span>Editar</span>
          </button>
          <button className="btn-delete-tx" onClick={handleEliminar} title="Anular venta">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="detalle-tx-summary">
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><TrendingUp size={11} /> Total</div>
          <div className="detalle-tx-stat-value amount income">{formatoMoneda(venta.total)}</div>
          <span className="detalle-tx-type-badge income"><TrendingUp size={10} /> Ingreso</span>
        </div>
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><Calendar size={11} /> Fecha</div>
          <div className="detalle-tx-stat-value">{formatearFecha(venta.createdAt)}</div>
        </div>
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><User size={11} /> Cliente</div>
          <div className={`detalle-tx-stat-value ${!venta.cliente ? 'muted' : ''}`}>
            {venta.cliente?.nombreCliente || 'Consumidor Final'}
          </div>
        </div>
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><Hash size={11} /> Items</div>
          <div className="detalle-tx-stat-value">
            {totalItems} <small style={{ fontWeight: 500, fontSize: '0.72rem', color: 'var(--neutral-500)' }}>unds.</small>
          </div>
        </div>
      </div>

      <div className="detalle-tx-description">
        <div className="detalle-tx-description-label"><FileText size={11} /> Descripción</div>
        <div className={`detalle-tx-description-text ${!venta.descripcion ? 'muted' : ''}`}>
          {venta.descripcion || 'Sin descripción registrada.'}
        </div>
      </div>

      <div className="detalle-items-section">
        <div className="detalle-items-header">
          <ShoppingBag size={15} /> Productos en esta venta
        </div>
        <div className="items-table-container">
          <table className="items-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cant.</th>
                <th>Precio Unit.</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {venta.detalles?.map((item, idx) => (
                <tr key={idx}>
                  <td className="item-name">
                    <div className="item-icon"><Package size={13} /></div>
                    {item.productoNombre}
                  </td>
                  <td className="item-qty">{item.cantidad}</td>
                  <td className="item-price">{formatoMoneda(item.precioUnitario)}</td>
                  <td className="item-subtotal">{formatoMoneda(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="3" className="footer-label">Total</td>
                <td className="footer-value">{formatoMoneda(venta.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <EditTransaccionModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveEdit}
        tipo="venta"
        descripcion={venta.descripcion}
        entidadId={venta.clienteid}
        entidades={clientes}
        entidadLabel="Cliente"
        entidadKey="clienteid"
        entidadNombreKey="nombreCliente"
      />
    </div>
  );
}

export default DetalleVenta;
