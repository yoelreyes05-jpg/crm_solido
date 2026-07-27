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
crm-backend/sql/portal_cliente.sql              Tablas de acceso + diagnóstico
crm-backend/sql/notificaciones_cliente.sql      Bitácora de avisos, push, preferencias
crm-backend/services/tokenPortal.mjs            Tokens HMAC y códigos (sin dependencias)
crm-backend/services/enviarCodigo.mjs           Código de acceso por correo (Brevo)
crm-backend/services/notificarCliente.mjs       Avisos de cambio de estado (correo + push)
crm-backend/services/webPush.mjs                Web Push / VAPID
crm-backend/routes/portalCliente.mjs            Router /portal/*
frontend/worker/index.js                        Service worker de push (next-pwa lo compila)
frontend/src/lib/portalCliente.ts               SDK del portal
frontend/src/components/PortalAcceso.tsx        Pantalla de identificación
frontend/src/components/ActivarNotificaciones.tsx  Activar avisos desde el portal
frontend/src/components/GenerarCodigoPortal.tsx    Botón para la secretaria
```

**Modificados**

```
crm-backend/server.mjs                      + trust proxy, + /portal, + aviso en transicionarEstado
crm-backend/package.json                    + web-push
frontend/src/app/cliente/page.tsx           buscar() → cargarDatos(), acceso, cotizaciones, avisos
frontend/src/app/clientes/page.tsx          + botón «Portal» en cada fila
frontend/src/app/clientes/[id]/historial/page.tsx  + botón «Acceso al portal»
frontend/public/manifest.json               arreglado el ícono 512 (apuntaba a un archivo inexistente)
```

Única dependencia npm nueva: `web-push`. Los tokens usan `node:crypto` en vez de `jsonwebtoken`, y el correo reusa **Brevo**, que ya envía las confirmaciones de citas.

---

## Notificaciones automáticas

Hasta ahora `transicionarEstado()` solo avisaba por WhatsApp, y como la API de Meta no está aprobada, en la práctica **el cliente no recibía nada**: se enteraba solo si entraba al portal a mirar.

Ahora el aviso sale por dos canales que sí funcionan hoy:

| Canal | Requiere | Alcance |
|---|---|---|
| **Correo** | correo válido en ficha | Depende de cuántos clientes lo tengan |
| **Push (PWA)** | que el cliente instale la app y acepte | No depende de correo ni de Meta |

El enganche está en `transicionarEstado()`, que es el punto único por donde pasan todos los cambios de estado — kanban, pantalla del taller, carril de lavado y aprobación desde el portal. Ningún camino se queda sin avisar.

Se notifican: `DIAGNOSTICO`, `ESPERANDO_APROBACION`, `REPARACION`, `LISTO`, `ENTREGADO`, `CANCELADA`.

No se notifican `CONTROL_CALIDAD` ni `EN_LAVADO` a propósito: son pasos internos, y avisar de ellos solo genera llamadas preguntando si ya se puede pasar a buscar el vehículo.

**Anti-duplicado:** el índice `uq_notif_cli_evento` impide que la misma orden avise dos veces del mismo estado por el mismo canal. Sin eso, arrastrar una tarjeta del kanban de ida y vuelta le manda tres correos al cliente.

### Configurar el push

```bash
npm i web-push --prefix crm-backend
npx web-push generate-vapid-keys
```

En Railway:

```bash
VAPID_PUBLIC_KEY=<la pública>
VAPID_PRIVATE_KEY=<la privada>
VAPID_SUBJECT=mailto:solidoautoservicio@gmail.com
URL_PORTAL=https://crm-solido.vercel.app/cliente
```

En Vercel:

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<la MISMA pública>
```

Si falta cualquiera de estas, el push se apaga solo y el correo sigue funcionando. Nada se rompe por desplegar antes de terminar la configuración.

> **iPhone:** las notificaciones push solo funcionan con la PWA instalada en la pantalla de inicio. El componente detecta ese caso y le explica al cliente cómo instalarla. En Android y escritorio funcionan directo desde el navegador.

> **`frontend/worker/index.js`:** no edites `public/sw.js` a mano — next-pwa lo regenera en cada build y borra los cambios. Todo lo de push va en `worker/index.js`, que next-pwa compila e importa automáticamente.

---

## Dónde genera la secretaria el código

En dos lugares, ambos ya montados:

1. **Lista de clientes** (`/clientes`) — botón azul **🔑 Portal** en la columna de acciones de cada fila.
2. **Ficha 360** (`/clientes/<id>/historial`) — botón **🔑 Acceso al portal** junto a «Agendar cita».

Al presionarlo se abre un modal con el código en pantalla grande para dictarlo, más un botón para copiarlo y otro para enviarlo por WhatsApp si el cliente tiene teléfono. Vive 24 horas, es de un solo uso, y generar uno nuevo invalida el anterior.

---

## Orden de implementación

### 1. Diagnóstico primero (5 minutos)

Antes de tocar nada, corre en el SQL Editor de Supabase la consulta comentada al final de `crm-backend/sql/portal_cliente.sql`. Te dice cuántos clientes pueden usar cada nivel.

**Esto no es opcional.** Si `solo_mostrador` sale alto, el flujo de la secretaria deja de ser un respaldo y se vuelve el camino principal — y ahí es donde hay que poner el esfuerzo, no en pulir el OTP por correo. También te muestra placas duplicadas, que rompen la búsqueda.

### 2. Correr el SQL

Pega en el SQL Editor, en este orden:

1. `crm-backend/sql/portal_cliente.sql` — cuatro tablas `portal_*` de acceso
2. `crm-backend/sql/notificaciones_cliente.sql` — bitácora de avisos, suscripciones push y preferencias

Ninguno toca tablas existentes.

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
  "canal_push": true,
  "canal_whatsapp": false,
  "trust_proxy": "activo",
  "ip_detectada": "190.x.x.x"
}
```

`canal_whatsapp: false` es lo esperado hasta que Meta apruebe la API. `canal_push: false` significa que falta instalar `web-push` o las llaves VAPID.

Si `trust_proxy` sale `INACTIVO` o `ip_detectada` es siempre la misma para todos, el rate limiting no sirve: revisa que `app.set("trust proxy", 1)` esté antes de las rutas.

### 5. Desplegar el frontend

`/cliente` ya no muestra el input de placa suelto: muestra la pantalla de acceso. La sesión dura 30 días, así que el cliente se identifica una vez y después solo abre la app.

### 6. Probar el flujo completo

El botón de la secretaria ya está montado en `/clientes` y en la Ficha 360 — no hay que integrar nada más.

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

**Notificaciones:**

- [ ] `GET /portal/salud` devuelve `canal_correo: true` y `canal_push: true`
- [ ] Mover una orden a `LISTO` en el kanban → llega el correo en menos de un minuto
- [ ] Mover la misma orden fuera y de vuelta a `LISTO` → **no** llega un segundo correo
- [ ] Instalar la PWA en un celular, activar avisos, tocar «Enviar notificación de prueba» → aparece en la pantalla de bloqueo
- [ ] Con la PWA cerrada, mover una orden a `LISTO` → llega igual
- [ ] Tocar la notificación → abre `/cliente`, no una pestaña nueva
- [ ] Apagar el interruptor de correo en el portal y mover otra orden → no llega correo, sí llega push
- [ ] Revisar `select * from notificaciones_cliente order by creado_en desc limit 20` — que no haya filas `fallido`

**Botón de la secretaria:**

- [ ] En `/clientes`, el botón **🔑 Portal** aparece en cada fila y genera el código
- [ ] En la Ficha 360, el botón **🔑 Acceso al portal** hace lo mismo
- [ ] El botón de WhatsApp del modal abre el chat con el mensaje ya escrito

---

## Diagnóstico: el portal falla al verificar el teléfono

**Siempre empieza por `GET /portal/salud`.** Devuelve una lista de lo que falta, en orden de importancia:

```json
{
  "listo": false,
  "pendientes": [
    "FALTA PORTAL_JWT_SECRET en Railway — sin esto nadie puede iniciar sesión. Genérala: ...",
    "FALTAN 2 tabla(s) (portal_sesiones, portal_otp) — corre ... en Supabase."
  ],
  "tablas": { "portal_sesiones": "FALTA (42P01)", "portal_otp": "ok" }
}
```

Si `listo` es `true`, el portal está bien instalado y el problema es otro.

### Por qué el síntoma engaña

Buscar la placa **siempre funciona**: ese endpoint solo lee `vehiculos` y `clientes`, que ya existían. El fallo aparece al escribir los 4 dígitos, porque ahí es donde se crea la sesión — y eso necesita dos cosas que la búsqueda de placa no necesita: la tabla `portal_sesiones` y la variable `PORTAL_JWT_SECRET`.

Por eso parece "el portal encontró mi carro pero no me deja entrar".

### Los tres errores y qué significan

| Lo que ves | Causa | Solución |
|---|---|---|
| "No pudimos comunicarnos con el servidor" | El backend no responde, o CORS bloqueó la petición | Revisa que la cabecera que envías esté en `allowedHeaders` de `server.mjs` |
| "El portal aún no está instalado en la base de datos" | Faltan tablas (`42P01`) | Corre los dos archivos SQL |
| "El portal todavía no está listo" | Falta `PORTAL_JWT_SECRET` | Defínela en Railway y redespliega |
| "Ocurrió un problema en el servidor" | Otra cosa | El campo `detalle_tecnico` de la respuesta dice cuál |

### Dos fallos corregidos en el camino

**Express 4 no captura rechazos de promesas en handlers `async`.** La petición se quedaba sin respuesta, el navegador lo reportaba como fallo de wifi, y en Node 15+ el proceso se caía. Los 21 handlers van ahora envueltos en `ruta()`.

**La cabecera `x-portal-admin` no estaba en `allowedHeaders`.** El navegador bloqueaba el preflight de CORS y el botón de la secretaria fallaba con un error de red genérico, sin llegar nunca al servidor. Si añades cabeceras nuevas al frontend, tienes que añadirlas también ahí.

---

## El error de fondo: los endpoints del CRM enriquecen los datos

Este fue el fallo más costoso de todos, y conviene entenderlo antes de tocar el portal.

`GET /ordenes` y `GET /diagnosticos` **no devuelven las filas de la tabla tal cual**. Les añaden campos calculados que la interfaz da por hechos:

| Endpoint | Añade |
|---|---|
| `/ordenes` | `estado` con valor por defecto `"RECIBIDO"`, `numero_orden` de respaldo, `vehiculo_info`, `cliente_nombre` |
| `/diagnosticos` | `descripcion`, `hallazgos`, `notas`, `mano_obra`, `repuestos`, `total` |
| `/vehiculo-historial/placa/:placa` | Convierte las **órdenes abiertas** al formato del historial, con `avances_data`, `cotizacion_data`, `factura_data`, `timeline_data` |

Al construir `/portal/estado` leyendo las tablas en crudo, todo eso se perdió. Los síntomas eran engañosos porque cada uno parecía un problema distinto:

- **No se veía el estado** — `estado` llegaba nulo y `ESTADO_INFO[null]` no encuentra nada. En la tabla la columna existe pero su valor por defecto es `'pendiente'` en minúsculas, mientras la interfaz espera `RECIBIDO` en mayúsculas.
- **La impresión salía en blanco** — los datos estaban ahí, pero con otro nombre: la función de impresión lee `d.descripcion` y la tabla guarda `fallas_identificadas`.
- **El servicio en curso no abría** — las órdenes abiertas todavía no están en `vehiculo_historial`; el endpoint interno las inyecta con id `orden_<n>` y yo había borrado esa rama.

**La corrección.** `/portal/estado` replica la normalización de órdenes y diagnósticos, y los endpoints de historial **delegan por loopback en los del CRM** en vez de duplicar ~200 líneas de lógica que se desincronizarían. La comprobación de pertenencia se hace antes, en la capa del portal.

**Regla para el futuro:** si el portal necesita datos que el CRM ya expone, delega en ese endpoint. No leas la tabla directamente, o volverás a perder el enriquecimiento.

Un detalle relacionado: las consultas fallidas se resolvían con `|| []`, así que un error se veía como "este vehículo no tiene órdenes". Ahora se registran en el log y viajan en el campo `avisos` de la respuesta.

---

## Sobre la pista del teléfono

La pista muestra **solo los últimos 2 dígitos** (`***-***-**27`), aunque el cliente deba escribir 4.

Es deliberado. Si mostrara los 4, cualquiera que supiera la placa leería la respuesta en la propia pantalla y el segundo factor no serviría para nada. Con 2 visibles, el cliente reconoce cuál de sus números registró, pero a un extraño le quedan 100 combinaciones por adivinar — y con el límite de **5 intentos fallidos por hora por placa** necesitaría unas 20 horas de ataque sostenido, que el límite por IP corta mucho antes.

Si quieres endurecerlo más, la opción es no mostrar ninguna pista y obligar al código por correo o mostrador. El costo es fricción para el cliente que tiene varios números y no recuerda cuál dio.

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

**Por qué `web-push` sí es una dependencia y los tokens no.** El cifrado del payload de Web Push (RFC 8291) se puede escribir a mano con `node:crypto`, pero el riesgo no está en la criptografía sino en la interoperabilidad: cada navegador tiene su propio push service y los detalles de cabeceras y del JWT VAPID son fáciles de equivocar de forma que solo falla en Safari, o solo en Firefox. Ahí conviene el paquete estándar. Los tokens de sesión son otra cosa: los emite y valida el mismo backend, no hay terceros, y HMAC con `node:crypto` alcanza.

**Sobre `notificarCliente.mjs` y `enviarCodigo.mjs`.** Los dos mandan correo por Brevo pero están separados a propósito: `enviarCodigo` lanza excepción si falla (el cliente espera un código que nunca llegará y hay que redirigirlo al mostrador), mientras que `notificarCliente` traga el error y lo registra (un correo caído no puede impedir que una orden avance en el taller).

**El ícono 512 del manifest estaba roto.** Apuntaba a `/logo-512x512.png` pero el archivo real es `logo-512-512.png`. Eso afecta el ícono de instalación de la PWA y el de las notificaciones. Corregido.

**Restricciones de este proyecto que hay que respetar al tocar el frontend.** El `tsconfig.json` tiene `"strict": false`, y eso apaga `strictNullChecks`. Consecuencia poco obvia: **TypeScript no estrecha uniones discriminadas por un booleano**. Un tipo como `{ ok: true } | { ok: false; motivo: string }` compila en local pero rompe el build de Vercel al leer `r.motivo` dentro de un `else`. Por eso `ResultadoPush` es un tipo plano con `motivo` opcional.

Dos convenciones más, tomadas del código existente para no introducir dependencias de tipos:

- Los estilos de componente van en `<style>{\`...\`}</style>` plano, como en `cliente/page.tsx` — no en `<style jsx>`. Como esas reglas son globales, todas las clases llevan prefijo (`gcp-`, `notif-`, `pa-`).
- Los tipos de React se importan explícitamente (`import type { CSSProperties } from "react"`) en vez de usar el namespace global `React.`.
