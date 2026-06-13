-- ─────────────────────────────────────────────────────────────────────────────
-- Módulo Capacitaciones — CRM Sólido Auto Servicio
-- Ejecutar en Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Tabla de cursos
CREATE TABLE IF NOT EXISTS capacitaciones_cursos (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  instructor  TEXT,
  horas       INTEGER DEFAULT 0,
  precio      NUMERIC(12,2) DEFAULT 0,
  modalidad   TEXT DEFAULT 'Presencial',
  estado      TEXT DEFAULT 'activo',
  descripcion TEXT,
  fecha_proxima DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de alumnos / inscripciones (una fila por alumno por curso)
CREATE TABLE IF NOT EXISTS capacitaciones_alumnos (
  id                SERIAL PRIMARY KEY,
  curso_id          INTEGER REFERENCES capacitaciones_cursos(id) ON DELETE CASCADE,
  nombre            TEXT NOT NULL,
  telefono          TEXT,
  email             TEXT,
  estado            TEXT DEFAULT 'inscrito',  -- inscrito | completado | desertado
  fecha_inscripcion DATE DEFAULT CURRENT_DATE,
  monto_pagado      NUMERIC(12,2) DEFAULT 0,
  notas             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- RLS — permitir acceso completo con la anon key (igual que el resto del CRM)
ALTER TABLE capacitaciones_cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacitaciones_alumnos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_cursos"   ON capacitaciones_cursos;
DROP POLICY IF EXISTS "allow_all_alumnos"  ON capacitaciones_alumnos;

CREATE POLICY "allow_all_cursos"  ON capacitaciones_cursos  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_alumnos" ON capacitaciones_alumnos FOR ALL USING (true) WITH CHECK (true);

-- Tabla de pagos (historial de abonos por alumno)
CREATE TABLE IF NOT EXISTS capacitaciones_pagos (
  id         SERIAL PRIMARY KEY,
  alumno_id  INTEGER REFERENCES capacitaciones_alumnos(id) ON DELETE CASCADE,
  monto      NUMERIC(12,2) NOT NULL,
  fecha      DATE DEFAULT CURRENT_DATE,
  metodo     TEXT DEFAULT 'Efectivo',
  referencia TEXT,
  notas      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE capacitaciones_pagos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_pagos" ON capacitaciones_pagos;
CREATE POLICY "allow_all_pagos" ON capacitaciones_pagos FOR ALL USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cap_alumnos_curso  ON capacitaciones_alumnos(curso_id);
CREATE INDEX IF NOT EXISTS idx_cap_alumnos_estado ON capacitaciones_alumnos(estado);
CREATE INDEX IF NOT EXISTS idx_cap_pagos_alumno   ON capacitaciones_pagos(alumno_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Datos de ejemplo (cursos precargados)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO capacitaciones_cursos (nombre, instructor, horas, precio, modalidad, estado, descripcion, fecha_proxima) VALUES
  ('Mecánica General Básica',       'Ing. Rafael Matos',    40, 4500, 'Presencial',     'activo',   'Fundamentos de motor, distribución, sistemas de lubricación y refrigeración. Ideal para técnicos en formación.',                             '2025-08-05'),
  ('Diagnóstico con Escáner OBD2',  'Ing. Carlos Peguero',  24, 6500, 'Presencial',     'activo',   'Uso de escáner multimarca, interpretación de códigos DTC, test de actuadores y análisis en tiempo real. Basado en protocolos OBD I, II y III.', '2025-07-15'),
  ('Electricidad Automotriz',        'Ing. Rafael Matos',    32, 5500, 'Semipresencial', 'activo',   'Circuitos eléctricos, diagnóstico de sensores, actuadores y sistemas de carga y arranque. Equivalente al programa HC de INFOTEP.',            '2025-09-10'),
  ('Aire Acondicionado Vehicular',   'Téc. Luis Almonte',    20, 7000, 'Presencial',     'activo',   'Diagnóstico, recarga y reparación de sistemas A/C. Manejo de refrigerantes R134a y R1234yf según especificaciones del fabricante.',           '2025-07-28'),
  ('Transmisiones Automáticas',      'Ing. Carlos Peguero',  28, 8000, 'Presencial',     'activo',   'Diagnóstico y reparación de cajas automáticas y CVT. Uso de escáner para programación de módulos de transmisión.',                           '2025-10-01'),
  ('Frenos y Suspensión',            'Téc. Luis Almonte',    16, 4000, 'Presencial',     'activo',   'Sistemas de frenos ABS/EBD, geometría de suspensión, alineación y balanceo. Teoría y práctica en vehículos reales.',                         '2025-08-20')
ON CONFLICT DO NOTHING;
