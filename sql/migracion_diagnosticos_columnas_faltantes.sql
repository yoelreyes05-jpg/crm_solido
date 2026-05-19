-- ============================================================
-- MIGRACIÓN: Agregar columnas faltantes a tabla diagnosticos
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- Columnas de técnico / usuario
ALTER TABLE diagnosticos
  ADD COLUMN IF NOT EXISTS usuario_id     BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS usuario_nombre TEXT;

-- Alias: si la tabla ya tiene tecnico_nombre, este UPDATE lo sincroniza
-- (si no existe la columna, la línea anterior ya la habrá creado como usuario_nombre)

-- Detalles de mano de obra y tiempo
ALTER TABLE diagnosticos
  ADD COLUMN IF NOT EXISTS tiempo_estimado      TEXT,         -- ej: "2 días", "3 horas"
  ADD COLUMN IF NOT EXISTS mano_de_obra_detalle TEXT;         -- descripción detallada de la mano de obra

-- Notas internas del técnico
ALTER TABLE diagnosticos
  ADD COLUMN IF NOT EXISTS notas TEXT;

-- Verificar columnas resultantes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'diagnosticos'
ORDER BY ordinal_position;
