-- ============================================================================
-- portal_cliente.sql — Acceso seguro a la App Cliente
-- Sólido Auto Servicio · resuelve el punto #3 de MEJORAS_CRM_Y_APP_CLIENTE.md
--
-- Hoy /cliente descarga TODOS los vehículos, órdenes y diagnósticos al navegador
-- y filtra por placa en el cliente. Cualquier visitante ve la base completa
-- (Ley 172-13). Estas tablas soportan el reemplazo: el cliente se identifica y
-- el backend devuelve SOLO su vehículo.
--
-- Tres niveles de acceso, en orden de fricción:
--   1. placa + últimos 4 dígitos del teléfono registrado  → instantáneo
--   2. código de 6 dígitos al correo registrado           → si no hay teléfono
--   3. código dictado por la secretaria desde el mostrador → si no hay ninguno
--
-- WhatsApp queda cableado en el diseño (columna `canal`) pero apagado. Cuando
-- consigas la API empresarial, solo insertas OTP con canal='whatsapp' y el
-- resto del flujo ya funciona sin cambios.
--
-- IDs: clientes.id y vehiculos.id son int4; ordenes_trabajo.id es bigint.
-- Este script respeta esos tipos.
-- ============================================================================

begin;

create extension if not exists pgcrypto;

-- ── 1. Códigos OTP ──────────────────────────────────────────────────────────
-- El código nunca se guarda en claro: solo sha256(codigo || salt).
create table if not exists portal_otp (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    integer not null references clientes(id) on delete cascade,
  vehiculo_id   integer     references vehiculos(id) on delete cascade,
  canal         text    not null default 'correo'
                  check (canal in ('correo', 'whatsapp', 'sms')),
  destino       text    not null,   -- correo/teléfono al que se envió (para auditoría)
  codigo_hash   text    not null,
  salt          text    not null,
  intentos      smallint not null default 0,
  max_intentos  smallint not null default 5,
  expira_en     timestamptz not null,
  consumido_en  timestamptz,
  ip_solicitud  text,
  creado_en     timestamptz not null default now()
);

create index if not exists idx_portal_otp_cliente
  on portal_otp (cliente_id, creado_en desc);
create index if not exists idx_portal_otp_vigente
  on portal_otp (cliente_id, expira_en) where consumido_en is null;

-- ── 2. Códigos de mostrador ─────────────────────────────────────────────────
-- La secretaria lo genera desde la ficha y se lo dicta al cliente. Vive 24h
-- (el cliente entra cuando llegue a su casa) pero es de un solo uso y queda
-- registrado quién lo generó.
create table if not exists portal_codigos_mostrador (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    integer not null references clientes(id) on delete cascade,
  codigo_hash   text    not null,
  salt          text    not null,
  generado_por  text,               -- usuarios.nombre o email de quien lo generó
  intentos      smallint not null default 0,
  max_intentos  smallint not null default 5,
  expira_en     timestamptz not null default (now() + interval '24 hours'),
  consumido_en  timestamptz,
  creado_en     timestamptz not null default now()
);

create index if not exists idx_portal_mostrador_cliente
  on portal_codigos_mostrador (cliente_id, creado_en desc);

-- Un solo código vigente por cliente: si la secretaria genera otro, el anterior
-- debe invalidarse primero (el backend lo hace).
create unique index if not exists uq_portal_mostrador_vigente
  on portal_codigos_mostrador (cliente_id) where consumido_en is null;

-- ── 3. Sesiones del portal ──────────────────────────────────────────────────
-- El token que recibe el cliente lleva el id de esta fila. Guardarla en base
-- permite revocar (cliente vendió el carro, teléfono robado, etc.).
create table if not exists portal_sesiones (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      integer not null references clientes(id) on delete cascade,
  vehiculo_id     integer     references vehiculos(id) on delete cascade,
  token_hash      text    not null,
  nivel_acceso    text    not null default 'telefono'
                    check (nivel_acceso in ('telefono', 'correo', 'mostrador')),
  user_agent      text,
  ip              text,
  creado_en       timestamptz not null default now(),
  ultimo_uso_en   timestamptz not null default now(),
  expira_en       timestamptz not null default (now() + interval '30 days'),
  revocado_en     timestamptz,
  revocado_motivo text
);

create index if not exists idx_portal_sesiones_token on portal_sesiones (token_hash);
create index if not exists idx_portal_sesiones_cliente
  on portal_sesiones (cliente_id) where revocado_en is null;

-- ── 4. Bitácora de intentos (rate limiting) ─────────────────────────────────
create table if not exists portal_intentos (
  id            bigserial primary key,
  identificador text not null,      -- placa normalizada o cliente_id
  ip            text,
  accion        text not null
                  check (accion in ('placa_telefono', 'solicitar_codigo',
                                    'verificar_codigo', 'codigo_mostrador')),
  exito         boolean not null default false,
  creado_en     timestamptz not null default now()
);

create index if not exists idx_portal_intentos_ident on portal_intentos (identificador, creado_en desc);
create index if not exists idx_portal_intentos_ip    on portal_intentos (ip, creado_en desc);

-- ── 5. RLS ──────────────────────────────────────────────────────────────────
-- Estas tablas SOLO las toca el backend con la service_role key. Si el rol
-- anon pudiera leer portal_otp vería hashes y destinos; si pudiera leer
-- portal_sesiones vería tokens. RLS activo sin políticas = nadie excepto
-- service_role (que ignora RLS por diseño en Supabase).
alter table portal_otp               enable row level security;
alter table portal_codigos_mostrador enable row level security;
alter table portal_sesiones          enable row level security;
alter table portal_intentos          enable row level security;

-- ── 6. Limpieza ─────────────────────────────────────────────────────────────
create or replace function portal_limpiar_expirados()
returns void language sql security definer set search_path = public as $$
  delete from portal_otp               where expira_en < now() - interval '7 days';
  delete from portal_codigos_mostrador where expira_en < now() - interval '7 days';
  delete from portal_sesiones          where expira_en < now() - interval '7 days'
                                          or (revocado_en is not null
                                              and revocado_en < now() - interval '30 days');
  delete from portal_intentos          where creado_en < now() - interval '30 days';
$$;

-- Con pg_cron habilitado en Supabase:
-- select cron.schedule('portal-limpieza', '0 4 * * *', 'select portal_limpiar_expirados()');

commit;


-- ============================================================================
-- DIAGNÓSTICO — CORRE ESTO ANTES DE TOCAR EL FRONTEND
-- ============================================================================
-- Te dice qué porcentaje de tus clientes puede usar cada nivel de acceso.
-- Si "sin_ningun_contacto" sale alto, el código de mostrador deja de ser un
-- caso borde y se vuelve el camino principal — y ahí es donde debes poner el
-- esfuerzo de UI, no en el OTP por correo.

-- select
--   count(*)                                                          as total,
--   count(*) filter (where telefono ~ '[0-9]{4}')                     as nivel1_telefono,
--   count(*) filter (where email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
--                                                                     as nivel2_correo,
--   count(*) filter (where telefono !~ '[0-9]{4}'
--                      and (email is null or email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'))
--                                                                     as solo_mostrador,
--   round(100.0 * count(*) filter (where telefono ~ '[0-9]{4}')
--         / nullif(count(*),0), 1)                                    as pct_nivel1
-- from clientes
-- where coalesce(activo, true);

-- Teléfonos con los MISMOS últimos 4 dígitos entre clientes distintos:
-- no rompe el login (la placa desambigua) pero conviene saber el número.
-- select right(regexp_replace(telefono, '[^0-9]', '', 'g'), 4) as ult4,
--        count(*) as clientes
-- from clientes
-- where telefono ~ '[0-9]{4}' and coalesce(activo, true)
-- group by 1 having count(*) > 1 order by 2 desc limit 20;

-- Vehículos con placa duplicada — rompen la búsqueda por placa. Resuélvelos.
-- select upper(trim(placa)) as placa, count(*) as veces,
--        string_agg(id::text, ', ') as vehiculos
-- from vehiculos
-- where placa is not null and placa <> '' and coalesce(activo, true)
-- group by 1 having count(*) > 1 order by 2 desc;
