
"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { API_URL as API } from "@/config";

const PERMISOS = {
  gerente:    ["dashboard","clientes","vehiculos","ordenes","diagnosticos","inventario","suplidores","ventas","facturacion","cafeteria","usuarios","configuracion"],
  secretaria: ["dashboard","clientes","vehiculos","ordenes","facturacion"],
  tecnico:    ["ordenes","diagnosticos"],
  almacen:    ["inventario","suplidores","ventas"],
  cafeteria:  ["cafeteria"],
};

const MENU = [
  { href: "/dashboard",     icon: "📊", label: "Dashboard",          key: "dashboard" },
  { href: "/clientes",      icon: "👤", label: "Clientes",           key: "clientes" },
  { href: "/vehiculos",     icon: "🚗", label: "Vehículos",          key: "vehiculos" },
  { href: "/ordenes",       icon: "🔧", label: "Órdenes de Trabajo", key: "ordenes" },
  { href: "/diagnosticos",  icon: "🔬", label: "Diagnósticos",       key: "diagnosticos" },
  { href: "/inventario",    icon: "📦", label: "Inventario",         key: "inventario" },
  { href: "/suplidores",    icon: "🚚", label: "Suplidores",         key: "suplidores" },
  { href: "/ventas",        icon: "💰", label: "Ventas",             key: "ventas" },
  { href: "/facturacion",   icon: "🧾", label: "Facturación",        key: "facturacion" },
  { href: "/cafeteria",     icon: "☕", label: "Cafetería POS",      key: "cafeteria" },
  { href: "/usuarios",      icon: "👥", label: "Usuarios",           key: "usuarios" },
  { href: "/configuracion", icon: "⚙️", label: "Configuración",      key: "configuracion" },
];

// Rutas que NO usan el sidebar
const RUTAS_PUBLICAS = ["/login", "/cliente"];

export default function RootLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [usuario, setUsuario] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [listo, setListo] = useState(false);

  const esPublica = RUTAS_PUBLICAS.some(r => pathname === r || pathname.startsWith(r + "/") || pathname.startsWith(r + "?"));

  useEffect(() => {
    if (esPublica) { setListo(true); return; }
    const u = localStorage.getItem("usuario");
    if (!u) { router.push("/login"); return; }
    setUsuario(JSON.parse(u));
    setListo(true);
  }, [pathname]);

  const logout = () => {
    localStorage.removeItem("usuario");
    document.cookie = "usuario=;path=/;max-age=0";
    router.push("/login");
  };

  if (!listo) return (
    <html lang="es">
      <body style={{ margin: 0, background: "#f5f7fb" }} />
    </html>
  );

  // SIN SIDEBAR: login y cliente

// Para rutas públicas (login y cliente) agrega los meta tags PWA:
if (esPublica) return (
  <html lang="es">
  <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#111827" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Sólido Auto" />
        {/* Cambiado: Referencia al nuevo logo en el manifest e iconos */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="icon" href="/logo.png" />
        <title>Sólido Auto Servicio</title>
      </head>
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif" }}>
        {children}
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js');
              });
            }
          `
        }} />
      </body>
    </html>
  );


  if (!usuario) return (
    <html lang="es">
      <body style={{ margin: 0, background: "#f5f7fb" }} />
   

 </html>
  );

  const permitidos = PERMISOS[usuario.rol] || [];
  const menuFiltrado = MENU.filter(m => permitidos.includes(m.key));
  const iniciales = usuario.nombre
    ? usuario.nombre.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
    : "U";

  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif", display: "flex", minHeight: "100vh", background: "#f5f7fb", fontSize: 15 }}>

        {/* SIDEBAR */}
        <aside style={{
          width: sidebarOpen ? 250 : 68,
          background: "#111827",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.25s ease",
          position: "fixed",
          top: 0, left: 0, bottom: 0,
          zIndex: 100,
          overflowX: "hidden"
        }}>

         {/* LOGO SECCIÓN MODIFICADA */}
          <div style={{ padding: "16px 14px", borderBottom: "1px solid #1f2937", display: "flex", alignItems: "center", gap: 10 }}>
            <img 
              src="/logo.png" 
              alt="Logo Sólido" 
              style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0, objectFit: "contain" }} 
            />
            {sidebarOpen && (
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 14, lineHeight: 1.2, color: "#fff" }}>SÓLIDO AUTO</div>
                <div style={{ fontWeight: 400, fontSize: 11, color: "#3b82f6", letterSpacing: 1 }}>SERVICIO & CAFÉ</div>
              </div>
            )}

            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
              marginLeft: "auto", background: "none", border: "none",
              color: "#9ca3af", cursor: "pointer", fontSize: 18, flexShrink: 0, padding: 4
            }}>
              {sidebarOpen ? "◀" : "▶"}
            </button>
          </div>

          {/* MENÚ */}
          <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
            {menuFiltrado.map(item => {
              const activo = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 12px", borderRadius: 10, marginBottom: 4,
                  background: activo ? "#1f2937" : "transparent",
                  color: activo ? "#fff" : "#9ca3af",
                  textDecoration: "none", fontSize: 14, fontWeight: activo ? 700 : 500,
                  borderLeft: activo ? "3px solid #3b82f6" : "3px solid transparent",
                  transition: "all 0.15s", whiteSpace: "nowrap"
                }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                  {sidebarOpen && item.label}
                </Link>
              );
            })}
          </nav>

          {/* USUARIO + LOGOUT */}
          <div style={{ padding: "14px 12px", borderTop: "1px solid #1f2937" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: "#3b82f6", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 14, flexShrink: 0
              }}>
                {iniciales}
              </div>
              {sidebarOpen && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {usuario.nombre}
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", textTransform: "capitalize" }}>{usuario.rol}</div>
                </div>
              )}
            </div>
            <button onClick={logout} style={{
              marginTop: 12, width: "100%", padding: "9px",
              background: "#dc2626", color: "#fff", border: "none",
              borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14
            }}>
              {sidebarOpen ? "🚪 Cerrar Sesión" : "🚪"}
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ marginLeft: sidebarOpen ? 250 : 68, flex: 1, minHeight: "100vh", transition: "margin-left 0.25s ease" }}>
          {/* TOPBAR */}
          <div style={{
            background: "#fff", padding: "14px 28px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            position: "sticky", top: 0, zIndex: 50
          }}>
            <div style={{ fontSize: 15, color: "#555", fontWeight: 600 }}>
              {MENU.find(m => pathname.startsWith(m.href))?.icon} {MENU.find(m => pathname.startsWith(m.href))?.label || "Inicio"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 13, color: "#888" }}>
                Rol: <b style={{ color: "#111", textTransform: "capitalize" }}>{usuario.rol}</b>
              </span>
              <span style={{ fontSize: 13, color: "#888" }}>📞 809-712-2027</span>
            </div>
          </div>

          <div>{children}</div>
        </main>

      </body>
    </html>
  );
}