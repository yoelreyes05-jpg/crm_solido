-- ================================================================
-- VIN DECODER + CATÁLOGO DE COMPATIBILIDAD
-- Ejecutar en Supabase SQL Editor
-- ================================================================

-- 1. Agregar columnas a vehiculos (si no existen)
ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS vin         TEXT,
  ADD COLUMN IF NOT EXISTS motor       TEXT,   -- Ej: "1.5L L4 DOHC"
  ADD COLUMN IF NOT EXISTS combustible TEXT,   -- Ej: "Gasolina" | "Diesel" | "Híbrido"
  ADD COLUMN IF NOT EXISTS vin_data    JSONB;  -- respuesta completa NHTSA (raw)

-- 2. Cache de VINs decodificados (evita llamadas repetidas a NHTSA)
CREATE TABLE IF NOT EXISTS vin_cache (
  vin          TEXT PRIMARY KEY,
  marca        TEXT,
  modelo       TEXT,
  ano          TEXT,
  motor        TEXT,
  combustible  TEXT,
  pais         TEXT,
  tipo_vehiculo TEXT,
  datos_raw    JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Catálogo de compatibilidad: repuesto ↔ perfil de vehículo
CREATE TABLE IF NOT EXISTS repuesto_compatibilidad (
  id              BIGSERIAL PRIMARY KEY,
  inventario_id   BIGINT NOT NULL REFERENCES inventario(id) ON DELETE CASCADE,
  marca           TEXT NOT NULL,   -- "Honda", "Toyota", etc.
  modelo          TEXT,            -- "Civic", null = toda la marca
  ano_desde       INT,             -- 2018
  ano_hasta       INT,             -- 2023
  motor           TEXT,            -- "1.5L" — null = cualquier motor
  combustible     TEXT,            -- "Gasolina" — null = cualquiera
  veces_usado     INT     NOT NULL DEFAULT 1,  -- se incrementa con cada uso
  confirmado      BOOLEAN NOT NULL DEFAULT false, -- true = verificado manualmente
  origen          TEXT    NOT NULL DEFAULT 'manual', -- 'manual' | 'aprendido'
  notas           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para las dos consultas principales:
-- "¿Qué repuestos van en este vehículo?"
CREATE INDEX IF NOT EXISTS idx_compat_vehiculo
  ON repuesto_compatibilidad (marca, modelo, ano_desde, ano_hasta);

-- "¿En qué vehículos va este repuesto?"
CREATE INDEX IF NOT EXISTS idx_compat_repuesto
  ON repuesto_compatibilidad (inventario_id);

-- RLS
ALTER TABLE vin_cache              ENABLE ROW LEVEL SECURITY;
ALTER TABLE repuesto_compatibilidad ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vin_cache_select"   ON vin_cache              FOR SELECT USING (true);
CREATE POLICY "vin_cache_insert"   ON vin_cache              FOR INSERT WITH CHECK (true);
CREATE POLICY "vin_cache_update"   ON vin_cache              FOR UPDATE USING (true);

CREATE POLICY "compat_select"      ON repuesto_compatibilidad FOR SELECT USING (true);
CREATE POLICY "compat_insert"      ON repuesto_compatibilidad FOR INSERT WITH CHECK (true);
CREATE POLICY "compat_update"      ON repuesto_compatibilidad FOR UPDATE USING (true);
CREATE POLICY "compat_delete"      ON repuesto_compatibilidad FOR DELETE USING (true);
