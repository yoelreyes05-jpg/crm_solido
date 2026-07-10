-- ============================================================
-- SOLIDO AUTO SERVICIO - Migracion v19
-- PLANES / MEMBRESIAS (Lavado, Basico, Premium, VIP)
-- Beneficios editables por tabla (sin tocar codigo).
-- Conecta automatico con: Car Wash, Facturacion, Fidelizacion,
-- Caja/Contabilidad y Alertas de renovacion.
-- Ejecutar en Supabase -> SQL Editor.
-- ============================================================

-- ── Catalogo de planes ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_catalogo (
  id             BIGSERIAL PRIMARY KEY,
  nombre         VARCHAR(100) NOT NULL,          -- Plan Lavado, Basico, Premium, VIP
  emoji          VARCHAR(10)  DEFAULT '⭐',
  color          VARCHAR(20)  DEFAULT '#3b82f6',
  descripcion    TEXT,
  precio_mensual NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_anual   NUMERIC(12,2) DEFAULT 0,        -- 0 = no se ofrece anual
  orden          INT DEFAULT 0,                  -- orden de despliegue
  activo         BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Beneficios por plan (1 fila = 1 beneficio, editable) ─────
-- tipos soportados por el backend:
--   lavados_mes          (numero; -1 = ilimitado)
--   diagnosticos_mes     (numero; -1 = ilimitado)
--   desc_servicios       (porcentaje 0-100)
--   desc_repuestos       (porcentaje 0-100)
--   multiplicador_puntos (1, 2, 3...)
--   prioridad            (1 = prioridad en cola del taller)
CREATE TABLE IF NOT EXISTS plan_beneficios (
  id         BIGSERIAL PRIMARY KEY,
  plan_id    BIGINT REFERENCES plan_catalogo(id) ON DELETE CASCADE,
  tipo       VARCHAR(40) NOT NULL,
  valor      NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (plan_id, tipo)
);

-- ── Membresias de clientes ───────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_membresias (
  id               BIGSERIAL PRIMARY KEY,
  cliente_id       BIGINT NOT NULL,              -- FK logica a clientes(id)
  plan_id          BIGINT REFERENCES plan_catalogo(id),
  estado           VARCHAR(20) DEFAULT 'ACTIVA', -- ACTIVA | VENCIDA | CANCELADA
  ciclo            VARCHAR(10) DEFAULT 'MENSUAL',-- MENSUAL | ANUAL
  fecha_inicio     DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_renovacion DATE NOT NULL,                -- vence/renueva en esta fecha
  notas            TEXT,
  created_by       VARCHAR(100),
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Consumos de beneficios (control "le quedan X este mes") ──
CREATE TABLE IF NOT EXISTS plan_consumos (
  id            BIGSERIAL PRIMARY KEY,
  membresia_id  BIGINT REFERENCES plan_membresias(id) ON DELETE CASCADE,
  cliente_id    BIGINT NOT NULL,
  tipo          VARCHAR(40) NOT NULL,            -- lavado | diagnostico
  referencia_id BIGINT,                          -- id de la orden/lavado
  descripcion   TEXT,
  usuario       VARCHAR(100),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Pagos de membresias (ingresos recurrentes) ───────────────
CREATE TABLE IF NOT EXISTS plan_pagos (
  id            BIGSERIAL PRIMARY KEY,
  membresia_id  BIGINT REFERENCES plan_membresias(id) ON DELETE CASCADE,
  cliente_id    BIGINT NOT NULL,
  monto         NUMERIC(12,2) NOT NULL,
  metodo        VARCHAR(30) DEFAULT 'EFECTIVO',
  concepto      TEXT,                            -- "Inscripcion Plan VIP", "Renovacion mensual"
  usuario       VARCHAR(100),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Indices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_plan_memb_cliente ON plan_membresias(cliente_id);
CREATE INDEX IF NOT EXISTS idx_plan_memb_estado  ON plan_membresias(estado);
CREATE INDEX IF NOT EXISTS idx_plan_memb_renov   ON plan_membresias(fecha_renovacion);
CREATE INDEX IF NOT EXISTS idx_plan_cons_memb    ON plan_consumos(membresia_id);
CREATE INDEX IF NOT EXISTS idx_plan_cons_fecha   ON plan_consumos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_pagos_fecha  ON plan_pagos(created_at DESC);

-- ============================================================
--  SEED: los 4 planes con sus beneficios
--  (solo inserta si el catalogo esta vacio — seguro de re-ejecutar)
-- ============================================================
DO $$
DECLARE
  p_lavado  BIGINT; p_basico BIGINT; p_premium BIGINT; p_vip BIGINT;
BEGIN
  IF (SELECT COUNT(*) FROM plan_catalogo) = 0 THEN

    INSERT INTO plan_catalogo (nombre, emoji, color, descripcion, precio_mensual, precio_anual, orden)
    VALUES ('Plan Lavado', '🚿', '#0ea5e9', '4 lavados al mes + recordatorios', 1500, 15000, 1)
    RETURNING id INTO p_lavado;

    INSERT INTO plan_catalogo (nombre, emoji, color, descripcion, precio_mensual, precio_anual, orden)
    VALUES ('Plan Básico', '🔵', '#3b82f6', '1 lavado + 1 diagnóstico básico al mes, 5% en servicios', 2500, 25000, 2)
    RETURNING id INTO p_basico;

    INSERT INTO plan_catalogo (nombre, emoji, color, descripcion, precio_mensual, precio_anual, orden)
    VALUES ('Plan Premium', '🟣', '#8b5cf6', '2 lavados, diagnósticos ilimitados, 10% servicios, 5% repuestos, puntos x2', 4500, 45000, 3)
    RETURNING id INTO p_premium;

    INSERT INTO plan_catalogo (nombre, emoji, color, descripcion, precio_mensual, precio_anual, orden)
    VALUES ('Plan VIP', '👑', '#f59e0b', 'Lavados ilimitados, diagnósticos ilimitados, 15% servicios, 10% repuestos, puntos x3, prioridad', 8000, 80000, 4)
    RETURNING id INTO p_vip;

    INSERT INTO plan_beneficios (plan_id, tipo, valor) VALUES
      -- Lavado
      (p_lavado,  'lavados_mes',          4),
      -- Basico
      (p_basico,  'lavados_mes',          1),
      (p_basico,  'diagnosticos_mes',     1),
      (p_basico,  'desc_servicios',       5),
      (p_basico,  'multiplicador_puntos', 1),
      -- Premium
      (p_premium, 'lavados_mes',          2),
      (p_premium, 'diagnosticos_mes',    -1),
      (p_premium, 'desc_servicios',      10),
      (p_premium, 'desc_repuestos',       5),
      (p_premium, 'multiplicador_puntos', 2),
      (p_premium, 'prioridad',            1),
      -- VIP
      (p_vip,     'lavados_mes',         -1),
      (p_vip,     'diagnosticos_mes',    -1),
      (p_vip,     'desc_servicios',      15),
      (p_vip,     'desc_repuestos',      10),
      (p_vip,     'multiplicador_puntos', 3),
      (p_vip,     'prioridad',            1);
  END IF;
END $$;

-- Listo. 5 tablas + 4 planes sembrados con sus beneficios.
