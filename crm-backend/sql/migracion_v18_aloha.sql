-- ============================================================
-- SOLIDO AUTO SERVICIO - Migracion v18
-- ALOHA PERFUME STORE - Modulo TOTALMENTE INDEPENDIENTE
-- Tel: 829-393-3673
-- Todas las tablas llevan prefijo aloha_ para NO mezclarse con
-- los datos del taller, cafeteria, carwash ni capacitacion.
-- Ejecutar en Supabase -> SQL Editor.
-- ============================================================

-- ============================================================
--  ROL 'aloha' EN LA TABLA usuarios
--  La tabla usuarios tiene un CHECK en la columna rol; sin esto,
--  crear un usuario con rol 'aloha' falla con:
--    violates check constraint "usuarios_rol_check"
-- ============================================================
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
    'vendedor',
    'aloha'
  ));

-- ============================================================
--  CLIENTES DE ALOHA
-- ============================================================
CREATE TABLE IF NOT EXISTS aloha_clientes (
  id          BIGSERIAL PRIMARY KEY,
  nombre      VARCHAR(200) NOT NULL,
  telefono    VARCHAR(30),
  email       VARCHAR(200),
  direccion   TEXT,
  notas       TEXT,
  activo      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
--  PRODUCTOS / INVENTARIO DE ALOHA (con imagen)
-- ============================================================
CREATE TABLE IF NOT EXISTS aloha_productos (
  id          BIGSERIAL PRIMARY KEY,
  nombre      VARCHAR(200) NOT NULL,
  descripcion TEXT,
  categoria   VARCHAR(100) DEFAULT 'Perfume',
  marca       VARCHAR(100),
  precio      NUMERIC(12,2) NOT NULL DEFAULT 0,
  costo       NUMERIC(12,2) DEFAULT 0,
  stock       INT DEFAULT 0,
  imagen      TEXT,                    -- imagen en base64 (igual que cafeteria)
  activo      BOOLEAN DEFAULT TRUE,    -- soft delete
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
--  VENTAS / FACTURAS DE ALOHA
--  Numeracion propia ALH-00000001 (independiente, sin NCF)
--  ITBIS opcional por factura (checkbox en el POS)
-- ============================================================
CREATE TABLE IF NOT EXISTS aloha_ventas (
  id                   BIGSERIAL PRIMARY KEY,
  numero               VARCHAR(20),              -- ALH-00000001
  cliente_id           BIGINT REFERENCES aloha_clientes(id) ON DELETE SET NULL,
  cliente_nombre       VARCHAR(200),
  subtotal             NUMERIC(12,2) DEFAULT 0,
  itbis                NUMERIC(12,2) DEFAULT 0,  -- 0 si no se aplico
  aplica_itbis         BOOLEAN DEFAULT FALSE,
  total                NUMERIC(12,2) NOT NULL DEFAULT 0,
  metodo_pago          VARCHAR(30) DEFAULT 'EFECTIVO',  -- EFECTIVO|TARJETA|TRANSFERENCIA|MIXTO
  monto_efectivo       NUMERIC(12,2) DEFAULT 0,
  monto_tarjeta        NUMERIC(12,2) DEFAULT 0,
  monto_transferencia  NUMERIC(12,2) DEFAULT 0,
  usuario              VARCHAR(100),
  anulada              BOOLEAN DEFAULT FALSE,
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS aloha_detalle (
  id           BIGSERIAL PRIMARY KEY,
  venta_id     BIGINT REFERENCES aloha_ventas(id) ON DELETE CASCADE,
  producto_id  BIGINT REFERENCES aloha_productos(id),
  cantidad     INT NOT NULL DEFAULT 1,
  precio       NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
--  CONTABILIDAD INDEPENDIENTE DE ALOHA
--  (mismo esquema que cafeteria_/capacitacion_ para reutilizar
--   el modulo contable del backend)
-- ============================================================

-- Caja chica
CREATE TABLE IF NOT EXISTS aloha_caja_chica (
  id           BIGSERIAL PRIMARY KEY,
  fecha        TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),  -- hora local RD (la guarda la app)
  descripcion  TEXT,
  categoria    TEXT DEFAULT 'Otro',
  monto        NUMERIC(12,2) NOT NULL,
  tipo         TEXT CHECK (tipo IN ('INGRESO','EGRESO')),
  usuario      TEXT,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cuentas por cobrar
CREATE TABLE IF NOT EXISTS aloha_cuentas_cobrar (
  id                 SERIAL PRIMARY KEY,
  cliente_nombre     VARCHAR(200),
  descripcion        TEXT NOT NULL,
  monto_original     NUMERIC(12,2) NOT NULL,
  monto_pagado       NUMERIC(12,2) DEFAULT 0,
  fecha_emision      DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento  DATE NOT NULL,
  estado             VARCHAR(20) DEFAULT 'PENDIENTE',   -- PENDIENTE | PARCIAL | PAGADO | ANULADO
  notas              TEXT,
  created_by         VARCHAR(100),
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS aloha_pagos_cobrar (
  id          SERIAL PRIMARY KEY,
  cuenta_id   INT REFERENCES aloha_cuentas_cobrar(id) ON DELETE CASCADE,
  monto       NUMERIC(12,2) NOT NULL,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo      VARCHAR(30) DEFAULT 'EFECTIVO',
  referencia  VARCHAR(200),
  notas       TEXT,
  usuario     VARCHAR(100),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cuentas por pagar
CREATE TABLE IF NOT EXISTS aloha_cuentas_pagar (
  id                 SERIAL PRIMARY KEY,
  suplidor_nombre    VARCHAR(200),
  descripcion        TEXT NOT NULL,
  monto_original     NUMERIC(12,2) NOT NULL,
  monto_pagado       NUMERIC(12,2) DEFAULT 0,
  fecha_emision      DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento  DATE NOT NULL,
  estado             VARCHAR(20) DEFAULT 'PENDIENTE',
  notas              TEXT,
  created_by         VARCHAR(100),
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS aloha_pagos_pagar (
  id          SERIAL PRIMARY KEY,
  cuenta_id   INT REFERENCES aloha_cuentas_pagar(id) ON DELETE CASCADE,
  monto       NUMERIC(12,2) NOT NULL,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo      VARCHAR(30) DEFAULT 'EFECTIVO',
  referencia  VARCHAR(200),
  notas       TEXT,
  usuario     VARCHAR(100),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cuadre de caja
CREATE TABLE IF NOT EXISTS aloha_cuadre_caja (
  id                    BIGSERIAL PRIMARY KEY,
  fecha                 DATE NOT NULL DEFAULT CURRENT_DATE,
  fondo_inicial         NUMERIC(12,2) DEFAULT 0,
  ventas_efectivo       NUMERIC(12,2) DEFAULT 0,
  ventas_tarjeta        NUMERIC(12,2) DEFAULT 0,
  ventas_transferencia  NUMERIC(12,2) DEFAULT 0,
  ventas_total          NUMERIC(12,2) DEFAULT 0,
  ingresos_caja         NUMERIC(12,2) DEFAULT 0,
  egresos_caja          NUMERIC(12,2) DEFAULT 0,
  cobros_efectivo       NUMERIC(12,2) DEFAULT 0,
  cobros_tarjeta        NUMERIC(12,2) DEFAULT 0,
  cobros_transferencia  NUMERIC(12,2) DEFAULT 0,
  efectivo_esperado     NUMERIC(12,2) DEFAULT 0,
  efectivo_contado      NUMERIC(12,2) DEFAULT 0,
  efectivo_final        NUMERIC(12,2) DEFAULT 0,
  diferencia            NUMERIC(12,2) DEFAULT 0,
  usuario               TEXT,
  notas                 TEXT,
  creado_en             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
--  INDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_aloha_prod_activo    ON aloha_productos(activo);
CREATE INDEX IF NOT EXISTS idx_aloha_cli_activo     ON aloha_clientes(activo);
CREATE INDEX IF NOT EXISTS idx_aloha_ventas_fecha   ON aloha_ventas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aloha_det_venta      ON aloha_detalle(venta_id);
CREATE INDEX IF NOT EXISTS idx_aloha_cc_fecha       ON aloha_caja_chica(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_aloha_cxc_estado     ON aloha_cuentas_cobrar(estado);
CREATE INDEX IF NOT EXISTS idx_aloha_cxc_venc       ON aloha_cuentas_cobrar(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_aloha_pcxc_cuenta    ON aloha_pagos_cobrar(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_aloha_cxp_estado     ON aloha_cuentas_pagar(estado);
CREATE INDEX IF NOT EXISTS idx_aloha_cxp_venc       ON aloha_cuentas_pagar(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_aloha_pcxp_cuenta    ON aloha_pagos_pagar(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_aloha_cuadre_fecha   ON aloha_cuadre_caja(fecha DESC);

-- Listo. 11 tablas nuevas con prefijo aloha_, totalmente independientes.
