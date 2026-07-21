-- =====================================================================
-- SEPARAR LA NUMERACION NCF DE LA CAFETERIA
-- Fecha: 2026-07-20
--
-- SITUACION: POST /facturas, POST /ventas y POST /cafeteria/venta
-- comparten la misma fila de ncf_config. Por eso los NCF B02 3,4,10,11,
-- 12 y 21 del taller aparecieron en cafeteria_ventas.
--
-- DECISION: la cafeteria tendra RNC PROPIO, distinto al del taller.
-- Seran dos contribuyentes independientes ante la DGII.
--
-- >>> PERO LA CAFETERIA AUN NO TIENE RNC. <<<
-- Sin RNC no hay autorizacion, y sin autorizacion cualquier NCF que
-- emita es invalido. Hasta que saque el suyo, la cafeteria vende SIN
-- NCF, con ticket interno no fiscal. Sus filas quedan INACTIVAS.
--
-- ncf_config real al 2026-07-20 (todas del taller):
--   id 1  B01  secuencia_actual 2
--   id 2  B02  secuencia_actual 27
--   id 9  B14  secuencia_actual 1
--   id 3  B15  secuencia_actual 1
--
-- OJO CON EL OFF-BY-ONE: la columna tiene default 1 y el codigo hace
-- secuencia_actual + 1, por eso la primera factura se llevo el numero 2
-- y el 1 nunca se emitio. Al cargar la autorizacion real, arrancar
-- secuencia_actual en 0.
--
-- CORRER DESPUES del script 06.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PASO 1 - Ver que hay antes de tocar nada
-- ---------------------------------------------------------------------
select * from ncf_config order by tipo;


-- ---------------------------------------------------------------------
-- PASO 2 - Agregar unidad de negocio y RNC emisor
-- ---------------------------------------------------------------------

alter table ncf_config
  add column if not exists unidad_negocio varchar(20) not null default 'taller',
  add column if not exists rnc_emisor     varchar(15);

comment on column ncf_config.unidad_negocio is
  'Contribuyente al que pertenece la secuencia: taller | cafeteria. Cada uno con su RNC y su autorizacion DGII.';
comment on column ncf_config.rnc_emisor is
  'RNC bajo el que se emite esta secuencia. Sin guiones, solo digitos (formato DGII 606/607).';

-- Las 4 filas existentes son del taller: la cafeteria nunca tuvo propia.
update ncf_config set unidad_negocio = 'taller' where unidad_negocio is null;


-- ---------------------------------------------------------------------
-- PASO 3 - La unicidad ahora es por (tipo, unidad_negocio)
-- Antes: un solo B02 en todo el sistema.
-- Ahora: un B02 del taller y un B02 de la cafeteria, independientes.
-- ---------------------------------------------------------------------

drop index if exists ux_ncf_config_tipo_activo;
alter table ncf_config drop constraint if exists ncf_config_tipo_unique;

create unique index if not exists ux_ncf_config_unidad_tipo_activo
  on ncf_config (unidad_negocio, tipo) where activo;


-- ---------------------------------------------------------------------
-- PASO 4 - Secuencias de la cafeteria: CREADAS PERO INACTIVAS
--
-- activo = false a proposito. La cafeteria no tiene RNC todavia, asi
-- que NO puede emitir comprobantes fiscales validos. Estas filas son
-- el molde: el dia que salga el RNC se completan y se activan.
-- ---------------------------------------------------------------------

insert into ncf_config
  (tipo, prefijo, unidad_negocio, rnc_emisor, modalidad, longitud_secuencia,
   equivalente_ecf, secuencia_desde, secuencia_actual, secuencia_hasta,
   fecha_vencimiento, activo, descripcion)
values
  ('B01','B01','cafeteria', null,'NCF', 8,'E31', 1, 0, null, null, false,
   'Cafeteria - credito fiscal. INACTIVA: sin RNC ni autorizacion DGII.'),
  ('B02','B02','cafeteria', null,'NCF', 8,'E32', 1, 0, null, null, false,
   'Cafeteria - consumo. INACTIVA: sin RNC ni autorizacion DGII.')
on conflict do nothing;

-- Cargar el RNC del taller (sin guiones)
-- update ncf_config set rnc_emisor = '<RNC del taller>' where unidad_negocio = 'taller';


-- ---------------------------------------------------------------------
-- PASO 4b - ACTIVAR LA CAFETERIA (el dia que tenga RNC y autorizacion)
-- ---------------------------------------------------------------------

-- update ncf_config
--    set rnc_emisor        = '<RNC de la cafeteria, sin guiones>',
--        secuencia_desde   = <inicio del rango autorizado>,
--        secuencia_actual  = <inicio - 1>,   -- 0 si el rango arranca en 1
--        secuencia_hasta   = <fin del rango autorizado>,
--        fecha_vencimiento = '<vencimiento de la autorizacion>',
--        activo            = true
--  where unidad_negocio = 'cafeteria' and tipo = 'B02';


-- ---------------------------------------------------------------------
-- PASO 5 - Emision por unidad de negocio
-- Reemplaza la funcion del script 06. El parametro tiene default
-- 'taller' para no romper llamadas existentes.
-- ---------------------------------------------------------------------

create or replace function siguiente_comprobante(
  p_tipo   varchar,
  p_unidad varchar default 'taller'
)
returns table (comprobante varchar, tipo varchar, modalidad varchar,
               vence date, rnc_emisor varchar)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sec integer; v_hasta integer; v_prefijo varchar;
  v_vence date;  v_long smallint; v_mod varchar; v_rnc varchar;
begin
  update ncf_config c
     set secuencia_actual = c.secuencia_actual + 1,
         actualizado_en   = now()
   where c.tipo = p_tipo
     and c.unidad_negocio = p_unidad
     and c.activo
  returning c.secuencia_actual, c.secuencia_hasta, c.prefijo,
            c.fecha_vencimiento, c.longitud_secuencia, c.modalidad, c.rnc_emisor
       into v_sec, v_hasta, v_prefijo, v_vence, v_long, v_mod, v_rnc;

  if not found then
    raise exception 'No hay secuencia activa de tipo % para la unidad %', p_tipo, p_unidad
      using hint = 'Revisar ncf_config: falta la fila o esta inactiva.';
  end if;

  if v_hasta is not null and v_sec > v_hasta then
    update ncf_config set secuencia_actual = secuencia_actual - 1, activo = false
     where tipo = p_tipo and unidad_negocio = p_unidad;
    raise exception 'Rango % de % agotado (limite %). Solicitar nueva autorizacion a la DGII.',
      p_tipo, p_unidad, v_hasta;
  end if;

  if v_vence is not null and v_vence < current_date then
    update ncf_config set secuencia_actual = secuencia_actual - 1
     where tipo = p_tipo and unidad_negocio = p_unidad;
    raise exception 'La autorizacion % de % vencio el %.', p_tipo, p_unidad, v_vence;
  end if;

  return query select
    (v_prefijo || lpad(v_sec::text, v_long, '0'))::varchar,
    p_tipo, v_mod, v_vence, v_rnc;
end;
$$;

comment on function siguiente_comprobante(varchar, varchar) is
  'Emite el siguiente comprobante de la unidad indicada (taller | cafeteria), de forma atomica. Llamar SIEMPRE dentro de la transaccion que inserta la venta.';


-- ---------------------------------------------------------------------
-- PASO 6 - Limpiar las 6 ventas de prueba de la cafeteria
-- Llevan NCF de la serie del taller. Es data de prueba, sin efecto
-- fiscal, pero no debe arrastrarse a produccion.
-- ---------------------------------------------------------------------

select id, ncf, ncf_tipo, total, created_at::date
from cafeteria_ventas order by id;

-- delete from cafeteria_detalle where venta_id in (select id from cafeteria_ventas);
-- delete from cafeteria_ventas;


-- ---------------------------------------------------------------------
-- PASO 7 - Verificar
-- ---------------------------------------------------------------------

select unidad_negocio, tipo, prefijo, secuencia_actual,
       secuencia_hasta, rnc_emisor, activo
from ncf_config
order by unidad_negocio, tipo;

-- Prueba (consume un numero de cada uno; devolverlo despues)
-- select * from siguiente_comprobante('B02','taller');
-- select * from siguiente_comprobante('B02','cafeteria');


-- =====================================================================
-- CAMBIOS PENDIENTES EN crm-backend/server.mjs
--
--   POST /facturas         (~2720)  -> siguiente_comprobante(tipo,'taller')
--   POST /ventas           (~1235)  -> siguiente_comprobante(tipo,'taller')
--   POST /cafeteria/venta  (~1466)  -> SIN NCF (ticket interno)
--
-- CRITICO - EL Math.random() AHORA ES EL CAMINO POR DEFECTO:
-- Con las filas de la cafeteria inactivas, el codigo actual cae en el
-- else y emitiria un NCF aleatorio en CADA venta de cafeteria. Hay que
-- borrar ese fallback en los tres endpoints antes de aplicar el paso 4.
-- Que falle ruidosamente. Un comprobante inventado es peor que una
-- venta que no se guarda.
--
-- CAFETERIA MIENTRAS NO TENGA RNC:
--   ncf      = null
--   ncf_tipo = null
--   El ticket es cafeteria_ventas.id, formateado como TICKET-00001.
--   La impresion NO debe decir "Comprobante Fiscal" ni mostrar RNC.
--   Es un recibo interno, no un documento fiscal.
--
-- NOTA CONTABLE: con RNC propio, la cafeteria sera otro contribuyente.
-- Sus ventas no son ingresos del taller. El rollup cafe_efectivo /
-- cafe_total en cuadre_caja sirve para control de efectivo del local,
-- pero NO debe sumar al P&L ni a las declaraciones del taller.
-- =====================================================================
