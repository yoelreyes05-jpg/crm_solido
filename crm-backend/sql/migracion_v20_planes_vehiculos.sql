-- ============================================================
-- SOLIDO AUTO SERVICIO - Migracion v20
-- PLANES: amarre de membresia a VEHICULOS especificos
-- La membresia cubre solo los vehiculos registrados en ella.
-- Limite por plan via beneficio 'vehiculos_max':
--   Lavado/Basico = 1, Premium = 2, VIP = 3 (-1 = ilimitado)
-- Si llega un vehiculo no registrado -> se cobra normal.
-- Ejecutar en Supabase -> SQL Editor. Requiere v19.
-- ============================================================

CREATE TABLE IF NOT EXISTS plan_membresia_vehiculos (
  id            BIGSERIAL PRIMARY KEY,
  membresia_id  BIGINT REFERENCES plan_membresias(id) ON DELETE CASCADE,
  vehiculo_id   BIGINT NOT NULL,               -- FK logica a vehiculos(id)
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (membresia_id, vehiculo_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_mv_membresia ON plan_membresia_vehiculos(membresia_id);
CREATE INDEX IF NOT EXISTS idx_plan_mv_vehiculo  ON plan_membresia_vehiculos(vehiculo_id);

-- Beneficio 'vehiculos_max' para los planes sembrados en v19
-- (no toca planes que ya lo tengan configurado)
INSERT INTO plan_beneficios (plan_id, tipo, valor)
SELECT id, 'vehiculos_max',
  CASE nombre
    WHEN 'Plan Lavado'  THEN 1
    WHEN 'Plan Básico'  THEN 1
    WHEN 'Plan Premium' THEN 2
    WHEN 'Plan VIP'     THEN 3
  END
FROM plan_catalogo
WHERE nombre IN ('Plan Lavado', 'Plan Básico', 'Plan Premium', 'Plan VIP')
ON CONFLICT (plan_id, tipo) DO NOTHING;

-- Listo. Membresias amarradas a vehiculos con limite por plan.
