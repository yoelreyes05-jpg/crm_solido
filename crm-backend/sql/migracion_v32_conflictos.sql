-- ═════════════════════════════════════════════════════════════════════════
-- ANULADO — NO CORRER ESTE ARCHIVO
--
-- Este script renombraba las tablas `asa_*` para dejarle el nombre libre al
-- modulo de flota. Se escribio dando por hecho que el prefijo `asa_` estaba
-- libre. NO LO ESTA: son las 42 tablas del ERP de ASA (plagas/IPM, fichas
-- clinicas, mascotas, estetica, POS, nomina, contabilidad). Correrlo le
-- desarmaria ese sistema.
--
-- La solucion correcta fue la contraria: el modulo de flota se movio a su
-- propio prefijo `asa_flota_` y no toca nada del ERP.
--
-- Se deja el archivo vacio a proposito, y no borrado, para que quede el
-- rastro de por que existio.
--
-- Correr: crm-backend/sql/migracion_v32_asa_flota.sql
-- ═════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  RAISE EXCEPTION 'Este script fue anulado. El prefijo asa_ es del ERP de ASA; el modulo de flota usa asa_flota_. Corre migracion_v32_asa_flota.sql.';
END $$;
