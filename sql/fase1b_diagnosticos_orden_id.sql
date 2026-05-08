-- FASE 1B: Agregar orden_id a tabla diagnosticos
-- Ejecutar en Supabase SQL Editor

ALTER TABLE diagnosticos
  ADD COLUMN IF NOT EXISTS orden_id BIGINT REFERENCES ordenes_trabajo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_diagnosticos_orden_id ON diagnosticos(orden_id);

-- Verificar
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'diagnosticos' AND column_name = 'orden_id';
