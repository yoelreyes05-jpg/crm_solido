-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN V10 — MÓDULO DE NÓMINA (República Dominicana)
-- Ejecutar en Supabase SQL Editor
--
-- Base legal (Código de Trabajo RD + Ley 87-01 Seguridad Social, tasas 2026):
--   Empleado:  AFP 2.87% · SFS 3.04% · ISR escala DGII
--   Empleador: AFP 7.10% · SFS 7.09% · SRL ~1.20% · INFOTEP 1.00%
--   Topes cotizables (feb 2026, salario mínimo cotizable RD$23,223):
--     SFS: RD$232,230/mes · AFP: RD$464,460/mes · SRL: RD$92,892/mes
--   ISR 2026 (anual): exento hasta 416,220 · 15% hasta 624,329
--     · 31,216 + 20% hasta 867,123 · 79,776 + 25% en adelante
--   Las comisiones son salario ordinario: cotizan TSS y pagan ISR.
--   La Regalía Pascual (salario 13) está exenta de TSS e ISR.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. EMPLEADOS ───────────────────────────────────────────────────────────
create table if not exists public.empleados (
  id              bigserial primary key,
  usuario_id      integer null references usuarios (id) on delete set null, -- vincula al usuario del sistema (técnicos: para calcular comisiones por órdenes)
  nombre          text not null,
  cedula          text null,
  telefono        text null,
  puesto          text null,                          -- ej: Técnico mecánico, Secretaria, Gerente
  tipo            text not null default 'administrativo'
                  check (tipo in ('tecnico','administrativo')),
  fecha_ingreso   date null,                          -- necesaria para prestaciones (cesantía, vacaciones, regalía)
  salario_mensual numeric(12,2) not null default 0,
  frecuencia_pago text not null default 'QUINCENAL'
                  check (frecuencia_pago in ('QUINCENAL','MENSUAL')),
  comision_pct    numeric(5,2) not null default 0,    -- % sobre mano de obra facturada (solo técnicos)
  metodo_pago     text null default 'TRANSFERENCIA',  -- TRANSFERENCIA / EFECTIVO / CHEQUE
  banco           text null,
  cuenta_banco    text null,
  tss_aplica      boolean not null default true,      -- false = empleado informal/no inscrito en TSS
  isr_aplica      boolean not null default true,
  activo          boolean not null default true,
  notas           text null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_empleados_activo on public.empleados (activo);

-- ─── 2. NÓMINAS (corridas de pago) ─────────────────────────────────────────
create table if not exists public.nominas (
  id                     bigserial primary key,
  tipo                   text not null
                         check (tipo in ('QUINCENA_1','QUINCENA_2','MENSUAL','REGALIA')),
  periodo_inicio         date not null,
  periodo_fin            date not null,
  estado                 text not null default 'BORRADOR'
                         check (estado in ('BORRADOR','PAGADA','ANULADA')),
  total_bruto            numeric(14,2) not null default 0,
  total_deducciones      numeric(14,2) not null default 0,
  total_neto             numeric(14,2) not null default 0,
  total_aporte_empleador numeric(14,2) not null default 0, -- costo patronal adicional (AFP+SFS+SRL+INFOTEP)
  creado_por             text null,
  pagada_at              timestamptz null,
  notas                  text null,
  created_at             timestamptz not null default now()
);

create index if not exists idx_nominas_periodo on public.nominas (periodo_inicio desc);

-- ─── 3. DETALLE POR EMPLEADO ────────────────────────────────────────────────
create table if not exists public.nomina_detalle (
  id                  bigserial primary key,
  nomina_id           bigint not null references nominas (id) on delete cascade,
  empleado_id         bigint not null references empleados (id),
  empleado_nombre     text not null,                  -- snapshot histórico
  puesto              text null,
  -- INGRESOS
  salario_base        numeric(12,2) not null default 0,
  comisiones          numeric(12,2) not null default 0,
  comisiones_detalle  jsonb not null default '[]'::jsonb, -- [{factura_id, ncf, orden_id, mano_obra, pct, comision}]
  horas_extra         numeric(12,2) not null default 0,   -- monto RD$
  otros_ingresos      numeric(12,2) not null default 0,
  otros_ingresos_desc text null,
  total_bruto         numeric(12,2) not null default 0,
  -- DEDUCCIONES (empleado)
  afp_empleado        numeric(12,2) not null default 0,   -- 2.87%
  sfs_empleado        numeric(12,2) not null default 0,   -- 3.04%
  isr                 numeric(12,2) not null default 0,
  otros_descuentos    numeric(12,2) not null default 0,   -- avances, préstamos, etc.
  otros_descuentos_desc text null,
  total_deducciones   numeric(12,2) not null default 0,
  neto                numeric(12,2) not null default 0,
  -- APORTES DEL EMPLEADOR (no se descuentan al empleado, son costo del taller)
  afp_empleador       numeric(12,2) not null default 0,   -- 7.10%
  sfs_empleador       numeric(12,2) not null default 0,   -- 7.09%
  srl_empleador       numeric(12,2) not null default 0,   -- ~1.20%
  infotep             numeric(12,2) not null default 0,   -- 1.00%
  -- PAGO
  metodo_pago         text null,
  referencia_pago     text null,
  created_at          timestamptz not null default now()
);

create index if not exists idx_nomina_detalle_nomina on public.nomina_detalle (nomina_id);
create index if not exists idx_nomina_detalle_empleado on public.nomina_detalle (empleado_id);
