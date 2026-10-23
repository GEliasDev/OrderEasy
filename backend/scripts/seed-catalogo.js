// Importa el catálogo de CatalogoGyC (lib/products.ts) como productos de OrderEasy.
// Un producto por modelo+color, la colección es la categoría y las fotos se copian a uploads/productos.
// Uso: npm run seed:catalogo -- "<ruta a CatalogoGyC>"   (idempotente: omite los que ya existen)
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const sequelize = require('../config/database');

require('../models/negocioModel');
require('../models/roleSeccionModel');
require('../models/rolModel');
const Usuario = require('../models/userModel');
const Categoria = require('../models/categoryModel');
const Producto = require('../models/productModel');
const Variante = require('../models/varianteModel');
const { processAndUploadImage } = require('../utils/cloudinary');

const CORREO = process.env.SEED_CORREO || 'gvaldelamar2003@gmail.com';
const ORIGEN = process.argv[2] || 'C:\\Users\\GabrielEliasValdelam\\Desktop\\Catalogo\\CatalogoGyC';
const TALLAS = ['35', '36', '37', '38', '39', '40']; // todas las sandalias se manejan por talla; el stock arranca en 0
const MARGEN_COMPRA = 0.5; // precioCompra provisional = 50% del precio de venta (el catálogo no lo trae)
const COMPRA_POR_COLECCION = { Mila: 30000 }; // precio de compra real; manda sobre el margen provisional
const EN_PRODUCCION = process.env.NODE_ENV === 'production'; // en producción las fotos van a Cloudinary (uploads/ es efímero)
const SIMULAR = process.env.SEED_SIMULAR === '1'; // solo lee la base y lista lo que crearía

(async () => {
  try {
    const { products } = await import(pathToFileURL(path.join(ORIGEN, 'lib', 'products.ts')).href);

    const usuario = await Usuario.findOne({ where: { correo: CORREO } });
    if (!usuario) throw new Error(`No existe el usuario ${CORREO}. Corre primero: npm run seed`);

    const destino = path.join(__dirname, '..', 'uploads', 'productos');
    fs.mkdirSync(destino, { recursive: true });

    const categorias = {};
    let creados = 0, omitidos = 0, sinFoto = 0;

    for (const p of products) {
      if (!categorias[p.collection] && !SIMULAR) {
        const [cat] = await Categoria.findOrCreate({
          where: { nombre: p.collection, negocioid: usuario.negocioid },
          defaults: { descripcion: `Colección ${p.collection}`, usuarioid: usuario.usuarioid },
        });
        categorias[p.collection] = cat;
      }

      for (const v of p.variants) {
        const nombre = `${p.name} - ${v.color}`;
        const existe = await Producto.findOne({ where: { nombre, negocioid: usuario.negocioid } });
        if (existe) { omitidos++; continue; }

        if (SIMULAR) { console.log(`  + ${p.collection} / ${nombre} (venta ${p.price})`); creados++; continue; }

        const imagenes = [];
        for (const rel of v.images) {
          const archivo = path.join(ORIGEN, 'public', rel);
          if (!fs.existsSync(archivo)) { sinFoto++; continue; }
          if (EN_PRODUCCION) {
            const subida = await processAndUploadImage(fs.readFileSync(archivo));
            if (subida.local) throw new Error('Cloudinary no respondió: las fotos se perderían en el próximo despliegue. Revisa CLOUDINARY_*.');
            imagenes.push(subida.secure_url);
          } else {
            fs.copyFileSync(archivo, path.join(destino, path.basename(rel)));
            imagenes.push(`productos/${path.basename(rel)}`);
          }
        }

        const producto = await Producto.create({
          nombre,
          descripcion: `Sandalia ${p.name} color ${v.color} - Colección ${p.collection}`,
          cantidadDisponible: 0,
          precioCompra: COMPRA_POR_COLECCION[p.collection] ?? Math.round(p.price * MARGEN_COMPRA),
          precioVenta: p.price,
          imagenes,
          categoriaNombre: p.collection,
          categoriaid: categorias[p.collection].categoriaid,
          usuarioid: usuario.usuarioid,
          negocioid: usuario.negocioid,
          usaTallas: true,
        });
        await Variante.bulkCreate(
          TALLAS.map((talla) => ({ productoid: producto.productoid, negocioid: usuario.negocioid, talla }))
        );
        creados++;
      }
    }

    console.log(`✅ Catálogo importado: ${creados} creados, ${omitidos} ya existían, ${sinFoto} fotos no encontradas.`);
  } catch (err) {
    console.error('❌ Error importando el catálogo:', err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
