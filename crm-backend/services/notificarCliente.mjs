// crm-backend/services/notificarCliente.mjs
// Avisa al cliente cuando cambia el estado de su vehículo.
//
// Se engancha en `transicionarEstado()` de server.mjs, que es el punto único
// por donde pasan TODOS los cambios de estado (kanban, pantalla del taller,
// carril de lavado, aprobación desde el portal). Notificar ahí significa que
// ningún camino se queda sin avisar.
//
// Dos canales, ambos funcionando hoy:
//   · CORREO — Brevo, el mismo que ya manda las citas
//   · PUSH   — la PWA que el cliente ya puede instalar desde /cliente
//
// El WhatsApp existente (`notificarClienteWA`) se deja intacto: cuando Meta
// apruebe la API empresarial, los tres canales conviven y cada cliente elige
// en `portal_preferencias_notif`.

import { createClient } from "@supabase/supabase-js";
import { enviarPush } from "./webPush.mjs";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const BREVO_API_KEY   = process.env.BREVO_API_KEY || "";
const MAIL_FROM_NAME  = "Sólido Auto Servicio";
const MAIL_FROM_EMAIL =
  process.env.MAIL_FROM_EMAIL || process.env.GMAIL_USER || "solidoautoservicio@gmail.com";
const URL_PORTAL      = process.env.URL_PORTAL || "https://crm-solido.vercel.app/cliente";
const WHATSAPP_TALLER = "18495692027";

// ─────────────────────────────────────────────────────────────────────────────
// Plantillas por estado
// ─────────────────────────────────────────────────────────────────────────────
//
// Solo se notifican los estados que le importan al cliente. CONTROL_CALIDAD no
// está a propósito: es un paso interno, y avisar de él solo genera llamadas
// preguntando si ya puede pasar a buscarlo.

const AVISOS = {
  DIAGNOSTICO: {
    emoji: "🔍",
    titulo: "Tu vehículo está en diagnóstico",
    corto: "Ya estamos revisando tu {vehiculo}.",
    cuerpo:
      "Nuestro técnico comenzó a evaluar tu {vehiculo}. En cuanto tengamos el " +
      "diagnóstico y la cotización te avisamos por este mismo medio.",
    accion: "Ver estado",
  },
  ESPERANDO_APROBACION: {
    emoji: "📋",
    titulo: "Tu cotización está lista",
    corto: "Necesitamos tu aprobación para continuar.",
    cuerpo:
      "Terminamos el diagnóstico de tu {vehiculo} y preparamos la cotización. " +
      "<strong>La reparación no comienza hasta que la apruebes</strong>. " +
      "Puedes revisarla y aprobarla desde tu celular, sin llamar ni pasar por el taller.",
    accion: "Ver y aprobar cotización",
    urgente: true,
  },
  REPARACION: {
    emoji: "⚙️",
    titulo: "Comenzamos la reparación",
    corto: "Ya estamos trabajando en tu {vehiculo}.",
    cuerpo:
      "Recibimos tu aprobación y el equipo ya está trabajando en tu {vehiculo}. " +
      "Te avisamos apenas esté listo para retirar.",
    accion: "Seguir el avance",
  },
  LISTO: {
    emoji: "✅",
    titulo: "¡Tu vehículo está listo!",
    corto: "Puedes pasar a recogerlo cuando gustes.",
    cuerpo:
      "Terminamos el trabajo en tu {vehiculo} y pasó el control de calidad. " +
      "Puedes pasar a recogerlo cuando gustes.<br><br>" +
      "<strong>Horario:</strong> Lunes a viernes 8:00 AM – 6:00 PM · Sábados 8:00 AM – 4:00 PM",
    accion: "Ver detalle",
    urgente: true,
  },
  ENTREGADO: {
    emoji: "🙏",
    titulo: "Gracias por tu confianza",
    corto: "Fue un placer atenderte.",
    cuerpo:
      "Gracias por confiar en nosotros el cuidado de tu {vehiculo}. " +
      "Guardamos el historial completo del servicio en tu portal, por si lo " +
      "necesitas para una garantía o al vender el vehículo.",
    accion: "Ver mi historial",
  },
  CANCELADA: {
    emoji: "ℹ️",
    titulo: "Orden cancelada",
    corto: "Se canceló la orden de tu {vehiculo}.",
    cuerpo:
      "La orden de tu {vehiculo} fue cancelada. Si no lo solicitaste o tienes " +
      "dudas, escríbenos por WhatsApp y lo revisamos.",
    accion: "Ver detalle",
  },
};

/** ¿Este estado amerita avisarle al cliente? */
export function esEventoNotificable(estado) {
  return Object.prototype.hasOwnProperty.call(AVISOS, estado);
}

// ─────────────────────────────────────────────────────────────────────────────
// Plantilla de correo
// ─────────────────────────────────────────────────────────────────────────────

function plantillaCorreo({ aviso, nombre, vehiculo, numeroOrden, cuerpo }) {
  const saludo = nombre ? `Hola <strong>${nombre.split(" ")[0]}</strong>,` : "Hola,";
  const colorAccion = aviso.urgente ? "#16a34a" : "#1e3a8a";

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;background:#f5f7fb;padding:24px;border-radius:14px">
    <div style="background:#0f172a;color:#fff;text-align:center;padding:22px;border-radius:12px 12px 0 0">
      <div style="font-size:22px;font-weight:900;letter-spacing:1px">SÓLIDO AUTO SERVICIO</div>
      <div style="font-size:12px;opacity:.8;margin-top:4px">Más que un taller, una experiencia</div>
    </div>

    <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px">
      <div style="font-size:34px;text-align:center;margin-bottom:6px">${aviso.emoji}</div>
      <h2 style="color:${colorAccion};margin:0 0 14px;text-align:center;font-size:19px">${aviso.titulo}</h2>

      <p style="color:#334155;font-size:15px;line-height:1.65;margin:0 0 16px">${saludo}</p>
      <p style="color:#334155;font-size:15px;line-height:1.65;margin:0 0 18px">${cuerpo}</p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155;background:#f8fafc;border-radius:9px">
        <tr><td style="padding:10px 12px;color:#64748b">🚗 Vehículo</td>
            <td style="padding:10px 12px;font-weight:700;text-align:right">${vehiculo}</td></tr>
        ${numeroOrden ? `<tr><td style="padding:10px 12px;color:#64748b">🔖 Orden</td>
            <td style="padding:10px 12px;font-weight:700;text-align:right">${numeroOrden}</td></tr>` : ""}
      </table>

      <div style="text-align:center;margin:22px 0 8px">
        <a href="${URL_PORTAL}" style="display:inline-block;background:${colorAccion};color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:700">
          ${aviso.accion}
        </a>
      </div>

      <p style="color:#64748b;font-size:13px;margin-top:20px;line-height:1.6;text-align:center">
        ¿Dudas? Escríbenos por WhatsApp al <strong>849-569-2027</strong>.
      </p>

      <p style="color:#94a3b8;font-size:11.5px;margin-top:18px;line-height:1.6;text-align:center;border-top:1px solid #e2e8f0;padding-top:14px">
        Recibes este correo porque tienes un servicio activo en Sólido Auto Servicio.<br>
        Puedes desactivar estos avisos desde tu portal, en Ajustes.
      </p>
    </div>
  </div>`;
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Bitácora
// ─────────────────────────────────────────────────────────────────────────────

async function registrar(fila) {
  const { error } = await supabase.from("notificaciones_cliente").insert([fila]);
  // 23505 = choque con uq_notif_cli_evento, o sea "ya se avisó de esto".
  // No es un error: es el anti-duplicado haciendo su trabajo.
  if (error && error.code !== "23505") {
    console.warn("[notif] no se pudo registrar:", error.message);
  }
  return !error;
}

/** ¿Ya se avisó de este evento por este canal? Evita correos repetidos. */
async function yaSeAviso(ordenId, evento, canal) {
  if (!ordenId) return false;
  const { data } = await supabase
    .from("notificaciones_cliente")
    .select("id")
    .eq("orden_id", ordenId)
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
 * Notifica al cliente el cambio de estado de su orden, por correo y por push.
 *
 * Nunca lanza: un fallo de correo no debe impedir que la orden avance. Todo
 * queda en `notificaciones_cliente` para poder diagnosticar después.
 *
 * @param {number} ordenId
 * @param {string} estado  Estado nuevo (clave de AVISOS)
 */
export async function notificarCambioEstado(ordenId, estado) {
  try {
    const aviso = AVISOS[estado];
    if (!aviso) return { ok: true, omitido: "estado sin aviso" };

    // ── Datos de la orden, vehículo y cliente ──
    const { data: orden } = await supabase
      .from("ordenes_trabajo")
      .select("id, numero_orden, cliente_id, vehiculo_id")
      .eq("id", ordenId)
      .maybeSingle();
    if (!orden?.cliente_id) return { ok: false, error: "orden sin cliente" };

    const [{ data: cliente }, { data: vehiculo }, { data: prefs }] = await Promise.all([
      supabase.from("clientes").select("id, nombre, email").eq("id", orden.cliente_id).maybeSingle(),
      orden.vehiculo_id
        ? supabase.from("vehiculos").select("marca, modelo, placa").eq("id", orden.vehiculo_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("portal_preferencias_notif").select("correo, push").eq("cliente_id", orden.cliente_id).maybeSingle(),
    ]);
    if (!cliente) return { ok: false, error: "cliente no encontrado" };

    const infoVeh = vehiculo
      ? `${vehiculo.marca || ""} ${vehiculo.modelo || ""} (${vehiculo.placa || ""})`.trim()
      : "tu vehículo";

    const cuerpo = aviso.cuerpo.replace(/\{vehiculo\}/g, infoVeh);
    const corto  = aviso.corto.replace(/\{vehiculo\}/g, infoVeh);

    const base = {
      cliente_id: cliente.id,
      vehiculo_id: orden.vehiculo_id || null,
      orden_id: orden.id,
      evento: estado,
      titulo: aviso.titulo,
      mensaje: corto,
    };

    const resultados = { correo: null, push: null };

    // ── CORREO ──────────────────────────────────────────────────────────────
    const correoOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cliente.email || "");
    const quiereCorreo = prefs?.correo !== false;

    if (!correoOk) {
      resultados.correo = "sin correo en ficha";
    } else if (!quiereCorreo) {
      resultados.correo = "desactivado por el cliente";
      await registrar({ ...base, canal: "correo", destino: cliente.email, estado: "omitido" });
    } else if (await yaSeAviso(orden.id, estado, "correo")) {
      resultados.correo = "ya enviado antes";
    } else {
      try {
        await enviarCorreoBrevo({
          para: cliente.email,
          asunto: `${aviso.emoji} ${aviso.titulo} · ${infoVeh}`,
          html: plantillaCorreo({
            aviso, nombre: cliente.nombre, vehiculo: infoVeh,
            numeroOrden: orden.numero_orden, cuerpo,
          }),
          texto: `${aviso.titulo}\n\n${corto}\n\nVehículo: ${infoVeh}\nVer estado: ${URL_PORTAL}\nWhatsApp: 849-569-2027`,
        });
        await registrar({ ...base, canal: "correo", destino: cliente.email, estado: "enviado" });
        resultados.correo = "enviado";
      } catch (e) {
        await registrar({
          ...base, canal: "correo", destino: cliente.email,
          estado: "fallido", detalle_error: String(e.message).slice(0, 400),
        });
        resultados.correo = `fallido: ${e.message}`;
      }
    }

    // ── PUSH (PWA) ──────────────────────────────────────────────────────────
    const quierePush = prefs?.push !== false;

    if (!quierePush) {
      resultados.push = "desactivado por el cliente";
    } else {
      const { data: suscripciones } = await supabase
        .from("portal_push_suscripciones")
        .select("id, endpoint, p256dh, auth, fallos")
        .eq("cliente_id", cliente.id)
        .eq("activa", true);

      if (!suscripciones?.length) {
        resultados.push = "sin dispositivos suscritos";
      } else {
        let enviados = 0;
        for (const s of suscripciones) {
          const r = await enviarPush(s, {
            titulo: `${aviso.emoji} ${aviso.titulo}`,
            cuerpo: corto,
            url: "/cliente",
            etiqueta: `orden-${orden.id}`,
          });

          if (r.ok) {
            enviados++;
            await supabase
              .from("portal_push_suscripciones")
              .update({ ultimo_uso_en: new Date().toISOString(), fallos: 0 })
              .eq("id", s.id);
          } else if (r.caducada) {
            // El cliente desinstaló la PWA o revocó el permiso: dar de baja.
            await supabase
              .from("portal_push_suscripciones")
              .update({ activa: false })
              .eq("id", s.id);
          } else {
            const fallos = (s.fallos || 0) + 1;
            await supabase
              .from("portal_push_suscripciones")
              .update({ fallos, activa: fallos < 5 })
              .eq("id", s.id);
          }
        }

        if (enviados > 0) {
          await registrar({
            ...base, canal: "push",
            destino: `${enviados} dispositivo(s)`, estado: "enviado",
          });
          resultados.push = `enviado a ${enviados}`;
        } else {
          resultados.push = "ningún dispositivo respondió";
        }
      }
    }

    console.log(
      `[notif] orden ${orden.id} → ${estado} | correo: ${resultados.correo} | push: ${resultados.push}`
    );
    return { ok: true, ...resultados };
  } catch (e) {
    console.warn("[notif] error inesperado:", e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Aviso de mantenimiento próximo (mejora #5 del análisis).
 * Pensado para llamarse desde una tarea programada, no desde un endpoint.
 */
export async function notificarMantenimiento(clienteId, vehiculoId, servicios) {
  try {
    const [{ data: cliente }, { data: vehiculo }, { data: prefs }] = await Promise.all([
      supabase.from("clientes").select("nombre, email").eq("id", clienteId).maybeSingle(),
      supabase.from("vehiculos").select("marca, modelo, placa").eq("id", vehiculoId).maybeSingle(),
      supabase.from("portal_preferencias_notif").select("correo").eq("cliente_id", clienteId).maybeSingle(),
    ]);

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cliente?.email || "")) return { ok: false };
    if (prefs?.correo === false) return { ok: false, omitido: true };

    const infoVeh = `${vehiculo?.marca || ""} ${vehiculo?.modelo || ""} (${vehiculo?.placa || ""})`.trim();
    const lista = servicios
      .map((s) => `<li style="margin-bottom:6px">${s.tipo_servicio}${s.proximo_fecha ? ` — ${new Date(s.proximo_fecha).toLocaleDateString("es-DO")}` : ""}</li>`)
      .join("");

    await enviarCorreoBrevo({
      para: cliente.email,
      asunto: `🔔 Mantenimiento próximo · ${infoVeh}`,
      html: plantillaCorreo({
        aviso: {
          emoji: "🔔",
          titulo: "Tu vehículo necesita mantenimiento",
          accion: "Agendar cita",
        },
        nombre: cliente.nombre,
        vehiculo: infoVeh,
        numeroOrden: null,
        cuerpo:
          `Según el historial de tu ${infoVeh}, se acercan estos servicios:` +
          `<ul style="margin:12px 0;padding-left:20px;color:#334155">${lista}</ul>` +
          `Agenda con tiempo y evita esperas.`,
      }),
      texto: `Mantenimiento próximo para ${infoVeh}:\n` +
             servicios.map((s) => `- ${s.tipo_servicio}`).join("\n") +
             `\n\nAgenda por WhatsApp: ${WHATSAPP_TALLER}`,
    });

    await registrar({
      cliente_id: clienteId, vehiculo_id: vehiculoId, orden_id: null,
      evento: "MANTENIMIENTO", canal: "correo", destino: cliente.email,
      titulo: "Mantenimiento próximo", mensaje: infoVeh, estado: "enviado",
    });

    return { ok: true };
  } catch (e) {
    console.warn("[notif] mantenimiento:", e.message);
    return { ok: false, error: e.message };
  }
}
