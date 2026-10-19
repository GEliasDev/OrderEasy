const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

// Configuración de Cloudinary usando variables de entorno
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Procesa una imagen con Sharp (convierte a WebP y optimiza) y la sube a Cloudinary
 * @param {Buffer} buffer - El buffer de la imagen original
 * @param {String} folder - Carpeta de destino
 * @returns {Promise} - Devuelve el resultado de la subida
 */
const guardarImagenLocal = async (buffer, folder) => {
  const carpeta = String(folder || 'productos').split('/').filter(Boolean).pop() || 'productos';
  const directorio = path.join(__dirname, '..', 'uploads', carpeta);
  await fs.mkdir(directorio, { recursive: true });
  const nombre = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.webp`;
  await fs.writeFile(path.join(directorio, nombre), buffer);
  return { secure_url: `${carpeta}/${nombre}`, local: true };
};

const processAndUploadImage = async (buffer, folder = 'ordereasy-products') => {
  let processedBuffer;
  try {
    processedBuffer = await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (error) {
    throw new Error('Error al procesar la imagen: ' + error.message);
  }

  try {
    return await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          format: 'webp'
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );

      uploadStream.end(processedBuffer);
    });
  } catch (error) {
    console.warn(`Cloudinary no disponible (${error.message}); guardando imagen localmente.`);
    return guardarImagenLocal(processedBuffer, folder);
  }
};

/**
 * Sube una imagen a Cloudinary desde un buffer (usado con memoryStorage de multer)
 */
const uploadFromBuffer = (buffer, folder = 'ordereasy-products') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
};

module.exports = {
  cloudinary,
  uploadFromBuffer,
  processAndUploadImage,
};

