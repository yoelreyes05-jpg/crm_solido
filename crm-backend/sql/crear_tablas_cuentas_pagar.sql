-- ============================================================
-- SÓLIDO AUTO SERVICIO — Migración v3
-- Nuevas tablas: Cuentas por Pagar
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. CUENTAS POR PAGAR
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cuentas_pagar (
  id                 SERIAL PRIMARY KEY,
  suplidor_id        INT REFERENCES suplidores(id) ON DELETE SET NULL,
  suplidor_nombre    VARCHAR(200),          -- Nombre libre si no está en catálogo
  descripcion        TEXT NOT NULL,
  monto_original     DECIMAL(12,2) NOT NULL,
  monto_pagado       DECIMAL(12,2) DEFAULT 0,
  fecha_emision      DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento  DATE NOT NULL,
  estado             VARCHAR(20) DEFAULT 'PENDIENTE',
  -- PENDIENTE | PARCIAL | PAGADO | VENCIDO | ANULADO
  notas              TEXT,
  created_by         VARCHAR(100),
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 2. PAGOS DE CUENTAS POR PAGAR
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pagos_pagar (
  id          SERIAL PRIMARY KEY,
  cuenta_id   INT REFERENCES cuentas_pagar(id) ON DELETE CASCADE,
  monto       DECIMAL(12,2) NOT NULL,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo      VARCHAR(30) DEFAULT 'EFECTIVO',
  -- EFECTIVO | TARJETA | TRANSFERENCIA | CHEQUE
  referencia  VARCHAR(200),
  notas       TEXT,
  usuario     VARCHAR(100),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 3. ÍNDICES
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cpagar_suplidor    ON cuentas_pagar(suplidor_id);
CREATE INDEX IF NOT EXISTS idx_cpagar_estado      ON cuentas_pagar(estado);
CREATE INDEX IF NOT EXISTS idx_cpagar_vencimiento ON cuentas_pagar(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_ppagar_cuenta      ON pagos_pagar(cuenta_id);
