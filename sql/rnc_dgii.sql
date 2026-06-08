-- ================================================================
-- TABLA RNC DGII — Padrón de contribuyentes de República Dominicana
-- Ejecutar en Supabase SQL Editor ANTES de correr el script de importación
-- ================================================================

CREATE TABLE IF NOT EXISTS rnc_dgii (
  rnc               TEXT        PRIMARY KEY,   -- RNC o Cédula (9-11 dígitos)
  razon_social      TEXT        NOT NULL,       -- Nombre legal
  nombre_comercial  TEXT,                       -- Nombre comercial (puede estar vacío)
  actividad         TEXT,                       -- Actividad económica
  fecha_constitucion TEXT,                      -- Fecha de constitución (MM/DD/YYYY)
  estado            TEXT,                       -- ACTIVO | SUSPENDIDO | CANCELADO
  tipo              TEXT,                       -- NORMAL | etc.
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Índice principal (ya cubierto por PRIMARY KEY, pero explícito por claridad)
-- Índice para búsqueda por nombre (ILIKE)
CREATE INDEX IF NOT EXISTS idx_rnc_dgii_razon_social ON rnc_dgii USING gin(to_tsvector('simple', razon_social));
CREATE INDEX IF NOT EXISTS idx_rnc_dgii_estado ON rnc_dgii (estado);

-- RLS: solo lectura pública (el backend lo consulta con service_role, pero por si acaso)
ALTER TABLE rnc_dgii ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rnc_dgii_select" ON rnc_dgii
  FOR SELECT USING (true);

-- Para que el backend (service_role) pueda insertar durante la importación:
CREATE POLICY "rnc_dgii_insert_service" ON rnc_dgii
  FOR INSERT WITH CHECK (true);

CREATE POLICY "rnc_dgii_update_service" ON rnc_dgii
  FOR UPDATE USING (true);
