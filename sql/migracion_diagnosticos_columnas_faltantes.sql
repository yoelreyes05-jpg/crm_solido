-- ============================================================
-- MIGRACIÓN: Agregar columnas faltantes a tabla diagnosticos
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- Campo principal de descripción del diagnóstico
ALTER TABLE diagnosticos
  ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- Costos desglosados (el frontend envía separados: mano_obra + repuestos + total)
ALTER TABLE diagnosticos
  ADD COLUMN IF NOT EXISTS mano_obra NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repuestos NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total     NUMERIC(12,2) DEFAULT 0;

-- Tiempo estimado de reparación
ALTER TABLE diagnosticos
  ADD COLUMN IF NOT EXISTS tiempo_estimado TEXT;

-- Notas internas del técnico
ALTER TABLE diagnosticos
  ADD COLUMN IF NOT EXISTS notas TEXT;

-- Datos del técnico que hizo el diagnóstico
ALTER TABLE diagnosticos
  ADD COLUMN IF NOT EXISTS usuario_id     BIGINT,
  ADD COLUMN IF NOT EXISTS usuario_nombre TEXT;

-- Verificar columnas resultantes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'diagnosticos'
ORDER BY ordinal_position;
