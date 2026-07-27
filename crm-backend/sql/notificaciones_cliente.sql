-- ============================================================================
-- notificaciones_cliente.sql — Avisos automáticos al cliente
-- Sólido Auto Servicio · complementa portal_cliente.sql
--
-- Hoy `transicionarEstado()` en server.mjs solo notifica por WhatsApp, y como
-- la API empresarial de Meta todavía no está aprobada, en la práctica el
-- cliente no recibe nada: se entera del estado de su vehículo solo si entra al
-- portal a mirar.
--
-- Esto agrega dos canales que sí funcionan hoy:
--   · CORREO  — vía Brevo, el mismo proveedor que ya envía las citas
--   · PUSH    — notificación del teléfono a través de la PWA ya instalada
--
-- La tabla `notificaciones` existente NO sirve para esto: es para el personal
-- interno y arrastra columnas de una plantilla médica (`paciente_id`,
-- `cita_id`). Por eso una tabla propia.
-- ============================================================================

begin;

-- ── 1. Bitácora de envíos ───────────────────────────────────────────────────
-- Sirve para tres cosas: no repetir el mismo aviso, diagnosticar entregas
-- fallidas, y responderle al cliente que dice "nunca me avisaron".
create table if not exists notificaciones_cliente (
  id            bigserial primary key,
  cliente_id    integer not null references clientes(id) on delete cascade,
  vehiculo_id   integer     references vehiculos(id) on delete set null,
  orden_id      bigint      references ordenes_trabajo(id) on delete set null,

  evento        text    not null,          -- 'LISTO', 'ESPERANDO_APROBACION', ...
  canal         text    not null check (canal in ('correo', 'push', 'whatsapp')),
  destino       text,                      -- correo o endpoint (truncado)

  titulo        text,
  mensaje       text,

  estado        text    not null default 'enviado'
                  check (estado in ('enviado', 'fallido', 'omitido')),
  detalle_error text,

  creado_en     timestamptz not null default now()
);

create index if not exists idx_notif_cli_cliente
  on notificaciones_cliente (cliente_id, creado_en desc);

-- Clave del anti-duplicado: una orden no avisa dos veces del mismo estado por
-- el mismo canal. Sin esto, arrastrar una tarjeta del kanban de ida y vuelta
-- le manda tres correos al cliente.
create unique index if not exists uq_notif_cli_evento
  on notificaciones_cliente (orden_id, evento, canal)
  where estado = 'enviado' and orden_id is not null;

-- ── 2. Suscripciones push de la PWA ─────────────────────────────────────────
-- Cada navegador/dispositivo donde el cliente acepta notificaciones genera una
-- suscripción distinta. Un mismo cliente puede tener varias (celular, tablet).
create table if not exists portal_push_suscripciones (
  id            bigserial primary key,
  cliente_id    integer not null references clientes(id) on delete cascade,
  vehiculo_id   integer     references vehiculos(id) on delete set null,

  endpoint      text    not null unique,   -- URL del push service del navegador
  p256dh        text    not null,          -- clave pública del cliente
  auth          text    not null,          -- secreto de autenticación

  user_agent    text,
  creado_en     timestamptz not null default now(),
  ultimo_uso_en timestamptz,
  fallos        smallint not null default 0,   -- se depura sola a los 5 fallos
  activa        boolean not null default true
);

create index if not exists idx_push_cliente
  on portal_push_suscripciones (cliente_id) where activa;

-- ── 3. Preferencias por cliente ─────────────────────────────────────────────
-- Poder apagar los avisos es requisito para no terminar marcado como spam, y
-- lo pide la Ley 172-13 en cuanto a tratamiento de datos con fines de contacto.
create table if not exists portal_preferencias_notif (
  cliente_id    integer primary key references clientes(id) on delete cascade,
  correo        boolean not null default true,
  push          boolean not null default true,
  whatsapp      boolean not null default true,
  actualizado_en timestamptz not null default now()
);

-- ── 4. RLS ──────────────────────────────────────────────────────────────────
-- Solo el backend (service_role) las toca. `portal_push_suscripciones` guarda
-- claves criptográficas: si el rol anon pudiera leerlas, cualquiera podría
-- mandarle notificaciones falsas a tus clientes.
alter table notificaciones_cliente        enable row level security;
alter table portal_push_suscripciones     enable row level security;
alter table portal_preferencias_notif     enable row level security;

-- ── 5. Limpieza ─────────────────────────────────────────────────────────────
create or replace function portal_limpiar_notificaciones()
returns void language sql security definer set search_path = public as $$
  delete from notificaciones_cliente
    where creado_en < now() - interval '1 year';
  delete from portal_push_suscripciones
    where not activa and creado_en < now() - interval '90 days';
$$;

commit;


-- ============================================================================
-- DIAGNÓSTICO — cuántos clientes pueden recibir avisos hoy
-- ============================================================================
-- El correo solo llega a quien tenga uno válido en ficha. Si el porcentaje es
-- bajo, la notificación push de la PWA no es un extra: es el canal principal,
-- porque no depende de tener correo ni de la API de WhatsApp.

-- select
--   count(*) as total,
--   count(*) filter (where email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
--            as pueden_recibir_correo,
--   round(100.0 * count(*) filter (
--     where email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
--     / nullif(count(*),0), 1) as pct_correo
-- from clientes
-- where coalesce(activo, true);

-- Después de unas semanas en producción, qué tan bien está llegando cada canal:
-- select canal, estado, count(*)
-- from notificaciones_cliente
-- where creado_en > now() - interval '30 days'
-- group by 1, 2 order by 1, 2;
