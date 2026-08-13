import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, TrendingDown, User, Package, Calendar, FileText, Hash, Trash2, Edit2, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { getEgresoById, deleteEgreso, updateEgreso } from '../../../../../services/egresoService';
import { getProveedores } from '../../../../../services/proveedorService';
import EditTransaccionModal from './EditTransaccionModal';
import './styles/DetalleTransaccion.css';

const formatoMoneda = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

const formatearFecha = (fecha) => {
  const d = new Date(fecha);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function DetalleEgreso() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [egreso, setEgreso] = useState(location.state?.egreso ?? null);
  const [loading, setLoading] = useState(!location.state?.egreso || !location.state?.egreso?.detalles);
  const [showEditModal, setShowEditModal] = useState(false);
  const [proveedores, setProveedores] = useState([]);

  useEffect(() => {
    if (location.state?.egreso?.detalles) {
      setEgreso(location.state.egreso);
      setLoading(false);
      return;
    }
    const fetchEgreso = async () => {
      try {
        setLoading(true);
        const data = await getEgresoById(id);
        setEgreso(data);
      } catch {
        toast.error('No se pudo cargar el egreso.');
        navigate('/dashboard/balance');
      } finally {
        setLoading(false);
      }
    };
    fetchEgreso();
  }, [id, navigate, location.state]);

  useEffect(() => {
    getProveedores()
      .then((data) => setProveedores(Array.isArray(data) ? data : data.proveedores || []))
      .catch(() => {});
  }, []);

  const handleEliminar = () => {
    toast('¿Anular este egreso?', {
      description: 'El stock sumado será restado del inventario.',
      action: {
        label: 'Sí, anular',
        onClick: async () => {
          try {
            await deleteEgreso(id);
            toast.success('Egreso anulado. El inventario ha sido ajustado.');
            navigate('/dashboard/balance');
          } catch {
            toast.error('No se pudo anular el egreso.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  const handleEditar = () => setShowEditModal(true);

  const handleSaveEdit = async (data) => {
    try {
      await updateEgreso(id, data);
      const proveedorObj = proveedores.find((p) => String(p.proveedorid) === String(data.proveedorid));
      setEgreso((prev) => ({ ...prev, descripcion: data.descripcion, proveedorid: data.proveedorid, proveedor: proveedorObj || null }));
      toast.success('Egreso actualizado.');
    } catch {
      toast.error('No se pudo actualizar.');
      throw new Error();
    }
  };

  if (loading) return <div className="view-loading"><div className="loader-spinner-dark" /></div>;
  if (!egreso) return null;

  const totalItems = egreso.detalles?.reduce((acc, d) => acc + d.cantidad, 0) || 0;

  return (
    <div className="detalle-tx-view">
      <div className="detalle-tx-header">
        <button className="btn-circle-back" onClick={() => navigate('/dashboard/balance')}>
          <ArrowLeft size={18} />
        </button>
        <div className="detalle-tx-header-text">
          <h1>Detalle de Egreso</h1>
          <div className="detalle-tx-breadcrumb">
            Balance / Egresos / <span className="active">Transacción #{egreso.egresoid}</span>
          </div>
        </div>
        <div className="detalle-tx-header-actions">
          <button className="btn-edit-tx" onClick={handleEditar}>
            <Edit2 size={13} />
            <span>Editar</span>
          </button>
          <button className="btn-delete-tx" onClick={handleEliminar} title="Anular egreso">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="detalle-tx-summary">
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><TrendingDown size={11} /> Total</div>
          <div className="detalle-tx-stat-value amount expense">{formatoMoneda(egreso.total)}</div>
          <span className="detalle-tx-type-badge expense"><TrendingDown size={10} /> Egreso</span>
        </div>
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><Calendar size={11} /> Fecha</div>
          <div className="detalle-tx-stat-value">{formatearFecha(egreso.createdAt)}</div>
        </div>
        <div className="detalle-tx-stat">
          <div className="detalle-tx-stat-label"><User size={11} /> Proveedor</div>
          <div className={`detalle-tx-stat-value ${!egreso.proveedor ? 'muted' : ''}`}>
            {egreso.proveedor?.nombreProveedor || 'General / Varios'}
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
        <div className={`detalle-tx-description-text ${!egreso.descripcion ? 'muted' : ''}`}>
          {egreso.descripcion || 'Sin descripción registrada.'}
        </div>
      </div>

      <div className="detalle-items-section">
        <div className="detalle-items-header">
          <ShoppingBag size={15} /> Productos en este egreso
        </div>
        <div className="items-table-container">
          <table className="items-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cant.</th>
                <th>Precio Compra</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {egreso.detalles?.map((item, idx) => (
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
                <td className="footer-value expense-text">{formatoMoneda(egreso.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <EditTransaccionModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveEdit}
        tipo="egreso"
        descripcion={egreso.descripcion}
        entidadId={egreso.proveedorid}
        entidades={proveedores}
        entidadLabel="Proveedor"
        entidadKey="proveedorid"
        entidadNombreKey="nombreProveedor"
      />
    </div>
  );
}

export default DetalleEgreso;
