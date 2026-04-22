import { NextResponse } from "next/server";

const PERMISOS = {
  gerente:    ["/"],
  secretaria: ["/dashboard", "/clientes", "/vehiculos", "/ordenes", "/facturacion"],
  tecnico:    ["/ordenes", "/diagnosticos"],
  almacen:    ["/inventario", "/suplidores", "/ventas"],
  cafeteria:  ["/cafeteria"],
};

export function middleware(request) {
  const { pathname } = request.nextUrl;

  const esPublica =
    pathname === "/login" ||
    pathname.startsWith("/cliente") ||
    pathname.startsWith("/catalogo") ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname === "/workbox-*.js" ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.endsWith(".png") ||   // ← NUEVO: todas las imágenes PNG
    pathname.endsWith(".jpg") ||   // ← NUEVO
    pathname.endsWith(".ico") ||   // ← NUEVO
    pathname.endsWith(".svg") ||   // ← NUEVO
    pathname.includes("favicon");

  if (esPublica) {
    return NextResponse.next();
  }

  const usuarioCookie = request.cookies.get("usuario")?.value;
  if (!usuarioCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const usuario = JSON.parse(decodeURIComponent(usuarioCookie));

    if (usuario.rol === "gerente") return NextResponse.next();

    const permitidas = PERMISOS[usuario.rol] || [];
    const tieneAcceso = permitidas.some(ruta =>
      pathname === ruta || pathname.startsWith(ruta + "/")
    );

    if (!tieneAcceso) {
      const destinos = {
        secretaria: "/dashboard",
        tecnico: "/ordenes",
        almacen: "/inventario",
        cafeteria: "/cafeteria"
      };
      return NextResponse.redirect(new URL(destinos[usuario.rol] || "/login", request.url));
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