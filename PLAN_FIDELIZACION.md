# Plan — Módulo de Fidelización de Clientes · SÓLIDO AUTO SERVICIO

Programa de lealtad **multicanal** que premia al cliente sin importar si gasta en
Taller, Car Wash, Cafetería o Cursos. Aprovecha dos ventajas que ya tienes: el
**historial por cliente/vehículo** y la comunicación por **WhatsApp**.

---

## 1. Estrategia recomendada (qué incluir)

Basado en las mejores prácticas del sector (talleres, car wash y programas de puntos):

1. **Puntos multicanal (núcleo).** El cliente gana puntos por cada peso facturado
   en cualquiera de los 4 canales. Regla simple y única.
2. **Niveles (tiers).** Bronce → Plata → Oro → Platino según gasto acumulado (12
   meses). A mayor nivel, más beneficios. Genera aspiración y retención.
3. **Membresía Car Wash ilimitado (suscripción).** Cuota mensual fija → lavados
   ilimitados o muy descontados. Es el mayor motor de retención en car wash.
4. **Recompensas canjeables.** Descuentos, lavado gratis, café gratis, cambio de
   aceite con descuento, prioridad de atención.
5. **Sellos de lavado (punch card).** "El 10mo lavado es gratis" — sencillo y muy
   efectivo para frecuencia.
6. **Referidos.** El cliente gana puntos cuando alguien que él refirió factura por
   primera vez. Baja el costo de adquisición.
7. **Cumpleaños / fechas.** Puntos o recompensa el mes de cumpleaños.
8. **Comunicación WhatsApp.** Avisos automáticos: "ganaste X puntos", "tienes una
   recompensa disponible", "te faltan 2 lavados para uno gratis".

> Principio rector: **simple de entender, fácil de ganar, fácil de canjear.**

---

## 2. Mecánica sugerida (números, ajustables)

| Concepto | Propuesta inicial |
|---|---|
| Acumulación | **1 punto por cada RD$100** facturados (sobre el subtotal, sin ITBIS) |
| Valor de canje | **100 puntos = RD$100** de descuento (≈1% cashback) |
| Vencimiento de puntos | 12 meses desde que se ganan (opcional) |
| Meta de canje | 20–30% de los miembros canjea al año |
| Referido | **200 puntos** al referidor cuando el referido hace su 1ª factura |
| Cumpleaños | 100 puntos o un lavado básico gratis |

**Niveles (por gasto acumulado en 12 meses):**

| Nivel | Gasto acumulado | Beneficios sugeridos |
|---|---|---|
| 🥉 Bronce | RD$0 – 9,999 | Puntos x1 |
| 🥈 Plata | RD$10,000 – 29,999 | Puntos x1.25 + 5% en cafetería |
| 🥇 Oro | RD$30,000 – 74,999 | Puntos x1.5 + lavado básico gratis al mes + prioridad |
| 💎 Platino | RD$75,000+ | Puntos x2 + lavado gratis quincenal + 10% en repuestos |

**Sellos de lavado:** cada lavado pagado = 1 sello; al llegar a 10, el siguiente es gratis.

**Membresía Car Wash (ejemplo):** RD$X/mes → 4 lavados básicos incluidos + 20% en
detallado + fila preferencial. (Definir precio según costo de tu lavado.)

---

## 3. Diseño técnico (sobre tu stack: Next.js + Express + Supabase)

### 3.1 Base de datos (Supabase) — nuevas tablas

- `fidelizacion_config` — reglas del programa (ratio, valor de canje, niveles,
  vencimiento). Una fila editable por el gerente.
- `cliente_fidelizacion` — por cliente: `saldo_puntos`, `puntos_historicos`,
  `gasto_12m`, `nivel`, `codigo_referido`, `referido_por`, `fecha_nivel`.
- `puntos_movimientos` — **libro mayor** (ledger) inmutable: cada ganancia/canje/
  ajuste/vencimiento con `cliente_id`, `puntos` (±), `tipo`, `origen`
  (taller/carwash/cafeteria/curso/referido/cumpleaños/canje), `ref_id`, `fecha`.
- `recompensas` — catálogo: nombre, costo en puntos, tipo (descuento/servicio),
  valor, activo.
- `canjes` — recompensas canjeadas: cliente, recompensa, puntos usados, factura
  aplicada, estado, fecha.
- `sellos_lavado` — contador de sellos por cliente (o derivarlo del ledger).
- `membresias_carwash` — suscripciones: cliente, plan, estado, inicio, próximo
  cobro, lavados usados en el ciclo.

> El **ledger** (`puntos_movimientos`) es la fuente de verdad; el `saldo_puntos`
> es un acumulado para velocidad. Así nunca se pierde la trazabilidad.

### 3.2 Backend (server.mjs)

- **Helper central** `acumularPuntos(cliente_id, monto, origen, ref_id)`:
  calcula puntos según `fidelizacion_config`, inserta en el ledger, actualiza saldo
  y recalcula nivel. Se llama desde cada punto de venta:
  - Factura de taller (`/facturas`) y de car wash (`/carwash/:id/facturar`).
  - Venta POS de repuestos (`ventas`).
  - Venta de cafetería (`cafeteria_ventas`) — si el cliente está identificado.
  - Pago de curso (`capacitaciones_pagos`).
- **Endpoints nuevos** (`/fidelizacion/*`):
  - `GET /fidelizacion/cliente/:id` → saldo, nivel, movimientos, recompensas disponibles.
  - `POST /fidelizacion/canjear` → descuenta puntos y aplica recompensa a una factura.
  - `GET/POST/PATCH /fidelizacion/recompensas` → catálogo.
  - `GET/POST /fidelizacion/config` → reglas del programa.
  - `POST /fidelizacion/referido` → registrar referido.
  - `GET/POST /fidelizacion/membresias` + cron de cobro mensual.
  - `GET /fidelizacion/resumen` → métricas para dashboard/inteligencia.

### 3.3 Frontend (Next.js)

- **Módulo `/fidelizacion`** (admin, sidebar + permisos): panel del programa,
  buscador de clientes con su saldo/nivel, canjear recompensa, catálogo de
  recompensas, configuración de reglas, referidos y membresías.
- **En Facturación / POS:** mostrar saldo de puntos del cliente y botón
  **"Canjear"** al momento de cobrar (aplica descuento a la factura).
- **En la ficha del cliente:** tarjeta con puntos, nivel y progreso al siguiente nivel.
- **PWA del cliente (`/cliente`):** que el cliente vea sus puntos, nivel,
  recompensas y cuántos sellos le faltan (engagement + lo trae de vuelta).
- **Pantalla TV / Dashboard:** opcional, "cliente del mes" o recompensas entregadas.
- **Inteligencia:** nueva pestaña con métricas del programa (ver KPIs).

### 3.4 Comunicación (WhatsApp)
Mensajes automáticos o en cola de aprobación: puntos ganados tras facturar,
recompensa desbloqueada, recordatorio "te falta 1 sello", cumpleaños, y aviso de
cobro/renovación de membresía.

---

## 4. Plan por fases (recomiendo construir así)

**Fase 1 — MVP (lo esencial que ya da valor):**
- SQL: `fidelizacion_config`, `cliente_fidelizacion`, `puntos_movimientos`.
- `acumularPuntos()` enganchado a facturas de **taller y car wash**.
- Saldo de puntos visible en ficha de cliente y en facturación.
- Canje manual de descuento al cobrar.
- Módulo `/fidelizacion` básico + sidebar + permisos.

**Fase 2 — Niveles y recompensas:**
- Tiers automáticos + tabla `recompensas` y `canjes`.
- Sellos de lavado (punch card) y recompensas automáticas.
- Sumar acumulación de **cafetería y cursos**.

**Fase 3 — Membresía y referidos:**
- `membresias_carwash` + cobro mensual (cron Railway).
- Referidos con código por cliente.

**Fase 4 — Engagement y analítica:**
- Avisos por WhatsApp.
- Vista del cliente en la PWA.
- Pestaña de fidelización en Inteligencia.

---

## 5. KPIs para medir el éxito

- **Tasa de canje** (meta 20–30%).
- **Retención / frecuencia de visita** de miembros vs. no miembros.
- **% de ingresos provenientes de miembros** y de la membresía car wash.
- **Ticket promedio** y **CLV** (valor de vida) por nivel.
- **Referidos convertidos.**

---

## 6. Consideraciones para República Dominicana

- **Puntos sobre el subtotal, no sobre el ITBIS** (el impuesto no es ingreso tuyo).
- Los puntos pendientes son un **pasivo contable**; conviene reflejarlo (se puede
  estimar: puntos × valor de canje).
- Al **canjear**, el descuento reduce la base imponible de la factura — manéjalo
  como descuento, no como producto gratis, para el NCF/ITBIS.
- Define **vencimiento** de puntos para que el pasivo no crezca indefinidamente.

---

### Siguiente paso sugerido
Empezar por la **Fase 1 (MVP)**: con eso ya acumulas y canjeas puntos en taller y
car wash. Si lo apruebas, genero el SQL de las tablas y los primeros endpoints.
