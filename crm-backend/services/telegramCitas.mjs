// crm-backend/services/telegramCitas.mjs
//
// Agendar una cita SIN SALIR DE TELEGRAM.
//
// Antes el bot solo sabía dar un enlace — y encima el enlace estaba roto
// (apuntaba a `railway.app/cita`, una ruta que no existe). Ahora el bot hace
// las preguntas él mismo y escribe la cita en `citas_taller`, igual que el
// formulario de la web, con `origen = 'TELEGRAM'`.
//
// Si la placa que da el cliente ya está en el CRM, la cita queda vinculada a
// su `cliente_id` y `vehiculo_id`: entra a la ficha 360 y le llegan también
// los avisos push si tiene la app instalada. Si no está registrado, se guardan
// sus datos de contacto en la propia cita, igual que hacen las citas web.
//
// ── Por qué teclado normal y no botones "inline" ────────────────────────────
// Los botones inline llegan al webhook como `callback_query`, no como
// `message.text`, y el webhook actual solo procesa texto. Un `ReplyKeyboard`
// envía texto plano, así que funciona con el manejador que ya existe y no hay
// riesgo de que un botón se quede sin respuesta.

import { createClient } from "@supabase/supabase-js";
import { notificarCita, avisarTallerNuevaCita, fechaLarga, hora12 } from "./notificarCita.mjs";
import { TEL_TALLER, URL_APP } from "./enlaces.mjs";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const HORAS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
];
const CUPO_POR_HORA = Number(process.env.CITAS_CUPO_POR_HORA || 3);
const DESFASE_HORAS = Number(process.env.TZ_OFFSET_HORAS ?? -4);

const SERVICIOS = [
  "Mantenimiento / cambio de aceite",
  "Diagnóstico computarizado",
  "Frenos",
  "Suspensión y dirección",
  "Aire acondicionado",
  "Sistema eléctrico",
  "Alineación y balanceo",
  "Otro",
];

/** El texto del menú → el valor de `tipo_servicio` que guarda el CRM. */
const TIPO_POR_SERVICIO = {
  "mantenimiento / cambio de aceite": "MANTENIMIENTO",
  "diagnóstico computarizado":        "DIAGNOSTICO",
  "frenos":                           "FRENOS",
  "suspensión y dirección":           "SUSPENSION",
  "aire acondicionado":               "AIRE_ACONDICIONADO",
  "sistema eléctrico":                "ELECTRICO",
  "alineación y balanceo":            "ALINEACION",
  "otro":                             "OTRO",
};

// ─────────────────────────────────────────────────────────────────────────────
// Estado de la conversación
// ─────────────────────────────────────────────────────────────────────────────
//
// Se guarda en Supabase para que sobreviva a los redespliegues de Railway,
// que son frecuentes. El Map en memoria es la caché y, si la tabla todavía no
// existe (no se corrió el SQL), el respaldo: el flujo sigue funcionando, solo
// que un reinicio corta las conversaciones a medias.

const cache = new Map();
let tablaDisponible = true;

const ahoraISO = () => new Date().toISOString();

async function leerEstado(chatId) {
  const clave = String(chatId);
  if (cache.has(clave)) return cache.get(clave);
  if (!tablaDisponible) return null;

  const { data, error } = await supabase
    .from("telegram_conversaciones")
    .select("paso, datos, actualizado_en")
    .eq("chat_id", clave)
    .maybeSingle();

  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) {
      console.warn("[tg-citas] falta la tabla telegram_conversaciones; usando memoria. Corre crm-backend/sql/citas_app_telegram.sql");
      tablaDisponible = false;
    }
    return null;
  }
  if (!data) return null;

  // Una conversación de hace dos horas está abandonada: retomarla en el paso
  // "hora" cuando el cliente vuelve a escribir "hola" es peor que empezar.
  if (Date.now() - new Date(data.actualizado_en).getTime() > 2 * 3600_000) {
    await borrarEstado(chatId);
    return null;
  }

  const estado = { paso: data.paso, datos: data.datos || {} };
  cache.set(clave, estado);
  return estado;
}

async function guardarEstado(chatId, paso, datos) {
  const clave = String(chatId);
  cache.set(clave, { paso, datos });
  if (!tablaDisponible) return;

  const { error } = await supabase.from("telegram_conversaciones").upsert(
    { chat_id: clave, flujo: "cita", paso, datos, actualizado_en: ahoraISO() },
    { onConflict: "chat_id" }
  );
  if (error && /does not exist|schema cache/i.test(error.message)) tablaDisponible = false;
}

async function borrarEstado(chatId) {
  const clave = String(chatId);
  cache.delete(clave);
  if (!tablaDisponible) return;
  await supabase.from("telegram_conversaciones").delete().eq("chat_id", clave);
}

/** ¿Este chat está a media conversación? Lo consulta el webhook. */
export async function hayCitaEnCurso(chatId) {
  return Boolean(await leerEstado(chatId));
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades de fecha
// ─────────────────────────────────────────────────────────────────────────────

/** Hoy, en hora del taller. Railway corre en UTC. */
function hoyLocal() {
  return new Date(Date.now() + DESFASE_HORAS * 3600_000);
}

const aISO = (d) => d.toISOString().slice(0, 10);

const DIAS_SEMANA = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, "miércoles": 3,
  jueves: 4, viernes: 5, sabado: 6, "sábado": 6,
};

const MESES_NUM = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/**
 * Interpreta lo que sea que el cliente escriba como fecha.
 *
 * Acepta lo que teclea una persona ("mañana", "el lunes", "5/8", "05-08-2026")
 * y también el texto exacto de los botones que genera el bot
 * ("lunes 3 de agosto"). Sin lo segundo, tocar un botón daría "no entendí la
 * fecha", que es la peor forma posible de fallar.
 *
 * Devuelve YYYY-MM-DD o null.
 */
export function interpretarFecha(texto) {
  const t = String(texto || "").toLowerCase().trim()
    .replace(/^el\s+/, "").replace(/^este\s+/, "").replace(/^próximo\s+|^proximo\s+/, "");
  const hoy = hoyLocal();

  if (/^hoy$/.test(t)) return aISO(hoy);
  if (/^ma[ñn]ana$/.test(t)) return aISO(new Date(hoy.getTime() + 86400_000));
  if (/^pasado\s?ma[ñn]ana$/.test(t)) return aISO(new Date(hoy.getTime() + 2 * 86400_000));

  // Formato largo de los botones: "lunes 3 de agosto" (el día de la semana
  // sobra, la fecha ya es inequívoca sin él).
  const largo = t.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)/);
  if (largo) {
    const d = Number(largo[1]);
    const mes = MESES_NUM[largo[2]];
    if (mes && d >= 1 && d <= 31) {
      const arma = (a) => `${a}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const esteAno = arma(hoy.getUTCFullYear());
      // En diciembre, "5 de enero" es del año que viene.
      return esteAno < aISO(hoy) ? arma(hoy.getUTCFullYear() + 1) : esteAno;
    }
  }

  // Nombre de día suelto: el más próximo que todavía no ha pasado.
  const dia = DIAS_SEMANA[t];
  if (dia !== undefined) {
    let d = new Date(hoy);
    for (let i = 1; i <= 7; i++) {
      d = new Date(hoy.getTime() + i * 86400_000);
      if (d.getUTCDay() === dia) return aISO(d);
    }
  }

  // ISO completo
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return t;

  // D/M o D/M/AAAA (el formato que se usa en RD)
  const dm = t.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/);
  if (dm) {
    const d = Number(dm[1]);
    const m = Number(dm[2]);
    let a = dm[3] ? Number(dm[3]) : hoy.getUTCFullYear();
    if (a < 100) a += 2000;
    if (d < 1 || d > 31 || m < 1 || m > 12) return null;
    // Sin año explícito y con la fecha ya pasada, se asume el año que viene:
    // en diciembre, "5/1" quiere decir enero del próximo año.
    const candidato = `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (!dm[3] && candidato < aISO(hoy)) {
      return `${a + 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    return candidato;
  }

  return null;
}

/** "9", "9am", "9:30", "2 pm", "14:30" → "HH:MM" en 24 horas, o null. */
export function interpretarHora(texto) {
  const t = String(texto || "").toLowerCase().trim().replace(/\s+/g, "");
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?(am|pm|a\.m\.|p\.m\.)?$/);
  if (!m) return null;

  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const sufijo = (m[3] || "").replace(/\./g, "");

  if (sufijo.startsWith("p") && h < 12) h += 12;
  if (sufijo.startsWith("a") && h === 12) h = 0;
  // Sin am/pm, una cita "a las 2" es a las 2 de la tarde: el taller no abre
  // a las 2 de la madrugada.
  if (!sufijo && h >= 1 && h <= 6) h += 12;

  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Las horas todavía libres de un día. */
async function horasLibres(fechaISO) {
  const { data } = await supabase
    .from("citas_taller")
    .select("hora")
    .eq("fecha", fechaISO)
    .in("estado", ["PENDIENTE", "CONFIRMADA"]);

  const conteo = {};
  for (const c of data || []) {
    const h = String(c.hora || "").slice(0, 5);
    conteo[h] = (conteo[h] || 0) + 1;
  }

  const [a, m, d] = fechaISO.split("-").map(Number);
  const diaSemana = new Date(a, m - 1, d).getDay();
  const delDia = diaSemana === 6 ? HORAS.filter((h) => h < "12:00") : HORAS;

  // Para hoy, no ofrecer horas que ya pasaron ni la que empieza en 30 minutos.
  const hoy = hoyLocal();
  const esHoy = fechaISO === aISO(hoy);
  const minimoHoy = esHoy
    ? `${String(hoy.getUTCHours()).padStart(2, "0")}:${String(hoy.getUTCMinutes()).padStart(2, "0")}`
    : "00:00";

  return delDia.filter((h) => (conteo[h] || 0) < CUPO_POR_HORA && h > minimoHoy);
}

// ─────────────────────────────────────────────────────────────────────────────
// Teclados
// ─────────────────────────────────────────────────────────────────────────────

const teclado = (filas) => ({
  reply_markup: JSON.stringify({
    keyboard: filas.map((f) => f.map((t) => ({ text: t }))),
    resize_keyboard: true,
    one_time_keyboard: true,
  }),
});

/** Quita el teclado para que el cliente pueda escribir libremente. */
const sinTeclado = { reply_markup: JSON.stringify({ remove_keyboard: true }) };

const MENU_PRINCIPAL = {
  reply_markup: JSON.stringify({
    keyboard: [
      [{ text: "🚗 Mi Vehículo" }, { text: "📅 Agendar Cita" }],
      [{ text: "🔩 Repuestos" }, { text: "☕ Menú" }],
      [{ text: "🛠️ Servicios" }, { text: "📞 Contacto" }],
      [{ text: "💬 Hablar con asesor" }],
    ],
    resize_keyboard: true,
  }),
};

/** Agrupa una lista en filas de N para que el teclado no quede como una torre. */
const enFilas = (items, porFila = 3) => {
  const filas = [];
  for (let i = 0; i < items.length; i += porFila) filas.push(items.slice(i, i + porFila));
  return filas;
};

// ─────────────────────────────────────────────────────────────────────────────
// El flujo
// ─────────────────────────────────────────────────────────────────────────────

/** Normaliza una placa igual que lo hace el resto del sistema. */
const normalizarPlaca = (p) => String(p || "").toUpperCase().replace(/[\s\-_]/g, "");

/**
 * Arranca el flujo de cita. Lo llama el webhook cuando el cliente toca
 * "📅 Agendar Cita" o escribe algo con intención de agendar.
 */
export async function iniciarFlujoCita(chatId, nombre, tgSend) {
  await guardarEstado(chatId, "placa", { nombre_telegram: nombre || "" });
  await tgSend(chatId,
    `📅 <b>Vamos a agendar tu cita</b>\n\n` +
    `Te hago 4 preguntas rápidas y queda registrada en el taller. ` +
    `Puedes escribir <code>/cancelar</code> en cualquier momento.\n\n` +
    `<b>1 de 4 — ¿Cuál es la placa de tu vehículo?</b>\n` +
    `Ejemplo: <code>A123456</code>\n\n` +
    `Si prefieres no darla, toca <b>No la tengo a mano</b>.`,
    teclado([["No la tengo a mano"], ["❌ Cancelar"]])
  );
  return true;
}

/**
 * Procesa un mensaje dentro del flujo.
 *
 * @returns {Promise<boolean>} true si el mensaje fue consumido por el flujo.
 *          El webhook debe cortar ahí y NO pasarlo a la IA ni al buscador de
 *          placas: durante la conversación, "A123456" es una respuesta, no una
 *          consulta de estado.
 */
export async function manejarMensajeCita(chatId, texto, nombre, tgSend) {
  const estado = await leerEstado(chatId);
  if (!estado) return false;

  const t = String(texto || "").trim();
  const tl = t.toLowerCase();

  // ── Cancelar ──
  if (/^\/cancelar$/i.test(t) || /^❌?\s*cancelar$/i.test(t) || /^(salir|olv[ií]dalo|d[ée]jalo)$/i.test(tl)) {
    await borrarEstado(chatId);
    await tgSend(chatId, "Listo, cancelé el agendamiento. Aquí estoy si necesitas algo más. 😊", MENU_PRINCIPAL);
    return true;
  }

  // Un comando durante la conversación significa que el cliente quiere otra
  // cosa. Se suelta el flujo en vez de tratarlo como respuesta.
  if (/^\/(start|ayuda|menu|debug)/i.test(t)) {
    await borrarEstado(chatId);
    return false;
  }

  const { paso, datos } = estado;

  switch (paso) {
    // ── 1. Placa ────────────────────────────────────────────────────────────
    case "placa": {
      if (/no la tengo|no tengo|no s[eé]|omitir|saltar/i.test(tl)) {
        await guardarEstado(chatId, "nombre", { ...datos, placa: null });
        await tgSend(chatId,
          `Sin problema.\n\n<b>2 de 4 — ¿A nombre de quién registro la cita?</b>`,
          sinTeclado
        );
        return true;
      }

      const placa = normalizarPlaca(t);
      if (!/^[A-Z]{0,2}\d{3,7}$/.test(placa)) {
        await tgSend(chatId,
          `Esa no parece una placa. Escríbela sin guiones ni espacios, por ejemplo <code>A123456</code>.\n\n` +
          `O toca <b>No la tengo a mano</b> para seguir sin ella.`,
          teclado([["No la tengo a mano"], ["❌ Cancelar"]])
        );
        return true;
      }

      // ¿Está registrada? Si sí, la cita queda atada a su ficha.
      const { data: vehiculos } = await supabase
        .from("vehiculos")
        .select("id, cliente_id, marca, modelo, placa, activo")
        .not("placa", "is", null);

      const veh = (vehiculos || []).find(
        (v) => normalizarPlaca(v.placa) === placa && v.activo !== false
      );

      if (veh) {
        const { data: cli } = await supabase
          .from("clientes").select("id, nombre, email, telefono")
          .eq("id", veh.cliente_id).maybeSingle();

        const nuevos = {
          ...datos,
          placa,
          vehiculo_id: veh.id,
          cliente_id: veh.cliente_id || null,
          nombre: cli?.nombre || datos.nombre_telegram || "",
          email: cli?.email || null,
          telefono: cli?.telefono || null,
          modelo: [veh.marca, veh.modelo].filter(Boolean).join(" "),
        };
        await guardarEstado(chatId, "fecha", nuevos);
        await preguntarFecha(chatId, tgSend,
          `✅ Te encontré: <b>${nuevos.modelo || "tu vehículo"}</b> (${veh.placa})` +
          (cli?.nombre ? ` a nombre de <b>${cli.nombre}</b>` : "") + ".\n\n"
        );
        return true;
      }

      // Placa no registrada: se piden los datos mínimos.
      await guardarEstado(chatId, "nombre", { ...datos, placa });
      await tgSend(chatId,
        `Anoté la placa <b>${placa}</b>. Todavía no está registrada en el sistema, así que necesito un par de datos.\n\n` +
        `<b>2 de 4 — ¿Cuál es tu nombre?</b>`,
        sinTeclado
      );
      return true;
    }

    // ── 2a. Nombre ──────────────────────────────────────────────────────────
    case "nombre": {
      if (t.length < 2 || t.length > 80) {
        await tgSend(chatId, "Escríbeme tu nombre, por favor. 🙂");
        return true;
      }
      await guardarEstado(chatId, "telefono", { ...datos, nombre: t });
      await tgSend(chatId,
        `Gracias, <b>${t.split(" ")[0]}</b>.\n\n` +
        `<b>¿A qué número te llamamos para confirmar?</b>\n` +
        `Ejemplo: <code>809-555-1234</code>`,
        teclado([["Prefiero que me escriban por aquí"], ["❌ Cancelar"]])
      );
      return true;
    }

    // ── 2b. Teléfono ────────────────────────────────────────────────────────
    case "telefono": {
      let telefono = null;
      if (!/prefiero|por aqu[ií]|telegram|omitir|saltar|no/i.test(tl)) {
        const digitos = t.replace(/\D/g, "");
        if (digitos.length < 10) {
          await tgSend(chatId,
            "Ese número parece incompleto. Escríbelo con el código de área, por ejemplo <code>809-555-1234</code>.",
            teclado([["Prefiero que me escriban por aquí"], ["❌ Cancelar"]])
          );
          return true;
        }
        telefono = digitos;
      }
      await guardarEstado(chatId, "fecha", { ...datos, telefono });
      await preguntarFecha(chatId, tgSend);
      return true;
    }

    // ── 3. Fecha ────────────────────────────────────────────────────────────
    case "fecha": {
      const fecha = interpretarFecha(t);
      if (!fecha) {
        await tgSend(chatId,
          `No entendí la fecha. Puedes escribirla así: <code>5/8</code>, o tocar uno de los botones.`,
          tecladoFechas()
        );
        return true;
      }

      const hoy = aISO(hoyLocal());
      if (fecha < hoy) {
        await tgSend(chatId, "Esa fecha ya pasó 🙂. Dime otra, por favor.", tecladoFechas());
        return true;
      }

      const [a, m, d] = fecha.split("-").map(Number);
      if (new Date(a, m - 1, d).getDay() === 0) {
        await tgSend(chatId,
          "Los domingos no tomamos citas de taller. Elige otro día, por favor.",
          tecladoFechas()
        );
        return true;
      }

      const libres = await horasLibres(fecha);
      if (!libres.length) {
        await tgSend(chatId,
          `😕 Para el <b>${fechaLarga(fecha)}</b> ya no quedan turnos disponibles.\n\n` +
          `Elige otro día, por favor.`,
          tecladoFechas()
        );
        return true;
      }

      await guardarEstado(chatId, "hora", { ...datos, fecha });
      await tgSend(chatId,
        `📅 <b>${fechaLarga(fecha)}</b>, perfecto.\n\n` +
        `<b>4 de 4 — ¿A qué hora te queda bien?</b>\n` +
        `Estas son las horas disponibles:`,
        teclado([...enFilas(libres.map(hora12), 3), ["❌ Cancelar"]])
      );
      return true;
    }

    // ── 4. Hora ─────────────────────────────────────────────────────────────
    case "hora": {
      const hora = interpretarHora(t);
      const libres = await horasLibres(datos.fecha);

      if (!hora || !libres.includes(hora)) {
        await tgSend(chatId,
          `Esa hora no está disponible. Toca una de estas, por favor:`,
          teclado([...enFilas(libres.map(hora12), 3), ["❌ Cancelar"]])
        );
        return true;
      }

      await guardarEstado(chatId, "motivo", { ...datos, hora });
      await tgSend(chatId,
        `🕐 <b>${hora12(hora)}</b>, anotado.\n\n` +
        `<b>¿Qué necesita el vehículo?</b>\n` +
        `Toca una opción o escríbelo con tus palabras.`,
        teclado([...enFilas(SERVICIOS, 2), ["❌ Cancelar"]])
      );
      return true;
    }

    // ── 5. Motivo ───────────────────────────────────────────────────────────
    case "motivo": {
      if (t.length < 3) {
        await tgSend(chatId, "Cuéntame brevemente qué necesita el vehículo.");
        return true;
      }
      const nuevos = {
        ...datos,
        motivo: t.slice(0, 400),
        tipo: TIPO_POR_SERVICIO[tl] || "OTRO",
      };
      await guardarEstado(chatId, "confirmar", nuevos);
      await tgSend(chatId,
        `📋 <b>Revisa que todo esté bien:</b>\n\n` +
        `👤 ${nuevos.nombre || "—"}\n` +
        `🚗 ${nuevos.modelo || "—"}${nuevos.placa ? ` (${nuevos.placa})` : ""}\n` +
        `📅 ${fechaLarga(nuevos.fecha)}\n` +
        `🕐 ${hora12(nuevos.hora)}\n` +
        `🔧 ${nuevos.motivo}\n\n` +
        `¿Confirmo la cita?`,
        teclado([["✅ Sí, confirmar", "❌ Cancelar"]])
      );
      return true;
    }

    // ── 6. Confirmación ─────────────────────────────────────────────────────
    case "confirmar": {
      // Volver a un paso concreto sin repetir todo el cuestionario. Es lo que
      // evita que corregir una hora mal elegida cueste cuatro preguntas.
      if (/fecha|d[ií]a/i.test(tl)) {
        await guardarEstado(chatId, "fecha", datos);
        await preguntarFecha(chatId, tgSend);
        return true;
      }
      if (/hora/i.test(tl)) {
        await guardarEstado(chatId, "hora", datos);
        const libres = await horasLibres(datos.fecha);
        await tgSend(chatId, "¿A qué hora entonces?",
          teclado([...enFilas(libres.map(hora12), 3), ["❌ Cancelar"]]));
        return true;
      }
      if (/motivo|servicio/i.test(tl)) {
        await guardarEstado(chatId, "motivo", datos);
        await tgSend(chatId, "¿Qué necesita el vehículo?",
          teclado([...enFilas(SERVICIOS, 2), ["❌ Cancelar"]]));
        return true;
      }

      if (!/^(✅\s*)?(s[ií]|si,?\s*confirmar|confirmar|correcto|dale|ok|est[áa]\s*bien)/i.test(tl)) {
        await tgSend(chatId,
          `No te entendí. ¿Confirmo la cita o quieres corregir algo?`,
          teclado([["✅ Sí, confirmar"], ["📅 La fecha", "🕐 La hora"], ["🔧 El motivo"], ["❌ Cancelar"]])
        );
        return true;
      }

      // ── Guardar ──
      // Se revalida el cupo aquí y no solo al elegir la hora: entre una cosa y
      // la otra pudo entrar otra cita por la web y llenar el turno.
      const libres = await horasLibres(datos.fecha);
      if (!libres.includes(datos.hora)) {
        await guardarEstado(chatId, "hora", datos);
        await tgSend(chatId,
          `😕 Alguien tomó ese turno mientras confirmábamos. Elige otra hora, por favor:`,
          teclado([...enFilas(libres.map(hora12), 3), ["❌ Cancelar"]])
        );
        return true;
      }

      const fila = {
        cliente_id:        datos.cliente_id || null,
        vehiculo_id:       datos.vehiculo_id || null,
        fecha:             datos.fecha,
        hora:              datos.hora,
        tipo_servicio:     datos.tipo || "OTRO",
        descripcion:       datos.motivo,
        origen:            "TELEGRAM",
        estado:            "PENDIENTE",
        nombre_contacto:   datos.nombre || datos.nombre_telegram || null,
        email_contacto:    datos.email || null,
        telefono_contacto: datos.telefono || null,
        placa_texto:       datos.placa || null,
        modelo_texto:      datos.modelo || null,
        telegram_chat_id:  String(chatId),
      };

      const { data: cita, error } = await supabase
        .from("citas_taller").insert([fila]).select().single();

      if (error) {
        console.warn("[tg-citas] no se pudo guardar:", error.message);
        await borrarEstado(chatId);
        await tgSend(chatId,
          `😕 No pude guardar la cita por un problema técnico.\n\n` +
          `Llámanos al <b>${TEL_TALLER}</b> y te la agendamos al momento.`,
          MENU_PRINCIPAL
        );
        return true;
      }

      await borrarEstado(chatId);

      await tgSend(chatId,
        `✅ <b>¡Cita registrada!</b>\n\n` +
        `📅 ${fechaLarga(cita.fecha)}\n` +
        `🕐 ${hora12(cita.hora)}\n` +
        `🚗 ${datos.modelo || "—"}${datos.placa ? ` (${datos.placa})` : ""}\n` +
        `🔧 ${cita.descripcion}\n` +
        `🔖 Referencia: <b>#${cita.id}</b>\n\n` +
        `Está <b>pendiente de confirmación</b>. Te aviso por aquí mismo en cuanto el taller la confirme.\n\n` +
        `⏰ También te recuerdo el día anterior y una hora antes.\n\n` +
        `📍 Sólido Auto Servicio · 📞 ${TEL_TALLER}` +
        (datos.cliente_id ? `\n\n🔔 Puedes seguir tu vehículo en la app: ${URL_APP}` : ""),
        MENU_PRINCIPAL
      );

      // Correo al cliente (si lo tenemos), push si tiene la app, y aviso al taller.
      notificarCita(cita.id, "AGENDADA").catch(() => {});
      avisarTallerNuevaCita(cita).catch(() => {});

      if (datos.cliente_id) {
        supabase.from("cliente_interacciones").insert([{
          cliente_id: datos.cliente_id,
          vehiculo_id: datos.vehiculo_id || null,
          tipo: "SISTEMA",
          descripcion: `Cita agendada por Telegram para ${cita.fecha} ${cita.hora} — ${cita.descripcion}`,
          referencia: `cita:${cita.id}`,
          usuario_nombre: "Cliente (Telegram)",
        }]).then(() => {}, () => {});
      }

      return true;
    }

    default:
      await borrarEstado(chatId);
      return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function tecladoFechas() {
  const hoy = hoyLocal();
  const opciones = [];
  // Los próximos 6 días hábiles, escritos como los diría una persona.
  for (let i = 0; i < 8 && opciones.length < 6; i++) {
    const d = new Date(hoy.getTime() + (i + 1) * 86400_000);
    if (d.getUTCDay() === 0) continue;
    const iso = aISO(d);
    opciones.push(i === 0 ? "Mañana" : fechaLarga(iso));
  }
  return teclado([...enFilas(opciones, 2), ["❌ Cancelar"]]);
}

async function preguntarFecha(chatId, tgSend, prefijo = "") {
  await tgSend(chatId,
    `${prefijo}<b>3 de 4 — ¿Qué día quieres venir?</b>\n` +
    `Toca una opción o escribe la fecha (ejemplo: <code>5/8</code>).`,
    tecladoFechas()
  );
}
