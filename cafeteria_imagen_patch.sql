-- =====================================================
-- PATCH: Agregar columna imagen a cafeteria_productos
-- Ejecutar en Supabase SQL Editor
-- =====================================================

ALTER TABLE cafeteria_productos
  ADD COLUMN IF NOT EXISTS imagen TEXT;

-- Verificar
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'cafeteria_productos' ORDER BY ordinal_position;
