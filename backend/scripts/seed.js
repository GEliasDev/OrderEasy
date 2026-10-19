// Seed de desarrollo: crea tablas, un negocio, un administrador, categorías y productos.
// Uso: npm run seed   (idempotente: si el usuario ya existe, no duplica nada)
const bcrypt = require('bcrypt');
const sequelize = require('../config/database');

const Negocio = require('../models/negocioModel');
require('../models/roleSeccionModel');
require('../models/rolModel');
const Usuario = require('../models/userModel');
const Categoria = require('../models/categoryModel');
const Producto = require('../models/productModel');

const CORREO = 'gvaldelamar2003@gmail.com';
const CONTRASENA = '123456';

const CATEGORIAS = [
  { nombre: 'Bebidas', descripcion: 'Gaseosas, jugos, agua y otras bebidas' },
  { nombre: 'Snacks', descripcion: 'Papas, galletas y pasabocas' },
  { nombre: 'Aseo', descripcion: 'Productos de aseo y limpieza' },
  { nombre: 'Abarrotes', descripcion: 'Granos, aceites y productos básicos' },
];

const PRODUCTOS = [
  ['Coca-Cola 400ml', 'Bebidas', 40, 1500, 2500, '7701234500011'],
  ['Agua Cristal 600ml', 'Bebidas', 60, 900, 1500, '7701234500028'],
  ['Jugo Hit Mango 500ml', 'Bebidas', 30, 1400, 2300, '7701234500035'],
  ['Papas Margarita Pollo', 'Snacks', 50, 1300, 2200, '7701234500042'],
  ['Galletas Oreo x6', 'Snacks', 35, 1600, 2600, '7701234500059'],
  ['Maní Salado 50g', 'Snacks', 25, 1000, 1800, '7701234500066'],
  ['Jabón Rey Barra', 'Aseo', 20, 1800, 3000, '7701234500073'],
  ['Detergente Fab 1kg', 'Aseo', 15, 7500, 11000, '7701234500080'],
  ['Arroz Diana 500g', 'Abarrotes', 80, 2100, 3000, '7701234500097'],
  ['Aceite Girasol 1L', 'Abarrotes', 18, 9500, 13500, '7701234500103'],
  ['Azúcar Manuelita 1kg', 'Abarrotes', 45, 3200, 4500, '7701234500110'],
];

(async () => {
  try {
    await sequelize.sync({ alter: true });

    let usuario = await Usuario.findOne({ where: { correo: CORREO } });
    if (usuario) {
      console.log(`ℹ️  El usuario ${CORREO} ya existe (id ${usuario.usuarioid}). Nada que sembrar.`);
      return;
    }

    const negocio = await Negocio.create({ nombre: 'Tienda Gabriel', nit: '900123456-7', telefono: '3001234567' });

    usuario = await Usuario.create({
      primer_nombre: 'Gabriel',
      primer_apellido: 'Valdelamar',
      correo: CORREO,
      telefono: '3001234567',
      contraseña: await bcrypt.hash(CONTRASENA, 10),
      rol: 'administrador',
      negocioid: negocio.negocioid,
    });

    const categorias = {};
    for (const c of CATEGORIAS) {
      categorias[c.nombre] = await Categoria.create({ ...c, usuarioid: usuario.usuarioid, negocioid: negocio.negocioid });
    }

    for (const [nombre, cat, stock, compra, venta, codigo] of PRODUCTOS) {
      await Producto.create({
        nombre,
        descripcion: nombre,
        cantidadDisponible: stock,
        precioCompra: compra,
        precioVenta: venta,
        categoriaNombre: cat,
        categoriaid: categorias[cat].categoriaid,
        usuarioid: usuario.usuarioid,
        negocioid: negocio.negocioid,
        codigoBarras: codigo,
      });
    }

    console.log(`✅ Seed listo: negocio ${negocio.negocioid}, usuario ${CORREO}, ${CATEGORIAS.length} categorías, ${PRODUCTOS.length} productos.`);
  } catch (err) {
    console.error('❌ Error en el seed:', err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
