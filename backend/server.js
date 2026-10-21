const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const IS_PROD = process.env.NODE_ENV === 'production';

// En producción también es obligatorio saber qué frontend puede llamar a la API
const REQUIRED_ENV = ['JWT_SECRET', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', ...(IS_PROD ? ['CORS_ORIGIN'] : [])];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`❌ Variables de entorno faltantes: ${missing.join(', ')}`);
  process.exit(1);
}
if (IS_PROD && process.env.JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET es demasiado corto para producción (mínimo 32 caracteres).');
  process.exit(1);
}

// Conexión Sequelize y modelos
const sequelize = require('./config/database');
require('./models');
const migrar = require('./utils/migrar');

// Rutas
const authRoutes = require('./routes/authRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const ingresoRoutes = require('./routes/ventaRoutes');
const egresoRoutes = require('./routes/egresoRoutes');
const clienteRoutes = require('./routes/clientRoutes');
const proveedorRoutes = require('./routes/proveedorRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const negocioRoutes = require('./routes/negocioRoutes');
const statsRoutes = require('./routes/statsRoutes');
const balanceRoutes = require('./routes/balanceRoutes');
const rolesRoutes = require('./routes/rolesRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');
const ordenCompraRoutes = require('./routes/ordenCompraRoutes');

const app = express();

// Detrás del proxy de Render/Nginx/Cloudflare: sin esto el límite de intentos ve la IP del proxy y no la del cliente
if (IS_PROD || process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

app.use(helmet());
app.use(compression());

const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(cors({
  // En desarrollo refleja cualquier origen (localhost, 127.0.0.1, IPs de red);
  // en producción solo los orígenes configurados en CORS_ORIGIN.
  origin: IS_PROD ? corsOrigins : true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));

// Chequeo de salud para la plataforma de despliegue (Render, Docker, balanceadores)
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ ok: true, servicio: 'ordereasy-api' });
  } catch {
    res.status(503).json({ ok: false, mensaje: 'Base de datos no disponible' });
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  message: { mensaje: 'Demasiados intentos. Espera 15 minutos antes de volver a intentar.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Las imágenes se consumen desde el frontend en otro origen (Vite), por lo que
// deben poder cargarse cross-origin; Helmet aplica same-origin por defecto.
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  },
}));
app.use(bodyParser.json({ limit: '10mb' }));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/categorias', categoryRoutes);
app.use('/api/productos', productRoutes);
app.use('/api/ventas', ingresoRoutes);
app.use('/api/egresos', egresoRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/proveedores', proveedorRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/balance', balanceRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/negocio', negocioRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/ordenes-compra', ordenCompraRoutes);

app.use('/api', (req, res) => res.status(404).json({ mensaje: 'Ruta no encontrada.' }));

// Manejador global de errores no capturados
app.use((err, req, res, next) => {
  console.error('Error no capturado:', err);
  res.status(500).json({ mensaje: 'Error interno del servidor.' });
});

const PORT = process.env.PORT || 3000;

const iniciar = async () => {
  await sequelize.authenticate();
  await sequelize.asegurarSchema();

  // Sincronizar tablas. En producción no se altera el esquema automáticamente (riesgo de pérdida de datos):
  // las tablas nuevas se crean y los cambios a tablas existentes llegan por las migraciones SQL.
  await sequelize.sync({ alter: !IS_PROD });
  console.log(`✅ Tablas sincronizadas con PostgreSQL [${IS_PROD ? 'producción' : 'desarrollo'}]${sequelize.schemaNombre ? ` (schema "${sequelize.schemaNombre}")` : ''}`);

  if (process.env.RUN_MIGRATIONS !== 'false') await migrar();

  if (IS_PROD && !process.env.CLOUDINARY_CLOUD_NAME) {
    console.warn('⚠️  Cloudinary no está configurado: las imágenes se guardan en disco y se pierden en cada redeploy en plataformas con disco efímero (Render, Railway...).');
  }

  const servidor = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
  });

  // Cierre ordenado cuando la plataforma reinicia o apaga el servicio
  const apagar = (senal) => {
    console.log(`${senal} recibido: cerrando...`);
    servidor.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => apagar('SIGTERM'));
  process.on('SIGINT', () => apagar('SIGINT'));
};

iniciar().catch((err) => {
  console.error('❌ No se pudo iniciar el servidor:', err);
  process.exit(1);
});
