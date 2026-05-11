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

interface DiagInfo {
  id: number;
  orden_id: number;
  descripcion?: string;
  mano_obra?: number;
  repuestos?: number;
  total?: number;
  tiempo_estimado?: string;
  notas?: string;
  costo_estimado?: number;
}

type Tab = "diagnosticar" | "aprobacion" | "reparacion" | "calidad" | "listos";

// ── Paleta ────────────────────────────────────────────────────────────────────
const C = {
  bg:     "#0f172a",
  card:   "#1e293b",
  card2:  "#162032",
  border: "#334155",
  text:   "#e2e8f0",
  muted:  "#94a3b8",
  blue:   "#3b82f6",
  green:  "#10b981",
  red:    "#ef4444",
  orange: "#f97316",
  yellow: "#f59e0b",
  purple: "#8b5cf6",
  teal:   "#14b8a6",
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

function fmtDinero(n?: number): string {
  if (!n) return "RD$ 0.00";
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 2 }).format(n);
}

const ESTADO_INFO: Record<string, { label: string; color: string; icon: string }> = {
  RECIBIDO:             { label: "Recibido",        color: C.blue,   icon: "📥" },
  DIAGNOSTICO:          { label: "Diagnóstico",     color: C.yellow, icon: "🔬" },
  ESPERANDO_APROBACION: { label: "Esp. Aprobación", color: C.orange, icon: "⏳" },
  REPARACION:           { label: "En Reparación",   color: C.red,    icon: "🔧" },
  CONTROL_CALIDAD:      { label: "Control Calidad", color: C.purple, icon: "✅" },
  LISTO:                { label: "Listo",           color: C.green,  icon: "🎉" },
  ENTREGADO:            { label: "Entregado",       color: "#6b7280",icon: "🏁" },
  CANCELADA:            { label: "Cancelada",       color: C.red,    icon: "✗"  },
};

function BadgeEstado({ estado }: { estado: string }) {
  const info = ESTADO_INFO[estado] || { label: estado, color: C.muted, icon: "" };
  return (
    <span style={{
      background: info.color + "22", color: info.color,
      border: `1px solid ${info.color}55`, borderRadius: 6,
      padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
    }}>
      {info.icon} {info.label}
    </span>
  );
}

function BadgePrioridad({ p }: { p?: string }) {
  if (!p || p === "NORMAL") return (
    <span style={{ background: "#33415522", color: C.muted, border: "1px solid #33415555", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>NORMAL</span>
  );
  if (p === "ALTA") return (
    <span style={{ background: C.orange + "22", color: C.orange, border: `1px solid ${C.orange}55`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>⬆ ALTA</span>
  );
  return (
    <span style={{ background: C.red + "22", color: C.red, border: `1px solid ${C.red}55`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>🚨 URGENTE</span>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function TallerPage() {
  const router  = useRouter();
  const [ordenes,      setOrdenes]      = useState<Orden[]>([]);
  const [diagMap,      setDiagMap]      = useState<Record<number, DiagInfo>>({});
  const [tab,          setTab]          = useState<Tab>("diagnosticar");
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [lastUpdate,   setLastUpdate]   = useState(new Date());
  const [actionLoading,setActionLoading]= useState<number | null>(null);
  const [confirmId,    setConfirmId]    = useState<number | null>(null);
  const [confirmAction,setConfirmAction]= useState<"aprobar" | "rechazar" | "calidad" | "entregar" | null>(null);
  const [motivoRechazo,setMotivoRechazo]= useState("");
  const [toast,        setToast]        = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const usuario: Record<string, string> =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("usuario") || "{}")
      : {};
  const nombreTecnico = usuario.nombre || usuario.name || "Técnico";
  const rolUsuario    = (usuario.rol || usuario.role || "tecnico").toLowerCase();
  const esTecnico     = rolUsuario === "tecnico";
  const puedeAprobar  = ["gerente", "secretaria", "admin"].includes(rolUsuario);
  const puedeCalidad  = ["gerente", "admin"].includes(rolUsuario);
  const puedeEntregar = ["gerente", "secretaria", "admin"].includes(rolUsuario);

  const showToast = (msg: string, tipo: "ok" | "err" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Carga de datos ────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    try {
      const [rOrdenes, rDiag] = await Promise.all([
        fetch(`${API}/ordenes`, { cache: "no-store" }),
        fetch(`${API}/diagnosticos`, { cache: "no-store" }),
      ]);

      if (rOrdenes.ok) {
        const data = await rOrdenes.json();
        setOrdenes(Array.isArray(data) ? data : data.ordenes || []);
        setLastUpdate(new Date());
        setError("");
      } else {
        throw new Error(`Error ${rOrdenes.status}`);
      }

      if (rDiag.ok) {
        const diags: DiagInfo[] = await rDiag.json();
        const map: Record<number, DiagInfo> = {};
        for (const d of (Array.isArray(diags) ? diags : [])) {
          if (d.orden_id) map[d.orden_id] = d;
        }
        setDiagMap(map);
      }
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
  const diagnosticar = ordenes.filter(o => o.estado === "RECIBIDO" || o.estado === "DIAGNOSTICO");
  const aprobacion   = ordenes.filter(o => o.estado === "ESPERANDO_APROBACION");
  const reparacion   = ordenes.filter(o => o.estado === "REPARACION");
  const calidad      = ordenes.filter(o => o.estado === "CONTROL_CALIDAD");
  const listos       = ordenes.filter(o => o.estado === "LISTO");

  const lista =
    tab === "diagnosticar" ? diagnosticar :
    tab === "aprobacion"   ? aprobacion   :
    tab === "reparacion"   ? reparacion   :
    tab === "calidad"      ? calidad      :
    listos;

  // ── Acciones del flujo ────────────────────────────────────────────────────
  async function ejecutarAccion(ordenId: number, accion: "aprobar" | "rechazar" | "calidad" | "entregar") {
    setActionLoading(ordenId);
    try {
      let endpoint = "";
      let body: Record<string, unknown> = {
        usuario_id:     usuario.id,
        usuario_nombre: nombreTecnico,
      };

      if (accion === "aprobar") {
        endpoint = `/ordenes/${ordenId}/aprobar`;
        body.motivo = "Cliente aprobó la reparación";
      } else if (accion === "rechazar") {
        endpoint = `/ordenes/${ordenId}/rechazar`;
        body.motivo = motivoRechazo || "Cliente rechazó la reparación";
      } else if (accion === "calidad") {
        endpoint = `/ordenes/${ordenId}/calidad-aprobada`;
        body.motivo = "Pasó control de calidad";
      } else if (accion === "entregar") {
        endpoint = `/ordenes/${ordenId}/entregar`;
        body.motivo = "Vehículo entregado al cliente";
      }

      const res = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`);

      const msgs: Record<string, string> = {
        aprobar:  "✅ Reparación aprobada — la orden pasa a REPARACIÓN",
        rechazar: "🚫 Reparación rechazada — orden CANCELADA",
        calidad:  "✅ Control de calidad aprobado — vehículo LISTO",
        entregar: "🏁 Vehículo entregado — orden cerrada",
      };
      showToast(msgs[accion]);
      setConfirmId(null);
      setConfirmAction(null);
      setMotivoRechazo("");
      await cargar();
    } catch (e: any) {
      showToast(e.message || "Error al ejecutar acción", "err");
    } finally {
      setActionLoading(null);
    }
  }

  function confirmar(id: number, accion: "aprobar" | "rechazar" | "calidad" | "entregar") {
    setConfirmId(id);
    setConfirmAction(accion);
    setMotivoRechazo("");
  }

  function cancelarConfirm() {
    setConfirmId(null);
    setConfirmAction(null);
    setMotivoRechazo("");
  }

  const TABS: { key: Tab; label: string; count: number; color: string }[] = [
    { key: "diagnosticar", label: "🔬 Por Diagnosticar", count: diagnosticar.length, color: C.yellow },
    { key: "aprobacion",   label: "⏳ Aprobación",       count: aprobacion.length,   color: C.orange },
    { key: "reparacion",   label: "🔧 En Reparación",    count: reparacion.length,   color: C.red    },
    { key: "calidad",      label: "✅ Control Calidad",  count: calidad.length,      color: C.purple },
    { key: "listos",       label: "🎉 Listos",           count: listos.length,       color: C.green  },
  ];

  const vacioMsg: Record<Tab, string> = {
    diagnosticar: "No hay órdenes pendientes por diagnosticar.",
    aprobacion:   "No hay órdenes esperando aprobación del cliente.",
    reparacion:   "No hay órdenes en proceso de reparación.",
    calidad:      "No hay órdenes en control de calidad.",
    listos:       "No hay vehículos listos para entrega.",
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          background: toast.tipo === "ok" ? "#064e3b" : "#7f1d1d",
          border: `1px solid ${toast.tipo === "ok" ? C.green : C.red}`,
          color: "#fff", borderRadius: 10, padding: "12px 18px",
          fontSize: 14, fontWeight: 600, boxShadow: "0 4px 20px #0004",
          maxWidth: 360,
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{
        background: "#1e293b", borderBottom: `1px solid ${C.border}`,
        padding: "16px 24px", display: "flex", alignItems: "center",
        justifyContent: "space-between", flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>🔧 Mi Cola de Trabajo</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.muted }}>
            Bienvenido, <strong style={{ color: C.blue }}>{nombreTecnico}</strong>
            {" · "}<span style={{ color: C.muted }}>
              {lastUpdate.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={cargar}
            style={{
              background: C.blue + "22", color: C.blue,
              border: `1px solid ${C.blue}44`, borderRadius: 8,
              padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600,
            }}
          >
            ↻ Actualizar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ margin: "12px 24px 0", background: C.red + "22", border: `1px solid ${C.red}55`, borderRadius: 8, padding: "10px 16px", color: C.red, fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Resumen de estados */}
      <div style={{ padding: "12px 24px 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <div key={t.key} style={{
            background: t.count > 0 ? t.color + "18" : C.card,
            border: `1px solid ${t.count > 0 ? t.color + "44" : C.border}`,
            borderRadius: 8, padding: "6px 14px",
            display: "flex", alignItems: "center", gap: 6, fontSize: 13,
          }}>
            <span style={{ fontWeight: 700, color: t.count > 0 ? t.color : C.muted }}>{t.count}</span>
            <span style={{ color: C.muted, fontSize: 12 }}>{t.label.split(" ").slice(1).join(" ")}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ padding: "14px 24px 0", display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background:   tab === t.key ? t.color + "22" : "transparent",
              color:        tab === t.key ? t.color : C.muted,
              border:       tab === t.key ? `1px solid ${t.color}55` : "1px solid transparent",
              borderBottom: tab === t.key ? `2px solid ${t.color}` : "2px solid transparent",
              borderRadius: "8px 8px 0 0",
              padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span style={{
                background: tab === t.key ? t.color : C.border,
                color: tab === t.key ? "#fff" : C.muted,
                borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700,
              }}>
                {t.count}
              </span>
            )}
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
              {tab === "diagnosticar" ? "🔬" : tab === "aprobacion" ? "⏳" : tab === "reparacion" ? "🔧" : tab === "calidad" ? "✅" : "🎉"}
            </div>
            <p style={{ color: C.muted, fontSize: 15 }}>{vacioMsg[tab]}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {lista.map(orden => {
              const diag = diagMap[orden.id];
              const estadoInfo = ESTADO_INFO[orden.estado] || { color: C.muted, label: orden.estado, icon: "" };
              const isConfirming = confirmId === orden.id;
              const isLoading = actionLoading === orden.id;

              return (
                <div
                  key={orden.id}
                  style={{
                    background: C.card,
                    border: `1px solid ${tab === "aprobacion" ? C.orange + "44" : tab === "calidad" ? C.purple + "44" : C.border}`,
                    borderRadius: 12, padding: 20,
                    borderLeft: `4px solid ${estadoInfo.color}`,
                  }}
                >
                  {/* Fila superior: número + badges + tiempo */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 17, fontWeight: 800 }}>{numeroOrden(orden)}</span>
                      <BadgeEstado estado={orden.estado} />
                      <BadgePrioridad p={orden.prioridad} />
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 4 }}>
                      🕐 <strong style={{ color: C.yellow }}>{tiempoDesde(orden.created_at)}</strong>
                    </div>
                  </div>

                  {/* Info cliente + vehículo */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Cliente</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{orden.cliente_nombre}</div>
                      {orden.cliente_telefono && (
                        <div style={{ fontSize: 12, color: C.muted }}>📞 {orden.cliente_telefono}</div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Vehículo</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {orden.vehiculo_marca && orden.vehiculo_modelo
                          ? `${orden.vehiculo_marca} ${orden.vehiculo_modelo}`
                          : orden.vehiculo_info || "—"}
                      </div>
                      {orden.vehiculo_placa && (
                        <div style={{ fontSize: 12, color: C.muted }}>🪪 {orden.vehiculo_placa}</div>
                      )}
                    </div>
                  </div>

                  {/* Descripción del trabajo */}
                  {orden.descripcion && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Trabajo solicitado</div>
                      <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{orden.descripcion}</div>
                    </div>
                  )}

                  {/* Info diagnóstico — visible en ESPERANDO_APROBACION, REPARACION, CALIDAD */}
                  {diag && (tab === "aprobacion" || tab === "reparacion" || tab === "calidad" || tab === "listos") && (
                    <div style={{
                      background: C.card2,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8, padding: 14, marginBottom: 14,
                    }}>
                      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, fontWeight: 700 }}>
                        📋 Diagnóstico Técnico
                      </div>

                      {diag.descripcion && (
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginBottom: 10, whiteSpace: "pre-wrap" }}>
                          {diag.descripcion}
                        </div>
                      )}

                      {/* Costos */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        <div style={{ background: C.bg, borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
                          <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Mano de obra</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.blue }}>
                            {fmtDinero(Number(diag.mano_obra || 0))}
                          </div>
                        </div>
                        <div style={{ background: C.bg, borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
                          <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Repuestos</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.yellow }}>
                            {fmtDinero(Number(diag.repuestos || 0))}
                          </div>
                        </div>
                        <div style={{ background: C.bg, borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
                          <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Total estimado</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>
                            {fmtDinero(Number(diag.total || diag.costo_estimado || 0))}
                          </div>
                        </div>
                      </div>

                      {diag.tiempo_estimado && (
                        <div style={{ marginTop: 8, fontSize: 12, color: C.muted }}>
                          ⏱ Tiempo estimado: <strong style={{ color: C.text }}>{diag.tiempo_estimado}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── ACCIONES según estado ── */}

                  {/* Confirmación inline */}
                  {isConfirming && confirmAction && (
                    <div style={{
                      background: confirmAction === "rechazar" ? C.red + "11" : C.orange + "11",
                      border: `1px solid ${confirmAction === "rechazar" ? C.red : C.orange}44`,
                      borderRadius: 10, padding: 16, marginBottom: 14,
                    }}>
                      <p style={{ margin: "0 0 10px", fontWeight: 700, color: confirmAction === "rechazar" ? C.red : C.orange, fontSize: 14 }}>
                        {confirmAction === "aprobar"  && "✅ ¿Confirmar aprobación? La orden pasará a REPARACIÓN."}
                        {confirmAction === "rechazar" && "🚫 ¿Confirmar rechazo? La orden será CANCELADA."}
                        {confirmAction === "calidad"  && "✅ ¿Confirmar que pasó el control de calidad?"}
                        {confirmAction === "entregar" && "🏁 ¿Confirmar entrega del vehículo al cliente?"}
                      </p>

                      {confirmAction === "rechazar" && (
                        <textarea
                          value={motivoRechazo}
                          onChange={e => setMotivoRechazo(e.target.value)}
                          placeholder="Motivo del rechazo (opcional)..."
                          rows={2}
                          style={{
                            width: "100%", background: C.bg, color: C.text,
                            border: `1px solid ${C.border}`, borderRadius: 7,
                            padding: "8px 10px", fontSize: 13, marginBottom: 10,
                            resize: "none", boxSizing: "border-box", fontFamily: "inherit",
                          }}
                        />
                      )}

                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => ejecutarAccion(orden.id, confirmAction)}
                          disabled={isLoading}
                          style={{
                            background: confirmAction === "rechazar" ? C.red : C.green,
                            color: "#fff", border: "none", borderRadius: 7,
                            padding: "9px 18px", fontWeight: 700, fontSize: 13,
                            cursor: isLoading ? "not-allowed" : "pointer",
                            opacity: isLoading ? 0.7 : 1,
                          }}
                        >
                          {isLoading ? "⏳ Procesando..." : "✓ Confirmar"}
                        </button>
                        <button
                          onClick={cancelarConfirm}
                          style={{
                            background: "transparent", color: C.muted,
                            border: `1px solid ${C.border}`, borderRadius: 7,
                            padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer",
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Botones de acción */}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>

                    {/* DIAGNOSTICAR: RECIBIDO / DIAGNOSTICO */}
                    {(orden.estado === "RECIBIDO" || orden.estado === "DIAGNOSTICO") && (
                      <button
                        onClick={() => router.push(`/taller/diagnostico/${orden.id}`)}
                        style={{
                          background: C.yellow, color: "#111", border: "none", borderRadius: 8,
                          padding: "10px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700,
                          boxShadow: `0 2px 8px ${C.yellow}44`,
                        }}
                      >
                        {orden.estado === "RECIBIDO" ? "🔬 Iniciar Diagnóstico" : "🔬 Continuar Diagnóstico"}
                      </button>
                    )}

                    {/* APROBACIÓN: ESPERANDO_APROBACION */}
                    {orden.estado === "ESPERANDO_APROBACION" && !isConfirming && (
                      <>
                        {puedeAprobar && (
                          <button
                            onClick={() => confirmar(orden.id, "aprobar")}
                            disabled={isLoading}
                            style={{
                              background: C.green, color: "#fff", border: "none", borderRadius: 8,
                              padding: "10px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700,
                              boxShadow: `0 2px 8px ${C.green}44`, opacity: isLoading ? 0.7 : 1,
                            }}
                          >
                            ✅ Aprobar Reparación
                          </button>
                        )}
                        {puedeAprobar && (
                          <button
                            onClick={() => confirmar(orden.id, "rechazar")}
                            disabled={isLoading}
                            style={{
                              background: C.red + "22", color: C.red,
                              border: `1px solid ${C.red}55`, borderRadius: 8,
                              padding: "10px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700,
                            }}
                          >
                            ✗ Rechazar
                          </button>
                        )}
                        {/* Técnico solo puede ver el diagnóstico */}
                        <button
                          onClick={() => router.push(`/taller/diagnostico/${orden.id}`)}
                          style={{
                            background: "transparent", color: C.muted,
                            border: `1px solid ${C.border}`, borderRadius: 8,
                            padding: "10px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
                          }}
                        >
                          📋 Ver diagnóstico
                        </button>
                        {esTecnico && (
                          <span style={{ color: C.orange, fontSize: 12, fontWeight: 600 }}>
                            ⏳ Esperando aprobación del cliente
                          </span>
                        )}
                      </>
                    )}

                    {/* REPARACION */}
                    {orden.estado === "REPARACION" && (
                      <button
                        onClick={() => router.push(`/taller/reparacion/${orden.id}`)}
                        style={{
                          background: C.red, color: "#fff", border: "none", borderRadius: 8,
                          padding: "10px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700,
                          boxShadow: `0 2px 8px ${C.red}44`,
                        }}
                      >
                        🔧 Ir a Reparación
                      </button>
                    )}

                    {/* CONTROL_CALIDAD */}
                    {orden.estado === "CONTROL_CALIDAD" && !isConfirming && (
                      <>
                        {puedeCalidad ? (
                          <>
                            <button
                              onClick={() => confirmar(orden.id, "calidad")}
                              disabled={isLoading}
                              style={{
                                background: C.purple, color: "#fff", border: "none", borderRadius: 8,
                                padding: "10px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700,
                                boxShadow: `0 2px 8px ${C.purple}44`, opacity: isLoading ? 0.7 : 1,
                              }}
                            >
                              ✅ Aprobar Calidad → LISTO
                            </button>
                            <button
                              onClick={() => router.push(`/taller/reparacion/${orden.id}`)}
                              style={{
                                background: "transparent", color: C.muted,
                                border: `1px solid ${C.border}`, borderRadius: 8,
                                padding: "10px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
                              }}
                            >
                              🔧 Devolver a Reparación
                            </button>
                          </>
                        ) : (
                          <span style={{ color: C.purple, fontSize: 12, fontWeight: 600 }}>
                            🔍 En control de calidad — pendiente del gerente
                          </span>
                        )}
                      </>
                    )}

                    {/* LISTO */}
                    {orden.estado === "LISTO" && !isConfirming && (
                      <>
                        {puedeEntregar && (
                          <button
                            onClick={() => confirmar(orden.id, "entregar")}
                            disabled={isLoading}
                            style={{
                              background: C.green, color: "#fff", border: "none", borderRadius: 8,
                              padding: "10px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700,
                              boxShadow: `0 2px 8px ${C.green}44`, opacity: isLoading ? 0.7 : 1,
                            }}
                          >
                            🏁 Entregar al Cliente
                          </button>
                        )}
                        {esTecnico && (
                          <span style={{ color: C.green, fontSize: 12, fontWeight: 600 }}>
                            ✅ Listo para entrega — esperando secretaría
                          </span>
                        )}
                        <button
                          onClick={() => router.push(`/ordenes/${orden.id}`)}
                          style={{
                            background: "transparent", color: C.muted,
                            border: `1px solid ${C.border}`, borderRadius: 8,
                            padding: "10px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
                          }}
                        >
                          📄 Ver orden completa
                        </button>
                      </>
                    )}

                    {/* Siempre: link a orden completa */}
                    <button
                      onClick={() => router.push(`/ordenes/${orden.id}`)}
                      style={{
                        background: "transparent", color: C.muted,
                        border: `1px solid ${C.border}40`, borderRadius: 8,
                        padding: "8px 12px", cursor: "pointer", fontSize: 11, fontWeight: 500,
                        marginLeft: "auto",
                      }}
                    >
                      👁 Ver orden
                    </button>
                  </div>
                </div>
              );
            })}
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
