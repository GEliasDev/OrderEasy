import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Edit3, Trash2, Package, Info, TrendingUp, Barcode } from 'lucide-react';
import { deleteProduct, getProductById } from '../../../../../services/productServices';
import './styles/DetalleProducto.css';

function DetalleProducto() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [producto, setProducto] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const productoData = await getProductById(id);

        if (!productoData) {
          toast.error('No se pudo cargar el producto.');
          navigate('/dashboard/inventario');
          return;
        }

        setProducto(productoData);
      } catch {
        toast.error('Ocurrió un error inesperado.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, navigate]);

  const handleDelete = () => {
    toast('¿Eliminar este producto?', {
      description: 'Esta acción borrará el registro permanentemente.',
      action: {
        label: 'Eliminar',
        onClick: async () => {
          try {
            await deleteProduct(id);
            navigate('/dashboard/inventario');
          } catch {
            toast.error('No se pudo eliminar.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  if (loading) return <div className="view-loading"><div className="loader-spinner" /></div>;
  if (!producto) return null;

  const margen = producto.precioCompra > 0
    ? (((producto.precioVenta - producto.precioCompra) / producto.precioCompra) * 100).toFixed(1)
    : null;

  return (
    <div className="product-detail-view">
      <div className="view-header">
        <button className="btn-circle-back" onClick={() => navigate('/dashboard/inventario')}>
          <ArrowLeft size={22} />
        </button>
        <div className="header-text">
          <h1>Detalles del Producto</h1>
          <div className="detail-breadcrumb">
            <span>Inventario</span> / <span className="active">{producto.nombre}</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-edit-minimal" onClick={() => navigate(`/dashboard/producto/${id}/editar`)}>
            <Edit3 size={18} />
            <span>Editar</span>
          </button>
          <button className="btn-delete-minimal" onClick={handleDelete}>
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="detail-main-container">
        <div className="detail-split-grid">
          <div className="detail-image-card">
            <div className="detail-image-box">
              {producto.imagenes?.length > 0 ? (
                <img
                  src={producto.imagenes[0].startsWith('http') ? producto.imagenes[0] : `http://localhost:3000/uploads/${producto.imagenes[0]}`}
                  alt={producto.nombre}
                  onError={(e) => (e.target.src = '/images/default-product.png')}
                />
              ) : (
                <img src="/images/default-product.png" alt="default" />
              )}
            </div>
            <div className={`detail-status ${producto.cantidadDisponible > 0 ? 'in-stock' : 'no-stock'}`}>
              {producto.cantidadDisponible > 0 ? 'Disponible' : 'Agotado'}
            </div>
          </div>

          <div className="detail-info-card">
            <div className="info-section-minimal">
              <div className="info-title-group">
                <span className="info-label"><Package size={14} /> Producto</span>
                <h2>{producto.nombre}</h2>
                <span className="info-category-tag">{producto.categoriaNombre || 'Sin categoría'}</span>
              </div>

              <div className="info-description-minimal">
                <span className="info-label"><Info size={14} /> Descripción</span>
                <p>{producto.descripcion || 'Sin descripción proporcionada.'}</p>
              </div>

              <div className="detail-stats-minimal">
                <div className="stat-card-minimal">
                  <span className="stat-label">Stock Actual</span>
                  <span className="stat-val">{producto.cantidadDisponible} <small>unds.</small></span>
                </div>
                <div className="stat-card-minimal">
                  <span className="stat-label">Precio Compra</span>
                  <span className="stat-val">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(producto.precioCompra)}</span>
                </div>
                <div className="stat-card-minimal primary">
                  <span className="stat-label">Precio Venta</span>
                  <span className="stat-val">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(producto.precioVenta)}</span>
                </div>
              </div>

              <div className="barcode-row">
                <span className="barcode-label">IVA</span>
                <span className="barcode-value">{producto.tasaIva ?? 0}%</span>
              </div>

              {producto.codigoBarras && (
                <div className="barcode-row">
                  <Barcode size={14} />
                  <span className="barcode-label">Código de barras</span>
                  <span className="barcode-value">{producto.codigoBarras}</span>
                </div>
              )}

              {margen !== null && (
                <div className="profit-analysis-minimal">
                  <div className="profit-header">
                    <span><TrendingUp size={14} /> Análisis de Rentabilidad</span>
                    <strong>{margen}%</strong>
                  </div>
                  <div className="profit-bar-minimal">
                    <div className="profit-bar-inner" style={{ width: `${Math.min(Number(margen), 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DetalleProducto;
