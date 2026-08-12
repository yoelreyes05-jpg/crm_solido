// crm-backend/routes/portalCliente.mjs
// Portal del cliente — acceso identificado y datos acotados a UN vehículo.
//
// Reemplaza el patrón actual de /cliente, que descarga /vehiculos + /ordenes +
// /diagnosticos completos al navegador y filtra por placa en el cliente
// (punto #3 de MEJORAS_CRM_Y_APP_CLIENTE.md — exposición de toda la base).
//
// Aquí el backend nunca devuelve datos de un vehículo que no sea el de la
// sesión. Aunque alguien manipule el request, el filtro está del lado servidor.
//
// Montaje en server.mjs:
//     import portalCliente from "./routes/portalCliente.mjs";
//     app.set("trust proxy", 1);          // Railway: sin esto todas las IPs son la misma
//     app.use("/portal", portalCliente);
//
// ESM porque el backend es "type": "module". (Ojo: routes/facturacion.js está
// en CommonJS y por eso no está montado — ese archivo hay que convertirlo.)

import express from "express";
import { createClient } from "@supabase/supabase-js";
import {
  emitirToken, verificarToken, hashToken,
  generarCodigo, hashCodigo, verificarCodigo,
  ultimosDigitos, normalizarPlaca,
  enmascararCorreo, enmascararTelefono,
} from "../services/tokenPortal.mjs";
import {
  enviarCodigoPorCorreo, hayCanalDeCorreo, hayCanalDeWhatsApp,
} from "../services/enviarCodigo.mjs";
import { clavePublicaVapid, suscripcionValida, enviarPush, hayPush } from "../services/webPush.mjs";
import { notificarCita, avisarTallerNuevaCita } from "../services/notificarCita.mjs";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const OTP_MINUTOS       = 10;
const SESION_DIAS       = 30;
const LIMITE_POR_IP     = 20;   // intentos fallidos por hora
// La pista solo revela 2 dígitos, así que a un extraño le quedan 100
// combinaciones posibles. Con 5 intentos por hora necesitaría ~20 horas de
// ataque sostenido contra una sola placa, y el límite por IP lo corta antes.
const LIMITE_POR_PLACA  = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────────────────

const ipDe = (req) =>
  (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
  req.ip ||
  req.socket?.remoteAddress ||
  "desconocida";

/** Respuesta de error con status HTTP real (punto #10 del análisis). */
const fallo = (res, status, mensaje, extra = {}) =>
  res.status(status).json({ error: true, mensaje, ...extra });

/**
 * Envoltorio para handlers async.
 *
 * Express 4 NO captura rechazos de promesas: si un handler `async` lanza, la
 * petición se queda colgada sin respuesta y el navegador lo reporta como
 * "sin conexión" — aunque el servidor esté perfectamente vivo. Peor: en Node
 * 15+ una promesa rechazada sin manejar tumba el proceso.
 *
 * Todo handler de este router va envuelto aquí.
 */
const ruta = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

async function registrarIntento(identificador, ip, accion, exito) {
  // No bloqueamos la respuesta por la bitácora.
  supabase
    .from("portal_intentos")
    .insert({ identificador: String(identificador), ip, accion, exito })
    .then(() => {}, () => {});
}

/**
 * Rate limiting doble: por placa/cliente y por IP.
 * Sin esto, la búsqueda por "últimos 4 dígitos" es de 10,000 combinaciones —
 * trivial de romper por fuerza bruta.
 */
async function excedeLimite(identificador, ip) {
  const desde = new Date(Date.now() - 3600_000).toISOString();

  const [porIdent, porIp] = await Promise.all([
    supabase.from("portal_intentos")
      .select("id", { count: "exact", head: true })
      .eq("identificador", String(identificador))
      .eq("exito", false)
      .gte("creado_en", desde),
    supabase.from("portal_intentos")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .eq("exito", false)
      .gte("creado_en", desde),
  ]);

  if ((porIdent.count || 0) >= LIMITE_POR_PLACA) return "placa";
  if ((porIp.count || 0) >= LIMITE_POR_IP) return "ip";
  return null;
}

/** Busca el vehículo por placa junto con su dueño. Devuelve null si no existe. */
async function buscarVehiculoPorPlaca(placaNorm) {
  // La placa en base puede tener guiones/espacios: comparamos normalizado.
  const { data: vehiculos } = await supabase
    .from("vehiculos")
    .select("id, cliente_id, marca, modelo, ano, placa, color, activo")
    .not("placa", "is", null);

  const vehiculo = (vehiculos || []).find(
    (v) => normalizarPlaca(v.placa) === placaNorm && v.activo !== false
  );
  if (!vehiculo) return null;

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nombre, telefono, email, activo")
    .eq("id", vehiculo.cliente_id)
    .maybeSingle();

  return { vehiculo, cliente: cliente || null };
}

/** Crea la sesión en base y devuelve el token firmado. */
async function crearSesion({ cliente_id, vehiculo_id, nivel, req }) {
  const { data: sesion, error } = await supabase
    .from("portal_sesiones")
    .insert({
      cliente_id,
      vehiculo_id,
      token_hash: "pendiente",
      nivel_acceso: nivel,
      user_agent: String(req.headers["user-agent"] || "").slice(0, 400),
      ip: ipDe(req),
      expira_en: new Date(Date.now() + SESION_DIAS * 86400_000).toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    // El error se propaga al manejador del final del router, que distingue
    // "falta correr el SQL" de un fallo real y responde con un status HTTP.
    // Nunca dejar que reviente sin respuesta: el cliente vería "sin conexión".
    const e = new Error(`No se pudo crear la sesión del portal: ${error.message}`);
    e.code = error.code;
    throw e;
  }

  const token = emitirToken(
    { sid: sesion.id, cid: cliente_id, vid: vehiculo_id, nivel },
    SESION_DIAS
  );

  await supabase
    .from("portal_sesiones")
    .update({ token_hash: hashToken(token) })
    .eq("id", sesion.id);

  return token;
}

// ─────────────────────────────────────────────────────────────────────────────
// Middleware de sesión
// ─────────────────────────────────────────────────────────────────────────────

async function requiereSesion(req, res, next) {
  try {
    const cabecera = req.headers.authorization || "";
    const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : null;

    const payload = verificarToken(token);
    if (!payload) return fallo(res, 401, "Sesión inválida o vencida. Vuelve a identificarte.");

    // La firma es válida, pero la sesión puede haber sido revocada desde el CRM.
    const { data: sesion, error } = await supabase
      .from("portal_sesiones")
      .select("id, cliente_id, vehiculo_id, revocado_en, expira_en")
      .eq("id", payload.sid)
      .maybeSingle();

    // Si la consulta falla (tabla inexistente, Supabase caído) hay que
    // distinguirlo de "sesión no encontrada": son problemas muy distintos y
    // decirle al cliente que vuelva a identificarse no arregla el primero.
    if (error) {
      const e = new Error(`No se pudo validar la sesión: ${error.message}`);
      e.code = error.code;
      throw e;
    }

    if (!sesion) return fallo(res, 401, "Sesión no encontrada.");
    if (sesion.revocado_en) return fallo(res, 401, "Sesión revocada. Vuelve a identificarte.");
    if (new Date(sesion.expira_en) < new Date()) return fallo(res, 401, "Sesión vencida.");

    supabase.from("portal_sesiones")
      .update({ ultimo_uso_en: new Date().toISOString() })
      .eq("id", sesion.id)
      .then(() => {}, () => {});

    req.portal = {
      sesionId: sesion.id,
      clienteId: sesion.cliente_id,
      vehiculoId: sesion.vehiculo_id,
      nivel: payload.nivel,
    };
    next();
  } catch (e) {
    // Un middleware async que lanza deja la petición colgada igual que un
    // handler. Se pasa al manejador de errores del router.
    next(e);
  }
}

/**
 * Protege los endpoints que usa la secretaria desde el CRM.
 * Provisional: valida PORTAL_ADMIN_SECRET. Cuando implementes el JWT del CRM
 * (punto #2 del análisis), reemplaza esto por ese middleware.
 */
function requiereAdmin(req, res, next) {
  const secreto = process.env.PORTAL_ADMIN_SECRET || "";
  const enviado = req.headers["x-portal-admin"] || "";
  if (!secreto) return fallo(res, 500, "PORTAL_ADMIN_SECRET no configurada en el servidor.");
  if (enviado !== secreto) return fallo(res, 403, "No autorizado.");
  next();
}

// ═════════════════════════════════════════════════════════════════════════════
// ACCESO — Nivel 1: placa + últimos 4 dígitos del teléfono
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /portal/acceso/placa   { placa }
 * Paso previo: dice QUÉ nivel de verificación aplica a esa placa, sin revelar
 * datos del cliente. Así el frontend muestra la pantalla correcta de una vez.
 */
router.post("/acceso/placa", ruta(async (req, res) => {
  const ip = ipDe(req);
  const placa = normalizarPlaca(req.body?.placa);
  if (placa.length < 4) return fallo(res, 400, "Ingresa una placa válida.");

  const limite = await excedeLimite(placa, ip);
  if (limite) {
    return fallo(res, 429, "Demasiados intentos. Espera una hora o pasa por el taller para que te den un código.");
  }

  const encontrado = await buscarVehiculoPorPlaca(placa);
  if (!encontrado) {
    await registrarIntento(placa, ip, "placa_telefono", false);
    // Mensaje idéntico a "existe pero no verifica" sería ideal, pero aquí el
    // cliente necesita saber que la placa no está registrada para corregirla.
    return fallo(res, 404, "No encontramos un vehículo con esa placa. Verifica los caracteres o pasa por el taller.");
  }

  const { vehiculo, cliente } = encontrado;
  const tieneTelefono = Boolean(ultimosDigitos(cliente?.telefono, 4));
  const tieneCorreo = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cliente?.email || "");

  res.json({
    error: false,
    vehiculo: { marca: vehiculo.marca, modelo: vehiculo.modelo, ano: vehiculo.ano },
    metodos: {
      telefono: tieneTelefono ? { pista: enmascararTelefono(cliente.telefono) } : null,
      correo: tieneCorreo && hayCanalDeCorreo() ? { pista: enmascararCorreo(cliente.email) } : null,
      whatsapp: tieneTelefono && hayCanalDeWhatsApp() ? { pista: enmascararTelefono(cliente.telefono) } : null,
      mostrador: true, // siempre disponible como último recurso
    },
  });
}));

/**
 * POST /portal/acceso/telefono   { placa, ultimos4 }
 * Nivel 1: sin fricción, sin correo, funciona para el cliente que solo dejó
 * su teléfono — que en este CRM es la mayoría.
 */
router.post("/acceso/telefono", ruta(async (req, res) => {
  const ip = ipDe(req);
  const placa = normalizarPlaca(req.body?.placa);
  const ultimos4 = String(req.body?.ultimos4 || "").replace(/\D/g, "");

  if (placa.length < 4) return fallo(res, 400, "Ingresa una placa válida.");
  if (ultimos4.length !== 4) return fallo(res, 400, "Ingresa los últimos 4 dígitos de tu teléfono.");

  const limite = await excedeLimite(placa, ip);
  if (limite) return fallo(res, 429, "Demasiados intentos. Espera una hora o pide un código en el taller.");

  const encontrado = await buscarVehiculoPorPlaca(placa);
  if (!encontrado?.cliente) {
    await registrarIntento(placa, ip, "placa_telefono", false);
    return fallo(res, 404, "No encontramos ese vehículo.");
  }

  const { vehiculo, cliente } = encontrado;
  const esperados = ultimosDigitos(cliente.telefono, 4);

  if (!esperados) {
    await registrarIntento(placa, ip, "placa_telefono", false);
    return fallo(res, 409, "Tu ficha no tiene teléfono registrado. Usa el código por correo o pide uno en el taller.", {
      requiere: "correo_o_mostrador",
    });
  }

  if (esperados !== ultimos4) {
    await registrarIntento(placa, ip, "placa_telefono", false);
    return fallo(res, 401, "Los dígitos no coinciden con el teléfono registrado para ese vehículo.");
  }

  const token = await crearSesion({
    cliente_id: cliente.id, vehiculo_id: vehiculo.id, nivel: "telefono", req,
  });
  await registrarIntento(placa, ip, "placa_telefono", true);

  res.json({
    error: false,
    token,
    cliente: { nombre: cliente.nombre },
    vehiculo: { id: vehiculo.id, placa: vehiculo.placa, marca: vehiculo.marca, modelo: vehiculo.modelo, ano: vehiculo.ano, color: vehiculo.color },
  });
}));

// ═════════════════════════════════════════════════════════════════════════════
// ACCESO — Nivel 2: código de 6 dígitos al correo registrado
// ═════════════════════════════════════════════════════════════════════════════

/** POST /portal/acceso/solicitar-codigo   { placa } */
router.post("/acceso/solicitar-codigo", ruta(async (req, res) => {
  const ip = ipDe(req);
  const placa = normalizarPlaca(req.body?.placa);
  if (placa.length < 4) return fallo(res, 400, "Ingresa una placa válida.");

  const limite = await excedeLimite(placa, ip);
  if (limite) return fallo(res, 429, "Demasiados intentos. Espera una hora.");

  const encontrado = await buscarVehiculoPorPlaca(placa);
  if (!encontrado?.cliente) {
    await registrarIntento(placa, ip, "solicitar_codigo", false);
    return fallo(res, 404, "No encontramos ese vehículo.");
  }

  const { vehiculo, cliente } = encontrado;
  const correo = (cliente.email || "").trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
    await registrarIntento(placa, ip, "solicitar_codigo", false);
    return fallo(res, 409, "Tu ficha no tiene un correo válido registrado. Pide un código en el mostrador.", {
      requiere: "mostrador",
    });
  }

  // Un solo código vigente a la vez: invalidamos los anteriores.
  await supabase
    .from("portal_otp")
    .update({ consumido_en: new Date().toISOString() })
    .eq("cliente_id", cliente.id)
    .is("consumido_en", null);

  const codigo = generarCodigo(6);
  const { salt, hash } = hashCodigo(codigo);

  const { error: errInsert } = await supabase.from("portal_otp").insert({
    cliente_id: cliente.id,
    vehiculo_id: vehiculo.id,
    canal: "correo",
    destino: correo,
    codigo_hash: hash,
    salt,
    expira_en: new Date(Date.now() + OTP_MINUTOS * 60_000).toISOString(),
    ip_solicitud: ip,
  });
  if (errInsert) return fallo(res, 500, "No se pudo generar el código. Intenta de nuevo.");

  try {
    await enviarCodigoPorCorreo({
      para: correo,
      codigo,
      nombre: cliente.nombre,
      vehiculo: `${vehiculo.marca || ""} ${vehiculo.modelo || ""} · ${vehiculo.placa || ""}`.trim(),
      minutos: OTP_MINUTOS,
    });
  } catch (e) {
    console.error("[portal] fallo enviando correo:", e.message);
    return fallo(res, 502, "No pudimos enviar el correo en este momento. Pide un código en el mostrador.", {
      requiere: "mostrador",
    });
  }

  res.json({
    error: false,
    enviado: true,
    destino: enmascararCorreo(correo),
    vence_en_minutos: OTP_MINUTOS,
  });
}));

/** POST /portal/acceso/verificar-codigo   { placa, codigo } */
router.post("/acceso/verificar-codigo", ruta(async (req, res) => {
  const ip = ipDe(req);
  const placa = normalizarPlaca(req.body?.placa);
  const codigo = String(req.body?.codigo || "").replace(/\D/g, "");

  if (codigo.length !== 6) return fallo(res, 400, "El código son 6 dígitos.");

  const limite = await excedeLimite(placa, ip);
  if (limite) return fallo(res, 429, "Demasiados intentos. Espera una hora.");

  const encontrado = await buscarVehiculoPorPlaca(placa);
  if (!encontrado?.cliente) return fallo(res, 404, "No encontramos ese vehículo.");

  const { vehiculo, cliente } = encontrado;

  const { data: otp } = await supabase
    .from("portal_otp")
    .select("*")
    .eq("cliente_id", cliente.id)
    .is("consumido_en", null)
    .gte("expira_en", new Date().toISOString())
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp) {
    await registrarIntento(placa, ip, "verificar_codigo", false);
    return fallo(res, 410, "El código venció o ya fue usado. Pide uno nuevo.");
  }

  if (otp.intentos >= otp.max_intentos) {
    await supabase.from("portal_otp").update({ consumido_en: new Date().toISOString() }).eq("id", otp.id);
    return fallo(res, 429, "Demasiados intentos con ese código. Pide uno nuevo.");
  }

  if (!verificarCodigo(codigo, otp.salt, otp.codigo_hash)) {
    await supabase.from("portal_otp").update({ intentos: otp.intentos + 1 }).eq("id", otp.id);
    await registrarIntento(placa, ip, "verificar_codigo", false);
    return fallo(res, 401, `Código incorrecto. Te quedan ${otp.max_intentos - otp.intentos - 1} intentos.`);
  }

  await supabase.from("portal_otp").update({ consumido_en: new Date().toISOString() }).eq("id", otp.id);

  const token = await crearSesion({
    cliente_id: cliente.id, vehiculo_id: vehiculo.id, nivel: "correo", req,
  });
  await registrarIntento(placa, ip, "verificar_codigo", true);

  res.json({
    error: false,
    token,
    cliente: { nombre: cliente.nombre },
    vehiculo: { id: vehiculo.id, placa: vehiculo.placa, marca: vehiculo.marca, modelo: vehiculo.modelo, ano: vehiculo.ano, color: vehiculo.color },
  });
}));

// ═════════════════════════════════════════════════════════════════════════════
// ACCESO — Nivel 3: código dictado en el mostrador
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /portal/acceso/mostrador   { codigo, placa? }
 * Para el cliente sin teléfono ni correo en ficha. La secretaria genera el
 * código desde la ficha y se lo dicta. Si el cliente tiene un solo vehículo,
 * ni siquiera hace falta la placa.
 */
router.post("/acceso/mostrador", ruta(async (req, res) => {
  const ip = ipDe(req);
  const codigo = String(req.body?.codigo || "").replace(/\D/g, "");
  const placa = normalizarPlaca(req.body?.placa);

  if (codigo.length !== 8) return fallo(res, 400, "El código del mostrador son 8 dígitos.");

  const limite = await excedeLimite(`mostrador:${ip}`, ip);
  if (limite) return fallo(res, 429, "Demasiados intentos. Espera una hora.");

  const { data: candidatos } = await supabase
    .from("portal_codigos_mostrador")
    .select("*")
    .is("consumido_en", null)
    .gte("expira_en", new Date().toISOString());

  const encontrado = (candidatos || []).find(
    (c) => c.intentos < c.max_intentos && verificarCodigo(codigo, c.salt, c.codigo_hash)
  );

  if (!encontrado) {
    // Sumamos intento a todos los vigentes para que la fuerza bruta se agote.
    await Promise.all(
      (candidatos || []).map((c) =>
        supabase.from("portal_codigos_mostrador").update({ intentos: c.intentos + 1 }).eq("id", c.id)
      )
    );
    await registrarIntento(`mostrador:${ip}`, ip, "codigo_mostrador", false);
    return fallo(res, 401, "Código inválido o vencido. Pide uno nuevo en el taller.");
  }

  // Elegir el vehículo: el de la placa indicada, o el único que tenga.
  const { data: vehiculos } = await supabase
    .from("vehiculos")
    .select("id, placa, marca, modelo, ano, color, activo")
    .eq("cliente_id", encontrado.cliente_id);

  const activos = (vehiculos || []).filter((v) => v.activo !== false);
  let vehiculo = null;

  if (placa) vehiculo = activos.find((v) => normalizarPlaca(v.placa) === placa) || null;
  if (!vehiculo && activos.length === 1) vehiculo = activos[0];

  if (!vehiculo && activos.length > 1) {
    // No consumimos el código todavía: el cliente debe elegir vehículo.
    return res.status(300).json({
      error: false,
      requiere_seleccion: true,
      vehiculos: activos.map((v) => ({ placa: v.placa, marca: v.marca, modelo: v.modelo, ano: v.ano })),
      mensaje: "Tienes varios vehículos. Indica la placa del que quieres consultar.",
    });
  }

  if (!vehiculo) return fallo(res, 404, "No hay vehículos activos asociados a ese código.");

  await supabase
    .from("portal_codigos_mostrador")
    .update({ consumido_en: new Date().toISOString() })
    .eq("id", encontrado.id);

  const { data: cliente } = await supabase
    .from("clientes").select("nombre").eq("id", encontrado.cliente_id).maybeSingle();

  const token = await crearSesion({
    cliente_id: encontrado.cliente_id, vehiculo_id: vehiculo.id, nivel: "mostrador", req,
  });
  await registrarIntento(`mostrador:${ip}`, ip, "codigo_mostrador", true);

  res.json({
    error: false,
    token,
    cliente: { nombre: cliente?.nombre || "" },
    vehiculo: { id: vehiculo.id, placa: vehiculo.placa, marca: vehiculo.marca, modelo: vehiculo.modelo, ano: vehiculo.ano, color: vehiculo.color },
  });
}));

/**
 * POST /portal/admin/codigo-mostrador   { cliente_id, generado_por? }
 * Lo llama la secretaria desde la ficha del cliente en el CRM.
 * Cabecera requerida: x-portal-admin: <PORTAL_ADMIN_SECRET>
 */
router.post("/admin/codigo-mostrador", requiereAdmin, ruta(async (req, res) => {
  const clienteId = Number(req.body?.cliente_id);
  if (!clienteId) return fallo(res, 400, "cliente_id requerido.");

  const { data: cliente } = await supabase
    .from("clientes").select("id, nombre").eq("id", clienteId).maybeSingle();
  if (!cliente) return fallo(res, 404, "Cliente no encontrado.");

  // Invalidar el anterior (el índice único lo exige).
  await supabase
    .from("portal_codigos_mostrador")
    .update({ consumido_en: new Date().toISOString() })
    .eq("cliente_id", clienteId)
    .is("consumido_en", null);

  const codigo = generarCodigo(8);
  const { salt, hash } = hashCodigo(codigo);

  const { error } = await supabase.from("portal_codigos_mostrador").insert({
    cliente_id: clienteId,
    codigo_hash: hash,
    salt,
    generado_por: String(req.body?.generado_por || "").slice(0, 120) || null,
  });
  if (error) return fallo(res, 500, "No se pudo generar el código.");

  // Único momento en que el código viaja en claro: hacia el CRM, para dictarlo.
  res.json({
    error: false,
    codigo,
    cliente: cliente.nombre,
    vence_en_horas: 24,
    instruccion: "Dícteselo al cliente. Entra en solidoautoservicio.com/cliente → «Tengo un código del taller».",
  });
}));

/** POST /portal/admin/revocar-sesiones  { cliente_id, motivo? } */
router.post("/admin/revocar-sesiones", requiereAdmin, ruta(async (req, res) => {
  const clienteId = Number(req.body?.cliente_id);
  if (!clienteId) return fallo(res, 400, "cliente_id requerido.");

  const { data, error } = await supabase
    .from("portal_sesiones")
    .update({
      revocado_en: new Date().toISOString(),
      revocado_motivo: String(req.body?.motivo || "revocado desde el CRM").slice(0, 200),
    })
    .eq("cliente_id", clienteId)
    .is("revocado_en", null)
    .select("id");

  if (error) return fallo(res, 500, "No se pudieron revocar las sesiones.");
  res.json({ error: false, revocadas: (data || []).length });
}));

// ═════════════════════════════════════════════════════════════════════════════
// DATOS — todo lo de abajo exige sesión y está acotado a UN vehículo
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /portal/estado
 * Sustituye las 4 descargas completas del frontend por una sola respuesta
 * acotada. Devuelve el vehículo, su orden abierta, la línea de tiempo y las
 * cotizaciones pendientes de aprobación.
 */
router.get("/estado", requiereSesion, ruta(async (req, res) => {
  const { clienteId, vehiculoId } = req.portal;

  const [vehRes, cliRes, ordRes, diagRes, cotRes, mantRes] = await Promise.all([
    supabase.from("vehiculos")
      .select("*")
      .eq("id", vehiculoId).maybeSingle(),

    supabase.from("clientes")
      .select("id, nombre, telefono, email")
      .eq("id", clienteId).maybeSingle(),

    // select("*") y no una lista de columnas: si mañana se agrega una columna
    // que el frontend necesita, no hay que tocar este endpoint. La respuesta
    // sigue acotada a un vehículo, que es lo que importa para la privacidad.
    //
    // El filtro incluye las órdenes antiguas del cliente que quedaron sin
    // vehiculo_id — el frontend original las rescataba comparando la placa
    // dentro de vehiculo_info, señal de que en esta base existen.
    supabase.from("ordenes_trabajo")
      .select("*")
      .or(`vehiculo_id.eq.${vehiculoId},and(cliente_id.eq.${clienteId},vehiculo_id.is.null)`)
      .order("created_at", { ascending: false })
      .limit(20),

    supabase.from("diagnosticos")
      .select("*")
      .or(`vehiculo_id.eq.${vehiculoId},and(cliente_id.eq.${clienteId},vehiculo_id.is.null)`)
      .order("created_at", { ascending: false })
      .limit(20),

    supabase.from("cotizaciones")
      .select("*")
      .or(`vehiculo_id.eq.${vehiculoId},and(cliente_id.eq.${clienteId},vehiculo_id.is.null)`)
      .order("created_at", { ascending: false })
      .limit(10),

    supabase.from("mantenimiento_preventivo")
      .select("*")
      .eq("vehiculo_id", vehiculoId)
      .order("proximo_fecha", { ascending: true })
      .limit(20),
  ]);

  // Antes estos errores se tragaban con `|| []`, así que una consulta rota se
  // veía como "este vehículo no tiene órdenes" — imposible de diagnosticar.
  const avisos = [];
  for (const [nombre, r] of [
    ["ordenes", ordRes], ["diagnosticos", diagRes],
    ["cotizaciones", cotRes], ["mantenimiento", mantRes],
  ]) {
    if (r.error) {
      console.error(`[portal] /estado consulta ${nombre}:`, r.error.message);
      avisos.push(`${nombre}: ${r.error.message}`);
    }
  }

  const vehiculo = vehRes.data;
  if (!vehiculo) return fallo(res, 404, "El vehículo de esta sesión ya no existe.");

  const infoVehiculo = `${vehiculo.marca || ""} ${vehiculo.modelo || ""} (${vehiculo.placa || ""})`.trim();

  // ── Normalización de órdenes ──
  // Réplica de lo que hace GET /ordenes en server.mjs. Sin esto, `estado`
  // puede venir null y el frontend hace o.estado.replace(...) → pantalla rota.
  const ordenes = (ordRes.data || []).map((o) => ({
    ...o,
    estado: o.estado || o.status || "RECIBIDO",
    numero_orden: o.numero_orden || `OT-${String(o.id).padStart(4, "0")}`,
    vehiculo_info: infoVehiculo,
    vehiculo_placa: vehiculo.placa || "",
    vehiculo_marca: vehiculo.marca || "",
    vehiculo_modelo: vehiculo.modelo || "",
    cliente_nombre: cliRes.data?.nombre || "",
  }));

  const ordenActual = ordenes[0] || null;

  // Línea de tiempo a partir de las columnas fecha_* de ordenes_trabajo.
  const linea = ordenActual
    ? [
        ["Recibido", ordenActual.created_at],
        ["Diagnóstico", ordenActual.fecha_diagnostico],
        ["Esperando tu aprobación", ordenActual.fecha_esperando_aprobacion],
        ["Aprobado", ordenActual.fecha_aprobacion],
        ["En reparación", ordenActual.fecha_inicio_reparacion],
        ["Control de calidad", ordenActual.fecha_control_calidad],
        ["Listo para recoger", ordenActual.fecha_listo],
        ["Entregado", ordenActual.fecha_entrega],
      ]
        .filter(([, fecha]) => Boolean(fecha))
        .map(([etapa, fecha]) => ({ etapa, fecha }))
    : [];

  const cotizaciones = cotRes.data || [];

  // ── Normalización de diagnósticos ──
  // Réplica de los alias que agrega GET /diagnosticos en server.mjs. La tabla
  // guarda `fallas_identificadas` y `observaciones`, pero la interfaz y la
  // función de impresión leen `descripcion`, `hallazgos` y `notas`. Sin estos
  // alias la impresión sale en blanco: hay datos, pero con otro nombre.
  //
  // `mano_obra` y `repuestos` viven en cotizaciones, no en diagnosticos; se
  // cruzan por diagnostico_id para que el desglose de costos no salga en cero.
  const cotPorDiagnostico = {};
  for (const c of cotizaciones) {
    if (c.diagnostico_id != null) cotPorDiagnostico[c.diagnostico_id] = c;
  }

  // Órdenes express, para marcar sus diagnósticos como cortesía.
  const ordenesExpress = new Set(
    ordenes.filter((o) => o.es_express).map((o) => o.id)
  );

  const diagnosticos = (diagRes.data || []).map((d) => {
    const cot = cotPorDiagnostico[d.id];
    const manoObra = Number(cot?.mano_obra || 0);
    const repuestos = Number(cot?.repuestos || 0);
    const total = manoObra + repuestos || Number(cot?.total || d.costo_estimado || 0);

    // Un diagnóstico hecho durante un servicio express es una revisión de
    // cortesía: el cliente no la pidió y no se le cobra. Sin marcarlo, ve
    // hallazgos en su portal y asume que le van a facturar algo que no aprobó.
    const esCortesia = d.es_cortesia === true || ordenesExpress.has(d.orden_id);

    return {
      ...d,
      es_cortesia: esCortesia,
      etiqueta_cortesia: esCortesia
        ? "Revisión de cortesía — no se factura"
        : null,
      cliente_nombre: cliRes.data?.nombre || "",
      vehiculo_info: infoVehiculo,
      tecnico_nombre: d.tecnico_nombre || "—",
      mano_obra: manoObra,
      repuestos,
      total,
      // Alias de compatibilidad con el frontend
      descripcion: d.fallas_identificadas || d.tipo_servicio || "",
      hallazgos: d.fallas_identificadas || "",
      notas: d.observaciones || "",
      tiempo_estimado: cot?.tiempo_estimado || "",
      terminado: String(d.estado || "").toUpperCase() === "COMPLETADO"
              || String(d.estado || "").toUpperCase() === "TERMINADO",
    };
  });

  const cotizacionesPendientes = cotizaciones.filter(
    (c) => !c.aprobado && String(c.estado || "").toUpperCase() === "PENDIENTE"
  );

  // Mantenimiento: solo los activos, comparando sin distinguir mayúsculas
  // porque el CRM ha guardado 'ACTIVO' y 'Activo' según el módulo.
  const mantenimiento = (mantRes.data || []).filter(
    (m) => String(m.estado || "ACTIVO").toUpperCase() === "ACTIVO"
  );

  // Mantenimiento vencido o por vencer en 30 días (mejora #5 del análisis).
  const en30dias = new Date(Date.now() + 30 * 86400_000);
  const recordatorios = mantenimiento.filter(
    (m) => m.proximo_fecha && new Date(m.proximo_fecha) <= en30dias
  );

  // ── Fotos del vehículo ──
  // `vehiculos` no guarda fotos. Las únicas que existen se toman en la
  // recepción y viven en `inspeccion_vehiculo`, en dos formatos que conviven:
  // `fotos_slots` (objeto de 7 slots con data URL) y `fotos` (array legacy
  // [{data,label}]). Se busca la inspección más reciente de este vehículo,
  // sea cual sea la orden, para que la tarjeta tenga foto aunque el servicio
  // que la generó ya se haya entregado.
  let fotos = [];
  const idsOrdenes = ordenes.map((o) => o.id);
  if (idsOrdenes.length > 0) {
    const { data: insp, error: iErr } = await supabase
      .from("inspeccion_vehiculo")
      .select("orden_id, fotos_slots, fotos, created_at")
      .in("orden_id", idsOrdenes)
      .order("created_at", { ascending: false });

    if (iErr) {
      console.error("[portal] /estado fotos:", iErr.message);
      avisos.push(`fotos: ${iErr.message}`);
    } else {
      const ETIQUETAS = {
        frente: "Frente", trasero: "Trasero",
        lateral_izq: "Lateral izquierdo", lateral_der: "Lateral derecho",
        interior: "Interior", tablero: "Tablero", danos_visibles: "Daños visibles",
      };
      // La primera inspección que traiga alguna foto es la más reciente.
      for (const ins of insp || []) {
        const slots = ins.fotos_slots || {};
        const deSlots = Object.keys(ETIQUETAS)
          .filter((k) => slots[k])
          .map((k) => ({ slot: k, label: ETIQUETAS[k], src: slots[k], orden_id: ins.orden_id }));
        const deLegacy = (Array.isArray(ins.fotos) ? ins.fotos : [])
          .filter((f) => f && f.data)
          .map((f, i) => ({ slot: `extra_${i}`, label: f.label || "Foto", src: f.data, orden_id: ins.orden_id }));
        const todas = [...deSlots, ...deLegacy];
        if (todas.length > 0) { fotos = todas; break; }
      }
    }
  }

  res.json({
    error: false,
    cliente: { nombre: cliRes.data?.nombre || "" },
    vehiculo,
    fotos,
    orden_actual: ordenActual,
    linea_tiempo: linea,
    ordenes,
    diagnosticos,
    cotizaciones,
    cotizaciones_pendientes: cotizacionesPendientes,
    mantenimiento,
    recordatorios,
    // Visible a propósito: si una consulta falla, que se note en vez de
    // parecer que el vehículo no tiene datos.
    ...(avisos.length ? { avisos } : {}),
  });
}));

/**
 * Reutiliza los endpoints de historial que ya existen en server.mjs.
 *
 * Esos endpoints arman el expediente completo (avances, cotización, factura,
 * inspección, línea de tiempo, snapshots JSONB) y son ~200 líneas de lógica.
 * Leer las tablas en crudo desde aquí, como se hacía antes, devolvía solo la
 * fila base: la interfaz mostraba el vehículo y la impresión salía vacía,
 * porque los campos que consume (`avances_data`, `cotizacion_data`,
 * `numero_orden`…) los construye el endpoint, no la tabla.
 *
 * Duplicar esa lógica aquí garantizaría que las dos copias se desincronicen.
 * Se llama al propio servidor por loopback: misma salida siempre, y la
 * comprobación de pertenencia se hace antes, en la capa del portal.
 */
const PUERTO_INTERNO = process.env.PORT || 4000;

async function pedirInterno(ruta) {
  const control = new AbortController();
  const cronometro = setTimeout(() => control.abort(), 15000);
  try {
    const r = await fetch(`http://127.0.0.1:${PUERTO_INTERNO}${ruta}`, {
      signal: control.signal,
    });
    const cuerpo = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, cuerpo };
  } finally {
    clearTimeout(cronometro);
  }
}

/**
 * GET /portal/historial
 * Historial del vehículo, incluyendo las órdenes activas que todavía no están
 * en `vehiculo_historial` (el endpoint interno las convierte al mismo formato).
 */
router.get("/historial", requiereSesion, ruta(async (req, res) => {
  const { vehiculoId } = req.portal;

  const { data: veh } = await supabase
    .from("vehiculos").select("placa").eq("id", vehiculoId).maybeSingle();

  // Se manda SIEMPRE el vehiculo_id, no solo la placa.
  //
  // El endpoint interno resolvía el vehículo comparando el texto de la placa,
  // y esta ruta ya sabe exactamente de qué vehículo se trata: la sesión lo
  // fijó al autenticar. Depender del texto hacía que la pantalla de estado
  // (que filtra por id) mostrara la orden en curso mientras el historial la
  // daba por inexistente. La placa queda como respaldo para el resto.
  const r = await pedirInterno(
    `/vehiculo-historial/placa/${encodeURIComponent(veh?.placa || "-")}` +
    `?vehiculo_id=${vehiculoId}` +
    (req.query.debug === "1" ? "&debug=1" : "")
  );

  if (!r.ok) {
    console.error("[portal] /historial interno:", r.status, JSON.stringify(r.cuerpo).slice(0, 200));
    return fallo(res, 502, "No se pudo cargar el historial.");
  }

  res.json({
    error: false,
    historial: r.cuerpo?.historial || [],
    vehiculo: r.cuerpo?.vehiculo || null,
    fotos: r.cuerpo?.fotos || [],
    ...(r.cuerpo?.debug ? { debug: r.cuerpo.debug } : {}),
  });
}));

/**
 * GET /portal/historial/:id — expediente de un servicio ya cerrado.
 *
 * El parámetro se restringe a dígitos: sin `(\\d+)`, una petición a
 * /historial/orden/123 haría match aquí con id="orden" y nunca llegaría a la
 * ruta de abajo, porque Express evalúa en orden de declaración.
 */
router.get("/historial/:id(\\d+)", requiereSesion, ruta(async (req, res) => {
  const { vehiculoId } = req.portal;

  // Pertenencia PRIMERO: sin esto, cambiar el :id en la URL mostraría el
  // expediente de otro cliente.
  const { data: fila } = await supabase
    .from("vehiculo_historial")
    .select("id, vehiculo_id, placa")
    .eq("id", req.params.id)
    .maybeSingle();

  if (!fila) return fallo(res, 404, "Registro no encontrado.");

  if (fila.vehiculo_id && fila.vehiculo_id !== vehiculoId) {
    return fallo(res, 403, "Ese registro no pertenece a tu vehículo.");
  }
  // Registros antiguos sin vehiculo_id: se valida por placa.
  if (!fila.vehiculo_id) {
    const { data: veh } = await supabase
      .from("vehiculos").select("placa").eq("id", vehiculoId).maybeSingle();
    if (normalizarPlaca(veh?.placa) !== normalizarPlaca(fila.placa)) {
      return fallo(res, 403, "Ese registro no pertenece a tu vehículo.");
    }
  }

  const r = await pedirInterno(`/vehiculo-historial/${req.params.id}/detalle`);
  if (!r.ok) return fallo(res, 502, "No se pudo cargar el detalle.");

  res.json({ error: false, ...r.cuerpo });
}));

/**
 * GET /portal/historial/orden/:ordenId
 * Expediente de una orden todavía abierta, que aún no pasó a vehiculo_historial.
 */
router.get("/historial/orden/:ordenId", requiereSesion, ruta(async (req, res) => {
  const { vehiculoId } = req.portal;

  const { data: orden } = await supabase
    .from("ordenes_trabajo")
    .select("id, vehiculo_id")
    .eq("id", req.params.ordenId)
    .maybeSingle();

  if (!orden) return fallo(res, 404, "Orden no encontrada.");
  if (orden.vehiculo_id !== vehiculoId) {
    return fallo(res, 403, "Esa orden no pertenece a tu vehículo.");
  }

  const r = await pedirInterno(`/vehiculo-historial/orden/${orden.id}/detalle`);
  if (!r.ok) return fallo(res, 502, "No se pudo cargar el detalle.");

  res.json({ error: false, ...r.cuerpo });
}));

// ═════════════════════════════════════════════════════════════════════════════
// Aprobación de cotización desde el celular (mejora #3 del análisis)
// ═════════════════════════════════════════════════════════════════════════════

/** GET /portal/cotizaciones/:id */
router.get("/cotizaciones/:id", requiereSesion, ruta(async (req, res) => {
  const { vehiculoId } = req.portal;

  const { data, error } = await supabase
    .from("cotizaciones").select("*").eq("id", req.params.id).maybeSingle();

  if (error || !data) return fallo(res, 404, "Cotización no encontrada.");
  if (data.vehiculo_id !== vehiculoId) return fallo(res, 403, "Esa cotización no es de tu vehículo.");

  res.json({ error: false, cotizacion: data });
}));

/**
 * POST /portal/cotizaciones/:id/responder   { aprobar: boolean, firma?, motivo? }
 * El cliente aprueba o rechaza desde el celular. Además de marcar la
 * cotización, mueve la orden a "aprobada" para que el taller lo vea al instante
 * en el kanban (con Realtime de Supabase, sin recargar).
 */
router.post("/cotizaciones/:id/responder", requiereSesion, ruta(async (req, res) => {
  const { vehiculoId, clienteId, nivel } = req.portal;
  const aprobar = req.body?.aprobar === true;
  const firma = String(req.body?.firma || "").slice(0, 200_000) || null;
  const motivo = String(req.body?.motivo || "").slice(0, 500);

  const { data: cot } = await supabase
    .from("cotizaciones").select("*").eq("id", req.params.id).maybeSingle();

  if (!cot) return fallo(res, 404, "Cotización no encontrada.");
  if (cot.vehiculo_id !== vehiculoId) return fallo(res, 403, "Esa cotización no es de tu vehículo.");
  if (cot.aprobado) return fallo(res, 409, "Esta cotización ya fue aprobada.");
  if (String(cot.estado || "").toUpperCase() === "RECHAZADA") {
    return fallo(res, 409, "Esta cotización ya fue rechazada.");
  }
  if (cot.valida_hasta && new Date(cot.valida_hasta) < new Date()) {
    return fallo(res, 410, "Esta cotización venció. Pide una actualizada al taller.");
  }

  const ahora = new Date().toISOString();

  const { error: errCot } = await supabase
    .from("cotizaciones")
    .update({
      aprobado: aprobar,
      aprobado_at: aprobar ? ahora : null,
      estado: aprobar ? "APROBADA" : "RECHAZADA",
      firma_cliente: aprobar ? firma : null,
      notas: motivo
        ? `${cot.notas ? cot.notas + "\n" : ""}[${aprobar ? "Aprobada" : "Rechazada"} por el cliente desde el portal · ${nivel}] ${motivo}`
        : cot.notas,
    })
    .eq("id", cot.id);

  if (errCot) return fallo(res, 500, "No se pudo registrar tu respuesta. Intenta de nuevo.");

  // Reflejarlo en la orden para que el taller lo vea sin preguntar.
  let ordenId = null;
  if (cot.diagnostico_id) {
    const { data: diag } = await supabase
      .from("diagnosticos").select("orden_id").eq("id", cot.diagnostico_id).maybeSingle();
    ordenId = diag?.orden_id || null;
  }

  if (ordenId) {
    await supabase
      .from("ordenes_trabajo")
      .update(
        aprobar
          ? { aprobado_por_cliente: true, fecha_aprobacion: ahora, estado: "APROBADO", status: "APROBADO" }
          : { aprobado_por_cliente: false, motivo_rechazo_calidad: null,
              estado: "ESPERANDO_APROBACION", status: "ESPERANDO_APROBACION" }
      )
      .eq("id", ordenId)
      .eq("vehiculo_id", vehiculoId); // cinturón y tirantes
  }

  // Bitácora. Fire-and-forget, igual que logAccion() en server.mjs: si falla,
  // no debe tumbar una aprobación que el cliente ya dio.
  const descripcion =
    `Cotización #${cot.numero || cot.id} por RD$ ${cot.total} ` +
    `${aprobar ? "APROBADA" : "RECHAZADA"} por el cliente vía portal (${nivel})` +
    (motivo ? ` · ${motivo}` : "");

  supabase.from("log_acciones").insert([{
    usuario_id: null,
    usuario_nombre: `Cliente #${clienteId} (portal)`,
    usuario_rol: "cliente",
    accion: aprobar ? "APROBAR_COTIZACION" : "RECHAZAR_COTIZACION",
    modulo: "portal_cliente",
    registro_id: String(cot.id),
    descripcion,
    detalle: { cotizacion_id: cot.id, orden_id: ordenId, total: cot.total, nivel_acceso: nivel },
    ip: ipDe(req),
  }]).then(() => {}, (e) => console.warn("[portal] log_acciones:", e.message));

  if (ordenId) {
    supabase.from("orden_trabajo_log").insert([{
      orden_id: ordenId,
      estado_anterior: "ESPERANDO_APROBACION",
      estado_nuevo: aprobar ? "APROBADO" : "ESPERANDO_APROBACION",
      usuario_nombre: `Cliente #${clienteId} (portal)`,
      motivo: descripcion,
      metadata: { via: "portal_cliente", nivel_acceso: nivel, cotizacion_id: cot.id },
    }]).then(() => {}, (e) => console.warn("[portal] orden_trabajo_log:", e.message));
  }

  res.json({
    error: false,
    aprobado: aprobar,
    mensaje: aprobar
      ? "¡Listo! El taller ya fue notificado y comenzará la reparación."
      : "Registramos tu decisión. El taller se comunicará contigo.",
  });
}));

// ═════════════════════════════════════════════════════════════════════════════
// CITAS desde la app del cliente
// ═════════════════════════════════════════════════════════════════════════════
//
// Diferencia con `POST /citas/publica` (el formulario del sitio web): allí el
// cliente es un desconocido y hay que pedirle nombre, correo, placa y modelo,
// y la cita entra suelta para que la secretaria la vincule a mano.
//
// Aquí el cliente ya se identificó, así que la cita se guarda con `cliente_id`
// y `vehiculo_id` reales. Entra al CRM ya conectada a su ficha, aparece en su
// historial y las notificaciones push le llegan sin trabajo extra de nadie.

/** Horas que el taller ofrece. Media hora de resolución, sin la hora de almuerzo. */
const HORAS_DISPONIBLES = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
];

/** Cuántas citas caben a la misma hora (bahías de trabajo en paralelo). */
const CUPO_POR_HORA = Number(process.env.CITAS_CUPO_POR_HORA || 3);

/** Con cuántos días de anticipación se puede agendar. */
const DIAS_MAX_ANTICIPACION = 60;

const TIPOS_SERVICIO = [
  "MANTENIMIENTO", "DIAGNOSTICO", "FRENOS", "SUSPENSION", "ELECTRICO",
  "AIRE_ACONDICIONADO", "ALINEACION", "MOTOR", "CARWASH", "OTRO",
];

/** Fecha de hoy en hora local del taller (Railway corre en UTC). */
function hoyLocalISO() {
  const desfase = Number(process.env.TZ_OFFSET_HORAS ?? -4);
  return new Date(Date.now() + desfase * 3600_000).toISOString().slice(0, 10);
}

/**
 * GET /portal/citas
 * Las citas del cliente de la sesión: próximas primero, luego el historial.
 */
router.get("/citas", requiereSesion, ruta(async (req, res) => {
  const { clienteId } = req.portal;
  const hoy = hoyLocalISO();

  const { data, error } = await supabase
    .from("citas_taller")
    .select("id, fecha, hora, tipo_servicio, descripcion, estado, origen, notas, created_at")
    .eq("cliente_id", clienteId)
    .order("fecha", { ascending: false })
    .order("hora", { ascending: false })
    .limit(50);

  if (error) return fallo(res, 500, "No se pudieron cargar tus citas.", { detalle_tecnico: error.message });

  const todas = data || [];
  res.json({
    error: false,
    proximas: todas
      .filter((c) => c.fecha >= hoy && !["CANCELADA", "COMPLETADA", "NO_ASISTIO"].includes(c.estado))
      .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)),
    pasadas: todas.filter(
      (c) => c.fecha < hoy || ["CANCELADA", "COMPLETADA", "NO_ASISTIO"].includes(c.estado)
    ),
  });
}));

/**
 * GET /portal/citas/opciones?fecha=YYYY-MM-DD
 * Qué horas quedan libres ese día y qué tipos de servicio se pueden pedir.
 *
 * Sin esto el cliente elige una hora a ciegas, el taller la rechaza y la
 * experiencia termina peor que si hubiera llamado por teléfono.
 */
router.get("/citas/opciones", requiereSesion, ruta(async (req, res) => {
  const hoy = hoyLocalISO();
  const fecha = String(req.query.fecha || "").trim();

  const limite = new Date(Date.now() + DIAS_MAX_ANTICIPACION * 86400_000)
    .toISOString().slice(0, 10);

  if (!fecha) {
    return res.json({
      error: false, tipos: TIPOS_SERVICIO, horas: [],
      fecha_min: hoy, fecha_max: limite,
    });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fallo(res, 400, "Fecha inválida.");

  // Domingo: el taller abre, pero no se toman citas de taller.
  const [a, m, d] = fecha.split("-").map(Number);
  const diaSemana = new Date(a, m - 1, d).getDay();

  const { data: ocupadas } = await supabase
    .from("citas_taller")
    .select("hora")
    .eq("fecha", fecha)
    .in("estado", ["PENDIENTE", "CONFIRMADA"]);

  const conteo = {};
  for (const c of ocupadas || []) {
    const h = String(c.hora || "").slice(0, 5);
    conteo[h] = (conteo[h] || 0) + 1;
  }

  // Sábado: media jornada, hasta las 12.
  const horasDelDia = diaSemana === 6
    ? HORAS_DISPONIBLES.filter((h) => h < "12:00")
    : HORAS_DISPONIBLES;

  res.json({
    error: false,
    fecha,
    cerrado: diaSemana === 0,
    tipos: TIPOS_SERVICIO,
    fecha_min: hoy,
    fecha_max: limite,
    horas: horasDelDia.map((h) => ({
      hora: h,
      disponible: (conteo[h] || 0) < CUPO_POR_HORA,
    })),
  });
}));

/**
 * POST /portal/citas   { fecha, hora, tipo_servicio, descripcion }
 * Agenda una cita a nombre del cliente de la sesión.
 */
router.post("/citas", requiereSesion, ruta(async (req, res) => {
  const { clienteId, vehiculoId } = req.portal;

  const fecha  = String(req.body?.fecha || "").trim();
  const hora   = String(req.body?.hora || "").trim().slice(0, 5);
  const tipo   = String(req.body?.tipo_servicio || "OTRO").trim().toUpperCase();
  const motivo = String(req.body?.descripcion || "").trim().slice(0, 500);

  // ── Validación ──
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fallo(res, 400, "Elige una fecha válida.");
  if (!/^\d{2}:\d{2}$/.test(hora))        return fallo(res, 400, "Elige una hora válida.");
  if (!motivo)                            return fallo(res, 400, "Cuéntanos brevemente qué necesitas.");

  const hoy = hoyLocalISO();
  if (fecha < hoy) return fallo(res, 400, "Esa fecha ya pasó. Elige otra.");

  const limite = new Date(Date.now() + DIAS_MAX_ANTICIPACION * 86400_000)
    .toISOString().slice(0, 10);
  if (fecha > limite)
    return fallo(res, 400, `Solo se pueden agendar citas hasta ${DIAS_MAX_ANTICIPACION} días por adelantado.`);

  const [a, m, d] = fecha.split("-").map(Number);
  if (new Date(a, m - 1, d).getDay() === 0)
    return fallo(res, 400, "Los domingos no tomamos citas de taller. Elige otro día.");

  if (!TIPOS_SERVICIO.includes(tipo))
    return fallo(res, 400, "Tipo de servicio no reconocido.");

  // ── Ya tiene una cita ese día ──
  // Duplicar la cita es el error más común: el cliente toca el botón dos veces
  // porque la primera respuesta tardó, y la secretaria ve dos turnos iguales.
  const { data: existente } = await supabase
    .from("citas_taller")
    .select("id, fecha, hora")
    .eq("cliente_id", clienteId)
    .eq("fecha", fecha)
    .in("estado", ["PENDIENTE", "CONFIRMADA"])
    .limit(1)
    .maybeSingle();

  if (existente) {
    return fallo(res, 409, `Ya tienes una cita ese día a las ${existente.hora}. Cancélala primero si quieres cambiarla.`, {
      cita_existente: existente,
    });
  }

  // ── Cupo de la hora ──
  const { count } = await supabase
    .from("citas_taller")
    .select("id", { count: "exact", head: true })
    .eq("fecha", fecha)
    .eq("hora", hora)
    .in("estado", ["PENDIENTE", "CONFIRMADA"]);

  if ((count || 0) >= CUPO_POR_HORA)
    return fallo(res, 409, "Esa hora ya se llenó. Elige otra, por favor.");

  // ── Datos de contacto, copiados a la cita ──
  // Se guardan también en las columnas de texto para que el módulo Citas del
  // CRM muestre nombre y placa sin tener que cruzar tablas, igual que hace con
  // las citas del sitio web.
  const [{ data: cliente }, { data: vehiculo }] = await Promise.all([
    supabase.from("clientes").select("nombre, email, telefono").eq("id", clienteId).maybeSingle(),
    supabase.from("vehiculos").select("marca, modelo, placa").eq("id", vehiculoId).maybeSingle(),
  ]);

  const { data: cita, error } = await supabase.from("citas_taller").insert([{
    cliente_id:        clienteId,
    vehiculo_id:       vehiculoId,
    fecha,
    hora,
    tipo_servicio:     tipo,
    descripcion:       motivo,
    origen:            "APP",
    estado:            "PENDIENTE",
    nombre_contacto:   cliente?.nombre || null,
    email_contacto:    cliente?.email || null,
    telefono_contacto: cliente?.telefono || null,
    placa_texto:       vehiculo?.placa || null,
    modelo_texto:      [vehiculo?.marca, vehiculo?.modelo].filter(Boolean).join(" ") || null,
  }]).select().single();

  if (error) {
    console.warn("[portal] crear cita:", error.message);
    return fallo(res, 500, "No se pudo guardar la cita. Intenta de nuevo.", {
      detalle_tecnico: error.message,
    });
  }

  // ── Efectos secundarios, todos sin bloquear la respuesta ──
  // El cliente ya tiene su confirmación en pantalla; que el correo tarde tres
  // segundos no es razón para dejarlo mirando un spinner.
  notificarCita(cita.id, "AGENDADA").catch(() => {});
  avisarTallerNuevaCita(cita).catch(() => {});

  supabase.from("cliente_interacciones").insert([{
    cliente_id: clienteId,
    vehiculo_id: vehiculoId,
    tipo: "SISTEMA",
    descripcion: `Cita agendada desde la app para ${fecha} ${hora} — ${motivo}`,
    referencia: `cita:${cita.id}`,
    usuario_nombre: "Cliente (app)",
  }]).then(() => {}, () => {});

  supabase.from("log_acciones").insert([{
    usuario_nombre: `Cliente #${clienteId} (app)`,
    accion: "CREAR", modulo: "citas", registro_id: String(cita.id),
    descripcion: `Cita #${cita.id} agendada desde la app para ${fecha} ${hora}`,
    detalle: { origen: "APP", nivel_acceso: req.portal.nivel },
    ip: ipDe(req),
  }]).then(() => {}, () => {});

  res.json({
    error: false,
    cita,
    mensaje: "¡Listo! Tu cita quedó registrada. Te avisamos en cuanto el taller la confirme.",
  });
}));

/**
 * POST /portal/citas/:id/cancelar   { motivo? }
 *
 * Que el cliente pueda cancelar solo es lo que hace que el cupo se libere.
 * Sin esta opción, quien no puede venir simplemente no viene, y el turno se
 * pierde porque nadie se enteró a tiempo.
 */
router.post("/citas/:id(\\d+)/cancelar", requiereSesion, ruta(async (req, res) => {
  const { clienteId } = req.portal;
  const citaId = Number(req.params.id);

  const { data: cita } = await supabase
    .from("citas_taller")
    .select("id, cliente_id, fecha, hora, estado")
    .eq("id", citaId)
    .maybeSingle();

  if (!cita) return fallo(res, 404, "Esa cita no existe.");
  // El filtro de pertenencia es del lado servidor a propósito: cambiar el id
  // en la URL no puede dejar a nadie cancelar la cita de otro.
  if (cita.cliente_id !== clienteId) return fallo(res, 403, "Esa cita no es tuya.");
  if (["CANCELADA", "COMPLETADA"].includes(cita.estado))
    return fallo(res, 400, `La cita ya está ${cita.estado.toLowerCase()}.`);

  const motivo = String(req.body?.motivo || "").trim().slice(0, 300);

  const { error } = await supabase.from("citas_taller").update({
    estado: "CANCELADA",
    cancelada_por: "CLIENTE",
    notas: motivo ? `Cancelada por el cliente: ${motivo}` : "Cancelada por el cliente desde la app",
    updated_at: new Date().toISOString(),
  }).eq("id", citaId);

  if (error) return fallo(res, 500, "No se pudo cancelar. Intenta de nuevo.");

  supabase.from("cliente_interacciones").insert([{
    cliente_id: clienteId, tipo: "SISTEMA",
    descripcion: `Cita #${citaId} (${cita.fecha} ${cita.hora}) cancelada por el cliente desde la app${motivo ? ` — ${motivo}` : ""}`,
    referencia: `cita:${citaId}`, usuario_nombre: "Cliente (app)",
  }]).then(() => {}, () => {});

  res.json({ error: false, mensaje: "Cita cancelada. Puedes agendar otra cuando quieras." });
}));

// ═════════════════════════════════════════════════════════════════════════════
// Notificaciones push de la PWA
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /portal/push/clave
 * La clave pública VAPID que el navegador necesita para suscribirse.
 * Público a propósito: es pública por diseño, no es un secreto.
 */
router.get("/push/clave", ruta(async (req, res) => {
  const clave = clavePublicaVapid();
  if (!clave) return fallo(res, 503, "Notificaciones push no configuradas en el servidor.");
  res.json({ error: false, clave, disponible: await hayPush() });
}));

/**
 * POST /portal/push/suscribir   { suscripcion: PushSubscription }
 * Guarda el dispositivo. Un mismo cliente puede tener varios (celular, tablet).
 */
router.post("/push/suscribir", requiereSesion, ruta(async (req, res) => {
  const { clienteId, vehiculoId } = req.portal;
  const s = req.body?.suscripcion;

  if (!suscripcionValida(s)) return fallo(res, 400, "Suscripción inválida.");

  // upsert por endpoint: si el cliente reinstala la PWA, el navegador puede
  // devolver el mismo endpoint y no queremos duplicar filas.
  const { error } = await supabase
    .from("portal_push_suscripciones")
    .upsert(
      {
        cliente_id: clienteId,
        vehiculo_id: vehiculoId,
        endpoint: s.endpoint,
        p256dh: s.keys.p256dh,
        auth: s.keys.auth,
        user_agent: String(req.headers["user-agent"] || "").slice(0, 400),
        activa: true,
        fallos: 0,
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    console.warn("[portal] push suscribir:", error.message);
    return fallo(res, 500, "No se pudo activar las notificaciones.");
  }

  // Preferencia por defecto, para que el cliente pueda apagarlas después.
  await supabase
    .from("portal_preferencias_notif")
    .upsert({ cliente_id: clienteId, push: true }, { onConflict: "cliente_id" });

  res.json({ error: false, mensaje: "Notificaciones activadas." });
}));

/** POST /portal/push/baja   { endpoint } */
router.post("/push/baja", requiereSesion, ruta(async (req, res) => {
  const endpoint = String(req.body?.endpoint || "");
  if (!endpoint) return fallo(res, 400, "endpoint requerido.");

  await supabase
    .from("portal_push_suscripciones")
    .update({ activa: false })
    .eq("endpoint", endpoint)
    .eq("cliente_id", req.portal.clienteId); // no dar de baja la de otro

  res.json({ error: false });
}));

/**
 * POST /portal/push/prueba
 * Manda una notificación de prueba a los dispositivos del cliente. Es la única
 * forma de confirmar que el permiso quedó bien dado antes de que ocurra un
 * cambio de estado real.
 */
router.post("/push/prueba", requiereSesion, ruta(async (req, res) => {
  const { data: subs } = await supabase
    .from("portal_push_suscripciones")
    .select("endpoint, p256dh, auth")
    .eq("cliente_id", req.portal.clienteId)
    .eq("activa", true);

  if (!subs?.length) return fallo(res, 404, "No hay dispositivos suscritos.");

  let enviados = 0;
  const fallos = [];
  for (const s of subs) {
    const r = await enviarPush(s, {
      titulo: "🔔 Notificaciones activadas",
      cuerpo: "Te avisaremos aquí cuando tu vehículo cambie de estado.",
      url: "/cliente",
      etiqueta: "prueba",
    });
    if (r.ok) enviados++;
    else fallos.push(r.error || "error desconocido");
  }

  if (!enviados) {
    // El detalle importa: "no se pudo entregar" a secas obliga a abrir los
    // logs de Railway para saber si es una suscripción caducada, VAPID mal
    // configurado o el push service del navegador rechazando.
    return fallo(res, 502, "No se pudo entregar la notificación de prueba.", {
      detalle_tecnico: fallos.join(" | ").slice(0, 500),
      dispositivos: subs.length,
    });
  }
  res.json({ error: false, enviados });
}));

/**
 * GET /portal/push/diagnostico
 *
 * Responde la pregunta "¿por qué no me llegan las notificaciones?" sin tener
 * que abrir los logs de Railway ni la consola del navegador. Devuelve, en
 * orden, dónde se corta la cadena: llaves VAPID → paquete web-push → tablas →
 * dispositivos suscritos → preferencia del cliente → últimos envíos.
 */
router.get("/push/diagnostico", requiereSesion, ruta(async (req, res) => {
  const { clienteId } = req.portal;

  const [{ data: subs }, { data: prefs }, { data: ultimos }] = await Promise.all([
    supabase.from("portal_push_suscripciones")
      .select("id, endpoint, activa, fallos, creado_en, ultimo_uso_en, user_agent")
      .eq("cliente_id", clienteId).order("creado_en", { ascending: false }).limit(10),
    supabase.from("portal_preferencias_notif").select("correo, push")
      .eq("cliente_id", clienteId).maybeSingle(),
    supabase.from("notificaciones_cliente")
      .select("evento, canal, estado, detalle_error, creado_en")
      .eq("cliente_id", clienteId).order("creado_en", { ascending: false }).limit(10),
  ]);

  const activas = (subs || []).filter((s) => s.activa);
  const disponible = await hayPush();
  const problemas = [];

  if (!clavePublicaVapid())
    problemas.push("El servidor no tiene VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY. Genéralas con `npx web-push generate-vapid-keys` y ponlas en Railway.");
  else if (!disponible)
    problemas.push("Falta el paquete `web-push` en el backend. Corre `npm i web-push --prefix crm-backend` y redespliega.");

  if (!activas.length)
    problemas.push("Este cliente no tiene ningún dispositivo suscrito. Hay que abrir la app, entrar con la placa y activar el interruptor de avisos. En iPhone, además, la app tiene que estar instalada en la pantalla de inicio.");

  if (prefs?.push === false)
    problemas.push("El cliente apagó las notificaciones push desde sus preferencias.");

  const fallidos = (ultimos || []).filter((n) => n.estado === "fallido");
  if (fallidos.length)
    problemas.push(`Los últimos envíos fallaron: ${fallidos[0].detalle_error || "sin detalle"}`);

  res.json({
    error: false,
    listo: problemas.length === 0,
    problemas,
    vapid_configurado: Boolean(clavePublicaVapid()),
    paquete_web_push: disponible,
    dispositivos_activos: activas.length,
    dispositivos_totales: (subs || []).length,
    preferencias: prefs || { correo: true, push: true },
    // El endpoint completo identifica al dispositivo: se recorta a propósito.
    dispositivos: (subs || []).map((s) => ({
      activa: s.activa, fallos: s.fallos,
      creado_en: s.creado_en, ultimo_uso_en: s.ultimo_uso_en,
      navegador: String(s.user_agent || "").slice(0, 120),
      servicio: (() => { try { return new URL(s.endpoint).host; } catch { return "?"; } })(),
    })),
    ultimos_avisos: ultimos || [],
  });
}));

/** GET /portal/preferencias */
router.get("/preferencias", requiereSesion, ruta(async (req, res) => {
  const { data } = await supabase
    .from("portal_preferencias_notif")
    .select("correo, push, whatsapp")
    .eq("cliente_id", req.portal.clienteId)
    .maybeSingle();

  const { count } = await supabase
    .from("portal_push_suscripciones")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", req.portal.clienteId)
    .eq("activa", true);

  res.json({
    error: false,
    preferencias: data || { correo: true, push: true, whatsapp: true },
    dispositivos: count || 0,
  });
}));

/** PATCH /portal/preferencias   { correo?, push?, whatsapp? } */
router.patch("/preferencias", requiereSesion, ruta(async (req, res) => {
  const cambios = {};
  for (const k of ["correo", "push", "whatsapp"]) {
    if (typeof req.body?.[k] === "boolean") cambios[k] = req.body[k];
  }
  if (!Object.keys(cambios).length) return fallo(res, 400, "Nada que actualizar.");

  const { error } = await supabase
    .from("portal_preferencias_notif")
    .upsert(
      { cliente_id: req.portal.clienteId, ...cambios, actualizado_en: new Date().toISOString() },
      { onConflict: "cliente_id" }
    );

  if (error) return fallo(res, 500, "No se pudieron guardar las preferencias.");
  res.json({ error: false, preferencias: cambios });
}));

// ═════════════════════════════════════════════════════════════════════════════
// Sesión
// ═════════════════════════════════════════════════════════════════════════════

/** GET /portal/sesion — para revalidar el token al abrir la app. */
router.get("/sesion", requiereSesion, ruta(async (req, res) => {
  const { data: cliente } = await supabase
    .from("clientes").select("nombre").eq("id", req.portal.clienteId).maybeSingle();
  const { data: vehiculo } = await supabase
    .from("vehiculos").select("id, placa, marca, modelo, ano, color")
    .eq("id", req.portal.vehiculoId).maybeSingle();

  res.json({
    error: false,
    cliente: { nombre: cliente?.nombre || "" },
    vehiculo,
    nivel: req.portal.nivel,
  });
}));

/** POST /portal/salir */
router.post("/salir", requiereSesion, ruta(async (req, res) => {
  await supabase
    .from("portal_sesiones")
    .update({ revocado_en: new Date().toISOString(), revocado_motivo: "cierre de sesión del cliente" })
    .eq("id", req.portal.sesionId);
  res.json({ error: false });
}));

/**
 * GET /portal/salud — diagnóstico de configuración, sin datos sensibles.
 *
 * Comprueba también que las tablas del portal existan. Es lo primero que hay
 * que mirar cuando el portal "no conecta": casi siempre es que faltó correr
 * el SQL, no un problema de red.
 */
router.get("/salud", ruta(async (req, res) => {
  const tablas = [
    "portal_sesiones", "portal_otp", "portal_codigos_mostrador", "portal_intentos",
    "notificaciones_cliente", "portal_push_suscripciones", "portal_preferencias_notif",
  ];

  const estadoTablas = {};
  await Promise.all(
    tablas.map(async (t) => {
      const { error } = await supabase.from(t).select("*", { head: true, count: "exact" }).limit(1);
      estadoTablas[t] = error ? `FALTA (${error.code || error.message})` : "ok";
    })
  );

  const faltantes = Object.entries(estadoTablas).filter(([, v]) => v !== "ok").map(([k]) => k);

  const tieneSecreto = Boolean(process.env.PORTAL_JWT_SECRET || process.env.JWT_SECRET);
  const tieneAdmin = Boolean(process.env.PORTAL_ADMIN_SECRET);

  // Lista concreta de lo que falta, en orden de importancia. Sin esto hay que
  // ir cruzando campos a mano para entender por qué el portal no funciona.
  const pendientes = [];
  if (!tieneSecreto)
    pendientes.push(
      "FALTA PORTAL_JWT_SECRET en Railway — sin esto nadie puede iniciar sesión. " +
        "Genérala: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\""
    );
  if (faltantes.length)
    pendientes.push(
      `FALTAN ${faltantes.length} tabla(s) (${faltantes.join(", ")}) — corre ` +
        "crm-backend/sql/portal_cliente.sql y crm-backend/sql/notificaciones_cliente.sql en Supabase."
    );
  if (!tieneAdmin)
    pendientes.push(
      "FALTA PORTAL_ADMIN_SECRET en Railway — la secretaria no puede generar códigos de mostrador."
    );
  if (!req.app.get("trust proxy"))
    pendientes.push("FALTA app.set('trust proxy', 1) — el límite de intentos no distingue IPs.");

  res.json({
    error: false,
    listo: pendientes.length === 0,
    pendientes,
    token_configurado: tieneSecreto,
    admin_configurado: tieneAdmin,
    canal_correo: hayCanalDeCorreo(),
    canal_push: await hayPush(),
    canal_whatsapp: hayCanalDeWhatsApp(),
    trust_proxy: req.app.get("trust proxy") ? "activo" : "INACTIVO",
    ip_detectada: ipDe(req),
    tablas: estadoTablas,
  });
}));

// ═════════════════════════════════════════════════════════════════════════════
// Manejador de errores del router
// ═════════════════════════════════════════════════════════════════════════════
//
// Sin esto, cualquier excepción dentro de un handler async deja la petición sin
// respuesta y el cliente ve "sin conexión" aunque el servidor esté vivo.
// Con `ruta()` arriba, todos los errores terminan aquí.

router.use((err, req, res, next) => {
  const codigo = err?.code || "";
  const texto = String(err?.message || err || "");

  console.error("[portal] error no controlado:", codigo, texto);

  if (res.headersSent) return next(err);

  // ── Falta la clave de firma ──────────────────────────────────────────────
  // Síntoma típico: buscar la placa funciona, pero al verificar el teléfono
  // falla — porque ahí es donde se emite el token de sesión.
  if (codigo === "PORTAL_SIN_SECRETO") {
    return res.status(503).json({
      error: true,
      mensaje: "El portal todavía no está listo. Avísale al taller.",
      detalle_tecnico: texto,
      accion_requerida: "Define PORTAL_JWT_SECRET en Railway y redespliega.",
    });
  }

  // ── Faltan las tablas (42P01 = relation does not exist) ──────────────────
  if (codigo === "42P01" || /does not exist|schema cache/i.test(texto)) {
    return res.status(503).json({
      error: true,
      mensaje: "El portal aún no está instalado en la base de datos. Avísale al taller.",
      detalle_tecnico: texto,
      accion_requerida:
        "Corre crm-backend/sql/portal_cliente.sql y crm-backend/sql/notificaciones_cliente.sql " +
        "en el SQL Editor de Supabase. GET /portal/salud dice cuáles faltan.",
    });
  }

  // ── Cualquier otra cosa ──────────────────────────────────────────────────
  // Se incluye el detalle técnico a propósito: sin él, diagnosticar exige
  // acceso a los logs de Railway, y el mensaje genérico no orienta a nadie.
  res.status(500).json({
    error: true,
    mensaje: "Ocurrió un problema en el servidor. Intenta de nuevo en un momento.",
    detalle_tecnico: texto.slice(0, 300),
    ...(codigo ? { codigo } : {}),
  });
});

export default router;
