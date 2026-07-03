-- ============================================================================
-- Migración v17 — Rol 'vendedor' + Facturas "pendientes de cobro"
-- ----------------------------------------------------------------------------
-- Objetivo: el vendedor puede crear el cliente y EMITIR la factura de una
-- pieza (despacha el repuesto), pero NO cobra. La secretaria cobra después
-- desde la pestaña "Por Cobrar" en Facturación (POST /facturas/:id/cobrar).
--
-- 1) La tabla usuarios tiene una restricción CHECK en la columna `rol`.
--    Sin esto, crear un usuario con rol 'vendedor' falla con:
--      new row for relation "usuarios" violates check constraint "usuarios_rol_check"
--
-- 2) La tabla facturas necesita dos columnas nuevas para registrar quién y
--    cuándo se cobró una factura emitida como PENDIENTE_COBRO.
--
-- Ejecutar UNA vez en Supabase → SQL Editor.
-- ============================================================================

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN (
    'gerente',
    'admin',
    'secretaria',
    'tecnico',
    'almacen',
    'cafeteria',
    'lavador',
    'vendedor'
  ));

ALTER TABLE facturas ADD COLUMN IF NOT EXISTS cobrado_por VARCHAR(120);
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS fecha_cobro TIMESTAMP;

-- Verificación opcional:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'usuarios'::regclass AND conname = 'usuarios_rol_check';
