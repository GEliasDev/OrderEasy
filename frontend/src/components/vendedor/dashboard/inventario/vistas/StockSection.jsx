import { Layers } from 'lucide-react';
import TallasEditor from './TallasEditor';
import { stepCantidad, unidadInfo } from '../../../../../utils/unidades';
import './styles/TallasEditor.css';

/**
 * Tarjeta "Inventario" de los formularios de producto: stock simple o stock por talla.
 */
function StockSection({
  etiqueta = 'Stock',
  unidad,
  usaTallas,
  setUsaTallas,
  tallas,
  setTallas,
  cantidadDisponible,
  setCantidadDisponible,
}) {
  const { abrev } = unidadInfo(unidad);

  return (
    <div className="form-card-minimal">
      <div className="card-header-minimal">
        <Layers size={18} />
        <h3>Inventario</h3>
      </div>

      <label className="tallas-switch">
        <input type="checkbox" checked={usaTallas} onChange={(e) => setUsaTallas(e.target.checked)} />
        <span className="tallas-switch-track" aria-hidden="true" />
        <span className="tallas-switch-text">
          Este producto se maneja por tallas
          <small>Calzado, ropa... cada talla tiene su propio stock</small>
        </span>
      </label>

      {usaTallas ? (
        <TallasEditor tallas={tallas} onChange={setTallas} unidad={unidad} />
      ) : (
        <div className="form-group-minimal">
          <label>{etiqueta} ({abrev})</label>
          <input
            type="number"
            value={cantidadDisponible}
            onChange={(e) => setCantidadDisponible(e.target.value)}
            required
            min="0"
            step={stepCantidad(unidad)}
          />
        </div>
      )}
    </div>
  );
}

export default StockSection;
