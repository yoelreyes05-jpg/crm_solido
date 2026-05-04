-- ============================================================
-- SÓLIDO AUTO SERVICIO — Migración v4
-- 1. Columnas nuevas en suplidores
-- 2. Tabla cotizaciones
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- ─── 1. SUPLIDORES — columnas adicionales ─────────────────
ALTER TABLE suplidores
  ADD COLUMN IF NOT EXISTS rnc        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS direccion  TEXT,
  ADD COLUMN IF NOT EXISTS telefono   VARCHAR(50),
  ADD COLUMN IF NOT EXISTS correo     VARCHAR(200);

-- ─── 2. COTIZACIONES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS cotizaciones (
  id             SERIAL PRIMARY KEY,
  numero         VARCHAR(20) UNIQUE,          -- COT-00001
  cliente_id     INT REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_nombre VARCHAR(200),
  cliente_rnc    VARCHAR(50),
  vehiculo_id    INT REFERENCES vehiculos(id) ON DELETE SET NULL,
  vehiculo_info  VARCHAR(200),
  items          JSONB NOT NULL DEFAULT '[]',
  subtotal       DECIMAL(12,2) DEFAULT 0,
  itbis          DECIMAL(12,2) DEFAULT 0,
  total          DECIMAL(12,2) DEFAULT 0,
  ncf_tipo       VARCHAR(10)   DEFAULT 'B02',
  estado         VARCHAR(20)   DEFAULT 'PENDIENTE',
  -- PENDIENTE | CONVERTIDA | CANCELADA | VENCIDA
  factura_id     INT REFERENCES facturas(id) ON DELETE SET NULL,
  valida_hasta   DATE,
  notas          TEXT,
  created_by     VARCHAR(100),
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cot_estado     ON cotizaciones(estado);
CREATE INDEX IF NOT EXISTS idx_cot_cliente    ON cotizaciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cot_created_at ON cotizaciones(created_at DESC);
