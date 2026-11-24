-- ═══════════════════════════════════════════════════════════════════════════
-- v33 — Código QR por cliente para entrar a la app del cliente
-- ═══════════════════════════════════════════════════════════════════════════
-- Cada cliente recibe un token aleatorio (32 caracteres hex, 122 bits). El QR
-- que se imprime/envía al cliente es un enlace a la app:
--     https://<app>/cliente?qr=<token>
-- Al escanearlo, el portal crea una sesión (nivel 'qr') y el cliente ve su
-- vehículo, su historial y sus planes de mantenimiento (cambio de aceite, etc.).
--
-- El DEFAULT hace que TODO cliente nuevo nazca con su QR sin tocar el insert,
-- y al agregar la columna Postgres lo evalúa por fila, así que los clientes
-- existentes también quedan con su propio token.
--
-- Idempotente: se puede correr más de una vez.
-- ═══════════════════════════════════════════════════════════════════════════

alter table clientes
  add column if not exists qr_token text
  default replace(gen_random_uuid()::text, '-', '');

alter table clientes
  add column if not exists qr_generado_en timestamptz default now();

-- Por si la columna ya existía sin valor en algunas filas.
update clientes
   set qr_token = replace(gen_random_uuid()::text, '-', ''),
       qr_generado_en = coalesce(qr_generado_en, now())
 where qr_token is null;

create unique index if not exists clientes_qr_token_uidx on clientes (qr_token);

-- Nuevo nivel de sesión del portal.
alter table portal_sesiones drop constraint if exists portal_sesiones_nivel_acceso_check;
alter table portal_sesiones
  add constraint portal_sesiones_nivel_acceso_check
  check (nivel_acceso in ('telefono', 'correo', 'mostrador', 'qr'));

-- Nueva acción en la bitácora de intentos (rate limiting).
alter table portal_intentos drop constraint if exists portal_intentos_accion_check;
alter table portal_intentos
  add constraint portal_intentos_accion_check
  check (accion in ('placa_telefono', 'solicitar_codigo',
                    'verificar_codigo', 'codigo_mostrador', 'qr'));

-- Verificación: debe dar 0.
-- select count(*) from clientes where qr_token is null;
