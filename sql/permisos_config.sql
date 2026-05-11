-- ─────────────────────────────────────────────────────────────────────────────
-- Tabla config_sistema — almacena pares clave/valor de configuración global
-- Corre este script en el SQL Editor de Supabase
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists config_sistema (
  clave      text primary key,
  valor      jsonb        not null default '{}',
  updated_at timestamptz  not null default now()
);

-- Permite que el backend (service_role) lea y escriba sin restricciones
alter table config_sistema enable row level security;

-- Solo el backend con service_role puede modificar esta tabla
create policy "Solo service_role puede acceder a config_sistema"
  on config_sistema
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
