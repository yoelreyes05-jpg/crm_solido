-- Asociar facturas a su cotización de origen
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS cotizacion_id INTEGER REFERENCES cotizaciones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_cotizacion_id
  ON public.facturas (cotizacion_id);

-- Backfill: asociar facturas existentes a su cotización
-- Funciona porque cotizacion → diagnostico → orden, y la factura tiene vehiculo_id + created_at similar
-- Solo afecta facturas que ya tienen orden_id (del fix anterior) pero no tienen cotizacion_id
UPDATE public.facturas f
SET cotizacion_id = c.id
FROM public.cotizaciones c
JOIN public.diagnosticos d ON d.id = c.diagnostico_id
WHERE f.cotizacion_id IS NULL
  AND f.orden_id = d.orden_id;
