import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { TALLAS_PRESET, compararTallas, stepCantidad, formatearCantidad } from '../../../../../utils/unidades';
import './styles/TallasEditor.css';

/**
 * Editor del stock por talla de un producto.
 * `tallas`: [{ talla, cantidadDisponible, cantidadReservada? }]. Las tallas con stock reservado en pedidos no se pueden quitar.
 */
function TallasEditor({ tallas, onChange, unidad = 'und' }) {
  const [nueva, setNueva] = useState('');

  const existe = (talla) => tallas.some((t) => String(t.talla).toLowerCase() === String(talla).toLowerCase());
  const ordenar = (lista) => [...lista].sort((a, b) => compararTallas(a.talla, b.talla));

  const agregar = (talla) => {
    const limpia = String(talla).trim();
    if (!limpia || existe(limpia)) return;
    onChange(ordenar([...tallas, { talla: limpia, cantidadDisponible: '' }]));
  };

  const agregarPreset = (preset) => {
    const faltantes = preset.tallas.filter((t) => !existe(t));
    if (faltantes.length === 0) return;
    onChange(ordenar([...tallas, ...faltantes.map((talla) => ({ talla, cantidadDisponible: '' }))]));
  };

  const cambiarStock = (talla, valor) =>
    onChange(tallas.map((t) => (t.talla === talla ? { ...t, cantidadDisponible: valor } : t)));

  const quitar = (talla) => onChange(tallas.filter((t) => t.talla !== talla));

  const total = tallas.reduce((acc, t) => acc + (Number(t.cantidadDisponible) || 0), 0);

  const confirmarNueva = () => {
    agregar(nueva);
    setNueva('');
  };

  return (
    <div className="tallas-editor">
      <div className="tallas-presets">
        <span className="tallas-presets-label">Agregar rápido:</span>
        {TALLAS_PRESET.map((p) => (
          <button key={p.key} type="button" className="tallas-chip" onClick={() => agregarPreset(p)}>
            {p.label}
          </button>
        ))}
      </div>

      {tallas.length > 0 && (
        <div className="tallas-lista">
          <div className="tallas-fila tallas-fila-head">
            <span>Talla</span>
            <span>Stock</span>
            <span />
          </div>
          {tallas.map((t) => {
            const reservada = Number(t.cantidadReservada) || 0;
            return (
              <div key={t.talla} className="tallas-fila">
                <span className="tallas-nombre">{t.talla}</span>
                <input
                  type="number"
                  className="tallas-input"
                  value={t.cantidadDisponible}
                  onChange={(e) => cambiarStock(t.talla, e.target.value)}
                  min="0"
                  step={stepCantidad(unidad)}
                  placeholder="0"
                  aria-label={`Stock de la talla ${t.talla}`}
                />
                <button
                  type="button"
                  className="tallas-quitar"
                  onClick={() => quitar(t.talla)}
                  disabled={reservada > 0}
                  title={reservada > 0 ? `Tiene ${formatearCantidad(reservada, unidad)} reservadas en pedidos` : 'Quitar talla'}
                  aria-label={`Quitar talla ${t.talla}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="tallas-nueva">
        <input
          type="text"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault(); // no enviar el formulario del producto
              confirmarNueva();
            }
          }}
          placeholder="Otra talla (ej: 41, XXL, Única)"
          maxLength={20}
          aria-label="Nueva talla"
        />
        <button type="button" className="tallas-chip tallas-chip-add" onClick={confirmarNueva} disabled={!nueva.trim() || existe(nueva.trim())}>
          <Plus size={14} /> Agregar
        </button>
      </div>

      <div className="tallas-total">
        Stock total: <strong>{formatearCantidad(total, unidad)}</strong>
        <span> en {tallas.length} {tallas.length === 1 ? 'talla' : 'tallas'}</span>
      </div>
    </div>
  );
}

export default TallasEditor;
