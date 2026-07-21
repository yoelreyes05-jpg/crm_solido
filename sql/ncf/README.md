# NCF — orden de aplicación

Los cambios en `crm-backend/server.mjs` **ya están hechos** y dependen de la
función `siguiente_comprobante()`. Hasta que corras el script 06, la
facturación devuelve error 500 — a propósito: es preferible a emitir
comprobantes inválidos.

## Orden

| # | Script | Qué hace | Seguro |
|---|--------|----------|--------|
| 01 | `01_clasificar_tablas.sql` | Comenta cada tabla con su estado | Sí, solo metadatos |
| 06 | `06_ncf_dual_ecf_ready.sql` | **Crea `siguiente_comprobante()`** y prepara e-CF | Sí |
| 07 | `07_separar_ncf_cafeteria.sql` | Separa la numeración de la cafetería | Sí |
| 02 | `02_archivar_tablas_muertas.sql` | Archiva 4 tablas vacías | Por pasos, reversible |

**Correr 06 antes que 07.** El 07 redefine la función agregándole la unidad
de negocio.

Los scripts 03, 04 y 05 son históricos: diagnóstico y hallazgos. El 04 quedó
superado por el 06. Se conservan como registro de cómo se llegó aquí.

## Antes de operar

1. Cargar en `ncf_config` el rango autorizado por la DGII:
   `secuencia_hasta` y `fecha_vencimiento`. Sin eso el sistema emite pero no
   puede frenarte al agotar el rango.
2. `secuencia_actual` arranca en **0**, no en 1. La columna tiene `default 1`
   y el código suma 1, por eso el `B0100000001` y el `B0200000001` nunca se
   emitieron.
3. Borrar la data de prueba (paso 1 del script 06).
4. Cargar `rnc_emisor` del taller, sin guiones.

## Endpoints migrados

Los cinco que emitían NCF ahora usan el RPC:

| Endpoint | Unidad |
|---|---|
| `POST /facturas` | `taller` |
| `POST /ventas` | `taller` |
| `POST /cotizaciones/:id/convertir` | `taller` |
| `POST /ordenes/:id/facturar-lavado` (carwash) | `taller` |
| `POST /cafeteria/venta` | `cafeteria` (inactiva → sin NCF) |

`GET /ncf/siguiente` acepta ahora `?unidad=taller|cafeteria` y reporta si el
rango está agotado o vencido.

## Lo que se eliminó y por qué

En cuatro endpoints había un fallback que generaba el NCF con
`Math.random()` cuando no encontraba configuración, y en la cafetería uno que
asignaba `B0200000001` a **todas** las ventas. Ambos producían comprobantes
fuera de cualquier rango autorizado, en silencio y sin error.

Ahora la emisión falla ruidosamente. Una venta que no se guarda se arregla;
un comprobante inválido ante la DGII, no.

## Riesgo residual conocido

Si el `INSERT` de la factura falla después de obtener el número, ese NCF
queda sin usar. **No se revierte la secuencia a propósito**: decrementar es
inseguro bajo concurrencia — otra factura pudo haber tomado el siguiente
número y se generaría un duplicado.

Los huecos los detecta la vista `v_ncf_faltantes` y se reportan como anulados
en el **Formato 608**. Correr esa vista una vez al mes.

La atomicidad total exigiría mover el endpoint completo a una función de
Postgres. Queda pendiente; el riesgo actual es bajo y el hueco es reportable.

## Respaldo

`crm-backend/server.mjs.bak-20260720` — copia previa a estos cambios.
Borrar cuando confirmes que todo funciona.
