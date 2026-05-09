-- ============================================================
-- FASE B — NCF ATÓMICO + TABLAS DE CUENTAS POR PAGAR
-- ============================================================

-- ------------------------------------------------------------
-- 1. Stored procedure para generar NCF de forma atómica
--    (sin condición de carrera)
--    Usar en lugar de la lógica actual en el backend
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_next_ncf(p_tipo TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_secuencia INTEGER;
  v_prefijo TEXT;
BEGIN
  SELECT secuencia_actual + 1, prefijo
  INTO v_secuencia, v_prefijo
  FROM ncf_config
  WHERE tipo = p_tipo
  FOR UPDATE;  -- bloquea la fila durante la transacción

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tipo de NCF no encontrado: %', p_tipo;
  END IF;

  UPDATE ncf_config
  SET secuencia_actual = v_secuencia
  WHERE tipo = p_tipo;

  RETURN v_prefijo || LPAD(v_secuencia::TEXT, 8, '0');
END;
$$;

-- ------------------------------------------------------------
-- 2. Tabla: cuentas_pagar
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cuentas_pagar (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  suplidor_id      UUID        REFERENCES suplidores(id) ON DELETE SET NULL,
  suplidor_nombre  TEXT        NOT NULL,
  descripcion      TEXT        NOT NULL,
  monto_original   NUMERIC(12,2) NOT NULL,
  monto_pagado     NUMERIC(12,2) NOT NULL DEFAULT 0,
  fecha_emision    DATE        NOT NULL,
  fecha_vencimiento DATE       NOT NULL,
  notas            TEXT,
  created_by       UUID        REFERENCES usuarios(id) ON DELETE SET NULL,
  estado           TEXT        NOT NULL DEFAULT 'PENDIENTE'
                               CHECK (estado IN ('PENDIENTE','PARCIAL','PAGADA','VENCIDA','ANULADA')),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 3. Tabla: pagos_pagar
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pagos_pagar (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id  UUID        NOT NULL REFERENCES cuentas_pagar(id) ON DELETE CASCADE,
  monto      NUMERIC(12,2) NOT NULL,
  fecha      DATE        NOT NULL,
  metodo     TEXT        NOT NULL,
  referencia TEXT,
  notas      TEXT,
  usuario    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 4. Índices
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cuentas_pagar_suplidor_id
  ON cuentas_pagar(suplidor_id);

CREATE INDEX IF NOT EXISTS idx_cuentas_pagar_estado
  ON cuentas_pagar(estado);

CREATE INDEX IF NOT EXISTS idx_cuentas_pagar_fecha_vencimiento
  ON cuentas_pagar(fecha_vencimiento);

CREATE INDEX IF NOT EXISTS idx_pagos_pagar_cuenta_id
  ON pagos_pagar(cuenta_id);

CREATE INDEX IF NOT EXISTS idx_pagos_pagar_fecha
  ON pagos_pagar(fecha);

-- ------------------------------------------------------------
-- 5. Trigger: actualizar updated_at en cuentas_pagar
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cuentas_pagar_updated_at ON cuentas_pagar;
CREATE TRIGGER trg_cuentas_pagar_updated_at
  BEFORE UPDATE ON cuentas_pagar
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
