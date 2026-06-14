-- ============================================================
-- SÓLIDO AUTO SERVICIO — Migración v8
-- Fix tabla cotizaciones: columnas faltantes
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- Agregar columnas faltantes (seguro con IF NOT EXISTS)
ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS numero     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS cliente_id INT          REFERENCES clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estado     VARCHAR(20)  DEFAULT 'PENDIENTE';
  -- Estados: PENDIENTE | CONVERTIDA | CANCELADA | VENCIDA

-- Índices para búsqueda por número, estado y cliente
CREATE INDEX IF NOT EXISTS idx_cot_numero     ON cotizaciones(numero);
CREATE INDEX IF NOT EXISTS idx_cot_estado     ON cotizaciones(estado);
CREATE INDEX IF NOT EXISTS idx_cot_cliente    ON cotizaciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cot_created_at ON cotizaciones(created_at DESC);

-- Opcional: asignar número a cotizaciones existentes que no tengan uno
UPDATE cotizaciones
  SET numero = 'COT-' || LPAD(id::text, 5, '0')
WHERE numero IS NULL;
