// ==================================================
// 🔗 CONEXIÓN A POSTGRESQL USANDO SEQUELIZE ORM
// ==================================================
// Funciona igual con PostgreSQL local y con Supabase/Render/Neon:
//  - SSL se activa solo cuando el host NO es local (o con DB_SSL=true); DB_SSL=false lo desactiva.
//  - DB_SCHEMA (opcional) aísla todas las tablas de OrderEasy en un schema propio, de modo que se puede
//    compartir una misma base de datos (p. ej. un proyecto de Supabase) con otra aplicación sin mezclar tablas.

const { Sequelize } = require('sequelize');

// Cargamos las variables de entorno desde el archivo .env
require('dotenv').config();

const HOSTS_LOCALES = ['localhost', '127.0.0.1', '::1'];
const host = process.env.DB_HOST || 'localhost';

const sslActivo = process.env.DB_SSL
  ? process.env.DB_SSL === 'true'
  : !HOSTS_LOCALES.includes(host);

// Solo letras, números y guion bajo: el nombre del schema se usa dentro de SQL
const schema = process.env.DB_SCHEMA ? process.env.DB_SCHEMA.trim() : '';
if (schema && !/^[a-z_][a-z0-9_]*$/i.test(schema)) {
  throw new Error('DB_SCHEMA solo puede contener letras, números y guion bajo (ej: ordereasy).');
}

const sequelize = new Sequelize(
  process.env.DB_NAME,      // Nombre de la base de datos
  process.env.DB_USER,      // Usuario de la base de datos
  process.env.DB_PASSWORD,  // Contraseña del usuario
  {
    host,
    port: Number(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: false,

    // Configuraciones del pool de conexiones (los planes gratuitos limitan las conexiones simultáneas)
    pool: {
      max: Number(process.env.DB_POOL_MAX) || 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },

    // Configuraciones globales para modelos
    define: {
      timestamps: false,   // Desactiva automáticamente los campos createdAt y updatedAt
      underscored: true,   // Usa snake_case en lugar de camelCase para los campos
    },

    // Los proveedores gestionados (Supabase, Render, Neon) usan certificados que Node no reconoce como
    // "de confianza" por defecto, por eso rejectUnauthorized va en false (la conexión sigue cifrada).
    dialectOptions: {
      ssl: sslActivo ? { require: true, rejectUnauthorized: false } : false,
    },

    // Con schema propio, las consultas sin calificar (migraciones SQL, raw queries) también caen en él
    hooks: schema
      ? { afterConnect: (connection) => connection.query(`SET search_path TO "${schema}", public`) }
      : {},
  }
);

// Crea el schema de OrderEasy si no existe (solo aplica cuando se define DB_SCHEMA).
// Se consulta antes de crear: CREATE SCHEMA exige permiso sobre la base aunque el schema ya exista,
// y el rol limitado de producción (scripts/supabase-setup.sql) no lo tiene.
sequelize.asegurarSchema = async () => {
  if (!schema) return;
  const [existe] = await sequelize.query('SELECT 1 FROM pg_namespace WHERE nspname = :schema', { replacements: { schema } });
  if (existe.length === 0) await sequelize.query(`CREATE SCHEMA "${schema}"`);
};

sequelize.schemaNombre = schema || null;

module.exports = sequelize;
