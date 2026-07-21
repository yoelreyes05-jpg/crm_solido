-- =====================================================================
-- SISTEMA DE COMPROBANTES DUAL: NCF serie B + preparado para e-CF
-- Fecha: 2026-07-20
--
-- DECISION DEL USUARIO: operar con NCF tradicional ahora, con la
-- estructura lista para e-CF (Ley 32-23) sin reescribir nada.
--
-- CONTEXTO: sistema en pruebas, aun no ha vendido. Las 21 facturas
-- existentes son data de prueba con NCF inventados (no de un rango
-- autorizado). Cero exposicion ante la DGII.
--
-- Este script REEMPLAZA al 04. Corre el 04 solo si quieres el modo
-- simple de serie B unicamente.
--
-- ALCANCE: solo taller. No toca ul_* (Gelatilandia), aloha_*,
-- cafeteria_* ni el CRM clinico.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PASO 1 - Limpiar la data de prueba
-- Son NCF inventados. No hay razon para arrastrarlos a produccion.
-- >>> Revisar antes de correr. Borra las 21 facturas y sus lineas.
-- ---------------------------------------------------------------------

-- begin;
--   delete from factura_items where factura_id in (select id from facturas);
--   delete from facturas;
--   alter sequence facturas_id_seq restart with 1;
-- commit;

-- Si prefieres conservarlas como historico de pruebas, marcalas:
-- update facturas
--    set estado = 'ANULADA',
--        notas  = coalesce(notas || ' | ','') || 'DATA DE PRUEBA - NCF no fiscal';


-- ---------------------------------------------------------------------
-- PASO 2 - ncf_config en modo dual
-- Recicla la tabla vacia. Ahora soporta serie B y serie E.
-- ---------------------------------------------------------------------

alter table ncf_config
  add column if not exists modalidad          varchar(4)  not null default 'NCF',
  add column if not exists longitud_secuencia smallint    not null default 8,
  add column if not exists equivalente_ecf    varchar(3),
  add column if not exists secuencia_desde    integer     not null default 1,
  add column if not exists secuencia_hasta    integer,
  add column if not exists fecha_vencimiento  date,
  add column if not exists activo             boolean     not null default true,
  add column if not exists descripcion        text,
  add column if not exists actualizado_en     timestamptz not null default now();

alter table ncf_config
  drop constraint if exists ck_ncf_config_modalidad;
alter table ncf_config
  add constraint ck_ncf_config_modalidad
  check (
    (modalidad = 'NCF' and longitud_secuencia = 8  and tipo ~ '^B[0-9]{2}$')
    or
    (modalidad = 'ECF' and longitud_secuencia = 10 and tipo ~ '^E[0-9]{2}$')
  );

comment on table ncf_config is
  '[ACTIVA] Secuencias de comprobantes del TALLER, modo dual NCF/e-CF. Reciclada (estaba vacia). NO confundir con ul_secuencias_ncf (Gelatilandia).';
comment on column ncf_config.modalidad is
  'NCF = serie B tradicional (8 digitos). ECF = serie E electronica Ley 32-23 (10 digitos).';
comment on column ncf_config.equivalente_ecf is
  'Tipo e-CF al que migra este tipo B. Permite el switch sin tocar codigo.';

create unique index if not exists ux_ncf_config_tipo_activo
  on ncf_config (tipo) where activo;


-- ---------------------------------------------------------------------
-- PASO 3 - Cargar los tipos con su equivalencia e-CF
--
-- >>> secuencia_hasta y fecha_vencimiento van NULL hasta que tengas
-- >>> tu autorizacion real de la DGII. Con NULL la funcion emite pero
-- >>> NO puede frenarte al agotar el rango. Completarlos es obligatorio
-- >>> antes de emitir el primer comprobante real.
-- ---------------------------------------------------------------------

insert into ncf_config
  (tipo, prefijo, modalidad, longitud_secuencia, equivalente_ecf,
   secuencia_desde, secuencia_actual, secuencia_hasta, fecha_vencimiento, activo, descripcion)
values
  ('B01','B01','NCF', 8,'E31', 1, 0, null, null, true,  'Credito fiscal - cliente con RNC'),
  ('B02','B02','NCF', 8,'E32', 1, 0, null, null, true,  'Consumo - consumidor final'),
  ('B03','B03','NCF', 8,'E33', 1, 0, null, null, false, 'Nota de debito'),
  ('B04','B04','NCF', 8,'E34', 1, 0, null, null, false, 'Nota de credito'),
  -- Serie E precargada e INACTIVA. El dia de la migracion solo se
  -- desactiva la B y se activa la E correspondiente.
  ('E31','E31','ECF',10, null, 1, 0, null, null, false, 'e-CF credito fiscal (dormido)'),
  ('E32','E32','ECF',10, null, 1, 0, null, null, false, 'e-CF consumo (dormido)'),
  ('E33','E33','ECF',10, null, 1, 0, null, null, false, 'e-CF nota de debito (dormido)'),
  ('E34','E34','ECF',10, null, 1, 0, null, null, false, 'e-CF nota de credito (dormido)')
on conflict do nothing;


-- ---------------------------------------------------------------------
-- PASO 4 - Emision atomica, sirve para ambas series
-- La longitud del correlativo sale de la config, no del codigo.
-- ---------------------------------------------------------------------

create or replace function siguiente_comprobante(p_tipo varchar)
returns table (comprobante varchar, tipo varchar, modalidad varchar, vence date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sec integer; v_hasta integer; v_prefijo varchar;
  v_vence date;  v_long smallint; v_mod varchar;
begin
  update ncf_config
     set secuencia_actual = secuencia_actual + 1,
         actualizado_en   = now()
   where ncf_config.tipo = p_tipo and activo
  returning secuencia_actual, secuencia_hasta, prefijo,
            fecha_vencimiento, longitud_secuencia, modalidad
       into v_sec, v_hasta, v_prefijo, v_vence, v_long, v_mod;

  if not found then
    raise exception 'No hay secuencia activa para el tipo %', p_tipo
      using hint = 'Revisar ncf_config: no existe el tipo o esta inactivo.';
  end if;

  if v_hasta is not null and v_sec > v_hasta then
    update ncf_config set secuencia_actual = secuencia_actual - 1, activo = false
     where ncf_config.tipo = p_tipo;
    raise exception 'Rango % agotado (limite %). Solicitar nueva autorizacion a la DGII.', p_tipo, v_hasta;
  end if;

  if v_vence is not null and v_vence < current_date then
    update ncf_config set secuencia_actual = secuencia_actual - 1
     where ncf_config.tipo = p_tipo;
    raise exception 'La autorizacion % vencio el %.', p_tipo, v_vence;
  end if;

  return query select
    (v_prefijo || lpad(v_sec::text, v_long, '0'))::varchar,
    p_tipo, v_mod, v_vence;
end;
$$;

comment on function siguiente_comprobante(varchar) is
  'Emite el siguiente comprobante del taller (serie B o E segun config), de forma atomica. Llamar SIEMPRE dentro de la transaccion que inserta la factura: si el insert falla, el rollback devuelve el numero y no se quema.';


-- ---------------------------------------------------------------------
-- PASO 5 - Tipo automatico segun el cliente Y la modalidad vigente
-- La secretaria nunca elige tipo de comprobante.
-- El mismo codigo devuelve B01/B02 hoy y E31/E32 despues del switch.
-- ---------------------------------------------------------------------

create or replace function tipo_comprobante_para_cliente(p_cliente_id integer)
returns varchar
language plpgsql
stable
as $$
declare
  v_con_rnc boolean;
  v_tipo    varchar;
begin
  select coalesce(nullif(trim(c.rnc), ''), null) is not null
    into v_con_rnc
  from clientes c where c.id = p_cliente_id;

  -- Busca el tipo activo que corresponde, sin importar la serie.
  select cfg.tipo into v_tipo
  from ncf_config cfg
  where cfg.activo
    and cfg.tipo in (
      case when coalesce(v_con_rnc,false) then 'B01' else 'B02' end,
      case when coalesce(v_con_rnc,false) then 'E31' else 'E32' end
    )
  order by case cfg.modalidad when 'ECF' then 1 else 2 end  -- e-CF manda si esta activo
  limit 1;

  if v_tipo is null then
    raise exception 'No hay tipo de comprobante activo para este cliente.';
  end if;
  return v_tipo;
end;
$$;

comment on function tipo_comprobante_para_cliente(integer) is
  'Con RNC -> credito fiscal (B01/E31). Sin RNC -> consumo (B02/E32). Prefiere e-CF si esta activo. La secretaria no elige.';


-- ---------------------------------------------------------------------
-- PASO 6 - Campos e-CF en facturas (nulos y dormidos hasta la migracion)
-- No hay columnas reciclables: e-CF pide datos que no existen hoy.
-- Se agregan ahora para no alterar la tabla estando en produccion.
-- ---------------------------------------------------------------------

alter table facturas
  add column if not exists modalidad        varchar(4) not null default 'NCF',
  add column if not exists ecf_track_id     varchar(50),
  add column if not exists ecf_codigo_seg   varchar(20),
  add column if not exists ecf_estado_dgii  varchar(30),
  add column if not exists ecf_fecha_firma  timestamptz,
  add column if not exists ecf_qr_url       text,
  add column if not exists ecf_xml_enviado  text,
  add column if not exists ecf_xml_respuesta text;

comment on column facturas.modalidad       is 'NCF o ECF. Permite convivencia durante la migracion.';
comment on column facturas.ecf_track_id    is 'TrackID devuelto por la DGII al recibir el e-CF.';
comment on column facturas.ecf_estado_dgii is 'Aceptado / Rechazado / En Proceso / Aceptado Condicional.';
comment on column facturas.ecf_qr_url      is 'URL del codigo QR obligatorio en la representacion impresa del e-CF.';


-- ---------------------------------------------------------------------
-- PASO 7 - Protecciones (aplican a ambas series)
-- ---------------------------------------------------------------------

create unique index if not exists ux_facturas_ncf
  on facturas (ncf) where ncf is not null and ncf <> '';

alter table facturas drop constraint if exists ck_facturas_ncf_formato;
alter table facturas
  add constraint ck_facturas_ncf_formato
  check (
    ncf is null or ncf = ''
    or ncf ~ '^B[0-9]{10}$'    -- NCF serie B: B + tipo(2) + sec(8)
    or ncf ~ '^E[0-9]{12}$'    -- e-CF serie E: E + tipo(2) + sec(10)
  ) not valid;

-- Con la data de prueba ya borrada, activar del todo:
-- alter table facturas validate constraint ck_facturas_ncf_formato;

-- Nunca emitir comprobante en una factura sin monto.
alter table facturas drop constraint if exists ck_facturas_ncf_sin_monto;
alter table facturas
  add constraint ck_facturas_ncf_sin_monto
  check (ncf is null or ncf = '' or total > 0) not valid;


-- ---------------------------------------------------------------------
-- PASO 8 - Vigilancia: huecos en la secuencia (ambas series)
-- ---------------------------------------------------------------------

create or replace view v_ncf_faltantes as
with rangos as (
  select
    substring(ncf from 1 for 3)     as tipo,
    length(ncf) - 3                 as largo_sec,
    min(substring(ncf from 4)::int) as desde,
    max(substring(ncf from 4)::int) as hasta
  from facturas
  where ncf ~ '^[BE][0-9]+$'
  group by 1, 2
),
esperados as (
  select r.tipo, r.largo_sec, generate_series(r.desde, r.hasta) as sec
  from rangos r
)
select e.tipo, e.tipo || lpad(e.sec::text, e.largo_sec, '0') as comprobante_faltante
from esperados e
where not exists (
  select 1 from facturas f
  where f.ncf = e.tipo || lpad(e.sec::text, e.largo_sec, '0')
)
order by 1, 2;

comment on view v_ncf_faltantes is
  'Comprobantes consumidos sin factura. Todo lo que salga aqui va al Formato 608 (anulados). Correr mensual.';


-- ---------------------------------------------------------------------
-- PASO 9 - EL SWITCH A e-CF (el dia que la DGII lo exija)
-- Esto es todo lo que cambia en la base de datos:
-- ---------------------------------------------------------------------

-- begin;
--   update ncf_config set activo = false where tipo in ('B01','B02','B03','B04');
--   update ncf_config
--      set activo = true,
--          secuencia_desde   = 1,
--          secuencia_actual  = 0,
--          secuencia_hasta   = <rango autorizado por la DGII>,
--          fecha_vencimiento = <vencimiento de la autorizacion>
--    where tipo in ('E31','E32');
-- commit;

-- La aplicacion no cambia: sigue llamando a tipo_comprobante_para_cliente()
-- y siguiente_comprobante(). Empiezan a salir E31/E32 automaticamente.


-- =====================================================================
-- LO QUE ESTE SCRIPT **NO** RESUELVE
--
-- La base de datos queda lista, pero e-CF NO es solo numeracion.
-- Falta, y es un proyecto aparte:
--
--   1. Certificado de firma digital de una entidad autorizada en RD.
--   2. Generacion del XML del e-CF segun el esquema de la DGII.
--   3. Firma XAdES del XML.
--   4. Envio al webservice de la DGII y manejo del acuse (TrackID,
--      estados Aceptado / Rechazado / En Proceso).
--   5. Representacion impresa con codigo QR.
--   6. Reintentos y contingencia si la DGII no responde.
--
-- Calendario DGII (Ley 32-23):
--   Grandes nacionales           mayo 2024
--   Grandes locales y medianos   15 nov 2025
--   Pequenos, micro, no clasif.  15 nov 2026  (prorroga del 6 mayo 2026)
--
-- PENDIENTE: verificar la clasificacion del RNC del taller en el portal
-- de la DGII. Determina si la fecha es noviembre 2026 o si ya vencio.
-- =====================================================================
