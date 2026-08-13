import { X, ShoppingCart } from 'lucide-react';

function CarritoCaja({
  items,
  descuentoTotal,
  descuentoTipoTotal,
  onCantidadChange,
  onDescuentoItemChange,
  onEliminarItem,
  onDescuentoTotalChange,
  totales,
  ivaDesglose = [],
  totalIva = 0,
}) {
  return (
    <div className="carrito-container">
      <div className="carrito-header">
        <h3 className="carrito-titulo">Carrito</h3>
        {items.length > 0 && (
          <span className="carrito-badge">{items.length}</span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="carrito-vacio">
          <ShoppingCart size={36} className="carrito-vacio-icon" />
          <span>Agrega productos para comenzar</span>
        </div>
      ) : (
        <>
          <table className="carrito-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="td-cantidad">Cant.</th>
                <th className="td-descuento">Desc.</th>
                <th className="col-subtotal">Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const subtotal = item.cantidad * Number(item.producto.precioVenta);
                const descItem = item.descuentoTipo === 'porcentaje'
                  ? subtotal * (Number(item.descuento) / 100)
                  : Number(item.descuento);
                const neto = subtotal - descItem;

                return (
                  <tr key={item.producto.productoid}>
                    <td className="td-nombre">
                      <span className="item-nombre">{item.producto.nombre}</span>
                      <span className="item-precio-unit">
                        ${Number(item.producto.precioVenta).toLocaleString('es-CO')} c/u
                      </span>
                    </td>

                    <td className="td-cantidad">
                      <div className="cantidad-ctrl">
                        <button
                          className="cantidad-btn"
                          onClick={() => onCantidadChange(index, item.cantidad - 1)}
                          disabled={item.cantidad <= 1}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          className="cantidad-valor"
                          value={item.cantidad}
                          min="1"
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v) && v >= 1) onCantidadChange(index, v);
                          }}
                        />
                        <button
                          className="cantidad-btn"
                          onClick={() => onCantidadChange(index, item.cantidad + 1)}
                        >
                          +
                        </button>
                      </div>
                    </td>

                    <td className="td-descuento">
                      <div className="descuento-ctrl">
                        <input
                          type="number"
                          min="0"
                          className="descuento-input"
                          value={item.descuento}
                          onChange={(e) =>
                            onDescuentoItemChange(index, e.target.value, item.descuentoTipo)
                          }
                          placeholder="0"
                        />
                        <select
                          className="descuento-tipo-select"
                          value={item.descuentoTipo}
                          onChange={(e) =>
                            onDescuentoItemChange(index, item.descuento, e.target.value)
                          }
                        >
                          <option value="fijo">$</option>
                          <option value="porcentaje">%</option>
                        </select>
                      </div>
                    </td>

                    <td className="td-subtotal">
                      ${neto.toLocaleString('es-CO')}
                    </td>

                    <td className="td-acciones">
                      <button
                        className="item-eliminar-btn"
                        onClick={() => onEliminarItem(index)}
                        aria-label="Eliminar"
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="descuento-total-section">
            <span className="descuento-total-label">Descuento sobre total</span>
            <div className="descuento-total-controls">
              <input
                type="number"
                min="0"
                className="descuento-input"
                value={descuentoTotal}
                onChange={(e) =>
                  onDescuentoTotalChange(Number(e.target.value) || 0, descuentoTipoTotal)
                }
                placeholder="0"
              />
              <select
                className="descuento-tipo-select"
                value={descuentoTipoTotal}
                onChange={(e) => onDescuentoTotalChange(descuentoTotal, e.target.value)}
              >
                <option value="fijo">$</option>
                <option value="porcentaje">%</option>
              </select>
            </div>
          </div>
        </>
      )}

      <div className="carrito-resumen">
        <div className="resumen-fila">
          <span>Subtotal bruto</span>
          <span>${totales.subtotalBruto.toLocaleString('es-CO')}</span>
        </div>
        {totales.totalDescuentosItem > 0 && (
          <div className="resumen-fila resumen-descuento">
            <span>Desc. por ítem</span>
            <span>−${totales.totalDescuentosItem.toLocaleString('es-CO')}</span>
          </div>
        )}
        {totales.descVenta > 0 && (
          <div className="resumen-fila resumen-descuento">
            <span>Desc. total</span>
            <span>−${totales.descVenta.toLocaleString('es-CO')}</span>
          </div>
        )}
        {ivaDesglose.map(({ tasa, monto }) => (
          <div key={tasa} className="resumen-fila resumen-iva">
            <span>IVA {tasa}% (incl.)</span>
            <span>${Math.round(monto).toLocaleString('es-CO')}</span>
          </div>
        ))}
        <div className="resumen-fila resumen-total">
          <span>Total a pagar</span>
          <span>${totales.totalFinal.toLocaleString('es-CO')}</span>
        </div>
      </div>
    </div>
  );
}

export default CarritoCaja;
