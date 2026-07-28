// crm-backend/services/enlaces.mjs
//
// Un solo lugar para las URLs públicas del negocio.
//
// Existía este problema: el enlace para agendar cita estaba escrito a mano en
// tres sitios distintos de server.mjs, apuntando a
// `https://crm-automotriz-3wde-production.up.railway.app/cita` — una ruta que
// NO existe (el backend de Railway no sirve páginas, y el frontend no tiene
// ruta /cita). Todo cliente que pidiera una cita por Telegram recibía un
// enlace roto.
//
// Ahora hay una sola definición. Si mañana cambia el dominio, se cambia aquí
// o en las variables de Railway y no hay que perseguir strings por el código.
//
// Variables de entorno (Railway), todas opcionales:
//   URL_WEB   = https://solidoautoservicio.online          (sitio público)
//   URL_APP   = https://crm-solido.vercel.app/cliente      (app / portal del cliente)
//   URL_CITA  = https://solidoautoservicio.online/#cita    (formulario de cita)

/** Quita la barra final para no terminar con URLs tipo `dominio.com//cita`. */
const limpiar = (u) => String(u || "").trim().replace(/\/+$/, "");

/** Sitio web público del taller. */
export const URL_WEB = limpiar(process.env.URL_WEB) || "https://solidoautoservicio.online";

/** App del cliente (PWA): estado del vehículo, cotizaciones, citas, avisos. */
export const URL_APP = limpiar(process.env.URL_APP || process.env.URL_PORTAL) ||
  "https://crm-solido.vercel.app/cliente";

/**
 * Formulario para agendar cita en el sitio web.
 *
 * El formulario vive en una pestaña de `solido-web/index.html`, así que el
 * ancla `#cita` lo abre directamente en vez de dejar al cliente buscándolo.
 */
export const URL_CITA = limpiar(process.env.URL_CITA) || `${URL_WEB}/#cita`;

/** Teléfono / WhatsApp del taller, en los dos formatos que se usan. */
export const TEL_TALLER      = "849-569-2027";
export const WHATSAPP_TALLER = "18495692027";
export const WHATSAPP_LINK   = `https://wa.me/${WHATSAPP_TALLER}`;

/** Horario, para no repetirlo en cada plantilla. */
export const HORARIO_TEXTO =
  "Lunes a viernes 8:00 AM – 6:00 PM · Sábados 8:00 AM – 4:00 PM";
