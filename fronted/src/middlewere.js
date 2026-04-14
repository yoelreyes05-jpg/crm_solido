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

  if (pathname === "/login" || pathname.startsWith("/_next") || pathname.startsWith("/api")) {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};