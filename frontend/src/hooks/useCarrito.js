import { useState } from 'react';
import { admiteDecimales } from '../utils/unidades';

const redondear = (n) => Math.round(n * 1000) / 1000;

// Una línea del carrito es "producto + talla": el mismo producto en dos tallas son dos líneas
export const claveItem = (productoid, talla) => `${productoid}:${talla ?? ''}`;

const disponibleDe = (stock) => Math.max(0, Number(stock.cantidadDisponible) - Number(stock.cantidadReservada || 0));

// Paso de los botones +/-: 1 en unidades enteras, 0.5 en kg, g, m y l
export const pasoDe = (item) => (admiteDecimales(item.unidadMedida) ? 0.5 : 1);
// Cantidad mínima de una línea: 1 en unidades enteras, 0.001 en las decimales
export const minimoDe = (item) => (admiteDecimales(item.unidadMedida) ? 0.001 : 1);

/**
 * Lógica compartida de los carritos de venta, pedido y compra.
 * @param {boolean} limitarPorStock  true en ventas: no permite pasar del stock disponible de la línea
 */
export function useCarrito({ limitarPorStock = false } = {}) {
  const [carrito, setCarrito] = useState([]);
  // Producto con tallas cuyo selector de talla está abierto
  const [productoParaTalla, setProductoParaTalla] = useState(null);

  const agregarAlCarrito = (producto, variante = null) => {
    const talla = variante ? variante.talla : null;
    const stockDisponible = disponibleDe(variante || producto);
    if (limitarPorStock && stockDisponible <= 0) return;

    const clave = claveItem(producto.productoid, talla);
    const paso = pasoDe(producto);

    setCarrito((prev) => {
      const existente = prev.find((item) => item.clave === clave);
      if (existente) {
        const nueva = redondear(existente.cantidad + paso);
        if (limitarPorStock && nueva > existente.stockDisponible) return prev;
        return prev.map((item) => (item.clave === clave ? { ...item, cantidad: nueva } : item));
      }
      const inicial = limitarPorStock ? Math.min(1, stockDisponible) : 1;
      return [...prev, { ...producto, talla, clave, stockDisponible, cantidad: inicial }];
    });
  };

  // Click en una tarjeta de producto: con tallas abre el selector; sin tallas lo agrega
  const elegirProducto = (producto) => {
    if (producto.usaTallas) setProductoParaTalla(producto);
    else agregarAlCarrito(producto);
  };

  const elegirTalla = (variante) => {
    if (productoParaTalla) agregarAlCarrito(productoParaTalla, variante);
    setProductoParaTalla(null);
  };

  const cerrarSelectorTalla = () => setProductoParaTalla(null);

  const actualizarCantidad = (clave, direccion) => {
    setCarrito((prev) => prev.map((item) => {
      if (item.clave !== clave) return item;
      const nueva = redondear(item.cantidad + direccion * pasoDe(item));
      if (nueva < minimoDe(item)) return item;
      if (limitarPorStock && nueva > item.stockDisponible) return item;
      return { ...item, cantidad: nueva };
    }));
  };

  const setCantidadDirecta = (clave, valor) => {
    setCarrito((prev) => prev.map((item) => {
      if (item.clave !== clave) return item;
      const numero = admiteDecimales(item.unidadMedida) ? parseFloat(valor) : parseInt(valor, 10);
      if (Number.isNaN(numero)) return item;
      const conMinimo = Math.max(minimoDe(item), redondear(numero));
      return { ...item, cantidad: limitarPorStock ? Math.min(conMinimo, item.stockDisponible) : conMinimo };
    }));
  };

  const eliminarDelCarrito = (clave) => setCarrito((prev) => prev.filter((item) => item.clave !== clave));

  return {
    carrito,
    productoParaTalla,
    elegirProducto,
    elegirTalla,
    cerrarSelectorTalla,
    actualizarCantidad,
    setCantidadDirecta,
    eliminarDelCarrito,
  };
}
