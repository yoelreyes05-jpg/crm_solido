-- ══════════════════════════════════════════════════════════════════════════
-- MIGRACION V31 - MODULO DE SEGURIDAD Y ALTAVOZ
--
-- Dos cosas que hoy viven fuera del sistema y pasan a ser un modulo:
--
--   SEGURIDAD  Camaras y alarma del taller. Las camaras todavia no estan
--              instaladas, asi que el modulo arranca como inventario y
--              bitacora: donde va cada camara, que cubre, en que estado esta
--              y quien armo o desarmo la alarma. `url_stream` queda lista
--              para el dia que se conecte el DVR, sin migracion nueva.
--
--   ALTAVOZ    Llamar tecnicos por bocina. No hay equipo de audio en red: el
--              anuncio se guarda en cola y una PC del taller con bocinas, con
--              /altavoz/receptor abierto, lo locuta con la voz del navegador.
--              La cola en base de datos y no un websocket a proposito: si la
--              PC se reinicia o pierde wifi, al volver locuta lo pendiente en
--              vez de perderlo.
--
-- Idempotente: se puede correr varias veces.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 1. CAMARAS
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS seguridad_camaras (
  id                BIGSERIAL PRIMARY KEY,
  codigo            VARCHAR(20)  NOT NULL UNIQUE,      -- CAM-01
  nombre            TEXT         NOT NULL,
  ubicacion         TEXT         NOT NULL,             -- "Entrada principal"
  cubre             TEXT,                              -- que se ve desde ahi
  tipo              TEXT         NOT NULL DEFAULT 'FIJA'
                      CHECK (tipo IN ('FIJA','DOMO','PTZ','BULLET','INTERIOR')),
  interior          BOOLEAN      NOT NULL DEFAULT FALSE,

  -- Datos del equipo. Vacios mientras no se compre: el modulo sirve igual
  -- como plano de instalacion y presupuesto.
  marca             TEXT,
  modelo            TEXT,
  numero_serie      TEXT,
  ip                TEXT,
  canal_dvr         INT,                               -- numero de canal en el NVR
  url_stream        TEXT,                              -- rtsp://... cuando exista
  resolucion        TEXT,                              -- "1080p", "4K"
  vision_nocturna   BOOLEAN      NOT NULL DEFAULT TRUE,

  estado            TEXT         NOT NULL DEFAULT 'PLANIFICADA'
                      CHECK (estado IN ('PLANIFICADA','INSTALADA','EN_LINEA','FUERA_DE_LINEA','EN_REPARACION','RETIRADA')),
  fecha_instalacion DATE,
  costo_estimado    NUMERIC(12,2),
  notas             TEXT,
  activo            BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cam_estado ON seguridad_camaras(estado);
CREATE INDEX IF NOT EXISTS idx_cam_activo ON seguridad_camaras(activo);

-- Plano inicial de las 8 posiciones tipicas de un taller. Se editan desde la
-- interfaz; esto es solo para no arrancar con la pantalla vacia.
INSERT INTO seguridad_camaras (codigo, nombre, ubicacion, cubre, tipo, interior, estado) VALUES
  ('CAM-01','Entrada principal','Porton de entrada','Vehiculos que entran y salen, placas','BULLET',FALSE,'PLANIFICADA'),
  ('CAM-02','Patio de recepcion','Area de recepcion','Vehiculos en espera de diagnostico','DOMO',FALSE,'PLANIFICADA'),
  ('CAM-03','Bahias de trabajo','Nave del taller','Elevadores y puestos de trabajo','DOMO',TRUE,'PLANIFICADA'),
  ('CAM-04','Almacen de repuestos','Almacen','Entrada al almacen y estanteria','INTERIOR',TRUE,'PLANIFICADA'),
  ('CAM-05','Caja y recepcion','Mostrador','Punto de cobro','INTERIOR',TRUE,'PLANIFICADA'),
  ('CAM-06','Car Wash','Area de lavado','Bahia de lavado y detallado','BULLET',FALSE,'PLANIFICADA'),
  ('CAM-07','Parqueo trasero','Parte trasera','Vehiculos entregados y en espera','BULLET',FALSE,'PLANIFICADA'),
  ('CAM-08','Cafeteria','Area de espera del cliente','Sala de espera y cafeteria','INTERIOR',TRUE,'PLANIFICADA')
ON CONFLICT (codigo) DO UPDATE SET
  nombre     = EXCLUDED.nombre,
  ubicacion  = EXCLUDED.ubicacion,
  cubre      = EXCLUDED.cubre,
  updated_at = NOW();


-- ══════════════════════════════════════════════════════════════════════════
-- 2. ZONAS DE ALARMA
--
-- Una zona es cada sensor del panel. Se separan de las camaras porque un
-- taller tipico tiene mas sensores que camaras y se arman por separado
-- (de noche se arma todo, de dia solo el almacen).
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS seguridad_zonas (
  id            BIGSERIAL PRIMARY KEY,
  codigo        VARCHAR(20) NOT NULL UNIQUE,           -- Z-01
  nombre        TEXT        NOT NULL,
  tipo_sensor   TEXT        NOT NULL DEFAULT 'MAGNETICO'
                  CHECK (tipo_sensor IN ('MAGNETICO','MOVIMIENTO','HUMO','ROTURA_CRISTAL','PANICO','TEMPERATURA')),
  ubicacion     TEXT,
  -- Una zona "24 horas" (humo, panico) suena aunque la alarma este desarmada.
  siempre_activa BOOLEAN    NOT NULL DEFAULT FALSE,
  estado        TEXT        NOT NULL DEFAULT 'PLANIFICADA'
                  CHECK (estado IN ('PLANIFICADA','INSTALADA','OK','ABIERTA','FALLA','ANULADA')),
  notas         TEXT,
  activo        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO seguridad_zonas (codigo, nombre, tipo_sensor, ubicacion, siempre_activa, estado) VALUES
  ('Z-01','Porton principal','MAGNETICO','Entrada',FALSE,'PLANIFICADA'),
  ('Z-02','Puerta de almacen','MAGNETICO','Almacen',FALSE,'PLANIFICADA'),
  ('Z-03','Movimiento nave','MOVIMIENTO','Nave del taller',FALSE,'PLANIFICADA'),
  ('Z-04','Movimiento oficina','MOVIMIENTO','Oficina',FALSE,'PLANIFICADA'),
  ('Z-05','Humo nave','HUMO','Nave del taller',TRUE,'PLANIFICADA'),
  ('Z-06','Boton de panico caja','PANICO','Mostrador',TRUE,'PLANIFICADA')
ON CONFLICT (codigo) DO UPDATE SET
  nombre      = EXCLUDED.nombre,
  tipo_sensor = EXCLUDED.tipo_sensor,
  ubicacion   = EXCLUDED.ubicacion,
  updated_at  = NOW();


-- ══════════════════════════════════════════════════════════════════════════
-- 3. BITACORA DE SEGURIDAD
--
-- Todo lo que pasa en el modulo queda aqui: quien armo, quien desarmo, que
-- camara se cayo, que zona se abrio. Es la tabla que responde "¿quien dejo el
-- taller sin alarma el viernes?".
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS seguridad_eventos (
  id             BIGSERIAL PRIMARY KEY,
  tipo           TEXT        NOT NULL
                   CHECK (tipo IN ('ARMADO','DESARMADO','ALARMA','ZONA_ABIERTA','CAMARA_OFFLINE',
                                   'CAMARA_ONLINE','MANTENIMIENTO','ANUNCIO','PRUEBA','NOTA')),
  severidad      TEXT        NOT NULL DEFAULT 'info'
                   CHECK (severidad IN ('info','aviso','critico')),
  descripcion    TEXT        NOT NULL,
  camara_codigo  VARCHAR(20),
  zona_codigo    VARCHAR(20),
  usuario_id     BIGINT,
  usuario_nombre TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seg_ev_fecha ON seguridad_eventos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seg_ev_tipo  ON seguridad_eventos(tipo);


-- ══════════════════════════════════════════════════════════════════════════
-- 4. ALTAVOZ — COLA DE ANUNCIOS
--
-- `estado` PENDIENTE → REPRODUCIDO. El receptor de la PC del taller reclama
-- los pendientes, los locuta y los marca. Si nadie tiene el receptor abierto
-- se quedan PENDIENTE y la interfaz avisa que no hay receptor conectado — es
-- mejor eso que anunciar al vacio y creer que el tecnico fue avisado.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS altavoz_anuncios (
  id              BIGSERIAL PRIMARY KEY,
  mensaje         TEXT        NOT NULL,
  tipo            TEXT        NOT NULL DEFAULT 'LLAMADO'
                    CHECK (tipo IN ('LLAMADO','AVISO','EMERGENCIA','CLIENTE','PRUEBA')),
  -- A quien se llama. Texto libre y no FK a usuarios: a veces se llama a un
  -- puesto ("el lavador") y no a una persona registrada.
  destinatario    TEXT,
  usuario_id      BIGINT,
  usuario_nombre  TEXT,
  -- Repeticiones: un llamado en un taller con ruido rara vez se oye a la
  -- primera. El receptor lo repite este numero de veces con pausa.
  repeticiones    INT         NOT NULL DEFAULT 2 CHECK (repeticiones BETWEEN 1 AND 5),
  prioridad       INT         NOT NULL DEFAULT 5,      -- menor = antes
  estado          TEXT        NOT NULL DEFAULT 'PENDIENTE'
                    CHECK (estado IN ('PENDIENTE','REPRODUCIDO','CANCELADO','EXPIRADO')),
  reproducido_at  TIMESTAMPTZ,
  reproducido_por TEXT,                                -- identificador del receptor
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alt_estado ON altavoz_anuncios(estado, prioridad, created_at);
CREATE INDEX IF NOT EXISTS idx_alt_fecha  ON altavoz_anuncios(created_at DESC);


-- ══════════════════════════════════════════════════════════════════════════
-- 5. PLANTILLAS DE ANUNCIO
--
-- Para que llamar a un tecnico sea un clic y no teclear la frase cada vez.
-- {destinatario} se sustituye al enviar.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS altavoz_plantillas (
  id         BIGSERIAL PRIMARY KEY,
  codigo     VARCHAR(20) NOT NULL UNIQUE,
  etiqueta   TEXT        NOT NULL,
  texto      TEXT        NOT NULL,
  tipo       TEXT        NOT NULL DEFAULT 'LLAMADO',
  icono      TEXT,
  orden      INT         NOT NULL DEFAULT 100,
  activo     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO altavoz_plantillas (codigo, etiqueta, texto, tipo, icono, orden) VALUES
  ('PL-01','Llamar a recepción','{destinatario}, favor presentarse en recepción.','LLAMADO','📢',10),
  ('PL-02','Cliente esperando','{destinatario}, tiene un cliente esperando en el mostrador.','CLIENTE','👤',20),
  ('PL-03','Vehículo listo','{destinatario}, el vehículo está listo para control de calidad.','LLAMADO','✅',30),
  ('PL-04','Repuesto disponible','{destinatario}, su repuesto llegó al almacén.','AVISO','📦',40),
  ('PL-05','Mover vehículo','Favor del dueño del vehículo en el patio, mover su vehículo.','AVISO','🚗',50),
  ('PL-06','Reunión','Atención a todo el personal: reunión en el área de espera.','AVISO','📣',60),
  ('PL-07','Emergencia','Atención: evacuar el taller de inmediato por la salida más cercana.','EMERGENCIA','🚨',70),
  ('PL-08','Fin de jornada','Atención al personal: fin de la jornada, favor asegurar su área.','AVISO','🕕',80)
ON CONFLICT (codigo) DO UPDATE SET
  etiqueta = EXCLUDED.etiqueta,
  texto    = EXCLUDED.texto,
  tipo     = EXCLUDED.tipo,
  icono    = EXCLUDED.icono,
  orden    = EXCLUDED.orden;


-- ══════════════════════════════════════════════════════════════════════════
-- 6. ESTADO DE LA ALARMA
--
-- Va en `config_sistema` (clave/valor) y no en tabla propia: es una sola fila
-- que siempre existe. El historial de quien la armo vive en seguridad_eventos.
-- ══════════════════════════════════════════════════════════════════════════

INSERT INTO config_sistema (clave, valor)
VALUES ('seguridad_alarma', '{"armada": false, "modo": "DESARMADA", "por": null, "desde": null}'::jsonb)
ON CONFLICT (clave) DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════
-- VERIFICACION
-- ══════════════════════════════════════════════════════════════════════════
-- SELECT estado, COUNT(*) FROM seguridad_camaras GROUP BY estado;   -- 8 PLANIFICADA
-- SELECT COUNT(*) FROM seguridad_zonas;                             -- 6
-- SELECT COUNT(*) FROM altavoz_plantillas;                          -- 8
-- SELECT valor FROM config_sistema WHERE clave = 'seguridad_alarma';
--
-- Anuncios que quedaron sin locutar (nadie tenia el receptor abierto):
-- SELECT * FROM altavoz_anuncios WHERE estado = 'PENDIENTE' ORDER BY created_at;
