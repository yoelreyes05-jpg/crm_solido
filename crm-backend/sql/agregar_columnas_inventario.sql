-- =====================================================
-- MIGRACIÓN: Nuevas columnas en tabla inventario
-- Sólido Auto Servicio — Ejecutar en Supabase SQL Editor
-- Fecha: 2026-04-30
-- =====================================================

-- 1. Agregar columnas a la tabla inventario
ALTER TABLE inventario
  ADD COLUMN IF NOT EXISTS categoria         TEXT    DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS descripcion       TEXT,
  ADD COLUMN IF NOT EXISTS marcas_compatibles TEXT,
  ADD COLUMN IF NOT EXISTS observaciones     TEXT;

-- 2. Índice para filtrar/agrupar por categoría rápidamente
CREATE INDEX IF NOT EXISTS idx_inventario_categoria ON inventario(categoria);

-- 3. Verificar que las columnas se agregaron correctamente
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'inventario'
  AND column_name IN ('categoria','descripcion','marcas_compatibles','observaciones')
ORDER BY column_name;
