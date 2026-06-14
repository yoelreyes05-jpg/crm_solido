-- ============================================================
-- SÓLIDO AUTO SERVICIO — Migración v9
-- Agregar columnas de facturación a tabla cotizaciones
-- La tabla existía solo para diagnósticos; se expande para
-- soportar cotizaciones formales desde el módulo de facturación.
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS numero          VARCHAR(20),
  ADD COLUMN IF NOT EXISTS cliente_id      INT           REFERENCES clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cliente_nombre  VARCHAR(200),
  ADD COLUMN IF NOT EXISTS cliente_rnc     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS vehiculo_id     INT           REFERENCES vehiculos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vehiculo_info   VARCHAR(200),
  ADD COLUMN IF NOT EXISTS items           JSONB         NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS subtotal        DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS itbis           DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ncf_tipo        VARCHAR(10)   DEFAULT 'B02',
  ADD COLUMN IF NOT EXISTS estado          VARCHAR(20)   DEFAULT 'PENDIENTE',
  ADD COLUMN IF NOT EXISTS factura_id      INT           REFERENCES facturas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valida_hasta    DATE,
  ADD COLUMN IF NOT EXISTS created_by      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  -- estados: PENDIENTE | CONVERTIDA | CANCELADA | VENCIDA

-- Nota: la columna "total" ya existe en la tabla original de diagnósticos,
-- por eso no se agrega aquí. Si da error de que NO existe, agrégala:
-- ADD COLUMN IF NOT EXISTS total DECIMAL(12,2) DEFAULT 0,

-- Índices para búsqueda y rendimiento
CREATE INDEX IF NOT EXISTS idx_cot_numero     ON cotizaciones(numero);
CREATE INDEX IF NOT EXISTS idx_cot_estado     ON cotizaciones(estado);
CREATE INDEX IF NOT EXISTS idx_cot_cliente    ON cotizaciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cot_created_at ON cotizaciones(created_at DESC);

-- Asignar número a cotizaciones existentes que no lo tengan
UPDATE cotizaciones
  SET numero = 'COT-' || LPAD(id::text, 5, '0')
WHERE numero IS NULL;
