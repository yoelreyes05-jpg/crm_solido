# Contexto del sistema — CRM Automotriz

> Documento maestro. Leer esto primero en cualquier sesión nueva.
> Última actualización: 2026-07-20

---

## 1. Reglas permanentes

1. **No romper lo que funciona.** Solo agregar lo que falta.
2. **Reciclar antes de crear.** Antes de una tabla o columna nueva, revisar si existe una sin usar que sirva. El objetivo es dejar de acumular estructuras vacías.
3. **Migración por fases,** nunca de un solo golpe. Las tablas viejas quedan intactas hasta validar cuadres.
4. **Toda tabla lleva su `COMMENT`** con estado `[ACTIVA]`, `[SIN LANZAR]`, `[MUERTA]` o `[REVISAR]`.
5. **Objetivo de producto:** minimizar los clics de la secretaria al generar cualquier movimiento.

---

## 2. Los cuatro negocios: qué se toca y qué no

| Sistema | Prefijo | Estado |
|---|---|---|
| **Taller** (+ carwash, capacitación, membresías) | sin prefijo | **Único en alcance** |
| Gelatilandia (ex UnLupaso) | `ul_` | **INTOCABLE** — POS adicional, funciona bien |
| Aloha | `aloha_` | **INTOCABLE** — sucursal distinta |
| Cafetería | `cafeteria_` | **INTOCABLE** — opera dentro del taller, fuera del sistema |
| CRM Clínico | `pacientes`, `medicos`, `historiales_*`, `facturas_clinica`, `*_ars`… | **INTOCABLE** — sistema independiente en la misma BD |

Los cuatro intocables no se unifican, no se migran, no se renombran.

**Ojo con la capa compartida:** `asientos_contables`, `partidas_contables`, `cuentas_contables` y `movimientos_financieros` tienen `medico_id` y se diseñaron para la clínica. Si el CRM clínico las usa, el taller se suma **sin alterar columnas existentes**.

---

## 2b. Estado real: el sistema NO está en producción

Yoel está en pruebas. **No ha operado ni vendido.** Las 21 facturas existentes son data de prueba con NCF inventados, fuera de cualquier rango autorizado. **Cero exposición ante la DGII** — no hay Formato 608 que presentar ni comprobantes que justificar.

Valor de esa data: diagnóstico. Reveló el bug del contador de NCF (ver §5).

**Decisión tomada sobre facturación:** operar con **NCF serie B**, con la estructura **preparada para e-CF** desde el diseño. El cambio a e-CF debe ser configuración, no reescritura. Implementado en `06_ncf_dual_ecf_ready.sql`.

---

## 3. El taller: lo que está vivo

| Tabla | Filas | Rol |
|---|---|---|
| `factura_items` | 22 | Líneas de factura |
| `facturas` | 21 | Factura fiscal |
| `caja_movimientos` | 16 | Movimientos de caja |
| `ordenes_trabajo` | 11 | Órdenes de trabajo |
| `repuestos` | 10 | Catálogo A |
| `cuadre_caja` | 10 | Cuadre diario |
| `inventario` | 6 | Catálogo B (el que está FK'd) |
| `cotizaciones` | 4 | Cotizaciones |

Más el núcleo compartido: `clientes`, `vehiculos`, `profiles`.

Es un sistema chico. La unificación es tratable.

---

## 4. Lo que ya está construido y sirve

- **`facturas` ya trae `cobrado_por` y `fecha_cobro`.** El flujo vendedor→secretaria está a medio hacer, no hay que empezar de cero.
- **`factura_items` ya trae `tipo`, `itbis_aplica`, `inventario_id`.** Ya admite líneas de SERVICIO, no solo repuestos. **No hace falta columna nueva para distinguir servicios.**
- **`clientes` ya trae `rnc` y `tipo_cliente`.** Suficiente para derivar el NCF automáticamente.
- **`cuadre_caja.tipo`** existe y parece sin uso — candidato a discriminador de unidad de negocio.
- **`cuadre_caja` ya tiene `cafe_efectivo`/`cafe_total`**: la cafetería entra como rollup, no como tablas. Ese patrón es el correcto y hay que extenderlo a carwash, capacitación y membresías.
- **`asientos_contables` tiene `referencia_tipo`/`referencia_id`** (polimórfico). Sirve para el taller aunque se diseñó para la clínica. No hace falta tabla nueva.

---

## 5. Los cinco problemas

**1. Usuarios como texto libre — bloqueador #1**
`facturas.creado_por` es `text`, `facturas.cobrado_por` es `varchar`, `pagos_cobrar.usuario` es `varchar`. `profiles.id` es `uuid` con `role` tipo enum. **Mientras los usuarios sean texto, el RLS que quieres no se puede implementar.** Nada del flujo vendedor/secretaria es seguro hasta resolver esto.

*Aplicando la regla de reciclar:* no se agregan columnas nuevas. Se convierten las existentes — `creado_por text` → `vendedor_id uuid`, `cobrado_por varchar` → `cobrado_por_id uuid`, migrando los valores por nombre/email contra `profiles`.

**2. Dos catálogos vivos con data distinta**
`repuestos` (10) y `inventario` (6). `factura_items.inventario_id` apunta a `inventario`. La secretaria no sabe en cuál buscar; si falla, teclea el ítem a mano.
Consolidar **hacia `inventario`**, que es el que ya está FK'd. Cambiar el destino de la FK en un sistema vivo es riesgo sin beneficio.

**3. Carwash, capacitación y membresías cobran fuera de `facturas`**
`capacitaciones_pagos` cuelga de `alumno_id`, `plan_pagos` de `membresia_id`, y `carwash_servicios` es solo lista de precios sin tabla de ventas. Cada uno es una pantalla distinta — ahí están los clics. Y ninguno emite NCF.

**4. RESUELTO — Los "huecos" eran la cafetería, no números quemados**

Hipótesis inicial (**equivocada**): el contador quemaba números en inserts fallidos.

**Realidad verificada:** los seis NCF que faltaban en `facturas` — `B02` 3, 4, 10, 11, 12, 21 — están todos en `cafeteria_ventas`. Tres endpoints del backend comparten la misma secuencia: `POST /facturas`, `POST /ventas` y `POST /cafeteria/venta`. Taller y cafetería se intercalan en la misma serie B02.

Cuenta final: 20 en `facturas` + 6 en `cafeteria_ventas` = 26 de 27. Solo `B02-1` y `B01-1` sin ubicar, probablemente con las facturas de prueba id 1–24 que sí fueron borradas. **La numeración está sana y consecutiva.**

**Decisión pendiente:** si la cafetería factura bajo el mismo RNC, compartir secuencia es correcto y hay que dejarlo así conscientemente. Si tiene RNC propio, hay que separarla.

**Lección de método:** los conteos de `pg_stat_user_tables.n_live_tup` son estimados del autovacuum. Reportó `ncf_config` en 0 cuando tenía 4 filas. Antes de declarar muerta una tabla, confirmar siempre con `count(*)` real.

Otros hallazgos vigentes: factura id 45 con NCF y `total = 0` (ya bloqueado por constraint); RNC guardado con guiones — la DGII lo pide sin ellos en los formatos 606/607.

**5b. `Math.random()` como fallback de NCF — sigue en pie**
En `crm-backend/server.mjs` (líneas ~1239, ~1464, ~2729), si no hay fila en `ncf_config` para el tipo pedido, el código genera el NCF con `Math.random()`. Hoy B01 y B02 están configurados, pero el frontend ofrece **B14 y B15** en el selector (`NCF_REQUIERE_RNC = ["B01","B14","B15"]`). Si esos tipos no están en las 4 filas, elegirlos emite un comprobante aleatorio. Debe reemplazarse por un error que falle ruidosamente.

**5. `usuarios` y `profiles` coexisten**
Hay que definir cuál manda antes de tocar RLS.

---

## 6. Diseño objetivo: pantalla única de cobro

Una sola pantalla, tres clics:

1. **Un campo de búsqueda** — cliente, placa, número de factura o RNC.
2. **Todo lo pendiente de ese cliente**, sin importar la unidad: factura del taller, lavado de hoy, cuota de membresía, cuota de curso.
3. **Marcar → método de pago → Enter.**

Lo que lo habilita:

- `unidad_negocio` en `facturas` (`taller`, `carwash`, `capacitacion`, `membresia`). Carwash, cursos y planes generan facturas normales con ítems tipo `SERVICIO`; sus tablas actuales quedan como origen, no como cobro.
- Una vista `v_pendientes_cobro` — el único query de la pantalla.
- Un RPC `cobrar()` que en una transacción: marca la factura, asigna NCF, registra el pago, escribe el asiento y alimenta el cuadre. Atómico.
- **NCF automático, nunca manual.** Con RNC → B01; sin RNC → B02. La secretaria no elige tipo de comprobante jamás.
- Catálogo unificado para que un solo buscador encuentre repuestos, servicios de carwash, cursos y planes.

**Contabilidad:** las cajas siguen separadas, pero como *filtro* sobre `cuadre_caja`, no como tablas distintas. La consolidación real ocurre en `asientos_contables` con centro de costo = unidad de negocio. De ahí sale el P&L por línea y el consolidado, del mismo dato — que es lo que pide el banco.

---

## 7. Dónde aplica y dónde no la regla de reciclar

**Aplica bien** (mismo tipo, misma semántica):

| En vez de crear | Usar |
|---|---|
| columna para marcar servicios | `factura_items.tipo` |
| columna de tipo de NCF | derivar de `clientes.rnc` |
| tabla de asientos del taller | `asientos_contables.referencia_tipo/id` |
| `vendedor_id` nuevo | convertir `facturas.creado_por` |
| discriminador de unidad en cuadre | `cuadre_caja.tipo` |

**No aplica** — aquí reciclar sale caro:

- `asientos_contables.medico_id` es `uuid`; `unidad_negocio` es texto. Forzar una columna a significar otra cosa sin renombrarla deja una trampa para el próximo que lea el schema. Ahí sí va columna nueva.
- Reutilizar una tabla viva para otro propósito. Solo se reciclan las que están en 0.

---

## 8. Preguntas abiertas

1. ¿De dónde salen los NCF de `facturas`?
2. ¿Gelatilandia factura bajo el mismo RNC que el taller? Si sí, dos secuencias de NCF sobre el mismo rango = comprobantes duplicados ante la DGII.
3. ¿Los lavados de carwash se cobran hoy? ¿Dónde se registran?
4. ¿El módulo clínico está en uso? (faltan conteos de `pacientes`, `medicos`, `facturas_clinica`, `historiales_*`)
5. ¿`usuarios` o `profiles`?

---

## 9. Orden de trabajo

| Fase | Qué | Por qué primero |
|---|---|---|
| 0 | Correr `01_clasificar_tablas.sql` | Deja el estado en la BD |
| 1 | Resolver preguntas 1, 2 y 5 | NCF y usuarios bloquean todo |
| 2 | `creado_por`/`cobrado_por` → uuid FK a `profiles` | Desbloquea RLS |
| 3 | RLS + RPC `cobrar()` | El flujo vendedor→secretaria |
| 4 | Consolidar `repuestos` → `inventario` | Un solo buscador |
| 5 | `unidad_negocio` + carwash/cursos/planes hacia `facturas` | Pantalla única |
| 6 | Encender `asientos_contables` | P&L por unidad para el banco |
| 7 | Archivar muertas (`02_archivar…`) | Al final, sin prisa |

---

## Archivos

- `00_CONTEXTO_SISTEMA.md` — este documento
- `01_clasificar_tablas.sql` — comentarios de estado (seguro, solo metadatos)
- `02_archivar_tablas_muertas.sql` — retiro por fases de las 4 tablas muertas
