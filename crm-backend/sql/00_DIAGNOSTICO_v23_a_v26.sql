-- ============================================================================
-- DIAGNOSTICO — ¿estan aplicadas las migraciones v23 a v26?
-- ----------------------------------------------------------------------------
-- Ejecuta este archivo en el SQL Editor de Supabase. No modifica nada.
-- Te dice exactamente que falta y en que orden ejecutarlo.
--
-- SI EL KILOMETRAJE NO SE GUARDA, la causa casi siempre es que la columna
-- `vehiculos.km_actual` todavia no existe. El backend intenta escribirla, la
-- base de datos rechaza el INSERT completo, y no se guarda nada.
-- ============================================================================


-- ── 1. RESUMEN: que migraciones faltan ──────────────────────────────────────
WITH req(migracion, objeto, tipo, existe) AS (
  VALUES
    ('v23', 'vehiculos.cilindros',        'columna',
      (SELECT COUNT(*) > 0 FROM information_schema.columns
        WHERE table_name='vehiculos' AND column_name='cilindros')),
    ('v23', 'vehiculos.tipo_aceite',      'columna',
      (SELECT COUNT(*) > 0 FROM information_schema.columns
        WHERE table_name='vehiculos' AND column_name='tipo_aceite')),
    ('v23', 'plan_motor_config',          'tabla',    (to_regclass('public.plan_motor_config')       IS NOT NULL)),
    ('v23', 'plan_beneficio_tipos',       'tabla',    (to_regclass('public.plan_beneficio_tipos')    IS NOT NULL)),
    ('v23', 'plan_precios',               'tabla',    (to_regclass('public.plan_precios')            IS NOT NULL)),
    ('v23', 'plan_calcular_ahorro',       'funcion',
      (SELECT COUNT(*) > 0 FROM pg_proc WHERE proname='plan_calcular_ahorro')),

    ('v24', 'vehiculo_odometro',          'tabla',    (to_regclass('public.vehiculo_odometro')       IS NOT NULL)),
    ('v24', 'vehiculo_km_estimado',       'funcion',
      (SELECT COUNT(*) > 0 FROM pg_proc WHERE proname='vehiculo_km_estimado')),
    ('v24', 'plan_cotizar_membresia',     'funcion',
      (SELECT COUNT(*) > 0 FROM pg_proc WHERE proname='plan_cotizar_membresia')),
    ('v24', 'v_alertas_mantenimiento_km', 'vista',    (to_regclass('public.v_alertas_mantenimiento_km') IS NOT NULL)),

    ('v25', 'vehiculo_spec_servicio',     'tabla',    (to_regclass('public.vehiculo_spec_servicio')  IS NOT NULL)),
    ('v25', 'vehiculos.cuartos_aceite',   'columna',
      (SELECT COUNT(*) > 0 FROM information_schema.columns
        WHERE table_name='vehiculos' AND column_name='cuartos_aceite')),
    ('v25', 'vehiculo_sugerir_spec',      'funcion',
      (SELECT COUNT(*) > 0 FROM pg_proc WHERE proname='vehiculo_sugerir_spec')),
    ('v25', 'v_spec_cobertura',           'vista',    (to_regclass('public.v_spec_cobertura')        IS NOT NULL)),

    ('v26', 'vehiculos.km_actual',        'columna',
      (SELECT COUNT(*) > 0 FROM information_schema.columns
        WHERE table_name='vehiculos' AND column_name='km_actual')),
    ('v26', 'vehiculos.km_actual_fecha',  'columna',
      (SELECT COUNT(*) > 0 FROM information_schema.columns
        WHERE table_name='vehiculos' AND column_name='km_actual_fecha')),
    ('v26', 'trg_vehiculo_sincronizar_km','trigger',
      (SELECT COUNT(*) > 0 FROM pg_trigger WHERE tgname='trg_vehiculo_sincronizar_km'))
)
SELECT
  migracion,
  COUNT(*)                                  AS objetos,
  COUNT(*) FILTER (WHERE existe)            AS presentes,
  COUNT(*) FILTER (WHERE NOT existe)        AS faltan,
  CASE WHEN COUNT(*) FILTER (WHERE NOT existe) = 0
       THEN '✅ APLICADA'
       ELSE '❌ FALTA EJECUTAR'
  END                                       AS estado
FROM req
GROUP BY migracion
ORDER BY migracion;


-- ── 2. DETALLE: exactamente que objeto falta ────────────────────────────────
WITH req(migracion, objeto, tipo, existe) AS (
  VALUES
    ('v23', 'vehiculos.cilindros', 'columna',
      (SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name='vehiculos' AND column_name='cilindros')),
    ('v23', 'vehiculos.tipo_aceite', 'columna',
      (SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name='vehiculos' AND column_name='tipo_aceite')),
    ('v23', 'plan_motor_config', 'tabla',    (to_regclass('public.plan_motor_config')       IS NOT NULL)),
    ('v23', 'plan_beneficio_tipos', 'tabla', (to_regclass('public.plan_beneficio_tipos')    IS NOT NULL)),
    ('v23', 'plan_precios', 'tabla',         (to_regclass('public.plan_precios')            IS NOT NULL)),
    ('v23', 'plan_calcular_ahorro', 'funcion',
      (SELECT COUNT(*) > 0 FROM pg_proc WHERE proname='plan_calcular_ahorro')),
    ('v24', 'vehiculo_odometro', 'tabla',    (to_regclass('public.vehiculo_odometro')       IS NOT NULL)),
    ('v24', 'vehiculo_km_estimado', 'funcion',
      (SELECT COUNT(*) > 0 FROM pg_proc WHERE proname='vehiculo_km_estimado')),
    ('v24', 'plan_cotizar_membresia', 'funcion',
      (SELECT COUNT(*) > 0 FROM pg_proc WHERE proname='plan_cotizar_membresia')),
    ('v24', 'v_alertas_mantenimiento_km', 'vista', (to_regclass('public.v_alertas_mantenimiento_km') IS NOT NULL)),
    ('v25', 'vehiculo_spec_servicio', 'tabla', (to_regclass('public.vehiculo_spec_servicio') IS NOT NULL)),
    ('v25', 'vehiculos.cuartos_aceite', 'columna',
      (SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name='vehiculos' AND column_name='cuartos_aceite')),
    ('v25', 'vehiculo_sugerir_spec', 'funcion',
      (SELECT COUNT(*) > 0 FROM pg_proc WHERE proname='vehiculo_sugerir_spec')),
    ('v25', 'v_spec_cobertura', 'vista',     (to_regclass('public.v_spec_cobertura')        IS NOT NULL)),
    ('v26', 'vehiculos.km_actual', 'columna',
      (SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name='vehiculos' AND column_name='km_actual')),
    ('v26', 'vehiculos.km_actual_fecha', 'columna',
      (SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name='vehiculos' AND column_name='km_actual_fecha')),
    ('v26', 'trg_vehiculo_sincronizar_km', 'trigger',
      (SELECT COUNT(*) > 0 FROM pg_trigger WHERE tgname='trg_vehiculo_sincronizar_km'))
)
SELECT migracion, tipo, objeto,
       CASE WHEN existe THEN '✅ existe' ELSE '❌ FALTA' END AS estado
FROM req
ORDER BY existe, migracion, tipo, objeto;


-- ── 3. Columnas que la tabla `vehiculos` tiene HOY ──────────────────────────
-- Si aqui no aparecen km_actual, cilindros ni cuartos_aceite, ese es el motivo
-- por el que el kilometraje no se guarda.
SELECT column_name AS columna, data_type AS tipo
FROM information_schema.columns
WHERE table_name = 'vehiculos'
ORDER BY ordinal_position;


-- ── 4. ¿Hay kilometraje guardado? ───────────────────────────────────────────
-- Solo corre si ya aplicaste v24 y v26; si no, dara error de columna y eso
-- mismo confirma el diagnostico.
SELECT
  (SELECT COUNT(*) FROM vehiculo_odometro)                                      AS lecturas_en_historial,
  (SELECT COUNT(*) FROM vehiculos WHERE km_actual IS NOT NULL)                  AS vehiculos_con_km,
  (SELECT COUNT(*) FROM vehiculos WHERE activo IS NOT FALSE)                    AS vehiculos_totales;


-- ============================================================================
-- ORDEN DE EJECUCION (si algo salio como FALTA)
--   1. migracion_v23_planes_mantenimiento.sql
--   2. migracion_v24_kilometraje_y_cotizador.sql
--   3. migracion_v25_especificaciones_servicio.sql
--   4. migracion_v26_km_en_ficha_vehiculo.sql
-- Cada una depende de la anterior. Vuelve a correr este diagnostico al final:
-- las cuatro deben decir ✅ APLICADA.
-- ============================================================================
