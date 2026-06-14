import { NextResponse } from "next/server";

// Rutas que no requieren sesión activa
const RUTAS_PUBLICAS = [
  "/login",
  "/",
  "/cliente",
  "/estado",
  "/pantalla",
  "/catalogo",
  "/repuestos",
  "/menu",
  "/manifest.json",
  "/sw.js",
];

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
    return NextResponse.redirect(new URL("/login", request.url));
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
