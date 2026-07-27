// crm-backend/services/tokenPortal.mjs
// Tokens firmados para la sesión del cliente en el portal.
//
// Sin dependencias nuevas: HMAC-SHA256 con node:crypto en vez de jsonwebtoken.
// Un token es  base64url(payload) + "." + base64url(hmac)  — mismo esquema que
// un JWT sin cabecera, suficiente porque solo lo emite y valida este backend.
//
// El payload lleva el id de la fila en portal_sesiones, así que además de la
// firma se puede revocar la sesión desde la base (cliente vendió el vehículo,
// teléfono robado, etc.).

import crypto from "node:crypto";

const SECRETO =
  process.env.PORTAL_JWT_SECRET ||
  process.env.JWT_SECRET ||
  "";

if (!SECRETO) {
  console.warn(
    "[portal] PORTAL_JWT_SECRET no está definida. Genera una con:\n" +
      "  node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"\n" +
      "y ponla en Railway. Sin ella el portal rechaza todo acceso."
  );
}

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const deB64u = (str) => Buffer.from(str, "base64url").toString("utf8");

function firmar(datos) {
  return crypto.createHmac("sha256", SECRETO).update(datos).digest("base64url");
}

/**
 * Emite un token de sesión.
 * @param {{sid:string, cid:number, vid:number|null, nivel:string}} payload
 * @param {number} diasVigencia
 */
export function emitirToken(payload, diasVigencia = 30) {
  if (!SECRETO) {
    // Se marca con un código para que el router lo distinga de un fallo real y
    // responda con instrucciones en vez de un 500 genérico. Sin la clave, el
    // portal encuentra el vehículo pero nunca logra crear la sesión.
    const e = new Error(
      "PORTAL_JWT_SECRET no está configurada en el servidor. " +
        "Genérala con: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\" " +
        "y ponla como variable de entorno en Railway."
    );
    e.code = "PORTAL_SIN_SECRETO";
    throw e;
  }
  const cuerpo = b64u(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + diasVigencia * 86400,
    })
  );
  return `${cuerpo}.${firmar(cuerpo)}`;
}

/**
 * Verifica firma y expiración. Devuelve el payload o null.
 * No consulta la base — de eso se encarga el middleware (revocación).
 */
export function verificarToken(token) {
  if (!SECRETO || typeof token !== "string") return null;
  const partes = token.split(".");
  if (partes.length !== 2) return null;

  const [cuerpo, firma] = partes;
  const esperada = firmar(cuerpo);

  // Comparación en tiempo constante: evita distinguir firmas por latencia.
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(deB64u(cuerpo));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Hash del token para guardarlo en portal_sesiones (nunca el token en claro). */
export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ─── Códigos de un solo uso ──────────────────────────────────────────────────

/**
 * Genera un código numérico legible por teléfono.
 * 6 dígitos para OTP de correo, 8 para el código de mostrador (vive 24h,
 * así que conviene más entropía).
 */
export function generarCodigo(digitos = 6) {
  const max = 10 ** digitos;
  // randomInt es uniforme; Math.random() no sirve para esto.
  return String(crypto.randomInt(0, max)).padStart(digitos, "0");
}

/** Devuelve { salt, hash } para guardar. El código nunca se persiste en claro. */
export function hashCodigo(codigo, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto
    .createHash("sha256")
    .update(`${codigo}${salt}`)
    .digest("hex");
  return { salt, hash };
}

/** Compara en tiempo constante el código que envió el cliente. */
export function verificarCodigo(codigo, salt, hashGuardado) {
  const { hash } = hashCodigo(String(codigo || "").trim(), salt);
  const a = Buffer.from(hash);
  const b = Buffer.from(hashGuardado || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ─── Utilidades de normalización ─────────────────────────────────────────────

/** Solo dígitos. "(809) 555-1234" → "8095551234" */
export const soloDigitos = (s) => String(s || "").replace(/\D/g, "");

/** Últimos N dígitos del teléfono, o "" si no hay suficientes. */
export function ultimosDigitos(telefono, n = 4) {
  const d = soloDigitos(telefono);
  return d.length >= n ? d.slice(-n) : "";
}

/** Normaliza placa: mayúsculas, sin espacios ni guiones. "a 123-456" → "A123456" */
export const normalizarPlaca = (p) =>
  String(p || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Enmascara un correo para mostrarlo sin revelarlo: yoelre***@gmail.com */
export function enmascararCorreo(correo) {
  const s = String(correo || "");
  const i = s.indexOf("@");
  if (i < 1) return "***";
  const usuario = s.slice(0, i);
  const dominio = s.slice(i);
  const visible = usuario.slice(0, Math.min(3, usuario.length));
  return `${visible}${"*".repeat(Math.max(3, usuario.length - visible.length))}${dominio}`;
}

/**
 * Enmascara un teléfono dejando ver SOLO los últimos 2 dígitos: ***-***-**34
 *
 * Importante: la verificación pide los últimos 4 dígitos. Si la pista mostrara
 * esos mismos 4, cualquiera que supiera la placa leería la respuesta en
 * pantalla y el segundo factor no serviría de nada.
 *
 * Con 2 visibles, el cliente reconoce cuál de sus números registró, pero un
 * extraño todavía tiene que adivinar los otros 2 — 100 combinaciones, que el
 * límite de 8 intentos por hora vuelve inviable.
 */
export function enmascararTelefono(telefono) {
  const dos = ultimosDigitos(telefono, 2);
  return dos ? `***-***-**${dos}` : "***";
}
