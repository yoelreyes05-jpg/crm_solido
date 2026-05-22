"use client";
import React, { useEffect, useState, useCallback, useRef, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  vehiculo_ano?: string;
  descripcion: string;
  created_at: string;
  total?: number;
  tecnico_asignado_id?: number;
}

interface DiagInfo {
  id: number;
  orden_id: number;
  descripcion?: string;
  mano_obra?: number;
  repuestos?: number;
  total?: number;
  costo_estimado?: number;
  tiempo_estimado?: string;
  usuario_nombre?: string;
  tecnico_nombre?: string;
}

// ── Paleta ────────────────────────────────────────────────────────────────────
const C = {
  bg:     "#f1f5f9",
  card:   "#ffffff",
  card2:  "#f8fafc",
  border: "#e2e8f0",
  text:   "#0f172a",
  muted:  "#64748b",
  blue:   "#3b82f6",
  green:  "#10b981",
  red:    "#ef4444",
  orange: "#f97316",
  yellow: "#d97706",
  purple: "#8b5cf6",
  teal:   "#14b8a6",
};

// ── Columnas Kanban ───────────────────────────────────────────────────────────
const COLUMNAS = [
  { key: "RECIBIDO",             label: "Recibido",         icon: "📥", color: C.blue   },
  { key: "DIAGNOSTICO",          label: "Diagnóstico",      icon: "🔬", color: C.yellow },
  { key: "ESPERANDO_APROBACION", label: "Esp. Aprobación",  icon: "⏳", color: C.orange },
  { key: "REPARACION",           label: "Reparando",        icon: "🔧", color: C.red    },
  { key: "CONTROL_CALIDAD",      label: "Control Calidad",  icon: "✅", color: C.purple },
  { key: "LISTO",                label: "Listo / Entrega",  icon: "🎉", color: C.green  },
];

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

// ── Helpers ───────────────────────────────────────────────────────────────────
function tiempoDesde(iso: string): string {
  const ms   = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60)   return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)   return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function fmtDinero(n?: number): string {
  if (!n) return "—";
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function whatsappUrl(tel?: string): string {
  if (!tel) return "#";
  const digits = tel.replace(/\D/g, "");
  const num = digits.startsWith("1") ? digits : "1" + digits;
  return `https://wa.me/${num}`;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function TallerPage() {
  const router = useRouter();
  const [ordenes,       setOrdenes]       = useState<Orden[]>([]);
  const [diagMap,       setDiagMap]       = useState<Record<number, DiagInfo>>({});
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState("");
  const [lastUpdate,    setLastUpdate]    = useState(new Date());
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [confirmId,     setConfirmId]     = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<"aprobar"|"rechazar"|"calidad"|"entregar"|null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [toast,         setToast]         = useState<{ msg: string; tipo: "ok"|"err" } | null>(null);
  const [vistaKanban,   setVistaKanban]   = useState(true);
  const [tabActivo,     setTabActivo]     = useState("TODOS");
  const [busquedaLista, setBusquedaLista] = useState("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Usuario desde localStorage (evitar SSR mismatch)
  const [usuario, setUsuario] = useState<Record<string, string>>({});
  useEffect(() => {
    try { setUsuario(JSON.parse(localStorage.getItem("usuario") || "{}")); } catch (_e) {}
  }, []);

  const nombreTecnico = usuario.nombre || usuario.name || "Técnico";
  const rolUsuario    = (usuario.rol || usuario.role || "tecnico").toLowerCase();
  const esTecnico     = rolUsuario === "tecnico";
  const puedeAprobar  = ["gerente","secretaria","admin"].includes(rolUsuario);
  const puedeCalidad  = ["gerente","admin"].includes(rolUsuario);
  const puedeEntregar = ["gerente","secretaria","admin"].includes(rolUsuario);

  const showToast = (msg: string, tipo: "ok"|"err" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Carga ─────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    try {
      const [rOrdenes, rDiag] = await Promise.all([
        fetch(`${API}/ordenes`, { cache: "no-store" }),
        fetch(`${API}/diagnosticos`, { cache: "no-store" }),
      ]);
      if (rOrdenes.ok) {
        const data = await rOrdenes.json();
        setOrdenes(Array.isArray(data) ? data : []);
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
    intervalRef.current = setInterval(cargar, 20000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [cargar]);

  // ── Acciones de flujo ─────────────────────────────────────────────────────
  async function ejecutarAccion(ordenId: number, accion: "aprobar"|"rechazar"|"calidad"|"entregar") {
    setActionLoading(ordenId);
    try {
      const endpoints: Record<string, string> = {
        aprobar:  `/ordenes/${ordenId}/aprobar`,
        rechazar: `/ordenes/${ordenId}/rechazar`,
        calidad:  `/ordenes/${ordenId}/calidad-aprobada`,
        entregar: `/ordenes/${ordenId}/entregar`,
      };
      const body: Record<string, unknown> = {
        usuario_id:     usuario.id,
        usuario_nombre: nombreTecnico,
        motivo: accion === "rechazar" ? (motivoRechazo || "Cliente rechazó la reparación")
              : accion === "aprobar"  ? "Cliente aprobó la reparación"
              : accion === "calidad"  ? "Pasó control de calidad"
              : "Vehículo entregado al cliente",
      };
      const res  = await fetch(`${API}${endpoints[accion]}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`);

      const msgs: Record<string, string> = {
        aprobar:  "✅ Aprobada — pasando a REPARACIÓN",
        rechazar: "🚫 Rechazada — orden CANCELADA",
        calidad:  "✅ Control de calidad aprobado — LISTO",
        entregar: "🏁 Vehículo entregado al cliente",
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

  // ── Render de tarjeta ─────────────────────────────────────────────────────
  function TarjetaOrden({ orden }: { orden: Orden }) {
    const diag         = diagMap[orden.id];
    const estadoInfo   = ESTADO_INFO[orden.estado] || { color: C.muted, label: orden.estado, icon: "" };
    const isConfirming = confirmId === orden.id;
    const isLoading    = actionLoading === orden.id;
    const tecnico      = diag?.tecnico_nombre || diag?.usuario_nombre || null;
    const monto        = Number(diag?.total || diag?.costo_estimado || diag?.mano_obra || orden.total || 0);
    const ot           = orden.numero_orden || `OT-${String(orden.id).padStart(4, "0")}`;

    return (
      <div style={{
        background: C.card,
        border: `1px solid ${estadoInfo.color}33`,
        borderLeft: `3px solid ${estadoInfo.color}`,
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
        fontSize: 13,
        boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
      }}>
        {/* Encabezado tarjeta */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: 15, color: C.blue }}>{ot}</span>
            {orden.prioridad && orden.prioridad !== "NORMAL" && (
              <span style={{
                marginLeft: 6,
                background: orden.prioridad === "URGENTE" ? C.red + "22" : C.orange + "22",
                color: orden.prioridad === "URGENTE" ? C.red : C.orange,
                border: `1px solid ${orden.prioridad === "URGENTE" ? C.red : C.orange}55`,
                borderRadius: 5, padding: "1px 7px", fontSize: 10, fontWeight: 700,
              }}>
                {orden.prioridad === "URGENTE" ? "🚨" : "⬆"} {orden.prioridad}
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: C.muted, background: C.card2, padding: "2px 7px", borderRadius: 5 }}>
            🕐 {tiempoDesde(orden.created_at)}
          </span>
        </div>

        {/* Cliente + Vehículo */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2, fontWeight: 700 }}>Cliente</div>
            <div style={{ fontWeight: 600, color: C.text }}>{orden.cliente_nombre}</div>
            {orden.cliente_telefono && (
              <a href={whatsappUrl(orden.cliente_telefono)} target="_blank" rel="noopener noreferrer"
                 style={{ fontSize: 11, color: "#25d366", textDecoration: "none", display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
                <span>💬</span> {orden.cliente_telefono}
              </a>
            )}
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2, fontWeight: 700 }}>Vehículo</div>
            <div style={{ fontWeight: 600, color: C.text }}>
              {orden.vehiculo_marca && orden.vehiculo_modelo
                ? `${orden.vehiculo_marca} ${orden.vehiculo_modelo}`
                : orden.vehiculo_info || "—"}
            </div>
            {orden.vehiculo_placa && (
              <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>🪪 {orden.vehiculo_placa}</div>
            )}
          </div>
        </div>

        {/* Problema reportado */}
        {orden.descripcion && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2, fontWeight: 700 }}>Problema</div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.4, maxHeight: 40, overflow: "hidden" }}>
              {orden.descripcion.length > 80 ? orden.descripcion.substring(0, 80) + "…" : orden.descripcion}
            </div>
          </div>
        )}

        {/* Técnico + Monto */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2, fontWeight: 700 }}>Técnico</div>
            <div style={{ fontSize: 12, color: tecnico ? C.text : C.muted, fontWeight: tecnico ? 600 : 400 }}>
              {tecnico || "Sin asignar"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2, fontWeight: 700 }}>Total estimado</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: monto > 0 ? C.green : C.muted }}>
              {monto > 0 ? fmtDinero(monto) : "—"}
            </div>
          </div>
        </div>

        {/* ── Confirmación inline ── */}
        {isConfirming && confirmAction && (
          <div style={{
            background: confirmAction === "rechazar" ? C.red + "11" : C.orange + "11",
            border: `1px solid ${confirmAction === "rechazar" ? C.red : C.orange}44`,
            borderRadius: 8, padding: 12, marginBottom: 10,
          }}>
            <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 12,
              color: confirmAction === "rechazar" ? C.red : C.orange }}>
              {confirmAction === "aprobar"  && "✅ ¿Confirmar aprobación?"}
              {confirmAction === "rechazar" && "🚫 ¿Confirmar rechazo?"}
              {confirmAction === "calidad"  && "✅ ¿Aprobar control de calidad?"}
              {confirmAction === "entregar" && "🏁 ¿Confirmar entrega del vehículo?"}
            </p>
            {confirmAction === "rechazar" && (
              <textarea
                value={motivoRechazo}
                onChange={e => setMotivoRechazo(e.target.value)}
                placeholder="Motivo del rechazo..."
                rows={2}
                style={{ width: "100%", background: C.card2, color: C.text,
                  border: `1px solid ${C.border}`, borderRadius: 6,
                  padding: "6px 8px", fontSize: 12, marginBottom: 8,
                  resize: "none", boxSizing: "border-box", fontFamily: "inherit" }}
              />
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => ejecutarAccion(orden.id, confirmAction)} disabled={isLoading}
                style={{ background: confirmAction === "rechazar" ? C.red : C.green, color: "#fff",
                  border: "none", borderRadius: 6, padding: "7px 14px",
                  fontWeight: 700, fontSize: 12, cursor: isLoading ? "not-allowed" : "pointer" }}>
                {isLoading ? "⏳..." : "✓ Confirmar"}
              </button>
              <button onClick={() => { setConfirmId(null); setConfirmAction(null); setMotivoRechazo(""); }}
                style={{ background: "transparent", color: C.muted, border: `1px solid ${C.border}`,
                  borderRadius: 6, padding: "7px 12px", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── Acciones principales ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>

          {/* Diagnóstico */}
          {orden.estado === "RECIBIDO" && (
            <button
              onClick={async () => {
                // Transicionar a DIAGNOSTICO de inmediato para que se mueva al tab correcto
                try {
                  await fetch(`${API}/ordenes/${orden.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      estado:         "DIAGNOSTICO",
                      usuario_id:     usuario.id     || null,
                      usuario_nombre: nombreTecnico,
                    }),
                  });
                  // Actualizar la lista localmente para que el kanban lo refleje
                  setOrdenes(prev => prev.map(o =>
                    o.id === orden.id ? { ...o, estado: "DIAGNOSTICO" } : o
                  ));
                  // En vista lista, cambiar al tab de Diagnóstico
                  if (!vistaKanban) setTabActivo("DIAGNOSTICO");
                } catch (_e) {}
                router.push(`/taller/diagnostico/${orden.id}`);
              }}
              style={{ background: C.yellow, color: "#111", border: "none", borderRadius: 7,
                padding: "7px 13px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
              🔬 Iniciar Diagnóstico
            </button>
          )}
          {orden.estado === "DIAGNOSTICO" && (
            <button onClick={() => router.push(`/taller/diagnostico/${orden.id}`)}
              style={{ background: C.yellow, color: "#111", border: "none", borderRadius: 7,
                padding: "7px 13px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
              🔬 Continuar Diagnóstico
            </button>
          )}

          {/* Aprobación */}
          {orden.estado === "ESPERANDO_APROBACION" && !isConfirming && puedeAprobar && (
            <>
              <button onClick={() => { setConfirmId(orden.id); setConfirmAction("aprobar"); }} disabled={isLoading}
                style={{ background: C.green, color: "#fff", border: "none", borderRadius: 7,
                  padding: "7px 13px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                ✅ Aprobar
              </button>
              <button onClick={() => { setConfirmId(orden.id); setConfirmAction("rechazar"); }} disabled={isLoading}
                style={{ background: C.red + "22", color: C.red, border: `1px solid ${C.red}55`,
                  borderRadius: 7, padding: "7px 13px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                ✗ Rechazar
              </button>
            </>
          )}

          {/* Reparación */}
          {orden.estado === "REPARACION" && (
            <button onClick={() => router.push(`/taller/reparacion/${orden.id}`)}
              style={{ background: C.red, color: "#fff", border: "none", borderRadius: 7,
                padding: "7px 13px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
              🔧 Ir a Reparación
            </button>
          )}

          {/* Control Calidad */}
          {orden.estado === "CONTROL_CALIDAD" && !isConfirming && puedeCalidad && (
            <button onClick={() => { setConfirmId(orden.id); setConfirmAction("calidad"); }} disabled={isLoading}
              style={{ background: C.purple, color: "#fff", border: "none", borderRadius: 7,
                padding: "7px 13px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
              ✅ Aprobar Calidad
            </button>
          )}

          {/* Listo → Entregar + WhatsApp aviso */}
          {orden.estado === "LISTO" && !isConfirming && (
            <>
              {puedeEntregar && (
                <button onClick={() => { setConfirmId(orden.id); setConfirmAction("entregar"); }} disabled={isLoading}
                  style={{ background: C.green, color: "#fff", border: "none", borderRadius: 7,
                    padding: "7px 13px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                  🏁 Entregar al Cliente
                </button>
              )}
              {orden.cliente_telefono && (
                <a
                  href={`https://wa.me/${(() => { const d = (orden.cliente_telefono||"").replace(/\D/g,""); return d.startsWith("1") ? d : "1"+d; })()}?text=${encodeURIComponent(`Hola ${orden.cliente_nombre}, le informamos que su ${orden.vehiculo_marca||""} ${orden.vehiculo_modelo||""} (placa ${orden.vehiculo_placa||""}) ya está listo para retirar en Sólido Auto Servicio.${monto > 0 ? ` Total a pagar: ${fmtDinero(monto)}.` : ""} ¡Le esperamos! 🔧`)}`}
                  target="_blank" rel="noopener noreferrer"
                >
                  <button style={{ background: "#25d366", color: "#fff", border: "none", borderRadius: 7,
                    padding: "7px 13px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                    📲 Avisar por WhatsApp
                  </button>
                </a>
              )}
            </>
          )}
        </div>

        {/* ── Acciones secundarias ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, borderTop: `1px solid ${C.border}44`, paddingTop: 8 }}>
          <Link href={`/ordenes/${orden.id}`}>
            <button style={btnSec()}>👁 Ver orden</button>
          </Link>
          <Link href={`/taller/diagnostico/${orden.id}`}>
            <button style={btnSec()}>📋 Diagnóstico</button>
          </Link>
          <Link href={`/inspeccion/${orden.id}`}>
            <button style={btnSec()}>🔍 Inspección</button>
          </Link>
          {orden.cliente_telefono && (
            <a href={whatsappUrl(orden.cliente_telefono)} target="_blank" rel="noopener noreferrer">
              <button style={{ ...btnSec(), color: "#25d366", borderColor: "#25d36644" }}>💬 WhatsApp</button>
            </a>
          )}
          <Link href={`/facturacion`}>
            <button style={btnSec()}>🧾 Factura</button>
          </Link>
        </div>
      </div>
    );
  }

  function btnSec(): CSSProperties {
    return {
      background: C.card2, color: C.muted,
      border: `1px solid ${C.border}`, borderRadius: 6,
      padding: "4px 9px", cursor: "pointer", fontSize: 11, fontWeight: 500,
    };
  }

  // ── Ordenar órdenes por prioridad y fecha ────────────────────────────────
  const ordenesActivas = ordenes.filter(o => o.estado !== "ENTREGADO" && o.estado !== "CANCELADA");
  const ordenesOrdenadas = [...ordenesActivas].sort((a, b) => {
    const prioVal = (p?: string) => p === "URGENTE" ? 0 : p === "ALTA" ? 1 : 2;
    if (prioVal(a.prioridad) !== prioVal(b.prioridad)) return prioVal(a.prioridad) - prioVal(b.prioridad);
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const ordenesPorEstado = (estado: string) => ordenesOrdenadas.filter(o => o.estado === estado);

  // Vista lista filtrada
  const TABS_LISTA = [
    { key: "TODOS", label: "Todas" },
    ...COLUMNAS.map(c => ({ key: c.key, label: c.label })),
  ];
  const listaFiltrada = (() => {
    let base = tabActivo === "TODOS" ? ordenesOrdenadas : ordenesOrdenadas.filter(o => o.estado === tabActivo);
    if (busquedaLista.trim()) {
      const q = busquedaLista.toLowerCase();
      base = base.filter(o =>
        [o.cliente_nombre, o.numero_orden, o.vehiculo_placa, o.vehiculo_marca, o.vehiculo_modelo, o.descripcion]
          .some(v => (v || "").toLowerCase().includes(q))
      );
    }
    return base;
  })();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          background: toast.tipo === "ok" ? "#d1fae5" : "#fee2e2",
          border: `1px solid ${toast.tipo === "ok" ? C.green : C.red}`,
          color: toast.tipo === "ok" ? "#065f46" : "#991b1b", borderRadius: 10, padding: "12px 18px",
          fontSize: 14, fontWeight: 600, boxShadow: "0 4px 20px #0008", maxWidth: 340,
        }}>{toast.msg}</div>
      )}

      {/* ── Header ── */}
      <div style={{
        background: C.card, borderBottom: `1px solid ${C.border}`,
        padding: "14px 24px", display: "flex", alignItems: "center",
        justifyContent: "space-between", flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>🔧 Mi Taller</h1>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: C.muted }}>
            Centro operativo · {nombreTecnico} ·{" "}
            <span style={{ color: C.yellow }}>
              Actualizado {lastUpdate.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Toggle vista */}
          <button onClick={() => setVistaKanban(!vistaKanban)}
            style={{ background: C.card2, color: C.muted, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            {vistaKanban ? "☰ Lista" : "⊞ Kanban"}
          </button>
          <button onClick={cargar}
            style={{ background: C.blue + "22", color: C.blue, border: `1px solid ${C.blue}44`,
              borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            ↻ Actualizar
          </button>
          {/* Nueva Recepción */}
          <Link href="/recepcion">
            <button style={{ background: C.green, color: "#fff", border: "none",
              borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700,
              boxShadow: `0 2px 10px ${C.green}44` }}>
              🚗 Nueva Recepción
            </button>
          </Link>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ margin: "12px 24px 0", background: C.red + "22", border: `1px solid ${C.red}55`,
          borderRadius: 8, padding: "10px 16px", color: C.red, fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Resumen rápido ── */}
      <div style={{ padding: "12px 24px 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {COLUMNAS.map(col => {
          const count = ordenesPorEstado(col.key).length;
          return (
            <div key={col.key} style={{
              background: count > 0 ? col.color + "18" : C.card,
              border: `1px solid ${count > 0 ? col.color + "44" : C.border}`,
              borderRadius: 8, padding: "5px 12px",
              display: "flex", alignItems: "center", gap: 6, fontSize: 12,
            }}>
              <span>{col.icon}</span>
              <span style={{ fontWeight: 700, color: count > 0 ? col.color : C.muted }}>{count}</span>
              <span style={{ color: C.muted }}>{col.label}</span>
            </div>
          );
        })}
      </div>

      {/* ── Panel: Listas para entregar hoy ── */}
      {(() => {
        const listas = ordenesActivas.filter(o => o.estado === "LISTO");
        if (listas.length === 0) return null;
        return (
          <div style={{ margin: "12px 24px 0", background: C.green + "12", border: `1px solid ${C.green}44`, borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: C.green, marginBottom: 8 }}>
              🎉 {listas.length} vehículo{listas.length > 1 ? "s" : ""} listo{listas.length > 1 ? "s" : ""} para entregar
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {listas.map(o => {
                const diag = diagMap[o.id];
                const monto = Number(diag?.total || diag?.costo_estimado || o.total || 0);
                return (
                  <div key={o.id} style={{ background: C.card, borderRadius: 8, padding: "8px 12px", border: `1px solid ${C.green}55`, boxShadow: "0 1px 4px #0000000d", display: "flex", alignItems: "center", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{o.cliente_nombre}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>
                        {o.vehiculo_placa && <span style={{ fontFamily: "monospace" }}>🪪 {o.vehiculo_placa} · </span>}
                        {o.numero_orden || `OT-${String(o.id).padStart(4,"0")}`}
                        {monto > 0 && <span style={{ color: C.green, fontWeight: 700, marginLeft: 6 }}>· {fmtDinero(monto)}</span>}
                      </div>
                    </div>
                    {o.cliente_telefono && (
                      <a
                        href={`https://wa.me/${(() => { const d=(o.cliente_telefono||"").replace(/\D/g,""); return d.startsWith("1")?d:"1"+d; })()}?text=${encodeURIComponent(`Hola ${o.cliente_nombre}, su ${o.vehiculo_marca||""} ${o.vehiculo_modelo||""} (placa ${o.vehiculo_placa||""}) ya está listo para retirar en Sólido Auto Servicio.${monto>0?` Total: ${fmtDinero(monto)}.`:""} ¡Le esperamos! 🔧`)}`}
                        target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}
                      >
                        <button style={{ background: "#25d366", color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          💬 Avisar
                        </button>
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {loading ? (
        <div style={{ textAlign: "center", color: C.muted, padding: 80, fontSize: 15 }}>⏳ Cargando órdenes...</div>
      ) : vistaKanban ? (

        // ── VISTA KANBAN ──────────────────────────────────────────────────────
        <div style={{ padding: "16px 24px", overflowX: "auto" }}>
          <div style={{ display: "flex", gap: 14, minWidth: "max-content", alignItems: "flex-start" }}>
            {COLUMNAS.map(col => {
              const items = ordenesPorEstado(col.key);
              return (
                <div key={col.key} style={{
                  width: 300, background: C.card2,
                  border: `1px solid ${col.color}33`,
                  borderRadius: 12, overflow: "hidden", flexShrink: 0,
                }}>
                  {/* Cabecera columna */}
                  <div style={{
                    background: col.color + "22", borderBottom: `2px solid ${col.color}`,
                    padding: "10px 14px", display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span style={{ fontSize: 16 }}>{col.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: col.color }}>{col.label}</span>
                    <span style={{
                      marginLeft: "auto", background: col.color, color: "#fff",
                      borderRadius: 10, padding: "2px 8px", fontSize: 12, fontWeight: 700,
                    }}>{items.length}</span>
                  </div>

                  {/* Tarjetas */}
                  <div style={{ padding: "10px 10px 2px", maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}>
                    {items.length === 0 ? (
                      <div style={{ textAlign: "center", color: C.muted, padding: "28px 10px", fontSize: 12 }}>
                        Sin órdenes
                      </div>
                    ) : (
                      items.map(orden => <TarjetaOrden key={orden.id} orden={orden} />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      ) : (

        // ── VISTA LISTA ───────────────────────────────────────────────────────
        <div style={{ padding: "14px 24px" }}>
          {/* Búsqueda */}
          <input
            type="text"
            value={busquedaLista}
            onChange={e => setBusquedaLista(e.target.value)}
            placeholder="🔍 Buscar por cliente, placa, OT..."
            style={{
              width: "100%", maxWidth: 420, padding: "9px 14px", marginBottom: 14,
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, boxShadow: "0 1px 4px #0000000a",
              color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box", display: "block",
            }}
          />
          {/* Tabs filtro */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${C.border}`, overflowX: "auto", paddingBottom: 0 }}>
            {TABS_LISTA.map(t => {
              const col = COLUMNAS.find(c => c.key === t.key);
              const count = t.key === "TODOS" ? ordenesOrdenadas.length : ordenesPorEstado(t.key).length;
              const activo = tabActivo === t.key;
              const color = col?.color || C.muted;
              return (
                <button key={t.key} onClick={() => setTabActivo(t.key)}
                  style={{
                    background: activo ? color + "22" : "transparent",
                    color: activo ? color : C.muted,
                    border: activo ? `1px solid ${color}55` : "1px solid transparent",
                    borderBottom: activo ? `2px solid ${color}` : "2px solid transparent",
                    borderRadius: "8px 8px 0 0",
                    padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
                  }}>
                  {col?.icon || "📋"} {t.label}
                  {count > 0 && (
                    <span style={{ background: activo ? color : C.border, color: activo ? "#fff" : C.muted,
                      borderRadius: 10, padding: "1px 6px", fontSize: 11, fontWeight: 700 }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {listaFiltrada.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: C.muted, fontSize: 15 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
              <p>No hay órdenes en este estado.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {listaFiltrada.map(orden => <TarjetaOrden key={orden.id} orden={orden} />)}
            </div>
          )}
        </div>
      )}

      <div style={{ textAlign: "center", padding: "8px 0 20px", fontSize: 11, color: C.muted }}>
        Auto-actualización cada 20 segundos
      </div>
    </div>
  );
}
