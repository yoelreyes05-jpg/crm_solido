-- ============================================================================
-- servicio_express.sql — Ciclo corto para servicios que no requieren cotización
-- Sólido Auto Servicio
--
-- Problema que resuelve: un cambio de aceite pasa hoy por el mismo flujo que
-- una reparación mayor (diagnóstico → esperando aprobación → reparación →
-- control de calidad → listo). El cliente recibe un aviso pidiéndole que
-- apruebe una cotización que nunca pidió, y la orden se queda trabada
-- esperando una aprobación que no tiene sentido.
--
-- Con el ciclo express el camino es:
--     RECIBIDO → DIAGNOSTICO → LISTO → ENTREGADO
--
-- El diagnóstico se sigue registrando: es la revisión de cortesía que hace el
-- técnico mientras trabaja. Queda en el expediente y el cliente lo ve marcado
-- como recomendación, no como algo que se le va a cobrar. Ese registro es lo
-- que permite ofrecerle el trabajo mayor en la próxima visita.
-- ============================================================================

begin;

-- ── Marca de servicio express ───────────────────────────────────────────────
-- La activa la secretaria en recepción. Es una decisión manual a propósito:
-- deducirla del texto del motivo de entrada fallaría en cuanto alguien
-- escriba "cambio aceite" en vez de "cambio de aceite".
alter table ordenes_trabajo
  add column if not exists es_express boolean not null default false;

comment on column ordenes_trabajo.es_express is
  'Ciclo corto: RECIBIDO → DIAGNOSTICO → LISTO → ENTREGADO. Sin cotización ni aprobación del cliente.';

-- Motivo por el que se marcó, para auditoría y para saber qué servicios
-- terminan siendo express en la práctica.
alter table ordenes_trabajo
  add column if not exists express_motivo text;

-- ── Diagnóstico de cortesía ─────────────────────────────────────────────────
-- Distingue el diagnóstico que el cliente pidió y va a pagar, del chequeo de
-- rutina que el técnico hace de gratis durante un servicio express. Sin esta
-- marca el cliente ve hallazgos en su portal y asume que se los van a cobrar.
alter table diagnosticos
  add column if not exists es_cortesia boolean not null default false;

comment on column diagnosticos.es_cortesia is
  'Revisión de cortesía durante un servicio express. No facturable; se muestra al cliente como recomendación.';

create index if not exists idx_ordenes_express
  on ordenes_trabajo (es_express) where es_express;

commit;


-- ============================================================================
-- CONSULTAS ÚTILES
-- ============================================================================

-- Qué servicios se están marcando como express — sirve para decidir si algún
-- día vale la pena automatizar la marca por tipo de servicio.
-- select coalesce(motivo_entrada, descripcion, '(sin motivo)') as servicio,
--        count(*) as veces
-- from ordenes_trabajo
-- where es_express and created_at > now() - interval '90 days'
-- group by 1 order by 2 desc;

-- Hallazgos de cortesía que nunca se convirtieron en trabajo: son la lista de
-- oportunidades de venta que el taller está dejando pasar.
-- select d.id, d.created_at, c.nombre as cliente, c.telefono,
--        v.marca, v.modelo, v.placa, d.fallas_identificadas
-- from diagnosticos d
-- join ordenes_trabajo o on o.id = d.orden_id
-- left join clientes c on c.id = d.cliente_id
-- left join vehiculos v on v.id = d.vehiculo_id
-- where (d.es_cortesia or o.es_express)
--   and d.fallas_identificadas is not null
--   and length(trim(d.fallas_identificadas)) > 20
--   and d.created_at > now() - interval '180 days'
-- order by d.created_at desc;

-- Tiempo promedio de un express contra el flujo normal.
-- select es_express,
--        count(*) as ordenes,
--        round(avg(extract(epoch from (fecha_entrega - created_at)) / 3600)::numeric, 1) as horas_promedio
-- from ordenes_trabajo
-- where fecha_entrega is not null and created_at > now() - interval '90 days'
-- group by 1;
