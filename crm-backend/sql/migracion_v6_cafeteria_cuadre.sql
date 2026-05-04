-- ============================================================
-- SÓLIDO AUTO SERVICIO — Migración v6
-- Tabla para el cuadre de caja de cafetería
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS cafeteria_cuadre (
  id                   SERIAL PRIMARY KEY,
  fecha                DATE           NOT NULL,
  usuario              VARCHAR(100)   DEFAULT 'Sistema',
  ventas_efectivo      DECIMAL(12,2)  DEFAULT 0,
  ventas_tarjeta       DECIMAL(12,2)  DEFAULT 0,
  ventas_transferencia DECIMAL(12,2)  DEFAULT 0,
  ventas_total         DECIMAL(12,2)  DEFAULT 0,
  transacciones_count  INT            DEFAULT 0,
  efectivo_contado     DECIMAL(12,2)  DEFAULT NULL,
  diferencia           DECIMAL(12,2)  DEFAULT 0,
  notas                TEXT,
  creado_en            TIMESTAMPTZ    DEFAULT NOW()
);

-- Índice para búsquedas por fecha
CREATE INDEX IF NOT EXISTS idx_cafeteria_cuadre_fecha ON cafeteria_cuadre(fecha DESC);
