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

  // 1. RUTAS PÚBLICAS (No requieren login ni revisión de rol)
  // Agregamos /cliente, /catalogo y archivos de configuración de la PWA
  const esPublica = 
    pathname === "/login" || 
    pathname.startsWith("/cliente") || 
    pathname.startsWith("/catalogo") ||
    pathname.startsWith("/manifest.json") ||
    pathname.startsWith("/sw.js") || // Service Worker
    pathname.startsWith("/icons") ||
    pathname.startsWith("/_next") || 
    pathname.startsWith("/api") ||
    pathname.includes("favicon.ico");

  if (esPublica) {
    return NextResponse.next();
  }

  // 2. VERIFICACIÓN DE SESIÓN (Para empleados/gerente)
  const usuarioCookie = request.cookies.get("usuario")?.value;

  if (!usuarioCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const usuario = JSON.parse(decodeURIComponent(usuarioCookie));
    
    // El gerente tiene acceso total
    if (usuario.rol === "gerente") return NextResponse.next();

    // 3. VERIFICACIÓN DE PERMISOS POR ROL
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};