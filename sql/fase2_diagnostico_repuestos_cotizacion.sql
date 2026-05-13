-- ============================================================
-- FASE 2: Repuestos estructurados en diagnóstico + cotización
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 0. Agregar columna fotos_slots a inspeccion_vehiculo
--    Almacena las 4 fotos fijas: frente, trasero, lateral_izq, lateral_der
ALTER TABLE inspeccion_vehiculo
  ADD COLUMN IF NOT EXISTS fotos_slots JSONB DEFAULT '{}'::jsonb;

-- 1. Agregar columna repuestos_items a diagnosticos
--    Almacena lista de partes seleccionadas del inventario
ALTER TABLE diagnosticos
  ADD COLUMN IF NOT EXISTS repuestos_items JSONB DEFAULT '[]'::jsonb;

-- 2. Agregar columna items_detalle a cotizaciones
--    Copia la lista de partes al momento de generar la cotización
ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS items_detalle   JSONB DEFAULT '[]'::jsonb;

-- 3. Verificar columnas agregadas
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('diagnosticos','cotizaciones')
  AND column_name IN ('repuestos_items','items_detalle')
ORDER BY table_name, column_name;
