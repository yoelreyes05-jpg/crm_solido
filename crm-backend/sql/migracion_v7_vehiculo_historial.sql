-- ============================================================
-- SÓLIDO AUTO SERVICIO — Migración v7
-- Agregar columnas faltantes a vehiculo_historial
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- Columnas de identificación del cliente/vehículo
ALTER TABLE vehiculo_historial
  ADD COLUMN IF NOT EXISTS cliente_id        INT            REFERENCES clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cliente_telefono  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS vehiculo_id       INT            REFERENCES vehiculos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS diagnostico_id    INT,
  ADD COLUMN IF NOT EXISTS marca             VARCHAR(100),
  ADD COLUMN IF NOT EXISTS modelo            VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ano               INT,
  ADD COLUMN IF NOT EXISTS color             VARCHAR(80);

-- Columnas del servicio
ALTER TABLE vehiculo_historial
  ADD COLUMN IF NOT EXISTS diagnostico_general      TEXT,
  ADD COLUMN IF NOT EXISTS inspeccion_mecanica      TEXT,
  ADD COLUMN IF NOT EXISTS inspeccion_electrica     TEXT,
  ADD COLUMN IF NOT EXISTS inspeccion_electronica   TEXT,
  ADD COLUMN IF NOT EXISTS codigos_falla            TEXT,
  ADD COLUMN IF NOT EXISTS fallas_identificadas     TEXT,
  ADD COLUMN IF NOT EXISTS observaciones            TEXT,
  ADD COLUMN IF NOT EXISTS trabajos_realizados      TEXT,
  ADD COLUMN IF NOT EXISTS tecnico_nombre           VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ncf                      VARCHAR(20);

-- Columnas de costos
ALTER TABLE vehiculo_historial
  ADD COLUMN IF NOT EXISTS costo_mano_obra  DECIMAL(12,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_repuestos  DECIMAL(12,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_total      DECIMAL(12,2)  DEFAULT 0;

-- Estado del servicio
ALTER TABLE vehiculo_historial
  ADD COLUMN IF NOT EXISTS estado  VARCHAR(30)  DEFAULT 'ENTREGADO';
  -- ENTREGADO | EN_PROCESO | GARANTIA | CANCELADO

-- Índices para mejorar rendimiento en consultas de Inteligencia
CREATE INDEX IF NOT EXISTS idx_vh_cliente_id     ON vehiculo_historial(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vh_fecha_servicio ON vehiculo_historial(fecha_servicio DESC);
CREATE INDEX IF NOT EXISTS idx_vh_estado         ON vehiculo_historial(estado);
