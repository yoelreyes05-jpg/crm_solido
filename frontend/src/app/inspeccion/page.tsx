"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { API_URL as API } from "@/config";

interface Orden {
  id: number;
  numero_orden: string;
  estado: string;
  descripcion: string;
  cliente_nombre: string;
  vehiculo_info: string;
  vehiculo_placa?: string;
  created_at: string;
}

const ESTADO_COLOR: Record<string, string> = {
  RECIBIDO:"#3b82f6", DIAGNOSTICO:"#f59e0b", ESPERANDO_APROBACION:"#f97316",
  REPARACION:"#ef4444", CONTROL_CALIDAD:"#8b5cf6", LISTO:"#10b981",
  ENTREGADO:"#6b7280", CANCELADA:"#dc2626",
};

export default function InspeccionConsultaPage() {
  const [ordenes, setOrdenes]   = useState<Orden[]>([]);
  const [loading, setLoading]   = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro]     = useState<"con_inspeccion"|"todas">("con_inspeccion");

  useEffect(() => {
    fetch(`${API}/ordenes`)
      .then(r => r.json())
      .then(data => { setOrdenes(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const ordenesFiltradas = useMemo(() => {
    const activas = filtro === "con_inspeccion"
      ? ordenes.filter(o => o.estado !== "CANCELADA")
      : ordenes;
    if (!busqueda.trim()) return activas;
    const q = busqueda.toLowerCase();
    return activas.filter(o =>
      [o.cliente_nombre, o.numero_orden, o.vehiculo_info, o.vehiculo_placa]
        .some(v => (v || "").toLowerCase().includes(q))
    );
  }, [ordenes, filtro, busqueda]);

  return (
    <div style={{ padding:"20px 24px", background:"#f5f7fb", minHeight:"100vh" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:900, margin:0 }}>🔍 Consulta de Inspecciones</h1>
          <p style={{ color:"#6b7280", fontSize:13, margin:"4px 0 0" }}>
            Consulta las inspecciones registradas al momento de la recepción del vehículo.
          </p>
        </div>
        <Link href="/recepcion">
          <button style={{
            padding:"9px 20px", background:"#111827", color:"#fff",
            border:"none", borderRadius:9, cursor:"pointer", fontWeight:700, fontSize:13,
          }}>
            🚗 Nueva Recepción
          </button>
        </Link>
      </div>

      {/* Info banner */}
      <div style={{
        background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:10,
        padding:"11px 16px", marginBottom:20, fontSize:13, color:"#1e40af",
        display:"flex", alignItems:"center", gap:10,
      }}>
        <span style={{ fontSize:18 }}>ℹ️</span>
        <span>
          Las inspecciones se crean durante la <strong>Recepción del vehículo</strong> (wizard de 4 pasos).
          Aquí puedes consultarlas y verlas en detalle.
        </span>
      </div>

      {/* Controles */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="🔍 Buscar por cliente, placa, número de orden..."
          style={{
            flex:1, minWidth:260, maxWidth:440, padding:"9px 14px",
            border:"1px solid #e5e7eb", borderRadius:10, fontSize:14,
            background:"#fff", outline:"none", boxSizing:"border-box",
          }}
        />
        <div style={{ display:"flex", gap:8 }}>
          {(["con_inspeccion","todas"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              style={{
                padding:"8px 16px", borderRadius:20, cursor:"pointer",
                border: filtro === f ? "none" : "1px solid #e5e7eb",
                background: filtro === f ? "#111827" : "#fff",
                color: filtro === f ? "#fff" : "#374151",
                fontWeight: filtro === f ? 700 : 500, fontSize:13,
              }}
            >
              {f === "con_inspeccion" ? "🚗 Activas" : "📋 Todas"}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div style={{ background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", overflow:"hidden" }}>
        {loading ? (
          <div style={{ padding:40, textAlign:"center", color:"#9ca3af" }}>Cargando...</div>
        ) : ordenesFiltradas.length === 0 ? (
          <div style={{ padding:48, textAlign:"center", color:"#9ca3af" }}>
            <div style={{ fontSize:32, marginBottom:10 }}>🔍</div>
            <p style={{ margin:0, fontWeight:700 }}>No se encontraron órdenes</p>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                {["Orden","Cliente","Vehículo","Estado","Fecha","Inspección"].map(h => (
                  <th key={h} style={{ padding:"11px 14px", textAlign:"left", fontSize:12, color:"#6b7280", fontWeight:700, whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenesFiltradas.map(o => {
                const color = ESTADO_COLOR[o.estado] || "#6b7280";
                return (
                  <tr key={o.id} style={{ borderBottom:"1px solid #f1f5f9" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding:"11px 14px", fontWeight:800, fontSize:13 }}>
                      {o.numero_orden || `OT-${String(o.id).padStart(4,"0")}`}
                    </td>
                    <td style={{ padding:"11px 14px", fontWeight:600, fontSize:13 }}>{o.cliente_nombre}</td>
                    <td style={{ padding:"11px 14px", fontSize:13, color:"#374151" }}>
                      <div>{o.vehiculo_info}</div>
                      {o.vehiculo_placa && (
                        <span style={{ fontSize:11, background:"#f1f5f9", padding:"1px 6px", borderRadius:4, fontFamily:"monospace", color:"#475569" }}>
                          {o.vehiculo_placa}
                        </span>
                      )}
                    </td>
                    <td style={{ padding:"11px 14px" }}>
                      <span style={{
                        background: color+"18", color, border:`1.5px solid ${color}44`,
                        borderRadius:12, padding:"3px 9px", fontWeight:700, fontSize:11, whiteSpace:"nowrap",
                      }}>
                        {o.estado}
                      </span>
                    </td>
                    <td style={{ padding:"11px 14px", fontSize:12, color:"#9ca3af", whiteSpace:"nowrap" }}>
                      {o.created_at ? new Date(o.created_at).toLocaleDateString("es-DO") : "—"}
                    </td>
                    <td style={{ padding:"11px 14px" }}>
                      <Link href={`/inspeccion/${o.id}`}>
                        <button style={{
                          padding:"5px 12px", background:"#f0fdf4", color:"#065f46",
                          border:"1px solid #bbf7d0", borderRadius:7,
                          cursor:"pointer", fontSize:12, fontWeight:700,
                        }}>
                          📋 Ver inspección
                        </button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
