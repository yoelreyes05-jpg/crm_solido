"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const PERMISOS = {
  gerente: ["dashboard","clientes","vehiculos","ordenes","diagnosticos","inventario","suplidores","ventas","facturacion","cafeteria","usuarios","configuracion","mantenimiento","inteligencia","contabilidad"],
  secretaria: ["dashboard","clientes","vehiculos","ordenes","facturacion","mantenimiento","contabilidad"],
  tecnico: ["ordenes","diagnosticos","mantenimiento"],
  almacen: ["inventario","suplidores","ventas"],
  cafeteria: ["cafeteria"],
};

const MENU = [
  { href: "/dashboard",     icon: "📊", label: "Dashboard",     key: "dashboard" },
  { href: "/clientes",      icon: "👤", label: "Clientes",      key: "clientes" },
  { href: "/vehiculos",     icon: "🚗", label: "Vehículos",     key: "vehiculos" },
  { href: "/ordenes",       icon: "🔧", label: "Órdenes",       key: "ordenes" },
  { href: "/mantenimiento", icon: "🛠️", label: "Mantenimiento", key: "mantenimiento" },
  { href: "/inteligencia",  icon: "🔮", label: "Inteligencia",  key: "inteligencia" },
  { href: "/contabilidad",  icon: "💰", label: "Contabilidad",  key: "contabilidad" },
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
      <main style={{ flex: 1 }}>
        {children}
      </main>
    </div>
  );
}