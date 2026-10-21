import { ShoppingCart } from 'lucide-react';
import './comunes.css';

// Barra fija al pie (solo celular): resume el carrito y lo abre. `vacia` muestra una pista en vez del total.
function BarraCarrito({ cantidad, total, etiqueta = 'Ver carrito', onAbrir, tono = 'primario' }) {
  const vacia = cantidad === 0;
  return (
    <button type="button" className={`cart-bar cart-bar-${tono}${vacia ? ' cart-bar-vacia' : ''}`} onClick={onAbrir} disabled={vacia}>
      <ShoppingCart size={18} />
      {vacia ? (
        <span className="cart-bar-texto">Toca un producto para agregarlo</span>
      ) : (
        <>
          <span className="cart-bar-texto">{cantidad} {cantidad === 1 ? 'producto' : 'productos'}</span>
          <strong className="cart-bar-total">{total}</strong>
          <span className="cart-bar-accion">{etiqueta}</span>
        </>
      )}
    </button>
  );
}

export default BarraCarrito;
