-- ============================================================
-- SÓLIDO AUTO SERVICIO — Migración v7
-- Módulo de Recetas para Cafetería
-- Propósito: Controlar calidad y costos de los productos vendidos
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────
-- TABLA 1: cafeteria_ingredientes
-- Catálogo de ingredientes/insumos de la cafetería
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cafeteria_ingredientes (
  id               SERIAL PRIMARY KEY,
  nombre           TEXT           NOT NULL,
  unidad           VARCHAR(20)    NOT NULL DEFAULT 'unidad',
  -- Unidades válidas: gr, ml, unidad, lb, oz, taza, litro, kg, sobre, lata
  stock_actual     DECIMAL(10,3)  NOT NULL DEFAULT 0,
  stock_minimo     DECIMAL(10,3)  NOT NULL DEFAULT 0,
  costo_unitario   DECIMAL(12,2)  NOT NULL DEFAULT 0,
  -- Costo por unidad, para calcular el costo total de la receta
  proveedor        TEXT           DEFAULT NULL,
  activo           BOOLEAN        NOT NULL DEFAULT TRUE,
  notas            TEXT           DEFAULT NULL,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Índice para búsquedas por nombre
CREATE INDEX IF NOT EXISTS idx_cafe_ingr_nombre
  ON cafeteria_ingredientes (nombre);

-- Índice para filtrar solo activos
CREATE INDEX IF NOT EXISTS idx_cafe_ingr_activo
  ON cafeteria_ingredientes (activo);


-- ─────────────────────────────────────────────
-- TABLA 2: cafeteria_recetas
-- Una receta por cada producto de la cafetería
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cafeteria_recetas (
  id               SERIAL PRIMARY KEY,
  producto_id      INTEGER        REFERENCES cafeteria_productos(id) ON DELETE SET NULL,
  nombre           TEXT           NOT NULL,
  descripcion      TEXT           DEFAULT NULL,
  instrucciones    TEXT           DEFAULT NULL,
  -- Paso a paso de preparación para mantener la calidad
  rendimiento      INTEGER        NOT NULL DEFAULT 1,
  -- Cuántas unidades produce esta receta (por defecto 1)
  tiempo_prep_min  INTEGER        DEFAULT NULL,
  -- Tiempo de preparación en minutos
  activo           BOOLEAN        NOT NULL DEFAULT TRUE,
  created_by       VARCHAR(100)   DEFAULT 'Sistema',
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Índice para búsquedas por producto
CREATE INDEX IF NOT EXISTS idx_cafe_recetas_producto
  ON cafeteria_recetas (producto_id);

-- Índice para filtrar activas
CREATE INDEX IF NOT EXISTS idx_cafe_recetas_activo
  ON cafeteria_recetas (activo);


-- ─────────────────────────────────────────────
-- TABLA 3: cafeteria_receta_ingredientes
-- Ingredientes y cantidades de cada receta
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cafeteria_receta_ingredientes (
  id               SERIAL PRIMARY KEY,
  receta_id        INTEGER        NOT NULL
                     REFERENCES cafeteria_recetas(id) ON DELETE CASCADE,
  ingrediente_id   INTEGER        NOT NULL
                     REFERENCES cafeteria_ingredientes(id) ON DELETE RESTRICT,
  cantidad         DECIMAL(10,3)  NOT NULL,
  unidad           VARCHAR(20)    DEFAULT NULL,
  -- Si es NULL, usa la unidad del ingrediente
  notas            TEXT           DEFAULT NULL,
  -- Ej: "tamizar", "a temperatura ambiente", "picado fino"
  orden            SMALLINT       DEFAULT 0,
  -- Para ordenar los ingredientes al mostrar la receta
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Índice para obtener ingredientes de una receta rápido
CREATE INDEX IF NOT EXISTS idx_cafe_receta_ingr_receta
  ON cafeteria_receta_ingredientes (receta_id);

-- Índice para saber en qué recetas se usa un ingrediente
CREATE INDEX IF NOT EXISTS idx_cafe_receta_ingr_ingrediente
  ON cafeteria_receta_ingredientes (ingrediente_id);


-- ─────────────────────────────────────────────
-- DATOS INICIALES DE EJEMPLO
-- (Comentar si no se desean datos de prueba)
-- ─────────────────────────────────────────────

-- Ingredientes base de cafetería
INSERT INTO cafeteria_ingredientes (nombre, unidad, costo_unitario, stock_actual, stock_minimo, notas)
VALUES
  ('Café molido',         'gr',     0.15, 500, 100, 'Café dominicano 100% puro'),
  ('Agua',                'ml',     0.01, 5000, 1000, NULL),
  ('Leche entera',        'ml',     0.04, 1000, 200, 'Leche fresca pasteurizada'),
  ('Azúcar blanca',       'gr',     0.02, 2000, 500, NULL),
  ('Vaso desechable 8oz', 'unidad', 3.50, 100, 20, 'Vasos para café caliente'),
  ('Tapa desechable',     'unidad', 1.50, 100, 20, 'Tapa para vaso 8oz')
ON CONFLICT DO NOTHING;
