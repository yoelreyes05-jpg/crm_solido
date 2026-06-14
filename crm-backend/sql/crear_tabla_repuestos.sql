-- =====================================================
-- TABLA: repuestos
-- Venta de repuestos automotrices — Sólido Auto Servicio
-- Ejecutar en Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS repuestos (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  precio      NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock       INTEGER NOT NULL DEFAULT 0,
  categoria   TEXT NOT NULL DEFAULT 'General',
  imagen      TEXT,
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_repuestos_categoria ON repuestos(categoria);
CREATE INDEX IF NOT EXISTS idx_repuestos_activo    ON repuestos(activo);

-- Datos de ejemplo (opcional, puedes comentar este bloque)
INSERT INTO repuestos (nombre, descripcion, precio, stock, categoria) VALUES
  ('Filtro de aceite',        'Compatible con la mayoría de motores 4 cilindros',  350.00, 20, 'Filtros'),
  ('Filtro de aire',          'Filtro de alto flujo para mejor rendimiento',        450.00, 15, 'Filtros'),
  ('Pastillas de freno',      'Juego delantero, cerámica de alto rendimiento',     1200.00,  8, 'Frenos'),
  ('Líquido de frenos DOT4',  'Botella 500ml, punto de ebullición alto',           280.00,  25, 'Fluidos'),
  ('Anticongelante 50/50',    'Listo para usar, 1 litro, compatible universal',    320.00,  18, 'Fluidos'),
  ('Bujías NGK (juego x4)',   'Bujías de iridio para mayor duración',              950.00,  10, 'Encendido'),
  ('Correa de distribución',  'Kit completo con tensor y polea',                  2800.00,   5, 'Motor'),
  ('Batería 12V 60Ah',        'Batería sellada libre de mantenimiento',            4500.00,   4, 'Eléctrico'),
  ('Aceite sintético 5W-30',  'Litro de aceite sintético full, varios modelos',    380.00,  30, 'Aceites'),
  ('Aceite sintético 10W-40', 'Litro aceite semi-sintético, motores gasolina',     320.00,  25, 'Aceites');
