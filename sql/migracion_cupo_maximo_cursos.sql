-- ─────────────────────────────────────────────────────────────────────────────
-- Migración: cupo máximo por curso
-- Ejecutar en Supabase → SQL Editor
--
-- Motivo: la vitrina pública de cursos (GET /cursos/publicos) muestra los
-- lugares que quedan y bloquea la pre-inscripción cuando se llenan. Sin esta
-- columna el endpoint no puede leer `cupo_maximo` y devuelve error 400.
--
-- Es opcional en el sentido de negocio, no en el técnico: la columna debe
-- existir aunque quede en NULL. NULL significa "sin límite declarado" y la web
-- simplemente no muestra contador de cupos para ese curso.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE capacitaciones_cursos
  ADD COLUMN IF NOT EXISTS cupo_maximo INTEGER;

COMMENT ON COLUMN capacitaciones_cursos.cupo_maximo IS
  'Cupos totales del curso. NULL = sin límite. Lo usa la vitrina pública de la web para mostrar disponibilidad y cerrar pre-inscripciones.';
