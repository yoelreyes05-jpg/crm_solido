-- ================================================================
-- FASE 5: Agregar snapshot de inspección vehicular al historial
-- Ejecutar en Supabase SQL Editor
-- ================================================================

ALTER TABLE public.vehiculo_historial
  ADD COLUMN IF NOT EXISTS inspeccion_data JSONB DEFAULT '{}'::jsonb;

-- Índice opcional para consultas sobre inspección
COMMENT ON COLUMN public.vehiculo_historial.inspeccion_data IS
  'Snapshot de inspeccion_vehiculo al momento de entrega: km, combustible, condición, checklist, zonas de daño, fotos, firma.';
