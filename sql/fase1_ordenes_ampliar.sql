-- =====================================================================
-- FASE 1-C: Ampliar tabla ordenes_trabajo
-- Agrega columnas de control de flujo y fechas de transición.
-- Ejecutar DESPUÉS de fase1_orden_trabajo_log.sql
-- =====================================================================

-- Columnas de fecha por cada etapa del flujo
ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS fecha_diagnostico      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_aprobacion       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_inicio_reparacion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_control_calidad  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_listo            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_entrega          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_cancelacion      TIMESTAMPTZ;

-- Columnas de control del cliente
ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS aprobado_por_cliente   BOOLEAN,
  ADD COLUMN IF NOT EXISTS motivo_cancelacion     TEXT,
  ADD COLUMN IF NOT EXISTS notas_entrega          TEXT;

-- Asegurar que todas las órdenes existentes sin estado tengan RECIBIDO
UPDATE ordenes_trabajo
  SET estado = 'RECIBIDO'
  WHERE estado IS NULL OR estado = '';

-- Índice por estado para el dashboard y kanban
CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON ordenes_trabajo(estado);

COMMENT ON COLUMN ordenes_trabajo.estado IS
  'Estados válidos: RECIBIDO | DIAGNOSTICO | REPARACION | CANCELADA | CONTROL_CALIDAD | LISTO | ENTREGADO';
COMMENT ON COLUMN ordenes_trabajo.aprobado_por_cliente IS
  'NULL = pendiente de decisión, TRUE = aprobó la reparación, FALSE = la rechazó';
