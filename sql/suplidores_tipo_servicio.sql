-- ============================================================
-- Agrega columna tipo_servicio a la tabla suplidores
-- Ejecutar en Supabase SQL Editor
-- ============================================================

ALTER TABLE suplidores
  ADD COLUMN IF NOT EXISTS tipo_servicio TEXT;

-- Comentario de referencia con los valores usados en el frontend:
-- 'repuestos'   → Repuestos y Autopartes
-- 'lubricantes' → Lubricantes y Aceites
-- 'neumaticos'  → Neumáticos y Llantas
-- 'herramientas'→ Herramientas y Equipos
-- 'carroceria'  → Carrocería y Pintura
-- 'electrico'   → Eléctrico y Electrónico
-- 'limpieza'    → Limpieza y Detailing
-- 'varios'      → Servicios Varios
