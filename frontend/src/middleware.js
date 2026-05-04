import { NextResponse } from "next/server";

const PERMISOS = {
  gerente: [
    "/dashboard", "/clientes", "/vehiculos", "/ordenes", "/diagnosticos",
    "/inventario", "/suplidores", "/ventas", "/facturacion", "/cafeteria",
    "/usuarios", "/configuracion", "/mantenimiento", "/inteligencia", "/contabilidad",
  ],
  secretaria: [
    "/dashboard", "/clientes", "/vehiculos", "/ordenes",
    "/facturacion", "/mantenimiento", "/contabilidad",
    "/historial-vehiculo", "/inteligencia",
  ],
  tecnico:   ["/ordenes", "/diagnosticos", "/mantenimiento"],
  almacen:   ["/inventario", "/suplidores", "/ventas"],
  cafeteria: ["/cafeteria"],
};

export function middleware(request) {
  const { pathname } = request.nextUrl;

  const esPublica =
    pathname === "/login" ||
    pathname.startsWith("/cliente") ||
    pathname.startsWith("/catalogo") ||
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
      return NextResponse.redirect(new URL(destinos[rol] || "/login", request.url));
    }
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // NUEVO: excluir archivos estáticos, imágenes y archivos PWA del matcher
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico|sw\\.js|workbox-.*\\.js|manifest\\.json).*)",
  ],
};