"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { API_URL as API } from "@/config";

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Orden {
  id: number;
  numero_orden: string;
  estado: string;
  prioridad?: string;
  cliente_nombre: string;
  cliente_telefono?: string;
  vehiculo_info: string;
  vehiculo_marca?: string;
  vehiculo_modelo?: string;
  vehiculo_placa?: string;
  descripcion: string;
  created_at: string;
  tecnico_nombre?: string;
  tecnico_id?: number;
}

type Tab = "pendientes" | "en_proceso" | "completadas";

// ── Paleta ────────────────────────────────────────────────────────────────────
const C = {
  bg:     "#0f172a",
  card:   "#1e293b",
  border: "#334155",
  text:   "#e2e8f0",
  muted:  "#94a3b8",
  blue:   "#3b82f6",
  green:  "#10b981",
  red:    "#ef4444",
  orange: "#f97316",
  yellow: "#f59e0b",
  purple: "#8b5cf6",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function tiempoDesde(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}min`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

function numeroOrden(o: Orden): string {
  return o.numero_orden || `OT-${String(o.id).padStart(4, "0")}`;
}

function hoy(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getDate() === n.getDate() &&
    d.getMonth() === n.getMonth() &&
    d.getFullYear() === n.getFullYear()
  );
}

const ESTADO_INFO: Record<string, { label: string; color: string }> = {
  RECIBIDO:             { label: "Recibido",        color: C.blue },
  DIAGNOSTICO:          { label: "Diagnóstico",     color: C.yellow },
  ESPERANDO_APROBACION: { label: "Esp. Aprobación", color: C.orange },
  REPARACION:           { label: "En Reparación",   color: C.red },
  CONTROL_CALIDAD:      { label: "Control Calidad", color: C.purple },
  LISTO:                { label: "Listo",           color: C.green },
  ENTREGADO:            { label: "Entregado",       color: "#6b7280" },
};

function BadgeEstado({ estado }: { estado: string }) {
  const info = ESTADO_INFO[estado] || { label: estado, color: C.muted };
  return (
    <span style={{
      background: info.color + "22",
      color: info.color,
      border: `1px solid ${info.color}55`,
      borderRadius: 6,
      padding: "2px 8px",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.5,
    }}>
      {info.label}
    </span>
  );
}

function BadgePrioridad({ p }: { p?: string }) {
  if (!p || p === "NORMAL") return (
    <span style={{ background: "#33415522", color: C.muted, border: "1px solid #33415555", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
      NORMAL
    </span>
  );
  if (p === "ALTA") return (
    <span style={{ background: C.orange + "22", color: C.orange, border: `1px solid ${C.orange}55`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
      ALTA
    </span>
  );
  return (
    <span style={{ background: C.red + "22", color: C.red, border: `1px solid ${C.red}55`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
      🚨 URGENTE
    </span>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function TallerPage() {
  const router = useRouter();
  const [ordenes, setOrdenes]     = useState<Orden[]>([]);
  const [tab, setTab]             = useState<Tab>("pendientes");
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const usuario: Record<string, string> =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("usuario") || "{}")
      : {};
  const nombreTecnico = usuario.nombre || usuario.name || "Técnico";

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`${API}/ordenes`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setOrdenes(Array.isArray(data) ? data : data.ordenes || []);
      setLastUpdate(new Date());
      setError("");
    } catch (e: any) {
      setError(e.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    intervalRef.current = setInterval(cargar, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [cargar]);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const pendientes  = ordenes.filter(o => o.estado === "RECIBIDO" || o.estado === "DIAGNOSTICO");
  const en_proceso  = ordenes.filter(o => o.estado === "REPARACION");
  const completadas = ordenes.filter(o =>
    (o.estado === "CONTROL_CALIDAD" || o.estado === "LISTO") && hoy(o.created_at)
  );

  const lista = tab === "pendientes" ? pendientes : tab === "en_proceso" ? en_proceso : completadas;

  function irA(orden: Orden) {
    if (orden.estado === "RECIBIDO" || orden.estado === "DIAGNOSTICO") {
      router.push(`/taller/diagnostico/${orden.id}`);
    } else {
      router.push(`/taller/reparacion/${orden.id}`);
    }
  }

  function labelBoton(estado: string): string {
    switch (estado) {
      case "RECIBIDO":        return "🔍 Iniciar Diagnóstico";
      case "DIAGNOSTICO":     return "🔍 Ver Diagnóstico";
      case "REPARACION":      return "🔨 Ir a Reparación";
      case "CONTROL_CALIDAD": return "✅ Control de Calidad";
      default:                return "👁 Ver";
    }
  }

  function colorBoton(estado: string): string {
    switch (estado) {
      case "RECIBIDO":        return C.blue;
      case "DIAGNOSTICO":     return C.yellow;
      case "REPARACION":      return C.red;
      case "CONTROL_CALIDAD": return C.purple;
      default:                return C.muted;
    }
  }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "pendientes",  label: "📋 Pendientes",     count: pendientes.length },
    { key: "en_proceso",  label: "🔨 En Proceso",      count: en_proceso.length },
    { key: "completadas", label: "✅ Completadas hoy", count: completadas.length },
  ];

  const vacioMsg: Record<Tab, string> = {
    pendientes:  "No hay órdenes pendientes por diagnosticar.",
    en_proceso:  "No hay órdenes en proceso de reparación.",
    completadas: "No se completaron órdenes hoy todavía.",
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{
        background: "#1e293b",
        borderBottom: `1px solid ${C.border}`,
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>🔧 Mi Cola de Trabajo</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.muted }}>
            Bienvenido, <strong style={{ color: C.blue }}>{nombreTecnico}</strong>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: C.muted }}>
            {lastUpdate.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <button
            onClick={cargar}
            style={{
              background: C.blue + "22",
              color: C.blue,
              border: `1px solid ${C.blue}44`,
              borderRadius: 8,
              padding: "6px 14px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ↻ Actualizar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          margin: "16px 24px 0",
          background: C.red + "22",
          border: `1px solid ${C.red}55`,
          borderRadius: 8,
          padding: "10px 16px",
          color: C.red,
          fontSize: 13,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ padding: "16px 24px 0", display: "flex", gap: 4, borderBottom: `1px solid ${C.border}` }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background:   tab === t.key ? C.blue + "22" : "transparent",
              color:        tab === t.key ? C.blue : C.muted,
              border:       tab === t.key ? `1px solid ${C.blue}55` : "1px solid transparent",
              borderBottom: tab === t.key ? `2px solid ${C.blue}` : "2px solid transparent",
              borderRadius: "8px 8px 0 0",
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {t.label}
            <span style={{
              background: tab === t.key ? C.blue : C.border,
              color:      tab === t.key ? "#fff" : C.muted,
              borderRadius: 10,
              padding: "1px 7px",
              fontSize: 11,
              fontWeight: 700,
            }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Lista */}
      <div style={{ padding: 24 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: C.muted, padding: 60, fontSize: 15 }}>⏳ Cargando órdenes...</div>
        ) : lista.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              {tab === "pendientes" ? "📋" : tab === "en_proceso" ? "🔨" : "✅"}
            </div>
            <p style={{ color: C.muted, fontSize: 15 }}>{vacioMsg[tab]}</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {lista.map(orden => (
              <div
                key={orden.id}
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: 20,
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 16,
                  alignItems: "start",
                }}
              >
                {/* Info */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Número + badges */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 17, fontWeight: 800 }}>{numeroOrden(orden)}</span>
                    <BadgeEstado estado={orden.estado} />
                    <BadgePrioridad p={orden.prioridad} />
                  </div>

                  {/* Cliente + Vehículo */}
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Cliente</div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{orden.cliente_nombre}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Vehículo</div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
                        {orden.vehiculo_marca && orden.vehiculo_modelo
                          ? `${orden.vehiculo_marca} ${orden.vehiculo_modelo}`
                          : orden.vehiculo_info || "—"}
                        {orden.vehiculo_placa && (
                          <span style={{ marginLeft: 6, fontSize: 12, color: C.muted }}>({orden.vehiculo_placa})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Descripción */}
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Trabajo solicitado</div>
                    <div style={{ fontSize: 13, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>
                      {orden.descripcion || "Sin descripción"}
                    </div>
                  </div>

                  {/* Tiempo en taller */}
                  <div style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>
                    🕐 En taller hace{" "}
                    <strong style={{ color: C.yellow }}>{tiempoDesde(orden.created_at)}</strong>
                  </div>
                </div>

                {/* Botón acción */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <button
                    onClick={() => irA(orden)}
                    style={{
                      background: colorBoton(orden.estado),
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "10px 18px",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      boxShadow: `0 2px 8px ${colorBoton(orden.estado)}44`,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                  >
                    {labelBoton(orden.estado)}
                  </button>
                  {orden.tecnico_nombre && (
                    <span style={{ fontSize: 11, color: C.muted }}>Técnico: {orden.tecnico_nombre}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "0 0 20px", fontSize: 11, color: C.border }}>
        Auto-actualización cada 15 segundos
      </div>
    </div>
  );
}
