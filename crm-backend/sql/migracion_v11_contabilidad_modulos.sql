-- ============================================================
-- SOLIDO AUTO SERVICIO - Migracion v11
-- Modulos contables INDEPENDIENTES para Cafeteria y Capacitacion
-- Tablas separadas (prefijo cafeteria_ / capacitacion_) para que
-- NO se mezclen con la contabilidad del taller.
-- Ejecutar en Supabase -> SQL Editor.
-- ============================================================

-- ============================================================
--  CAFETERIA
-- ============================================================

-- Caja chica de cafeteria
CREATE TABLE IF NOT EXISTS cafeteria_caja_chica (
  id           BIGSERIAL PRIMARY KEY,
  fecha        TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),  -- hora local RD (la guarda la app)
  descripcion  TEXT,
  categoria    TEXT DEFAULT 'Otro',
  monto        NUMERIC(12,2) NOT NULL,
  tipo         TEXT CHECK (tipo IN ('INGRESO','EGRESO')),
  usuario      TEXT,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cuentas por cobrar de cafeteria
CREATE TABLE IF NOT EXISTS cafeteria_cuentas_cobrar (
  id                 SERIAL PRIMARY KEY,
  cliente_nombre     VARCHAR(200),
  descripcion        TEXT NOT NULL,
  monto_original     NUMERIC(12,2) NOT NULL,
  monto_pagado       NUMERIC(12,2) DEFAULT 0,
  fecha_emision      DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento  DATE NOT NULL,
  estado             VARCHAR(20) DEFAULT 'PENDIENTE',   -- PENDIENTE | PARCIAL | PAGADO | ANULADO
  notas              TEXT,
  created_by         VARCHAR(100),
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS cafeteria_pagos_cobrar (
  id          SERIAL PRIMARY KEY,
  cuenta_id   INT REFERENCES cafeteria_cuentas_cobrar(id) ON DELETE CASCADE,
  monto       NUMERIC(12,2) NOT NULL,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo      VARCHAR(30) DEFAULT 'EFECTIVO',
  referencia  VARCHAR(200),
  notas       TEXT,
  usuario     VARCHAR(100),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cuentas por pagar de cafeteria
CREATE TABLE IF NOT EXISTS cafeteria_cuentas_pagar (
  id                 SERIAL PRIMARY KEY,
  suplidor_nombre    VARCHAR(200),
  descripcion        TEXT NOT NULL,
  monto_original     NUMERIC(12,2) NOT NULL,
  monto_pagado       NUMERIC(12,2) DEFAULT 0,
  fecha_emision      DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento  DATE NOT NULL,
  estado             VARCHAR(20) DEFAULT 'PENDIENTE',
  notas              TEXT,
  created_by         VARCHAR(100),
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS cafeteria_pagos_pagar (
  id          SERIAL PRIMARY KEY,
  cuenta_id   INT REFERENCES cafeteria_cuentas_pagar(id) ON DELETE CASCADE,
  monto       NUMERIC(12,2) NOT NULL,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo      VARCHAR(30) DEFAULT 'EFECTIVO',
  referencia  VARCHAR(200),
  notas       TEXT,
  usuario     VARCHAR(100),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
--  CAPACITACION
-- ============================================================

-- Caja chica de capacitacion
CREATE TABLE IF NOT EXISTS capacitacion_caja_chica (
  id           BIGSERIAL PRIMARY KEY,
  fecha        TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  descripcion  TEXT,
  categoria    TEXT DEFAULT 'Otro',
  monto        NUMERIC(12,2) NOT NULL,
  tipo         TEXT CHECK (tipo IN ('INGRESO','EGRESO')),
  usuario      TEXT,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cuentas por cobrar de capacitacion
CREATE TABLE IF NOT EXISTS capacitacion_cuentas_cobrar (
  id                 SERIAL PRIMARY KEY,
  cliente_nombre     VARCHAR(200),
  descripcion        TEXT NOT NULL,
  monto_original     NUMERIC(12,2) NOT NULL,
  monto_pagado       NUMERIC(12,2) DEFAULT 0,
  fecha_emision      DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento  DATE NOT NULL,
  estado             VARCHAR(20) DEFAULT 'PENDIENTE',
  notas              TEXT,
  created_by         VARCHAR(100),
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS capacitacion_pagos_cobrar (
  id          SERIAL PRIMARY KEY,
  cuenta_id   INT REFERENCES capacitacion_cuentas_cobrar(id) ON DELETE CASCADE,
  monto       NUMERIC(12,2) NOT NULL,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo      VARCHAR(30) DEFAULT 'EFECTIVO',
  referencia  VARCHAR(200),
  notas       TEXT,
  usuario     VARCHAR(100),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cuentas por pagar de capacitacion
CREATE TABLE IF NOT EXISTS capacitacion_cuentas_pagar (
  id                 SERIAL PRIMARY KEY,
  suplidor_nombre    VARCHAR(200),
  descripcion        TEXT NOT NULL,
  monto_original     NUMERIC(12,2) NOT NULL,
  monto_pagado       NUMERIC(12,2) DEFAULT 0,
  fecha_emision      DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento  DATE NOT NULL,
  estado             VARCHAR(20) DEFAULT 'PENDIENTE',
  notas              TEXT,
  created_by         VARCHAR(100),
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS capacitacion_pagos_pagar (
  id          SERIAL PRIMARY KEY,
  cuenta_id   INT REFERENCES capacitacion_cuentas_pagar(id) ON DELETE CASCADE,
  monto       NUMERIC(12,2) NOT NULL,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo      VARCHAR(30) DEFAULT 'EFECTIVO',
  referencia  VARCHAR(200),
  notas       TEXT,
  usuario     VARCHAR(100),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
--  INDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cafe_cc_fecha     ON cafeteria_caja_chica(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_cafe_cxc_estado   ON cafeteria_cuentas_cobrar(estado);
CREATE INDEX IF NOT EXISTS idx_cafe_cxc_venc     ON cafeteria_cuentas_cobrar(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_cafe_pcxc_cuenta  ON cafeteria_pagos_cobrar(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_cafe_cxp_estado   ON cafeteria_cuentas_pagar(estado);
CREATE INDEX IF NOT EXISTS idx_cafe_cxp_venc     ON cafeteria_cuentas_pagar(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_cafe_pcxp_cuenta  ON cafeteria_pagos_pagar(cuenta_id);

CREATE INDEX IF NOT EXISTS idx_capa_cc_fecha     ON capacitacion_caja_chica(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_capa_cxc_estado   ON capacitacion_cuentas_cobrar(estado);
CREATE INDEX IF NOT EXISTS idx_capa_cxc_venc     ON capacitacion_cuentas_cobrar(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_capa_pcxc_cuenta  ON capacitacion_pagos_cobrar(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_capa_cxp_estado   ON capacitacion_cuentas_pagar(estado);
CREATE INDEX IF NOT EXISTS idx_capa_cxp_venc     ON capacitacion_cuentas_pagar(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_capa_pcxp_cuenta  ON capacitacion_pagos_pagar(cuenta_id);

-- Listo. 10 tablas nuevas, totalmente separadas de la contabilidad del taller.
