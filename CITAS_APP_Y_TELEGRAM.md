# Citas desde la app y desde Telegram + arreglo de las notificaciones

**Sólido Auto Servicio · julio 2026**

Tres cosas: el cliente ya puede agendar desde la app igual que desde la web, las notificaciones push por fin llegan, y Telegram agenda la cita él mismo en vez de dar un enlace roto.

---

## 1. Por qué las notificaciones de la app no llegaban

Este era el problema serio, y no estaba donde parecía.

El backend enviaba el push correctamente. El navegador lo recibía. Pero el service worker desplegado **no tenía ningún manejador del evento `push`**, así que el aviso llegaba al teléfono y se descartaba en silencio. Sin error, sin log, sin notificación. Todo "funcionaba".

La causa: los manejadores estaban en `frontend/worker/index.js`, confiando en la función de *custom worker* de `next-pwa`, que compila esa carpeta y la inyecta en el `sw.js` generado. Esa compilación nunca ocurrió — el `sw.js` publicado contenía `importScripts()`, vacío.

**El arreglo** no depende de que next-pwa compile nada:

- Los manejadores ahora viven en `frontend/public/push-listener.js`, un archivo estático que se sirve tal cual.
- `next.config.js` lo inyecta con la opción `importScripts: ['/push-listener.js']`, que workbox escribe siempre en el `sw.js`.
- `frontend/worker/index.js` quedó vacío (con la explicación), para que si algún día vuelve a compilarse no registre un segundo listener y duplique cada aviso.
- `frontend/public/sw.js` y `workbox-*.js` se agregaron al `.gitignore`: son artefactos de build y tenerlos versionados fue justamente lo que hizo que un `sw.js` viejo y roto se sirviera como si fuera bueno.

> **Hay que sacarlos de git una vez**, o el archivo viejo sigue viajando en el repo:
> ```bash
> git rm --cached frontend/public/sw.js frontend/public/workbox-*.js
> ```

### Cómo comprobar que quedó bien

Después de desplegar, abre `https://crm-solido.vercel.app/sw.js` y busca `push-listener`. Si aparece, el arreglo está en pie. Si sigue diciendo `importScripts()` a secas, el build no tomó el `next.config.js`.

Y desde la app, con sesión iniciada, el endpoint nuevo `GET /portal/push/diagnostico` responde en español dónde se corta la cadena: llaves VAPID → paquete `web-push` → dispositivos suscritos → preferencia del cliente → últimos envíos fallidos.

### Lo que sigue haciendo falta para que el push funcione

Esto ya estaba documentado en `PORTAL_CLIENTE.md`, pero conviene verificarlo porque es la otra mitad del problema:

```bash
npx web-push generate-vapid-keys
```

En **Railway**:

```
VAPID_PUBLIC_KEY   = <la pública>
VAPID_PRIVATE_KEY  = <la privada>
VAPID_SUBJECT      = mailto:solidoautoservicio@gmail.com
```

El paquete `web-push` ya está en `crm-backend/package.json`, así que Railway lo instala solo.

> En iPhone las notificaciones **solo funcionan con la app instalada** en la pantalla de inicio (Compartir → Añadir a pantalla de inicio). No es un fallo del sistema, es una restricción de Apple. La app ya se lo explica al cliente cuando detecta ese caso.

---

## 2. Agendar cita desde la app del cliente

El cliente entra a la app con su placa como siempre y ahora ve una tarjeta **📅 Mis citas** debajo de los avisos.

Ahí puede ver sus citas próximas con su estado, agendar una nueva y cancelar. El formulario no le pide nombre, correo ni placa: la app ya sabe quién es.

**Esa es la diferencia con el formulario de la web.** La cita se guarda con `cliente_id` y `vehiculo_id` reales, así que entra al CRM ya vinculada a su ficha — aparece en su historial, y las notificaciones push le llegan sin que nadie tenga que emparejar nada a mano. Las citas web siguen entrando sueltas, como hasta ahora.

Detalles que evitan problemas en el mostrador:

- Solo se ofrecen horas que de verdad están libres (`CITAS_CUPO_POR_HORA`, por defecto 3 en paralelo).
- Los domingos no se toman citas de taller; los sábados solo hasta las 12.
- No se puede agendar dos veces el mismo día: el backend responde con la cita que ya existe.
- El cupo se revalida al confirmar, no solo al elegir la hora — entre una cosa y otra pudo entrar una cita por la web.

**Endpoints nuevos** (`crm-backend/routes/portalCliente.mjs`, todos exigen sesión del portal):

| Método | Ruta | Para qué |
|---|---|---|
| GET | `/portal/citas` | Sus citas: próximas y pasadas |
| GET | `/portal/citas/opciones?fecha=` | Horas libres de ese día y tipos de servicio |
| POST | `/portal/citas` | Agendar |
| POST | `/portal/citas/:id/cancelar` | Cancelar la suya (el backend valida que sea suya) |
| GET | `/portal/push/diagnostico` | Por qué no le llegan los avisos |

---

## 3. Telegram

### El enlace roto

El bot mandaba a `https://crm-automotriz-3wde-production.up.railway.app/cita`. Esa ruta **no existe**: Railway sirve la API, no páginas, y el frontend no tiene ninguna ruta `/cita`. Todo cliente que pedía cita por Telegram recibía un enlace muerto.

Estaba escrito a mano en tres sitios distintos de `server.mjs`, incluido el contexto que se le pasa a la IA — así que el bot también lo repetía cuando le preguntaban en lenguaje natural.

Ahora las URLs viven en un solo módulo, `crm-backend/services/enlaces.mjs`, y apuntan a **`solidoautoservicio.online`**. Se pueden sobreescribir desde Railway sin tocar código:

```
URL_WEB   = https://solidoautoservicio.online
URL_CITA  = https://solidoautoservicio.online/#cita
URL_APP   = https://crm-solido.vercel.app/cliente
```

> `URL_CITA` usa el ancla `#cita` porque el formulario es una pestaña dentro de `solido-web/index.html`. Si esa pestaña tiene otro `id`, ajusta la variable.

Además se le dijo a la IA, explícitamente, que **nunca invente direcciones web** — es lo que producía enlaces plausibles pero inexistentes.

### Agendar sin salir de Telegram

Esto responde tu pregunta de cómo hacer que la cita entre al CRM desde el propio Telegram.

El bot ahora hace las preguntas él mismo y escribe la cita en `citas_taller` con `origen = 'TELEGRAM'`. El cliente toca **📅 Agendar Cita** (o escribe "quiero una cita") y la conversación va así:

1. **Placa** — si ya está en el CRM, el bot responde *"Te encontré: Toyota Corolla (A123456) a nombre de Juan Pérez"* y la cita queda vinculada a su ficha. Si no, pide nombre y teléfono.
2. **Día** — botones con los próximos días hábiles, o escrito ("mañana", "el lunes", "5/8").
3. **Hora** — solo las que están libres ese día.
4. **Qué necesita** — botones con los servicios, o texto libre.
5. **Confirmación** — resumen y "✅ Sí, confirmar". Si algo está mal, puede corregir solo la fecha, solo la hora o solo el motivo, sin repetir todo.

La secretaria la ve en el CRM → **Citas** como cualquier otra, y cuando la confirma, **el cliente recibe la confirmación por el mismo chat de Telegram**.

También funciona escribir **"mis citas"** para ver lo agendado.

**Por qué botones normales y no botones "inline":** los inline llegan al webhook como `callback_query`, y el webhook actual solo procesa `message.text`. Un teclado normal envía texto plano, así que ningún botón se queda sin respuesta.

**Cómo sobrevive a los redespliegues:** el estado de la conversación se guarda en la tabla `telegram_conversaciones`. Si no corres el SQL, el flujo igual funciona (se guarda en memoria), pero cada redespliegue de Railway corta las conversaciones a medias.

Archivo: `crm-backend/services/telegramCitas.mjs`.

---

## 4. Notificaciones de citas

Antes una cita solo generaba un correo al agendarla desde la web, y nada más. Ahora:

| Cuándo | Push | Telegram | Correo |
|---|---|---|---|
| Se agenda | ✅ | ✅ si vino del bot | ✅ |
| El taller la confirma | ✅ | ✅ | ✅ |
| El taller la cancela | ✅ | ✅ | ✅ |
| Cambia la fecha u hora | ✅ | ✅ | ✅ |
| **El día anterior** | ✅ | ✅ | ✅ |
| **Una hora antes** | ✅ | ✅ | ✅ |

El push va primero a propósito: es instantáneo y no depende de que el cliente tenga correo en ficha.

La confirmación y la cancelación se disparan desde `PATCH /citas/:id`, comparando con el estado anterior — así la secretaria puede abrir y guardar una cita sin que al cliente le llegue un aviso cada vez.

Los recordatorios corren dentro del propio backend cada 15 minutos. Se pueden apagar con `RECORDATORIOS_AUTOMATICOS=0`, y dispararse a mano con `GET /citas/recordatorios/ejecutar`.

Todo envío queda anotado en la tabla `notificaciones_cita`. Eso es lo que permite responderle a un cliente que dice "nunca me avisaron" mirando una tabla en vez de adivinar.

---

## Pasos para poner esto en producción

### 1. Supabase — correr el SQL

En **SQL Editor**, pega y ejecuta:

```
crm-backend/sql/citas_app_telegram.sql
```

Crea las columnas nuevas de `citas_taller`, la tabla `notificaciones_cita` y `telegram_conversaciones`. Es idempotente: se puede correr dos veces sin romper nada.

### 2. Railway — variables

Nuevas (todas opcionales, con valores por defecto sensatos):

```
URL_WEB                 = https://solidoautoservicio.online
URL_CITA                = https://solidoautoservicio.online/#cita
URL_APP                 = https://crm-solido.vercel.app/cliente
MAIL_TALLER             = solidoautoservicio@gmail.com
TZ_OFFSET_HORAS         = -4
CITAS_CUPO_POR_HORA     = 3
RECORDATORIOS_AUTOMATICOS = 1
```

Verifica que ya existan (son de antes, pero el push depende de ellas):

```
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
BREVO_API_KEY, PORTAL_JWT_SECRET, TELEGRAM_TOKEN
```

Luego **push del código y redespliegue del backend**.

### 3. Vercel — redesplegar el frontend

Sin esto no hay tarjeta de citas ni service worker arreglado. Antes del push, saca de git los artefactos viejos:

```bash
git rm --cached frontend/public/sw.js frontend/public/workbox-*.js
```

### 4. Comprobaciones (5 minutos)

1. `GET /portal/salud` → `listo: true`.
2. Abre `https://crm-solido.vercel.app/sw.js` y busca **`push-listener`**. Debe aparecer.
3. Entra a la app con una placa real → **Avisos de tu vehículo** → activar → "Enviar notificación de prueba". Debe llegar al teléfono.
   - Si no llega: `GET /portal/push/diagnostico` te dice exactamente qué falta.
4. En la app, **Mis citas** → agendar una para mañana. Debe aparecer en el CRM → Citas con el distintivo de origen.
5. Confírmala desde el CRM. Al cliente debe llegarle la notificación.
6. En Telegram, escribe **"quiero una cita"** y completa el flujo. Verifica que aparezca en el CRM y que al confirmarla el bot te escriba.
7. `GET /citas/recordatorios/ejecutar` → responde cuántos recordatorios salió a mandar.

---

## Archivos

**Nuevos**

```
crm-backend/sql/citas_app_telegram.sql        Migración de BD
crm-backend/services/enlaces.mjs              Las URLs públicas, en un solo sitio
crm-backend/services/notificarCita.mjs        Avisos de citas + recordatorios
crm-backend/services/telegramCitas.mjs        El flujo conversacional del bot
frontend/public/push-listener.js              Manejadores de push del service worker
frontend/src/components/MisCitas.tsx          Tarjeta de citas en la app
```

**Modificados**

```
crm-backend/server.mjs                  Flujo de cita en el webhook, URLs corregidas,
                                        avisos en PATCH /citas/:id, job de recordatorios,
                                        correo de citas movido al servicio
crm-backend/routes/portalCliente.mjs    + /portal/citas/*, + /portal/push/diagnostico
frontend/next.config.js                 importScripts del push-listener  ← el arreglo del push
frontend/worker/index.js                Vaciado (la lógica se movió; explica por qué)
frontend/src/lib/portalCliente.ts       + funciones de citas y formato de fecha/hora
frontend/src/app/cliente/page.tsx       + <MisCitas />
.gitignore                              sw.js y workbox-*.js dejan de versionarse
```

Ninguna dependencia npm nueva.
