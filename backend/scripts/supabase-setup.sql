-- OrderEasy en una base de datos compartida (p. ej. un proyecto de Supabase que ya usa otra app).
--
-- Un proyecto de Supabase tiene UNA sola base de datos ("postgres") y no permite crear otras, pero sí
-- separar internamente con un SCHEMA propio y un ROL que solo trabaja en él.
-- Ejecutar UNA vez en Supabase > SQL Editor, cambiando la contraseña de abajo.
-- Después, en el backend: DB_SCHEMA=ordereasy, DB_USER=ordereasy_app.<ref-del-proyecto>, DB_PASSWORD=<la clave>.
-- (<ref-del-proyecto> es la parte final del usuario de conexión de tu proyecto, ej. postgres.abcdxyz -> abcdxyz).

-- 1) Schema propio: ahí vivirán todas las tablas de OrderEasy
CREATE SCHEMA IF NOT EXISTS ordereasy;

-- 2) Rol dedicado de la aplicación (no es superusuario: no puede leer ni modificar las tablas de otras apps)
DO $$
BEGIN
  CREATE ROLE ordereasy_app LOGIN PASSWORD 'CAMBIA_ESTA_CLAVE_POR_UNA_LARGA_Y_UNICA';
EXCEPTION WHEN duplicate_object THEN
  NULL; -- ya existe: la clave se cambia con ALTER ROLE ordereasy_app PASSWORD '...';
END $$;

ALTER ROLE ordereasy_app SET search_path = ordereasy, public;

GRANT USAGE, CREATE ON SCHEMA ordereasy TO ordereasy_app;

-- 3) Sequelize crea los tipos ENUM (enum_*) en el schema public; el rol necesita poder crearlos ahí.
--    Solo puede crear objetos nuevos: las tablas de otras apps siguen sin ser accesibles para este rol.
GRANT USAGE, CREATE ON SCHEMA public TO ordereasy_app;

-- Comprobación (opcional): debe listar solo ordereasy
-- SELECT schema_name FROM information_schema.schemata WHERE schema_owner IN ('postgres', 'ordereasy_app');
