-- ═════════════════════════════════════════════════════════════════════
-- MÓDULO DE AUDITORÍA — tabla log_acciones
-- Ejecutar en Supabase: SQL Editor → New query → pegar → Run
-- ═════════════════════════════════════════════════════════════════════

create table if not exists public.log_acciones (
  id             bigserial primary key,
  created_at     timestamptz not null default now(),
  usuario_id     integer,
  usuario_nombre text not null default 'Sistema',
  usuario_rol    text,
  accion         text not null,   -- CREAR | EDITAR | ELIMINAR | ANULAR | COBRAR | PAGAR | LOGIN
  modulo         text not null,   -- facturas | usuarios | permisos | clientes | vehiculos | inventario | caja_chica | nomina | sesion
  registro_id    text,            -- id del registro afectado
  descripcion    text,            -- texto legible: "Anuló factura B0200000123 de Juan Pérez"
  detalle        jsonb not null default '{}'::jsonb,  -- datos extra (montos, valores anteriores, etc.)
  ip             text
);

-- Índices para los filtros de la página /auditoria
create index if not exists idx_log_acciones_fecha   on public.log_acciones (created_at desc);
create index if not exists idx_log_acciones_modulo  on public.log_acciones (modulo);
create index if not exists idx_log_acciones_accion  on public.log_acciones (accion);
create index if not exists idx_log_acciones_usuario on public.log_acciones (usuario_nombre);

-- El log debe ser inmutable: nadie actualiza ni borra registros de auditoría.
-- (Con la service key el backend puede insertar; estas políticas aplican si se activa RLS)
alter table public.log_acciones enable row level security;

drop policy if exists log_acciones_insert on public.log_acciones;
create policy log_acciones_insert on public.log_acciones for insert with check (true);

drop policy if exists log_acciones_select on public.log_acciones;
create policy log_acciones_select on public.log_acciones for select using (true);
-- Sin políticas de UPDATE ni DELETE → inmutable vía API anon.
