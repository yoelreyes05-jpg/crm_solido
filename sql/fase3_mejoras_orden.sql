-- ============================================================
-- FASE 3: Mejoras de Orden de Trabajo — QC, Entrega, Cancelación
-- ============================================================

-- Nuevas columnas en ordenes_trabajo
ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS usuario_cancelo       TEXT,
  ADD COLUMN IF NOT EXISTS tecnico_qc            TEXT,
  ADD COLUMN IF NOT EXISTS checklist_qc          JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS observaciones_qc      TEXT,
  ADD COLUMN IF NOT EXISTS resultado_qc          TEXT,
  ADD COLUMN IF NOT EXISTS usuario_entrego       TEXT,
  ADD COLUMN IF NOT EXISTS firma_entrega         TEXT;

-- Nueva columna en diagnosticos
ALTER TABLE public.diagnosticos
  ADD COLUMN IF NOT EXISTS trabajos_realizados_items JSONB DEFAULT '[]'::jsonb;
