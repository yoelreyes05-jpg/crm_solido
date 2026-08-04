// crm-backend/services/notificarCita.mjs
//
// Avisos de CITAS al cliente: agendada, confirmada, cancelada y recordatorios.
//
// Por qué un módulo aparte de `notificarCliente.mjs`:
//   · Aquel notifica cambios de estado de una ORDEN DE TRABAJO, y su bitácora
//     (`notificaciones_cliente`) tiene el índice anti-duplicado atado a
//     `orden_id`. Una cita todavía no tiene orden — insertar ahí rompería la
//     restricción o dejaría el anti-duplicado sin efecto.
//   · Una cita puede pertenecer a alguien que NO está en la tabla `clientes`
//     (la agendó desde la web o desde Telegram sin estar registrado). El
//     destinatario entonces es el correo del formulario o el chat de Telegram,
//     no un `cliente_id`.
//
// Tres canales, por orden de fiabilidad:
//   · PUSH     — solo si la cita está vinculada a un cliente con la app instalada
//   · TELEGRAM — si la cita nació en el bot; llega siempre, sin permisos ni correo
//   · CORREO   — Brevo; depende de que haya correo válido
//
// Nunca lanza. Un fallo de aviso jamás debe impedir que la cita se guarde o
// que la secretaria pueda confirmarla.

import { createClient } from "@supabase/supabase-js";
import { enviarPush } from "./webPush.mjs";
import { URL_APP, URL_CITA, TEL_TALLER, HORARIO_TEXTO } from "./enlaces.mjs";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const BREVO_API_KEY   = process.env.BREVO_API_KEY || "";
const MAIL_FROM_NAME  = "Sólido Auto Servicio";
const MAIL_FROM_EMAIL =
  process.env.MAIL_FROM_EMAIL || process.env.GMAIL_USER || "solidoautoservicio@gmail.com";
const TG_TOKEN = process.env.TELEGRAM_TOKEN || "";

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo de avisos
// ─────────────────────────────────────────────────────────────────────────────

const AVISOS = {
  AGENDADA: {
    emoji: "📅",
    titulo: "Cita agendada",
    corto: "Recibimos tu solicitud para el {fecha} a las {hora}.",
    cuerpo:
      "Recibimos tu solicitud de cita para el <strong>{fecha}</strong> a las " +
      "<strong>{hora}</strong>. Está <strong>pendiente de confirmación</strong>: " +
      "te avisamos en cuanto el taller la confirme.",
    accion: "Ver mi cita",
  },
  CONFIRMADA: {
    emoji: "✅",
    titulo: "¡Tu cita está confirmada!",
    corto: "Te esperamos el {fecha} a las {hora}.",
    cuerpo:
      "Tu cita quedó <strong>confirmada</strong> para el <strong>{fecha}</strong> " +
      "a las <strong>{hora}</strong>. Te esperamos.<br><br>" +
      "Llega unos minutos antes y, si puedes, trae el historial de servicio del vehículo.",
    accion: "Ver mi cita",
    urgente: true,
  },
  CANCELADA: {
    emoji: "❌",
    titulo: "Cita cancelada",
    corto: "Se canceló tu cita del {fecha}.",
    cuerpo:
      "Tu cita del <strong>{fecha}</strong> a las <strong>{hora}</strong> fue cancelada. " +
      "Si no lo solicitaste o quieres reprogramarla, escríbenos y lo resolvemos.",
    accion: "Agendar otra cita",
  },
  REPROGRAMADA: {
    emoji: "🔄",
    titulo: "Cambiamos la fecha de tu cita",
    corto: "Nueva fecha: {fecha} a las {hora}.",
    cuerpo:
      "Tu cita se movió al <strong>{fecha}</strong> a las <strong>{hora}</strong>. " +
      "Si esa fecha no te sirve, avísanos y buscamos otra.",
    accion: "Ver mi cita",
    urgente: true,
  },
  RECORDATORIO_DIA: {
    emoji: "🔔",
    titulo: "Tu cita es mañana",
    corto: "Mañana a las {hora} te esperamos.",
    cuerpo:
      "Te recordamos tu cita de <strong>mañana</strong> a las <strong>{hora}</strong>. " +
      "Si no puedes venir, avísanos con tiempo para darle el turno a otro cliente.",
    accion: "Ver mi cita",
  },
  RECORDATORIO_HORA: {
    emoji: "⏰",
    titulo: "Tu cita es en 1 hora",
    corto: "En una hora, a las {hora}. Te esperamos.",
    cuerpo:
      "Tu cita es <strong>dentro de una hora</strong>, a las <strong>{hora}</strong>. " +
      "Te esperamos en el taller.",
    accion: "Ver mi cita",
    urgente: true,
  },
};

/** ¿Este evento de cita amerita avisarle al cliente? */
export function esEventoDeCita(evento) {
  return Object.prototype.hasOwnProperty.call(AVISOS, evento);
}

/** El estado nuevo de una cita, traducido al evento que se le notifica. */
export function eventoDesdeEstado(estado) {
  const mapa = {
    CONFIRMADA: "CONFIRMADA",
    CANCELADA:  "CANCELADA",
  };
  return mapa[String(estado || "").toUpperCase()] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formato
// ─────────────────────────────────────────────────────────────────────────────

const DIAS  = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
               "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/**
 * "2026-08-03" → "lunes 3 de agosto".
 *
 * Se parte el string a mano en vez de usar `new Date("2026-08-03")`: ese
 * constructor interpreta la fecha como UTC y en República Dominicana (UTC-4)
 * la muestra un día antes. Un cliente al que le dices que su cita es el
 * domingo cuando es lunes no vuelve.
 */
export function fechaLarga(fechaISO) {
  const [a, m, d] = String(fechaISO || "").split("-").map(Number);
  if (!a || !m || !d) return String(fechaISO || "");
  const dia = new Date(a, m - 1, d).getDay();
  return `${DIAS[dia]} ${d} de ${MESES[m - 1]}`;
}

/** "14:30" → "2:30 PM". El cliente dominicano lee la hora en 12 horas. */
export function hora12(hora) {
  const [h, m = "00"] = String(hora || "").split(":");
  const n = Number(h);
  if (Number.isNaN(n)) return String(hora || "");
  const sufijo = n >= 12 ? "PM" : "AM";
  const h12 = n % 12 === 0 ? 12 : n % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${sufijo}`;
}

const rellenar = (txt, cita) =>
  String(txt || "")
    .replace(/\{fecha\}/g, fechaLarga(cita.fecha))
    .replace(/\{hora\}/g, hora12(cita.hora))
    .replace(/\{vehiculo\}/g, cita._vehiculo || "tu vehículo");

// ─────────────────────────────────────────────────────────────────────────────
// Plantillas
// ─────────────────────────────────────────────────────────────────────────────

function plantillaCorreo({ aviso, nombre, cita, cuerpo, enlace }) {
  const saludo = nombre ? `Hola <strong>${nombre.split(" ")[0]}</strong>,` : "Hola,";
  const color = aviso.urgente ? "#16a34a" : "#1e3a8a";

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;background:#f5f7fb;padding:24px;border-radius:14px">
    <div style="background:#0f172a;color:#fff;text-align:center;padding:22px;border-radius:12px 12px 0 0">
      <div style="font-size:22px;font-weight:900;letter-spacing:1px">SÓLIDO AUTO SERVICIO</div>
      <div style="font-size:12px;opacity:.8;margin-top:4px">Más que un taller, una experiencia</div>
    </div>

    <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px">
      <div style="font-size:34px;text-align:center;margin-bottom:6px">${aviso.emoji}</div>
      <h2 style="color:${color};margin:0 0 14px;text-align:center;font-size:19px">${aviso.titulo}</h2>

      <p style="color:#334155;font-size:15px;line-height:1.65;margin:0 0 16px">${saludo}</p>
      <p style="color:#334155;font-size:15px;line-height:1.65;margin:0 0 18px">${cuerpo}</p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155;background:#f8fafc;border-radius:9px">
        <tr><td style="padding:10px 12px;color:#64748b">📅 Fecha</td>
            <td style="padding:10px 12px;font-weight:700;text-align:right">${fechaLarga(cita.fecha)}</td></tr>
        <tr><td style="padding:10px 12px;color:#64748b">🕐 Hora</td>
            <td style="padding:10px 12px;font-weight:700;text-align:right">${hora12(cita.hora)}</td></tr>
        ${cita._vehiculo ? `<tr><td style="padding:10px 12px;color:#64748b">🚗 Vehículo</td>
            <td style="padding:10px 12px;font-weight:700;text-align:right">${cita._vehiculo}</td></tr>` : ""}
        ${cita.descripcion ? `<tr><td style="padding:10px 12px;color:#64748b">🔧 Motivo</td>
            <td style="padding:10px 12px;font-weight:700;text-align:right">${cita.descripcion}</td></tr>` : ""}
      </table>

      <div style="text-align:center;margin:22px 0 8px">
        <a href="${enlace}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:700">
          ${aviso.accion}
        </a>
      </div>

      <p style="color:#64748b;font-size:13px;margin-top:20px;line-height:1.6;text-align:center">
        ${HORARIO_TEXTO}<br>
        ¿Dudas? Escríbenos por WhatsApp al <strong>${TEL_TALLER}</strong>.
      </p>
    </div>
  </div>`;
}

function plantillaTelegram({ aviso, cita, enlace }) {
  const lineas = [
    `${aviso.emoji} <b>${aviso.titulo}</b>`,
    "",
    `📅 <b>${fechaLarga(cita.fecha)}</b> a las <b>${hora12(cita.hora)}</b>`,
  ];
  if (cita._vehiculo)    lineas.push(`🚗 ${cita._vehiculo}`);
  if (cita.descripcion)  lineas.push(`🔧 ${cita.descripcion}`);
  lineas.push("", rellenar(aviso.corto, cita));
  lineas.push("", `📞 ${TEL_TALLER}  ·  <a href="${enlace}">Ver en la app</a>`);
  return lineas.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Envío por canal
// ─────────────────────────────────────────────────────────────────────────────

async function enviarCorreoBrevo({ para, asunto, html, texto }) {
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY no configurada");

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: MAIL_FROM_NAME, email: MAIL_FROM_EMAIL },
      to: [{ email: para }],
      subject: asunto,
      htmlContent: html,
      textContent: texto,
    }),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Brevo ${res.status}: ${detalle.slice(0, 200)}`);
  }
}

/**
 * Manda un mensaje por Telegram.
 *
 * Se exporta porque el bot en server.mjs necesita exactamente lo mismo y no
 * tiene sentido tener dos implementaciones que se desincronicen.
 */
export async function enviarTelegram(chatId, texto, extra = {}) {
  if (!TG_TOKEN || !chatId) return { ok: false, error: "telegram no configurado" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...extra,
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return { ok: false, error: `${r.status} ${t.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bitácora
// ─────────────────────────────────────────────────────────────────────────────

async function registrar(fila) {
  const { error } = await supabase.from("notificaciones_cita").insert([fila]);
  // 23505 = choque con uq_notif_cita_evento: ya se avisó de esto. No es error.
  if (error && error.code !== "23505") {
    console.warn("[notif-cita] no se pudo registrar:", error.message);
  }
}

async function yaSeAviso(citaId, evento, canal) {
  const { data } = await supabase
    .from("notificaciones_cita")
    .select("id")
    .eq("cita_id", citaId)
    .eq("evento", evento)
    .eq("canal", canal)
    .eq("estado", "enviado")
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Función principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Avisa al cliente sobre su cita por todos los canales que apliquen.
 *
 * @param {number|string} citaId
 * @param {keyof typeof AVISOS} evento
 * @param {{forzar?: boolean}} [opciones]  `forzar` salta el anti-duplicado
 *                                          (lo usa el botón "reenviar aviso").
 * @returns {Promise<{ok:boolean, push?:string, correo?:string, telegram?:string, error?:string}>}
 */
export async function notificarCita(citaId, evento, opciones = {}) {
  try {
    const aviso = AVISOS[evento];
    if (!aviso) return { ok: true, omitido: `evento sin aviso: ${evento}` };

    const { data: cita } = await supabase
      .from("citas_taller")
      .select("*")
      .eq("id", citaId)
      .maybeSingle();
    if (!cita) return { ok: false, error: "cita no encontrada" };

    // ── Datos de contacto ──
    // Una cita puede venir de un cliente registrado (cliente_id) o de alguien
    // que solo dejó su correo en el formulario. Se resuelven ambos casos.
    let cliente = null;
    let vehiculo = null;
    let prefs = null;

    if (cita.cliente_id) {
      const [c, p] = await Promise.all([
        supabase.from("clientes").select("id, nombre, email").eq("id", cita.cliente_id).maybeSingle(),
        supabase.from("portal_preferencias_notif").select("correo, push")
          .eq("cliente_id", cita.cliente_id).maybeSingle(),
      ]);
      cliente = c.data;
      prefs   = p.data;
    }
    if (cita.vehiculo_id) {
      const v = await supabase.from("vehiculos").select("marca, modelo, placa")
        .eq("id", cita.vehiculo_id).maybeSingle();
      vehiculo = v.data;
    }

    cita._vehiculo = vehiculo
      ? `${vehiculo.marca || ""} ${vehiculo.modelo || ""} (${vehiculo.placa || ""})`.trim()
      : [cita.modelo_texto, cita.placa_texto ? `(${cita.placa_texto})` : ""].filter(Boolean).join(" ");

    const nombre = cliente?.nombre || cita.nombre_contacto || "";
    const correo = cliente?.email || cita.email_contacto || "";
    const enlace = evento === "CANCELADA" ? URL_CITA : URL_APP;

    const cuerpo = rellenar(aviso.cuerpo, cita);
    const corto  = rellenar(aviso.corto, cita);

    const base = {
      cita_id: cita.id,
      cliente_id: cita.cliente_id || null,
      evento,
      titulo: aviso.titulo,
      mensaje: corto,
    };

    const resultados = { push: null, correo: null, telegram: null };
    const saltarDuplicado = opciones.forzar === true;

    // ── PUSH ────────────────────────────────────────────────────────────────
    // Primero a propósito: es instantáneo y no depende de que el cliente tenga
    // correo. Para quien instaló la app, es el canal que de verdad llega.
    if (!cita.cliente_id) {
      resultados.push = "cita sin cliente registrado";
    } else if (prefs?.push === false) {
      resultados.push = "desactivado por el cliente";
    } else if (!saltarDuplicado && (await yaSeAviso(cita.id, evento, "push"))) {
      resultados.push = "ya enviado antes";
    } else {
      const { data: subs } = await supabase
        .from("portal_push_suscripciones")
        .select("id, endpoint, p256dh, auth, fallos")
        .eq("cliente_id", cita.cliente_id)
        .eq("activa", true);

      if (!subs?.length) {
        resultados.push = "sin dispositivos suscritos";
      } else {
        let enviados = 0;
        for (const s of subs) {
          const r = await enviarPush(s, {
            titulo: `${aviso.emoji} ${aviso.titulo}`,
            cuerpo: corto,
            url: "/cliente?tab=citas",
            etiqueta: `cita-${cita.id}`,
          });

          if (r.ok) {
            enviados++;
            await supabase.from("portal_push_suscripciones")
              .update({ ultimo_uso_en: new Date().toISOString(), fallos: 0 }).eq("id", s.id);
          } else if (r.caducada) {
            await supabase.from("portal_push_suscripciones")
              .update({ activa: false }).eq("id", s.id);
          } else {
            const fallos = (s.fallos || 0) + 1;
            await supabase.from("portal_push_suscripciones")
              .update({ fallos, activa: fallos < 5 }).eq("id", s.id);
          }
        }

        if (enviados > 0) {
          await registrar({ ...base, canal: "push", destino: `${enviados} dispositivo(s)`, estado: "enviado" });
          resultados.push = `enviado a ${enviados}`;
        } else {
          await registrar({ ...base, canal: "push", destino: `${subs.length} dispositivo(s)`,
            estado: "fallido", detalle_error: "ningún dispositivo aceptó el envío" });
          resultados.push = "ningún dispositivo respondió";
        }
      }
    }

    // ── TELEGRAM ────────────────────────────────────────────────────────────
    if (!cita.telegram_chat_id) {
      resultados.telegram = "cita sin chat de Telegram";
    } else if (!saltarDuplicado && (await yaSeAviso(cita.id, evento, "telegram"))) {
      resultados.telegram = "ya enviado antes";
    } else {
      const r = await enviarTelegram(
        cita.telegram_chat_id,
        plantillaTelegram({ aviso, cita, enlace })
      );
      await registrar({
        ...base, canal: "telegram", destino: String(cita.telegram_chat_id),
        estado: r.ok ? "enviado" : "fallido",
        ...(r.ok ? {} : { detalle_error: String(r.error).slice(0, 400) }),
      });
      resultados.telegram = r.ok ? "enviado" : `fallido: ${r.error}`;
    }

    // ── CORREO ──────────────────────────────────────────────────────────────
    const correoValido = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo);

    if (!correoValido) {
      resultados.correo = "sin correo";
    } else if (prefs?.correo === false) {
      resultados.correo = "desactivado por el cliente";
      await registrar({ ...base, canal: "correo", destino: correo, estado: "omitido" });
    } else if (!saltarDuplicado && (await yaSeAviso(cita.id, evento, "correo"))) {
      resultados.correo = "ya enviado antes";
    } else {
      try {
        await enviarCorreoBrevo({
          para: correo,
          asunto: `${aviso.emoji} ${aviso.titulo} · ${fechaLarga(cita.fecha)} ${hora12(cita.hora)}`,
          html: plantillaCorreo({ aviso, nombre, cita, cuerpo, enlace }),
          texto:
            `${aviso.titulo}\n\n${corto}\n\n` +
            `Fecha: ${fechaLarga(cita.fecha)} a las ${hora12(cita.hora)}\n` +
            (cita._vehiculo ? `Vehículo: ${cita._vehiculo}\n` : "") +
            `\n${enlace}\nWhatsApp: ${TEL_TALLER}`,
        });
        await registrar({ ...base, canal: "correo", destino: correo, estado: "enviado" });
        resultados.correo = "enviado";
      } catch (e) {
        await registrar({
          ...base, canal: "correo", destino: correo,
          estado: "fallido", detalle_error: String(e.message).slice(0, 400),
        });
        resultados.correo = `fallido: ${e.message}`;
      }
    }

    console.log(
      `[notif-cita] cita ${cita.id} → ${evento} | push: ${resultados.push} | ` +
      `telegram: ${resultados.telegram} | correo: ${resultados.correo}`
    );
    return { ok: true, ...resultados };
  } catch (e) {
    console.warn("[notif-cita] error inesperado:", e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Aviso interno al taller de que entró una cita nueva.
 * Separado del aviso al cliente: si el correo del cliente rebota, la
 * secretaria igual se entera.
 */
export async function avisarTallerNuevaCita(cita) {
  const destino = process.env.MAIL_TALLER || process.env.GMAIL_USER || MAIL_FROM_EMAIL;
  const origen = {
    APP: "la app del cliente", WEB: "el sitio web",
    TELEGRAM: "Telegram", CRM: "el CRM",
  }[cita.origen] || cita.origen || "—";

  try {
    await enviarCorreoBrevo({
      para: destino,
      asunto: `📅 Nueva cita (${cita.origen || "—"}) — ${cita.nombre_contacto || "cliente"} · ${cita.fecha} ${cita.hora}`,
      html: `
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#334155">
          <h3 style="color:#0f172a">Nueva cita agendada desde ${origen}</h3>
          <p>
            <strong>Cliente:</strong> ${cita.nombre_contacto || "—"}<br/>
            <strong>Correo:</strong> ${cita.email_contacto || "—"}<br/>
            <strong>Teléfono:</strong> ${cita.telefono_contacto || "—"}<br/>
            <strong>Vehículo:</strong> ${cita.modelo_texto || "—"} — placa ${cita.placa_texto || "—"}<br/>
            <strong>Fecha:</strong> ${fechaLarga(cita.fecha)} a las ${hora12(cita.hora)}<br/>
            <strong>Motivo:</strong> ${cita.descripcion || "—"}
          </p>
          <p style="color:#64748b">Revísala y confírmala en el CRM → módulo Citas.</p>
        </div>`,
      texto: `Nueva cita desde ${origen}: ${cita.nombre_contacto} — ${cita.fecha} ${cita.hora}`,
    });
    return { ok: true };
  } catch (e) {
    console.warn("[notif-cita] aviso al taller:", e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Aviso al taller de una PRE-INSCRIPCIÓN a curso hecha desde el sitio web.
 *
 * Va por el mismo canal que el aviso de cita nueva a propósito: el taller ya
 * mira ese buzón, y una pre-inscripción que nadie ve en 24 horas es un alumno
 * perdido. No lanza: si Brevo falla, la fila ya quedó guardada en el CRM.
 *
 * @param {{nombre:string,telefono?:string,email?:string,curso:string,
 *          fecha_proxima?:string,modalidad?:string,notas?:string}} datos
 */
export async function avisarTallerPreinscripcionCurso(datos) {
  const destino = process.env.MAIL_TALLER || process.env.GMAIL_USER || MAIL_FROM_EMAIL;
  try {
    await enviarCorreoBrevo({
      para: destino,
      asunto: `🎓 Pre-inscripción web — ${datos.nombre} · ${datos.curso}`,
      html: `
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#334155">
          <h3 style="color:#0f172a">Nueva pre-inscripción desde el sitio web</h3>
          <p>
            <strong>Curso:</strong> ${datos.curso}<br/>
            <strong>Inicio:</strong> ${datos.fecha_proxima ? fechaLarga(datos.fecha_proxima) : "por definir"}<br/>
            <strong>Modalidad:</strong> ${datos.modalidad || "—"}<br/>
            <strong>Alumno:</strong> ${datos.nombre}<br/>
            <strong>Teléfono:</strong> ${datos.telefono || "—"}<br/>
            <strong>Correo:</strong> ${datos.email || "—"}<br/>
            <strong>Comentario:</strong> ${datos.notas || "—"}
          </p>
          <p style="color:#64748b">
            Queda registrado en el CRM → Capacitaciones, con monto pagado en 0.
            Confirmen el cupo y el pago por teléfono.
          </p>
        </div>`,
      texto: `Pre-inscripción web: ${datos.nombre} — ${datos.curso} (${datos.telefono || "sin teléfono"})`,
    });
    return { ok: true };
  } catch (e) {
    console.warn("[cursos] aviso de pre-inscripción:", e.message);
    return { ok: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Recordatorios
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Manda los recordatorios que toquen ahora mismo.
 *
 * Dos ventanas:
 *   · El día anterior — se manda una vez, para citas de mañana.
 *   · Una hora antes  — para citas de hoy cuya hora cae dentro de los próximos
 *                       45–75 minutos.
 *
 * Las banderas `recordatorio_dia_enviado` / `recordatorio_hora_enviado` en la
 * fila son la garantía real de no repetir: aunque el proceso corra dos veces
 * por un redespliegue, la segunda no encuentra nada que mandar.
 *
 * @param {Date} [ahora]  inyectable para poder probarlo sin esperar
 */
export async function enviarRecordatoriosPendientes(ahora = new Date()) {
  const resumen = { dia: 0, hora: 0, errores: [] };

  try {
    // ── Zona horaria ──
    // Railway corre en UTC; el taller vive en UTC-4 y las horas de las citas
    // están escritas en hora local. Sin este ajuste los recordatorios de
    // "1 hora antes" salen 4 horas corridos.
    const desfase = Number(process.env.TZ_OFFSET_HORAS ?? -4);
    const local = new Date(ahora.getTime() + desfase * 3600_000);
    const hoyISO = local.toISOString().slice(0, 10);
    const manana = new Date(local.getTime() + 86400_000).toISOString().slice(0, 10);

    // ── Recordatorio del día anterior ──
    const { data: citasManana } = await supabase
      .from("citas_taller")
      .select("id")
      .eq("fecha", manana)
      .eq("estado", "CONFIRMADA")
      .or("recordatorio_dia_enviado.is.null,recordatorio_dia_enviado.eq.false");

    for (const c of citasManana || []) {
      // La bandera se marca ANTES de notificar. Si el envío falla, no se
      // reintenta: es preferible perder un recordatorio a mandar cinco.
      await supabase.from("citas_taller")
        .update({ recordatorio_dia_enviado: true }).eq("id", c.id);
      const r = await notificarCita(c.id, "RECORDATORIO_DIA");
      if (r.ok) resumen.dia++; else resumen.errores.push(`cita ${c.id}: ${r.error}`);
    }

    // ── Recordatorio de una hora antes ──
    const { data: citasHoy } = await supabase
      .from("citas_taller")
      .select("id, hora")
      .eq("fecha", hoyISO)
      .eq("estado", "CONFIRMADA")
      .or("recordatorio_hora_enviado.is.null,recordatorio_hora_enviado.eq.false");

    const minutosAhora = local.getUTCHours() * 60 + local.getUTCMinutes();

    for (const c of citasHoy || []) {
      const [h, m = "0"] = String(c.hora || "09:00").split(":");
      const minutosCita = Number(h) * 60 + Number(m);
      const faltan = minutosCita - minutosAhora;

      // Ventana de 45 a 75 minutos: suficientemente ancha para que un proceso
      // que corre cada 15 minutos nunca se la salte, y suficientemente
      // estrecha para que el aviso siga significando "en una hora".
      if (faltan < 45 || faltan > 75) continue;

      await supabase.from("citas_taller")
        .update({ recordatorio_hora_enviado: true }).eq("id", c.id);
      const r = await notificarCita(c.id, "RECORDATORIO_HORA");
      if (r.ok) resumen.hora++; else resumen.errores.push(`cita ${c.id}: ${r.error}`);
    }

    if (resumen.dia || resumen.hora) {
      console.log(`[notif-cita] recordatorios → día: ${resumen.dia}, hora: ${resumen.hora}`);
    }
    return { ok: true, ...resumen };
  } catch (e) {
    console.warn("[notif-cita] recordatorios:", e.message);
    return { ok: false, error: e.message, ...resumen };
  }
}
