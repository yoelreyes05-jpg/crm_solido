-- =====================================================================
-- CLASIFICACION DE TABLAS - CRM AUTOMOTRIZ
-- Fecha: 2026-07-20
-- Base: conteos de pg_stat_user_tables
--
-- CONVENCION DE ESTADOS (usar siempre estos 4, en mayusculas):
--
--   [ACTIVA]      En uso en produccion. No tocar sin analisis.
--   [SIN LANZAR]  Construida pero nunca puesta en produccion (0-2 filas
--                 de prueba). CONSERVAR: es funcionalidad futura.
--   [MUERTA]      Reemplazada o abandonada. Candidata a eliminar.
--   [REVISAR]     Estado ambiguo. Requiere decision antes de actuar.
--
-- ALCANCE: solo ecosistema TALLER (taller, carwash, capacitacion,
-- membresias) + capas compartidas.
--
-- FUERA DE ALCANCE - INTOCABLES por instruccion explicita del usuario.
-- Son negocios independientes que ya funcionan bien:
--   aloha_*      Sucursal distinta.
--   cafeteria_*  Opera dentro del taller pero fuera del sistema.
--   ul_*         UnLupaso, hoy GELATILANDIA. POS de venta adicional.
--   CRM CLINICO  pacientes, medicos, historiales_*, facturas_clinica,
--                planes_ars, aseguradoras, reclamaciones_ars,
--                tarifarios_ars, citas, diagnosticos, recetas_medicas,
--                estudios_diagnosticos, seguros_pacientes,
--                usuarios_clinica, clinico_usuarios,
--                permisos_especialidades, validaciones_cobertura,
--                autorizaciones_seguro, historiales_clinicos.
--                Sistema independiente corriendo en la misma BD.
-- No unificar, no migrar, no renombrar ninguna de estas.
--
-- OJO: asientos_contables, partidas_contables, cuentas_contables y
-- movimientos_financieros tienen medico_id y se diseñaron para la
-- clinica, pero son capa COMPARTIDA. Si el CRM clinico las usa,
-- el taller debe sumarse SIN alterar columnas existentes.
-- Verificar antes de tocarlas.
--
-- PRINCIPIO DE TRABAJO (instruccion del usuario):
-- No romper lo que funciona. Solo agregar lo que falta. Antes de crear
-- una tabla o columna nueva, revisar si existe una sin usar que sirva,
-- para no seguir acumulando estructuras vacias.
--
-- Este script solo escribe metadatos. NO modifica datos ni estructura.
-- Es 100% seguro de correr y se puede repetir sin efectos secundarios.
--
-- ADVERTENCIA METODOLOGICA:
-- Los conteos iniciales salieron de pg_stat_user_tables.n_live_tup, que
-- es un ESTIMADO del autovacuum, no un conteo real. Reporto 0 filas en
-- ncf_config cuando en realidad tenia 4. Antes de declarar muerta una
-- tabla, SIEMPRE confirmar con count(*) real.
--
-- Verificado con count(*) el 2026-07-20:
--   ncf_config          4  (pg_stat decia 0 - ERROR)
--   cafeteria_ventas    6
--   ventas              0  confirmado
--   venta_items         0  confirmado
--   productos           0  confirmado
--   ordenes             0  confirmado
--   cuentas_cobrar      0  confirmado
--   pagos_cobrar        0  confirmado
--   asientos_contables  0  confirmado
--   partidas_contables  0  confirmado
-- =====================================================================


-- ---------------------------------------------------------------------
-- ul_* = UNLUPASO, hoy GELATILANDIA
-- POS de venta independiente. NO ES DEL TALLER.
-- >>> INTOCABLE. Funciona bien. No unificar, no migrar, no renombrar. <<<
-- Nombres de tabla se dejan con prefijo ul_ por instruccion explicita.
-- ---------------------------------------------------------------------
comment on table ul_ventas is
  '[ACTIVA][NO TOCAR] Gelatilandia (ex UnLupaso). 42 filas. POS independiente, fuera del ecosistema taller. Funciona bien.';

comment on table ul_detalle_ventas is
  '[ACTIVA][NO TOCAR] Gelatilandia. 43 filas. Lineas de ul_ventas.';

comment on table ul_productos is
  '[ACTIVA][NO TOCAR] Gelatilandia. 30 filas. Catalogo propio. NO entra en la unificacion de catalogos del taller.';

comment on table ul_cuadre is
  '[ACTIVA][NO TOCAR] Gelatilandia. 13 filas. Cuadre de caja propio.';

comment on table ul_secuencias_ncf is
  '[ACTIVA][NO TOCAR] Gelatilandia. 4 filas. Secuencia NCF PROPIA de Gelatilandia. VERIFICAR: si Gelatilandia factura bajo el mismo RNC que el taller, dos fuentes de NCF sobre el mismo rango autorizado generan comprobantes duplicados ante la DGII. Si son RNC distintos, no hay conflicto.';

comment on table ul_config is
  '[ACTIVA][NO TOCAR] Gelatilandia. Configuracion del POS.';

comment on table ul_movimientos_inventario is
  '[ACTIVA][NO TOCAR] Gelatilandia. Kardex propio.';


-- ---------------------------------------------------------------------
-- FACTURACION FISCAL DEL TALLER
-- ---------------------------------------------------------------------
comment on table facturas is
  '[ACTIVA] 21 filas. Factura fiscal del taller. Ya trae cobrado_por y fecha_cobro (flujo vendedor->secretaria a medio construir). FALTA: unidad_negocio, y migrar creado_por/cobrado_por de text a uuid FK a profiles (bloqueador de RLS).';

comment on table factura_items is
  '[ACTIVA] 22 filas. Lineas de factura. Ya soporta tipo + itbis_aplica + inventario_id, o sea que admite lineas de SERVICIO ademas de repuestos. Base de la unificacion.';


-- ---------------------------------------------------------------------
-- CAJA Y CUADRE DEL TALLER
-- ---------------------------------------------------------------------
comment on table caja_movimientos is
  '[ACTIVA] 16 filas. Movimientos de caja del taller.';

comment on table cuadre_caja is
  '[ACTIVA] 10 filas. Cuadre del taller. Ya incluye cafe_efectivo/cafe_total como rollup de la cafeteria: ese patron (unidad separada que entra como total, no como tablas) es el correcto y se debe extender a carwash/capacitacion/membresias.';

comment on table caja_chica is
  '[REVISAR] Sin conteo. Caja chica del taller.';


-- ---------------------------------------------------------------------
-- OPERACION DEL TALLER
-- ---------------------------------------------------------------------
comment on table ordenes_trabajo is
  '[ACTIVA] 11 filas. Ordenes de trabajo reales. Sustituye a la tabla ordenes (0 filas, muerta).';

comment on table cotizaciones is
  '[ACTIVA] 4 filas. Cotizaciones que alimentan facturas.cotizacion_id.';


-- ---------------------------------------------------------------------
-- CATALOGOS - PROBLEMA CONFIRMADO: 3 catalogos vivos en paralelo
-- ---------------------------------------------------------------------
comment on table repuestos is
  '[ACTIVA] 10 filas. Catalogo con mas data del taller. PERO factura_items.inventario_id apunta a inventario, no aqui. Conflicto a resolver.';

comment on table inventario is
  '[ACTIVA] 6 filas. Catalogo referenciado por factura_items.inventario_id. Columnas en ingles (name, code, price, stock) a diferencia del resto del schema. Conflicto con repuestos.';

comment on table inventario_movimientos is
  '[REVISAR] Sin conteo. Kardex de inventario.';


-- ---------------------------------------------------------------------
-- MODULOS SIN LANZAR - CONSERVAR, NO ELIMINAR
-- Tienen 1 fila (prueba). Son funcionalidad futura, no basura.
-- ---------------------------------------------------------------------
comment on table plan_membresias is
  '[SIN LANZAR] 1 fila de prueba. Modulo de membresias listo pero no arrancado. CONSERVAR.';

comment on table plan_pagos is
  '[SIN LANZAR] 1 fila. Cobros de membresia. Hoy vive fuera de facturas: no genera NCF. CONSERVAR.';

comment on table plan_consumos is
  '[SIN LANZAR] 1 fila. Consumo de beneficios del plan. CONSERVAR.';

comment on table plan_catalogo is
  '[SIN LANZAR] Catalogo de planes. CONSERVAR.';

comment on table plan_beneficios is
  '[SIN LANZAR] Beneficios por plan. CONSERVAR.';

comment on table plan_membresia_vehiculos is
  '[SIN LANZAR] Vehiculos cubiertos por membresia. CONSERVAR.';

comment on table capacitaciones_pagos is
  '[SIN LANZAR] 1 fila. Cobros de curso. Cuelga de alumno_id, fuera de facturas: no genera NCF. CONSERVAR.';

comment on table capacitaciones_cursos is
  '[SIN LANZAR] Catalogo de cursos. CONSERVAR.';

comment on table capacitaciones_alumnos is
  '[SIN LANZAR] Inscripciones. CONSERVAR.';

comment on table carwash_servicios is
  '[SIN LANZAR] Solo lista de precios. NO tiene tabla de ventas propia: los cobros de carwash no se estan registrando por unidad. CONSERVAR.';


-- ---------------------------------------------------------------------
-- CUENTAS POR COBRAR/PAGAR - 0 filas pero NO son basura
-- Estan en 0 porque hoy todo se cobra al contado. Si algun dia
-- vendes a credito las necesitas. CONSERVAR.
-- ---------------------------------------------------------------------
comment on table cuentas_cobrar is
  '[SIN LANZAR] 0 filas: hoy todo se cobra al contado. CONSERVAR para venta a credito futura.';

comment on table pagos_cobrar is
  '[SIN LANZAR] 0 filas. Abonos a cuentas por cobrar. CONSERVAR.';

comment on table cuentas_pagar is
  '[REVISAR] Sin conteo. Cuentas por pagar a suplidores.';

comment on table pagos_pagar is
  '[REVISAR] Sin conteo.';


-- ---------------------------------------------------------------------
-- CONTABILIDAD - construida, nunca encendida
-- Es la capa correcta para consolidar P&L por unidad de negocio
-- sin fusionar las cajas. CONSERVAR.
-- ---------------------------------------------------------------------
comment on table asientos_contables is
  '[SIN LANZAR] 0 filas. Partida doble construida y nunca encendida. Trae medico_id y referencia_tipo/referencia_id: se diseno para la clinica pero el patron polimorfico sirve para todo. Es la capa donde debe consolidarse el P&L por unidad de negocio. CONSERVAR.';

comment on table partidas_contables is
  '[SIN LANZAR] Lineas debe/haber de asientos_contables. CONSERVAR.';

comment on table cuentas_contables is
  '[SIN LANZAR] Catalogo de cuentas. CONSERVAR.';

comment on table contabilidad_config is
  '[SIN LANZAR] Configuracion contable. CONSERVAR.';

comment on table movimientos_financieros is
  '[REVISAR] Sin conteo. Orientada a clinica (medico_id, paciente_id, aseguradora_id). Definir si aplica al taller.';


-- ---------------------------------------------------------------------
-- NUCLEO COMPARTIDO
-- ---------------------------------------------------------------------
comment on table clientes is
  '[ACTIVA] Nucleo. Ya trae rnc y tipo_cliente: suficiente para derivar el tipo de NCF automaticamente (RNC presente -> B01, si no -> B02) y quitarle esa decision a la secretaria.';

comment on table vehiculos is
  '[ACTIVA] Nucleo del taller.';

comment on table profiles is
  '[ACTIVA] Usuarios con role tipo enum e id uuid. Es el ancla del RLS. Las tablas de cobro guardan usuario como texto libre en vez de FK aqui: ese es el bloqueador #1.';

comment on table usuarios is
  '[REVISAR] Coexiste con profiles. Definir cual manda antes de implementar RLS.';


-- ---------------------------------------------------------------------
-- MUERTAS - candidatas a eliminar (ver script 02)
-- ---------------------------------------------------------------------
comment on table ventas is
  '[MUERTA] 0 filas. POS viejo reemplazado por ul_ventas y facturas.';

comment on table venta_items is
  '[MUERTA] 0 filas. Lineas del POS viejo.';

comment on table productos is
  '[MUERTA] 0 filas. Tercer catalogo, nunca poblado. Los vivos son repuestos e inventario.';

comment on table ordenes is
  '[MUERTA] 0 filas. Reemplazada por ordenes_trabajo (11 filas).';

comment on table ncf_config is
  '[ACTIVA] 4 filas (confirmado con count(*) real: pg_stat reportaba 0 por estimado desactualizado). Secuencia NCF COMPARTIDA por tres endpoints del backend: POST /facturas, POST /ventas y POST /cafeteria/venta. Por eso los NCF del taller y de la cafeteria se intercalan en la misma serie B02. Correcto si ambos facturan bajo el mismo RNC; si no, hay que separarlos.';


-- =====================================================================
-- LEER LA CLASIFICACION (usar este query en contextos futuros)
-- =====================================================================
-- select
--   c.relname                        as tabla,
--   s.n_live_tup                     as filas,
--   obj_description(c.oid, 'pg_class') as estado
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- left join pg_stat_user_tables s on s.relid = c.oid
-- where n.nspname = 'public'
--   and c.relkind = 'r'
-- order by
--   case
--     when obj_description(c.oid,'pg_class') like '[MUERTA]%'     then 1
--     when obj_description(c.oid,'pg_class') like '[REVISAR]%'    then 2
--     when obj_description(c.oid,'pg_class') like '[SIN LANZAR]%' then 3
--     when obj_description(c.oid,'pg_class') like '[ACTIVA]%'     then 4
--     else 5
--   end,
--   c.relname;
-- =====================================================================
