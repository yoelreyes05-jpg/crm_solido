-- ============================================================================
-- Migración v16 — Módulo de Fidelización (Club Sólido) · Fase 1 (MVP)
-- ----------------------------------------------------------------------------
-- Programa de puntos multicanal con interruptor activo/desactivado.
-- Ejecutar UNA vez en Supabase → SQL Editor.
-- ============================================================================

-- 1) Configuración del programa (una sola fila, id = 1)
CREATE TABLE IF NOT EXISTS fidelizacion_config (
  id                INT PRIMARY KEY DEFAULT 1,
  activo            BOOLEAN     NOT NULL DEFAULT FALSE,  -- interruptor on/off
  rd_por_punto      NUMERIC(12,2) NOT NULL DEFAULT 100,  -- RD$ que equivalen a 1 punto
  valor_punto       NUMERIC(12,2) NOT NULL DEFAULT 1,    -- RD$ que vale 1 punto al canjear
  vencimiento_meses INT         NOT NULL DEFAULT 12,
  nivel_plata       NUMERIC(12,2) NOT NULL DEFAULT 10000,
  nivel_oro         NUMERIC(12,2) NOT NULL DEFAULT 30000,
  nivel_platino     NUMERIC(12,2) NOT NULL DEFAULT 75000,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fidelizacion_config_single CHECK (id = 1)
);

-- Fila por defecto (desactivado hasta que el gerente lo encienda)
INSERT INTO fidelizacion_config (id, activo)
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

-- 2) Estado de fidelización por cliente (acumulado para velocidad)
CREATE TABLE IF NOT EXISTS cliente_fidelizacion (
  cliente_id        BIGINT PRIMARY KEY REFERENCES clientes(id) ON DELETE CASCADE,
  saldo_puntos      INT         NOT NULL DEFAULT 0,
  puntos_historicos INT         NOT NULL DEFAULT 0,
  gasto_acumulado   NUMERIC(14,2) NOT NULL DEFAULT 0,
  nivel             TEXT        NOT NULL DEFAULT 'BRONCE',
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 3) Libro mayor de movimientos de puntos (fuente de verdad, inmutable)
CREATE TABLE IF NOT EXISTS puntos_movimientos (
  id          BIGSERIAL PRIMARY KEY,
  cliente_id  BIGINT REFERENCES clientes(id) ON DELETE CASCADE,
  puntos      INT  NOT NULL,                 -- positivo = ganado, negativo = canjeado
  tipo        TEXT NOT NULL,                 -- GANADO | CANJEADO | AJUSTE
  origen      TEXT,                          -- taller | carwash | cafeteria | curso | referido | cumpleanos | canje | manual
  ref_id      BIGINT,                        -- id de la factura/venta relacionada
  descripcion TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_puntos_mov_cliente ON puntos_movimientos (cliente_id, created_at DESC);

-- Listo. El backend usa estas tablas; nada se activa hasta poner activo = TRUE
-- desde el módulo de Fidelización.
