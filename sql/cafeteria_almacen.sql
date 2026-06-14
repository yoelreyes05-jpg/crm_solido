-- ─────────────────────────────────────────────────────────────────────────────
-- Cafetería — Almacén: bitácora de movimientos de stock
-- Ejecutar en Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cafeteria_almacen_movimientos (
  id             SERIAL PRIMARY KEY,
  producto_id    INTEGER NOT NULL REFERENCES cafeteria_productos(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA', 'AJUSTE')),
  cantidad       NUMERIC(10,2) NOT NULL,
  stock_antes    NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock_despues  NUMERIC(10,2) NOT NULL DEFAULT 0,
  motivo         TEXT,             -- "Compra", "Venta manual", "Ajuste inventario", etc.
  referencia     TEXT,             -- Número de factura/orden de compra si aplica
  usuario        TEXT DEFAULT 'Sistema',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- RLS — mismo patrón que el resto del CRM
ALTER TABLE cafeteria_almacen_movimientos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_almacen_mov" ON cafeteria_almacen_movimientos;
CREATE POLICY "allow_all_almacen_mov" ON cafeteria_almacen_movimientos
  FOR ALL USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cafe_almacen_producto  ON cafeteria_almacen_movimientos(producto_id);
CREATE INDEX IF NOT EXISTS idx_cafe_almacen_created   ON cafeteria_almacen_movimientos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cafe_almacen_tipo      ON cafeteria_almacen_movimientos(tipo);
