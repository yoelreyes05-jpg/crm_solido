-- ============================================================================
-- citas_app_telegram.sql — Citas desde la app del cliente y desde Telegram
-- Sólido Auto Servicio · complementa citas_web.sql
--
-- Agrega tres cosas:
--   1. Columnas nuevas en `citas_taller` para saber de dónde vino la cita
--      (APP / TELEGRAM) y a qué chat de Telegram responderle.
--   2. Bitácora de notificaciones de citas, con anti-duplicado propio: la
--      tabla `notificaciones_cliente` tiene su índice único atado a
--      `orden_id`, y una cita no tiene orden.
--   3. Estado de la conversación del bot de Telegram, para que el flujo
--      "placa → fecha → hora → motivo" sobreviva a un reinicio de Railway.
--      Sin esto, cada vez que Railway redespliega, el cliente que estaba a
--      medio agendar pierde el hilo y tiene que empezar de cero.
--
-- Ejecutar UNA sola vez en el SQL Editor de Supabase. Es idempotente.
-- ============================================================================

begin;

-- ── 1. Columnas nuevas en citas_taller ──────────────────────────────────────
alter table citas_taller
  -- 'CRM' | 'WEB' | 'APP' | 'TELEGRAM'
  add column if not exists origen              text default 'CRM',
  -- A qué chat de Telegram avisarle cuando la secretaria confirme o cancele.
  add column if not exists telegram_chat_id    text,
  -- Recordatorio del día anterior y el de una hora antes son dos avisos
  -- distintos; con un solo booleano el segundo nunca se manda.
  add column if not exists recordatorio_dia_enviado  boolean default false,
  add column if not exists recordatorio_hora_enviado boolean default false,
  -- Quién canceló: el cliente desde la app o el taller.
  add column if not exists cancelada_por       text;

create index if not exists idx_citas_cliente  on citas_taller (cliente_id);
create index if not exists idx_citas_telegram on citas_taller (telegram_chat_id);

-- ── 2. Bitácora de avisos de citas ──────────────────────────────────────────
-- Separada de `notificaciones_cliente` a propósito: aquella cuelga de una
-- orden de trabajo (`orden_id`), y su índice anti-duplicado exige que exista.
-- Una cita agendada todavía no tiene orden.
create table if not exists notificaciones_cita (
  id            bigserial primary key,
  cita_id       bigint  not null references citas_taller(id) on delete cascade,
  cliente_id    integer references clientes(id) on delete set null,

  evento        text    not null,   -- AGENDADA | CONFIRMADA | CANCELADA | RECORDATORIO_DIA | RECORDATORIO_HORA
  canal         text    not null check (canal in ('correo', 'push', 'telegram')),
  destino       text,

  titulo        text,
  mensaje       text,

  estado        text    not null default 'enviado'
                  check (estado in ('enviado', 'fallido', 'omitido')),
  detalle_error text,

  creado_en     timestamptz not null default now()
);

create index if not exists idx_notif_cita_cita
  on notificaciones_cita (cita_id, creado_en desc);

-- El anti-duplicado. Sin esto, si la secretaria toca dos veces "confirmar",
-- al cliente le llegan dos correos idénticos.
create unique index if not exists uq_notif_cita_evento
  on notificaciones_cita (cita_id, evento, canal)
  where estado = 'enviado';

-- ── 3. Estado de la conversación del bot de Telegram ────────────────────────
-- Una fila por chat. `paso` dice en qué pregunta va y `datos` guarda lo que
-- el cliente ya respondió. Se limpia sola: cualquier fila de más de 2 horas
-- se considera abandonada.
create table if not exists telegram_conversaciones (
  chat_id       text primary key,
  flujo         text not null default 'cita',   -- por si mañana hay otros flujos
  paso          text not null,                  -- placa | nombre | fecha | hora | motivo | confirmar
  datos         jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now()
);

create index if not exists idx_tg_conv_actualizado
  on telegram_conversaciones (actualizado_en);

-- ── 4. RLS ──────────────────────────────────────────────────────────────────
-- Solo el backend (service_role) las toca.
alter table notificaciones_cita     enable row level security;
alter table telegram_conversaciones enable row level security;

-- ── 5. Limpieza ─────────────────────────────────────────────────────────────
create or replace function citas_limpiar_auxiliares()
returns void language sql security definer set search_path = public as $$
  delete from telegram_conversaciones
    where actualizado_en < now() - interval '2 hours';
  delete from notificaciones_cita
    where creado_en < now() - interval '1 year';
$$;

commit;


-- ============================================================================
-- DIAGNÓSTICO
-- ============================================================================
-- De dónde están llegando las citas:
-- select origen, estado, count(*) from citas_taller group by 1,2 order by 1,2;

-- Cómo está llegando cada canal de aviso de citas:
-- select canal, estado, count(*) from notificaciones_cita
-- where creado_en > now() - interval '30 days' group by 1,2 order by 1,2;
