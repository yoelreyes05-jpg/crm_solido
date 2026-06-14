-- ─────────────────────────────────────────────────────────────────────────────
-- Migración: agregar columna fecha_fin a capacitaciones_cursos
-- Ejecutar en Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE capacitaciones_cursos
  ADD COLUMN IF NOT EXISTS fecha_fin DATE;
