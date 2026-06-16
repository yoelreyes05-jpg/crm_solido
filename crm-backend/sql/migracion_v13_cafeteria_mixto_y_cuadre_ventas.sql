-- ============================================================
-- SOLIDO AUTO SERVICIO - Migracion v13
-- 1) Pago MIXTO en el POS de cafeteria (efectivo + tarjeta + transferencia)
-- 2) Columnas de ventas en el cuadre de caja de cafeteria (por si ya
--    se habia corrido v12 sin ellas).
-- Idempotente: ADD COLUMN IF NOT EXISTS. Ejecutar despues de v11 y v12.
-- ============================================================

-- 1) Desglose de pago mixto en cada venta del POS de cafeteria
ALTER TABLE cafeteria_ventas
  ADD COLUMN IF NOT EXISTS monto_efectivo      NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_tarjeta       NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_transferencia NUMERIC(12,2) DEFAULT 0;

-- 2) Columnas de ventas en el cuadre de caja de cafeteria
ALTER TABLE cafeteria_cuadre_caja
  ADD COLUMN IF NOT EXISTS ventas_efectivo      NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ventas_tarjeta       NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ventas_transferencia NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ventas_total         NUMERIC(12,2) DEFAULT 0;

-- Listo.
