-- =====================================================================
-- ARCHIVAR TABLAS MUERTAS - CRM AUTOMOTRIZ
-- Fecha: 2026-07-20
--
-- NO usa DROP. Mueve las tablas a un esquema _archivo.
-- Motivo: es reversible. Si algo en la app las referenciaba, revierte
-- en 5 segundos con el script del final en vez de restaurar un backup.
--
-- Las 4 tablas de aqui tienen 0 filas confirmadas, asi que no hay
-- riesgo de perder datos. El unico riesgo es que algun endpoint las
-- consulte: por eso el PASO 1 es verificar, no ejecutar.
--
-- ORDEN: paso 1 -> paso 2 -> esperar 30 dias -> paso 4
-- =====================================================================


-- ---------------------------------------------------------------------
-- PASO 1 - VERIFICAR ANTES DE MOVER (correr solo esto primero)
-- ---------------------------------------------------------------------

-- 1a. Confirmar que siguen vacias
select 'ventas' as tabla, count(*) as filas from ventas
union all select 'venta_items', count(*) from venta_items
union all select 'productos',   count(*) from productos
union all select 'ordenes',     count(*) from ordenes;
-- Si alguna trae filas: DETENERSE. Algo las esta escribiendo.


-- 1b. Confirmar que nada depende de ellas (FKs entrantes)
select
  tc.table_name  as tabla_que_depende,
  kcu.column_name as columna,
  ccu.table_name  as tabla_muerta
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and ccu.table_name in ('ventas','venta_items','productos','ordenes')
  and tc.table_name not in ('ventas','venta_items','productos','ordenes');
-- Si devuelve filas: resolver esas dependencias antes de continuar.


-- 1c. Confirmar que ninguna vista las usa
select viewname
from pg_views
where schemaname = 'public'
  and (definition ilike '%from ventas%'
    or definition ilike '%from venta_items%'
    or definition ilike '%from productos%'
    or definition ilike '%from ordenes%');
-- Si devuelve filas: esas vistas se rompen. Revisarlas primero.


-- 1d. EN TU CODIGO (no en SQL): buscar referencias antes de mover.
--     grep -rn "from('ventas')\|from('venta_items')\|from('productos')\|from('ordenes')" src/
--     Ojo: 'ordenes' hace match parcial con 'ordenes_trabajo' (que SI se usa).
--     Revisar cada resultado a mano.


-- ---------------------------------------------------------------------
-- PASO 2 - MOVER AL ARCHIVO (correr solo si el paso 1 salio limpio)
-- ---------------------------------------------------------------------

create schema if not exists _archivo;
comment on schema _archivo is
  'Tablas retiradas de produccion. Conservar 30 dias antes de eliminar definitivamente.';

alter table public.ventas       set schema _archivo;
alter table public.venta_items  set schema _archivo;
alter table public.productos    set schema _archivo;
alter table public.ordenes      set schema _archivo;

comment on table _archivo.ventas      is '[ARCHIVADA 2026-07-20] 0 filas. POS viejo, reemplazado por ul_ventas y facturas.';
comment on table _archivo.venta_items is '[ARCHIVADA 2026-07-20] 0 filas. Lineas del POS viejo.';
comment on table _archivo.productos   is '[ARCHIVADA 2026-07-20] 0 filas. Catalogo nunca poblado. Vivos: repuestos, inventario.';
comment on table _archivo.ordenes     is '[ARCHIVADA 2026-07-20] 0 filas. Reemplazada por ordenes_trabajo.';


-- ---------------------------------------------------------------------
-- PASO 3 - PROBAR LA APP
-- Usar el sistema normal 30 dias: facturar, cobrar, cuadrar caja,
-- abrir orden de trabajo, cotizar. Si nada se rompe, seguir al paso 4.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- PASO 4 - ELIMINACION DEFINITIVA (a partir del 2026-08-20)
-- Descomentar solo cuando hayan pasado los 30 dias sin incidentes.
-- ---------------------------------------------------------------------

-- drop table _archivo.venta_items;
-- drop table _archivo.ventas;
-- drop table _archivo.productos;
-- drop table _archivo.ordenes;


-- ---------------------------------------------------------------------
-- REVERTIR (si algo se rompe despues del paso 2)
-- ---------------------------------------------------------------------

-- alter table _archivo.ventas      set schema public;
-- alter table _archivo.venta_items set schema public;
-- alter table _archivo.productos   set schema public;
-- alter table _archivo.ordenes     set schema public;


-- =====================================================================
-- NO INCLUIDAS AQUI A PROPOSITO
--
--   ncf_config              0 filas, pero facturas tiene campos NCF.
--                           Confirmar primero de donde salen esos NCF.
--                           Tocar la numeracion fiscal a ciegas es
--                           el peor error posible con la DGII.
--
--   cuentas_cobrar          0 filas porque hoy todo es al contado,
--   pagos_cobrar            no porque esten obsoletas.
--
--   asientos_contables      0 filas, pero es la capa de consolidacion
--   partidas_contables      que hace falta para el P&L por unidad.
--
--   plan_*                  1 fila = modulo sin lanzar, no basura.
--   capacitaciones_*
-- =====================================================================
