// Aplica las migraciones SQL de backend/scripts/migrations/*.sql que aún no se hayan ejecutado.
//
// En producción `sequelize.sync()` solo crea tablas que faltan: nunca modifica las existentes. Las migraciones
// agregan columnas/tablas nuevas a una base ya creada. Son idempotentes (se pueden repetir sin efecto), y aquí
// además se registran en la tabla schema_migrations para no repetirlas en cada arranque.
//
// Se usa automáticamente al iniciar el servidor (RUN_MIGRATIONS=false lo desactiva) o a mano: npm run migrate

const fs = require('fs');
const path = require('path');
const sequelize = require('../config/database');
require('../models'); // para que `npm run migrate` conozca todas las tablas

const DIRECTORIO = path.join(__dirname, '..', 'scripts', 'migrations');
// Clave arbitraria para el bloqueo: evita que dos instancias migren a la vez
const CLAVE_BLOQUEO = 7410021;

const migrar = async ({ log = console.log } = {}) => {
  const archivos = fs.existsSync(DIRECTORIO)
    ? fs.readdirSync(DIRECTORIO).filter((f) => f.endsWith('.sql')).sort()
    : [];

  // Una sola conexión: el bloqueo asesor y las migraciones deben vivir en la misma sesión
  await sequelize.transaction(async (t) => {
    await sequelize.query('SELECT pg_advisory_xact_lock(:clave)', { replacements: { clave: CLAVE_BLOQUEO }, transaction: t });
    await sequelize.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (nombre varchar(200) PRIMARY KEY, aplicada_en timestamptz NOT NULL DEFAULT now())',
      { transaction: t }
    );

    const [hechas] = await sequelize.query('SELECT nombre FROM schema_migrations', { transaction: t });
    const aplicadas = new Set(hechas.map((h) => h.nombre));

    let nuevas = 0;
    for (const archivo of archivos) {
      if (aplicadas.has(archivo)) continue;
      // Los archivos traen su propio BEGIN/COMMIT: se quitan para que todo corra dentro de esta transacción
      const sql = fs.readFileSync(path.join(DIRECTORIO, archivo), 'utf8')
        .replace(/^\s*BEGIN;\s*$/gim, '')
        .replace(/^\s*COMMIT;\s*$/gim, '');
      await sequelize.query(sql, { transaction: t });
      await sequelize.query('INSERT INTO schema_migrations (nombre) VALUES (:nombre)', { replacements: { nombre: archivo }, transaction: t });
      log(`✅ Migración aplicada: ${archivo}`);
      nuevas++;
    }
    if (nuevas === 0) log('✅ Migraciones al día.');
  });
};

module.exports = migrar;

// Ejecución directa: node utils/migrar.js (npm run migrate)
if (require.main === module) {
  (async () => {
    try {
      await sequelize.asegurarSchema();
      await sequelize.sync();
      await migrar();
    } catch (err) {
      console.error('❌ Error al migrar:', err);
      process.exitCode = 1;
    } finally {
      await sequelize.close();
    }
  })();
}
