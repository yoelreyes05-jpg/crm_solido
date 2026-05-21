-- ================================================================
-- FASE 4: SNAPSHOT COMPLETO EN vehiculo_historial
-- Ejecutar en Supabase SQL Editor
-- Agrega columnas para guardar TODO el proceso al momento de entrega
-- ================================================================

ALTER TABLE public.vehiculo_historial
  -- Datos de la orden
  ADD COLUMN IF NOT EXISTS numero_orden      TEXT,
  ADD COLUMN IF NOT EXISTS motivo_entrada    TEXT,
  ADD COLUMN IF NOT EXISTS notas_entrega     TEXT,
  -- Control de Calidad
  ADD COLUMN IF NOT EXISTS resultado_qc      TEXT,
  ADD COLUMN IF NOT EXISTS observaciones_qc  TEXT,
  ADD COLUMN IF NOT EXISTS checklist_qc      JSONB DEFAULT '{}'::jsonb,
  -- Snapshots completos (guardados al momento de entrega)
  ADD COLUMN IF NOT EXISTS avances_data      JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cotizacion_data   JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS factura_data      JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS timeline_data     JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fechas_proceso    JSONB DEFAULT '{}'::jsonb;

-- Índice para búsqueda por número de orden
CREATE INDEX IF NOT EXISTS idx_vh_numero_orden
  ON public.vehiculo_historial (numero_orden);
