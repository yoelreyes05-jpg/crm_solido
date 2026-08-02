-- ══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN V23 — CUOTAS DE MEMBRESÍA (cobro desde Facturación)
-- La membresía ya no se cobra completa al inscribir: se generan CUOTAS
-- (total, 50/50 o mensual) que la secretaria cobra desde Facturación →
-- pestaña "Por Cobrar". Idempotente: se puede correr varias veces.
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Campos nuevos en plan_membresias
ALTER TABLE plan_membresias ADD COLUMN IF NOT EXISTS modalidad_pago TEXT DEFAULT 'TOTAL';
ALTER TABLE plan_membresias ADD COLUMN IF NOT EXISTS monto_total NUMERIC(12,2) DEFAULT 0;
ALTER TABLE plan_membresias ADD COLUMN IF NOT EXISTS saldo_pendiente NUMERIC(12,2) DEFAULT 0;

-- Normalizar valores viejos antes del CHECK (mismo problema que la v22)
UPDATE plan_membresias
SET modalidad_pago = 'TOTAL'
WHERE modalidad_pago IS NULL
   OR UPPER(TRIM(modalidad_pago)) NOT IN ('TOTAL', 'MITAD', 'MENSUAL');

UPDATE plan_membresias SET modalidad_pago = UPPER(TRIM(modalidad_pago));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plan_membresias_modalidad_chk'
  ) THEN
    ALTER TABLE plan_membresias
      ADD CONSTRAINT plan_membresias_modalidad_chk
      CHECK (modalidad_pago IN ('TOTAL', 'MITAD', 'MENSUAL'));
  END IF;
END $$;

-- 2. Tabla de cuotas
CREATE TABLE IF NOT EXISTS plan_cuotas (
  id                BIGSERIAL PRIMARY KEY,
  membresia_id      BIGINT NOT NULL REFERENCES plan_membresias(id) ON DELETE CASCADE,
  cliente_id        BIGINT,
  numero            INT NOT NULL,            -- cuota 1 de N
  total_cuotas      INT NOT NULL DEFAULT 1,  -- N
  monto             NUMERIC(12,2) NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  estado            TEXT NOT NULL DEFAULT 'PENDIENTE'
                    CHECK (estado IN ('PENDIENTE', 'PAGADA', 'ANULADA')),
  metodo_pago       TEXT,
  pagada_at         TIMESTAMPTZ,
  cobrada_por       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_cuotas_membresia ON plan_cuotas(membresia_id);
CREATE INDEX IF NOT EXISTS idx_plan_cuotas_estado    ON plan_cuotas(estado, fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_plan_cuotas_cliente   ON plan_cuotas(cliente_id);
