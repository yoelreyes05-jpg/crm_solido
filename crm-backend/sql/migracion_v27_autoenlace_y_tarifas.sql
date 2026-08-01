-- ============================================================================
-- SOLIDO AUTO SERVICIO - Migracion v27
-- AUTO-ENLACE DE ACEITES + TARIFAS POR CILINDRAJE
-- ----------------------------------------------------------------------------
-- QUE RESUELVE
--   El cotizador no calculaba distinto para un V6 por dos razones:
--
--     1. `plan_motor_config` no tenia enlazados los aceites ni los filtros del
--        inventario, asi que el precio del aceite era 0 y todo daba 0.
--     2. `plan_precios` estaba vacia, asi que no habia tarifa por cilindraje.
--
--   Esta migracion resuelve las dos: busca los productos en TU inventario por
--   nombre, y siembra las 9 tarifas (3 planes x 3 cilindrajes).
--
-- IMPORTANTE
--   El auto-enlace acierta la mayoria de las veces, pero NO adivina. Al final
--   hay una consulta para revisar que eligio. Revisala antes de vender planes.
--
-- Es idempotente y NO pisa enlaces que ya hayas hecho a mano.
-- Requiere v23. Ejecutar en Supabase -> SQL Editor.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- 1. BUSCAR LOS ACEITES Y FILTROS EN EL INVENTARIO
-- ----------------------------------------------------------------------------
-- Estrategia, de lo mas especifico a lo mas general:
--   · aceite  -> nombre con "aceite" + la viscosidad exacta (5W-30, 0W-20…)
--                si no, "aceite" + el tipo (sintetico / semisintetico)
--                si no, cualquier "aceite" con precio y stock
--   · filtro  -> nombre con "filtro" + "aceite"
--
-- Solo llena lo que este en NULL: si ya enlazaste algo a mano, se respeta.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION plan_autoenlazar_inventario(
  p_sobrescribir BOOLEAN DEFAULT FALSE   -- TRUE = rehacer todos los enlaces
)
RETURNS TABLE (
  cilindros    SMALLINT,
  tipo_aceite  VARCHAR,
  aceite       TEXT,
  filtro       TEXT,
  resultado    TEXT
)
LANGUAGE plpgsql AS $$
-- Los nombres de las columnas de salida (cilindros, tipo_aceite) coinciden con
-- columnas de plan_motor_config. Sin esta directiva, PostgreSQL no sabría a
-- cuál se refiere y abortaría con "column reference is ambiguous".
#variable_conflict use_column
DECLARE
  r          RECORD;
  v_aceite   INT;
  v_filtro   INT;
  v_visc     TEXT;
  v_nom_ac   TEXT;
  v_nom_fi   TEXT;
  v_msg      TEXT;
BEGIN
  FOR r IN SELECT mc.* FROM plan_motor_config mc
           WHERE mc.activo ORDER BY mc.cilindros, mc.tipo_aceite
  LOOP
    v_aceite := CASE WHEN p_sobrescribir THEN NULL ELSE r.aceite_item_id END;
    v_filtro := CASE WHEN p_sobrescribir THEN NULL ELSE r.filtro_item_id END;
    v_msg    := '';

    -- Viscosidad tipica del tipo de aceite, para afinar la busqueda
    v_visc := CASE r.tipo_aceite
                WHEN 'SINTETICO'     THEN '0W-20'
                WHEN 'SEMISINTETICO' THEN '5W-30'
                ELSE '20W-50'
              END;

    -- ── Aceite ───────────────────────────────────────────────────────────
    IF v_aceite IS NULL THEN
      -- 1er intento: aceite + viscosidad exacta (acepta "5W-30" y "5W30")
      SELECT id INTO v_aceite FROM inventario
      WHERE name ILIKE '%aceite%'
        AND (name ILIKE '%' || v_visc || '%'
             OR name ILIKE '%' || REPLACE(v_visc, '-', '') || '%')
        AND COALESCE(price, 0) > 0
      ORDER BY COALESCE(stock, 0) DESC, price
      LIMIT 1;

      IF v_aceite IS NOT NULL THEN
        v_msg := v_msg || 'aceite por viscosidad; ';
      ELSE
        -- 2do intento: aceite + tipo
        SELECT id INTO v_aceite FROM inventario
        WHERE name ILIKE '%aceite%'
          AND (
            (r.tipo_aceite = 'SINTETICO'     AND name ILIKE '%sintetic%' AND name NOT ILIKE '%semi%')
            OR (r.tipo_aceite = 'SEMISINTETICO' AND name ILIKE '%semi%')
            OR (r.tipo_aceite = 'MINERAL'    AND name ILIKE '%mineral%')
          )
          AND COALESCE(price, 0) > 0
        ORDER BY COALESCE(stock, 0) DESC, price
        LIMIT 1;

        IF v_aceite IS NOT NULL THEN
          v_msg := v_msg || 'aceite por tipo; ';
        ELSE
          -- 3er intento: cualquier aceite con precio
          SELECT id INTO v_aceite FROM inventario
          WHERE name ILIKE '%aceite%' AND COALESCE(price, 0) > 0
            AND name NOT ILIKE '%filtro%'          -- no confundir con el filtro
            AND name NOT ILIKE '%transmis%'        -- ni con aceite de caja
            AND name NOT ILIKE '%hidraul%'
            AND name NOT ILIKE '%freno%'
          ORDER BY COALESCE(stock, 0) DESC, price
          LIMIT 1;
          IF v_aceite IS NOT NULL THEN
            v_msg := v_msg || '⚠ aceite generico (revisar); ';
          END IF;
        END IF;
      END IF;
    ELSE
      v_msg := v_msg || 'aceite ya enlazado; ';
    END IF;

    -- ── Filtro de aceite ─────────────────────────────────────────────────
    IF v_filtro IS NULL THEN
      SELECT id INTO v_filtro FROM inventario
      WHERE name ILIKE '%filtro%' AND name ILIKE '%aceite%'
        AND COALESCE(price, 0) > 0
      ORDER BY COALESCE(stock, 0) DESC, price
      LIMIT 1;

      IF v_filtro IS NOT NULL THEN
        v_msg := v_msg || 'filtro encontrado';
      ELSE
        -- A veces se registra solo como "filtro de motor" o similar
        SELECT id INTO v_filtro FROM inventario
        WHERE name ILIKE '%filtro%'
          AND name NOT ILIKE '%aire%'
          AND name NOT ILIKE '%cabina%'
          AND name NOT ILIKE '%combustible%'
          AND name NOT ILIKE '%gasolina%'
          AND COALESCE(price, 0) > 0
        ORDER BY COALESCE(stock, 0) DESC, price
        LIMIT 1;
        v_msg := v_msg || COALESCE(
          CASE WHEN v_filtro IS NOT NULL THEN '⚠ filtro aproximado (revisar)' END,
          '❌ SIN FILTRO en inventario');
      END IF;
    ELSE
      v_msg := v_msg || 'filtro ya enlazado';
    END IF;

    UPDATE plan_motor_config
       SET aceite_item_id = v_aceite,
           filtro_item_id = v_filtro,
           updated_at     = NOW()
     WHERE id = r.id;

    SELECT name INTO v_nom_ac FROM inventario WHERE id = v_aceite;
    SELECT name INTO v_nom_fi FROM inventario WHERE id = v_filtro;

    RETURN QUERY SELECT
      r.cilindros::SMALLINT, r.tipo_aceite::VARCHAR,
      COALESCE(v_nom_ac, '❌ no encontrado')::TEXT,
      COALESCE(v_nom_fi, '❌ no encontrado')::TEXT,
      v_msg::TEXT;
  END LOOP;
END $$;


-- Ejecutarlo ahora (solo llena lo vacío)
SELECT * FROM plan_autoenlazar_inventario(FALSE);


-- ════════════════════════════════════════════════════════════════════════════
-- 2. SEMBRAR LAS TARIFAS POR CILINDRAJE
-- ----------------------------------------------------------------------------
-- Calcula el precio de cada plan para 4, 6 y 8 cilindros usando el valor real
-- de lo incluido, y lo guarda en `plan_precios`. A partir de ahi el cotizador
-- devuelve la tarifa fijada en vez de una sugerencia.
--
-- El precio mensual se redondea a la decena mas cercana para que quede una
-- cifra presentable (RD$1,240 en vez de RD$1,237.50).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION plan_generar_tarifas(
  p_margen_cliente NUMERIC DEFAULT 0.18,  -- 18% de ahorro para el cliente
  p_sobrescribir   BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  plan          TEXT,
  cilindros     SMALLINT,
  valor_ano     NUMERIC,
  precio_mes    NUMERIC,
  precio_ano    NUMERIC,
  ahorro_pct    NUMERIC,
  nota          TEXT
)
LANGUAGE plpgsql AS $$
-- Igual que arriba: la columna de salida `cilindros` choca con plan_precios.cilindros.
#variable_conflict use_column
DECLARE
  p     RECORD;
  c     SMALLINT;
  ah    RECORD;
  v_ano NUMERIC;
  v_mes NUMERIC;
  v_existe BOOLEAN;
BEGIN
  FOR p IN SELECT id, nombre FROM plan_catalogo WHERE activo ORDER BY orden
  LOOP
    FOREACH c IN ARRAY ARRAY[4, 6, 8]::SMALLINT[]
    LOOP
      SELECT * INTO ah FROM plan_calcular_ahorro(p.id, c, 'SEMISINTETICO');

      -- Columnas calificadas con el alias para que no se confundan con las
      -- variables de salida de la función.
      SELECT EXISTS(SELECT 1 FROM plan_precios pp2
                     WHERE pp2.plan_id = p.id AND pp2.cilindros = c)
        INTO v_existe;

      -- `plan_catalogo.nombre` es VARCHAR(100) y aquí se declara TEXT. En
      -- RETURN QUERY, PostgreSQL exige que los tipos coincidan exactamente,
      -- así que hay que castear — si no, aborta con "structure of query does
      -- not match function result type".
      IF v_existe AND NOT p_sobrescribir THEN
        RETURN QUERY SELECT p.nombre::TEXT, c, ah.valor_total_ano,
          (SELECT pp3.precio_mensual FROM plan_precios pp3 WHERE pp3.plan_id = p.id AND pp3.cilindros = c),
          (SELECT pp4.precio_anual   FROM plan_precios pp4 WHERE pp4.plan_id = p.id AND pp4.cilindros = c),
          NULL::NUMERIC, 'ya existía, no se tocó'::TEXT;
        CONTINUE;
      END IF;

      IF COALESCE(ah.valor_total_ano, 0) <= 0 THEN
        RETURN QUERY SELECT p.nombre::TEXT, c, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC,
          '❌ valor 0 — falta enlazar el aceite al inventario'::TEXT;
        CONTINUE;
      END IF;

      -- Mensual: valor de lo incluido menos el descuento, redondeado a la
      -- decena para que quede una cifra presentable (RD$1,240, no RD$1,237.50).
      v_mes := ROUND(ah.valor_total_ano * (1 - p_margen_cliente) / 12 / 10) * 10;

      -- Anual: se cobran 11 meses en vez de 12 — el mes 12 va de regalo por
      -- pagar por adelantado. OJO: eso hace que el ahorro real del plan anual
      -- suba a ~25%, no al 18% del mensual. El margen del taller aguanta
      -- (37-49% segun el plan), pero si prefieres no regalar el mes, cambia
      -- este 11 por 12.
      v_ano := ROUND(v_mes * 11);

      INSERT INTO plan_precios (plan_id, cilindros, precio_mensual, precio_anual)
      VALUES (p.id, c, v_mes, v_ano)
      ON CONFLICT (plan_id, cilindros) DO UPDATE
        SET precio_mensual = EXCLUDED.precio_mensual,
            precio_anual   = EXCLUDED.precio_anual,
            updated_at     = NOW();

      RETURN QUERY SELECT p.nombre::TEXT, c, ah.valor_total_ano, v_mes, v_ano,
        ROUND((ah.valor_total_ano - v_ano) / ah.valor_total_ano * 100, 1),
        'tarifa generada'::TEXT;
    END LOOP;
  END LOOP;
END $$;


-- Generar las tarifas ahora
SELECT * FROM plan_generar_tarifas(0.18, FALSE);


-- ════════════════════════════════════════════════════════════════════════════
-- 3. REVISION — mira esto antes de vender un plan
-- ════════════════════════════════════════════════════════════════════════════

-- 3.1 ¿Que aceite y filtro quedo en cada configuracion?
CREATE OR REPLACE VIEW v_plan_motor_revision AS
SELECT
  mc.cilindros,
  mc.tipo_aceite,
  mc.cuartos,
  ac.name                       AS aceite,
  ac.price                      AS precio_cuarto,
  ac.stock                      AS stock_aceite,
  fi.name                       AS filtro,
  fi.price                      AS precio_filtro,
  mc.mano_obra,
  ROUND(mc.cuartos * COALESCE(ac.price,0) + COALESCE(fi.price,0) + mc.mano_obra, 2) AS precio_servicio,
  CASE
    WHEN mc.aceite_item_id IS NULL THEN '❌ falta enlazar el aceite'
    WHEN mc.filtro_item_id IS NULL THEN '⚠️ falta enlazar el filtro'
    WHEN COALESCE(ac.stock,0) < mc.cuartos THEN '⚠️ stock de aceite bajo'
    ELSE '✅ listo'
  END AS estado
FROM plan_motor_config mc
LEFT JOIN inventario ac ON ac.id = mc.aceite_item_id
LEFT JOIN inventario fi ON fi.id = mc.filtro_item_id
WHERE mc.activo
ORDER BY mc.cilindros, mc.tipo_aceite;

-- 3.2 Tabla comparativa de tarifas: la que le enseñas al cliente
CREATE OR REPLACE VIEW v_tarifas_planes AS
SELECT
  pc.nombre                                   AS plan,
  pc.emoji,
  pp.cilindros,
  pp.precio_mensual,
  pp.precio_anual,
  COALESCE(MAX(CASE WHEN pb.tipo='mantenimientos_ano' THEN pb.valor END), 0) AS mantenimientos_ano,
  COALESCE(MAX(CASE WHEN pb.tipo='lavados_mes'        THEN pb.valor END), 0) AS lavados_mes,
  COALESCE(MAX(CASE WHEN pb.tipo='desc_servicios'     THEN pb.valor END), 0) AS desc_servicios
FROM plan_precios pp
JOIN plan_catalogo pc  ON pc.id = pp.plan_id
LEFT JOIN plan_beneficios pb ON pb.plan_id = pp.plan_id
WHERE pc.activo
GROUP BY pc.nombre, pc.emoji, pc.orden, pp.cilindros, pp.precio_mensual, pp.precio_anual
ORDER BY pc.orden, pp.cilindros;


-- ════════════════════════════════════════════════════════════════════════════
-- 4. QUE HACER DESPUES
-- ----------------------------------------------------------------------------
--   SELECT * FROM v_plan_motor_revision;   -- ¿el aceite elegido es el correcto?
--   SELECT * FROM v_tarifas_planes;        -- ¿las tarifas te cuadran?
--
-- Si el auto-enlace eligio mal un producto, corrigelo a mano:
--   SELECT id, name, price, stock FROM inventario WHERE name ILIKE '%aceite%';
--   UPDATE plan_motor_config SET aceite_item_id = <id correcto>
--    WHERE cilindros = 6 AND tipo_aceite = 'SEMISINTETICO';
--
-- Y vuelve a generar las tarifas sobrescribiendo:
--   SELECT * FROM plan_generar_tarifas(0.18, TRUE);
--
-- Si quieres ajustar una tarifa puntual a mano:
--   UPDATE plan_precios SET precio_mensual = 1500, precio_anual = 16500
--    WHERE plan_id = 3 AND cilindros = 6;
-- ============================================================================
