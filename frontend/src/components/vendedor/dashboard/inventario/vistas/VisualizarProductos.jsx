import React from 'react';
import { Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './styles/VisualizarProductos.css';

function VisualizarProductos({ productos }) {
  const navigate = useNavigate();

  const handleProductoClick = (id) => {
    navigate(`/dashboard/producto/${id}`);
  };

  if (!productos || productos.length === 0) {
    return (
      <div className="empty-state">
        <Package className="empty-state-icon" />
        <p className="empty-state-title">Sin productos</p>
        <p className="empty-state-text">No hay productos en esta categoría o búsqueda.</p>
      </div>
    );
  }

  return (
    <div className="productos-container">
      {productos.map((producto) => (
        <div
          key={producto.productoid}
          className="producto-card"
          onClick={() => handleProductoClick(producto.productoid)}
        >
          <div className="producto-imagen-container">
            {producto.imagenes && producto.imagenes.length > 0 ? (
              <img
                src={producto.imagenes[0].startsWith("http") ? producto.imagenes[0] : `http://localhost:3000/uploads/${producto.imagenes[0]}`}
                alt={producto.nombre}
                className="producto-imagen"
                onError={(e) => (e.target.src = "/images/default-product.png")}
              />
            ) : (
              <img
                src="/images/default-product.png"
                alt="Sin imagen"
                className="producto-imagen"
              />
            )}
          </div>
          <h3 className="producto-nombre">{producto.nombre}</h3>
          <p className="producto-cantidad">Stock: {producto.cantidadDisponible}</p>
        </div>
      ))}
    </div>
  );
}

export default VisualizarProductos;
