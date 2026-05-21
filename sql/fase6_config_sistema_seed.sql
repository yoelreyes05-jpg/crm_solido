-- ================================================================
-- FASE 6: Datos iniciales para config_sistema
-- La tabla ya fue creada por permisos_config.sql
-- Ejecutar en Supabase SQL Editor
-- ================================================================

-- Asegurar que la tabla existe (por si no se corrió permisos_config.sql)
CREATE TABLE IF NOT EXISTS config_sistema (
  clave      TEXT PRIMARY KEY,
  valor      JSONB        NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Insertar / actualizar valores iniciales de la empresa
INSERT INTO config_sistema (clave, valor) VALUES
  ('nombre_empresa',    '"SÓLIDO AUTO SERVICIO"'),
  ('telefono_empresa',  '"809-712-2027"'),
  ('whatsapp_numero',   '"18097122027"'),
  ('email_empresa',     '"info@solidoauto.com"'),
  ('direccion_empresa', '"Santo Domingo, República Dominicana"'),
  ('rnc_empresa',       '"000-000000-0"'),
  ('moneda',            '"RD$"'),
  ('itbis_porcentaje',  '"18"'),
  ('dias_garantia',     '"30"'),
  ('logo_url',          '""'),
  ('telegram_token',    '""'),
  ('telegram_chat_id',  '""'),
  ('notif_whatsapp',    '"false"'),
  ('notif_telegram',    '"true"'),
  ('dashboard_refresh', '"30"')
ON CONFLICT (clave) DO NOTHING;

-- Habilitar RLS si no está habilitado
ALTER TABLE config_sistema ENABLE ROW LEVEL SECURITY;

-- Política para service_role (backend)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'config_sistema'
    AND policyname = 'Solo service_role puede acceder a config_sistema'
  ) THEN
    CREATE POLICY "Solo service_role puede acceder a config_sistema"
      ON config_sistema FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END$$;
