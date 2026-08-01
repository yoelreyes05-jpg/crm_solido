-- ============================================================================
-- SOLIDO AUTO SERVICIO - Migracion v26
-- EL KILOMETRAJE VIVE EN LA FICHA DEL VEHICULO
-- ----------------------------------------------------------------------------
-- EL PROBLEMA
--   En v24 el kilometraje quedo SOLO en el historial `vehiculo_odometro`. Eso
--   es correcto para auditar, pero significa que la tabla `vehiculos` no sabe
--   cuantos km tiene el carro. Como consecuencia:
--     · la lista de vehiculos no puede mostrar el kilometraje
--     · al guardar un vehiculo nuevo, el dato "desaparece" de la pantalla
--     · la hoja de inspeccion tenia que pedirlo con una consulta aparte
--
-- LA SOLUCION
--   Guardar la ultima lectura tambien en `vehiculos.km_actual`, mantenida
--   automaticamente por un trigger. Es un dato duplicado a proposito: se lee
--   cientos de veces (listas, fichas, inspeccion) y se escribe pocas, asi que
--   duplicarlo evita una consulta en cada pantalla.
--
--   El historial completo sigue en `vehiculo_odometro` y sigue siendo la
--   fuente de verdad. `km_actual` es solo un espejo de la ultima fila.
--
-- Es idempotente y NO borra nada. Requiere v24.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- 1. COLUMNAS EN LA FICHA
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS km_actual       INT,
  ADD COLUMN IF NOT EXISTS km_actual_fecha DATE;

COMMENT ON COLUMN vehiculos.km_actual IS
  'Ultima lectura conocida del odometro. Lo mantiene el trigger desde vehiculo_odometro; no editar a mano.';
COMMENT ON COLUMN vehiculos.km_actual_fecha IS
  'Fecha de esa lectura, para saber que tan vieja es.';


-- ════════════════════════════════════════════════════════════════════════════
-- 2. TRIGGER: cada lectura nueva actualiza la ficha
-- ----------------------------------------------------------------------------
-- Solo avanza si la lectura es mas reciente o mayor, para que registrar una
-- lectura vieja (por ejemplo al corregir una orden pasada) no haga retroceder
-- el kilometraje del vehiculo.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION vehiculo_sincronizar_km()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_km    INT;
  v_fecha DATE;
BEGIN
  SELECT o.km, o.fecha INTO v_km, v_fecha
  FROM vehiculo_odometro o
  WHERE o.vehiculo_id = COALESCE(NEW.vehiculo_id, OLD.vehiculo_id)
  ORDER BY o.fecha DESC, o.id DESC
  LIMIT 1;

  UPDATE vehiculos
     SET km_actual       = v_km,
         km_actual_fecha = v_fecha
   WHERE id = COALESCE(NEW.vehiculo_id, OLD.vehiculo_id);

  RETURN NULL;   -- AFTER trigger: el valor de retorno se ignora
END $$;

DROP TRIGGER IF EXISTS trg_vehiculo_sincronizar_km ON vehiculo_odometro;
CREATE TRIGGER trg_vehiculo_sincronizar_km
  AFTER INSERT OR UPDATE OR DELETE ON vehiculo_odometro
  FOR EACH ROW EXECUTE FUNCTION vehiculo_sincronizar_km();


-- ════════════════════════════════════════════════════════════════════════════
-- 3. BACKFILL: llenar con lo que ya existe
-- ----------------------------------------------------------------------------
-- Toma la ultima lectura de cada vehiculo. Incluye las que v24 recupero de
-- las inspecciones pasadas, asi que los vehiculos que ya visitaron el taller
-- aparecen con su kilometraje sin que nadie teclee nada.
-- ════════════════════════════════════════════════════════════════════════════

UPDATE vehiculos v
   SET km_actual       = u.km,
       km_actual_fecha = u.fecha
  FROM (
    SELECT DISTINCT ON (vehiculo_id) vehiculo_id, km, fecha
    FROM vehiculo_odometro
    ORDER BY vehiculo_id, fecha DESC, id DESC
  ) u
 WHERE u.vehiculo_id = v.id
   AND (v.km_actual IS NULL OR v.km_actual <> u.km);


-- ════════════════════════════════════════════════════════════════════════════
-- 4. REGISTRAR LA PRIMERA LECTURA AL CREAR UN VEHICULO
-- ----------------------------------------------------------------------------
-- El backend inserta la lectura inicial en `vehiculo_odometro`. Pero si
-- alguien crea un vehiculo directo por SQL o desde otra herramienta y le pone
-- `km_actual`, este trigger crea la fila del historial para que las dos
-- tablas nunca se contradigan.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION vehiculo_km_inicial()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.km_actual IS NOT NULL AND NEW.km_actual > 0
     AND NOT EXISTS (SELECT 1 FROM vehiculo_odometro WHERE vehiculo_id = NEW.id) THEN
    INSERT INTO vehiculo_odometro (vehiculo_id, km, fecha, origen, notas)
    VALUES (NEW.id, NEW.km_actual, COALESCE(NEW.km_actual_fecha, CURRENT_DATE),
            'REGISTRO', 'Lectura inicial al registrar el vehiculo');
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_vehiculo_km_inicial ON vehiculos;
CREATE TRIGGER trg_vehiculo_km_inicial
  AFTER INSERT ON vehiculos
  FOR EACH ROW EXECUTE FUNCTION vehiculo_km_inicial();


-- ════════════════════════════════════════════════════════════════════════════
-- 5. LA PROYECCION USA LA FICHA COMO RESPALDO
-- ----------------------------------------------------------------------------
-- Si por alguna razon un vehiculo tiene km_actual pero ninguna fila en el
-- odometro, la funcion de v24 devolvia 'BAJA' y sin datos. Ahora cae a la
-- ficha antes de rendirse.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION vehiculo_km_estimado(p_vehiculo_id BIGINT)
RETURNS TABLE (
  km_ultima_lectura  INT,
  fecha_ultima       DATE,
  km_por_mes         NUMERIC,
  dias_desde         INT,
  km_estimado_hoy    INT,
  confianza          VARCHAR
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_ult   RECORD;
  v_prev  RECORD;
  v_kmmes NUMERIC;
  v_conf  VARCHAR := 'BAJA';
  v_dias  INT;
  v_veh   RECORD;
BEGIN
  SELECT km, fecha INTO v_ult
  FROM vehiculo_odometro WHERE vehiculo_id = p_vehiculo_id
  ORDER BY fecha DESC, id DESC LIMIT 1;

  -- Sin historial: usar lo que diga la ficha del vehiculo
  IF v_ult IS NULL THEN
    SELECT km_actual, km_actual_fecha, km_promedio_mes INTO v_veh
    FROM vehiculos WHERE id = p_vehiculo_id;

    IF v_veh.km_actual IS NOT NULL THEN
      v_kmmes := COALESCE(v_veh.km_promedio_mes, 1250);
      v_dias  := CURRENT_DATE - COALESCE(v_veh.km_actual_fecha, CURRENT_DATE);
      RETURN QUERY SELECT
        v_veh.km_actual,
        COALESCE(v_veh.km_actual_fecha, CURRENT_DATE),
        v_kmmes,
        v_dias,
        (v_veh.km_actual + ROUND(v_kmmes * v_dias / 30.44))::INT,
        'MEDIA'::VARCHAR;
      RETURN;
    END IF;

    RETURN QUERY SELECT NULL::INT, NULL::DATE,
      COALESCE(v_veh.km_promedio_mes, 1250)::NUMERIC,
      NULL::INT, NULL::INT, 'BAJA'::VARCHAR;
    RETURN;
  END IF;

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

  IF v_kmmes < 100  THEN v_kmmes := 100;  END IF;
  IF v_kmmes > 8000 THEN v_kmmes := 8000; END IF;

  v_dias := CURRENT_DATE - v_ult.fecha;

  RETURN QUERY SELECT
    v_ult.km, v_ult.fecha, v_kmmes, v_dias,
    (v_ult.km + ROUND(v_kmmes * v_dias / 30.44))::INT,
    v_conf;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 6. COMPROBACION
-- ----------------------------------------------------------------------------
-- Cuantos vehiculos quedaron con kilometraje:
--
--   SELECT COUNT(*) FILTER (WHERE km_actual IS NOT NULL) AS con_km,
--          COUNT(*)                                      AS total
--   FROM vehiculos WHERE activo IS NOT FALSE;
--
-- Y los ultimos registrados:
--
--   SELECT placa, marca, modelo, km_actual, km_actual_fecha
--   FROM vehiculos WHERE km_actual IS NOT NULL
--   ORDER BY km_actual_fecha DESC LIMIT 10;
-- ============================================================================
