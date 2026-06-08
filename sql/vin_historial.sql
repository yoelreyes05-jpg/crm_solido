-- ============================================================
-- VIN HISTORIAL — Registro de cada consulta VIN
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Tabla para auditar cada lookup de VIN (quién, cuándo, desde dónde)
CREATE TABLE IF NOT EXISTS vin_historial (
  id              bigserial PRIMARY KEY,
  vin             text        NOT NULL,
  marca           text,
  modelo          text,
  ano             text,
  motor           text,
  combustible     text,
  origen          text,       -- 'vehiculos' | 'facturacion' | 'diagnostico'
  vehiculo_id     bigint,
  orden_id        bigint,
  factura_id      bigint,
  consultado_en   timestamptz DEFAULT now()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS vin_historial_vin_idx          ON vin_historial (vin);
CREATE INDEX IF NOT EXISTS vin_historial_consultado_en_idx ON vin_historial (consultado_en DESC);
CREATE INDEX IF NOT EXISTS vin_historial_vehiculo_id_idx  ON vin_historial (vehiculo_id);

-- RLS
ALTER TABLE vin_historial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a usuarios autenticados" ON vin_historial
  FOR ALL USING (true) WITH CHECK (true);

-- Vista útil: últimas 50 consultas con datos del vehículo registrado
CREATE OR REPLACE VIEW v_vin_historial AS
SELECT
  h.id,
  h.vin,
  h.marca,
  h.modelo,
  h.ano,
  h.motor,
  h.combustible,
  h.origen,
  h.consultado_en,
  h.vehiculo_id,
  h.orden_id,
  h.factura_id,
  v.placa,
  c.nombre AS cliente_nombre
FROM vin_historial h
LEFT JOIN vehiculos  v ON v.id = h.vehiculo_id
LEFT JOIN clientes   c ON c.id = v.cliente_id
ORDER BY h.consultado_en DESC;
