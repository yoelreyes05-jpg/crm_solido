// crm-backend/services/webPush.mjs
// Notificaciones push a la PWA del cliente (Web Push / VAPID).
//
// Es el único canal que no depende de nada externo tuyo: no necesita que el
// cliente tenga correo en ficha, ni que Meta apruebe la API de WhatsApp. El
// cliente instala la app (el botón ya existe en /cliente), acepta una vez, y
// recibe el aviso en la pantalla de bloqueo como cualquier otra app.
//
// ── Configuración (una sola vez) ────────────────────────────────────────────
// 1. npm i web-push --prefix crm-backend
// 2. npx web-push generate-vapid-keys
// 3. En Railway:
//      VAPID_PUBLIC_KEY=<la pública>
//      VAPID_PRIVATE_KEY=<la privada>
//      VAPID_SUBJECT=mailto:solidoautoservicio@gmail.com
// 4. En Vercel:
//      NEXT_PUBLIC_VAPID_PUBLIC_KEY=<la MISMA pública>
//
// Si `web-push` no está instalado o faltan las llaves, este módulo se apaga
// solo y el correo sigue funcionando. Nada se rompe por desplegar antes de
// terminar la configuración.

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:solidoautoservicio@gmail.com";

let _webpush = null;
let _intentoCarga = false;

/**
 * Carga `web-push` bajo demanda.
 *
 * Se usa import dinámico a propósito: el paquete se instala aparte y no quiero
 * que un `npm install` incompleto en Railway tumbe todo el backend en el
 * arranque. Si no está, push queda desactivado y el resto sigue igual.
 */
async function cargarWebPush() {
  if (_webpush || _intentoCarga) return _webpush;
  _intentoCarga = true;

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn(
      "[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no configuradas. " +
        "Genera un par con: npx web-push generate-vapid-keys"
    );
    return null;
  }

  try {
    const mod = await import("web-push");
    const wp = mod.default || mod;
    wp.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    _webpush = wp;
    console.log("[push] Web Push listo.");
  } catch {
    console.warn(
      "[push] Falta el paquete `web-push`. Instálalo con:\n" +
        "  npm i web-push --prefix crm-backend\n" +
        "Mientras tanto, las notificaciones push quedan desactivadas."
    );
    _webpush = null;
  }

  return _webpush;
}

/** ¿Está el push disponible en este despliegue? */
export async function hayPush() {
  return Boolean(await cargarWebPush());
}

/** La clave pública que necesita el navegador para suscribirse. */
export function clavePublicaVapid() {
  return VAPID_PUBLIC || null;
}

/**
 * Envía una notificación a UNA suscripción.
 *
 * @param {{endpoint:string, p256dh:string, auth:string}} suscripcion
 * @param {{titulo:string, cuerpo:string, url?:string, etiqueta?:string}} aviso
 * @returns {Promise<{ok:boolean, caducada?:boolean, error?:string}>}
 *
 * `caducada: true` significa que el navegador desinstaló la PWA o revocó el
 * permiso. Esa suscripción hay que darla de baja, no reintentarla.
 */
export async function enviarPush(suscripcion, aviso) {
  const wp = await cargarWebPush();
  if (!wp) return { ok: false, error: "push no configurado" };

  const carga = JSON.stringify({
    titulo: aviso.titulo,
    cuerpo: aviso.cuerpo,
    url: aviso.url || "/cliente",
    etiqueta: aviso.etiqueta || "solido",
  });

  try {
    await wp.sendNotification(
      {
        endpoint: suscripcion.endpoint,
        keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth },
      },
      carga,
      { TTL: 24 * 3600, urgency: "high" }
    );
    return { ok: true };
  } catch (e) {
    // 404 / 410 = la suscripción ya no existe del lado del navegador.
    const caducada = e?.statusCode === 404 || e?.statusCode === 410;
    return {
      ok: false,
      caducada,
      error: `${e?.statusCode || ""} ${e?.body || e?.message || "error"}`.trim().slice(0, 300),
    };
  }
}

/**
 * Valida que lo que mandó el navegador tenga forma de suscripción.
 * Evita guardar basura en la tabla desde un cliente manipulado.
 */
export function suscripcionValida(s) {
  return Boolean(
    s &&
      typeof s.endpoint === "string" &&
      s.endpoint.startsWith("https://") &&
      s.endpoint.length < 1000 &&
      s.keys &&
      typeof s.keys.p256dh === "string" &&
      typeof s.keys.auth === "string"
  );
}
