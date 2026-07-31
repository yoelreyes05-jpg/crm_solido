-- ============================================================================
-- SOLIDO AUTO SERVICIO - Migracion v23
-- PLANES DE MANTENIMIENTO POR CILINDRAJE
-- ----------------------------------------------------------------------------
-- Que agrega:
--   1. Cilindraje y tipo de aceite en la ficha del vehiculo.
--   2. Configuracion de cuartos de aceite y filtro por cilindraje (4/6/8),
--      enlazada al INVENTARIO real para tomar precio y costo.
--   3. Beneficio nuevo 'mantenimientos_ano' + catalogo de tipos de beneficio
--      editable, para poder crear beneficios sin tocar codigo.
--   4. Precios de plan por cilindraje (un V8 no puede pagar lo mismo que un L4).
--   5. Funciones que calculan costo, precio publico y AHORRO del cliente.
--   6. Blindaje: solo el rol 'gerente' puede tocar beneficios y precios.
--
-- Es idempotente y NO borra nada. Requiere v19 y v20.
-- Ejecutar en Supabase -> SQL Editor.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- 1. FICHA DEL VEHICULO: cilindraje y aceite
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS cilindros        SMALLINT,
  ADD COLUMN IF NOT EXISTS tipo_aceite      VARCHAR(20),
  ADD COLUMN IF NOT EXISTS km_promedio_mes  INT;

COMMENT ON COLUMN vehiculos.cilindros   IS '4, 6 u 8. Define cuantos cuartos de aceite lleva.';
COMMENT ON COLUMN vehiculos.tipo_aceite IS 'MINERAL | SEMISINTETICO | SINTETICO. Define el intervalo de cambio.';

ALTER TABLE vehiculos
  DROP CONSTRAINT IF EXISTS vehiculos_cilindros_check;
ALTER TABLE vehiculos
  ADD CONSTRAINT vehiculos_cilindros_check
  CHECK (cilindros IS NULL OR cilindros IN (3, 4, 5, 6, 8, 10, 12));

ALTER TABLE vehiculos
  DROP CONSTRAINT IF EXISTS vehiculos_tipo_aceite_check;
ALTER TABLE vehiculos
  ADD CONSTRAINT vehiculos_tipo_aceite_check
  CHECK (tipo_aceite IS NULL OR tipo_aceite IN ('MINERAL','SEMISINTETICO','SINTETICO'));


-- ════════════════════════════════════════════════════════════════════════════
-- 2. CONFIGURACION DE MOTOR: cuartos, aceite y filtro segun cilindraje
-- ----------------------------------------------------------------------------
-- Cada fila dice: "un motor de X cilindros con aceite tipo Y lleva Z cuartos,
-- se usa este aceite y este filtro del inventario, y la mano de obra es N".
-- El precio y el costo NO se guardan aqui: se leen de `inventario` en vivo,
-- asi un cambio de precio del suplidor se refleja solo en todos los planes.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS plan_motor_config (
  id              BIGSERIAL PRIMARY KEY,
  cilindros       SMALLINT NOT NULL,
  tipo_aceite     VARCHAR(20) NOT NULL,
  cuartos         NUMERIC(4,1) NOT NULL,          -- cuartos de aceite que lleva
  aceite_item_id  INT REFERENCES inventario(id) ON DELETE SET NULL,
  filtro_item_id  INT REFERENCES inventario(id) ON DELETE SET NULL,
  mano_obra       NUMERIC(12,2) NOT NULL DEFAULT 0,
  intervalo_km    INT NOT NULL DEFAULT 5000,      -- cada cuanto toca el cambio
  activo          BOOLEAN DEFAULT TRUE,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (cilindros, tipo_aceite),
  CONSTRAINT plan_motor_cilindros_check   CHECK (cilindros IN (3,4,5,6,8,10,12)),
  CONSTRAINT plan_motor_tipo_aceite_check CHECK (tipo_aceite IN ('MINERAL','SEMISINTETICO','SINTETICO'))
);

COMMENT ON TABLE plan_motor_config IS
  'Cuartos de aceite y refacciones por cilindraje. Precios se leen de inventario en vivo.';

-- Semillas: cuartos tipicos e intervalos por tipo de aceite.
-- Los item_id quedan NULL a proposito: los enlazas desde el panel a los
-- productos reales de TU inventario (paso 8 al final de este archivo).
INSERT INTO plan_motor_config (cilindros, tipo_aceite, cuartos, mano_obra, intervalo_km)
VALUES
  (4, 'MINERAL',        4.5,  500, 3000),
  (4, 'SEMISINTETICO',  4.5,  500, 5000),
  (4, 'SINTETICO',      4.5,  500, 8000),
  (6, 'MINERAL',        5.5,  700, 3000),
  (6, 'SEMISINTETICO',  5.5,  700, 5000),
  (6, 'SINTETICO',      5.5,  700, 8000),
  (8, 'MINERAL',        7.0,  900, 3000),
  (8, 'SEMISINTETICO',  7.0,  900, 5000),
  (8, 'SINTETICO',      7.0,  900, 8000)
ON CONFLICT (cilindros, tipo_aceite) DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════════
-- 3. CATALOGO DE TIPOS DE BENEFICIO (para agregar beneficios sin tocar codigo)
-- ----------------------------------------------------------------------------
-- Antes los tipos de beneficio vivian solo en un comentario del SQL v19 y en
-- el codigo del backend. Ahora estan en tabla: puedes crear uno nuevo desde el
-- panel y el frontend sabra como pintarlo gracias a `formato`.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS plan_beneficio_tipos (
  tipo         VARCHAR(40) PRIMARY KEY,
  etiqueta     VARCHAR(80)  NOT NULL,
  descripcion  TEXT,
  formato      VARCHAR(20)  NOT NULL DEFAULT 'numero',
  unidad       VARCHAR(20),
  permite_ilimitado BOOLEAN DEFAULT FALSE,   -- si TRUE, -1 significa "ilimitado"
  orden        INT DEFAULT 100,
  es_sistema   BOOLEAN DEFAULT FALSE,        -- TRUE = el backend lo usa, no borrar
  activo       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT plan_ben_formato_check
    CHECK (formato IN ('numero','porcentaje','moneda','booleano','multiplicador'))
);

INSERT INTO plan_beneficio_tipos
  (tipo, etiqueta, descripcion, formato, unidad, permite_ilimitado, orden, es_sistema)
VALUES
  ('mantenimientos_ano',   'Mantenimientos al año',   'Cambios de aceite completos incluidos por año',        'numero',        'al año',  FALSE, 10, TRUE),
  ('lavados_mes',          'Lavados al mes',          'Lavados incluidos por mes (-1 = ilimitado)',           'numero',        'al mes',  TRUE,  20, TRUE),
  ('lavados_ano',          'Lavados al año',          'Lavados sueltos al año (para planes sin cupo mensual)','numero',        'al año',  FALSE, 25, TRUE),
  ('diagnosticos_mes',     'Diagnósticos al mes',     'Diagnósticos incluidos por mes (-1 = ilimitado)',      'numero',        'al mes',  TRUE,  30, TRUE),
  ('desc_servicios',       'Descuento en servicios',  'Descuento sobre mano de obra',                         'porcentaje',    '%',       FALSE, 40, TRUE),
  ('desc_repuestos',       'Descuento en repuestos',  'Descuento sobre piezas',                               'porcentaje',    '%',       FALSE, 50, TRUE),
  ('multiplicador_puntos', 'Multiplicador de puntos', 'Puntos de fidelización que gana por cada peso',        'multiplicador', 'x',       FALSE, 60, TRUE),
  ('prioridad',            'Prioridad en cola',       'Entra primero en la cola del taller',                  'booleano',      NULL,      FALSE, 70, TRUE),
  ('vehiculos_max',        'Vehículos cubiertos',     'Cuántos vehículos cubre la membresía (-1 = ilimitado)','numero',        'vehículos',TRUE, 80, TRUE),
  ('detallado_ano',        'Detallados al año',       'Detallados completos incluidos por año',               'numero',        'al año',  FALSE, 90, FALSE),
  ('grua_ano',             'Servicios de grúa',       'Remolques incluidos por año',                          'numero',        'al año',  FALSE, 100, FALSE),
  ('revision_puntos',      'Revisión multipunto',     'Revisión de X puntos en cada visita',                  'numero',        'puntos',  FALSE, 110, FALSE)
ON CONFLICT (tipo) DO NOTHING;

-- Enlaza los beneficios ya existentes con su tipo (integridad hacia adelante)
ALTER TABLE plan_beneficios
  DROP CONSTRAINT IF EXISTS plan_beneficios_tipo_fk;
ALTER TABLE plan_beneficios
  ADD CONSTRAINT plan_beneficios_tipo_fk
  FOREIGN KEY (tipo) REFERENCES plan_beneficio_tipos(tipo) ON UPDATE CASCADE;


-- ════════════════════════════════════════════════════════════════════════════
-- 4. PRECIOS POR CILINDRAJE
-- ----------------------------------------------------------------------------
-- El mismo plan cuesta distinto segun el motor, porque un V8 consume 7 cuartos
-- y un L4 consume 4.5. Si cobraras igual, el V8 te deja sin margen.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS plan_precios (
  id             BIGSERIAL PRIMARY KEY,
  plan_id        BIGINT NOT NULL REFERENCES plan_catalogo(id) ON DELETE CASCADE,
  cilindros      SMALLINT NOT NULL,
  precio_mensual NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_anual   NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (plan_id, cilindros)
);


-- ════════════════════════════════════════════════════════════════════════════
-- 5. REDISENO DE LOS PLANES
-- ----------------------------------------------------------------------------
-- Antes: planes de descuentos y lavados, sin mantenimiento incluido.
-- Ahora: el mantenimiento es el corazon del plan; lavados y descuentos son
-- el complemento. Se conservan los MISMOS ids, asi las membresias vigentes
-- no se rompen.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  p_lavado BIGINT; p_basico BIGINT; p_vip BIGINT; p_premium BIGINT;
BEGIN
  SELECT id INTO p_lavado  FROM plan_catalogo WHERE nombre ILIKE '%lavado%'  LIMIT 1;
  SELECT id INTO p_basico  FROM plan_catalogo WHERE nombre ILIKE '%básico%' OR nombre ILIKE '%basico%' LIMIT 1;
  SELECT id INTO p_vip     FROM plan_catalogo WHERE nombre ILIKE '%vip%'     LIMIT 1;
  SELECT id INTO p_premium FROM plan_catalogo WHERE nombre ILIKE '%premium%' LIMIT 1;

  -- ── Descripciones nuevas ──────────────────────────────────────────────────
  UPDATE plan_catalogo SET
    descripcion = '4 lavados al mes. Sin mantenimiento incluido.',
    orden = 1
  WHERE id = p_lavado;

  UPDATE plan_catalogo SET
    emoji = '🔵', color = '#3b82f6',
    descripcion = '2 mantenimientos al año + 2 lavados + 5% en mano de obra.',
    orden = 2
  WHERE id = p_basico;

  UPDATE plan_catalogo SET
    emoji = '👑', color = '#f59e0b',
    descripcion = '3 mantenimientos al año + 1 lavado al mes + 10% servicios, 5% repuestos, puntos x2 y prioridad.',
    orden = 3
  WHERE id = p_vip;

  UPDATE plan_catalogo SET
    emoji = '💎', color = '#8b5cf6',
    descripcion = '4 mantenimientos al año + 2 lavados al mes + 1 detallado + 15% servicios, 10% repuestos, puntos x3 y prioridad.',
    orden = 4
  WHERE id = p_premium;

  -- ── Beneficios ────────────────────────────────────────────────────────────
  -- Se usa UPSERT para poder reejecutar la migracion sin duplicar.

  -- Plan Lavado: solo lavados, cero mantenimiento
  INSERT INTO plan_beneficios (plan_id, tipo, valor) VALUES
    (p_lavado, 'mantenimientos_ano', 0),
    (p_lavado, 'lavados_mes',        4),
    (p_lavado, 'vehiculos_max',      1)
  ON CONFLICT (plan_id, tipo) DO UPDATE SET valor = EXCLUDED.valor;

  -- Basico: 2 mantenimientos al año
  INSERT INTO plan_beneficios (plan_id, tipo, valor) VALUES
    (p_basico, 'mantenimientos_ano',   2),
    (p_basico, 'lavados_mes',          0),
    (p_basico, 'lavados_ano',          2),   -- uno con cada mantenimiento
    (p_basico, 'detallado_ano',        0),
    (p_basico, 'diagnosticos_mes',     1),
    (p_basico, 'desc_servicios',       5),
    (p_basico, 'desc_repuestos',       0),
    (p_basico, 'multiplicador_puntos', 1),
    (p_basico, 'prioridad',            0),
    (p_basico, 'revision_puntos',     20),
    (p_basico, 'vehiculos_max',        1)
  ON CONFLICT (plan_id, tipo) DO UPDATE SET valor = EXCLUDED.valor;

  -- VIP: 3 mantenimientos al año
  INSERT INTO plan_beneficios (plan_id, tipo, valor) VALUES
    (p_vip, 'mantenimientos_ano',   3),
    (p_vip, 'lavados_mes',          1),
    (p_vip, 'detallado_ano',        0),
    (p_vip, 'diagnosticos_mes',    -1),
    (p_vip, 'desc_servicios',      10),
    (p_vip, 'desc_repuestos',       5),
    (p_vip, 'multiplicador_puntos', 2),
    (p_vip, 'prioridad',            1),
    (p_vip, 'revision_puntos',     20),
    (p_vip, 'vehiculos_max',        2)
  ON CONFLICT (plan_id, tipo) DO UPDATE SET valor = EXCLUDED.valor;

  -- Premium: 4 mantenimientos al año
  INSERT INTO plan_beneficios (plan_id, tipo, valor) VALUES
    (p_premium, 'mantenimientos_ano',   4),
    (p_premium, 'lavados_mes',          2),
    (p_premium, 'detallado_ano',        1),
    (p_premium, 'diagnosticos_mes',    -1),
    (p_premium, 'desc_servicios',      15),
    (p_premium, 'desc_repuestos',      10),
    (p_premium, 'multiplicador_puntos', 3),
    (p_premium, 'prioridad',            1),
    (p_premium, 'revision_puntos',     30),
    (p_premium, 'grua_ano',             1),
    (p_premium, 'vehiculos_max',        3)
  ON CONFLICT (plan_id, tipo) DO UPDATE SET valor = EXCLUDED.valor;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 6. CALCULADORA: costo del mantenimiento segun el motor
-- ----------------------------------------------------------------------------
-- Lee el precio del aceite y del filtro directamente de `inventario`.
-- Si todavia no enlazaste los productos (aceite_item_id NULL), devuelve 0 en
-- esa parte para que se note que falta configurar, en vez de inventar cifras.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION plan_costo_mantenimiento(
  p_cilindros   SMALLINT,
  p_tipo_aceite VARCHAR DEFAULT 'SEMISINTETICO'
)
RETURNS TABLE (
  cuartos           NUMERIC,
  precio_aceite_u   NUMERIC,   -- precio de venta por cuarto
  costo_aceite_u    NUMERIC,   -- lo que te cuesta a ti el cuarto
  precio_filtro     NUMERIC,
  costo_filtro      NUMERIC,
  mano_obra         NUMERIC,
  intervalo_km      INT,
  precio_publico    NUMERIC,   -- lo que cobras sin plan
  costo_taller      NUMERIC,   -- lo que te cuesta a ti
  configurado       BOOLEAN    -- FALSE si faltan enlaces al inventario
)
LANGUAGE sql STABLE AS $$
  SELECT
    mc.cuartos,
    COALESCE(ac.price, 0)                                  AS precio_aceite_u,
    COALESCE(ac.precio_compra, 0)                          AS costo_aceite_u,
    COALESCE(fi.price, 0)                                  AS precio_filtro,
    COALESCE(fi.precio_compra, 0)                          AS costo_filtro,
    mc.mano_obra,
    mc.intervalo_km,
    ROUND(mc.cuartos * COALESCE(ac.price, 0) + COALESCE(fi.price, 0) + mc.mano_obra, 2)                AS precio_publico,
    ROUND(mc.cuartos * COALESCE(ac.precio_compra, 0) + COALESCE(fi.precio_compra, 0), 2)               AS costo_taller,
    (mc.aceite_item_id IS NOT NULL AND mc.filtro_item_id IS NOT NULL)                                  AS configurado
  FROM plan_motor_config mc
  LEFT JOIN inventario ac ON ac.id = mc.aceite_item_id
  LEFT JOIN inventario fi ON fi.id = mc.filtro_item_id
  WHERE mc.cilindros = p_cilindros
    AND mc.tipo_aceite = p_tipo_aceite
    AND mc.activo
  LIMIT 1;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- 7. CALCULADORA: cuanto ahorra el cliente con el plan
-- ----------------------------------------------------------------------------
-- Esta es la funcion que alimenta la pantalla de venta: el cliente ve en
-- numeros concretos cuanto se ahorra, que es lo que cierra la venta.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION plan_calcular_ahorro(
  p_plan_id     BIGINT,
  p_cilindros   SMALLINT,
  p_tipo_aceite VARCHAR DEFAULT 'SEMISINTETICO',
  p_precio_lavado NUMERIC DEFAULT NULL   -- si es NULL toma "Lavado completo"
)
RETURNS TABLE (
  plan_nombre        TEXT,
  mantenimientos_ano NUMERIC,
  lavados_ano        NUMERIC,
  detallados_ano     NUMERIC,
  valor_mantenim     NUMERIC,   -- lo que costarian los mantenimientos sueltos
  valor_lavados      NUMERIC,
  valor_detallados   NUMERIC,
  valor_total_ano    NUMERIC,   -- valor de todo lo incluido, a precio de lista
  precio_plan_ano    NUMERIC,   -- lo que el cliente paga
  ahorro_ano         NUMERIC,
  ahorro_pct         NUMERIC,
  costo_taller_ano   NUMERIC,   -- lo que te cuesta a ti servirlo
  margen_ano         NUMERIC,
  margen_pct         NUMERIC,
  configurado        BOOLEAN
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_mant     NUMERIC := 0;
  v_lav_mes  NUMERIC := 0;
  v_lav_ano  NUMERIC := 0;
  v_lav_tot  NUMERIC := 0;
  v_det      NUMERIC := 0;
  v_costo    RECORD;
  v_lavado   NUMERIC;
  v_costo_lavado NUMERIC := 180;   -- insumos aproximados por lavado
  v_precio_ano NUMERIC;
  v_nombre   TEXT;
  v_val_mant NUMERIC; v_val_lav NUMERIC; v_val_det NUMERIC; v_total NUMERIC;
  v_costo_ano NUMERIC;
BEGIN
  SELECT nombre INTO v_nombre FROM plan_catalogo WHERE id = p_plan_id;

  SELECT COALESCE(MAX(CASE WHEN tipo='mantenimientos_ano' THEN valor END), 0),
         COALESCE(MAX(CASE WHEN tipo='lavados_mes'        THEN valor END), 0),
         COALESCE(MAX(CASE WHEN tipo='lavados_ano'        THEN valor END), 0),
         COALESCE(MAX(CASE WHEN tipo='detallado_ano'      THEN valor END), 0)
    INTO v_mant, v_lav_mes, v_lav_ano, v_det
  FROM plan_beneficios WHERE plan_id = p_plan_id;

  SELECT * INTO v_costo FROM plan_costo_mantenimiento(p_cilindros, p_tipo_aceite);

  v_lavado := COALESCE(
    p_precio_lavado,
    (SELECT precio FROM carwash_servicios WHERE nombre ILIKE '%completo%' AND activo IS NOT FALSE ORDER BY precio LIMIT 1),
    600
  );

  -- Lavados ilimitados (-1): se estima consumo real de 4 al mes, no infinito.
  -- Presupuestar "infinito" daria un ahorro irreal y un margen negativo.
  IF v_lav_mes < 0 THEN v_lav_mes := 4; END IF;

  -- Total de lavados al año = cupo mensual x 12 + lavados sueltos anuales
  v_lav_tot := v_lav_mes * 12 + v_lav_ano;

  v_val_mant := ROUND(v_mant * COALESCE(v_costo.precio_publico, 0), 2);
  v_val_lav  := ROUND(v_lav_tot * v_lavado, 2);
  v_val_det  := ROUND(v_det * COALESCE(
                  (SELECT precio FROM carwash_servicios WHERE nombre ILIKE '%detallado%' LIMIT 1), 1800), 2);
  v_total    := v_val_mant + v_val_lav + v_val_det;

  SELECT pp.precio_anual INTO v_precio_ano
  FROM plan_precios pp WHERE pp.plan_id = p_plan_id AND pp.cilindros = p_cilindros;

  -- Si no hay precio por cilindraje configurado, se sugiere uno: 82% del valor
  -- (18% de ahorro para el cliente), redondeado a la centena mas cercana.
  IF v_precio_ano IS NULL OR v_precio_ano = 0 THEN
    v_precio_ano := ROUND(v_total * 0.82 / 100) * 100;
  END IF;

  v_costo_ano := ROUND(
      v_mant * COALESCE(v_costo.costo_taller, 0)
    + v_lav_tot * v_costo_lavado
    + v_det * 400, 2);

  RETURN QUERY SELECT
    v_nombre,
    v_mant,
    v_lav_tot,
    v_det,
    v_val_mant,
    v_val_lav,
    v_val_det,
    v_total,
    v_precio_ano,
    v_total - v_precio_ano,
    CASE WHEN v_total > 0 THEN ROUND((v_total - v_precio_ano) / v_total * 100, 1) ELSE 0 END,
    v_costo_ano,
    v_precio_ano - v_costo_ano,
    CASE WHEN v_precio_ano > 0 THEN ROUND((v_precio_ano - v_costo_ano) / v_precio_ano * 100, 1) ELSE 0 END,
    COALESCE(v_costo.configurado, FALSE);
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 8. BLINDAJE: solo el GERENTE puede tocar beneficios y precios
-- ----------------------------------------------------------------------------
-- Esto es la segunda linea de defensa. La primera es el permiso en el backend
-- (ver instrucciones al final). Aqui la base de datos se niega a guardar si
-- quien pide el cambio no es gerente, aunque alguien llame al endpoint directo.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS plan_beneficios_log (
  id           BIGSERIAL PRIMARY KEY,
  plan_id      BIGINT,
  tipo         VARCHAR(40),
  valor_antes  NUMERIC,
  valor_nuevo  NUMERIC,
  accion       VARCHAR(20),          -- CREAR | EDITAR | ELIMINAR
  usuario      VARCHAR(100),
  rol          VARCHAR(40),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_ben_log_fecha ON plan_beneficios_log(created_at DESC);

-- Guarda un beneficio validando el rol. El backend DEBE llamar esta funcion
-- en vez de hacer INSERT/UPDATE directo sobre plan_beneficios.
CREATE OR REPLACE FUNCTION plan_guardar_beneficio(
  p_plan_id BIGINT,
  p_tipo    VARCHAR,
  p_valor   NUMERIC,
  p_usuario VARCHAR,
  p_rol     VARCHAR
)
RETURNS plan_beneficios
LANGUAGE plpgsql AS $$
DECLARE
  v_antes NUMERIC;
  v_fila  plan_beneficios;
BEGIN
  IF LOWER(COALESCE(p_rol,'')) <> 'gerente' THEN
    RAISE EXCEPTION
      'Solo el gerente puede modificar los beneficios de los planes. Rol recibido: %',
      COALESCE(p_rol, '(ninguno)')
      USING ERRCODE = '42501';   -- insufficient_privilege
  END IF;

  IF NOT EXISTS (SELECT 1 FROM plan_beneficio_tipos WHERE tipo = p_tipo AND activo) THEN
    RAISE EXCEPTION
      'El tipo de beneficio "%" no existe o esta inactivo. Crealo primero en plan_beneficio_tipos.', p_tipo
      USING ERRCODE = '23503';
  END IF;

  SELECT valor INTO v_antes FROM plan_beneficios WHERE plan_id = p_plan_id AND tipo = p_tipo;

  INSERT INTO plan_beneficios (plan_id, tipo, valor)
  VALUES (p_plan_id, p_tipo, p_valor)
  ON CONFLICT (plan_id, tipo) DO UPDATE SET valor = EXCLUDED.valor
  RETURNING * INTO v_fila;

  INSERT INTO plan_beneficios_log (plan_id, tipo, valor_antes, valor_nuevo, accion, usuario, rol)
  VALUES (p_plan_id, p_tipo, v_antes, p_valor,
          CASE WHEN v_antes IS NULL THEN 'CREAR' ELSE 'EDITAR' END, p_usuario, p_rol);

  RETURN v_fila;
END $$;

-- Crea un tipo de beneficio nuevo (tambien solo gerente).
CREATE OR REPLACE FUNCTION plan_crear_tipo_beneficio(
  p_tipo        VARCHAR,
  p_etiqueta    VARCHAR,
  p_descripcion TEXT,
  p_formato     VARCHAR,
  p_unidad      VARCHAR,
  p_usuario     VARCHAR,
  p_rol         VARCHAR
)
RETURNS plan_beneficio_tipos
LANGUAGE plpgsql AS $$
DECLARE v_fila plan_beneficio_tipos;
BEGIN
  IF LOWER(COALESCE(p_rol,'')) <> 'gerente' THEN
    RAISE EXCEPTION 'Solo el gerente puede crear tipos de beneficio.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO plan_beneficio_tipos (tipo, etiqueta, descripcion, formato, unidad, es_sistema)
  VALUES (p_tipo, p_etiqueta, p_descripcion, COALESCE(p_formato,'numero'), p_unidad, FALSE)
  RETURNING * INTO v_fila;

  INSERT INTO plan_beneficios_log (tipo, accion, usuario, rol)
  VALUES (p_tipo, 'CREAR_TIPO', p_usuario, p_rol);

  RETURN v_fila;
END $$;

-- Impide borrar los tipos que el backend necesita para funcionar.
CREATE OR REPLACE FUNCTION plan_proteger_tipos_sistema()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.es_sistema THEN
    RAISE EXCEPTION
      'El beneficio "%" lo usa el sistema y no se puede borrar. Desactivalo con activo = false.', OLD.tipo
      USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_plan_proteger_tipos ON plan_beneficio_tipos;
CREATE TRIGGER trg_plan_proteger_tipos
  BEFORE DELETE ON plan_beneficio_tipos
  FOR EACH ROW EXECUTE FUNCTION plan_proteger_tipos_sistema();


-- ════════════════════════════════════════════════════════════════════════════
-- 9. VISTA DE VENTA: la tabla comparativa lista para pintar en pantalla
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_planes_beneficios AS
SELECT
  pc.id            AS plan_id,
  pc.nombre        AS plan,
  pc.emoji,
  pc.color,
  pc.orden,
  pc.activo,
  bt.tipo,
  bt.etiqueta,
  bt.formato,
  bt.unidad,
  bt.orden         AS orden_beneficio,
  pb.valor,
  CASE
    WHEN bt.permite_ilimitado AND pb.valor = -1 THEN 'Ilimitado'
    WHEN bt.formato = 'booleano'      THEN CASE WHEN pb.valor > 0 THEN 'Sí' ELSE 'No' END
    WHEN bt.formato = 'porcentaje'    THEN pb.valor::TEXT || '%'
    WHEN bt.formato = 'multiplicador' THEN 'x' || pb.valor::TEXT
    WHEN bt.formato = 'moneda'        THEN 'RD$ ' || TO_CHAR(pb.valor, 'FM999,999,990.00')
    ELSE TRIM(TO_CHAR(pb.valor, 'FM999,999,990.##')) || COALESCE(' ' || bt.unidad, '')
  END AS valor_texto
FROM plan_catalogo pc
JOIN plan_beneficios pb     ON pb.plan_id = pc.id
JOIN plan_beneficio_tipos bt ON bt.tipo = pb.tipo
WHERE pc.activo AND bt.activo
ORDER BY pc.orden, bt.orden;


-- ════════════════════════════════════════════════════════════════════════════
-- 10. QUE FALTA HACER A MANO (2 minutos)
-- ----------------------------------------------------------------------------
-- A) Enlaza tus productos reales del inventario. Primero busca sus ids:
--
--      SELECT id, name, price, precio_compra, stock
--      FROM inventario
--      WHERE name ILIKE '%aceite%' OR name ILIKE '%filtro%'
--      ORDER BY name;
--
--    Y luego enlaza (ejemplo con ids ficticios 101 y 205):
--
--      UPDATE plan_motor_config
--         SET aceite_item_id = 101, filtro_item_id = 205
--       WHERE cilindros = 4 AND tipo_aceite = 'SEMISINTETICO';
--
--    Repite para cada combinacion que ofrezcas. Sin esto, las funciones
--    devuelven configurado = FALSE y precio 0 (a proposito: para que se note).
--
-- B) Revisa los cuartos y la mano de obra sembrados; ajustalos a tu realidad:
--
--      SELECT * FROM plan_motor_config ORDER BY cilindros, tipo_aceite;
--
-- C) Genera los precios sugeridos por cilindraje y guardalos:
--
--      SELECT * FROM plan_calcular_ahorro(2::BIGINT, 4::SMALLINT);  -- plan 2, motor L4
--
--    Cuando esten a tu gusto, fijalos:
--
--      INSERT INTO plan_precios (plan_id, cilindros, precio_mensual, precio_anual)
--      VALUES (2, 4, 600, 7200)
--      ON CONFLICT (plan_id, cilindros) DO UPDATE
--        SET precio_mensual = EXCLUDED.precio_mensual,
--            precio_anual   = EXCLUDED.precio_anual;
--
-- D) En el BACKEND, cambia los endpoints de escritura de beneficios para que
--    llamen a plan_guardar_beneficio(...) pasando el rol del usuario, en vez
--    de hacer INSERT directo. Y en frontend/src/lib/permisos.ts cambia el
--    modulo 'planes' de la secretaria de OPERACION a VER (hoy puede editar).
-- ============================================================================
