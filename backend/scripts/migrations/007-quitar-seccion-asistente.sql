-- Migración 007: se elimina la sección "asistente" de los permisos de los roles (el asistente de IA ya no existe).
-- Es idempotente (se puede repetir sin efecto).

BEGIN;

DELETE FROM role_secciones WHERE seccion = 'asistente';

COMMIT;
