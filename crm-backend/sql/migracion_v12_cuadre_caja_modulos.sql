-- ============================================================
-- SOLIDO AUTO SERVICIO - Migracion v12
-- CUADRE DE CAJA para los modulos contables de Cafeteria y Capacitacion
-- Tablas independientes (no se mezclan con el cuadre del taller ni
-- con cafeteria_cuadre del POS de ventas).
-- Ejecutar en Supabase -> SQL Editor. Requiere haber corrido v11.
-- ============================================================

CREATE TABLE IF NOT EXISTS cafeteria_cuadre_caja (
  id                    BIGSERIAL PRIMARY KEY,
  fecha                 DATE NOT NULL DEFAULT CURRENT_DATE,
  fondo_inicial         NUMERIC(12,2) DEFAULT 0,   -- efectivo con el que abre la caja
  ingresos_caja         NUMERIC(12,2) DEFAULT 0,   -- ingresos de caja chica del dia
  egresos_caja          NUMERIC(12,2) DEFAULT 0,   -- egresos/gastos de caja chica del dia
  cobros_efectivo       NUMERIC(12,2) DEFAULT 0,   -- cobros de cuentas x cobrar en efectivo
  cobros_tarjeta        NUMERIC(12,2) DEFAULT 0,
  cobros_transferencia  NUMERIC(12,2) DEFAULT 0,
  efectivo_esperado     NUMERIC(12,2) DEFAULT 0,   -- lo que deberia haber en caja
  efectivo_contado      NUMERIC(12,2) DEFAULT 0,   -- conteo fisico
  efectivo_final        NUMERIC(12,2) DEFAULT 0,   -- se arrastra como fondo del dia siguiente
  diferencia            NUMERIC(12,2) DEFAULT 0,   -- contado - esperado
  usuario               TEXT,
  notas                 TEXT,
  creado_en             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS capacitacion_cuadre_caja (
  id                    BIGSERIAL PRIMARY KEY,
  fecha                 DATE NOT NULL DEFAULT CURRENT_DATE,
  fondo_inicial         NUMERIC(12,2) DEFAULT 0,
  ingresos_caja         NUMERIC(12,2) DEFAULT 0,
  egresos_caja          NUMERIC(12,2) DEFAULT 0,
  cobros_efectivo       NUMERIC(12,2) DEFAULT 0,
  cobros_tarjeta        NUMERIC(12,2) DEFAULT 0,
  cobros_transferencia  NUMERIC(12,2) DEFAULT 0,
  efectivo_esperado     NUMERIC(12,2) DEFAULT 0,
  efectivo_contado      NUMERIC(12,2) DEFAULT 0,
  efectivo_final        NUMERIC(12,2) DEFAULT 0,
  diferencia            NUMERIC(12,2) DEFAULT 0,
  usuario               TEXT,
  notas                 TEXT,
  creado_en             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cafe_cuadrecaja_fecha ON cafeteria_cuadre_caja(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_capa_cuadrecaja_fecha ON capacitacion_cuadre_caja(fecha DESC);

-- Listo. Cuadre de caja independiente para cada modulo.
