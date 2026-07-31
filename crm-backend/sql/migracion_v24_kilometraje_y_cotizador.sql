-- ============================================================================
-- SOLIDO AUTO SERVICIO - Migracion v24
-- KILOMETRAJE + COTIZADOR DE MEMBRESIA POR VEHICULO
-- ----------------------------------------------------------------------------
-- Resuelve tres baches detectados al crear membresias:
--
--   1. El precio no cambiaba al elegir el vehiculo. Un V6 pagaba lo mismo que
--      un L4 aunque consume mas aceite. Ahora hay un cotizador que recibe el
--      VEHICULO y devuelve el precio correcto segun su cilindraje.
--
--   2. La secretaria tenia que saber cuantos cuartos de aceite lleva el motor.
--      Ahora el sistema se lo dice: al elegir el vehiculo salen los cuartos,
--      el aceite exacto del inventario y el costo, sin que ella invente nada.
--
--   3. No se aprovechaba el kilometraje. Ahora se captura al REGISTRAR el
--      vehiculo (origen 'REGISTRO'), y la hoja de inspeccion ya no lo pide en
--      blanco: sugiere la ultima lectura conocida. Cada visita suma una
--      lectura mas, y con dos lecturas el sistema calcula cuanto rueda al mes.
--      Eso permite avisar "su aceite ya vencio por kilometraje" aunque el
--      cliente haya venido por otra cosa.
--
-- Es idempotente y NO borra nada. Requiere v19, v20 y v23.
-- Ejecutar en Supabase -> SQL Editor.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- 1. HISTORIAL DE ODOMETRO
-- ----------------------------------------------------------------------------
-- Una fila por lectura. Las de recepcion entran solas por trigger; la
-- secretaria tambien puede anotar una lectura suelta (ej. el cliente llamo).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vehiculo_odometro (
  id           BIGSERIAL PRIMARY KEY,
  vehiculo_id  BIGINT NOT NULL,
  km           INT    NOT NULL,
  fecha        DATE   NOT NULL DEFAULT CURRENT_DATE,
  origen       VARCHAR(30) NOT NULL DEFAULT 'MANUAL',  -- REGISTRO | RECEPCION | MANUAL | PORTAL
  orden_id     BIGINT,
  usuario      VARCHAR(100),
  notas        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT vehiculo_odometro_km_check CHECK (km >= 0 AND km < 3000000)
);

CREATE INDEX IF NOT EXISTS idx_odo_vehiculo ON vehiculo_odometro(vehiculo_id, fecha DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_odo_orden_unica
  ON vehiculo_odometro(orden_id) WHERE orden_id IS NOT NULL;

COMMENT ON TABLE vehiculo_odometro IS
  'Lecturas de kilometraje. Alimenta la proyeccion de km actual y las alertas por uso.';


-- ── Backfill: recuperar el kilometraje que YA tienes en las inspecciones ────
-- Esto es historia gratis: cada recepcion pasada trae su km_entrada.
INSERT INTO vehiculo_odometro (vehiculo_id, km, fecha, origen, orden_id)
SELECT iv.vehiculo_id,
       iv.km_entrada,
       COALESCE(iv.fecha_recepcion::DATE, CURRENT_DATE),
       'RECEPCION',
       iv.orden_id
FROM inspeccion_vehiculo iv
WHERE iv.vehiculo_id IS NOT NULL
  AND iv.km_entrada IS NOT NULL
  AND iv.km_entrada > 0
ON CONFLICT (orden_id) WHERE orden_id IS NOT NULL DO NOTHING;


-- ── Trigger: cada inspeccion suma una lectura mas ──────────────────────────
-- El km se pide al registrar el vehiculo, pero cada visita lo confirma. Con
-- dos lecturas separadas ya se puede medir el ritmo real de uso, que es lo
-- que hace util la proyeccion.
CREATE OR REPLACE FUNCTION odometro_desde_inspeccion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.km_entrada IS NOT NULL AND NEW.km_entrada > 0 AND NEW.vehiculo_id IS NOT NULL THEN
    INSERT INTO vehiculo_odometro (vehiculo_id, km, fecha, origen, orden_id)
    VALUES (NEW.vehiculo_id, NEW.km_entrada,
            COALESCE(NEW.fecha_recepcion::DATE, CURRENT_DATE), 'RECEPCION', NEW.orden_id)
    ON CONFLICT (orden_id) WHERE orden_id IS NOT NULL
    DO UPDATE SET km = EXCLUDED.km, fecha = EXCLUDED.fecha;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_odometro_inspeccion ON inspeccion_vehiculo;
CREATE TRIGGER trg_odometro_inspeccion
  AFTER INSERT OR UPDATE OF km_entrada ON inspeccion_vehiculo
  FOR EACH ROW EXECUTE FUNCTION odometro_desde_inspeccion();


-- ════════════════════════════════════════════════════════════════════════════
-- 2. PROYECCION: cuanto km tiene HOY un vehiculo
-- ----------------------------------------------------------------------------
-- Con dos lecturas se calcula cuanto rueda al mes. Con eso se estima el km de
-- hoy sin que el carro este presente — que es lo que permite avisar a tiempo.
-- Si solo hay una lectura, usa el promedio declarado del vehiculo, y si
-- tampoco lo hay, asume 1,250 km/mes (15,000 al año, uso urbano dominicano).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION vehiculo_km_estimado(p_vehiculo_id BIGINT)
RETURNS TABLE (
  km_ultima_lectura  INT,
  fecha_ultima       DATE,
  km_por_mes         NUMERIC,
  dias_desde         INT,
  km_estimado_hoy    INT,
  confianza          VARCHAR   -- ALTA (2+ lecturas) | MEDIA (1) | BAJA (ninguna)
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_ult   RECORD;
  v_prev  RECORD;
  v_kmmes NUMERIC;
  v_conf  VARCHAR := 'BAJA';
  v_dias  INT;
BEGIN
  SELECT km, fecha INTO v_ult
  FROM vehiculo_odometro WHERE vehiculo_id = p_vehiculo_id
  ORDER BY fecha DESC, id DESC LIMIT 1;

  IF v_ult IS NULL THEN
    RETURN QUERY SELECT NULL::INT, NULL::DATE,
      COALESCE((SELECT km_promedio_mes FROM vehiculos WHERE id = p_vehiculo_id), 1250)::NUMERIC,
      NULL::INT, NULL::INT, 'BAJA'::VARCHAR;
    RETURN;
  END IF;

  -- Lectura anterior mas vieja, para medir el ritmo real de uso
  SELECT km, fecha INTO v_prev
  FROM vehiculo_odometro
  WHERE vehiculo_id = p_vehiculo_id AND fecha < v_ult.fecha AND km < v_ult.km
  ORDER BY fecha DESC, id DESC LIMIT 1;

  IF v_prev IS NOT NULL AND (v_ult.fecha - v_prev.fecha) >= 15 THEN
    v_kmmes := ROUND((v_ult.km - v_prev.km)::NUMERIC / ((v_ult.fecha - v_prev.fecha)::NUMERIC / 30.44), 0);
    v_conf  := 'ALTA';
  ELSE
    v_kmmes := COALESCE((SELECT km_promedio_mes FROM vehiculos WHERE id = p_vehiculo_id), 1250);
    v_conf  := 'MEDIA';
  END IF;

  -- Un ritmo absurdo (odometro mal tecleado) se acota a un rango sensato
  IF v_kmmes < 100   THEN v_kmmes := 100;   END IF;
  IF v_kmmes > 8000  THEN v_kmmes := 8000;  END IF;

  v_dias := CURRENT_DATE - v_ult.fecha;

  RETURN QUERY SELECT
    v_ult.km,
    v_ult.fecha,
    v_kmmes,
    v_dias,
    (v_ult.km + ROUND(v_kmmes * v_dias / 30.44))::INT,
    v_conf;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 3. COTIZADOR DE MEMBRESIA POR VEHICULO
-- ----------------------------------------------------------------------------
-- ESTA es la funcion que arregla el bache del precio. La pantalla de "nueva
-- membresia" debe llamarla al elegir el vehiculo, no antes.
--
-- Devuelve todo lo que la secretaria necesita ver en pantalla, sin que tenga
-- que saber nada de motores:
--   · precio correcto para ESE cilindraje
--   · cuantos cuartos lleva y que aceite exacto se le pone
--   · cuanto ahorra el cliente (el argumento de venta)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION plan_cotizar_membresia(
  p_plan_id     BIGINT,
  p_vehiculo_id BIGINT
)
RETURNS TABLE (
  -- Vehiculo
  vehiculo           TEXT,
  cilindros          SMALLINT,
  tipo_aceite        VARCHAR,
  -- Aceite (para que nadie invente cantidades)
  cuartos            NUMERIC,
  aceite_nombre      TEXT,
  aceite_precio_u    NUMERIC,
  filtro_nombre      TEXT,
  filtro_precio      NUMERIC,
  stock_aceite       INT,
  -- Plan
  plan_nombre        TEXT,
  mantenimientos_ano NUMERIC,
  intervalo_km       INT,
  -- Dinero
  precio_mensual     NUMERIC,
  precio_anual       NUMERIC,
  valor_total_ano    NUMERIC,
  ahorro_ano         NUMERIC,
  ahorro_pct         NUMERIC,
  -- Control
  precio_es_sugerido BOOLEAN,   -- TRUE = no hay precio fijado para ese cilindraje
  configurado        BOOLEAN,   -- FALSE = falta enlazar aceite/filtro al inventario
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
BEGIN
  SELECT v.id, v.marca, v.modelo, v.ano, v.placa, v.cilindros, v.tipo_aceite
    INTO v_veh
  FROM vehiculos v WHERE v.id = p_vehiculo_id;

  IF v_veh IS NULL THEN
    RAISE EXCEPTION 'No existe el vehiculo %', p_vehiculo_id USING ERRCODE = 'P0002';
  END IF;

  -- Si la ficha no tiene cilindraje, se asume 4 y se avisa en pantalla.
  v_cil  := COALESCE(v_veh.cilindros, 4);
  v_tipo := COALESCE(v_veh.tipo_aceite, 'SEMISINTETICO');

  IF v_veh.cilindros IS NULL THEN
    v_aviso := v_aviso || 'El vehiculo no tiene cilindraje registrado; se calculo como 4 cilindros. ';
  END IF;
  IF v_veh.tipo_aceite IS NULL THEN
    v_aviso := v_aviso || 'Sin tipo de aceite en ficha; se asumio semisintetico. ';
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

  IF v_mc IS NULL THEN
    v_aviso := v_aviso || 'No hay configuracion de motor para ' || v_cil || ' cilindros con aceite ' || v_tipo || '. ';
  ELSIF NOT v_mc.ok THEN
    v_aviso := v_aviso || 'Falta enlazar el aceite y/o el filtro del inventario para esta configuracion. ';
  ELSIF COALESCE(v_mc.ac_stock, 0) < COALESCE(v_mc.cuartos, 0) THEN
    v_aviso := v_aviso || 'Stock de aceite insuficiente (' || COALESCE(v_mc.ac_stock,0) || ' en almacen). ';
  END IF;

  -- Valor, ahorro y margen los calcula la funcion de v23
  SELECT * INTO v_ah FROM plan_calcular_ahorro(p_plan_id, v_cil, v_tipo);

  -- Precio fijado para ese cilindraje; si no hay, se usa el sugerido
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
    COALESCE(v_mc.cuartos, 0),
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
    NULLIF(TRIM(v_aviso), '');
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 4. ALERTAS POR KILOMETRAJE
-- ----------------------------------------------------------------------------
-- El caso que describiste: el cliente vino por tren delantero, y mientras
-- estaba aqui su aceite ya habia vencido por kilometraje. Antes eso se perdia.
--
-- `estado` sirve para el semaforo de la pantalla:
--   VENCIDO   — ya paso el intervalo, hay que llamarlo hoy
--   POR_VENCER— le faltan menos de 500 km
--   AL_DIA    — todo bien
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_alertas_mantenimiento_km AS
WITH ultimo_aceite AS (
  -- Ultimo cambio de aceite conocido por vehiculo, tomado del historico
  SELECT mp.vehiculo_id,
         MAX(mp.ultimo_servicio_km)    AS km_ultimo_cambio,
         MAX(mp.ultimo_servicio_fecha)  AS fecha_ultimo_cambio,
         MAX(mp.intervalo_km)           AS intervalo_km
  FROM mantenimiento_preventivo mp
  WHERE mp.tipo_servicio ILIKE '%aceite%'
    AND mp.estado <> 'CANCELADO'
  GROUP BY mp.vehiculo_id
)
SELECT
  v.id                AS vehiculo_id,
  v.placa,
  TRIM(COALESCE(v.marca,'') || ' ' || COALESCE(v.modelo,'')) AS vehiculo,
  v.cilindros,
  v.tipo_aceite,
  c.id                AS cliente_id,
  c.nombre            AS cliente,
  c.telefono,
  est.km_ultima_lectura,
  est.fecha_ultima,
  est.km_por_mes,
  est.km_estimado_hoy,
  est.confianza,
  ua.km_ultimo_cambio,
  ua.fecha_ultimo_cambio,
  COALESCE(ua.intervalo_km, mc.intervalo_km, 5000) AS intervalo_km,
  (COALESCE(ua.km_ultimo_cambio, est.km_ultima_lectura)
     + COALESCE(ua.intervalo_km, mc.intervalo_km, 5000))     AS km_proximo_cambio,
  (COALESCE(ua.km_ultimo_cambio, est.km_ultima_lectura)
     + COALESCE(ua.intervalo_km, mc.intervalo_km, 5000)
     - est.km_estimado_hoy)                                  AS km_restantes,
  CASE
    WHEN est.km_estimado_hoy IS NULL THEN 'SIN_DATOS'
    WHEN est.km_estimado_hoy >= COALESCE(ua.km_ultimo_cambio, est.km_ultima_lectura)
                                 + COALESCE(ua.intervalo_km, mc.intervalo_km, 5000) THEN 'VENCIDO'
    WHEN est.km_estimado_hoy >= COALESCE(ua.km_ultimo_cambio, est.km_ultima_lectura)
                                 + COALESCE(ua.intervalo_km, mc.intervalo_km, 5000) - 500 THEN 'POR_VENCER'
    ELSE 'AL_DIA'
  END AS estado,
  EXISTS (
    SELECT 1 FROM plan_membresia_vehiculos pmv
    JOIN plan_membresias pm ON pm.id = pmv.membresia_id AND pm.estado = 'ACTIVA'
    WHERE pmv.vehiculo_id = v.id
  ) AS tiene_membresia
FROM vehiculos v
LEFT JOIN clientes c ON c.id = v.cliente_id
LEFT JOIN ultimo_aceite ua ON ua.vehiculo_id = v.id
LEFT JOIN plan_motor_config mc
       ON mc.cilindros = COALESCE(v.cilindros, 4)
      AND mc.tipo_aceite = COALESCE(v.tipo_aceite, 'SEMISINTETICO')
CROSS JOIN LATERAL vehiculo_km_estimado(v.id) est
WHERE v.activo IS NOT FALSE;

COMMENT ON VIEW v_alertas_mantenimiento_km IS
  'Vehiculos con cambio de aceite vencido o proximo segun kilometraje proyectado.';


-- ── Registrar una lectura suelta (para la secretaria) ──────────────────────
CREATE OR REPLACE FUNCTION vehiculo_registrar_km(
  p_vehiculo_id BIGINT,
  p_km          INT,
  p_usuario     VARCHAR DEFAULT 'Sistema',
  p_notas       TEXT    DEFAULT NULL
)
RETURNS vehiculo_odometro
LANGUAGE plpgsql AS $$
DECLARE
  v_ultimo INT;
  v_fila   vehiculo_odometro;
BEGIN
  SELECT km INTO v_ultimo FROM vehiculo_odometro
  WHERE vehiculo_id = p_vehiculo_id ORDER BY fecha DESC, id DESC LIMIT 1;

  -- Un odometro no retrocede. Si baja, casi siempre es un error de tecleo.
  IF v_ultimo IS NOT NULL AND p_km < v_ultimo THEN
    RAISE EXCEPTION
      'El kilometraje (%) es menor que la ultima lectura (%). Verifica el dato.', p_km, v_ultimo
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO vehiculo_odometro (vehiculo_id, km, origen, usuario, notas)
  VALUES (p_vehiculo_id, p_km, 'MANUAL', p_usuario, p_notas)
  RETURNING * INTO v_fila;

  -- Mantener al dia el promedio del vehiculo para futuras proyecciones
  UPDATE vehiculos SET km_promedio_mes = (
    SELECT km_por_mes::INT FROM vehiculo_km_estimado(p_vehiculo_id)
  ) WHERE id = p_vehiculo_id;

  RETURN v_fila;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 5. CODIGO QUE YA QUEDO CONECTADO A ESTA MIGRACION
-- ----------------------------------------------------------------------------
-- BACKEND (crm-backend/server.mjs)
--   POST  /vehiculos                  guarda cilindros, tipo_aceite y crea la
--                                     lectura inicial de odometro (REGISTRO)
--   PATCH /vehiculos/:id              actualiza cilindraje/aceite y admite una
--                                     lectura nueva via vehiculo_registrar_km
--   GET   /vehiculos/:id/odometro     historial + proyeccion de km
--   POST  /vehiculos/:id/odometro     registrar una lectura suelta
--   GET   /planes/cotizar             precio real segun cilindraje
--   POST  /planes/membresias          COBRA el precio cotizado, no el catalogo
--   GET   /mantenimiento/alertas-km   vencidos y por vencer
--
-- FRONTEND
--   app/vehiculos/page.tsx            campos cilindros, tipo_aceite y
--                                     kilometraje al registrar y al editar
--   app/inspeccion/[ordenId]/page.tsx sugiere el km en vez de pedirlo vacio
--   app/planes/page.tsx               panel de cotizacion por vehiculo
--
-- ── LO UNICO QUE FALTA ─────────────────────────────────────────────────────
-- Una seccion en frontend/src/app/recordatorios/page.tsx que lea
-- /mantenimiento/alertas-km. Ese es el caso del cliente que vino por tren
-- delantero y su aceite ya habia vencido por kilometraje.
-- ============================================================================
