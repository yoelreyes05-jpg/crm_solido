"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL as API } from "@/config";

interface Orden {
  id: number;
  estado: string;
  descripcion: string;
  cliente_nombre: string;
  vehiculo_info: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  RECIBIDO:        "#3b82f6",
  DIAGNOSTICO:     "#f59e0b",
  REPARACION:      "#ef4444",
  CONTROL_CALIDAD: "#8b5cf6",
  LISTO:           "#10b981",
  ENTREGADO:       "#6b7280",
};

export default function InspeccionIndexPage() {
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"activas" | "todas">("activas");

  useEffect(() => {
    fetch(`${API}/ordenes`)
      .then(r => r.json())
      .then(data => {
        setOrdenes(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const ordenesFiltradas = ordenes.filter(o =>
    filtro === "activas"
      ? o.estado !== "ENTREGADO" && o.estado !== "CANCELADA"
      : true
  );

  return (
    <div style={container}>
      <h1 style={title}>🔍 Inspección de Vehículos</h1>
      <p style={{ color: "#6b7280", marginBottom: 20, fontSize: 14 }}>
        Selecciona una orden de trabajo para registrar o ver la inspección del vehículo al momento de recepción.
      </p>

      {/* Filtro */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {(["activas", "todas"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "1px solid #ddd",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
              background: filtro === f ? "#111827" : "#fff",
              color: filtro === f ? "#fff" : "#111",
            }}
          >
            {f === "activas" ? "📋 Órdenes Activas" : "🗂 Todas las Órdenes"}
          </button>
        ))}
      </div>

      <div style={card}>
        {loading ? (
          <p style={{ color: "#888" }}>Cargando órdenes...</p>
        ) : ordenesFiltradas.length === 0 ? (
          <p style={{ color: "#888" }}>No hay órdenes {filtro === "activas" ? "activas" : ""} registradas.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>ID</th>
                  <th style={th}>Cliente</th>
                  <th style={th}>Vehículo</th>
                  <th style={th}>Estado</th>
                  <th style={th}>Fecha</th>
                  <th style={th}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {ordenesFiltradas.map(o => {
                  const color = STATUS_COLORS[o.estado] || "#7f8c8d";
                  return (
                    <tr key={o.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={td}>
                        <span style={{ fontWeight: 700, color: "#111" }}>#{o.id}</span>
                      </td>
                      <td style={{ ...td, fontWeight: 600 }}>{o.cliente_nombre}</td>
                      <td style={td}>{o.vehiculo_info}</td>
                      <td style={td}>
                        <span style={{
                          background: color + "22",
                          color,
                          border: `1.5px solid ${color}44`,
                          borderRadius: 14,
                          padding: "3px 10px",
                          fontWeight: 800,
                          fontSize: 11,
                          whiteSpace: "nowrap",
                        }}>
                          {o.estado}
                        </span>
                      </td>
                      <td style={td}>
                        {o.created_at
                          ? new Date(o.created_at).toLocaleString("es-DO")
                          : "Sin fecha"}
                      </td>
                      <td style={td}>
                        <Link href={`/inspeccion/${o.id}`}>
                          <button style={{
                            padding: "6px 14px",
                            background: "#dbeafe",
                            color: "#1d4ed8",
                            border: "none",
                            borderRadius: 7,
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: 700,
                          }}>
                            🔍 Ver / Editar Inspección
                          </button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const container: any = { padding: "20px", background: "#f5f7fb", minHeight: "100vh" };
const title: any = { fontSize: "28px", fontWeight: "bold", marginBottom: "8px" };
const card: any = { background: "#fff", padding: "20px", borderRadius: "15px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" };
const table: any = { width: "100%", borderCollapse: "collapse" };
const th: any = { textAlign: "left", padding: "10px 12px", background: "#f1f5f9", fontSize: 13, whiteSpace: "nowrap" };
const td: any = { padding: "10px 12px", fontSize: 14 };
