-- Asociar facturas a su cotización y orden de trabajo
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columnas si no existen
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS orden_id       INTEGER REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cotizacion_id  INTEGER REFERENCES cotizaciones(id)    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_orden_id      ON public.facturas (orden_id);
CREATE INDEX IF NOT EXISTS idx_facturas_cotizacion_id ON public.facturas (cotizacion_id);

-- 2. Backfill orden_id desde diagnostico_id (facturas que llegaron via POST /facturas con diagnóstico)
UPDATE public.facturas f
SET orden_id = d.orden_id
FROM public.diagnosticos d
WHERE f.diagnostico_id = d.id
  AND f.orden_id IS NULL
  AND d.orden_id IS NOT NULL;

-- 3. Backfill cotizacion_id desde diagnostico_id
UPDATE public.facturas f
SET cotizacion_id = c.id
FROM public.cotizaciones c
WHERE f.diagnostico_id = c.diagnostico_id
  AND f.cotizacion_id IS NULL;

-- 4. Backfill orden_id desde cotizacion_id (facturas convertidas via /cotizaciones/:id/convertir)
UPDATE public.facturas f
SET orden_id = d.orden_id
FROM public.cotizaciones c
JOIN public.diagnosticos d ON d.id = c.diagnostico_id
WHERE f.cotizacion_id = c.id
  AND f.orden_id IS NULL
  AND d.orden_id IS NOT NULL;

-- Verificar resultado
SELECT id, diagnostico_id, cotizacion_id, orden_id, cliente_nombre, total
FROM public.facturas
ORDER BY id DESC
LIMIT 20;
