const Producto = require('../models/productModel');
const Variante = require('../models/varianteModel');
const Categoria = require('../models/categoryModel');
const sequelize = require('../config/database');
const { processAndUploadImage } = require('../utils/cloudinary');
const { UNIDAD_POR_DEFECTO, unidadValida, admiteDecimales, redondear } = require('../utils/unidades');
const { ErrorStock, sincronizarTotales } = require('../services/stockService');
const { Op } = require('sequelize');

const includeVariantes = [{ model: Variante, as: 'variantes' }];
const ordenVariantes = [[{ model: Variante, as: 'variantes' }, 'varianteid', 'ASC']];

// ========================================================
// 🧰 Helpers de unidades y tallas
// ========================================================
const aBooleano = (valor) => valor === true || valor === 'true' || valor === '1' || valor === 1;

// Las cantidades llegan como texto en formularios multipart; se normalizan según la unidad
const validarStock = (valor, unidad, etiqueta) => {
  const n = Number(valor ?? 0);
  if (!Number.isFinite(n) || n < 0) {
    throw new ErrorStock(`El stock ${etiqueta} debe ser un número mayor o igual a 0`);
  }
  if (!admiteDecimales(unidad) && !Number.isInteger(n)) {
    throw new ErrorStock(`El stock ${etiqueta} debe ser un número entero (la unidad es ${unidad})`);
  }
  return redondear(n);
};

// `variantes` puede venir como array (JSON) o como texto JSON (multipart/form-data)
const parsearVariantes = (valor, unidad) => {
  if (valor === undefined || valor === null || valor === '') return undefined;

  let lista = valor;
  if (typeof valor === 'string') {
    try {
      lista = JSON.parse(valor);
    } catch {
      throw new ErrorStock('El formato de las tallas es inválido');
    }
  }
  if (!Array.isArray(lista)) throw new ErrorStock('El formato de las tallas es inválido');

  const vistas = new Set();
  return lista.map((v) => {
    const talla = String(v?.talla ?? '').trim();
    if (!talla) throw new ErrorStock('Cada talla debe tener un nombre');
    if (talla.length > 20) throw new ErrorStock(`La talla ${talla} es demasiado larga (máximo 20 caracteres)`);
    const clave = talla.toLowerCase();
    if (vistas.has(clave)) throw new ErrorStock(`La talla ${talla} está repetida`);
    vistas.add(clave);
    return { talla, cantidadDisponible: validarStock(v.cantidadDisponible, unidad, `de la talla ${talla}`) };
  });
};

const productoConVariantes = (id, negocioid, transaction) =>
  Producto.findOne({
    where: { productoid: id, negocioid },
    include: includeVariantes,
    order: ordenVariantes,
    transaction,
  });

const responderError = (res, error, mensaje) => {
  if (error instanceof ErrorStock) return res.status(error.status).json({ mensaje: error.message });
  console.error(`❌ ${mensaje}`, error);
  return res.status(500).json({ mensaje });
};

// ========================================================
// ➕ Crear un nuevo producto con imágenes
// ========================================================
const createProduct = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      nombre,
      descripcion,
      cantidadDisponible,
      precioCompra,
      precioVenta,
      categoriaNombre,
      tasaIva = 0,
    } = req.body;

    const { usuarioid, negocioid } = req.usuario;

    if (!categoriaNombre) {
      throw new ErrorStock('El nombre de la categoría es obligatorio.');
    }

    const unidadMedida = req.body.unidadMedida || UNIDAD_POR_DEFECTO;
    if (!unidadValida(unidadMedida)) throw new ErrorStock('La unidad de medida no es válida.');

    const usaTallas = aBooleano(req.body.usaTallas);
    const variantes = parsearVariantes(req.body.variantes, unidadMedida);
    if (usaTallas && (!variantes || variantes.length === 0)) {
      throw new ErrorStock('Agrega al menos una talla para este producto.');
    }

    const stockInicial = usaTallas
      ? redondear(variantes.reduce((acc, v) => acc + v.cantidadDisponible, 0))
      : validarStock(cantidadDisponible, unidadMedida, 'inicial');

    // 🔍 Verificar que la categoría existe y pertenece al NEGOCIO
    const categoria = await Categoria.findOne({
      where: { nombre: categoriaNombre, negocioid: negocioid }
    });

    if (!categoria) {
      throw new ErrorStock('La categoría no existe o no pertenece a tu negocio.');
    }

    // 📸 Imágenes
    let imagenes = [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => processAndUploadImage(file.buffer));
      const results = await Promise.all(uploadPromises);
      imagenes = results.map(result => result.secure_url);
    }

    const nuevoProducto = await Producto.create({
      nombre,
      descripcion,
      cantidadDisponible: stockInicial,
      precioCompra,
      precioVenta,
      imagenes,
      categoriaNombre,
      categoriaid: categoria.categoriaid,
      usuarioid,
      negocioid,
      tasaIva: Number(tasaIva) || 0,
      unidadMedida,
      usaTallas,
    }, { transaction: t });

    if (usaTallas) {
      await Variante.bulkCreate(
        variantes.map((v) => ({ ...v, productoid: nuevoProducto.productoid, negocioid })),
        { transaction: t }
      );
    }

    await t.commit();
    res.status(201).json({
      mensaje: 'Producto creado exitosamente.',
      producto: await productoConVariantes(nuevoProducto.productoid, negocioid),
    });

  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al crear el producto.');
  }
};

// ========================================================
// 📄 Obtener todos los productos del NEGOCIO
// ========================================================
const getAllProducts = async (req, res) => {
  try {
    const { negocioid } = req.usuario;

    const productos = await Producto.findAll({
      where: { negocioid },
      include: includeVariantes,
      order: ordenVariantes,
    });

    const productosConImagenes = productos.map(producto => ({
      ...producto.toJSON(),
      imagenes: producto.imagenes || []
    }));

    res.status(200).json(productosConImagenes);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener los productos.' });
  }
};

// ========================================================
// 🔍 Obtener un producto por su ID (Filtrado por Negocio)
// ========================================================
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;

    const producto = await productoConVariantes(id, negocioid);

    if (!producto) {
      return res.status(404).json({ mensaje: 'Producto no encontrado.' });
    }

    res.status(200).json(producto);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener el producto.' });
  }
};

// ========================================================
// ✏️ Actualizar un producto existente
// ========================================================
const updateProduct = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;
    const {
      nombre,
      descripcion,
      cantidadDisponible,
      precioCompra,
      precioVenta,
      categoriaid,
      categoriaNombre,
      codigoBarras,
      tasaIva,
    } = req.body;

    const producto = await Producto.findOne({
      where: { productoid: id, negocioid },
      transaction: t,
      lock: true,
    });

    if (!producto) {
      await t.rollback();
      return res.status(404).json({ mensaje: 'Producto no encontrado.' });
    }

    const unidadMedida = req.body.unidadMedida || producto.unidadMedida;
    if (!unidadValida(unidadMedida)) throw new ErrorStock('La unidad de medida no es válida.');

    const usaTallas = req.body.usaTallas !== undefined ? aBooleano(req.body.usaTallas) : producto.usaTallas;
    const variantes = parsearVariantes(req.body.variantes, unidadMedida);

    let nuevasImagenes = producto.imagenes || [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => processAndUploadImage(file.buffer));
      const results = await Promise.all(uploadPromises);
      nuevasImagenes = results.map(result => result.secure_url);
    }

    const codigoBarrasNormalizado = codigoBarras !== undefined
      ? (codigoBarras.trim() === '' ? null : codigoBarras.trim())
      : producto.codigoBarras;

    const cambios = {
      nombre: nombre || producto.nombre,
      descripcion: descripcion || producto.descripcion,
      precioCompra: precioCompra !== undefined ? precioCompra : producto.precioCompra,
      precioVenta: precioVenta !== undefined ? precioVenta : producto.precioVenta,
      categoriaid: categoriaid || producto.categoriaid,
      categoriaNombre: categoriaNombre || producto.categoriaNombre,
      codigoBarras: codigoBarrasNormalizado,
      tasaIva: tasaIva !== undefined ? Number(tasaIva) : producto.tasaIva,
      imagenes: nuevasImagenes,
      unidadMedida,
      usaTallas,
    };

    const existentes = await Variante.findAll({ where: { productoid: producto.productoid }, transaction: t, lock: true });

    if (usaTallas) {
      if (!producto.usaTallas && (!variantes || variantes.length === 0)) {
        throw new ErrorStock('Agrega al menos una talla para este producto.');
      }
      if (variantes && variantes.length === 0) {
        throw new ErrorStock('Agrega al menos una talla para este producto.');
      }

      if (variantes) {
        const porTalla = new Map(existentes.map((v) => [v.talla.toLowerCase(), v]));
        const enviadas = new Set(variantes.map((v) => v.talla.toLowerCase()));

        // Tallas que ya no están en la lista: solo se pueden quitar si no tienen stock reservado
        for (const v of existentes) {
          if (enviadas.has(v.talla.toLowerCase())) continue;
          if (Number(v.cantidadReservada) > 0) {
            throw new ErrorStock(`La talla ${v.talla} tiene stock reservado en pedidos y no se puede quitar.`);
          }
          await v.destroy({ transaction: t });
        }

        for (const v of variantes) {
          const actual = porTalla.get(v.talla.toLowerCase());
          if (actual) {
            await actual.update({ talla: v.talla, cantidadDisponible: v.cantidadDisponible }, { transaction: t });
          } else {
            await Variante.create({ ...v, productoid: producto.productoid, negocioid }, { transaction: t });
          }
        }
      }

      await producto.update(cambios, { transaction: t });
      await sincronizarTotales(producto, t);
    } else {
      if (producto.usaTallas) {
        if (existentes.some((v) => Number(v.cantidadReservada) > 0)) {
          throw new ErrorStock('No puedes quitar las tallas: hay stock reservado en pedidos.');
        }
        await Variante.destroy({ where: { productoid: producto.productoid }, transaction: t });
        cambios.cantidadReservada = 0;
      }
      const stock = cantidadDisponible !== undefined
        ? validarStock(cantidadDisponible, unidadMedida, '')
        : (producto.usaTallas
          ? redondear(existentes.reduce((acc, v) => acc + Number(v.cantidadDisponible), 0))
          : producto.cantidadDisponible);
      await producto.update({ ...cambios, cantidadDisponible: stock }, { transaction: t });
    }

    await t.commit();
    res.status(200).json({ mensaje: 'Producto actualizado.', producto: await productoConVariantes(id, negocioid) });
  } catch (error) {
    await t.rollback();
    responderError(res, error, 'Error al actualizar.');
  }
};

// ========================================================
// 🗑️ Eliminar un producto
// ========================================================
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { negocioid } = req.usuario;

    const resultado = await Producto.destroy({
      where: { productoid: id, negocioid }
    });

    if (!resultado) {
      return res.status(404).json({ mensaje: 'Producto no encontrado.' });
    }

    res.status(200).json({ mensaje: 'Producto eliminado.' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar.' });
  }
};

const buscarProductos = async (req, res) => {
  try {
    const { q, codigo } = req.query;
    const { negocioid } = req.usuario;

    if (!q && !codigo) {
      return res.status(400).json({ mensaje: 'Se requiere el parámetro q o codigo' });
    }

    const where = { negocioid };
    if (codigo) {
      where.codigoBarras = codigo;
    } else {
      where.nombre = { [Op.iLike]: `%${q}%` };
    }

    const productos = await Producto.findAll({
      where,
      attributes: ['productoid', 'nombre', 'precioVenta', 'cantidadDisponible', 'codigoBarras', 'categoriaNombre', 'tasaIva', 'unidadMedida', 'usaTallas'],
      include: includeVariantes,
      order: ordenVariantes,
      limit: 20,
    });

    res.json(productos);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al buscar productos' });
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  buscarProductos,
};
