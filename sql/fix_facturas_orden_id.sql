-- Agregar orden_id a facturas para poder asociarlas a la orden de trabajo
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS orden_id INTEGER REFERENCES ordenes_trabajo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_orden_id
  ON public.facturas (orden_id);

-- Backfill: asociar facturas existentes a su orden_id via vehiculo_id + fecha cercana
-- (opcional, solo si quieres retroactivamente llenar registros anteriores)
-- UPDATE facturas f
-- SET orden_id = ot.id
-- FROM ordenes_trabajo ot
-- WHERE f.vehiculo_id = ot.vehiculo_id
--   AND f.orden_id IS NULL
--   AND ot.estado IN ('ENTREGADO', 'CERRADO')
--   AND f.created_at BETWEEN ot.created_at AND ot.created_at + INTERVAL '90 days';
