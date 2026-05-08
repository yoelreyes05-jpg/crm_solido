-- =====================================================================
-- FASE 1-B: Tabla inspeccion_vehiculo — Formulario de Recepción
-- Se crea al recibir el vehículo, vinculada a la orden de trabajo.
-- =====================================================================

CREATE TABLE IF NOT EXISTS inspeccion_vehiculo (
  id                    BIGSERIAL PRIMARY KEY,
  orden_id              BIGINT        NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  vehiculo_id           BIGINT        REFERENCES vehiculos(id) ON DELETE SET NULL,
  cliente_id            BIGINT        REFERENCES clientes(id) ON DELETE SET NULL,

  -- Datos de entrada
  km_entrada            INTEGER,
  nivel_combustible     INTEGER       DEFAULT 0 CHECK (nivel_combustible BETWEEN 0 AND 100),
  fecha_recepcion       TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- Condición exterior (texto descriptivo + JSON de zonas marcadas)
  condicion_general     TEXT,         -- Excelente / Buena / Regular / Mala
  zonas_danio           JSONB         DEFAULT '[]',
  -- Formato zonas_danio: [{"zona":"frontal_izq","tipo":"rayon_leve"},{"zona":"trasera","tipo":"golpe"}]
  rayones               TEXT,
  golpes                TEXT,
  estado_vidrios        TEXT,
  estado_llantas        TEXT,
  estado_pintura        TEXT,

  -- Checklist interior / accesorios (TRUE = presente y OK)
  radio_pantalla        BOOLEAN       DEFAULT false,
  tapiceria_ok          BOOLEAN       DEFAULT false,
  alfombras_ok          BOOLEAN       DEFAULT false,
  luces_ok              BOOLEAN       DEFAULT false,
  bocina_ok             BOOLEAN       DEFAULT false,
  espejos_ok            BOOLEAN       DEFAULT false,
  gato_ok               BOOLEAN       DEFAULT false,
  llanta_repuesto_ok    BOOLEAN       DEFAULT false,
  documentos_ok         BOOLEAN       DEFAULT false,     -- licencia, marbete
  herramientas_ok       BOOLEAN       DEFAULT false,
  otros_accesorios      TEXT,

  -- Fotos (array de objetos {url o base64, etiqueta})
  fotos                 JSONB         DEFAULT '[]',
  -- Formato: [{"data":"base64...","label":"Frente"},{"data":"base64...","label":"Lado derecho"}]

  -- Firma del cliente (canvas → base64)
  firma_cliente         TEXT,

  -- Observaciones libres
  observaciones         TEXT,

  -- Auditoría
  creado_por_id         BIGINT        REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_por_nombre     TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Índice: una inspección por orden (puede haber más de una si el vehículo regresa)
CREATE INDEX IF NOT EXISTS idx_inspeccion_orden_id   ON inspeccion_vehiculo(orden_id);
CREATE INDEX IF NOT EXISTS idx_inspeccion_vehiculo_id ON inspeccion_vehiculo(vehiculo_id);

COMMENT ON TABLE inspeccion_vehiculo IS 'Formulario de inspección de recepción del vehículo: condición, fotos, firma del cliente.';
