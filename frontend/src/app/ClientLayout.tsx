"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const PERMISOS = {
  gerente: ["dashboard","clientes","vehiculos","ordenes","diagnosticos","inventario","suplidores","ventas","facturacion","cafeteria","usuarios","configuracion"],
  secretaria: ["dashboard","clientes","vehiculos","ordenes","facturacion"],
  tecnico: ["ordenes","diagnosticos"],
  almacen: ["inventario","suplidores","ventas"],
  cafeteria: ["cafeteria"],
};

const MENU = [
  { href: "/dashboard", icon: "📊", label: "Dashboard", key: "dashboard" },
  { href: "/clientes", icon: "👤", label: "Clientes", key: "clientes" },
  { href: "/vehiculos", icon: "🚗", label: "Vehículos", key: "vehiculos" },
  { href: "/ordenes", icon: "🔧", label: "Órdenes", key: "ordenes" },
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
    <div style={{ display: "flex" }}>
      
      {/* SIDEBAR */}
      <aside style={{ width: sidebarOpen ? 250 : 70, background: "#111827", color: "#fff" }}>
        
        {/* LOGO AQUÍ 👇 */}
        <div style={{ padding: 20 }}>
          <Image src="/logo.png" alt="Logo" width={120} height={40} />
        </div>

        {/* MENU */}
        {MENU.map(item => (
          <Link key={item.href} href={item.href}>
            <div style={{ padding: 10 }}>{item.icon} {item.label}</div>
          </Link>
        ))}
      </aside>

      {/* CONTENIDO */}
      <main style={{ flex: 1 }}>
        {children}
      </main>
    </div>
  );
}