"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import BusquedaGlobal from "@/components/BusquedaGlobal";

const PERMISOS = {
  gerente:   ["dashboard","recepcion","taller","aprobacion","clientes","vehiculos","inspeccion","inventario","suplidores","ventas","facturacion","cafeteria","usuarios","configuracion","mantenimiento","inteligencia","contabilidad"],
  secretaria:["dashboard","recepcion","taller","aprobacion","clientes","vehiculos","inspeccion","facturacion","mantenimiento","contabilidad","inteligencia"],
  tecnico:   ["taller","inspeccion","mantenimiento"],
  almacen:   ["inventario","suplidores","ventas"],
  cafeteria: ["cafeteria"],
};

const MENU = [
  { href: "/dashboard",     icon: "📊", label: "Dashboard",    key: "dashboard"     },
  // ── Centro operativo ────────────────────────────────────────────────
  { href: "/taller",        icon: "🔧", label: "Mi Taller",    key: "taller"        },
  // ── Gestión de clientes ─────────────────────────────────────────────
  { href: "/clientes",      icon: "👤", label: "Clientes",     key: "clientes"      },
  { href: "/vehiculos",     icon: "🚙", label: "Vehículos",    key: "vehiculos"     },
  // ── Operaciones ─────────────────────────────────────────────────────
  { href: "/inventario",    icon: "📦", label: "Inventario",   key: "inventario"    },
  { href: "/facturacion",   icon: "🧾", label: "Facturas",     key: "facturacion"   },
  // ── Acceso rápido interno (solo roles con permiso) ───────────────────
  { href: "/recepcion",     icon: "🚗", label: "Recepción",    key: "recepcion"     },
  { href: "/aprobacion",    icon: "✅", label: "Aprobaciones", key: "aprobacion"    },
  { href: "/usuarios",      icon: "👥", label: "Usuarios",     key: "usuarios"      },
  { href: "/contabilidad",  icon: "💰", label: "Contabilidad", key: "contabilidad"  },
  { href: "/configuracion", icon: "⚙️", label: "Configuración",key: "configuracion" },
];

const RUTAS_PUBLICAS = ["/login", "/cliente"];

export default function ClientLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [usuario, setUsuario] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [listo, setListo] = useState(false);

  const esPublica = RUTAS_PUBLICAS.some(r => pathname.startsWith(r));

  useEffect(() => {
    if (esPublica) { setListo(true); return; }
    const u = localStorage.getItem("usuario");
    if (!u) { router.push("/login"); return; }
    setUsuario(JSON.parse(u));
    setListo(true);
  }, [pathname]);

  if (!listo) return null;

  if (esPublica) return <>{children}</>;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>

      {/* SIDEBAR */}
      <aside style={{
        width: sidebarOpen ? 250 : 70,
        background: "#111827",
        color: "#fff",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
      }}>

        {/* LOGO AQUÍ 👇 */}
        <div style={{ padding: 20, flexShrink: 0 }}>
          <Image src="/logo.png" alt="Logo" width={120} height={40} />
        </div>

        {/* MENU */}
        {MENU.filter(item => {
          if (!usuario) return true; // mostrar todo mientras carga para evitar parpadeo
          const rol = ((usuario as any).rol || "").toLowerCase() as keyof typeof PERMISOS;
          const perms = PERMISOS[rol] || Object.values(PERMISOS).flat();
          return perms.includes(item.key);
        }).map(item => {
          const activo = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <div style={{
                padding: "10px 16px",
                background: activo ? "#1d4ed8" : "transparent",
                borderLeft: activo ? "3px solid #60a5fa" : "3px solid transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: activo ? "#fff" : "#d1d5db",
                fontWeight: activo ? 700 : 400,
                fontSize: 14,
                transition: "background 0.15s"
              }}>
                <span>{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </div>
            </Link>
          );
        })}
      </aside>

      {/* CONTENIDO */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* HEADER con búsqueda global */}
        <header style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 24px",
          background: "#0f172a",
          borderBottom: "1px solid #1e293b",
          position: "sticky",
          top: 0,
          zIndex: 100,
          gap: 16,
        }}>
          <div style={{ flex: 1 }} />
          <BusquedaGlobal />
          {usuario && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>
                {(usuario as any).nombre}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                background: "#1e293b", color: "#94a3b8", textTransform: "uppercase",
              }}>
                {(usuario as any).rol}
              </span>
              <button
                onClick={() => {
                  localStorage.removeItem("usuario");
                  document.cookie = "usuario=;path=/;max-age=0";
                  window.location.href = "/login";
                }}
                style={{
                  padding: "5px 12px", borderRadius: 7, border: "1px solid #334155",
                  background: "transparent", color: "#64748b", cursor: "pointer", fontSize: 12,
                }}
              >Salir</button>
            </div>
          )}
        </header>

        <main style={{ flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  );
}