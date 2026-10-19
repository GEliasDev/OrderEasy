import { useEffect } from 'react';
import { X } from 'lucide-react';
import { tallasOrdenadas, formatearCantidad } from '../../../../../utils/unidades';
import './styles/SelectorTalla.css';

/**
 * Ventana para elegir la talla de un producto antes de agregarlo al carrito.
 * modo "venta": las tallas sin stock disponible no se pueden elegir.
 * modo "pedido" y "compra": cualquier talla se puede elegir (se puede pedir o comprar sin stock).
 */
function SelectorTalla({ producto, modo = 'venta', onSelect, onClose }) {
  const tallas = tallasOrdenadas(producto);

  useEffect(() => {
    const cerrarConEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', cerrarConEsc);
    return () => window.removeEventListener('keydown', cerrarConEsc);
  }, [onClose]);

  return (
    <div className="selector-talla-overlay" onClick={onClose}>
      <div
        className="selector-talla-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Elegir talla de ${producto.nombre}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="selector-talla-header">
          <div>
            <h3>Elige la talla</h3>
            <p>{producto.nombre}</p>
          </div>
          <button type="button" className="selector-talla-cerrar" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="selector-talla-grid">
          {tallas.map((v) => {
            const disponible = Math.max(0, Number(v.cantidadDisponible) - Number(v.cantidadReservada || 0));
            const bloqueada = modo === 'venta' && disponible <= 0;
            const detalle = modo === 'compra'
              ? `Stock ${formatearCantidad(v.cantidadDisponible, producto.unidadMedida)}`
              : disponible > 0
                ? `${formatearCantidad(disponible, producto.unidadMedida)} disp.`
                : (modo === 'pedido' ? 'Bajo pedido' : 'Agotada');
            return (
              <button
                key={v.varianteid}
                type="button"
                className={`selector-talla-opcion ${bloqueada ? 'agotada' : ''}`}
                disabled={bloqueada}
                onClick={() => onSelect(v)}
              >
                <strong>{v.talla}</strong>
                <span>{detalle}</span>
              </button>
            );
          })}
        </div>

        {tallas.length === 0 && (
          <p className="selector-talla-vacio">Este producto no tiene tallas registradas. Agrégalas desde Inventario.</p>
        )}
      </div>
    </div>
  );
}

export default SelectorTalla;
