// crm-backend/routes/seguridad.mjs
// Módulo de Seguridad y Altavoz — Sólido Auto Servicio
//
// Dos áreas que hasta ahora vivían fuera del sistema:
//
//   SEGURIDAD  Inventario de cámaras y zonas de alarma, estado de la alarma y
//              bitácora de todo lo que pasa. Las cámaras aún no están
//              instaladas: el módulo arranca como plano de instalación y el
//              campo `url_stream` queda listo para el día que se conecte el
//              DVR, sin necesidad de otra migración.
//
//   ALTAVOZ    Llamar técnicos por bocina sin comprar equipo de audio en red.
//              El anuncio entra a una cola en base de datos y una PC del
//              taller con /altavoz/receptor abierto lo locuta con la voz del
//              navegador. Cola y no websocket a propósito: si esa PC se
//              reinicia, al volver locuta lo pendiente en vez de perderlo.
//
// Requiere: sql/migracion_v31_seguridad_altavoz.sql
//
// Montaje en server.mjs:
//     import seguridad from "./routes/seguridad.mjs";
//     app.use("/seguridad", seguridad);

import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

/** Express 4 no captura rechazos de async: sin esto la petición queda colgada. */
const ruta = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const fallo = (res, status, mensaje, extra = {}) =>
  res.status(status).json({ error: true, mensaje, ...extra });

/** Quién hace la acción. El frontend lo manda en el cuerpo o en `x-usuario`. */
function usuarioDe(req) {
  let cab = null;
  try {
    cab = req.headers["x-usuario"] ? JSON.parse(req.headers["x-usuario"]) : null;
  } catch { /* cabecera malformada: se ignora */ }
  return {
    id: req.body?.usuario_id ?? cab?.id ?? null,
    nombre: req.body?.usuario_nombre ?? cab?.nombre ?? cab?.name ?? "Sistema",
  };
}

/**
 * Registra en la bitácora.
 *
 * Nunca lanza: un fallo al escribir el log no debe impedir que la alarma se
 * arme. Se reporta por consola y la operación sigue.
 */
async function registrarEvento({ tipo, descripcion, severidad = "info", camara_codigo = null, zona_codigo = null, usuario = null }) {
  try {
    await supabase.from("seguridad_eventos").insert([{
      tipo, descripcion, severidad, camara_codigo, zona_codigo,
      usuario_id: usuario?.id ?? null,
      usuario_nombre: usuario?.nombre ?? "Sistema",
    }]);
  } catch (e) {
    console.error("[seguridad] no se pudo registrar el evento:", e.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CÁMARAS
// ═════════════════════════════════════════════════════════════════════════════

/** GET /seguridad/camaras — inventario completo. */
router.get("/camaras", ruta(async (req, res) => {
  const { data, error } = await supabase
    .from("seguridad_camaras").select("*")
    .eq("activo", true)
    .order("codigo");
  if (error) return fallo(res, 500, error.message);

  const camaras = data || [];
  res.json({
    error: false,
    camaras,
    resumen: {
      total:        camaras.length,
      planificadas: camaras.filter(c => c.estado === "PLANIFICADA").length,
      instaladas:   camaras.filter(c => ["INSTALADA", "EN_LINEA", "FUERA_DE_LINEA"].includes(c.estado)).length,
      en_linea:     camaras.filter(c => c.estado === "EN_LINEA").length,
      fuera_linea:  camaras.filter(c => c.estado === "FUERA_DE_LINEA").length,
      // Sirve para presupuestar lo que falta por instalar.
      costo_pendiente: camaras
        .filter(c => c.estado === "PLANIFICADA")
        .reduce((s, c) => s + Number(c.costo_estimado || 0), 0),
    },
  });
}));

/** POST /seguridad/camaras — alta. */
router.post("/camaras", ruta(async (req, res) => {
  const usuario = usuarioDe(req);
  const { usuario_id, usuario_nombre, ...campos } = req.body || {};

  if (!campos.codigo || !campos.nombre || !campos.ubicacion) {
    return fallo(res, 400, "Código, nombre y ubicación son obligatorios.");
  }

  const { data, error } = await supabase
    .from("seguridad_camaras").insert([campos]).select().maybeSingle();
  if (error) return fallo(res, 500, error.message);

  await registrarEvento({
    tipo: "MANTENIMIENTO",
    descripcion: `Cámara ${data.codigo} (${data.nombre}) agregada al inventario en ${data.ubicacion}.`,
    camara_codigo: data.codigo, usuario,
  });

  res.json({ error: false, camara: data });
}));

/** PATCH /seguridad/camaras/:id — edición. Deja rastro si cambia el estado. */
router.patch("/camaras/:id", ruta(async (req, res) => {
  const usuario = usuarioDe(req);
  const { usuario_id, usuario_nombre, ...campos } = req.body || {};

  const { data: antes } = await supabase
    .from("seguridad_camaras").select("codigo, nombre, estado").eq("id", req.params.id).maybeSingle();
  if (!antes) return fallo(res, 404, "Cámara no encontrada.");

  campos.updated_at = new Date();
  const { data, error } = await supabase
    .from("seguridad_camaras").update(campos).eq("id", req.params.id).select().maybeSingle();
  if (error) return fallo(res, 500, error.message);

  // Solo se registra el cambio de estado. Corregir una falta de ortografía en
  // el nombre no es un evento de seguridad y llenaría la bitácora de ruido.
  if (campos.estado && campos.estado !== antes.estado) {
    const critico = campos.estado === "FUERA_DE_LINEA";
    await registrarEvento({
      tipo: critico ? "CAMARA_OFFLINE" : campos.estado === "EN_LINEA" ? "CAMARA_ONLINE" : "MANTENIMIENTO",
      severidad: critico ? "aviso" : "info",
      descripcion: `Cámara ${antes.codigo} (${antes.nombre}): ${antes.estado} → ${campos.estado}.`,
      camara_codigo: antes.codigo, usuario,
    });
  }

  res.json({ error: false, camara: data });
}));

/** DELETE /seguridad/camaras/:id — baja lógica, no borrado. */
router.delete("/camaras/:id", ruta(async (req, res) => {
  const usuario = usuarioDe(req);
  const { data, error } = await supabase
    .from("seguridad_camaras")
    .update({ activo: false, estado: "RETIRADA", updated_at: new Date() })
    .eq("id", req.params.id).select().maybeSingle();
  if (error) return fallo(res, 500, error.message);
  if (!data) return fallo(res, 404, "Cámara no encontrada.");

  await registrarEvento({
    tipo: "MANTENIMIENTO", severidad: "aviso",
    descripcion: `Cámara ${data.codigo} (${data.nombre}) retirada del inventario.`,
    camara_codigo: data.codigo, usuario,
  });

  res.json({ error: false, camara: data });
}));

// ═════════════════════════════════════════════════════════════════════════════
// ZONAS DE ALARMA
// ═════════════════════════════════════════════════════════════════════════════

router.get("/zonas", ruta(async (req, res) => {
  const { data, error } = await supabase
    .from("seguridad_zonas").select("*").eq("activo", true).order("codigo");
  if (error) return fallo(res, 500, error.message);

  const zonas = data || [];
  res.json({
    error: false,
    zonas,
    resumen: {
      total:      zonas.length,
      ok:         zonas.filter(z => z.estado === "OK").length,
      abiertas:   zonas.filter(z => z.estado === "ABIERTA").length,
      con_falla:  zonas.filter(z => z.estado === "FALLA").length,
      anuladas:   zonas.filter(z => z.estado === "ANULADA").length,
      pendientes: zonas.filter(z => z.estado === "PLANIFICADA").length,
    },
  });
}));

router.post("/zonas", ruta(async (req, res) => {
  const usuario = usuarioDe(req);
  const { usuario_id, usuario_nombre, ...campos } = req.body || {};
  if (!campos.codigo || !campos.nombre) return fallo(res, 400, "Código y nombre son obligatorios.");

  const { data, error } = await supabase
    .from("seguridad_zonas").insert([campos]).select().maybeSingle();
  if (error) return fallo(res, 500, error.message);

  await registrarEvento({
    tipo: "MANTENIMIENTO",
    descripcion: `Zona ${data.codigo} (${data.nombre}) agregada.`,
    zona_codigo: data.codigo, usuario,
  });
  res.json({ error: false, zona: data });
}));

router.patch("/zonas/:id", ruta(async (req, res) => {
  const usuario = usuarioDe(req);
  const { usuario_id, usuario_nombre, ...campos } = req.body || {};

  const { data: antes } = await supabase
    .from("seguridad_zonas").select("codigo, nombre, estado").eq("id", req.params.id).maybeSingle();
  if (!antes) return fallo(res, 404, "Zona no encontrada.");

  campos.updated_at = new Date();
  const { data, error } = await supabase
    .from("seguridad_zonas").update(campos).eq("id", req.params.id).select().maybeSingle();
  if (error) return fallo(res, 500, error.message);

  if (campos.estado && campos.estado !== antes.estado) {
    await registrarEvento({
      tipo: campos.estado === "ABIERTA" ? "ZONA_ABIERTA" : "MANTENIMIENTO",
      severidad: campos.estado === "ABIERTA" ? "aviso" : campos.estado === "FALLA" ? "aviso" : "info",
      descripcion: `Zona ${antes.codigo} (${antes.nombre}): ${antes.estado} → ${campos.estado}.`,
      zona_codigo: antes.codigo, usuario,
    });
  }
  res.json({ error: false, zona: data });
}));

// ═════════════════════════════════════════════════════════════════════════════
// ALARMA — estado y armado
// ═════════════════════════════════════════════════════════════════════════════

const CLAVE_ALARMA = "seguridad_alarma";

async function leerAlarma() {
  const { data } = await supabase
    .from("config_sistema").select("valor").eq("clave", CLAVE_ALARMA).maybeSingle();
  return data?.valor || { armada: false, modo: "DESARMADA", por: null, desde: null };
}

router.get("/alarma", ruta(async (req, res) => {
  res.json({ error: false, alarma: await leerAlarma() });
}));

/**
 * POST /seguridad/alarma   { modo: "TOTAL" | "PERIMETRAL" | "DESARMADA" }
 *
 * TOTAL       todo armado (noche, taller cerrado)
 * PERIMETRAL  solo accesos: se trabaja adentro con el almacén protegido
 * DESARMADA   jornada normal
 *
 * No se puede armar con una zona abierta: armar con el portón abierto deja la
 * alarma en un estado que suena sola a los cinco minutos y termina en que
 * alguien la desconecta del todo.
 */
router.post("/alarma", ruta(async (req, res) => {
  const usuario = usuarioDe(req);
  const modo = String(req.body?.modo || "").toUpperCase();
  const forzar = req.body?.forzar === true;

  if (!["TOTAL", "PERIMETRAL", "DESARMADA"].includes(modo)) {
    return fallo(res, 400, "Modo inválido. Usa TOTAL, PERIMETRAL o DESARMADA.");
  }

  if (modo !== "DESARMADA" && !forzar) {
    const { data: zonas } = await supabase
      .from("seguridad_zonas").select("codigo, nombre, estado")
      .eq("activo", true).in("estado", ["ABIERTA", "FALLA"]);
    if (zonas && zonas.length > 0) {
      return fallo(res, 409, "Hay zonas abiertas o con falla. Ciérralas o arma forzando.", {
        zonas_pendientes: zonas,
        requiere: "forzar",
      });
    }
  }

  const armada = modo !== "DESARMADA";
  const valor = {
    armada, modo,
    por: usuario.nombre,
    desde: new Date().toISOString(),
    forzada: armada && forzar,
  };

  const { error } = await supabase
    .from("config_sistema")
    .upsert({ clave: CLAVE_ALARMA, valor, updated_at: new Date() }, { onConflict: "clave" });
  if (error) return fallo(res, 500, error.message);

  await registrarEvento({
    tipo: armada ? "ARMADO" : "DESARMADO",
    severidad: forzar ? "aviso" : "info",
    descripcion: armada
      ? `Alarma armada en modo ${modo}${forzar ? " (forzada, con zonas abiertas)" : ""}.`
      : "Alarma desarmada.",
    usuario,
  });

  res.json({ error: false, alarma: valor });
}));

// ═════════════════════════════════════════════════════════════════════════════
// BITÁCORA
// ═════════════════════════════════════════════════════════════════════════════

router.get("/eventos", ruta(async (req, res) => {
  const limite = Math.min(Number(req.query.limit) || 50, 200);
  let q = supabase.from("seguridad_eventos").select("*")
    .order("created_at", { ascending: false }).limit(limite);

  if (req.query.tipo)      q = q.eq("tipo", req.query.tipo);
  if (req.query.severidad) q = q.eq("severidad", req.query.severidad);
  if (req.query.desde)     q = q.gte("created_at", req.query.desde);
  if (req.query.hasta)     q = q.lte("created_at", req.query.hasta + "T23:59:59");

  const { data, error } = await q;
  if (error) return fallo(res, 500, error.message);
  res.json({ error: false, eventos: data || [] });
}));

/** POST /seguridad/eventos — nota manual del personal. */
router.post("/eventos", ruta(async (req, res) => {
  const usuario = usuarioDe(req);
  const descripcion = String(req.body?.descripcion || "").trim();
  if (!descripcion) return fallo(res, 400, "La descripción es obligatoria.");

  await registrarEvento({
    tipo: req.body?.tipo || "NOTA",
    severidad: req.body?.severidad || "info",
    descripcion,
    camara_codigo: req.body?.camara_codigo || null,
    zona_codigo: req.body?.zona_codigo || null,
    usuario,
  });
  res.json({ error: false });
}));

// ═════════════════════════════════════════════════════════════════════════════
// PANORAMA — una sola llamada para la pantalla principal y para el asistente
// ═════════════════════════════════════════════════════════════════════════════

router.get("/resumen", ruta(async (req, res) => {
  const [alarma, cam, zon, ev, pend] = await Promise.all([
    leerAlarma(),
    supabase.from("seguridad_camaras").select("codigo, nombre, ubicacion, estado").eq("activo", true),
    supabase.from("seguridad_zonas").select("codigo, nombre, estado, siempre_activa").eq("activo", true),
    supabase.from("seguridad_eventos").select("*").order("created_at", { ascending: false }).limit(10),
    supabase.from("altavoz_anuncios").select("id").eq("estado", "PENDIENTE"),
  ]);

  const camaras = cam.data || [];
  const zonas   = zon.data || [];

  res.json({
    error: false,
    alarma,
    camaras: {
      total:        camaras.length,
      en_linea:     camaras.filter(c => c.estado === "EN_LINEA").length,
      fuera_linea:  camaras.filter(c => c.estado === "FUERA_DE_LINEA").length,
      planificadas: camaras.filter(c => c.estado === "PLANIFICADA").length,
      // Lista corta de las que necesitan atención — es lo que se quiere saber.
      con_problema: camaras.filter(c => c.estado === "FUERA_DE_LINEA" || c.estado === "EN_REPARACION"),
    },
    zonas: {
      total:     zonas.length,
      abiertas:  zonas.filter(z => z.estado === "ABIERTA"),
      con_falla: zonas.filter(z => z.estado === "FALLA"),
    },
    eventos_recientes: ev.data || [],
    anuncios_pendientes: (pend.data || []).length,
  });
}));

// ═════════════════════════════════════════════════════════════════════════════
// ALTAVOZ
// ═════════════════════════════════════════════════════════════════════════════

router.get("/altavoz/plantillas", ruta(async (req, res) => {
  const { data, error } = await supabase
    .from("altavoz_plantillas").select("*").eq("activo", true).order("orden");
  if (error) return fallo(res, 500, error.message);
  res.json({ error: false, plantillas: data || [] });
}));

/**
 * POST /seguridad/altavoz/anunciar
 *   { mensaje | plantilla_codigo, destinatario, tipo, repeticiones }
 *
 * Encola el anuncio. Quien lo locuta es la PC del taller con el receptor
 * abierto; aquí solo se deja el mensaje listo.
 */
router.post("/altavoz/anunciar", ruta(async (req, res) => {
  const usuario = usuarioDe(req);
  const { plantilla_codigo, destinatario, tipo, repeticiones } = req.body || {};
  let mensaje = String(req.body?.mensaje || "").trim();

  // Si viene una plantilla, se arma el texto sustituyendo {destinatario}.
  if (!mensaje && plantilla_codigo) {
    const { data: pl } = await supabase
      .from("altavoz_plantillas").select("texto, tipo").eq("codigo", plantilla_codigo).maybeSingle();
    if (!pl) return fallo(res, 404, "Plantilla no encontrada.");
    mensaje = pl.texto.replace(/\{destinatario\}/g, destinatario || "Atención al personal");
  }

  if (!mensaje) return fallo(res, 400, "Escribe el mensaje o elige una plantilla.");
  if (mensaje.length > 300) return fallo(res, 400, "El mensaje es muy largo (máximo 300 caracteres).");

  const esEmergencia = String(tipo || "").toUpperCase() === "EMERGENCIA";

  const { data, error } = await supabase.from("altavoz_anuncios").insert([{
    mensaje,
    tipo: (tipo || "LLAMADO").toUpperCase(),
    destinatario: destinatario || null,
    usuario_id: usuario.id,
    usuario_nombre: usuario.nombre,
    repeticiones: Math.min(Math.max(Number(repeticiones) || 2, 1), 5),
    // Una emergencia se salta la cola de los llamados normales.
    prioridad: esEmergencia ? 1 : 5,
  }]).select().maybeSingle();
  if (error) return fallo(res, 500, error.message);

  await registrarEvento({
    tipo: "ANUNCIO",
    severidad: esEmergencia ? "critico" : "info",
    descripcion: `Anuncio por altavoz${destinatario ? ` a ${destinatario}` : ""}: "${mensaje}"`,
    usuario,
  });

  // Si nadie tiene el receptor abierto, el anuncio se queda en cola. Se avisa
  // aquí para que quien llama no asuma que el técnico ya fue notificado.
  const hace2min = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: vivo } = await supabase
    .from("altavoz_anuncios").select("id")
    .eq("estado", "REPRODUCIDO").gte("reproducido_at", hace2min).limit(1);

  res.json({
    error: false,
    anuncio: data,
    receptor_activo: (vivo || []).length > 0,
    aviso: (vivo || []).length > 0
      ? null
      : "No se ha detectado un receptor activo en los últimos 2 minutos. Verifica que la PC del taller tenga abierta la pantalla de altavoz.",
  });
}));

/**
 * GET /seguridad/altavoz/cola
 * Lo consulta el receptor cada pocos segundos. Devuelve lo pendiente en orden
 * de prioridad.
 */
router.get("/altavoz/cola", ruta(async (req, res) => {
  const { data, error } = await supabase
    .from("altavoz_anuncios").select("*")
    .eq("estado", "PENDIENTE")
    .order("prioridad", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(10);
  if (error) return fallo(res, 500, error.message);
  res.json({ error: false, anuncios: data || [] });
}));

/** POST /seguridad/altavoz/:id/reproducido — el receptor confirma que sonó. */
router.post("/altavoz/:id/reproducido", ruta(async (req, res) => {
  const { data, error } = await supabase
    .from("altavoz_anuncios")
    .update({
      estado: "REPRODUCIDO",
      reproducido_at: new Date(),
      reproducido_por: req.body?.receptor || "PC taller",
    })
    .eq("id", req.params.id)
    .eq("estado", "PENDIENTE")   // evita que dos receptores lo marquen dos veces
    .select().maybeSingle();
  if (error) return fallo(res, 500, error.message);
  res.json({ error: false, anuncio: data || null });
}));

/** POST /seguridad/altavoz/:id/cancelar */
router.post("/altavoz/:id/cancelar", ruta(async (req, res) => {
  const { data, error } = await supabase
    .from("altavoz_anuncios").update({ estado: "CANCELADO" })
    .eq("id", req.params.id).eq("estado", "PENDIENTE").select().maybeSingle();
  if (error) return fallo(res, 500, error.message);
  res.json({ error: false, anuncio: data || null });
}));

/** GET /seguridad/altavoz/historial */
router.get("/altavoz/historial", ruta(async (req, res) => {
  const limite = Math.min(Number(req.query.limit) || 30, 100);
  const { data, error } = await supabase
    .from("altavoz_anuncios").select("*")
    .order("created_at", { ascending: false }).limit(limite);
  if (error) return fallo(res, 500, error.message);
  res.json({ error: false, anuncios: data || [] });
}));

export default router;
