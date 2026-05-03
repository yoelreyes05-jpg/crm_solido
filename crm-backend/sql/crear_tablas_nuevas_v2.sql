-- ============================================================
-- SÓLIDO AUTO SERVICIO — Migración v2
-- Nuevas tablas: Mantenimiento Preventivo + Cuentas por Cobrar
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. MANTENIMIENTO PREVENTIVO
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mantenimiento_preventivo (
  id                     SERIAL PRIMARY KEY,
  vehiculo_id            INT REFERENCES vehiculos(id) ON DELETE CASCADE,
  cliente_id             INT REFERENCES clientes(id) ON DELETE SET NULL,
  tipo_servicio          VARCHAR(100) NOT NULL,
  descripcion            TEXT,
  intervalo_dias         INT,
  intervalo_km           INT,
  ultimo_servicio_fecha  DATE,
  ultimo_servicio_km     INT,
  proximo_fecha          DATE,
  proximo_km             INT,
  estado                 VARCHAR(30) DEFAULT 'ACTIVO',
  -- ACTIVO | VENCIDO | COMPLETADO | CANCELADO
  notificado             BOOLEAN DEFAULT FALSE,
  diagnostico_origen_id  INT,
  created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 2. ALERTAS DE MANTENIMIENTO
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mantenimiento_alertas (
  id                 SERIAL PRIMARY KEY,
  mantenimiento_id   INT REFERENCES mantenimiento_preventivo(id) ON DELETE CASCADE,
  vehiculo_id        INT,
  cliente_id         INT,
  tipo_alerta        VARCHAR(30) DEFAULT 'INTERNA',
  -- INTERNA | TELEGRAM | WHATSAPP
  estado             VARCHAR(20) DEFAULT 'PENDIENTE',
  -- PENDIENTE | ENVIADA | VISTA
  mensaje            TEXT,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 3. CUENTAS POR COBRAR
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cuentas_cobrar (
  id                 SERIAL PRIMARY KEY,
  cliente_id         INT REFERENCES clientes(id) ON DELETE SET NULL,
  factura_id         INT REFERENCES facturas(id) ON DELETE SET NULL,
  descripcion        TEXT NOT NULL,
  monto_original     DECIMAL(12,2) NOT NULL,
  monto_pagado       DECIMAL(12,2) DEFAULT 0,
  fecha_emision      DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento  DATE NOT NULL,
  estado             VARCHAR(20) DEFAULT 'PENDIENTE',
  -- PENDIENTE | PARCIAL | PAGADO | VENCIDO | INCOBRABLE
  notas              TEXT,
  created_by         VARCHAR(100),
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 4. PAGOS DE CUENTAS POR COBRAR
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pagos_cobrar (
  id          SERIAL PRIMARY KEY,
  cuenta_id   INT REFERENCES cuentas_cobrar(id) ON DELETE CASCADE,
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
-- 5. ÍNDICES PARA RENDIMIENTO
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mant_vehiculo ON mantenimiento_preventivo(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_mant_estado   ON mantenimiento_preventivo(estado);
CREATE INDEX IF NOT EXISTS idx_mant_fecha    ON mantenimiento_preventivo(proximo_fecha);
CREATE INDEX IF NOT EXISTS idx_cc_cliente    ON cuentas_cobrar(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cc_estado     ON cuentas_cobrar(estado);
CREATE INDEX IF NOT EXISTS idx_cc_vencimiento ON cuentas_cobrar(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_pc_cuenta     ON pagos_cobrar(cuenta_id);
