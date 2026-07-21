-- =====================================================================
-- DIAGNOSTICO DE NCF - TALLER
-- Fecha: 2026-07-20
--
-- 100% READ-ONLY. No modifica nada. Seguro de correr en produccion.
--
-- Objetivo: determinar de donde salen los NCF de `facturas` y detectar
-- errores antes de que se conviertan en un problema con la DGII.
--
-- Contexto: ncf_config tiene 0 filas pero facturas (21) tiene columnas
-- ncf, ncf_tipo y ncf_vence. Algo esta llenando esos campos desde otro
-- lado, o se teclean a mano.
--
-- Correr las 10 consultas y pasar TODOS los resultados.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. LOS DATOS CRUDOS: que hay realmente en las 21 facturas
-- ---------------------------------------------------------------------
select
  id,
  ncf,
  ncf_tipo,
  ncf_vence,
  estado,
  cliente_rnc,
  total,
  created_at::date as fecha
from facturas
order by id;


-- ---------------------------------------------------------------------
-- 2. DE DONDE SALEN: hay algo automatico generandolos?
-- ---------------------------------------------------------------------

-- 2a. Default de columna (si dice nextval, hay una secuencia detras)
select column_name, column_default, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'facturas'
  and column_name in ('ncf','ncf_tipo','ncf_vence');

-- 2b. Triggers sobre facturas
select
  t.tgname       as trigger_name,
  p.proname      as funcion,
  pg_get_triggerdef(t.oid) as definicion
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc  p on p.oid = t.tgfoid
where c.relname = 'facturas'
  and not t.tgisinternal;

-- 2c. Funciones que mencionan NCF en cualquier parte del schema
select
  p.proname as funcion,
  pg_get_functiondef(p.oid) as codigo
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and pg_get_functiondef(p.oid) ilike '%ncf%';

-- 2d. Secuencias nativas de Postgres relacionadas a NCF
select sequence_name
from information_schema.sequences
where sequence_schema = 'public'
  and sequence_name ilike '%ncf%';

-- >>> Si 2a, 2b, 2c y 2d salen todos vacios: los NCF se escriben desde
-- >>> el frontend o se teclean a mano. Ese es el peor escenario, porque
-- >>> no hay nada que garantice que no se repitan.


-- ---------------------------------------------------------------------
-- 3. ERROR CRITICO: NCF duplicados
-- Un NCF repetido es una infraccion. Dos facturas no pueden compartirlo.
-- ---------------------------------------------------------------------
-- 3a. Vista completa (usa funcion de ventana, no aggregate: compatible
--     con el editor de Supabase, que envuelve las consultas).
select
  id,
  ncf,
  ncf_tipo,
  estado,
  cliente_rnc,
  total,
  created_at::date as fecha,
  count(*) over (partition by ncf) as veces_repetido
from facturas
where ncf is not null and ncf <> ''
order by veces_repetido desc, ncf, id;
-- veces_repetido = 1 esta bien. 2 o mas = NCF DUPLICADO, corregir antes
-- de aplicar el indice UNIQUE del script 04.

-- 3b. Solo la lista de duplicados.
select ncf, count(*) as veces
from facturas
where ncf is not null and ncf <> ''
group by ncf
having count(*) > 1;
-- Resultado esperado: 0 filas.


-- ---------------------------------------------------------------------
-- 4. ERROR: formato invalido
-- NCF tradicional: B + 2 digitos tipo + 8 digitos secuencia = 11 chars
-- e-CF (Ley 32-23): E + 2 digitos tipo + 10 digitos = 13 chars
-- ---------------------------------------------------------------------
select
  id,
  ncf,
  length(ncf) as largo,
  case
    when ncf is null or ncf = ''            then 'SIN NCF'
    when ncf ~ '^B[0-9]{10}$'               then 'OK - NCF tradicional'
    when ncf ~ '^E[0-9]{12}$'               then 'OK - e-CF'
    else                                         'FORMATO INVALIDO'
  end as diagnostico
from facturas
order by 4 desc, id;


-- ---------------------------------------------------------------------
-- 5. ERROR: tipo de NCF incoherente con el cliente
-- B01 (credito fiscal) EXIGE el RNC del cliente.
-- B02 (consumo) es para consumidor final.
-- ---------------------------------------------------------------------
select
  f.id,
  f.ncf,
  f.ncf_tipo,
  f.cliente_rnc,
  c.rnc as rnc_en_maestro,
  f.total,
  case
    when f.ncf like 'B01%' and coalesce(nullif(f.cliente_rnc,''), c.rnc) is null
      then 'ERROR: B01 sin RNC del cliente'
    when f.ncf like 'B02%' and f.total > 250000
      then 'REVISAR: consumo por monto alto, la DGII exige identificar al comprador'
    when f.ncf_tipo is not null
         and f.ncf is not null
         and substring(f.ncf from 1 for 3) <> f.ncf_tipo
      then 'ERROR: ncf_tipo no coincide con el prefijo del ncf'
    else 'ok'
  end as diagnostico
from facturas f
left join clientes c on c.id = f.cliente_id
order by 7 desc, f.id;


-- ---------------------------------------------------------------------
-- 6. ERROR: NCF vencido al momento de emitir
-- No se puede usar un comprobante despues de su fecha de vencimiento.
-- ---------------------------------------------------------------------
select
  id, ncf, ncf_vence, created_at::date as fecha_emision,
  case
    when ncf_vence is null                    then 'SIN FECHA DE VENCIMIENTO'
    when ncf_vence < created_at::date         then 'ERROR: emitido con NCF vencido'
    when ncf_vence < current_date             then 'AVISO: autorizacion ya vencida'
    when ncf_vence < current_date + 60        then 'AVISO: vence en menos de 60 dias'
    else 'ok'
  end as diagnostico
from facturas
order by ncf_vence nulls first;


-- ---------------------------------------------------------------------
-- 7. Secuencia: saltos y orden
-- Los NCF deben consumirse consecutivos. Un salto grande puede indicar
-- comprobantes emitidos fuera del sistema o perdidos.
-- ---------------------------------------------------------------------
select
  substring(ncf from 1 for 3)                    as tipo,
  substring(ncf from 4)::bigint                  as secuencia,
  id,
  created_at::date,
  substring(ncf from 4)::bigint
    - lag(substring(ncf from 4)::bigint)
        over (partition by substring(ncf from 1 for 3)
              order by substring(ncf from 4)::bigint) as salto
from facturas
where ncf ~ '^B[0-9]{10}$'
order by 1, 2;
-- salto = 1 es lo correcto. Mayor que 1 = comprobantes sin registrar.


-- ---------------------------------------------------------------------
-- 8. ERROR: facturas anuladas y su NCF
-- Un NCF anulado NO se reutiliza: se reporta como anulado a la DGII.
-- ---------------------------------------------------------------------
select estado, count(*) as facturas, count(ncf) as con_ncf
from facturas
group by estado
order by 1;


-- ---------------------------------------------------------------------
-- 9. RIESGO CRUZADO: Gelatilandia comparte rango con el taller?
-- Si ambos negocios facturan bajo el MISMO RNC y usan los mismos
-- rangos autorizados, se estan generando NCF duplicados ante la DGII.
-- ---------------------------------------------------------------------
select * from ul_secuencias_ncf;
-- Comparar los rangos y prefijos de aqui contra los NCF del query 1.
-- Si se solapan Y el RNC emisor es el mismo: problema serio.
-- Si Gelatilandia tiene RNC propio: no hay conflicto.


-- ---------------------------------------------------------------------
-- 10. Que protecciones existen hoy (probablemente ninguna)
-- ---------------------------------------------------------------------
select
  i.indexname,
  i.indexdef
from pg_indexes i
where i.schemaname = 'public'
  and i.tablename = 'facturas';

select
  con.conname,
  pg_get_constraintdef(con.oid) as definicion
from pg_constraint con
join pg_class c on c.oid = con.conrelid
where c.relname = 'facturas';
-- >>> Si NO aparece un indice UNIQUE sobre ncf, hoy nada impide que
-- >>> se repita un comprobante. El script 04 lo corrige.


-- =====================================================================
-- BUSQUEDA EN EL CODIGO (fuera de SQL)
--
--   grep -rn "ncf" src/ --include=*.js --include=*.jsx \
--                      --include=*.ts --include=*.tsx --include=*.mjs
--
-- Buscar especificamente: donde se arma el string del NCF, si hay un
-- contador en el frontend, y si dos usuarios simultaneos pueden obtener
-- el mismo numero (condicion de carrera).
-- =====================================================================
