-- ============================================================
-- TSB Cache: boletines de servicio y quejas NHTSA por vehículo
-- Ejecutar en Supabase SQL Editor
-- ============================================================

create table if not exists public.tsb_cache (
  id          serial primary key,
  vehicle_key text    not null unique,   -- "HYUNDAI|SANTAFE|2010"
  marca       text,
  modelo      text,
  ano         integer,
  complaints  jsonb   default '[]'::jsonb,
  recalls     jsonb   default '[]'::jsonb,
  updated_at  timestamp with time zone default now()
);

-- Índice para búsqueda rápida
create index if not exists idx_tsb_cache_vehicle_key on public.tsb_cache(vehicle_key);

-- RLS: solo usuarios autenticados pueden leer/escribir
alter table public.tsb_cache enable row level security;

create policy "Autenticados pueden ver tsb_cache"
  on public.tsb_cache for select
  using (auth.role() = 'authenticated');

create policy "Autenticados pueden insertar tsb_cache"
  on public.tsb_cache for insert
  with check (auth.role() = 'authenticated');

create policy "Autenticados pueden actualizar tsb_cache"
  on public.tsb_cache for update
  using (auth.role() = 'authenticated');

-- Comentarios
comment on table  public.tsb_cache              is 'Cache de boletines NHTSA (quejas + recalls) por marca/modelo/año. TTL ~30 días.';
comment on column public.tsb_cache.vehicle_key  is 'Clave compuesta MARCA|MODELO|AÑO en mayúsculas, sin espacios en modelo (ej: HYUNDAI|SANTAFE|2010)';
comment on column public.tsb_cache.complaints   is 'Array de quejas NHTSA — cada objeto tiene {component, summary, numberOfComplaints, ...}';
comment on column public.tsb_cache.recalls      is 'Array de recalls NHTSA — cada objeto tiene {campaignNumber, consequence, remedy, ...}';
