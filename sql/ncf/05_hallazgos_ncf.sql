-- =====================================================================
-- HALLAZGOS NCF - TALLER  (datos reales al 2026-07-20)
-- =====================================================================
--
-- ESTADO: 21 facturas, ids 25 a 45 SIN saltos.
--
-- BIEN:
--   - 0 duplicados
--   - formato valido en las 21 (B + tipo + 8 digitos)
--   - el unico B01 tiene RNC; todos los B02 sin RNC (correcto)
--   - ITBIS 18% consistente
--
-- MAL:
--   - 8 NCF consumidos sin factura asociada:
--       B01: 1
--       B02: 1, 3, 4, 10, 11, 12, 21
--   - factura id 45 con NCF B0200000027 y total = 0.00
--   - RNC guardado con guiones (130-85357-6); DGII lo pide sin guiones
--
-- CAUSA RAIZ:
--   Los ids 25-45 son contiguos => NO se borro ninguna factura.
--   Aun asi faltan NCF intermedios (entre id 31 y 32 faltan 3).
--   Conclusion: el contador de NCF avanza ANTES de que el insert
--   confirme. Si el guardado falla o el usuario cancela, el numero
--   se quema. Se arregla asignando el NCF dentro de la misma
--   transaccion del insert, con siguiente_ncf().
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Rastrear los comprobantes perdidos en las tablas de auditoria
-- ---------------------------------------------------------------------

select * from auditoria
where (to_jsonb(auditoria)::text ilike '%B02000000%'
    or to_jsonb(auditoria)::text ilike '%B01000000%'
    or to_jsonb(auditoria)::text ilike '%factura%')
order by 1 desc
limit 100;

select * from log_acciones
where to_jsonb(log_acciones)::text ilike '%factura%'
   or to_jsonb(log_acciones)::text ilike '%ncf%'
order by 1 desc
limit 100;

-- Buscar especificamente los numeros perdidos
select * from auditoria
where to_jsonb(auditoria)::text similar to
      '%(B0200000001|B0200000003|B0200000004|B0200000010|B0200000011|B0200000012|B0200000021|B0100000001)%';


-- ---------------------------------------------------------------------
-- 2. Confirmar el hueco de ids 1-24 (facturas de prueba borradas)
-- ---------------------------------------------------------------------

select
  min(id) as primer_id,
  max(id) as ultimo_id,
  count(*) as filas,
  max(id) - min(id) + 1 as rango,
  case when count(*) = max(id) - min(id) + 1
       then 'contiguo: no se borro nada en este rango'
       else 'HAY BORRADOS dentro del rango' end as diagnostico
from facturas;

select last_value as proximo_id_facturas
from facturas_id_seq;
-- Si last_value es 45 y el minimo es 25, los ids 1-24 se usaron y
-- se borraron. Ahi se fueron B0100000001 y B0200000001.


-- ---------------------------------------------------------------------
-- 3. Los estados en uso (hoy son inconsistentes)
-- Aparecen ACTIVA y PENDIENTE_COBRO. No existe ANULADA.
-- Sin un estado ANULADA no se puede reportar el Formato 608.
-- ---------------------------------------------------------------------

select estado, count(*) as facturas, min(created_at)::date as desde
from facturas
group by estado
order by 2 desc;


-- ---------------------------------------------------------------------
-- 4. CORRECCION: anular la factura en cero (id 45)
-- No se borra: se anula. Un NCF emitido nunca se elimina, se reporta
-- como anulado en el Formato 608.
-- ---------------------------------------------------------------------

-- update facturas
--    set estado = 'ANULADA',
--        notas  = coalesce(notas || ' | ', '') ||
--                 'Anulada 2026-07-20: emitida con total 0.00. Reportar en Formato 608.'
--  where id = 45;


-- ---------------------------------------------------------------------
-- 5. CORRECCION: normalizar RNC sin guiones (formato DGII 606/607)
-- ---------------------------------------------------------------------

-- Ver primero que se va a cambiar
select id, cliente_rnc, regexp_replace(cliente_rnc, '[^0-9]', '', 'g') as rnc_limpio
from facturas
where cliente_rnc is not null and cliente_rnc <> '';

select id, rnc, regexp_replace(rnc, '[^0-9]', '', 'g') as rnc_limpio
from clientes
where rnc is not null and rnc <> '';

-- Aplicar (descomentar tras revisar lo anterior)
-- update facturas set cliente_rnc = regexp_replace(cliente_rnc, '[^0-9]', '', 'g')
--  where cliente_rnc ~ '[^0-9]';
-- update clientes set rnc = regexp_replace(rnc, '[^0-9]', '', 'g')
--  where rnc ~ '[^0-9]';


-- ---------------------------------------------------------------------
-- 6. CARGA REAL DE ncf_config  (reemplaza el PASO 2 del script 04)
-- Valores derivados de los datos reales: ultimo B01 = 2, ultimo B02 = 27.
-- >>> COMPLETAR secuencia_hasta y fecha_vencimiento con tu autorizacion
-- >>> de la DGII. Sin esos dos datos la funcion no puede frenarte
-- >>> cuando te pases del rango.
-- ---------------------------------------------------------------------

-- insert into ncf_config
--   (tipo, prefijo, secuencia_desde, secuencia_actual, secuencia_hasta, fecha_vencimiento, descripcion)
-- values
--   ('B01', 'B01', 1,  2, NULL, NULL, 'Credito fiscal - taller'),
--   ('B02', 'B02', 1, 27, NULL, NULL, 'Consumo - taller')
-- on conflict do nothing;


-- ---------------------------------------------------------------------
-- 7. Vigilancia continua: huecos en la secuencia
-- Correr una vez al mes. Todo lo que aparezca aqui va al Formato 608.
-- ---------------------------------------------------------------------

create or replace view v_ncf_faltantes as
with rangos as (
  select
    substring(ncf from 1 for 3)          as tipo,
    min(substring(ncf from 4)::int)      as desde,
    max(substring(ncf from 4)::int)      as hasta
  from facturas
  where ncf ~ '^B[0-9]{10}$'
  group by 1
),
esperados as (
  select r.tipo, generate_series(r.desde, r.hasta) as sec
  from rangos r
)
select
  e.tipo,
  e.tipo || lpad(e.sec::text, 8, '0') as ncf_faltante
from esperados e
where not exists (
  select 1 from facturas f
  where f.ncf = e.tipo || lpad(e.sec::text, 8, '0')
)
order by 1, 2;

comment on view v_ncf_faltantes is
  'NCF consumidos sin factura asociada. Todo lo que salga aqui debe reportarse como anulado en el Formato 608 de la DGII.';

select * from v_ncf_faltantes;
-- Esperado hoy: B0100000001 y B02 numeros 1,3,4,10,11,12,21.


-- =====================================================================
-- ACCIONES, EN ORDEN
--
--  1. Reportar los 8 NCF faltantes como anulados (Formato 608).
--  2. Anular la factura id 45 (total 0.00) y reportarla tambien.
--  3. Normalizar RNC sin guiones.
--  4. Cargar ncf_config con B01=2 y B02=27 + tu rango autorizado.
--  5. Cambiar el codigo: asignar el NCF con siguiente_ncf() DENTRO de
--     la transaccion del insert. Esta es la correccion de fondo:
--     elimina la causa de los huecos.
--  6. Aplicar el script 04 (indice UNIQUE + checks de formato).
--  7. Agregar el estado ANULADA al flujo. Hoy no existe.
--  8. Definir el plan de e-CF segun la clasificacion del RNC.
-- =====================================================================
