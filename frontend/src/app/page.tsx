"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "https://crm-automotriz-3wde-production.up.railway.app";

const ESTADO_COLORES = {
  RECIBIDO: "#3b82f6", DIAGNOSTICO: "#f59e0b", REPARACION: "#ef4444",
  CONTROL_CALIDAD: "#8b5cf6", LISTO: "#10b981", ENTREGADO: "#6b7280"
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [sRes, oRes] = await Promise.all([
        fetch(`${API}/dashboard/stats`),
        fetch(`${API}/ordenes`)
      ]);
      const s = await sRes.json();
      const o = await oRes.json();
      setStats(s);
      setOrdenes(Array.isArray(o) ? o : []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const i = setInterval(loadData, 5000);
    return () => clearInterval(i);
  }, []);

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh", fontSize: 18, color: "#888" }}>
      Cargando dashboard...
    </div>
  );

  return (
    <div style={container}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={title}>📊 Dashboard</h1>
          <p style={{ color: "#888", fontSize: 15, margin: 0 }}>Sólido Auto Servicio — Vista general del taller</p>
        </div>
        <span style={{ fontSize: 13, color: "#aaa", background: "#fff", padding: "6px 14px", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          🔄 Actualiza cada 5s
        </span>
      </div>

      {/* KPIs */}
      <div style={kpiGrid}>
        {[
          { label: "🚗 En Taller", valor: (stats?.ordenes?.total || 0) - (stats?.ordenes?.entregado || 0), color: "#3b82f6" },
          { label: "✅ Listos", valor: stats?.ordenes?.listo || 0, color: "#10b981" },
          { label: "🔍 Diagnóstico", valor: stats?.ordenes?.diagnostico || 0, color: "#f59e0b" },
          { label: "🔧 En Reparación", valor: stats?.ordenes?.reparacion || 0, color: "#ef4444" },
          { label: "👥 Clientes", valor: stats?.clientes || 0, color: "#8b5cf6" },
          { label: "⚠️ Stock Bajo", valor: stats?.stockBajo || 0, color: stats?.stockBajo > 0 ? "#ef4444" : "#6b7280" },
        ].map(k => (
          <div key={k.label} style={{ background: "#fff", borderRadius: 14, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", borderLeft: `5px solid ${k.color}` }}>
            <div style={{ fontSize: 14, color: "#888", marginBottom: 10, fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: "#111" }}>{k.valor}</div>
          </div>
        ))}
      </div>

      {/* ESTADO TALLER */}
      <div style={section}>
        <h2 style={sectionTitle}>🏭 Estado del Taller por Fase</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12 }}>
          {[
            { key: "recibido",       label: "Recibido",       color: "#3b82f6" },
            { key: "diagnostico",    label: "Diagnóstico",    color: "#f59e0b" },
            { key: "reparacion",     label: "Reparación",     color: "#ef4444" },
            { key: "control_calidad",label: "Control Calidad",color: "#8b5cf6" },
            { key: "listo",          label: "Listo",          color: "#10b981" },
            { key: "entregado",      label: "Entregado",      color: "#6b7280" },
          ].map(e => (
            <div key={e.key} style={{
              background: "#fff", borderRadius: 14, padding: "18px 12px",
              textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              borderTop: `5px solid ${e.color}`
            }}>
              <div style={{ fontSize: 34, fontWeight: 900, color: e.color }}>
                {stats?.ordenes?.[e.key] || 0}
              </div>
              <div style={{ fontSize: 13, color: "#666", marginTop: 6, fontWeight: 600 }}>{e.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* INGRESOS HOY */}
      <div style={section}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: "#111827", borderRadius: 16, padding: "24px", color: "#fff" }}>
            <div style={{ fontSize: 14, color: "#9ca3af", marginBottom: 8 }}>💰 Ingresos de Hoy</div>
            <div style={{ fontSize: 36, fontWeight: 900 }}>
              RD$ {Number(stats?.ingresoHoy || 0).toLocaleString("es-DO")}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>Facturación del día en curso</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>🔬 Diagnósticos Activos</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: "#8b5cf6" }}>
              {stats?.diagnosticos?.en_reparacion || 0}
            </div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 8 }}>Vehículos en reparación activa</div>
          </div>
        </div>
      </div>

      {/* ÚLTIMAS ÓRDENES */}
      <div style={section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ ...sectionTitle, marginBottom: 0 }}>🧾 Últimas Órdenes de Trabajo</h2>
          <Link href="/ordenes" style={{ fontSize: 14, color: "#3b82f6", fontWeight: 600, textDecoration: "none" }}>
            Ver todas →
          </Link>
        </div>
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["#", "Cliente", "Vehículo", "Descripción", "Estado", "Fecha"].map(h => (
                  <th key={h} style={{ padding: "13px 16px", textAlign: "left", fontSize: 13, color: "#888", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenes.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "30px", textAlign: "center", color: "#aaa", fontSize: 15 }}>Sin órdenes registradas</td></tr>
              ) : ordenes.slice(0, 8).map(o => (
                <tr key={o.id} style={{ borderTop: "1px solid #f0f0f0" }}>
                  <td style={tdStyle}>#{o.id}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{o.cliente_nombre}</td>
                  <td style={tdStyle}>{o.vehiculo_info}</td>
                  <td style={{ ...tdStyle, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {o.descripcion || "—"}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      background: ESTADO_COLORES[o.estado] || "#888",
                      color: "#fff", padding: "4px 12px", borderRadius: 8,
                      fontSize: 12, fontWeight: 700
                    }}>
                      {o.estado}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 13, color: "#888" }}>
                    {o.created_at ? new Date(o.created_at).toLocaleDateString("es-DO") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ACCESOS RÁPIDOS */}
      <div style={section}>
        <h2 style={sectionTitle}>⚡ Accesos Rápidos</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {[
            { href: "/ordenes",     label: "➕ Nueva Orden",       color: "#3b82f6" },
            { href: "/diagnosticos",label: "🔬 Nuevo Diagnóstico", color: "#8b5cf6" },
            { href: "/facturacion", label: "🧾 Facturar",          color: "#10b981" },
            { href: "/clientes",    label: "👤 Nuevo Cliente",     color: "#f59e0b" },
          ].map(a => (
            <Link key={a.href} href={a.href} style={{
              background: a.color, color: "#fff", padding: "18px 16px",
              borderRadius: 14, textAlign: "center", fontWeight: 700,
              fontSize: 15, textDecoration: "none", display: "block"
            }}>
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

const container = { padding: "28px", background: "#f5f7fb", minHeight: "100vh" };
const title = { fontSize: 28, fontWeight: 900, margin: 0 };
const kpiGrid = { display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 14, marginBottom: 28 };
const section = { marginBottom: 28 };
const sectionTitle = { fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#111" };
const tdStyle = { padding: "13px 16px", fontSize: 14 };