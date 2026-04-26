
"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { API_URL as API } from "@/config";

const PERMISOS = {
  gerente:    ["dashboard","clientes","vehiculos","ordenes","diagnosticos","inventario","contabilidad","suplidores","ventas","facturacion","cafeteria","usuarios","configuracion","historial-vehiculo","pantalla"],
  secretaria: ["dashboard","clientes","vehiculos","contabilidad","diagnostico","ordenes","facturacion","historial-vehiculo"],
  tecnico:    ["ordenes","dashboard","diagnosticos","historial-vehiculo"],
  almacen:    ["inventario","suplidores","ventas"],
  cafeteria:  ["cafeteria"],
};

const MENU = [
  { href: "/dashboard",          icon: "📊", label: "Dashboard",           key: "dashboard",           iconBg: "linear-gradient(145deg,#1d4ed8,#3b82f6)",    iconShadow: "0 4px 12px rgba(59,130,246,0.55),inset 0 1px 0 rgba(255,255,255,0.25)" },
  { href: "/clientes",           icon: "👤", label: "Clientes",            key: "clientes",            iconBg: "linear-gradient(145deg,#065f46,#10b981)",    iconShadow: "0 4px 12px rgba(16,185,129,0.55),inset 0 1px 0 rgba(255,255,255,0.25)" },
  { href: "/vehiculos",          icon: "🚗", label: "Vehículos",           key: "vehiculos",           iconBg: "linear-gradient(145deg,#312e81,#6366f1)",    iconShadow: "0 4px 12px rgba(99,102,241,0.55),inset 0 1px 0 rgba(255,255,255,0.25)" },
  { href: "/ordenes",            icon: "🔧", label: "Órdenes de Trabajo",  key: "ordenes",             iconBg: "linear-gradient(145deg,#92400e,#f59e0b)",    iconShadow: "0 4px 12px rgba(245,158,11,0.55),inset 0 1px 0 rgba(255,255,255,0.25)" },
  { href: "/diagnosticos",       icon: "🔬", label: "Diagnósticos",        key: "diagnosticos",        iconBg: "linear-gradient(145deg,#4c1d95,#8b5cf6)",    iconShadow: "0 4px 12px rgba(139,92,246,0.55),inset 0 1px 0 rgba(255,255,255,0.25)" },
  { href: "/inventario",         icon: "📦", label: "Inventario",          key: "inventario",          iconBg: "linear-gradient(145deg,#0e7490,#06b6d4)",    iconShadow: "0 4px 12px rgba(6,182,212,0.55),inset 0 1px 0 rgba(255,255,255,0.25)" },
  { href: "/suplidores",         icon: "🚚", label: "Suplidores",          key: "suplidores",          iconBg: "linear-gradient(145deg,#7c2d12,#ea580c)",    iconShadow: "0 4px 12px rgba(234,88,12,0.55),inset 0 1px 0 rgba(255,255,255,0.25)" },
  { href: "/ventas",             icon: "💰", label: "Ventas",              key: "ventas",              iconBg: "linear-gradient(145deg,#14532d,#22c55e)",    iconShadow: "0 4px 12px rgba(34,197,94,0.55),inset 0 1px 0 rgba(255,255,255,0.25)" },
  { href: "/facturacion",        icon: "🧾", label: "Facturación",         key: "facturacion",         iconBg: "linear-gradient(145deg,#1e3a5f,#0ea5e9)",    iconShadow: "0 4px 12px rgba(14,165,233,0.55),inset 0 1px 0 rgba(255,255,255,0.25)" },
  { href: "/cafeteria",          icon: "☕", label: "Cafetería POS",       key: "cafeteria",           iconBg: "linear-gradient(145deg,#431407,#b45309)",    iconShadow: "0 4px 12px rgba(180,83,9,0.55),inset 0 1px 0 rgba(255,255,255,0.25)" },
  { href: "/contabilidad",       icon: "🧮", label: "Contabilidad",        key: "contabilidad",        iconBg: "linear-gradient(145deg,#134e4a,#14b8a6)",    iconShadow: "0 4px 12px rgba(20,184,166,0.55),inset 0 1px 0 rgba(255,255,255,0.25)" },
  { href: "/historial-vehiculo", icon: "📚", label: "Historial Vehículos", key: "historial-vehiculo",  iconBg: "linear-gradient(145deg,#1e1b4b,#4f46e5)",    iconShadow: "0 4px 12px rgba(79,70,229,0.55),inset 0 1px 0 rgba(255,255,255,0.25)" },
  { href: "/usuarios",           icon: "👥", label: "Usuarios",            key: "usuarios",            iconBg: "linear-gradient(145deg,#1f2937,#6b7280)",    iconShadow: "0 4px 12px rgba(107,114,128,0.55),inset 0 1px 0 rgba(255,255,255,0.25)" },
  { href: "/configuracion",      icon: "⚙️", label: "Configuración",       key: "configuracion",       iconBg: "linear-gradient(145deg,#111827,#374151)",    iconShadow: "0 4px 12px rgba(55,65,81,0.55),inset 0 1px 0 rgba(255,255,255,0.25)" },
  { href: "/pantalla",           icon: "📺", label: "Pantalla TV",          key: "pantalla",            iconBg: "linear-gradient(145deg,#0c4a6e,#0284c7)",    iconShadow: "0 4px 12px rgba(2,132,199,0.55),inset 0 1px 0 rgba(255,255,255,0.25)" },
];

// Rutas que NO usan el sidebar
const RUTAS_PUBLICAS = ["/login", "/cliente", "/estado", "/pantalla"];

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


        <meta name="theme-color" content="#080c14" />


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

          {/* LOGO */}
          <div style={{
            padding: "14px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", gap: 10,
            background: "linear-gradient(180deg,rgba(59,130,246,0.08) 0%,transparent 100%)"
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11, flexShrink: 0, overflow: "hidden",
              boxShadow: "0 4px 14px rgba(59,130,246,0.4),inset 0 1px 0 rgba(255,255,255,0.2)",
              border: "1.5px solid rgba(59,130,246,0.3)"
            }}>
              <img src="/logo.png" alt="Logo Sólido" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            {sidebarOpen && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 900, fontSize: 13, lineHeight: 1.2, color: "#fff",
                  letterSpacing: 0.5
                }}>SÓLIDO AUTO</div>
                <div style={{
                  fontWeight: 600, fontSize: 10, letterSpacing: 1.5, marginTop: 2,
                  background: "linear-gradient(90deg,#3b82f6,#60a5fa)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
                }}>SERVICIO & CAFÉ</div>
              </div>
            )}
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
              marginLeft: "auto", background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#9ca3af", cursor: "pointer", fontSize: 13,
              flexShrink: 0, padding: "5px 7px", borderRadius: 8,
              transition: "background 0.15s"
            }}>
              {sidebarOpen ? "◀" : "▶"}
            </button>
          </div>

          {/* MENÚ */}
          <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
            {menuFiltrado.map(item => {
              const activo = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href} style={{
                  display: "flex", alignItems: "center",
                  gap: sidebarOpen ? 12 : 0,
                  padding: sidebarOpen ? "8px 10px" : "8px 0",
                  justifyContent: sidebarOpen ? "flex-start" : "center",
                  borderRadius: 12, marginBottom: 3,
                  background: activo ? "rgba(59,130,246,0.12)" : "transparent",
                  color: activo ? "#fff" : "#9ca3af",
                  textDecoration: "none", fontSize: 13, fontWeight: activo ? 700 : 500,
                  border: activo ? "1px solid rgba(59,130,246,0.25)" : "1px solid transparent",
                  transition: "all 0.15s", whiteSpace: "nowrap",
                  position: "relative"
                }}>
                  {/* ICON BADGE 3D */}
                  <span style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: (item as any).iconBg || "linear-gradient(145deg,#1f2937,#374151)",
                    boxShadow: activo
                      ? ((item as any).iconShadow || "0 4px 12px rgba(59,130,246,0.5)")
                      : "0 2px 6px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 17,
                    transform: activo ? "scale(1.08)" : "scale(1)",
                    transition: "all 0.15s",
                  }}>
                    {item.icon}
                  </span>
                  {sidebarOpen && (
                    <span style={{
                      flex: 1, overflow: "hidden", textOverflow: "ellipsis",
                      color: activo ? "#fff" : "#9ca3af"
                    }}>
                      {item.label}
                    </span>
                  )}
                  {/* DOT activo cuando sidebar cerrado */}
                  {!sidebarOpen && activo && (
                    <span style={{
                      position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                      width: 5, height: 5, borderRadius: "50%", background: "#3b82f6"
                    }} />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* USUARIO + LOGOUT */}
          <div style={{
            padding: "12px 10px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            background: "linear-gradient(0deg,rgba(0,0,0,0.2) 0%,transparent 100%)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: "linear-gradient(145deg,#1d4ed8,#3b82f6)",
                boxShadow: "0 4px 10px rgba(59,130,246,0.45),inset 0 1px 0 rgba(255,255,255,0.2)",
                color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 13,
              }}>
                {iniciales}
              </div>
              {sidebarOpen && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#f1f5f9" }}>
                    {usuario.nombre}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "capitalize", marginTop: 1 }}>{usuario.rol}</div>
                </div>
              )}
            </div>
            <button onClick={logout} style={{
              width: "100%", padding: sidebarOpen ? "9px" : "9px 0",
              background: "linear-gradient(135deg,#7f1d1d,#dc2626)",
              boxShadow: "0 3px 10px rgba(220,38,38,0.35)",
              color: "#fff", border: "none",
              borderRadius: 9, cursor: "pointer", fontWeight: 700, fontSize: 13,
              transition: "opacity 0.15s"
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