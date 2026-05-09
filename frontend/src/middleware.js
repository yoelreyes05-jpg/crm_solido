import { NextResponse } from "next/server";

const PERMISOS = {
  gerente: [
    "/dashboard", "/clientes", "/vehiculos", "/ordenes", "/diagnosticos",
    "/inventario", "/suplidores", "/ventas", "/facturacion", "/cafeteria",
    "/usuarios", "/configuracion", "/mantenimiento", "/inteligencia", "/contabilidad",
    "/inspeccion", "/historial-vehiculo",
  ],
  secretaria: [
    "/dashboard", "/clientes", "/vehiculos", "/ordenes",
    "/facturacion", "/mantenimiento", "/contabilidad",
    "/historial-vehiculo", "/inteligencia", "/inspeccion",
  ],
  tecnico:   ["/ordenes", "/diagnosticos", "/mantenimiento", "/inspeccion"],
  almacen:   ["/inventario", "/suplidores", "/ventas"],
  cafeteria: ["/cafeteria"],
};

export function middleware(request) {
  const { pathname } = request.nextUrl;

  const esPublica =
    pathname === "/login" ||
    pathname === "/" ||
    pathname.startsWith("/cliente") ||
    pathname.startsWith("/estado") ||
    pathname.startsWith("/pantalla") ||
    pathname.startsWith("/catalogo") ||
    pathname.startsWith("/repuestos") ||
    pathname.startsWith("/menu") ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".svg") ||
    pathname.includes("favicon");

  if (esPublica) return NextResponse.next();

  const usuarioCookie = request.cookies.get("usuario")?.value;
  if (!usuarioCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const usuario = JSON.parse(decodeURIComponent(usuarioCookie));
    // Normalizar rol a minúsculas por si acaso viene diferente de la DB
    const rol = (usuario.rol || "").toLowerCase();

    // Si el rol no está en la tabla de permisos, dejar pasar (acceso básico)
    if (!PERMISOS[rol]) return NextResponse.next();

    // Gerente tiene acceso total
    if (rol === "gerente") return NextResponse.next();

    const permitidas = PERMISOS[rol] || [];
    const tieneAcceso = permitidas.some(ruta =>
      pathname === ruta || pathname.startsWith(ruta + "/")
    );

    if (!tieneAcceso) {
      const destinos = {
        secretaria: "/dashboard",
        tecnico:    "/ordenes",
        almacen:    "/inventario",
        cafeteria:  "/cafeteria",
      };
      return NextResponse.redirect(new URL(destinos[rol] || "/dashboard", request.url));
    }
  } catch {
    // Si la cookie está mal formada, dejar pasar en vez de redirigir al login
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  // NUEVO: excluir archivos estáticos, imágenes y archivos PWA del matcher
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico|sw\\.js|workbox-.*\\.js|manifest\\.json).*)",
  ],
};