-- =====================================================
-- PATCH: Soft delete para cafeteria_productos
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Agregar columna activo (TRUE = visible, FALSE = archivado)
ALTER TABLE cafeteria_productos
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

-- 2. Marcar todos los existentes como activos
UPDATE cafeteria_productos SET activo = true WHERE activo IS NULL;

-- 3. Verificar
SELECT id, nombre, stock, activo FROM cafeteria_productos ORDER BY id;
