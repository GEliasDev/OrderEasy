// Convierte los productos sin tallas a productos por talla (por defecto calzado 35-40, stock 0 en cada talla).
// Uso: npm run convertir:tallas [-- --tallas=35,36,37,38,39,40]
// Idempotente: ignora los productos que ya usan tallas. No toca productos con stock > 0 (no sabría
// en qué talla repartirlo): se listan para que se editen a mano desde Inventario.
const sequelize = require('../config/database');
const Producto = require('../models/productModel');
const Variante = require('../models/varianteModel');

const argTallas = process.argv.find((a) => a.startsWith('--tallas='));
const TALLAS = (argTallas ? argTallas.split('=')[1] : '35,36,37,38,39,40')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);

(async () => {
  const t = await sequelize.transaction();
  try {
    const productos = await Producto.findAll({ where: { usaTallas: false }, transaction: t, lock: true });

    let convertidos = 0;
    const conStock = [];
    for (const producto of productos) {
      if (Number(producto.cantidadDisponible) > 0 || Number(producto.cantidadReservada) > 0) {
        conStock.push(producto.nombre);
        continue;
      }
      await Variante.bulkCreate(
        TALLAS.map((talla) => ({ productoid: producto.productoid, negocioid: producto.negocioid, talla })),
        { transaction: t }
      );
      await producto.update({ usaTallas: true }, { transaction: t });
      convertidos++;
    }

    await t.commit();
    console.log(`✅ ${convertidos} productos convertidos a tallas (${TALLAS.join(', ')}), con stock 0.`);
    if (conStock.length) {
      console.log(`⚠️  ${conStock.length} con stock sin convertir (edítalos desde Inventario para repartir el stock por talla): ${conStock.join(', ')}`);
    }
  } catch (err) {
    await t.rollback();
    console.error('❌ Error al convertir a tallas:', err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
