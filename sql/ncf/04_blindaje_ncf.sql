-- =====================================================================
-- BLINDAJE DE NCF - TALLER
-- Fecha: 2026-07-20
--
-- CORRER DESPUES DEL SCRIPT 03 Y DE RESOLVER LO QUE ENCUENTRE.
--
-- Que hace: convierte la emision de NCF en algo que el sistema controla
-- y no puede equivocarse, en vez de depender de que nadie se equivoque.
--
-- Aplica la regla de reciclar: `ncf_config` existe y esta VACIA (0 filas),
-- asi que se le agregan las columnas que le faltan en vez de crear una
-- tabla nueva. Riesgo cero, no hay datos que migrar.
--
-- ALCANCE: solo el taller. No toca ul_secuencias_ncf (Gelatilandia),
-- ni aloha_*, ni cafeteria_*, ni el CRM clinico.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PASO 1 - Completar ncf_config (tabla vacia, se puede alterar libre)
-- Hoy tiene: id, tipo, secuencia_actual, prefijo
-- Le falta todo lo que exige el control de una autorizacion DGII.
-- ---------------------------------------------------------------------

alter table ncf_config
  add column if not exists secuencia_desde   integer     not null default 1,
  add column if not exists secuencia_hasta   integer,
  add column if not exists fecha_vencimiento date,
  add column if not exists activo            boolean     not null default true,
  add column if not exists descripcion       text,
  add column if not exists actualizado_en    timestamptz not null default now();

comment on table ncf_config is
  '[ACTIVA] Control de secuencias NCF del TALLER. Reciclada (estaba en 0 filas) en vez de crear tabla nueva. NO confundir con ul_secuencias_ncf, que es de Gelatilandia y es independiente.';

comment on column ncf_config.secuencia_desde   is 'Inicio del rango autorizado por la DGII.';
comment on column ncf_config.secuencia_hasta   is 'Fin del rango autorizado. La funcion se niega a pasar de aqui.';
comment on column ncf_config.fecha_vencimiento is 'Vencimiento de la autorizacion. No se emite despues de esta fecha.';
comment on column ncf_config.activo            is 'Permite retirar un rango agotado sin borrarlo.';

-- Un solo rango activo por tipo de comprobante
create unique index if not exists ux_ncf_config_tipo_activo
  on ncf_config (tipo) where activo;


-- ---------------------------------------------------------------------
-- PASO 2 - Cargar tus rangos reales
-- >>> EDITAR con los datos de tu autorizacion en la DGII antes de correr.
-- >>> Los valores de abajo son ejemplos, NO son tus rangos.
-- ---------------------------------------------------------------------

-- insert into ncf_config (tipo, prefijo, secuencia_desde, secuencia_actual, secuencia_hasta, fecha_vencimiento, descripcion)
-- values
--   ('B01', 'B01', 1, 0, 50, '2026-12-31', 'Credito fiscal - taller'),
--   ('B02', 'B02', 1, 0, 200, '2026-12-31', 'Consumo - taller'),
--   ('B04', 'B04', 1, 0, 50, '2026-12-31', 'Nota de credito - taller');

-- IMPORTANTE: secuencia_actual debe arrancar en el ultimo NCF YA EMITIDO
-- segun el query 1 del script 03. Si arranca en 0 y ya emitiste el
-- B0200000005, la funcion volveria a generar numeros ya usados.


-- ---------------------------------------------------------------------
-- PASO 3 - Emision atomica
-- Resuelve la condicion de carrera: si dos usuarios facturan en el mismo
-- segundo, un UPDATE...RETURNING garantiza que reciban numeros distintos.
-- Un contador en el frontend NO garantiza eso.
-- ---------------------------------------------------------------------

create or replace function siguiente_ncf(p_tipo varchar)
returns table (ncf varchar, ncf_tipo varchar, ncf_vence date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sec     integer;
  v_hasta   integer;
  v_prefijo varchar;
  v_vence   date;
begin
  -- El UPDATE bloquea la fila: dos llamadas concurrentes se serializan.
  update ncf_config
     set secuencia_actual = secuencia_actual + 1,
         actualizado_en   = now()
   where tipo = p_tipo
     and activo
  returning secuencia_actual, secuencia_hasta, prefijo, fecha_vencimiento
       into v_sec, v_hasta, v_prefijo, v_vence;

  if not found then
    raise exception 'No hay rango activo de NCF para el tipo %', p_tipo
      using hint = 'Revisar ncf_config: falta el rango o esta marcado inactivo.';
  end if;

  if v_hasta is not null and v_sec > v_hasta then
    -- Se revierte el consumo para no quemar un numero inexistente.
    update ncf_config
       set secuencia_actual = secuencia_actual - 1,
           activo = false
     where tipo = p_tipo;
    raise exception 'Rango de NCF % agotado (limite %). Solicitar nueva autorizacion a la DGII.', p_tipo, v_hasta;
  end if;

  if v_vence is not null and v_vence < current_date then
    update ncf_config set secuencia_actual = secuencia_actual - 1 where tipo = p_tipo;
    raise exception 'La autorizacion de NCF % vencio el %.', p_tipo, v_vence;
  end if;

  return query select
    (v_prefijo || lpad(v_sec::text, 8, '0'))::varchar,
    p_tipo,
    v_vence;
end;
$$;

comment on function siguiente_ncf(varchar) is
  'Emite el siguiente NCF del taller de forma atomica. Valida rango agotado y autorizacion vencida. NO usar para Gelatilandia (ul_secuencias_ncf).';


-- ---------------------------------------------------------------------
-- PASO 4 - Tipo de comprobante automatico
-- Le quita la decision a la secretaria: con RNC va B01, sin RNC va B02.
-- Menos clics y menos errores de clasificacion ante la DGII.
-- ---------------------------------------------------------------------

create or replace function tipo_ncf_para_cliente(p_cliente_id integer)
returns varchar
language sql
stable
as $$
  select case
           when coalesce(nullif(trim(c.rnc), ''), null) is not null then 'B01'
           else 'B02'
         end
  from clientes c
  where c.id = p_cliente_id;
$$;

comment on function tipo_ncf_para_cliente(integer) is
  'Deriva el tipo de NCF del cliente. Con RNC -> B01 credito fiscal. Sin RNC -> B02 consumo.';


-- ---------------------------------------------------------------------
-- PASO 5 - Protecciones permanentes sobre facturas
--
-- OJO CON EL ORDEN: el indice UNIQUE falla si ya existen duplicados.
-- Resolver primero lo que reporte el query 3 del script 03.
-- ---------------------------------------------------------------------

-- 5a. Un NCF no se puede repetir jamas.
create unique index if not exists ux_facturas_ncf
  on facturas (ncf)
  where ncf is not null and ncf <> '';

-- 5b. Formato valido: NCF tradicional (11) o e-CF (13).
--     NOT VALID = protege las filas nuevas sin romper por las viejas.
alter table facturas
  drop constraint if exists ck_facturas_ncf_formato;

alter table facturas
  add constraint ck_facturas_ncf_formato
  check (
    ncf is null
    or ncf = ''
    or ncf ~ '^B[0-9]{10}$'    -- NCF tradicional
    or ncf ~ '^E[0-9]{12}$'    -- e-CF Ley 32-23
  ) not valid;

-- Cuando las 21 facturas viejas esten corregidas, activar del todo:
--   alter table facturas validate constraint ck_facturas_ncf_formato;

-- 5c. Coherencia entre ncf y ncf_tipo.
alter table facturas
  drop constraint if exists ck_facturas_ncf_tipo_coherente;

alter table facturas
  add constraint ck_facturas_ncf_tipo_coherente
  check (
    ncf is null or ncf = '' or ncf_tipo is null
    or substring(ncf from 1 for 3) = ncf_tipo
  ) not valid;


-- ---------------------------------------------------------------------
-- PASO 6 - Verificar
-- ---------------------------------------------------------------------

-- select * from siguiente_ncf('B02');   -- consume un numero de prueba
-- select * from ncf_config order by tipo;
-- Si la prueba consumio un numero real, devolverlo:
--   update ncf_config set secuencia_actual = secuencia_actual - 1 where tipo = 'B02';


-- =====================================================================
-- PENDIENTE: FACTURACION ELECTRONICA (Ley 32-23)
--
-- Este script blinda los NCF tradicionales (serie B). NO implementa e-CF.
--
-- Calendario DGII:
--   Grandes nacionales          mayo 2024
--   Grandes locales y medianos  15 nov 2025  (ya vencido)
--   Pequenos, micro, no clasif. 15 nov 2026  (prorroga del 6 mayo 2026)
--
-- e-CF no es solo un formato distinto: exige firma digital, envio en XML
-- a la DGII y recepcion de acuse. Es un proyecto aparte.
--
-- VERIFICAR la clasificacion del RNC del taller en el portal de la DGII
-- antes de decidir el alcance.
-- =====================================================================
