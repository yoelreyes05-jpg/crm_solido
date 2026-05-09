"use client";
import { useEffect, useState, useCallback } from "react";
import { API_URL as API } from "@/config";

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Orden {
  id: number;
  numero_orden: string;
  estado: string;
  cliente_nombre: string;
  cliente_telefono?: string;
  vehiculo_info: string;
  descripcion: string;
  created_at: string;
  aprobacion_at?: string;
}

interface Diagnostico {
  id: number;
  orden_id: number;
  descripcion: string;
  mano_obra: number;
  repuestos: number;
  total: number;
  tiempo_estimado?: string;
  mano_de_obra_detalle?: string;
  notas?: string;
}

interface Toast {
  id: number;
  tipo: "ok" | "error";
  msg: string;
}

// ── Colores ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#0f172a",
  card: "#1e293b",
  cardHover: "#263248",
  border: "#334155",
  text: "#e2e8f0",
  muted: "#94a3b8",
  orange: "#f97316",
  green: "#10b981",
  red: "#ef4444",
  blue: "#3b82f6",
  yellow: "#f59e0b",
  purple: "#8b5cf6",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function tiempoDesde(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h ${mins % 60} min`;
  return `hace ${Math.floor(hrs / 24)} día(s)`;
}

function esUrgente(iso: string): boolean {
  const ms = Date.now() - new Date(iso).getTime();
  return ms > 2 * 60 * 60 * 1000; // más de 2 horas
}

function fmtDinero(n: number): string {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(n || 0);
}

function numeroOrden(o: Orden): string {
  return o.numero_orden || `OT-${String(o.id).padStart(4, "0")}`;
}

function esDiasRecientes(iso: string, dias = 7): boolean {
  const ms = Date.now() - new Date(iso).getTime();
  return ms < dias * 24 * 60 * 60 * 1000;
}

// ── Componente Toast ──────────────────────────────────────────────────────────
function ToastList({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        zIndex: 9999,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: t.tipo === "ok" ? C.green : C.red,
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            maxWidth: 340,
          }}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── Modal de Rechazo ──────────────────────────────────────────────────────────
function ModalRechazo({
  orden,
  onCancel,
  onConfirm,
}: {
  orden: Orden;
  onCancel: () => void;
  onConfirm: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    if (!motivo.trim()) {
      setError("El motivo es requerido para registrar el rechazo.");
      return;
    }
    onConfirm(motivo.trim());
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        style={{
          background: C.card,
          borderRadius: 16,
          padding: 28,
          width: "100%",
          maxWidth: 480,
          border: `1px solid ${C.border}`,
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        <h2 style={{ color: C.red, margin: "0 0 6px", fontSize: 20 }}>
          ❌ Registrar Rechazo
        </h2>
        <p style={{ color: C.muted, fontSize: 13, margin: "0 0 20px" }}>
          Orden: <strong style={{ color: C.text }}>{numeroOrden(orden)}</strong>{" "}
          — {orden.cliente_nombre}
        </p>

        <label
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            color: C.muted,
            marginBottom: 6,
          }}
        >
          Motivo del rechazo *
        </label>
        <textarea
          autoFocus
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value);
            if (e.target.value.trim()) setError("");
          }}
          placeholder="Ej: El cliente no tiene presupuesto en este momento. Prefiere retirar el vehículo sin reparar..."
          rows={4}
          style={{
            width: "100%",
            background: "#0f172a",
            border: `1.5px solid ${error ? C.red : C.border}`,
            borderRadius: 8,
            color: C.text,
            fontSize: 14,
            padding: "10px 12px",
            resize: "vertical",
            boxSizing: "border-box",
            fontFamily: "inherit",
            outline: "none",
          }}
        />
        {error && (
          <p style={{ color: C.red, fontSize: 12, margin: "4px 0 0" }}>{error}</p>
        )}

        <div
          style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: "10px 20px",
              background: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              color: C.muted,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            style={{
              padding: "10px 22px",
              background: C.red,
              border: "none",
              borderRadius: 8,
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            ❌ Confirmar Rechazo
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta de Orden ──────────────────────────────────────────────────────────
function TarjetaOrden({
  orden,
  diagnostico,
  onAprobar,
  onRechazar,
  procesando,
}: {
  orden: Orden;
  diagnostico?: Diagnostico;
  onAprobar: (id: number) => void;
  onRechazar: (orden: Orden) => void;
  procesando: boolean;
}) {
  const urgente = esUrgente(orden.aprobacion_at || orden.created_at);
  const bordeColor = urgente ? C.red : C.orange;
  const tiempoRef = orden.aprobacion_at || orden.created_at;

  const telefono = orden.cliente_telefono?.replace(/\D/g, "") || "";
  const whatsappNum = telefono.startsWith("1") ? telefono : `1${telefono}`;
  const whatsappMsg = encodeURIComponent(
    `Hola ${orden.cliente_nombre}, le contactamos de Sólido Auto Servicio sobre su vehículo (${orden.vehiculo_info}). Tenemos lista la cotización de su reparación. ¿Podría darnos su respuesta?`
  );

  return (
    <div
      style={{
        background: C.card,
        borderRadius: 14,
        borderLeft: `4px solid ${bordeColor}`,
        padding: "20px 22px",
        marginBottom: 16,
        boxShadow: urgente ? `0 0 18px ${C.red}33` : "0 2px 12px rgba(0,0,0,0.3)",
        position: "relative",
      }}
    >
      {/* Header de tarjeta */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: C.text,
            }}
          >
            {numeroOrden(orden)}
          </span>
          <span
            style={{
              background: `${C.orange}22`,
              color: C.orange,
              border: `1.5px solid ${C.orange}44`,
              borderRadius: 20,
              padding: "3px 12px",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            ⏳ Esperando Aprobación
          </span>
          {urgente && (
            <span
              style={{
                background: `${C.red}22`,
                color: C.red,
                border: `1.5px solid ${C.red}44`,
                borderRadius: 20,
                padding: "3px 10px",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              🔴 URGENTE
            </span>
          )}
        </div>
        <span style={{ color: C.muted, fontSize: 12 }}>
          {tiempoDesde(tiempoRef)}
        </span>
      </div>

      {/* Info cliente + vehículo */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px 20px",
          marginBottom: 16,
        }}
      >
        <div>
          <p style={{ color: C.muted, fontSize: 11, margin: "0 0 2px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Cliente
          </p>
          <p style={{ color: C.text, fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>
            {orden.cliente_nombre}
          </p>
          {orden.cliente_telefono && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <a
                href={`tel:${orden.cliente_telefono}`}
                style={{
                  padding: "4px 10px",
                  background: `${C.blue}22`,
                  color: C.blue,
                  border: `1px solid ${C.blue}44`,
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                📞 {orden.cliente_telefono}
              </a>
              <a
                href={`https://wa.me/${whatsappNum}?text=${whatsappMsg}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "4px 10px",
                  background: "#25d36622",
                  color: "#25d366",
                  border: "1px solid #25d36644",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                💬 WhatsApp
              </a>
            </div>
          )}
        </div>

        <div>
          <p style={{ color: C.muted, fontSize: 11, margin: "0 0 2px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Vehículo
          </p>
          <p style={{ color: C.text, fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>
            {orden.vehiculo_info}
          </p>
          <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>{orden.descripcion}</p>
        </div>
      </div>

      {/* Cotización del técnico */}
      {diagnostico ? (
        <div
          style={{
            background: "#0f172a",
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            padding: "14px 18px",
            marginBottom: 18,
          }}
        >
          <p
            style={{
              color: C.muted,
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              margin: "0 0 12px",
            }}
          >
            💰 Cotización del Técnico
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div>
              <p style={{ color: C.muted, fontSize: 11, margin: "0 0 2px" }}>Mano de obra</p>
              <p style={{ color: C.text, fontSize: 15, fontWeight: 600, margin: 0 }}>
                {fmtDinero(diagnostico.mano_obra)}
              </p>
            </div>
            <div>
              <p style={{ color: C.muted, fontSize: 11, margin: "0 0 2px" }}>Repuestos</p>
              <p style={{ color: C.text, fontSize: 15, fontWeight: 600, margin: 0 }}>
                {fmtDinero(diagnostico.repuestos)}
              </p>
            </div>
            {diagnostico.tiempo_estimado && (
              <div>
                <p style={{ color: C.muted, fontSize: 11, margin: "0 0 2px" }}>Tiempo estimado</p>
                <p style={{ color: C.text, fontSize: 14, fontWeight: 600, margin: 0 }}>
                  {diagnostico.tiempo_estimado}
                </p>
              </div>
            )}
          </div>

          {/* Total grande */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: `1px solid ${C.border}`,
              paddingTop: 10,
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            <span style={{ color: C.muted, fontSize: 13, fontWeight: 700 }}>TOTAL A COBRAR</span>
            <span
              style={{
                color: C.green,
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: -0.5,
              }}
            >
              {fmtDinero(diagnostico.total)}
            </span>
          </div>

          {diagnostico.mano_de_obra_detalle && (
            <div style={{ marginTop: 10 }}>
              <p style={{ color: C.muted, fontSize: 11, margin: "0 0 2px", fontWeight: 600 }}>Detalle mano de obra</p>
              <p style={{ color: C.text, fontSize: 13, margin: 0 }}>{diagnostico.mano_de_obra_detalle}</p>
            </div>
          )}

          {diagnostico.notas && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 12px",
                background: `${C.yellow}11`,
                border: `1px solid ${C.yellow}33`,
                borderRadius: 6,
              }}
            >
              <p style={{ color: C.yellow, fontSize: 11, margin: "0 0 2px", fontWeight: 700 }}>NOTAS DEL TÉCNICO</p>
              <p style={{ color: C.text, fontSize: 13, margin: 0 }}>{diagnostico.notas}</p>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            background: "#0f172a",
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            padding: "14px 18px",
            marginBottom: 18,
            color: C.muted,
            fontSize: 13,
            fontStyle: "italic",
          }}
        >
          Sin cotización del técnico registrada aún.
        </div>
      )}

      {/* Botones de acción */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          disabled={procesando}
          onClick={() => onAprobar(orden.id)}
          style={{
            flex: 1,
            minWidth: 160,
            padding: "14px",
            background: procesando ? "#1e293b" : C.green,
            color: "#fff",
            border: "none",
            borderRadius: 10,
            cursor: procesando ? "not-allowed" : "pointer",
            fontSize: 15,
            fontWeight: 800,
            opacity: procesando ? 0.6 : 1,
            transition: "opacity 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          ✅ Cliente Aprueba
        </button>
        <button
          disabled={procesando}
          onClick={() => onRechazar(orden)}
          style={{
            flex: 1,
            minWidth: 160,
            padding: "14px",
            background: procesando ? "#1e293b" : C.red,
            color: "#fff",
            border: "none",
            borderRadius: 10,
            cursor: procesando ? "not-allowed" : "pointer",
            fontSize: 15,
            fontWeight: 800,
            opacity: procesando ? 0.6 : 1,
            transition: "opacity 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          ❌ Cliente Rechaza
        </button>
      </div>
    </div>
  );
}

// ── Tarjeta Historial ─────────────────────────────────────────────────────────
function TarjetaHistorial({ orden }: { orden: Orden }) {
  const aprobada = orden.estado === "REPARACION";
  const color = aprobada ? C.green : C.red;
  const label = aprobada ? "✅ Aprobada" : "❌ Rechazada";

  return (
    <div
      style={{
        background: C.card,
        borderRadius: 12,
        borderLeft: `4px solid ${color}`,
        padding: "14px 18px",
        marginBottom: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>
          {numeroOrden(orden)}
        </span>
        <span style={{ color: C.muted, fontSize: 13 }}>{orden.cliente_nombre}</span>
        <span style={{ color: C.muted, fontSize: 13 }}>{orden.vehiculo_info}</span>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span
          style={{
            background: `${color}22`,
            color,
            border: `1.5px solid ${color}44`,
            borderRadius: 20,
            padding: "3px 12px",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {label}
        </span>
        <span style={{ color: C.muted, fontSize: 12 }}>
          {tiempoDesde(orden.created_at)}
        </span>
      </div>
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────
export default function AprobacionPage() {
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [diagnosticos, setDiagnosticos] = useState<Diagnostico[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pendientes" | "historial">("pendientes");
  const [procesando, setProcesando] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [modalRechazo, setModalRechazo] = useState<Orden | null>(null);

  // ── Toast helpers ──
  const addToast = useCallback((tipo: "ok" | "error", msg: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, tipo, msg }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    try {
      const [oRes, dRes] = await Promise.all([
        fetch(`${API}/ordenes`),
        fetch(`${API}/diagnosticos`),
      ]);
      const o = await oRes.json();
      const d = await dRes.json();
      setOrdenes(Array.isArray(o) ? o : []);
      setDiagnosticos(Array.isArray(d) ? d : []);
    } catch (err) {
      console.error("Error al cargar datos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Listas filtradas ──
  const pendientes = ordenes.filter((o) => o.estado === "ESPERANDO_APROBACION");
  const historial = ordenes.filter(
    (o) =>
      (o.estado === "REPARACION" || o.estado === "CANCELADA") &&
      esDiasRecientes(o.created_at, 7)
  );

  // ── Aprobar ──
  const handleAprobar = async (id: number) => {
    setProcesando(true);
    try {
      const usr = JSON.parse(localStorage.getItem("usuario") || "{}");
      const res = await fetch(`${API}/ordenes/${id}/aprobar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_nombre: usr.nombre || "Secretaria",
          usuario_id: usr.id || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast("error", data.error || "Error al aprobar la orden.");
      } else {
        addToast("ok", "✅ Reparación aprobada correctamente.");
        await fetchData();
      }
    } catch {
      addToast("error", "Error de red al aprobar la orden.");
    } finally {
      setProcesando(false);
    }
  };

  // ── Rechazar ──
  const handleRechazarConfirm = async (motivo: string) => {
    if (!modalRechazo) return;
    const orden = modalRechazo;
    setModalRechazo(null);
    setProcesando(true);
    try {
      const usr = JSON.parse(localStorage.getItem("usuario") || "{}");
      const res = await fetch(`${API}/ordenes/${orden.id}/rechazar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivo,
          usuario_nombre: usr.nombre || "Secretaria",
          usuario_id: usr.id || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast("error", data.error || "Error al rechazar la orden.");
      } else {
        addToast("ok", "❌ Rechazo registrado correctamente.");
        await fetchData();
      }
    } catch {
      addToast("error", "Error de red al rechazar la orden.");
    } finally {
      setProcesando(false);
    }
  };

  // ── Render ──
  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        padding: "24px 20px 60px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: C.text,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: C.text }}>
            ✅ Aprobaciones Pendientes
          </h1>
          <p style={{ margin: "4px 0 0", color: C.muted, fontSize: 13 }}>
            Gestiona las respuestas de los clientes sobre sus cotizaciones
          </p>
        </div>
        {pendientes.length > 0 && (
          <div
            style={{
              background: `${C.orange}22`,
              border: `2px solid ${C.orange}`,
              color: C.orange,
              borderRadius: 12,
              padding: "10px 20px",
              fontWeight: 800,
              fontSize: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            ⏳ {pendientes.length} pendiente{pendientes.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        {(["pendientes", "historial"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              border: `1px solid ${tab === t ? C.orange : C.border}`,
              background: tab === t ? `${C.orange}22` : "transparent",
              color: tab === t ? C.orange : C.muted,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
              transition: "all 0.15s",
            }}
          >
            {t === "pendientes"
              ? `⏳ Pendientes${pendientes.length > 0 ? ` (${pendientes.length})` : ""}`
              : `📋 Historial (7 días)`}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 200,
            color: C.muted,
            fontSize: 15,
          }}
        >
          Cargando órdenes...
        </div>
      ) : tab === "pendientes" ? (
        pendientes.length === 0 ? (
          <div
            style={{
              background: C.card,
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: "48px 24px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 52, marginBottom: 14 }}>✅</div>
            <p style={{ color: C.text, fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>
              No hay órdenes pendientes de aprobación
            </p>
            <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
              Todas las cotizaciones han sido respondidas. Se actualizará automáticamente.
            </p>
          </div>
        ) : (
          <div>
            {pendientes.map((orden) => {
              const diag = diagnosticos.find((d) => d.orden_id === orden.id);
              return (
                <TarjetaOrden
                  key={orden.id}
                  orden={orden}
                  diagnostico={diag}
                  onAprobar={handleAprobar}
                  onRechazar={setModalRechazo}
                  procesando={procesando}
                />
              );
            })}
          </div>
        )
      ) : (
        <div>
          {historial.length === 0 ? (
            <div
              style={{
                background: C.card,
                borderRadius: 14,
                border: `1px solid ${C.border}`,
                padding: "36px 24px",
                textAlign: "center",
                color: C.muted,
                fontSize: 14,
              }}
            >
              No hay órdenes aprobadas o rechazadas en los últimos 7 días.
            </div>
          ) : (
            historial.map((o) => <TarjetaHistorial key={o.id} orden={o} />)
          )}
        </div>
      )}

      {/* Modal rechazo */}
      {modalRechazo && (
        <ModalRechazo
          orden={modalRechazo}
          onCancel={() => setModalRechazo(null)}
          onConfirm={handleRechazarConfirm}
        />
      )}

      {/* Toasts */}
      <ToastList toasts={toasts} />
    </div>
  );
}
