# Análisis de Mejoras — CRM Automotriz + App Cliente
**Sólido Auto Servicio · Julio 2026**

Análisis del código real: `crm-backend/server.mjs` (9,163 líneas, 213 endpoints), `frontend/src` (32,646 líneas, ~40 páginas).

---

## 🔴 CRÍTICO — Seguridad (atender de inmediato)

### 1. Contraseñas guardadas en texto plano
En `server.mjs` (línea ~2448) el login compara la contraseña directamente:
```js
.eq("password_hash", password)  // no hay hash real
```
Cualquiera con acceso a la BD ve todas las contraseñas.
**Solución:** usar `bcrypt` para hashear. Migración: al próximo login de cada usuario, re-hashear su contraseña.

### 2. Los 213 endpoints del backend están abiertos — sin autenticación
No existe ningún middleware de auth en el backend. Cualquier persona con la URL de Railway (que está hardcodeada en `config.ts` y visible en el código del navegador) puede:
- Leer todos los clientes, vehículos, facturas, nóminas, contabilidad
- Crear/borrar órdenes, modificar inventario, anular facturas

Irónicamente `lib/api.ts` ya tiene un wrapper `apiFetch` con Bearer token… **pero 0 páginas lo usan** (las 237 llamadas usan `fetch` directo) y el backend nunca emite token.
**Solución:** emitir JWT en `/auth/login` (jsonwebtoken), middleware que valide token en todo excepto rutas públicas del cliente, y migrar el frontend a `apiFetch` (búsqueda/reemplazo mayormente mecánica).

### 3. La app cliente descarga TODA la base de datos
En `cliente/page.tsx` (línea ~586), al buscar una placa el navegador descarga:
```js
fetch(`${API}/vehiculos`)     // TODOS los vehículos
fetch(`${API}/ordenes`)       // TODAS las órdenes
fetch(`${API}/diagnosticos`)  // TODOS los diagnósticos
```
…y filtra por placa **en el navegador**. Cualquier visitante puede abrir DevTools y ver datos de todos los clientes (nombres, teléfonos, placas, montos). Riesgo legal directo bajo la Ley 172-13 de protección de datos (RD).
**Solución:** un solo endpoint `GET /publico/estado?placa=X&telefono=Y` que devuelva únicamente los datos de ese vehículo, validando placa + últimos 4 dígitos del teléfono del dueño.

### 4. Sesión falsificable
El middleware de Next.js solo verifica que exista la cookie `usuario`; el rol se lee de localStorage. Cualquiera puede crear la cookie a mano y entrar como gerente.
**Solución:** cookie httpOnly firmada (o el JWT del punto 2) y verificación de rol en el backend, no en el navegador.

### 5. Endpoints `/debug` expuestos en producción
`/debug` revela URL de Supabase, prefijo de la key y datos; `/debug/orden/:id` expone diagnósticos. Eliminarlos o protegerlos.

### 6. CORS abierto por defecto
Si `CORS_ORIGINS` no está configurada en Railway, se acepta cualquier origen. Verificar que esté configurada en producción.

---

## 🟠 ALTO — Integridad de datos y fiscal

### 7. NCF: riesgo de comprobantes duplicados o inválidos (DGII)
La secuencia NCF se lee y luego se actualiza en dos pasos sin bloqueo — dos facturas simultáneas pueden obtener el **mismo NCF**. Peor: si no hay config, se genera un NCF **aleatorio** (`Math.random()`), fiscalmente inválido.
**Solución:** función RPC en Postgres (`UPDATE ... RETURNING`) que incremente atómicamente; eliminar el fallback aleatorio (rechazar la factura si no hay secuencia). Añadir alerta cuando queden <50 NCF disponibles y control de fecha de vencimiento de la secuencia.

### 8. Stock: condiciones de carrera
Descuento de stock con leer-luego-escribir sin transacción. Dos ventas simultáneas del mismo repuesto descuadran el inventario. Además `Math.max(0, ...)` oculta ventas sin stock en lugar de rechazarlas.
**Solución:** RPC atómica `descontar_stock(id, cantidad)` que falle si no hay existencia.

### 9. Sin transacciones en operaciones multi-tabla
Facturar = insertar factura + descontar stock de N ítems como pasos independientes. Si falla a la mitad, queda factura sin descuento (o viceversa). Igual en anulaciones.
**Solución:** mover estas operaciones a funciones Postgres (RPC de Supabase) que sean transaccionales.

### 10. Errores devueltos con status 200
Patrón general `res.json({ error })` sin código HTTP. El frontend a veces solo chequea `res.ok`, así que hay errores que pasan silenciosos.
**Solución:** `res.status(400/404/500).json(...)` consistente + manejador de errores global en Express.

---

## 🟡 MEDIO — Arquitectura y rendimiento

### 11. Monolito de 9,163 líneas
`server.mjs` contiene todo. Ya existe `routes/facturacion.js` como patrón — continuar: `routes/clientes.js`, `ordenes.js`, `inventario.js`, `cafeteria.js`, `contabilidad.js`, `auth.js`, etc.

### 12. Sin paginación — todo viene completo
`/ordenes` trae todas las órdenes + todos los clientes + todos los vehículos + todos los usuarios en cada llamada. Con 1–2 años de datos esto se vuelve lento y costoso.
**Solución:** `?limit=50&offset=` y filtros por estado/fecha en el backend; en listados del CRM, cargar por página.

### 13. Páginas gigantes en el frontend
`contabilidad` (2,223 líneas), `cafeteria` (2,103), `cliente` (2,041), `facturacion` (1,885)… todo con CSS inline duplicado y lógica repetida (formateo de moneda, impresión, fetch). Extraer: `useFetch`/hooks compartidos, componentes de tabla/badge/modal, utilidades `fmtMoney/fmtDate`, y plantillas de impresión comunes.

### 14. Dependencias muertas y desalineadas
Prisma está en `package.json` del frontend pero el acceso a datos es vía backend — eliminarlo aligera el build. El service worker (`next-pwa`) cachea con URLs hardcodeadas de `crm-solido.vercel.app` que no funcionarán si cambia el dominio.

### 15. Sin realtime (ya lo pagas con Supabase)
El tablero kanban, la pantalla del taller y el estado del cliente dependen de recargas/polling. Supabase Realtime está incluido: suscribirse a cambios de `ordenes_trabajo` actualizaría kanban/pantalla/cliente al instante sin costo extra.

### 16. Calidad y mantenimiento
Sin tests, sin TypeScript en el backend, `any` generalizado en el frontend. Mínimo recomendable: tests de los flujos de dinero (facturación, NCF, stock) y tipos compartidos para las entidades principales (Orden, Cliente, Factura).

---

## 🟢 PRODUCTO — Mejoras de valor para el negocio

### App Cliente
1. **Acceso seguro y personal**: placa + últimos 4 del teléfono (o link único por WhatsApp al crear la orden). Elimina el problema #3 y se siente más profesional.
2. **Notificaciones automáticas de estado** por WhatsApp (Twilio/360dialog o wa.me manual como primer paso): "Tu vehículo pasó a Reparación", "¡Listo para recoger!". Es la mejora #1 de percepción del cliente.
3. **Aprobación de cotización desde el celular**: ya existe `/aprobacion` y `/cotizacion/[id]` — conectarlo con notificación al cliente y botón Aprobar/Rechazar con firma. Acelera el ciclo de reparación.
4. **Historial descargable en PDF** (ya tienen jspdf) en lugar de la ventana de impresión.
5. **Recordatorios de mantenimiento**: con el kilometraje/fecha del último servicio, avisar "Tu Corolla cumple 5,000 km este mes" — genera retorno de clientes y ya existe la base en `/mantenimiento` y `PLAN_FIDELIZACION.md`.

### CRM
6. **Dashboard con alertas accionables**: NCF por agotarse, repuestos bajo mínimo, órdenes estancadas +5 días en un estado, cotizaciones sin respuesta +48h.
7. **Cierre de caja diario formal** (cafetería + taller): arqueo, diferencias, reporte imprimible.
8. **Reporte 606/607 DGII** exportable desde contabilidad (ya tienen los datos de compras/ventas con NCF).
9. **Kanban con drag & drop en tiempo real** (ya tienen `@hello-pangea/dnd` instalado + realtime del punto 15).
10. **Auditoría**: tabla `log_acciones` (quién anuló factura, quién cambió precio, quién borró cliente). Barato de implementar y crucial cuando hay dinero de por medio.

---

## Plan sugerido (orden de ejecución)

| Fase | Qué | Esfuerzo |
|------|-----|----------|
| **1. Blindaje** (urgente) | bcrypt + JWT + middleware auth + endpoint público por placa+teléfono + borrar /debug + CORS | 3–5 días |
| **2. Fiscal/datos** | RPC atómicas NCF y stock, transacciones, status HTTP correctos | 2–3 días |
| **3. Valor cliente** | Notificaciones WhatsApp + aprobación cotización + acceso personal | 1 semana |
| **4. Arquitectura** | Dividir server.mjs, paginación, realtime, limpiar deps | 1–2 semanas, gradual |
| **5. Producto CRM** | Alertas dashboard, 606/607, auditoría, cierre de caja | según prioridad del negocio |

> **Nota:** la Fase 1 no es opcional. Hoy cualquier persona con la URL del backend puede leer y modificar toda la información del taller, y la app cliente expone los datos de todos los clientes a cualquier visitante.
