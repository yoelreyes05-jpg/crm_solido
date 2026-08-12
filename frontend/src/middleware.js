import { NextResponse } from "next/server";

// Rutas que no requieren sesión activa
const RUTAS_PUBLICAS = [
  "/login",
  "/aloha/login",
  "/",
  "/cliente",
  "/estado",
  "/pantalla",
  "/catalogo",
  "/repuestos",
  "/menu",
  // Pantalla del altavoz: se deja encendida todo el día en la PC conectada a
  // las bocinas del taller. Sin esto, el middleware la manda a /login y los
  // llamados dejan de sonar en cuanto expira la cookie. Solo lee la cola de
  // anuncios y marca lo que ya sonó.
  "/altavoz/receptor",
  "/manifest.json",
  "/sw.js",
];

// ─────────────────────────────────────────────────────────────────────────────
// 🌺 Aislamiento de Aloha Perfume Store
//
// Aloha vive dentro de esta misma app, pero su personal no debe ver el CRM del
// taller. Dos reglas, y las dos viven aquí porque el middleware es lo único que
// corre antes de pintar la página — esconder el menú en el layout no sirve, la
// URL escrita a mano se lo salta.
//
//   1. Sin sesión dentro de /aloha  → va a /aloha/login, no al login azul.
//   2. Con rol "aloha" fuera de /aloha → vuelve a /aloha.
//
// El gerente queda fuera de la regla 2 a propósito: entra por el login normal y
// sigue viendo Aloha como un módulo más del CRM.
// ─────────────────────────────────────────────────────────────────────────────
const RAIZ_ALOHA  = "/aloha";
const LOGIN_ALOHA = "/aloha/login";

/** ¿La ruta pertenece al territorio de Aloha? */
function esRutaAloha(pathname) {
  return pathname === RAIZ_ALOHA || pathname.startsWith(RAIZ_ALOHA + "/");
}

/**
 * Saca el rol de la cookie de sesión.
 *
 * La cookie la escribe el navegador con `encodeURIComponent(JSON.stringify(u))`,
 * y según el caso llega codificada o no. Se intentan las dos lecturas antes de
 * rendirse.
 *
 * Devuelve `null` si no se pudo leer, y quien llama debe tratar ese `null` como
 * "no sé, déjalo pasar". Si un cambio de formato de la cookie dejara esto
 * ciego, el efecto sería perder el confinamiento — molesto pero recuperable —
 * en vez de encerrar a todo el taller fuera de su propio sistema.
 */
function rolDeCookie(valor) {
  if (!valor) return null;
  const intentos = [valor];
  try { intentos.push(decodeURIComponent(valor)); } catch { /* valor no codificado */ }
  for (const intento of intentos) {
    try {
      const usuario = JSON.parse(intento);
      if (usuario && usuario.rol) return String(usuario.rol).toLowerCase();
    } catch { /* probar la siguiente lectura */ }
  }
  return null;
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Excluir archivos estáticos y rutas públicas
  const esPublica =
    RUTAS_PUBLICAS.some(r => pathname === r || pathname.startsWith(r + "/")) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/icons") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".webp") ||
    pathname.includes("favicon");

  if (esPublica) return NextResponse.next();

  // Verificar que el usuario tenga sesión activa
  const usuarioCookie = request.cookies.get("usuario")?.value;
  if (!usuarioCookie) {
    // Quien intentaba entrar a la tienda vuelve a la puerta de la tienda.
    const destino = esRutaAloha(pathname) ? LOGIN_ALOHA : "/login";
    return NextResponse.redirect(new URL(destino, request.url));
  }

  // El personal de Aloha no sale de Aloha.
  const rol = rolDeCookie(usuarioCookie);
  if (rol === "aloha" && !esRutaAloha(pathname)) {
    return NextResponse.redirect(new URL(RAIZ_ALOHA, request.url));
  }

  // Sesión válida — el control de acceso por módulo lo maneja el frontend
  // dinámicamente según la config guardada en /permisos por el gerente.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico|sw\\.js|workbox-.*\\.js|manifest\\.json).*)",
  ],
};
