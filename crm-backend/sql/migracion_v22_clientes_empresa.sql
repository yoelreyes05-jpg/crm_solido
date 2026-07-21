-- ============================================================
-- SÓLIDO AUTO SERVICIO — Migración v22
-- Soporte de clientes tipo EMPRESA / flotilla de vehículos
-- Ejecutar en Supabase → SQL Editor
-- ============================================================
--
-- Contexto:
--   La relación cliente→vehículos ya es uno-a-muchos
--   (vehiculos.cliente_id → clientes.id). Esta migración solo
--   agrega los datos que faltaban para tratar a una compañía
--   dueña de una flotilla como un cliente empresarial:
--   tipo, RNC, razón social y persona de contacto.
--
--   Todos los clientes existentes quedan como INDIVIDUAL por
--   defecto, así que nada se rompe.
-- ============================================================

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS tipo_cliente      VARCHAR(20)  NOT NULL DEFAULT 'INDIVIDUAL',
  ADD COLUMN IF NOT EXISTS rnc               VARCHAR(20),
  ADD COLUMN IF NOT EXISTS razon_social      VARCHAR(200),
  ADD COLUMN IF NOT EXISTS contacto_nombre   VARCHAR(150),
  ADD COLUMN IF NOT EXISTS contacto_telefono VARCHAR(50);

-- Normalizar valores existentes ANTES de crear la restricción.
-- Cubre filas viejas con NULL, cadena vacía, espacios o minúsculas
-- (ej. de un intento previo de esta migración).
UPDATE clientes
   SET tipo_cliente = 'EMPRESA'
 WHERE upper(trim(coalesce(tipo_cliente, ''))) = 'EMPRESA';

UPDATE clientes
   SET tipo_cliente = 'INDIVIDUAL'
 WHERE upper(trim(coalesce(tipo_cliente, ''))) <> 'EMPRESA';

-- Solo se permiten dos tipos: INDIVIDUAL o EMPRESA
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clientes_tipo_cliente_chk'
  ) THEN
    ALTER TABLE clientes
      ADD CONSTRAINT clientes_tipo_cliente_chk
      CHECK (tipo_cliente IN ('INDIVIDUAL', 'EMPRESA'));
  END IF;
END $$;

-- Índices útiles para filtrar flotillas y buscar por RNC
CREATE INDEX IF NOT EXISTS idx_clientes_tipo_cliente ON clientes (tipo_cliente);
CREATE INDEX IF NOT EXISTS idx_clientes_rnc          ON clientes (rnc);

-- ============================================================
-- Verificación rápida (opcional):
--   SELECT id, nombre, tipo_cliente, rnc FROM clientes LIMIT 20;
-- ============================================================
