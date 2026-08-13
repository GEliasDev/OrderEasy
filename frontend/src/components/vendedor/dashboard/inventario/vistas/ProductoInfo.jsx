import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import './styles/ProductoInfo.css';
import { deleteProduct, getProductById } from '../../../../../services/productServices';
import { getCategoriesByUser } from '../../../../../services/categoryServices';
import EditarProductoForm from './EditarProductoForm';

function ProductoInfo({ id, onClose, onRefresh }) {
  const [producto, setProducto] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [categorias, setCategorias] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productoData, categoriasData] = await Promise.all([
          getProductById(id),
          getCategoriesByUser(),
        ]);

        if (!productoData) {
          toast.error('No se encontró el producto.');
          onClose();
          return;
        }

        setCategorias(categoriasData);

        if (productoData.categoriaid && categoriasData.length > 0) {
          const cat = categoriasData.find((c) => String(c.categoriaid) === String(productoData.categoriaid));
          if (cat) productoData.categoriaNombre = cat.nombre;
        }

        setProducto(productoData);
      } catch {
        toast.error('Hubo un problema al cargar la información.');
        onClose();
      }
    };

    fetchData();
  }, [id, onClose]);

  const handleDelete = () => {
    toast('¿Eliminar este producto?', {
      description: 'Esta acción no se puede deshacer.',
      action: {
        label: 'Eliminar',
        onClick: async () => {
          try {
            await deleteProduct(id);
            toast.success('Producto eliminado.');
            onClose();
            onRefresh?.();
          } catch {
            toast.error('No se pudo eliminar el producto.');
          }
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  const handleUpdate = (updatedProduct) => {
    if (updatedProduct.categoriaid && categorias.length > 0) {
      const cat = categorias.find((c) => String(c.categoriaid) === String(updatedProduct.categoriaid));
      if (cat) updatedProduct.categoriaNombre = cat.nombre;
    }
    setProducto(updatedProduct);
    setIsEditing(false);
    toast.success('Producto actualizado correctamente.');
    onRefresh?.();
  };

  if (!producto) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{isEditing ? 'Editar Producto' : 'Detalles del Producto'}</h2>
        <button className="detalle-cerrar" onClick={onClose}>X</button>

        {isEditing ? (
          <EditarProductoForm
            producto={producto}
            onClose={() => setIsEditing(false)}
            onUpdate={handleUpdate}
          />
        ) : (
          <div className="modal-scroll">
            <div className="detalle-imagen-container">
              {producto.imagenes?.length > 0 ? (
                <img
                  src={producto.imagenes[0].startsWith('http') ? producto.imagenes[0] : `http://localhost:3000/uploads/${producto.imagenes[0]}`}
                  alt={producto.nombre}
                  className="detalle-imagen"
                  onError={(e) => (e.target.src = '/images/default-product.png')}
                />
              ) : (
                <img src="/images/default-product.png" alt="Sin imagen" className="detalle-imagen" />
              )}
            </div>

            <div className="detalle-info">
              <h3 className="detalle-titulo">{producto.nombre}</h3>
              <p><strong>Descripción:</strong> {producto.descripcion}</p>
              <p><strong>Cantidad Disponible:</strong> {producto.cantidadDisponible}</p>
              <p><strong>Precio de Compra:</strong> {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(producto.precioCompra)}</p>
              <p><strong>Precio de Venta:</strong> {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(producto.precioVenta)}</p>
              <p><strong>Categoría:</strong> {producto.categoriaNombre || 'Sin categoría'}</p>
            </div>

            <div className="detalle-acciones">
              <button className="detalle-editar-btn" onClick={() => setIsEditing(true)}>Editar</button>
              <button className="detalle-eliminar-btn" onClick={handleDelete}>Eliminar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductoInfo;
