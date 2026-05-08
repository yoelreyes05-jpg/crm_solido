-- =====================================================================
-- FASE 1-A: Tabla orden_trabajo_log — Audit Trail Inmutable
-- Registra CADA cambio de estado de una orden. No borrar, no editar.
-- =====================================================================

CREATE TABLE IF NOT EXISTS orden_trabajo_log (
  id              BIGSERIAL PRIMARY KEY,
  orden_id        BIGINT        NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  estado_anterior TEXT,
  estado_nuevo    TEXT          NOT NULL,
  usuario_id      BIGINT        REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_nombre  TEXT,
  motivo          TEXT,
  metadata        JSONB         DEFAULT '{}',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Índices para búsquedas rápidas por orden y por fecha
CREATE INDEX IF NOT EXISTS idx_orden_log_orden_id   ON orden_trabajo_log(orden_id);
CREATE INDEX IF NOT EXISTS idx_orden_log_created_at ON orden_trabajo_log(created_at DESC);

-- Sin RLS activo para que el backend (service role) escriba sin restricciones
-- Si tienes RLS activo en tu proyecto, agrega la política correspondiente.

COMMENT ON TABLE orden_trabajo_log IS 'Audit trail inmutable de todos los cambios de estado de órdenes de trabajo.';
