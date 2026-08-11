-- ══════════════════════════════════════════════════════════════════════════
-- MIGRACION V30 - CATALOGO DE HALLAZGOS DE DIAGNOSTICO
--
-- Objetivo: que el tecnico NO escriba. Selecciona hallazgos de una lista y el
-- sistema arma el diagnostico, sugiere las operaciones del tarifario y deja
-- el dato estructurado para analitica.
--
-- Hoy el checklist vive hardcodeado en:
--   frontend/src/app/taller/diagnostico/[id]/page.tsx  (lineas ~705-779)
-- y su seleccion se concatena como texto al campo `descripcion` y se descarta.
-- Esta migracion lo mueve a base de datos y lo enlaza con `mano_obra_catalogo`
-- (migracion v28).
--
-- Tablas que crea:
--   catalogo_hallazgo_grupos   -> los 6 grupos con su color e icono
--   catalogo_hallazgos         -> los 49 hallazgos seleccionables
--   hallazgo_operaciones       -> puente hallazgo -> operacion del tarifario
--   hallazgo_reglas            -> correlaciones deterministas (causa probable)
--   diagnostico_hallazgos      -> lo que el tecnico selecciono en cada orden
--
-- Idempotente: se puede correr varias veces. Los ON CONFLICT actualizan por
-- codigo sin duplicar renglones.
--
-- Requiere: migracion_v28_tarifario_mano_obra.sql corrida antes (para el
-- mapeo hallazgo -> operacion). Si no lo esta, el mapeo se salta sin fallar.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 1. GRUPOS
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS catalogo_hallazgo_grupos (
  clave      VARCHAR(8)  PRIMARY KEY,
  nombre     TEXT        NOT NULL,
  icono      TEXT,
  color      VARCHAR(9),                       -- hex, igual al de la UI actual
  orden      INT         NOT NULL DEFAULT 100,
  activo     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO catalogo_hallazgo_grupos (clave, nombre, icono, color, orden) VALUES
  ('MOT', 'Motor y Mecánica',     '🔧', '#f97316', 10),
  ('ELE', 'Sistema Eléctrico',    '⚡', '#f59e0b', 20),
  ('FRE', 'Frenos y Suspensión',  '🛑', '#ef4444', 30),
  ('TRA', 'Transmisión y Tren',   '⚙️', '#8b5cf6', 40),
  ('CLI', 'A/C y Confort',        '❄️', '#3b82f6', 50),
  ('MAN', 'Mantenimiento',        '🔍', '#10b981', 60)
ON CONFLICT (clave) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  icono  = EXCLUDED.icono,
  color  = EXCLUDED.color,
  orden  = EXCLUDED.orden;


-- ══════════════════════════════════════════════════════════════════════════
-- 2. CATALOGO DE HALLAZGOS
--
-- severidad     : baja | media | alta | critica  -> ordena la cotizacion y
--                 alimenta el campo "urgencia" del diagnostico generado.
-- requiere_medicion : si no es NULL, la UI pide un numero (mm de balata,
--                 voltaje, temperatura). Sin esto no hay como justificarle
--                 al cliente por que se cambia una pieza.
-- implicaciones : que pasa si NO se atiende. Es el texto que la IA usa para
--                 redactar la consecuencia al cliente. No se inventa.
-- pregunta_guia : lo que el tecnico debe verificar antes de marcar el chip.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS catalogo_hallazgos (
  id                BIGSERIAL PRIMARY KEY,
  codigo            VARCHAR(20) NOT NULL UNIQUE,
  grupo             VARCHAR(8)  NOT NULL REFERENCES catalogo_hallazgo_grupos(clave),
  nombre            TEXT        NOT NULL,
  severidad         TEXT        NOT NULL DEFAULT 'media'
                      CHECK (severidad IN ('baja','media','alta','critica')),
  requiere_medicion JSONB,
  implicaciones     TEXT,
  pregunta_guia     TEXT,
  orden             INT         NOT NULL DEFAULT 100,
  activo            BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hall_grupo     ON catalogo_hallazgos(grupo);
CREATE INDEX IF NOT EXISTS idx_hall_activo    ON catalogo_hallazgos(activo);
CREATE INDEX IF NOT EXISTS idx_hall_severidad ON catalogo_hallazgos(severidad);

INSERT INTO catalogo_hallazgos
  (codigo, grupo, nombre, severidad, requiere_medicion, implicaciones, pregunta_guia, orden)
VALUES

-- ── MOTOR Y MECANICA ────────────────────────────────────────────────────────
('MOT-001','MOT','Motor con falla / no enciende','critica', NULL,
 'El vehículo queda inmovilizado. Riesgo de daño mayor si se insiste en arrancar.',
 'Confirmar si gira y no prende, o si ni siquiera gira.', 10),

('MOT-002','MOT','Ruido en motor (válvulas, cadena, etc.)','alta', NULL,
 'Un ruido de cadena o válvulas ignorado termina en salto de tiempo y daño interno del motor.',
 'Identificar si el ruido sube con las RPM y en qué zona se escucha.', 20),

('MOT-003','MOT','Pérdida de potencia','media', NULL,
 'Aumenta el consumo de combustible y puede indicar falla de encendido que daña el catalizador.',
 'Verificar si hay códigos activos y si el ralentí es estable.', 30),

('MOT-004','MOT','Sobrecalentamiento','critica',
 '{"tipo":"°C","label":"Temperatura máxima alcanzada","min":60,"max":140,"umbral_critico":105}',
 'Es la causa número uno de empacadura de cabezote quemada y motor fundido. No se debe seguir conduciendo.',
 'Medir temperatura real con escáner, no solo por la aguja del tablero.', 40),

('MOT-005','MOT','Fuga de aceite','alta', NULL,
 'La pérdida progresiva de aceite lleva a falta de lubricación y daño de cojinetes.',
 'Ubicar el punto exacto de la fuga con el motor limpio.', 50),

('MOT-006','MOT','Fuga de refrigerante','alta', NULL,
 'Sin refrigerante el motor se sobrecalienta en minutos.',
 'Probar el sistema con bomba de presión para ubicar la fuga.', 60),

('MOT-007','MOT','Consumo excesivo de aceite','alta',
 '{"tipo":"L/1000km","label":"Litros consumidos por cada 1000 km","min":0,"max":5,"umbral_critico":1}',
 'Indica desgaste interno (anillos o guías). Si no se atiende, el motor pierde compresión.',
 'Confirmar que no sea fuga externa antes de marcar consumo interno.', 70),

('MOT-008','MOT','Humo excesivo (azul / negro / blanco)','alta', NULL,
 'El color del humo identifica el sistema afectado. Prolongarlo daña catalizador y sensores.',
 'Anotar el color y si aparece en frío, en aceleración o constante.', 80),

('MOT-009','MOT','Vibración excesiva en motor','media', NULL,
 'Soportes vencidos transmiten vibración a la carrocería y terminan rompiendo mangueras y arneses.',
 'Verificar si la vibración se siente en ralentí o solo bajo carga.', 90),

('MOT-010','MOT','Fallo en arranque / motor de arranque','alta', NULL,
 'El vehículo puede quedar varado en cualquier momento.',
 'Descartar batería y cables antes de condenar el motor de arranque.', 100),

-- ── SISTEMA ELECTRICO ───────────────────────────────────────────────────────
('ELE-001','ELE','Batería descargada / no carga','alta',
 '{"tipo":"V","label":"Voltaje en reposo","min":0,"max":16,"umbral_critico":12.2}',
 'Batería por debajo de 12.2 V en reposo deja el vehículo varado y fuerza el alternador.',
 'Medir en reposo tras 30 min apagado, no recién apagado.', 10),

('ELE-002','ELE','Alternador defectuoso','alta',
 '{"tipo":"V","label":"Voltaje de carga con motor encendido","min":0,"max":16,"umbral_critico":13.5}',
 'Sin carga el vehículo se apaga en marcha. Sobrecarga daña la batería y módulos electrónicos.',
 'Medir con motor encendido y con luces prendidas.', 20),

('ELE-003','ELE','Fallo en sistema de luces','media', NULL,
 'Riesgo de accidente nocturno y de multa.',
 'Verificar si es bombillo, fusible o falla en el arnés.', 30),

('ELE-004','ELE','Corto circuito','critica', NULL,
 'Riesgo real de incendio del vehículo.',
 'Localizar el circuito afectado antes de reponer fusibles.', 40),

('ELE-005','ELE','Luz check engine encendida','media', NULL,
 'Con la luz encendida el vehículo no pasa revisión y puede estar dañando el catalizador.',
 'Leer y anotar los códigos antes de borrarlos.', 50),

('ELE-006','ELE','Fallo en sensor (ABS, oxígeno, MAF, etc.)','media', NULL,
 'Un sensor fuera de rango hace que la computadora calcule mal la mezcla y suba el consumo.',
 'Confirmar con datos en vivo, no solo con el código almacenado.', 60),

('ELE-007','ELE','Sistema de arranque sin respuesta','alta', NULL,
 'El vehículo no enciende. Puede dejar al cliente varado.',
 'Verificar switch, relé y señal de arranque antes de desmontar.', 70),

('ELE-008','ELE','Fusible quemado','media', NULL,
 'Un fusible que se quema repetidamente indica un corto que hay que ubicar.',
 'Anotar si es la primera vez o si ya se le habían puesto fusibles.', 80),

('ELE-009','ELE','Problema en sistema de audio / pantalla','baja', NULL,
 'No afecta la operación del vehículo pero sí la experiencia del cliente.',
 'Confirmar si es el equipo, la alimentación o las bocinas.', 90),

('ELE-010','ELE','A/C no enfría (falla eléctrica)','media', NULL,
 'Sin ventilación se empañan los cristales y se reduce la visibilidad.',
 'Verificar si el compresor recibe señal antes de tocar el gas.', 100),

-- ── FRENOS Y SUSPENSION ─────────────────────────────────────────────────────
('FRE-001','FRE','Frenos fallan / pedal blando','critica', NULL,
 'Riesgo directo de accidente. El vehículo no debe entregarse en esta condición.',
 'Verificar nivel de líquido y presencia de aire en el sistema.', 10),

('FRE-002','FRE','Ruido en frenos (chirrido / golpe)','alta',
 '{"tipo":"mm","label":"Espesor de balata restante","min":0,"max":15,"umbral_critico":3}',
 'Por debajo de 3 mm la balata expone el metal y raya el disco, encareciendo la reparación.',
 'Medir el espesor real de la balata más desgastada.', 20),

('FRE-003','FRE','Fuga de líquido de frenos','critica', NULL,
 'Pérdida total de frenado sin aviso. Riesgo de accidente grave.',
 'Ubicar la fuga: caliper, manguera, bomba o línea.', 30),

('FRE-004','FRE','Vibración al frenar','alta',
 '{"tipo":"mm","label":"Espesor de disco","min":0,"max":40}',
 'Disco alabeado alarga la distancia de frenado y desgasta las balatas de forma despareja.',
 'Confirmar si la vibración se siente en el volante o en el pedal.', 40),

('FRE-005','FRE','Ruido en suspensión (amortiguadores)','media', NULL,
 'Amortiguadores vencidos alargan la distancia de frenado y desgastan las gomas.',
 'Verificar si hay fuga de aceite en el amortiguador.', 50),

('FRE-006','FRE','Jaloneos en dirección','alta', NULL,
 'Pérdida de control del vehículo, especialmente al frenar.',
 'Descartar presión de gomas antes de condenar la dirección.', 60),

('FRE-007','FRE','Volante desviado / no alinea','media', NULL,
 'Desgasta las gomas de forma irregular y acorta su vida útil a la mitad.',
 'Revisar si hay holgura en terminales antes de alinear.', 70),

('FRE-008','FRE','Ruido en rodamientos / cubos','alta', NULL,
 'Un rodamiento que falla por completo puede trabar la rueda en marcha.',
 'Identificar de qué lado viene y si cambia al girar.', 80),

('FRE-009','FRE','Estabilizadores / bujes desgastados','media', NULL,
 'Produce ruidos y reduce la estabilidad en curvas.',
 'Verificar holgura con palanca en cada buje.', 90),

-- ── TRANSMISION Y TREN ──────────────────────────────────────────────────────
('TRA-001','TRA','Transmisión no engancha / resbala','critica', NULL,
 'Seguir conduciendo así destruye los discos internos y convierte una reparación menor en un cambio de caja.',
 'Verificar nivel y color del aceite de transmisión.', 10),

('TRA-002','TRA','Ruido en caja de cambios','alta', NULL,
 'Indica desgaste interno. Ignorarlo lleva a reparación mayor.',
 'Anotar en qué cambio y a qué velocidad se escucha.', 20),

('TRA-003','TRA','Fuga de aceite de transmisión','alta', NULL,
 'La caja trabajando con nivel bajo se quema.',
 'Ubicar si es retenedor, tapa o enfriador.', 30),

('TRA-004','TRA','Problemas en diferencial','alta', NULL,
 'Un diferencial dañado puede trabar el tren motriz en marcha.',
 'Verificar nivel de aceite y holgura de la corona.', 40),

('TRA-005','TRA','Fallo en clutch / embrague','alta', NULL,
 'El vehículo pierde tracción progresivamente hasta quedar inmovilizado.',
 'Confirmar si patina bajo carga o si el problema es el sistema hidráulico.', 50),

('TRA-006','TRA','Fallo en palier / semieje','alta', NULL,
 'Un palier que se parte deja el vehículo sin tracción de inmediato.',
 'Revisar si la goma protectora está rota y perdió grasa.', 60),

('TRA-007','TRA','Ruido en cardán / junta homocinética','media', NULL,
 'El ruido en giros indica junta desgastada que terminará por romperse.',
 'Confirmar si el ruido aparece al girar en círculo cerrado.', 70),

-- ── A/C Y CONFORT ───────────────────────────────────────────────────────────
('CLI-001','CLI','A/C no enfría (gas agotado)','media',
 '{"tipo":"°C","label":"Temperatura en la ventila central","min":-10,"max":40,"umbral_critico":12}',
 'Si el gas se agotó es porque hay una fuga. Recargar sin reparar es botar el dinero.',
 'Medir temperatura de salida antes y después de cargar.', 10),

('CLI-002','CLI','Compresor de A/C defectuoso','alta', NULL,
 'Un compresor que se traba puede romper la correa de accesorios y dejar el vehículo sin carga.',
 'Verificar si el clutch del compresor engancha.', 20),

('CLI-003','CLI','Fuga de refrigerante A/C','media', NULL,
 'El sistema pierde carga y el compresor trabaja sin lubricación.',
 'Ubicar la fuga con nitrógeno o luz UV antes de recargar.', 30),

('CLI-004','CLI','Calefacción no funciona','baja', NULL,
 'Impide desempañar los cristales, lo que reduce la visibilidad.',
 'Verificar si el problema es el radiador de calefacción o la compuerta.', 40),

('CLI-005','CLI','Olores internos','baja', NULL,
 'Indica humedad y hongos en el evaporador, lo que afecta la salud de los ocupantes.',
 'Confirmar si el olor aparece al encender el A/C.', 50),

-- ── MANTENIMIENTO ───────────────────────────────────────────────────────────
('MAN-001','MAN','Cambio de aceite y filtro','baja', NULL,
 'El aceite vencido pierde propiedades y acelera el desgaste interno del motor.',
 'Anotar el kilometraje actual y el del último cambio.', 10),

('MAN-002','MAN','Cambio de filtros (aire, combustible)','baja', NULL,
 'Un filtro saturado reduce potencia y aumenta el consumo.',
 'Inspeccionar visualmente antes de marcar.', 20),

('MAN-003','MAN','Revisión de bujías','baja', NULL,
 'Bujías gastadas causan fallo de encendido y dañan el catalizador.',
 'Anotar el estado del electrodo y el color de la punta.', 30),

('MAN-004','MAN','Alineación y balanceo','baja', NULL,
 'Sin alineación las gomas duran la mitad y el vehículo se desvía.',
 'Verificar el patrón de desgaste de las gomas.', 40),

('MAN-005','MAN','Revisión de líquidos y fluidos','baja', NULL,
 'Niveles bajos de cualquier fluido derivan en fallas mayores.',
 'Revisar los siete niveles del check estándar.', 50),

('MAN-006','MAN','Mantenimiento preventivo 5,000 km','baja', NULL,
 'Saltarse el intervalo anula la garantía del fabricante.',
 'Confirmar kilometraje contra el último servicio registrado.', 60),

('MAN-007','MAN','Mantenimiento preventivo 10,000 km','baja', NULL,
 'Saltarse el intervalo anula la garantía del fabricante.',
 'Confirmar kilometraje contra el último servicio registrado.', 70),

('MAN-008','MAN','Mantenimiento preventivo 20,000 km','baja', NULL,
 'Saltarse el intervalo anula la garantía del fabricante.',
 'Confirmar kilometraje contra el último servicio registrado.', 80)

ON CONFLICT (codigo) DO UPDATE SET
  grupo             = EXCLUDED.grupo,
  nombre            = EXCLUDED.nombre,
  severidad         = EXCLUDED.severidad,
  requiere_medicion = EXCLUDED.requiere_medicion,
  implicaciones     = EXCLUDED.implicaciones,
  pregunta_guia     = EXCLUDED.pregunta_guia,
  orden             = EXCLUDED.orden,
  updated_at        = NOW();


-- ══════════════════════════════════════════════════════════════════════════
-- 3. PUENTE HALLAZGO -> OPERACION DEL TARIFARIO
--
-- Esta es la tabla que hace que seleccionar un chip cotice solo.
-- relevancia = 'principal'   -> se precarga en el diagnostico
--              'alternativa' -> se ofrece al tecnico, no se suma solo
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS hallazgo_operaciones (
  hallazgo_codigo VARCHAR(20) NOT NULL REFERENCES catalogo_hallazgos(codigo) ON DELETE CASCADE,
  mo_codigo       VARCHAR(20) NOT NULL,
  relevancia      TEXT        NOT NULL DEFAULT 'principal'
                    CHECK (relevancia IN ('principal','alternativa')),
  PRIMARY KEY (hallazgo_codigo, mo_codigo)
);

CREATE INDEX IF NOT EXISTS idx_hall_op_mo ON hallazgo_operaciones(mo_codigo);

-- El WHERE EXISTS evita fallar si v28 aun no se ha corrido o si un codigo
-- del tarifario cambio de nombre. Se salta el renglon en vez de romper.
INSERT INTO hallazgo_operaciones (hallazgo_codigo, mo_codigo, relevancia)
SELECT v.h, v.m, v.r
FROM (VALUES
  -- Motor
  ('MOT-001','MO-D02','principal'), ('MOT-001','MO-D05','alternativa'),
  ('MOT-002','MO-D02','principal'), ('MOT-002','MO-M04','alternativa'),
  ('MOT-003','MO-D02','principal'), ('MOT-003','MO-M13','alternativa'),
  ('MOT-003','MO-M01','alternativa'),
  ('MOT-004','MO-D07','principal'), ('MOT-004','MO-M06','alternativa'),
  ('MOT-004','MO-M05','alternativa'),('MOT-004','MO-M07','alternativa'),
  ('MOT-004','MO-N04','alternativa'),
  ('MOT-005','MO-M10','principal'), ('MOT-005','MO-M08','alternativa'),
  ('MOT-006','MO-M05','principal'), ('MOT-006','MO-M07','alternativa'),
  ('MOT-006','MO-N04','alternativa'),
  ('MOT-007','MO-D05','principal'),
  ('MOT-008','MO-D05','principal'), ('MOT-008','MO-D07','alternativa'),
  ('MOT-009','MO-M09','principal'), ('MOT-009','MO-M01','alternativa'),
  ('MOT-009','MO-E08','alternativa'),
  ('MOT-010','MO-D04','principal'), ('MOT-010','MO-E02','alternativa'),
  -- Electrico
  ('ELE-001','MO-D04','principal'), ('ELE-001','MO-E03','alternativa'),
  ('ELE-002','MO-D04','principal'), ('ELE-002','MO-E01','alternativa'),
  ('ELE-003','MO-D03','principal'),
  ('ELE-004','MO-D03','principal'), ('ELE-004','MO-E07','alternativa'),
  ('ELE-005','MO-D01','principal'),
  ('ELE-006','MO-D01','principal'), ('ELE-006','MO-M11','alternativa'),
  ('ELE-006','MO-M12','alternativa'),
  ('ELE-007','MO-D04','principal'), ('ELE-007','MO-E02','alternativa'),
  ('ELE-008','MO-D03','principal'),
  ('ELE-009','MO-E10','principal'),
  ('ELE-010','MO-D03','principal'), ('ELE-010','MO-A05','alternativa'),
  -- Frenos y suspension
  ('FRE-001','MO-F07','principal'), ('FRE-001','MO-F05','alternativa'),
  ('FRE-002','MO-F01','principal'), ('FRE-002','MO-F02','alternativa'),
  ('FRE-002','MO-F03','alternativa'),
  ('FRE-003','MO-F07','principal'), ('FRE-003','MO-F05','alternativa'),
  ('FRE-003','MO-F06','alternativa'),
  ('FRE-004','MO-F03','principal'),
  ('FRE-005','MO-S05','principal'), ('FRE-005','MO-S06','alternativa'),
  ('FRE-006','MO-S02','principal'), ('FRE-006','MO-S03','alternativa'),
  ('FRE-006','MO-S13','alternativa'),
  ('FRE-007','MO-S13','principal'), ('FRE-007','MO-S02','alternativa'),
  ('FRE-008','MO-S11','principal'),
  ('FRE-009','MO-S08','principal'), ('FRE-009','MO-S07','alternativa'),
  -- Transmision
  ('TRA-001','MO-N05','principal'), ('TRA-001','MO-T01','alternativa'),
  ('TRA-002','MO-T02','principal'), ('TRA-002','MO-N05','alternativa'),
  ('TRA-003','MO-T02','principal'),
  ('TRA-004','MO-T02','alternativa'),
  ('TRA-005','MO-T01','principal'),
  ('TRA-006','MO-S12','principal'),
  ('TRA-007','MO-S12','principal'),
  -- A/C y confort
  ('CLI-001','MO-D06','principal'), ('CLI-001','MO-A01','alternativa'),
  ('CLI-002','MO-A02','principal'),
  ('CLI-003','MO-D06','principal'), ('CLI-003','MO-A03','alternativa'),
  ('CLI-003','MO-A01','alternativa'),
  ('CLI-004','MO-A05','principal'),
  ('CLI-005','MO-N03','principal'),
  -- Mantenimiento
  ('MAN-001','MO-N01','principal'),
  ('MAN-002','MO-N03','principal'), ('MAN-002','MO-C03','alternativa'),
  ('MAN-003','MO-M01','principal'),
  ('MAN-004','MO-S13','principal'),
  ('MAN-005','MO-N02','principal'),
  ('MAN-006','MO-N01','principal'), ('MAN-006','MO-N03','alternativa'),
  ('MAN-007','MO-N02','principal'), ('MAN-007','MO-N03','alternativa'),
  ('MAN-008','MO-N02','principal'), ('MAN-008','MO-N03','alternativa'),
  ('MAN-008','MO-S13','alternativa'),('MAN-008','MO-M01','alternativa')
) AS v(h, m, r)
WHERE EXISTS (SELECT 1 FROM catalogo_hallazgos  ch WHERE ch.codigo = v.h)
  AND EXISTS (SELECT 1 FROM mano_obra_catalogo  mo WHERE mo.codigo = v.m)
ON CONFLICT (hallazgo_codigo, mo_codigo) DO UPDATE SET
  relevancia = EXCLUDED.relevancia;


-- ══════════════════════════════════════════════════════════════════════════
-- 4. REGLAS DETERMINISTAS (causa probable sin IA)
--
-- Si TODOS los hallazgos de `condicion` estan seleccionados, se dispara la
-- regla. El backend calcula esto antes de llamar al modelo: la causa probable
-- sale de aqui, no del LLM. El LLM solo redacta.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS hallazgo_reglas (
  id             BIGSERIAL PRIMARY KEY,
  codigo         VARCHAR(20) NOT NULL UNIQUE,
  condicion      TEXT[]      NOT NULL,          -- codigos que deben coincidir todos
  causa_probable TEXT        NOT NULL,
  urgencia       TEXT        NOT NULL DEFAULT 'media'
                   CHECK (urgencia IN ('baja','media','alta','inmediata')),
  recomendacion  TEXT,
  activo         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO hallazgo_reglas (codigo, condicion, causa_probable, urgencia, recomendacion) VALUES
  ('RG-001', ARRAY['MOT-004','MOT-006'],
   'Pérdida de refrigerante que provoca sobrecalentamiento: revisar bomba de agua, termostato y radiador.',
   'inmediata', 'No entregar el vehículo hasta corregir. Verificar que no haya daño de empacadura.'),

  ('RG-002', ARRAY['MOT-004','MOT-008'],
   'Posible empacadura de cabezote comprometida: el sobrecalentamiento junto con humo blanco apunta a paso de refrigerante a la cámara.',
   'inmediata', 'Confirmar con prueba de gases al enfriamiento (block test) antes de cotizar.'),

  ('RG-003', ARRAY['ELE-001','ELE-002'],
   'El alternador no está cargando y por eso la batería se descarga: cambiar el alternador y probar la batería después.',
   'alta', 'Cambiar solo la batería no resuelve el problema; volverá a descargarse.'),

  ('RG-004', ARRAY['FRE-002','FRE-004'],
   'Balatas desgastadas que alabearon el disco: se requiere cambio de balatas y rectificado o cambio de discos.',
   'alta', 'Cambiar únicamente las balatas dejará la vibración presente.'),

  ('RG-005', ARRAY['FRE-001','FRE-003'],
   'Fuga en el sistema hidráulico de frenos: pedal blando por entrada de aire.',
   'inmediata', 'El vehículo no debe circular. Reparar la fuga y purgar el sistema.'),

  ('RG-006', ARRAY['FRE-006','FRE-007'],
   'Holgura en el tren delantero: terminales o rótulas vencidas afectando la dirección.',
   'alta', 'Corregir la holgura antes de alinear, de lo contrario la alineación no se sostiene.'),

  ('RG-007', ARRAY['TRA-001','TRA-003'],
   'La transmisión patina por nivel bajo de aceite causado por una fuga.',
   'inmediata', 'Reparar la fuga y reponer nivel antes de evaluar daño interno.'),

  ('RG-008', ARRAY['CLI-001','CLI-003'],
   'El gas se agotó por una fuga en el sistema: recargar sin reparar repetirá la falla.',
   'media', 'Localizar y reparar la fuga antes de la recarga.'),

  ('RG-009', ARRAY['MOT-003','ELE-005'],
   'Falla de encendido con código activo: revisar bujías, bobinas y sensores de mezcla.',
   'media', 'Prolongar la falla daña el catalizador y encarece la reparación.'),

  ('RG-010', ARRAY['MOT-001','ELE-007'],
   'El motor no arranca por falla en el circuito de arranque, no por falta de combustible o chispa.',
   'alta', 'Verificar batería, switch, relé y motor de arranque en ese orden.')

ON CONFLICT (codigo) DO UPDATE SET
  condicion      = EXCLUDED.condicion,
  causa_probable = EXCLUDED.causa_probable,
  urgencia       = EXCLUDED.urgencia,
  recomendacion  = EXCLUDED.recomendacion;


-- ══════════════════════════════════════════════════════════════════════════
-- 5. SELECCION DEL TECNICO (el dato que hoy se pierde)
--
-- `orden_id` va aparte de `diagnostico_id` porque el tecnico empieza a marcar
-- chips antes de que exista el registro de diagnostico. Se guarda contra la
-- orden y luego se enlaza.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS diagnostico_hallazgos (
  id              BIGSERIAL PRIMARY KEY,
  diagnostico_id  BIGINT,
  orden_id        BIGINT      NOT NULL,
  hallazgo_codigo VARCHAR(20) NOT NULL REFERENCES catalogo_hallazgos(codigo),
  valor_medido    NUMERIC(10,2),
  urgencia        TEXT CHECK (urgencia IN ('baja','media','alta','inmediata')),
  nota            TEXT,
  tecnico_nombre  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_diag_hall_orden
  ON diagnostico_hallazgos(orden_id, hallazgo_codigo);
CREATE INDEX IF NOT EXISTS idx_diag_hall_diag   ON diagnostico_hallazgos(diagnostico_id);
CREATE INDEX IF NOT EXISTS idx_diag_hall_codigo ON diagnostico_hallazgos(hallazgo_codigo);

-- FK opcional hacia `diagnosticos`. Se intenta y se ignora si el tipo de la
-- columna id no coincide o la tabla no esta accesible desde este esquema.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_diag_hall_diagnostico'
  ) THEN
    ALTER TABLE diagnostico_hallazgos
      ADD CONSTRAINT fk_diag_hall_diagnostico
      FOREIGN KEY (diagnostico_id) REFERENCES diagnosticos(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'FK a diagnosticos omitida: %', SQLERRM;
END $$;


-- ══════════════════════════════════════════════════════════════════════════
-- 6. VISTA DE APOYO
--
-- Un solo SELECT devuelve el hallazgo con sus operaciones y precios por
-- segmento. Es lo que consume GET /catalogo-hallazgos y el generador de
-- diagnostico.
-- ══════════════════════════════════════════════════════════════════════════

-- Se crea dentro de un DO para no romper el script si `mano_obra_catalogo`
-- todavia no existe (v28 sin correr). En ese caso se avisa y se sigue.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_name = 'mano_obra_catalogo') THEN
    RAISE NOTICE 'v_hallazgos_completo omitida: falta mano_obra_catalogo (correr migracion v28).';
    RETURN;
  END IF;

  EXECUTE $view$
CREATE OR REPLACE VIEW v_hallazgos_completo AS
SELECT
  h.codigo,
  h.grupo,
  g.nombre  AS grupo_nombre,
  g.icono   AS grupo_icono,
  g.color   AS grupo_color,
  g.orden   AS grupo_orden,
  h.nombre,
  h.severidad,
  h.requiere_medicion,
  h.implicaciones,
  h.pregunta_guia,
  h.orden,
  h.activo,
  COALESCE(
    (SELECT jsonb_agg(
        jsonb_build_object(
          'codigo',         mo.codigo,
          'nombre',         mo.nombre,
          'categoria',      mo.categoria,
          'horas_estandar', mo.horas_estandar,
          'relevancia',     ho.relevancia,
          'precio_seg_a',   mo.precio_seg_a,
          'precio_seg_b',   mo.precio_seg_b,
          'precio_seg_c',   mo.precio_seg_c,
          'precio_seg_d',   mo.precio_seg_d
        ) ORDER BY ho.relevancia, mo.codigo)
     FROM hallazgo_operaciones ho
     JOIN mano_obra_catalogo   mo ON mo.codigo = ho.mo_codigo AND mo.activo
     WHERE ho.hallazgo_codigo = h.codigo),
    '[]'::jsonb
  ) AS operaciones
FROM catalogo_hallazgos h
JOIN catalogo_hallazgo_grupos g ON g.clave = h.grupo
WHERE h.activo AND g.activo
  $view$;
END $$;


-- ══════════════════════════════════════════════════════════════════════════
-- VERIFICACION
-- ══════════════════════════════════════════════════════════════════════════
-- SELECT grupo, COUNT(*) FROM catalogo_hallazgos GROUP BY grupo ORDER BY 1;
--   -> CLI 5 | ELE 10 | FRE 9 | MAN 8 | MOT 10 | TRA 7   (49 en total)
--
-- SELECT COUNT(*) FROM hallazgo_operaciones;      -> 92
-- SELECT COUNT(*) FROM hallazgo_reglas;           -> 10
--
-- Hallazgos que quedaron sin ninguna operacion mapeada:
-- SELECT h.codigo, h.nombre FROM catalogo_hallazgos h
--   LEFT JOIN hallazgo_operaciones ho ON ho.hallazgo_codigo = h.codigo
--   WHERE ho.hallazgo_codigo IS NULL;
--
-- Prueba de la vista:
-- SELECT codigo, nombre, jsonb_array_length(operaciones) FROM v_hallazgos_completo;
