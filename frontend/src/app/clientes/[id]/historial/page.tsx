"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL!;

const ESTADO_COLOR: Record<string, string> = {
  RECIBIDO: "#3b82f6", DIAGNOSTICO: "#f59e0b", REPARACION: "#ef4444",
  CONTROL_CALIDAD: "#8b5cf6", LISTO: "#10b981", ENTREGADO: "#6b7280"
};

export default function HistorialCliente() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<"ordenes" | "vehiculos" | "ventas" | "diagnosticos">("ordenes");

  useEffect(() => {
    fetch(`${API}/clientes/${id}/historial`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error);
  }, [id]);

  if (!data) return <div style={{ padding: 40, textAlign: "center" }}>Cargando historial...</div>;

  const { cliente, vehiculos, ordenes, ventas, diagnosticos } = data;

  return (
    <div style={container}>
      <button onClick={() => router.back()} style={btnBack}>← Volver</button>

      {/* HEADER CLIENTE */}
      <div style={headerCard}>
        <div style={{ fontSize: 48 }}>👤</div>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{cliente?.nombre}</h1>
          <p style={{ color: "#888", margin: "4px 0" }}>📞 {cliente?.telefono || "Sin teléfono"} &nbsp;|&nbsp; ✉️ {cliente?.email || "Sin email"}</p>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <span style={badge("#3b82f6")}>🚗 {vehiculos.length} vehículos</span>
            <span style={badge("#10b981")}>🧾 {ordenes.length} órdenes</span>
            <span style={badge("#f59e0b")}>💰 {ventas.length} facturas</span>
            <span style={badge("#8b5cf6")}>🔬 {diagnosticos.length} diagnósticos</span>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {([
          { key: "ordenes", label: `🧾 Órdenes (${ordenes.length})` },
          { key: "vehiculos", label: `🚗 Vehículos (${vehiculos.length})` },
          { key: "ventas", label: `💰 Facturas (${ventas.length})` },
          { key: "diagnosticos", label: `🔬 Diagnósticos (${diagnosticos.length})` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ ...tabBtn, background: tab === t.key ? "#111827" : "#fff", color: tab === t.key ? "#fff" : "#111" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={card}>
        {/* ÓRDENES */}
        {tab === "ordenes" && (
          ordenes.length === 0 ? <p style={empty}>Sin órdenes registradas</p> :
          <table style={table}>
            <thead><tr>{["#", "Descripción", "Estado", "Total", "Fecha"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {ordenes.map((o: any) => (
                <tr key={o.id}>
                  <td style={td}>#{o.id}</td>
                  <td style={td}>{o.descripcion}</td>
                  <td style={td}>
                    <span style={{ background: ESTADO_COLOR[o.estado] || "#888", color: "#fff", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                      {o.estado}
                    </span>
                  </td>
                  <td style={td}>RD$ {Number(o.total || 0).toFixed(2)}</td>
                  <td style={td}>{o.created_at ? new Date(o.created_at).toLocaleDateString("es-DO") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* VEHÍCULOS */}
        {tab === "vehiculos" && (
          vehiculos.length === 0 ? <p style={empty}>Sin vehículos registrados</p> :
          <table style={table}>
            <thead><tr>{["Marca", "Modelo", "Año", "Placa", "Color"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {vehiculos.map((v: any) => (
                <tr key={v.id}>
                  <td style={td}>{v.marca}</td>
                  <td style={td}>{v.modelo}</td>
                  <td style={td}>{v.ano}</td>
                  <td style={td}><span style={{ background: "#1e3a5f", color: "#fff", padding: "3px 10px", borderRadius: 6, fontWeight: 700, fontSize: 13 }}>{v.placa}</span></td>
                  <td style={td}>{v.color || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* VENTAS */}
        {tab === "ventas" && (
          ventas.length === 0 ? <p style={empty}>Sin facturas registradas</p> :
          <table style={table}>
            <thead><tr>{["Factura", "NCF", "Total", "Método", "Fecha"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {ventas.map((v: any) => (
                <tr key={v.id}>
                  <td style={td}><b>FAC-{String(v.id).padStart(5, "0")}</b></td>
                  <td style={{ ...td, fontSize: 12 }}>{v.ncf}</td>
                  <td style={{ ...td, fontWeight: 700 }}>RD$ {Number(v.total).toFixed(2)}</td>
                  <td style={td}>{v.method}</td>
                  <td style={td}>{v.created_at ? new Date(v.created_at).toLocaleDateString("es-DO") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* DIAGNÓSTICOS */}
        {tab === "diagnosticos" && (
          diagnosticos.length === 0 ? <p style={empty}>Sin diagnósticos registrados</p> :
          <table style={table}>
            <thead><tr>{["#", "Tipo Servicio", "Estado", "Técnico", "Fecha"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {diagnosticos.map((d: any) => (
                <tr key={d.id}>
                  <td style={td}>#{d.id}</td>
                  <td style={td}>{d.tipo_servicio || "—"}</td>
                  <td style={td}>
                    <span style={{ background: "#8b5cf6", color: "#fff", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                      {d.estado}
                    </span>
                  </td>
                  <td style={td}>{d.tecnico_nombre || "—"}</td>
                  <td style={td}>{d.created_at ? new Date(d.created_at).toLocaleDateString("es-DO") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const container: any = { padding: 20, background: "#f5f7fb", minHeight: "100vh" };
const headerCard: any = { background: "#fff", borderRadius: 16, padding: 24, display: "flex", gap: 20, alignItems: "center", marginBottom: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" };
const card: any = { background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" };
const tabBtn: any = { padding: "9px 16px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", fontWeight: 600, fontSize: 13 };
const btnBack: any = { marginBottom: 16, padding: "8px 16px", background: "#f1f5f9", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontWeight: 600 };
const badge = (color: string): any => ({ background: color, color: "#fff", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 });
const table: any = { width: "100%", borderCollapse: "collapse" };
const th: any = { textAlign: "left", padding: "10px 12px", background: "#f8fafc", fontSize: 13, fontWeight: 600 };
const td: any = { padding: "10px 12px", borderBottom: "1px solid #eee", fontSize: 14 };
const empty: any = { textAlign: "center", color: "#888", padding: 30 };