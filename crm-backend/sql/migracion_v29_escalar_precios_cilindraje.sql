-- ============================================================================
-- SOLIDO AUTO SERVICIO - Migracion v29
-- ESCALONAR LOS PRECIOS DE PLANES POR CILINDRAJE
-- ----------------------------------------------------------------------------
-- QUE RESUELVE
--   `plan_precios` tenia el MISMO precio para 4, 6 y 8 cilindros:
--
--     Plan basico cambio de aceite | 4 | 980 | 10780
--     Plan basico cambio de aceite | 6 | 980 | 10780   <-- igual
--     Plan basico cambio de aceite | 8 | 980 | 10780   <-- igual
--
--   Un V8 consume 7 cuartos de aceite y un L4 consume 4.5, asi que cobrarles
--   lo mismo regala dinero en cada V6/V8. La migracion v27 no lo corrigio
--   porque corrio con `p_sobrescribir = FALSE` y respeto las filas existentes
--   ("ya existia, no se toco").
--
-- QUE HACE
--   Conserva TU precio comercial de 4 cilindros y escala 6 y 8 en la misma
--   proporcion en que sube el valor real del servicio:
--
--     precio_6 = precio_4 x (valor_ano_6 / valor_ano_4)
--
--   Resultado esperado con tus datos actuales:
--
--     Plan basico cambio de aceite   980 -> 1120 -> 1310
--     Plan Basico                    980 -> 1060 -> 1180
--     Plan Premium                   980 -> 1100 -> 1260
--     Plan VIP                      1970 -> 2110 -> 2300
--     Plan Lavado                   1970 -> 1970 -> 1970   (no depende del motor)
--
--   El precio anual mantiene tu convencion actual: 11 meses (el mes 12 va de
--   regalo por pagar adelantado). 980 x 11 = 10780, que es lo que ya tenias.
--
-- SEGURIDAD
--   - NO toca el precio de 4 cilindros: ese lo decidiste tu.
--   - Es idempotente: siempre recalcula desde la base de 4 cil, asi que
--     correrlo dos veces da el mismo resultado.
--   - Deja respaldo en plan_precios_respaldo_v29 antes de tocar nada.
--   - Las membresias YA VENDIDAS no cambian: conservan el precio con el que
--     se firmaron. Esto solo afecta inscripciones y renovaciones nuevas.
--
-- Requiere v23 y v24. Ejecutar en Supabase -> SQL Editor.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- 0. RESPALDO — para poder volver atras si algo no gusta
-- ════════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS plan_precios_respaldo_v29;
CREATE TABLE plan_precios_respaldo_v29 AS SELECT * FROM plan_precios;

-- Para revertir:
--   UPDATE plan_precios p SET precio_mensual = r.precio_mensual,
--                             precio_anual   = r.precio_anual
--   FROM plan_precios_respaldo_v29 r
--   WHERE p.plan_id = r.plan_id AND p.cilindros = r.cilindros;


-- ════════════════════════════════════════════════════════════════════════════
-- 1. FUNCION: escalar 6 y 8 cilindros a partir del precio de 4
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION plan_escalar_precios_cilindraje(
  p_meses_anual INT DEFAULT 11   -- cuantos meses se cobran en el plan anual
)
RETURNS TABLE (
  plan            TEXT,
  cilindros       SMALLINT,
  valor_ano       NUMERIC,
  factor          NUMERIC,
  precio_mes_antes NUMERIC,
  precio_mes_ahora NUMERIC,
  precio_ano_ahora NUMERIC,
  nota            TEXT
)
-- La columna de salida `cilindros` choca con plan_precios.cilindros:
-- sin esto, PostgreSQL no sabe cual de las dos se refiere en el WHERE.
LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE
  p         RECORD;
  c         SMALLINT;
  ah        RECORD;
  v_val4    NUMERIC;
  v_base    NUMERIC;
  v_valc    NUMERIC;
  v_factor  NUMERIC;
  v_antes   NUMERIC;
  v_mes     NUMERIC;
  v_ano     NUMERIC;
BEGIN
  FOR p IN SELECT id, nombre FROM plan_catalogo WHERE activo ORDER BY orden
  LOOP
    -- Base: valor y precio de 4 cilindros
    SELECT * INTO ah FROM plan_calcular_ahorro(p.id, 4::SMALLINT, 'SEMISINTETICO');
    v_val4 := COALESCE(ah.valor_total_ano, 0);

    SELECT pp.precio_mensual INTO v_base
    FROM plan_precios pp WHERE pp.plan_id = p.id AND pp.cilindros = 4;

    IF v_base IS NULL OR v_base <= 0 THEN
      RETURN QUERY SELECT p.nombre::TEXT, 4::SMALLINT, v_val4, NULL::NUMERIC,
        v_base, NULL::NUMERIC, NULL::NUMERIC,
        'SALTADO: no hay precio de 4 cilindros que sirva de base'::TEXT;
      CONTINUE;
    END IF;

    IF v_val4 <= 0 THEN
      RETURN QUERY SELECT p.nombre::TEXT, 4::SMALLINT, v_val4, NULL::NUMERIC,
        v_base, NULL::NUMERIC, NULL::NUMERIC,
        'SALTADO: valor_ano de 4 cil es 0 — falta enlazar el aceite'::TEXT;
      CONTINUE;
    END IF;

    -- La fila de 4 cilindros se deja intacta, solo se reporta
    RETURN QUERY SELECT p.nombre::TEXT, 4::SMALLINT, v_val4, 1.0::NUMERIC,
      v_base, v_base, ROUND(v_base * p_meses_anual),
      'base — no se toca'::TEXT;

    -- 6 y 8 se escalan por la proporcion del valor real
    FOREACH c IN ARRAY ARRAY[6, 8]::SMALLINT[]
    LOOP
      SELECT * INTO ah FROM plan_calcular_ahorro(p.id, c, 'SEMISINTETICO');
      v_valc := COALESCE(ah.valor_total_ano, 0);

      SELECT pp.precio_mensual INTO v_antes
      FROM plan_precios pp WHERE pp.plan_id = p.id AND pp.cilindros = c;

      IF v_valc <= 0 THEN
        RETURN QUERY SELECT p.nombre::TEXT, c, v_valc, NULL::NUMERIC,
          v_antes, NULL::NUMERIC, NULL::NUMERIC,
          'SALTADO: valor_ano es 0 para este cilindraje'::TEXT;
        CONTINUE;
      END IF;

      v_factor := ROUND(v_valc / v_val4, 4);
      -- Redondeo a la decena para que quede una cifra presentable
      v_mes := ROUND(v_base * v_valc / v_val4 / 10) * 10;
      v_ano := ROUND(v_mes * p_meses_anual);

      INSERT INTO plan_precios (plan_id, cilindros, precio_mensual, precio_anual)
      VALUES (p.id, c, v_mes, v_ano)
      ON CONFLICT (plan_id, cilindros) DO UPDATE
        SET precio_mensual = EXCLUDED.precio_mensual,
            precio_anual   = EXCLUDED.precio_anual,
            updated_at     = NOW();

      RETURN QUERY SELECT p.nombre::TEXT, c, v_valc, v_factor,
        v_antes, v_mes, v_ano,
        CASE WHEN v_antes IS NULL THEN 'creado'
             WHEN v_antes = v_mes THEN 'sin cambio'
             ELSE 'actualizado' END::TEXT;
    END LOOP;
  END LOOP;
END $$;


-- Ejecutarlo ahora
SELECT * FROM plan_escalar_precios_cilindraje(11);


-- ════════════════════════════════════════════════════════════════════════════
-- 2. REPORTE DE MARGEN — ¿que planes dan perdida?
-- ----------------------------------------------------------------------------
-- Compara lo que COBRAS contra lo que te CUESTA servir el plan un ano
-- (aceite + filtro + mano de obra de cada mantenimiento, insumos de lavado).
--
-- Como leerlo:
--   margen_pct  > 40%  ✅ sano
--   margen_pct 20-40%  ⚠️ ajustado
--   margen_pct  < 20%  🔴 revisar
--   margen_pct  < 0    ❌ PERDIDA — cada cliente te cuesta dinero
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_plan_margen AS
SELECT
  pc.nombre                        AS plan,
  cil.cilindros,
  ah.valor_total_ano               AS valor_de_lo_incluido,
  pp.precio_anual                  AS cobras_al_ano,
  ah.costo_taller_ano              AS te_cuesta_al_ano,
  (pp.precio_anual - ah.costo_taller_ano) AS ganancia_ano,
  CASE WHEN pp.precio_anual > 0
       THEN ROUND((pp.precio_anual - ah.costo_taller_ano) / pp.precio_anual * 100, 1)
       ELSE NULL END               AS margen_pct,
  CASE
    WHEN pp.precio_anual IS NULL                                   THEN '— sin tarifa'
    WHEN pp.precio_anual - ah.costo_taller_ano < 0                 THEN '❌ PERDIDA'
    WHEN pp.precio_anual = 0                                       THEN '— sin precio'
    WHEN (pp.precio_anual - ah.costo_taller_ano) / pp.precio_anual < 0.20 THEN '🔴 muy bajo'
    WHEN (pp.precio_anual - ah.costo_taller_ano) / pp.precio_anual < 0.40 THEN '⚠️ ajustado'
    ELSE '✅ sano'
  END                              AS estado,
  ROUND(ah.valor_total_ano - pp.precio_anual, 2) AS regalas_al_cliente
FROM plan_catalogo pc
CROSS JOIN (SELECT UNNEST(ARRAY[4,6,8]::SMALLINT[]) AS cilindros) cil
LEFT JOIN LATERAL plan_calcular_ahorro(pc.id, cil.cilindros, 'SEMISINTETICO') ah ON TRUE
LEFT JOIN plan_precios pp ON pp.plan_id = pc.id AND pp.cilindros = cil.cilindros
WHERE pc.activo
ORDER BY pc.orden, cil.cilindros;


-- Mira esto despues de escalar los precios
SELECT * FROM v_plan_margen;


-- ════════════════════════════════════════════════════════════════════════════
-- 3. VERIFICACION — que los precios ya NO sean planos
-- ════════════════════════════════════════════════════════════════════════════

SELECT
  pc.nombre AS plan,
  COUNT(DISTINCT pp.precio_mensual) AS precios_distintos,
  MIN(pp.precio_mensual)            AS mas_barato,
  MAX(pp.precio_mensual)            AS mas_caro,
  CASE WHEN COUNT(DISTINCT pp.precio_mensual) = 1
       THEN '⚠️ sigue plano — revisa si el valor varia por cilindraje'
       ELSE '✅ escalonado' END      AS estado
FROM plan_catalogo pc
JOIN plan_precios pp ON pp.plan_id = pc.id
WHERE pc.activo
GROUP BY pc.nombre, pc.orden
ORDER BY pc.orden;
