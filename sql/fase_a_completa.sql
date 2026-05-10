-- ====================================================================
-- FASE A — MIGRACIÓN COMPLETA CRM AUTOMOTRIZ
-- Ejecutar en Supabase SQL Editor (una vez, en orden)
-- Fecha: Mayo 2026
-- ====================================================================

-- ====================================================================
-- BLOQUE 1: Audit trail de órdenes (orden_trabajo_log)
-- ====================================================================
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

CREATE INDEX IF NOT EXISTS idx_orden_log_orden_id   ON orden_trabajo_log(orden_id);
CREATE INDEX IF NOT EXISTS idx_orden_log_created_at ON orden_trabajo_log(created_at DESC);

COMMENT ON TABLE orden_trabajo_log IS
  'Audit trail inmutable: registra cada cambio de estado de una orden de trabajo.';

-- ====================================================================
-- BLOQUE 2: Inspección de vehículo al ingreso (inspeccion_vehiculo)
-- ====================================================================
CREATE TABLE IF NOT EXISTS inspeccion_vehiculo (
  id                    BIGSERIAL PRIMARY KEY,
  orden_id              BIGINT        NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  vehiculo_id           BIGINT        REFERENCES vehiculos(id) ON DELETE SET NULL,
  cliente_id            BIGINT        REFERENCES clientes(id) ON DELETE SET NULL,

  km_entrada            INTEGER,
  nivel_combustible     INTEGER       DEFAULT 0 CHECK (nivel_combustible BETWEEN 0 AND 100),
  fecha_recepcion       TIMESTAMPTZ   NOT NULL DEFAULT now(),

  condicion_general     TEXT,
  zonas_danio           JSONB         DEFAULT '[]',
  rayones               TEXT,
  golpes                TEXT,
  estado_vidrios        TEXT,
  estado_llantas        TEXT,
  estado_pintura        TEXT,

  radio_pantalla        BOOLEAN       DEFAULT false,
  tapiceria_ok          BOOLEAN       DEFAULT false,
  alfombras_ok          BOOLEAN       DEFAULT false,
  luces_ok              BOOLEAN       DEFAULT false,
  bocina_ok             BOOLEAN       DEFAULT false,
  espejos_ok            BOOLEAN       DEFAULT false,
  gato_ok               BOOLEAN       DEFAULT false,
  llanta_repuesto_ok    BOOLEAN       DEFAULT false,
  documentos_ok         BOOLEAN       DEFAULT false,
  herramientas_ok       BOOLEAN       DEFAULT false,
  otros_accesorios      TEXT,

  fotos                 JSONB         DEFAULT '[]',
  firma_cliente         TEXT,
  observaciones         TEXT,

  creado_por_id         BIGINT        REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_por_nombre     TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspeccion_orden_id    ON inspeccion_vehiculo(orden_id);
CREATE INDEX IF NOT EXISTS idx_inspeccion_vehiculo_id ON inspeccion_vehiculo(vehiculo_id);

COMMENT ON TABLE inspeccion_vehiculo IS
  'Formulario de inspección de recepción: condición del vehículo, fotos y firma del cliente.';

-- ====================================================================
-- BLOQUE 3: Ampliar tabla ordenes_trabajo
-- ====================================================================

-- Fechas de transición por etapa
ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS fecha_diagnostico           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_esperando_aprobacion  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_aprobacion            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_inicio_reparacion     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_control_calidad       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_listo                 TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_entrega               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_cancelacion           TIMESTAMPTZ;

-- Control de cliente y cancelación
ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS aprobado_por_cliente   BOOLEAN,
  ADD COLUMN IF NOT EXISTS motivo_cancelacion     TEXT,
  ADD COLUMN IF NOT EXISTS notas_entrega          TEXT,
  ADD COLUMN IF NOT EXISTS motivo_rechazo_calidad TEXT;

-- Número de orden legible (OT-0001)
ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS numero_orden TEXT UNIQUE;

-- Asignación de técnico y prioridad
ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS tecnico_asignado_id   BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prioridad             TEXT    DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS motivo_entrada        TEXT;

-- Vínculo obligatorio a inspección
ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS inspeccion_id BIGINT REFERENCES inspeccion_vehiculo(id) ON DELETE SET NULL;

-- Asegurar estado inicial en registros existentes
UPDATE ordenes_trabajo
  SET estado = 'RECIBIDO', status = 'RECIBIDO'
  WHERE estado IS NULL OR estado = '';

-- Índice por estado para dashboard y kanban
CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON ordenes_trabajo(estado);

-- Secuencia para número de orden
CREATE SEQUENCE IF NOT EXISTS orden_numero_seq START WITH 1;

-- Generar numero_orden en registros existentes que no lo tienen (basado en ID)
UPDATE ordenes_trabajo
  SET numero_orden = 'OT-' || LPAD(id::TEXT, 4, '0')
  WHERE numero_orden IS NULL;

-- Trigger para auto-generar numero_orden en nuevas órdenes
CREATE OR REPLACE FUNCTION fn_generar_numero_orden()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_orden IS NULL THEN
    NEW.numero_orden := 'OT-' || LPAD(nextval('orden_numero_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_numero_orden ON ordenes_trabajo;
CREATE TRIGGER trg_numero_orden
  BEFORE INSERT ON ordenes_trabajo
  FOR EACH ROW EXECUTE FUNCTION fn_generar_numero_orden();

COMMENT ON COLUMN ordenes_trabajo.numero_orden IS
  'Número secuencial legible: OT-0001, OT-0002... Auto-generado por trigger.';
COMMENT ON COLUMN ordenes_trabajo.estado IS
  'Estados válidos: RECIBIDO | DIAGNOSTICO | ESPERANDO_APROBACION | REPARACION | CANCELADA | CONTROL_CALIDAD | LISTO | ENTREGADO';

-- ====================================================================
-- BLOQUE 4: Agregar orden_id a diagnósticos
-- ====================================================================
ALTER TABLE diagnosticos
  ADD COLUMN IF NOT EXISTS orden_id BIGINT REFERENCES ordenes_trabajo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_diagnosticos_orden_id ON diagnosticos(orden_id);

-- ====================================================================
-- BLOQUE 5: Soft delete en clientes y vehículos
-- ====================================================================

-- Clientes
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;

-- Marcar todos los existentes como activos
UPDATE clientes SET activo = true WHERE activo IS NULL;

-- Vehículos
ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;

UPDATE vehiculos SET activo = true WHERE activo IS NULL;

-- ====================================================================
-- BLOQUE 6: Mejorar tabla de usuarios para JWT
-- ====================================================================
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMPTZ;

-- ====================================================================
-- BLOQUE 7: Tabla de notificaciones internas (preparación Fase D)
-- Nota: si la tabla ya existe se adapta con ALTER TABLE para no romper
--       datos existentes. La columna se llama "leida" (femenino) en
--       tablas creadas antes de esta migración.
-- ====================================================================
CREATE TABLE IF NOT EXISTS notificaciones (
  id          BIGSERIAL PRIMARY KEY,
  tipo        TEXT        NOT NULL DEFAULT 'INFO', -- INFO | ALERTA | URGENTE
  mensaje     TEXT        NOT NULL,
  leida       BOOLEAN     DEFAULT false,
  orden_id    BIGINT      REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agregar columnas opcionales si aún no existen (idempotente)
ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS usuario_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE;

ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS leida BOOLEAN DEFAULT false;

-- Índices (usan los nombres reales de columna)
CREATE INDEX IF NOT EXISTS idx_notif_usuario_id ON notificaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notif_leida      ON notificaciones(leida) WHERE leida = false;

COMMENT ON TABLE notificaciones IS
  'Notificaciones internas del sistema: nueva orden asignada, aprobación recibida, etc.';

-- ====================================================================
-- VERIFICACIÓN FINAL
-- ====================================================================
SELECT
  'orden_trabajo_log'    AS tabla, COUNT(*) AS filas FROM orden_trabajo_log
UNION ALL SELECT
  'inspeccion_vehiculo',           COUNT(*) FROM inspeccion_vehiculo
UNION ALL SELECT
  'ordenes_con_numero',            COUNT(*) FROM ordenes_trabajo WHERE numero_orden IS NOT NULL
UNION ALL SELECT
  'clientes_activos',              COUNT(*) FROM clientes WHERE activo = true
UNION ALL SELECT
  'vehiculos_activos',             COUNT(*) FROM vehiculos WHERE activo = true;
