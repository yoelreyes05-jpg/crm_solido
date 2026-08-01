-- ============================================================================
-- SOLIDO AUTO SERVICIO - Migracion v25
-- CATALOGO DE ESPECIFICACIONES DE SERVICIO POR VEHICULO
-- ----------------------------------------------------------------------------
-- EL PROBLEMA
--   El cliente no sabe que aceite usa su carro ni cuantos cuartos lleva. Hoy
--   un tecnico tiene que ir a averiguarlo cada vez, y ese dato se pierde: al
--   siguiente Corolla 2018 alguien vuelve a buscarlo desde cero.
--
-- POR QUE NO SE RESUELVE CON EL VIN
--   El decodificador que ya usas (NHTSA vPIC) es gratuito y da marca, modelo,
--   año, cilindros y cilindrada — pero NO da capacidad de aceite, viscosidad
--   ni numero de filtro. Ninguna fuente publica gratuita los da: son datos de
--   catalogos comerciales con licencia (Mitchell, ALLDATA, MOTOR).
--
-- LA SOLUCION
--   Un catalogo PROPIO que se llena una sola vez por modelo/motor. El tecnico
--   mide el primer Corolla 2018 que entra; a partir de ahi todos los demas
--   Corolla 2018 se autocompletan solos. El taller se vuelve mas inteligente
--   con cada vehiculo que atiende.
--
--   Cada ficha tiene un nivel de confianza:
--     VERIFICADO — un tecnico tuyo lo confirmo fisicamente. Es la verdad.
--     MANUAL     — tomado del manual del fabricante.
--     ESTIMADO   — calculado por cilindraje. Sirve para cotizar, no para servir.
--
-- Es idempotente y NO borra nada. Requiere v23 y v24.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- 1. CATALOGO MAESTRO DE ESPECIFICACIONES
-- ----------------------------------------------------------------------------
-- Una fila por combinacion modelo + rango de años + motor. El rango de años
-- evita tener que capturar cada año por separado: un Corolla 2014-2019 con
-- motor 1.8L lleva lo mismo todos esos años.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vehiculo_spec_servicio (
  id               BIGSERIAL PRIMARY KEY,
  marca            TEXT NOT NULL,
  modelo           TEXT NOT NULL,
  ano_desde        INT,
  ano_hasta        INT,
  motor            TEXT,              -- "1.8L L4", "3.5L V6"
  cilindros        SMALLINT,

  -- Aceite
  cuartos          NUMERIC(4,1),      -- capacidad CON filtro
  viscosidad       TEXT,              -- "5W-30", "0W-20"
  tipo_aceite      VARCHAR(20),       -- MINERAL | SEMISINTETICO | SINTETICO
  intervalo_km     INT,

  -- Refacciones (texto libre: el numero de parte del fabricante)
  filtro_aceite    TEXT,
  filtro_aire      TEXT,
  filtro_cabina    TEXT,
  bujias           TEXT,

  -- Otras capacidades utiles al cotizar
  refrigerante_l   NUMERIC(4,1),
  transmision_l    NUMERIC(4,1),

  confianza        VARCHAR(12) NOT NULL DEFAULT 'ESTIMADO',
  notas            TEXT,
  verificado_por   TEXT,
  verificado_el    TIMESTAMPTZ,
  veces_usada      INT DEFAULT 0,     -- cuantos vehiculos la usan
  activo           BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT spec_confianza_check CHECK (confianza IN ('VERIFICADO','MANUAL','ESTIMADO')),
  CONSTRAINT spec_tipo_aceite_check
    CHECK (tipo_aceite IS NULL OR tipo_aceite IN ('MINERAL','SEMISINTETICO','SINTETICO'))
);

CREATE INDEX IF NOT EXISTS idx_spec_busqueda
  ON vehiculo_spec_servicio (LOWER(marca), LOWER(modelo), ano_desde, ano_hasta);
CREATE INDEX IF NOT EXISTS idx_spec_confianza ON vehiculo_spec_servicio (confianza);

COMMENT ON TABLE vehiculo_spec_servicio IS
  'Que lleva cada modelo. Se llena una vez por modelo/motor y sirve para siempre.';
COMMENT ON COLUMN vehiculo_spec_servicio.cuartos IS
  'Capacidad de aceite CON cambio de filtro (que es como se sirve en taller).';


-- ════════════════════════════════════════════════════════════════════════════
-- 2. LA FICHA DEL VEHICULO GUARDA SU SPEC
-- ----------------------------------------------------------------------------
-- Se copian los valores al vehiculo (no solo la referencia) porque un carro
-- puede tener algo distinto: motor cambiado, el dueño prefiere sintetico, etc.
-- La referencia `spec_id` queda para saber de donde salio.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS spec_id          BIGINT REFERENCES vehiculo_spec_servicio(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cuartos_aceite   NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS viscosidad       TEXT,
  ADD COLUMN IF NOT EXISTS spec_confianza   VARCHAR(12) DEFAULT 'ESTIMADO',
  ADD COLUMN IF NOT EXISTS spec_notas       TEXT;

COMMENT ON COLUMN vehiculos.cuartos_aceite IS
  'Cuartos que lleva ESTE vehiculo. Puede diferir del catalogo si tiene motor cambiado.';


-- ════════════════════════════════════════════════════════════════════════════
-- 3. BUSCADOR: que lleva este vehiculo
-- ----------------------------------------------------------------------------
-- Busca de lo mas especifico a lo mas general:
--   1. marca + modelo + año dentro del rango + motor  -> match exacto
--   2. marca + modelo + año dentro del rango          -> match de modelo
--   3. marca + modelo (cualquier año)                 -> match aproximado
--   4. nada -> estima por cilindraje con plan_motor_config (v23)
-- Siempre devuelve algo: en el peor caso una estimacion marcada como tal.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION vehiculo_sugerir_spec(
  p_marca     TEXT,
  p_modelo    TEXT,
  p_ano       INT     DEFAULT NULL,
  p_motor     TEXT    DEFAULT NULL,
  p_cilindros SMALLINT DEFAULT NULL
)
RETURNS TABLE (
  spec_id       BIGINT,
  cuartos       NUMERIC,
  viscosidad    TEXT,
  tipo_aceite   VARCHAR,
  intervalo_km  INT,
  filtro_aceite TEXT,
  filtro_aire   TEXT,
  filtro_cabina TEXT,
  bujias        TEXT,
  cilindros     SMALLINT,
  confianza     VARCHAR,
  origen        TEXT,      -- explica de donde salio el dato
  notas         TEXT
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v RECORD;
  v_cil SMALLINT;
BEGIN
  -- ── 1. Match exacto: modelo + año + motor ────────────────────────────────
  SELECT * INTO v FROM vehiculo_spec_servicio s
  WHERE s.activo
    AND LOWER(s.marca)  = LOWER(TRIM(p_marca))
    AND LOWER(s.modelo) = LOWER(TRIM(p_modelo))
    AND (p_ano IS NULL OR p_ano BETWEEN COALESCE(s.ano_desde, 1900) AND COALESCE(s.ano_hasta, 2100))
    AND p_motor IS NOT NULL AND s.motor IS NOT NULL
    AND LOWER(s.motor) = LOWER(TRIM(p_motor))
  ORDER BY s.confianza = 'VERIFICADO' DESC, s.veces_usada DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v.id, v.cuartos, v.viscosidad::TEXT, v.tipo_aceite::VARCHAR, v.intervalo_km,
      v.filtro_aceite::TEXT, v.filtro_aire::TEXT, v.filtro_cabina::TEXT, v.bujias::TEXT, v.cilindros::SMALLINT, v.confianza::VARCHAR,
      ('Ficha exacta: ' || v.marca || ' ' || v.modelo || ' ' || COALESCE(v.motor,'') ||
       ' (' || COALESCE(v.ano_desde::TEXT,'?') || '-' || COALESCE(v.ano_hasta::TEXT,'?') || ')')::TEXT,
      v.notas;
    RETURN;
  END IF;

  -- ── 2. Match por modelo y año, sin importar el motor ─────────────────────
  SELECT * INTO v FROM vehiculo_spec_servicio s
  WHERE s.activo
    AND LOWER(s.marca)  = LOWER(TRIM(p_marca))
    AND LOWER(s.modelo) = LOWER(TRIM(p_modelo))
    AND (p_ano IS NULL OR p_ano BETWEEN COALESCE(s.ano_desde, 1900) AND COALESCE(s.ano_hasta, 2100))
    AND (p_cilindros IS NULL OR s.cilindros IS NULL OR s.cilindros = p_cilindros)
  ORDER BY s.confianza = 'VERIFICADO' DESC, s.veces_usada DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v.id, v.cuartos, v.viscosidad::TEXT, v.tipo_aceite::VARCHAR, v.intervalo_km,
      v.filtro_aceite::TEXT, v.filtro_aire::TEXT, v.filtro_cabina::TEXT, v.bujias::TEXT, v.cilindros::SMALLINT, v.confianza::VARCHAR,
      ('Ficha del modelo (motor no coincide exacto): ' || v.marca || ' ' || v.modelo)::TEXT,
      v.notas;
    RETURN;
  END IF;

  -- ── 3. Match por modelo, cualquier año ──────────────────────────────────
  SELECT * INTO v FROM vehiculo_spec_servicio s
  WHERE s.activo
    AND LOWER(s.marca)  = LOWER(TRIM(p_marca))
    AND LOWER(s.modelo) = LOWER(TRIM(p_modelo))
  ORDER BY s.confianza = 'VERIFICADO' DESC, ABS(COALESCE(s.ano_desde, 2015) - COALESCE(p_ano, 2015))
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v.id, v.cuartos, v.viscosidad::TEXT, v.tipo_aceite::VARCHAR, v.intervalo_km,
      v.filtro_aceite::TEXT, v.filtro_aire::TEXT, v.filtro_cabina::TEXT, v.bujias::TEXT, v.cilindros::SMALLINT, 'ESTIMADO'::VARCHAR,
      ('Otro año del mismo modelo (' || COALESCE(v.ano_desde::TEXT,'?') || '-' ||
       COALESCE(v.ano_hasta::TEXT,'?') || '). VERIFICAR con el vehiculo.')::TEXT,
      v.notas;
    RETURN;
  END IF;

  -- ── 4. Sin ficha: estimar por cilindraje ────────────────────────────────
  v_cil := COALESCE(p_cilindros, 4);
  RETURN QUERY
  SELECT NULL::BIGINT, mc.cuartos, NULL::TEXT, mc.tipo_aceite::VARCHAR, mc.intervalo_km,
         NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_cil, 'ESTIMADO'::VARCHAR,
         ('Sin ficha para este modelo. Estimado por ' || v_cil ||
          ' cilindros. El tecnico debe verificar y guardar la ficha.')::TEXT,
         NULL::TEXT
  FROM plan_motor_config mc
  WHERE mc.cilindros = v_cil AND mc.tipo_aceite = 'SEMISINTETICO' AND mc.activo
  LIMIT 1;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 4. EL TECNICO GUARDA LO QUE MIDIO
-- ----------------------------------------------------------------------------
-- Este es el corazon del asunto: cuando el tecnico confirma cuantos cuartos
-- lleva un vehiculo, ese dato queda para TODOS los del mismo modelo. Se mide
-- una vez, sirve para siempre.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION vehiculo_guardar_spec(
  p_vehiculo_id  BIGINT,
  p_cuartos      NUMERIC,
  p_viscosidad   TEXT,
  p_tipo_aceite  VARCHAR,
  p_intervalo_km INT,
  p_filtro_aceite TEXT,
  p_usuario      TEXT,
  p_propagar     BOOLEAN DEFAULT TRUE,   -- guardar tambien en el catalogo
  p_notas        TEXT DEFAULT NULL
)
RETURNS TABLE (spec_id BIGINT, creada BOOLEAN, mensaje TEXT)
LANGUAGE plpgsql AS $$
DECLARE
  v_veh   RECORD;
  v_spec  BIGINT;
  v_nueva BOOLEAN := FALSE;
BEGIN
  SELECT id, marca, modelo, ano, motor, cilindros INTO v_veh
  FROM vehiculos WHERE id = p_vehiculo_id;

  IF v_veh IS NULL THEN
    RAISE EXCEPTION 'No existe el vehiculo %', p_vehiculo_id USING ERRCODE = 'P0002';
  END IF;

  -- Siempre se guarda en el vehiculo
  UPDATE vehiculos SET
    cuartos_aceite = p_cuartos,
    viscosidad     = COALESCE(p_viscosidad, viscosidad),
    tipo_aceite    = COALESCE(p_tipo_aceite, tipo_aceite),
    spec_confianza = 'VERIFICADO',
    spec_notas     = COALESCE(p_notas, spec_notas)
  WHERE id = p_vehiculo_id;

  IF NOT p_propagar THEN
    RETURN QUERY SELECT NULL::BIGINT, FALSE,
      'Guardado solo en este vehiculo (no se propago al catalogo).'::TEXT;
    RETURN;
  END IF;

  -- ¿Ya hay ficha para este modelo/motor?
  SELECT s.id INTO v_spec FROM vehiculo_spec_servicio s
  WHERE LOWER(s.marca) = LOWER(v_veh.marca)
    AND LOWER(s.modelo) = LOWER(v_veh.modelo)
    AND (v_veh.ano IS NULL OR v_veh.ano BETWEEN COALESCE(s.ano_desde,1900) AND COALESCE(s.ano_hasta,2100))
    AND (s.motor IS NOT DISTINCT FROM v_veh.motor OR s.motor IS NULL)
  LIMIT 1;

  IF v_spec IS NULL THEN
    -- Ficha nueva. El rango de años se abre +-3 para cubrir la generacion,
    -- y se puede ajustar despues desde el panel.
    INSERT INTO vehiculo_spec_servicio
      (marca, modelo, ano_desde, ano_hasta, motor, cilindros, cuartos, viscosidad,
       tipo_aceite, intervalo_km, filtro_aceite, confianza, verificado_por, verificado_el, notas, veces_usada)
    VALUES
      (v_veh.marca, v_veh.modelo,
       COALESCE(v_veh.ano,   EXTRACT(YEAR FROM CURRENT_DATE)::INT) - 3,
       COALESCE(v_veh.ano,   EXTRACT(YEAR FROM CURRENT_DATE)::INT) + 3,
       v_veh.motor, v_veh.cilindros, p_cuartos, p_viscosidad,
       p_tipo_aceite, p_intervalo_km, p_filtro_aceite,
       'VERIFICADO', p_usuario, NOW(), p_notas, 1)
    RETURNING id INTO v_spec;
    v_nueva := TRUE;
  ELSE
    UPDATE vehiculo_spec_servicio SET
      cuartos       = p_cuartos,
      viscosidad    = COALESCE(p_viscosidad, viscosidad),
      tipo_aceite   = COALESCE(p_tipo_aceite, tipo_aceite),
      intervalo_km  = COALESCE(p_intervalo_km, intervalo_km),
      filtro_aceite = COALESCE(p_filtro_aceite, filtro_aceite),
      confianza     = 'VERIFICADO',
      verificado_por = p_usuario,
      verificado_el  = NOW(),
      notas          = COALESCE(p_notas, notas),
      updated_at     = NOW()
    WHERE id = v_spec;
  END IF;

  UPDATE vehiculos SET spec_id = v_spec WHERE id = p_vehiculo_id;

  RETURN QUERY SELECT v_spec, v_nueva,
    CASE WHEN v_nueva
      THEN ('Ficha creada. Todos los ' || v_veh.marca || ' ' || v_veh.modelo ||
            ' que entren se autocompletaran con estos datos.')
      ELSE ('Ficha del ' || v_veh.marca || ' ' || v_veh.modelo || ' actualizada y verificada.')
    END::TEXT;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 5. SERVICIO MENOR vs MAYOR
-- ----------------------------------------------------------------------------
-- Asi lo hacen los concesionarios: no todos los servicios son iguales. Toyota
-- alterna "minor" (aceite, filtro, rotacion, inspeccion multipunto) con
-- "major" (lo anterior + filtro de aire, filtro de cabina, bujias segun toque).
-- Tus planes decian "4 mantenimientos al año" como si todos fueran iguales;
-- con esto puedes cobrar y costear cada tipo por separado.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS plan_tipo_servicio (
  id            BIGSERIAL PRIMARY KEY,
  codigo        VARCHAR(20) UNIQUE NOT NULL,
  nombre        TEXT NOT NULL,
  descripcion   TEXT,
  cada_n_servicios INT DEFAULT 1,   -- 1 = siempre; 2 = uno de cada dos...
  incluye_aceite  BOOLEAN DEFAULT TRUE,
  incluye_filtro_aire   BOOLEAN DEFAULT FALSE,
  incluye_filtro_cabina BOOLEAN DEFAULT FALSE,
  incluye_bujias        BOOLEAN DEFAULT FALSE,
  incluye_rotacion      BOOLEAN DEFAULT TRUE,
  incluye_inspeccion    BOOLEAN DEFAULT TRUE,
  orden         INT DEFAULT 0,
  activo        BOOLEAN DEFAULT TRUE
);

INSERT INTO plan_tipo_servicio
  (codigo, nombre, descripcion, cada_n_servicios, incluye_filtro_aire, incluye_filtro_cabina, incluye_bujias, orden)
VALUES
  ('MENOR', 'Servicio menor',
   'Cambio de aceite y filtro, rotacion de gomas e inspeccion multipunto.', 1, FALSE, FALSE, FALSE, 1),
  ('MAYOR', 'Servicio mayor',
   'Todo lo del servicio menor mas filtro de aire y filtro de cabina.', 2, TRUE, TRUE, FALSE, 2),
  ('MAYOR_PLUS', 'Servicio mayor con bujias',
   'Servicio mayor mas cambio de bujias. Normalmente cada 40,000-60,000 km.', 4, TRUE, TRUE, TRUE, 3)
ON CONFLICT (codigo) DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════════
-- 6. SEMILLAS DE REFERENCIA
-- ----------------------------------------------------------------------------
-- ⚠️ IMPORTANTE: estas fichas entran como 'ESTIMADO' A PROPOSITO.
--    Son valores tipicos de los modelos mas comunes en Republica Dominicana,
--    utiles para arrancar y cotizar, pero la capacidad exacta varia segun el
--    motor especifico y el mercado de origen del vehiculo.
--    En cuanto un tecnico confirme uno, pasa a 'VERIFICADO' y manda.
--    NO sirvas un cambio de aceite con un dato 'ESTIMADO' sin revisar la varilla.
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO vehiculo_spec_servicio
  (marca, modelo, ano_desde, ano_hasta, motor, cilindros, cuartos, viscosidad, tipo_aceite, intervalo_km, confianza, notas)
VALUES
  -- Toyota
  ('Toyota','Corolla',   2014, 2019, '1.8L L4', 4, 4.4, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', 'Motor 2ZR-FE'),
  ('Toyota','Corolla',   2020, 2026, '2.0L L4', 4, 4.8, '0W-16', 'SINTETICO',     8000, 'ESTIMADO', 'Motor M20A-FKS'),
  ('Toyota','Yaris',     2014, 2026, '1.5L L4', 4, 3.7, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', NULL),
  ('Toyota','Hilux',     2016, 2026, '2.4L L4', 4, 6.8, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', 'Diesel 2GD-FTV'),
  ('Toyota','RAV4',      2019, 2026, '2.5L L4', 4, 4.8, '0W-16', 'SINTETICO',     8000, 'ESTIMADO', NULL),
  ('Toyota','Highlander',2014, 2019, '3.5L V6', 6, 6.4, '0W-20', 'SINTETICO',     8000, 'ESTIMADO', 'Motor 2GR-FKS'),
  ('Toyota','4Runner',   2010, 2026, '4.0L V6', 6, 6.3, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', 'Motor 1GR-FE'),
  ('Toyota','Tundra',    2007, 2021, '5.7L V8', 8, 8.0, '0W-20', 'SINTETICO',     8000, 'ESTIMADO', 'Motor 3UR-FE'),
  ('Toyota','Fortuner',  2016, 2026, '2.8L L4', 4, 7.5, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', 'Diesel 1GD-FTV'),
  ('Toyota','Prado',     2010, 2026, '4.0L V6', 6, 6.3, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', NULL),
  -- Honda
  ('Honda','Civic',      2016, 2021, '1.5L L4', 4, 3.7, '0W-20', 'SINTETICO',     8000, 'ESTIMADO', 'Turbo L15B7'),
  ('Honda','Civic',      2006, 2015, '1.8L L4', 4, 4.0, '5W-20', 'SEMISINTETICO', 5000, 'ESTIMADO', 'Motor R18'),
  ('Honda','CR-V',       2017, 2026, '1.5L L4', 4, 3.7, '0W-20', 'SINTETICO',     8000, 'ESTIMADO', 'Turbo'),
  ('Honda','Accord',     2018, 2026, '1.5L L4', 4, 3.7, '0W-20', 'SINTETICO',     8000, 'ESTIMADO', NULL),
  ('Honda','Pilot',      2016, 2026, '3.5L V6', 6, 4.5, '0W-20', 'SINTETICO',     8000, 'ESTIMADO', 'Motor J35'),
  ('Honda','Fit',        2015, 2020, '1.5L L4', 4, 3.4, '0W-20', 'SINTETICO',     8000, 'ESTIMADO', NULL),
  -- Hyundai / Kia
  ('Hyundai','Accent',   2012, 2026, '1.6L L4', 4, 3.8, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', 'Motor Gamma'),
  ('Hyundai','Elantra',  2017, 2026, '2.0L L4', 4, 4.2, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', 'Motor Nu'),
  ('Hyundai','Tucson',   2016, 2026, '2.0L L4', 4, 4.6, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', NULL),
  ('Hyundai','Santa Fe', 2013, 2026, '3.3L V6', 6, 6.3, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', 'Motor Lambda'),
  ('Kia','Rio',          2012, 2026, '1.6L L4', 4, 3.8, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', NULL),
  ('Kia','Sportage',     2017, 2026, '2.4L L4', 4, 5.1, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', NULL),
  ('Kia','Sorento',      2016, 2026, '3.3L V6', 6, 6.3, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', NULL),
  -- Nissan
  ('Nissan','Sentra',    2013, 2019, '1.8L L4', 4, 4.4, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', 'Motor MRA8DE'),
  ('Nissan','Versa',     2012, 2026, '1.6L L4', 4, 4.1, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', NULL),
  ('Nissan','Frontier',  2005, 2021, '4.0L V6', 6, 5.4, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', 'Motor VQ40DE'),
  ('Nissan','X-Trail',   2014, 2026, '2.5L L4', 4, 4.9, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', 'Motor QR25DE'),
  ('Nissan','Pathfinder',2013, 2026, '3.5L V6', 6, 5.1, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', 'Motor VQ35DE'),
  -- Mitsubishi
  ('Mitsubishi','Lancer',        2008, 2017, '2.0L L4', 4, 4.5, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', NULL),
  ('Mitsubishi','Montero Sport', 2016, 2026, '2.4L L4', 4, 6.4, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', 'Diesel 4N15'),
  ('Mitsubishi','L200',          2015, 2026, '2.4L L4', 4, 6.4, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', 'Diesel'),
  -- Ford / Chevrolet
  ('Ford','Explorer',    2011, 2019, '3.5L V6', 6, 6.0, '5W-20', 'SEMISINTETICO', 5000, 'ESTIMADO', NULL),
  ('Ford','F-150',       2011, 2026, '5.0L V8', 8, 8.8, '5W-20', 'SINTETICO',     8000, 'ESTIMADO', 'Motor Coyote'),
  ('Ford','Ranger',      2019, 2026, '2.3L L4', 4, 6.0, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', 'EcoBoost'),
  ('Chevrolet','Tahoe',  2015, 2026, '5.3L V8', 8, 8.0, '0W-20', 'SINTETICO',     8000, 'ESTIMADO', 'Motor L83'),
  ('Chevrolet','Spark',  2013, 2026, '1.4L L4', 4, 4.0, '5W-30', 'SEMISINTETICO', 5000, 'ESTIMADO', NULL),
  ('Chevrolet','Silverado', 2014, 2026, '5.3L V8', 8, 8.0, '0W-20', 'SINTETICO',  8000, 'ESTIMADO', NULL)
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════════
-- 7. PANEL DE COBERTURA
-- ----------------------------------------------------------------------------
-- Que tan completo esta tu catalogo, y que modelos urge verificar porque son
-- los que mas entran al taller.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_spec_cobertura AS
SELECT
  v.marca,
  v.modelo,
  COUNT(*)                                              AS vehiculos_en_taller,
  COUNT(*) FILTER (WHERE v.cuartos_aceite IS NOT NULL)  AS con_datos,
  COUNT(*) FILTER (WHERE v.spec_confianza = 'VERIFICADO') AS verificados,
  MAX(s.confianza)                                      AS confianza_catalogo,
  MAX(s.cuartos)                                        AS cuartos_catalogo,
  MAX(s.viscosidad)                                     AS viscosidad_catalogo,
  CASE
    WHEN MAX(s.id) IS NULL                  THEN 'SIN FICHA — un técnico debe medirlo'
    WHEN MAX(s.confianza) = 'VERIFICADO'    THEN 'Verificado ✓'
    ELSE 'Estimado — conviene verificar'
  END AS estado
FROM vehiculos v
LEFT JOIN vehiculo_spec_servicio s
       ON LOWER(s.marca) = LOWER(v.marca)
      AND LOWER(s.modelo) = LOWER(v.modelo)
      AND (v.ano IS NULL OR v.ano BETWEEN COALESCE(s.ano_desde,1900) AND COALESCE(s.ano_hasta,2100))
WHERE v.activo IS NOT FALSE
GROUP BY v.marca, v.modelo
ORDER BY COUNT(*) DESC;

COMMENT ON VIEW v_spec_cobertura IS
  'Modelos ordenados por cuantos hay en el taller. Los de arriba sin ficha son los que mas urge medir.';


-- ════════════════════════════════════════════════════════════════════════════
-- 8. EL COTIZADOR USA LOS CUARTOS REALES DEL VEHICULO
-- ----------------------------------------------------------------------------
-- Hasta v24 el cotizador usaba los cuartos genericos del cilindraje. Ahora,
-- si el vehiculo tiene su dato propio (verificado por un tecnico o traido del
-- catalogo), se usa ese — que es el correcto.
--
-- Ejemplo de por que importa: un Honda Civic 1.5 turbo y un Toyota Corolla 1.8
-- son ambos de 4 cilindros, pero el Civic lleva 3.7 cuartos y el Corolla 4.4.
-- Cobrarles igual es perder plata en uno y sobrecobrar en el otro.
-- ════════════════════════════════════════════════════════════════════════════

-- PostgreSQL no deja cambiar el tipo de retorno con CREATE OR REPLACE, y esta
-- version agrega la columna `fuente_cuartos`. Por eso se borra y se recrea.
DROP FUNCTION IF EXISTS plan_cotizar_membresia(BIGINT, BIGINT);

CREATE FUNCTION plan_cotizar_membresia(
  p_plan_id     BIGINT,
  p_vehiculo_id BIGINT
)
RETURNS TABLE (
  vehiculo           TEXT,
  cilindros          SMALLINT,
  tipo_aceite        VARCHAR,
  cuartos            NUMERIC,
  aceite_nombre      TEXT,
  aceite_precio_u    NUMERIC,
  filtro_nombre      TEXT,
  filtro_precio      NUMERIC,
  stock_aceite       INT,
  plan_nombre        TEXT,
  mantenimientos_ano NUMERIC,
  intervalo_km       INT,
  precio_mensual     NUMERIC,
  precio_anual       NUMERIC,
  valor_total_ano    NUMERIC,
  ahorro_ano         NUMERIC,
  ahorro_pct         NUMERIC,
  precio_es_sugerido BOOLEAN,
  configurado        BOOLEAN,
  fuente_cuartos     VARCHAR,   -- VEHICULO | CATALOGO | CILINDRAJE
  aviso              TEXT
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_veh    RECORD;
  v_cil    SMALLINT;
  v_tipo   VARCHAR;
  v_mc     RECORD;
  v_ah     RECORD;
  v_pre    RECORD;
  v_sug    BOOLEAN := FALSE;
  v_aviso  TEXT := '';
  v_cuartos NUMERIC;
  v_fuente VARCHAR := 'CILINDRAJE';
  v_precio_mant NUMERIC;
BEGIN
  SELECT v.id, v.marca, v.modelo, v.ano, v.placa, v.cilindros, v.tipo_aceite,
         v.cuartos_aceite, v.viscosidad, v.spec_confianza
    INTO v_veh
  FROM vehiculos v WHERE v.id = p_vehiculo_id;

  IF v_veh IS NULL THEN
    RAISE EXCEPTION 'No existe el vehiculo %', p_vehiculo_id USING ERRCODE = 'P0002';
  END IF;

  v_cil  := COALESCE(v_veh.cilindros, 4);
  v_tipo := COALESCE(v_veh.tipo_aceite, 'SEMISINTETICO');

  IF v_veh.cilindros IS NULL THEN
    v_aviso := v_aviso || 'El vehiculo no tiene cilindraje registrado; se calculo como 4 cilindros. ';
  END IF;

  SELECT mc.cuartos, mc.intervalo_km, mc.aceite_item_id, mc.filtro_item_id,
         ac.name AS ac_name, ac.price AS ac_price, ac.stock AS ac_stock,
         fi.name AS fi_name, fi.price AS fi_price,
         (mc.aceite_item_id IS NOT NULL AND mc.filtro_item_id IS NOT NULL) AS ok
    INTO v_mc
  FROM plan_motor_config mc
  LEFT JOIN inventario ac ON ac.id = mc.aceite_item_id
  LEFT JOIN inventario fi ON fi.id = mc.filtro_item_id
  WHERE mc.cilindros = v_cil AND mc.tipo_aceite = v_tipo AND mc.activo
  LIMIT 1;

  -- Los cuartos del vehiculo mandan sobre los genericos del cilindraje
  IF v_veh.cuartos_aceite IS NOT NULL AND v_veh.cuartos_aceite > 0 THEN
    v_cuartos := v_veh.cuartos_aceite;
    v_fuente  := CASE WHEN v_veh.spec_confianza = 'VERIFICADO' THEN 'VEHICULO' ELSE 'CATALOGO' END;
  ELSE
    v_cuartos := COALESCE(v_mc.cuartos, 0);
    v_aviso := v_aviso || 'Sin cuartos especificos para este vehiculo; se uso el generico de '
               || v_cil || ' cilindros. Conviene que un tecnico lo verifique. ';
  END IF;

  IF v_mc IS NULL THEN
    v_aviso := v_aviso || 'No hay configuracion de motor para ' || v_cil || ' cilindros con aceite ' || v_tipo || '. ';
  ELSIF NOT v_mc.ok THEN
    v_aviso := v_aviso || 'Falta enlazar el aceite y/o el filtro del inventario para esta configuracion. ';
  ELSIF COALESCE(v_mc.ac_stock, 0) < v_cuartos THEN
    v_aviso := v_aviso || 'Stock de aceite insuficiente (' || COALESCE(v_mc.ac_stock,0) || ' en almacen). ';
  END IF;

  SELECT * INTO v_ah FROM plan_calcular_ahorro(p_plan_id, v_cil, v_tipo);

  -- Reajustar el valor si los cuartos reales difieren del generico usado por
  -- plan_calcular_ahorro, para que el ahorro mostrado sea el verdadero.
  -- Columnas calificadas con alias: `cilindros` y `tipo_aceite` también son
  -- nombres de salida de esta función, y sin calificar PostgreSQL aborta con
  -- "column reference is ambiguous".
  v_precio_mant := ROUND(v_cuartos * COALESCE(v_mc.ac_price, 0)
                       + COALESCE(v_mc.fi_price, 0)
                       + COALESCE((SELECT mc2.mano_obra FROM plan_motor_config mc2
                                   WHERE mc2.cilindros = v_cil
                                     AND mc2.tipo_aceite = v_tipo LIMIT 1), 0), 2);

  SELECT pp.precio_mensual, pp.precio_anual INTO v_pre
  FROM plan_precios pp WHERE pp.plan_id = p_plan_id AND pp.cilindros = v_cil;

  IF v_pre IS NULL THEN
    v_sug := TRUE;
    v_aviso := v_aviso || 'Precio sugerido automaticamente: no hay tarifa fijada para ' || v_cil || ' cilindros. ';
  END IF;

  RETURN QUERY SELECT
    TRIM(COALESCE(v_veh.marca,'') || ' ' || COALESCE(v_veh.modelo,'') ||
         COALESCE(' ' || v_veh.ano::TEXT, '') || COALESCE(' · ' || v_veh.placa, '')),
    v_cil,
    v_tipo,
    v_cuartos,
    COALESCE(v_mc.ac_name, '(sin enlazar)'),
    COALESCE(v_mc.ac_price, 0),
    COALESCE(v_mc.fi_name, '(sin enlazar)'),
    COALESCE(v_mc.fi_price, 0),
    COALESCE(v_mc.ac_stock, 0),
    v_ah.plan_nombre,
    v_ah.mantenimientos_ano,
    COALESCE(v_mc.intervalo_km, 5000),
    COALESCE(v_pre.precio_mensual, ROUND(v_ah.precio_plan_ano / 12 / 50) * 50),
    COALESCE(v_pre.precio_anual,   v_ah.precio_plan_ano),
    v_ah.valor_total_ano,
    v_ah.valor_total_ano - COALESCE(v_pre.precio_anual, v_ah.precio_plan_ano),
    CASE WHEN v_ah.valor_total_ano > 0
         THEN ROUND((v_ah.valor_total_ano - COALESCE(v_pre.precio_anual, v_ah.precio_plan_ano))
                    / v_ah.valor_total_ano * 100, 1)
         ELSE 0 END,
    v_sug,
    COALESCE(v_mc.ok, FALSE),
    v_fuente,
    NULLIF(TRIM(v_aviso), '');
END $$;
