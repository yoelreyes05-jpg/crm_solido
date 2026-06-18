-- ============================================================================
-- Migración v15 — Rol 'lavador' (técnico de lavado / Car Wash)
-- ----------------------------------------------------------------------------
-- La tabla usuarios tiene una restricción CHECK en la columna `rol` que solo
-- permite los roles antiguos. Al crear un usuario con rol 'lavador' falla con:
--   new row for relation "usuarios" violates check constraint "usuarios_rol_check"
-- Esta migración recrea la restricción incluyendo 'lavador'.
--
-- Ejecutar UNA vez en Supabase → SQL Editor.
-- ============================================================================

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN (
    'gerente',
    'admin',
    'secretaria',
    'tecnico',
    'almacen',
    'cafeteria',
    'lavador'
  ));

-- Verificación opcional:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'usuarios'::regclass AND conname = 'usuarios_rol_check';
