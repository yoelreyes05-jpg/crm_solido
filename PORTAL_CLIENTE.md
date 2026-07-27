# Portal del Cliente — implementación

**Sólido Auto Servicio · julio 2026**

Implementa los puntos **#3 (crítico)**, **#1**, **#3-producto** y **#5-producto** de `MEJORAS_CRM_Y_APP_CLIENTE.md`.

## Qué cambia

La app cliente hacía esto en cada búsqueda:

```js
fetch(`${API}/vehiculos`)     // TODOS los vehículos
fetch(`${API}/ordenes`)       // TODAS las órdenes
fetch(`${API}/diagnosticos`)  // TODOS los diagnósticos
```

…y filtraba por placa **en el navegador**. Cualquier visitante abría DevTools y veía nombres, teléfonos, placas y montos de todos los clientes. Además bastaba conocer una placa para ver el estado de un vehículo ajeno.

Ahora el cliente se identifica una vez y el backend devuelve **solo su vehículo**. La validación de pertenencia está del lado servidor: cambiar un `id` en la URL devuelve 403, no datos de otro.

## Tres niveles de acceso

| Nivel | Cómo entra | Cuándo aplica |
|---|---|---|
| 1 | Placa + **últimos 4 dígitos** del teléfono en ficha | Mayoría de clientes. Instantáneo, sin correo. |
| 2 | Código de 6 dígitos **al correo** registrado | Cliente sin teléfono pero con correo. |
| 3 | Código de 8 dígitos **dictado en el mostrador** | Cliente sin teléfono ni correo. |

El frontend pregunta primero qué métodos aplican a esa placa (`POST /portal/acceso/placa`), así el cliente nunca ve una opción que no puede usar.

**WhatsApp** queda cableado pero apagado. `portal_otp` ya tiene columna `canal` y `enviarCodigoPorWhatsApp()` está escrito contra la Cloud API de Meta. Cuando te aprueben la API empresarial: creas la plantilla `codigo_acceso` (categoría AUTHENTICATION), pones `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID` en Railway, y el canal se activa solo — no hay que reescribir el flujo.

## Archivos

**Nuevos**

```
crm-backend/sql/portal_cliente.sql          Tablas de acceso + consultas de diagnóstico
crm-backend/services/tokenPortal.mjs        Tokens HMAC y códigos (cero dependencias nuevas)
crm-backend/services/enviarCodigo.mjs       Correo vía Brevo + WhatsApp inactivo
crm-backend/routes/portalCliente.mjs        Router /portal/*
frontend/src/lib/portalCliente.ts           SDK del portal
frontend/src/components/PortalAcceso.tsx    Pantalla de identificación
frontend/src/components/GenerarCodigoPortal.tsx  Botón para la secretaria
```

**Modificados**

```
crm-backend/server.mjs                      + trust proxy, + app.use("/portal", ...)
frontend/src/app/cliente/page.tsx           buscar() → cargarDatos(), + acceso, cotizaciones, mantenimiento
```

No se agregó ninguna dependencia npm. Los tokens usan `node:crypto` en vez de `jsonwebtoken`, y el correo reusa **Brevo**, que ya envía las confirmaciones de citas desde `server.mjs`.

---

## Orden de implementación

### 1. Diagnóstico primero (5 minutos)

Antes de tocar nada, corre en el SQL Editor de Supabase la consulta comentada al final de `crm-backend/sql/portal_cliente.sql`. Te dice cuántos clientes pueden usar cada nivel.

**Esto no es opcional.** Si `solo_mostrador` sale alto, el flujo de la secretaria deja de ser un respaldo y se vuelve el camino principal — y ahí es donde hay que poner el esfuerzo, no en pulir el OTP por correo. También te muestra placas duplicadas, que rompen la búsqueda.

### 2. Correr el SQL

Pega `crm-backend/sql/portal_cliente.sql` completo en el SQL Editor. Crea cuatro tablas con prefijo `portal_` y no toca ninguna existente.

Si te da error en las llaves foráneas, revisa que `clientes.id` y `vehiculos.id` sigan siendo `int4` — el script asume los tipos que están hoy en `SUPABASE_TABLES.txt`.

### 3. Variables en Railway

```bash
# Firma de los tokens de sesión. Genérala con:
#   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
PORTAL_JWT_SECRET=<la cadena generada>

# Secreto para que el CRM genere códigos de mostrador. Otra cadena distinta.
PORTAL_ADMIN_SECRET=<otra cadena generada>
```

`BREVO_API_KEY` y `MAIL_FROM_EMAIL` ya deberían estar puestas (las usa el correo de citas). Si no, el nivel 2 se desactiva solo y el frontend no lo ofrece.

En el frontend (Vercel):

```bash
NEXT_PUBLIC_PORTAL_ADMIN_SECRET=<el mismo PORTAL_ADMIN_SECRET>
```

> Ojo: esa variable queda visible en el bundle del navegador. Es aceptable como paso intermedio porque solo permite generar códigos de acceso al portal, no tocar el CRM. **Cuando implementes el JWT del CRM (punto #2 del análisis), reemplaza `requiereAdmin` en `portalCliente.mjs` por ese middleware y borra esta variable.**

### 4. Desplegar el backend y verificar

```
GET https://<tu-backend>.up.railway.app/portal/salud
```

Debe responder:

```json
{
  "token_configurado": true,
  "admin_configurado": true,
  "canal_correo": true,
  "canal_whatsapp": false,
  "trust_proxy": "activo",
  "ip_detectada": "190.x.x.x"
}
```

Si `trust_proxy` sale `INACTIVO` o `ip_detectada` es siempre la misma para todos, el rate limiting no sirve: revisa que `app.set("trust proxy", 1)` esté antes de las rutas.

### 5. Desplegar el frontend

`/cliente` ya no muestra el input de placa suelto: muestra la pantalla de acceso. La sesión dura 30 días, así que el cliente se identifica una vez y después solo abre la app.

### 6. Montar el botón de la secretaria

En la ficha del cliente (`frontend/src/app/clientes/page.tsx` o donde tengas el detalle):

```tsx
import GenerarCodigoPortal from "@/components/GenerarCodigoPortal";

<GenerarCodigoPortal
  clienteId={cliente.id}
  clienteNombre={cliente.nombre}
  telefono={cliente.telefono}
/>
```

Genera el código, lo muestra en pantalla grande para dictarlo, y ofrece enviarlo por WhatsApp con `wa.me` si el cliente tiene teléfono.

---

## Checklist de pruebas

Antes de anunciarlo a los clientes:

- [ ] Entrar con placa + últimos 4 correctos → ves tu vehículo
- [ ] Entrar con últimos 4 **incorrectos** → 401, no revela nada del cliente
- [ ] Repetir 8 veces con dígitos incorrectos → 429 (rate limiting activo)
- [ ] Placa inexistente → 404 con mensaje claro
- [ ] Cliente sin teléfono → la pantalla ofrece correo o mostrador, no el nivel 1
- [ ] Pedir código por correo → llega en menos de 30s, entra bien
- [ ] Usar el mismo código dos veces → 410 (un solo uso)
- [ ] Esperar 11 minutos y usar el código → 410 (vencido)
- [ ] Generar código de mostrador, entrar con él → funciona
- [ ] Generar un segundo código para el mismo cliente → el primero deja de servir
- [ ] Con sesión activa, cambiar el `id` en `/portal/historial/:id` por uno ajeno → **403**
- [ ] Aprobar una cotización desde el celular → la orden pasa a APROBADO y aparece en `log_acciones`
- [ ] Cerrar sesión y recargar → pide identificarse de nuevo
- [ ] Abrir DevTools → Network en `/cliente` y confirmar que **no** hay llamadas a `/vehiculos`, `/ordenes` ni `/diagnosticos`

Ese último punto es el que cierra el hueco original.

---

## Lo que esto no resuelve

Sigue pendiente de `MEJORAS_CRM_Y_APP_CLIENTE.md`, y es más urgente que cualquier mejora de producto:

- **#1** contraseñas del personal en texto plano (`.eq("password_hash", password)`)
- **#2** los 213 endpoints del CRM siguen abiertos sin autenticación
- **#4** sesión del CRM falsificable (cookie sin firmar + rol en localStorage)
- **#5** endpoints `/debug` expuestos
- **#7** NCF sin bloqueo atómico y con fallback `Math.random()` — fiscalmente inválido

El portal está blindado; el CRM detrás no. Alguien con la URL de Railway todavía puede leer y modificar toda la operación del taller.

---

## Notas técnicas

**Por qué HMAC y no `jsonwebtoken`.** Un token aquí solo lo emite y lo valida este mismo backend — no hay terceros verificando firmas. `node:crypto` hace el trabajo sin sumar dependencias al build de Railway. El formato es `base64url(payload).base64url(hmac)`, compatible de leer si algún día migras a JWT real.

**Por qué la sesión se guarda en base y no solo en el token.** Un token firmado no se puede revocar. Con la fila en `portal_sesiones` puedes cortar el acceso cuando un cliente vende el vehículo o pierde el teléfono: `POST /portal/admin/revocar-sesiones`.

**Por qué rate limiting doble (placa + IP).** Adivinar 4 dígitos son 10,000 combinaciones — trivial por fuerza bruta. El límite por placa detiene el ataque dirigido a un cliente; el límite por IP detiene el barrido sobre muchas placas.

**Por qué los códigos se guardan hasheados.** Si alguien lee la base (o un backup), no obtiene códigos usables. Se guarda `sha256(codigo + salt)` y se compara en tiempo constante.

**Sobre `routes/facturacion.js`.** Está escrito en CommonJS (`require`) pero el backend es `"type": "module"` — por eso nunca se montó. Si lo vas a activar, hay que convertirlo a ESM como `portalCliente.mjs`.
