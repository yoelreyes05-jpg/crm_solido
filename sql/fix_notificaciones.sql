-- ====================================================================
-- FIX: Tabla notificaciones — columnas y índices correctos
-- Ejecutar si hubo errores con "leido" o "usuario_id" al correr fase_a
-- Idempotente: seguro de ejecutar múltiples veces
-- ====================================================================

-- 1. Asegurar que la columna usuario_id exista ANTES de crear el índice
ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS usuario_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE;

-- 2. Asegurar que la columna "leida" exista (el nombre correcto, femenino)
ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS leida BOOLEAN DEFAULT false;

-- 3. Eliminar índices con el nombre incorrecto si fueron creados antes del fix
DROP INDEX IF EXISTS idx_notif_leido;     -- nombre viejo con columna incorrecta
DROP INDEX IF EXISTS idx_notif_usuario;   -- posibles variantes antiguas

-- 4. Crear índices correctos (IF NOT EXISTS → seguro si ya existen)
CREATE INDEX IF NOT EXISTS idx_notif_usuario_id ON notificaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notif_leida      ON notificaciones(leida) WHERE leida = false;

-- 5. Verificación
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'notificaciones'
ORDER BY ordinal_position;
