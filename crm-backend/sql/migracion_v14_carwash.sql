-- ============================================================
-- SOLIDO AUTO SERVICIO - Migracion v14
-- CAR WASH / LAVADO dentro del taller (carril rapido)
-- Reusa clientes, vehiculos, ordenes_trabajo y facturas.
-- Ejecutar en Supabase -> SQL Editor.
-- ============================================================

-- 1) Tipos de lavado predefinidos (editables)
CREATE TABLE IF NOT EXISTS carwash_servicios (
  id        SERIAL PRIMARY KEY,
  nombre    TEXT NOT NULL,
  precio    NUMERIC(12,2) NOT NULL DEFAULT 0,
  orden     INT DEFAULT 0,
  activo    BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Semilla (solo si la tabla esta vacia)
INSERT INTO carwash_servicios (nombre, precio, orden)
SELECT * FROM (VALUES
  ('Lavado basico',      350, 1),
  ('Lavado completo',    600, 2),
  ('Lavado + encerado',  900, 3),
  ('Detallado completo', 1800, 4)
) AS v(nombre, precio, orden)
WHERE NOT EXISTS (SELECT 1 FROM carwash_servicios);

-- 2) Marcar el tipo de orden (TALLER por defecto, LAVADO para car wash)
ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS tipo_orden TEXT DEFAULT 'TALLER';

-- 3) Asegurar que facturas pueda enlazarse directo a una orden (sin diagnostico)
ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS orden_id INT;

-- Listo. Car wash usa estos campos + el estado EN_LAVADO en la app.
