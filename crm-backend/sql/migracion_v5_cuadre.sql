-- ============================================================
-- SÓLIDO AUTO SERVICIO — Migración v5
-- Ampliar tabla cuadre_caja con campos adicionales
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

ALTER TABLE cuadre_caja
  ADD COLUMN IF NOT EXISTS ventas_cheque    DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ventas_credito   DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cafe_efectivo    DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cafe_total       DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS facturas_count   INT           DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipo             VARCHAR(10)   DEFAULT 'MANUAL',
  -- MANUAL | AUTO
  ADD COLUMN IF NOT EXISTS efectivo_contado DECIMAL(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notas            TEXT;
