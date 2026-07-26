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

El envío usa la cuenta `solidoautoservicio@gmail.com`. Gmail **no** permite usar la contraseña normal desde un servidor; hay que crear una *contraseña de aplicación*:

1. Entra a la cuenta de Google de `solidoautoservicio@gmail.com`.
2. **Seguridad** → activa la **Verificación en 2 pasos** (si no está activa).
3. Busca **"Contraseñas de aplicaciones"** → crea una nueva para "Correo".
4. Google te da una clave de **16 dígitos**. Cópiala (sin espacios).

> Importante: por seguridad, **tú** debes generar y pegar esta contraseña en Railway. Yo no la manejo ni la guardo en el código.

---

## 3. Backend (Railway) — variables de entorno + dependencia

En el servicio del backend en **Railway → Variables**, agrega:

```
GMAIL_USER          = solidoautoservicio@gmail.com
GMAIL_APP_PASSWORD  = (la clave de 16 dígitos del paso 2)
```

Se agregó `nodemailer` a `crm-backend/package.json`. Railway lo instalará solo al desplegar (corre `npm install`). Si corres el backend localmente: `npm install` dentro de `crm-backend`.

**CORS:** si tienes configurada la variable `CORS_ORIGINS` en Railway, agrega el dominio donde vive el portal web (ej. `https://solidoautoservicio.com`) a la lista, separado por comas. Si `CORS_ORIGINS` no existe, no hay que hacer nada (permite todos los orígenes).

Luego **redespliega el backend**.

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
