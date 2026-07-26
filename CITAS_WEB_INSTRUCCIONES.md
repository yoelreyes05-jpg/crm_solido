# Citas desde la web — Puesta en marcha

Se agregó la funcionalidad para que un cliente agende una cita desde el portal web (`solido-web`), que la cita aparezca en el CRM (módulo **Citas**, que la secretaria ya puede ver) y que el cliente reciba un **correo de confirmación** desde `solidoautoservicio@gmail.com`.

Para que funcione en producción hay que hacer **4 pasos** (una sola vez):

---

## 1. Base de datos (Supabase) — correr el SQL

En Supabase → **SQL Editor**, pega y ejecuta el contenido de:

`crm-backend/sql/citas_web.sql`

Esto **crea la tabla `citas_taller` completa** (no existía en tu base de datos: el código la usaba pero la migración original nunca se corrió), con todas las columnas del CRM más las de las citas web (nombre, correo, teléfono, placa y modelo). Es seguro correrlo (usa `if not exists`), y también habilita el módulo **Citas** que la secretaria usa dentro del CRM.

---

## 2. Correo — crear una contraseña de aplicación de Gmail

El correo se envía con **Brevo** (API HTTPS). Railway bloquea los puertos SMTP salientes —por eso el envío directo por Gmail daba *"Connection timeout"*—, pero Brevo envía por HTTPS (puerto 443), que nunca se bloquea. Puedes seguir usando `solidoautoservicio@gmail.com` como remitente si lo verificas en Brevo.

1. Crea una cuenta gratis en **https://www.brevo.com** (plan gratuito: 300 correos/día).
2. **Verifica el remitente:** Brevo → *Senders, Domains & Dedicated IPs* → pestaña **Senders** → **Add a sender** → escribe `solidoautoservicio@gmail.com`. Brevo enviará un correo de confirmación a esa bandeja → ábrelo y haz clic para confirmar.
3. **Crea la API key:** Brevo → menú de tu cuenta → **SMTP & API** → pestaña **API Keys** → **Generate a new API key** → cópiala (se muestra una sola vez).

> Nota: la API key es una credencial. **Tú** la pegas en Railway; yo no la manejo ni la guardo en el código.

---

## 3. Backend (Railway) — variable de entorno

En el servicio del backend en **Railway → Variables**, agrega:

```
BREVO_API_KEY   = (la API key del paso 2)
```

Opcional: `MAIL_FROM_EMAIL = solidoautoservicio@gmail.com` (si no la pones, usa el valor de `GMAIL_USER`, que ya tienes). Ese correo debe estar **verificado** como remitente en Brevo (paso 2).

Ya puedes **borrar** las variables `GMAIL_APP_PASSWORD` (ya no se usan). Se quitó `nodemailer` del proyecto; no hace falta instalar nada porque Brevo se llama con `fetch` (incluido en Node 18+).

**CORS:** si tienes configurada la variable `CORS_ORIGINS` en Railway, agrega el dominio del portal web (ej. `https://solidoautoservicio.online`) a la lista, separado por comas. Si `CORS_ORIGINS` no existe, no hay que hacer nada.

Luego **haz push del código actualizado (`server.mjs` y `package.json`) y redespliega el backend.**

---

## 4. Desplegar el portal web y el CRM

- **Portal web** (`solido-web/index.html`): sube el archivo actualizado a donde esté publicado. Ya apunta al backend correcto (`API_BASE`).
- **CRM** (`frontend`): redespliega para que la secretaria vea el correo y el distintivo "🌐 Web" en las citas.

---

## Cómo queda el flujo

1. El cliente entra al portal web → pestaña **"Agendar Cita"** → llena nombre, correo, placa, modelo, teléfono (opcional), fecha, hora y motivo.
2. Al enviar:
   - La cita se guarda en `citas_taller` con `origen = "WEB"` y estado **PENDIENTE**.
   - El cliente recibe un correo de **"Cita agendada"**.
   - El taller (`solidoautoservicio@gmail.com`) recibe un aviso interno con todos los datos.
3. La **secretaria** ve la cita en el CRM → módulo **Citas** (con nombre, placa, modelo, correo y el distintivo Web), y puede confirmarla, marcar llegada, cancelar, etc.

> Nota: si el correo aún no está configurado (paso 2 y 3), la cita **igual se guarda** y aparece en el CRM; solo no se envía el email. El sistema no se rompe.

---

## Archivos modificados / creados

- `crm-backend/sql/citas_web.sql` *(nuevo — migración de BD)*
- `crm-backend/package.json` *(agregó nodemailer)*
- `crm-backend/server.mjs` *(helper de correo + endpoint `POST /citas/publica` + `enriquecerCitas`)*
- `frontend/src/app/citas/page.tsx` *(muestra correo y origen Web)*
- `solido-web/index.html` *(pestaña y formulario "Agendar Cita")*
