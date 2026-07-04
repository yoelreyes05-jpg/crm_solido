"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import BusquedaGlobal from "@/components/BusquedaGlobal";
import AsistenteIA from "@/components/AsistenteIA";
import { PERMISOS_DEFAULT, type PermisosConfig } from "@/lib/permisos";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// Items especiales que no forman parte del sistema de módulos de permisos.
// Se controlan por rol fijo y siempre respetan estas reglas sin importar
// lo que el gerente configure en /permisos.
const ACCESO_FIJO: Record<string, string[]> = {
  "dashboard":        ["gerente", "secretaria", "tecnico", "almacen"],
  "asistente-correo": ["gerente", "secretaria"],
};

const MENU = [
  // ── General ───────────────────────────────────────────────────────────────
  { href: "/dashboard",          icon: "📊", label: "Dashboard",            key: "dashboard"        },
  // ── Flujo taller ─────────────────────────────────────────────────────────
  { href: "/recepcion",          icon: "🚗", label: "Recepción",            key: "recepcion"        },
  { href: "/taller",             icon: "🔧", label: "Mi Taller",            key: "taller"           },
  { href: "/aprobacion",         icon: "✅", label: "Aprobaciones",         key: "aprobacion"       },
  // ── Clientes ─────────────────────────────────────────────────────────────
  { href: "/clientes",           icon: "👤", label: "Clientes",             key: "clientes"         },
  { href: "/vehiculos",          icon: "🚙", label: "Vehículos",            key: "vehiculos"        },
  { href: "/ordenes",            icon: "📋", label: "Órdenes",              key: "ordenes"          },
  { href: "/historial-vehiculo", icon: "📜", label: "Historial Vehículos",  key: "historial"        },
  // ── Almacén ──────────────────────────────────────────────────────────────
  { href: "/inventario",         icon: "📦", label: "Inventario",           key: "inventario"       },
  { href: "/suplidores",         icon: "🏭", label: "Suplidores",           key: "suplidores"       },
  // ── Finanzas ─────────────────────────────────────────────────────────────
  { href: "/ventas",             icon: "🛒", label: "Ventas POS",           key: "ventas"           },
  { href: "/facturacion",        icon: "🧾", label: "Facturas",             key: "facturacion"      },
  { href: "/contabilidad",       icon: "💰", label: "Contabilidad",         key: "contabilidad"     },
  // ── Servicios ────────────────────────────────────────────────────────────
  { href: "/cafeteria",          icon: "☕", label: "Cafetería",            key: "cafeteria"        },
  // ── Administración ───────────────────────────────────────────────────────
  { href: "/mantenimiento",      icon: "🔩", label: "Mantenimiento",        key: "mantenimiento"    },
  { href: "/inteligencia",       icon: "🔮", label: "Inteligencia",         key: "inteligencia"     },
  { href: "/usuarios",           icon: "👥", label: "Usuarios",             key: "usuarios"         },
  { href: "/configuracion",      icon: "⚙️", label: "Configuración",        key: "configuracion"    },
  { href: "/permisos",           icon: "🔐", label: "Permisos",             key: "permisos"         },
  { href: "/auditoria",          icon: "🕵️", label: "Auditoría",            key: "auditoria"        },
  { href: "/asistente-correo",   icon: "✉️", label: "Asistente Correo",     key: "asistente-correo" },
];

const RUTAS_PUBLICAS = ["/login", "/cliente", "/estado", "/pantalla", "/menu"];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [usuario,        setUsuario]        = useState<any>(null);
  const [permisosConfig, setPermisosConfig] = useState<PermisosConfig | null>(null);
  const [sidebarOpen,    setSidebarOpen]    = useState(true);
  const [listo,          setListo]          = useState(false);

  const esPublica = RUTAS_PUBLICAS.some(r => pathname.startsWith(r));

  // Cargar usuario desde localStorage
  useEffect(() => {
    if (esPublica) { setListo(true); return; }
    const raw = localStorage.getItem("usuario");
    if (!raw) { router.push("/login"); return; }
    setUsuario(JSON.parse(raw));
    setListo(true);
  }, [pathname]);

  // Cargar permisos del backend cuando hay usuario no-gerente
  useEffect(() => {
    if (!usuario) return;
    const rol = (usuario.rol || "").toLowerCase();
    if (rol === "gerente") return; // gerente ve todo, sin fetch necesario
    fetch(`${API}/permisos`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && typeof data === "object" && Object.keys(data).length > 0) {
          setPermisosConfig(data);
        }
        // Si el backend no tiene config guardada, permisosConfig queda null
        // y el filtro usará PERMISOS_DEFAULT automáticamente
      })
      .catch(() => {}); // silencioso — usa PERMISOS_DEFAULT como fallback
  }, [usuario]);

  if (!listo) return null;
  if (esPublica) return <>{children}</>;

  // ── Filtro del menú ──────────────────────────────────────────────────────
  const menuVisible = MENU.filter(item => {
    if (!usuario) return false;
    const rol = (usuario.rol || "").toLowerCase();

    // Gerente siempre ve todo
    if (rol === "gerente") return true;

    // Items con acceso fijo (no controlados por el módulo de permisos)
    if (item.key in ACCESO_FIJO) return ACCESO_FIJO[item.key].includes(rol);

    // Resto: revisar permiso "ver" con la config guardada (o defaults si no hay)
    const cfg = permisosConfig ?? PERMISOS_DEFAULT;
    return cfg[rol]?.[item.key]?.ver === true;
  });

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>

      {/* ── SIDEBAR ────────────────────────────────────────────────────────── */}
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
        transition: "width 0.2s ease",
      }}>

        {/* Logo + toggle */}
        <div style={{ padding: "16px 20px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {sidebarOpen && <Image src="/logo.png" alt="Logo" width={120} height={40} />}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{
              background: "transparent", border: "none", color: "#64748b",
              cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 4,
              marginLeft: sidebarOpen ? 0 : "auto", marginRight: sidebarOpen ? 0 : "auto",
            }}
            title={sidebarOpen ? "Colapsar" : "Expandir"}
          >
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        {/* Items del menú */}
        {menuVisible.map(item => {
          const activo = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div
                title={!sidebarOpen ? item.label : undefined}
                style={{
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
                  transition: "background 0.15s",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
              >
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </div>
            </Link>
          );
        })}
      </aside>

      {/* ── CONTENIDO PRINCIPAL ────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh", overflow: "hidden" }}>

        {/* Header */}
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
                {usuario.nombre}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                background: "#1e293b", color: "#94a3b8", textTransform: "uppercase",
              }}>
                {usuario.rol}
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
              >
                Salir
              </button>
            </div>
          )}
        </header>

        <main style={{ flex: 1 }}>
          {children}
        </main>
      </div>

      <AsistenteIA />
    </div>
  );
}
