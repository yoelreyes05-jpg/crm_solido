"use client";
import { useState, useRef } from "react";
import { API_URL as API } from "@/config";

// ── Tipos de correo ────────────────────────────────────────────────────────
const TIPOS_CORREO = [
  { key: "cotizacion",  icon: "💰", label: "Cotización",         desc: "Cliente pide precio o presupuesto" },
  { key: "estado",      icon: "🔍", label: "Estado Vehículo",    desc: "Cliente pregunta por su vehículo" },
  { key: "reclamo",     icon: "⚠️", label: "Reclamo / Queja",    desc: "Cliente insatisfecho o con problema" },
  { key: "cita",        icon: "📅", label: "Agendar Cita",       desc: "Cliente solicita o confirma cita" },
  { key: "seguimiento", icon: "⭐", label: "Seguimiento",         desc: "Post-servicio, verificar satisfacción" },
  { key: "nuevo",       icon: "✏️", label: "Nuevo Correo",       desc: "Redactar correo desde cero" },
  { key: "general",     icon: "📬", label: "General",             desc: "Otro tipo de correo" },
];

const TONOS = [
  { key: "profesional", label: "Profesional" },
  { key: "cordial",     label: "Cordial y cercano" },
  { key: "formal",      label: "Muy formal" },
  { key: "empático",    label: "Empático" },
];

// ── Historial local (session) ────────────────────────────────────────────────
type Borrador = {
  id:        number;
  tipo:      string;
  cliente:   string;
  respuesta: string;
  ts:        string;
};

let _id = 0;

export default function AsistenteCorreoPage() {
  const [tipo,         setTipo]        = useState("general");
  const [tono,         setTono]        = useState("profesional");
  const [correoIn,     setCorreoIn]    = useState("");
  const [nombreCliente,setNombreCliente] = useState("");
  const [respuesta,    setRespuesta]   = useState("");
  const [loading,      setLoading]     = useState(false);
  const [error,        setError]       = useState("");
  const [copiado,      setCopiado]     = useState(false);
  const [historial,    setHistorial]   = useState<Borrador[]>([]);
  const [verHistorial, setVerHistorial] = useState(false);
  const [tokens,       setTokens]      = useState<number | null>(null);
  const respRef = useRef<HTMLTextAreaElement>(null);

  // ── Generar respuesta ────────────────────────────────────────────────────
  const generar = async () => {
    if (!correoIn.trim() && tipo !== "nuevo") {
      setError("Pega el correo entrante o selecciona 'Nuevo Correo'.");
      return;
    }
    setLoading(true);
    setError("");
    setRespuesta("");
    setTokens(null);

    try {
      const res = await fetch(`${API}/asistente-correo`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correo_entrante: correoIn,
          tipo_correo:     tipo,
          nombre_cliente:  nombreCliente,
          tono,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al generar respuesta");

      setRespuesta(data.respuesta);
      setTokens(data.tokens);

      // Guardar en historial local
      const nuevo: Borrador = {
        id:        ++_id,
        tipo,
        cliente:   nombreCliente || "Sin nombre",
        respuesta: data.respuesta,
        ts:        new Date().toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" }),
      };
      setHistorial(h => [nuevo, ...h].slice(0, 20));

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Copiar al portapapeles ───────────────────────────────────────────────
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(respuesta);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      respRef.current?.select();
      document.execCommand("copy");
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  };

  const limpiar = () => {
    setCorreoIn("");
    setRespuesta("");
    setNombreCliente("");
    setError("");
    setTokens(null);
  };

  const tipoActivo = TIPOS_CORREO.find(t => t.key === tipo);

  return (
    <div style={S.page}>
      {/* ── HEADER ── */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>✉️ Asistente de Correo</h1>
          <p style={S.subtitle}>SÓLIDO AUTO SERVICIO — Genera respuestas profesionales con IA</p>
        </div>
        <button
          onClick={() => setVerHistorial(v => !v)}
          style={{ ...S.btnSecondary, position: "relative" }}
        >
          📋 Historial
          {historial.length > 0 && (
            <span style={S.badge}>{historial.length}</span>
          )}
        </button>
      </div>

      <div style={S.grid}>
        {/* ══ COLUMNA IZQUIERDA — entrada ══ */}
        <div style={S.col}>

          {/* Tipo de correo */}
          <div style={S.card}>
            <div style={S.cardTitle}>📂 Tipo de Correo</div>
            <div style={S.tiposGrid}>
              {TIPOS_CORREO.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTipo(t.key)}
                  style={{
                    ...S.tipoBtn,
                    ...(tipo === t.key ? S.tipoBtnActive : {}),
                  }}
                >
                  <span style={{ fontSize: 20 }}>{t.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{t.label}</span>
                  <span style={{ fontSize: 10, color: tipo === t.key ? "#93c5fd" : "#64748b", marginTop: 1 }}>{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Configuración */}
          <div style={S.card}>
            <div style={S.cardTitle}>⚙️ Configuración</div>
            <div style={S.row}>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Nombre del cliente (opcional)</label>
                <input
                  value={nombreCliente}
                  onChange={e => setNombreCliente(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  style={S.input}
                />
              </div>
              <div style={{ width: 160 }}>
                <label style={S.label}>Tono del correo</label>
                <select
                  value={tono}
                  onChange={e => setTono(e.target.value)}
                  style={S.select}
                >
                  {TONOS.map(t => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Correo entrante */}
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={S.cardTitle}>
                {tipo === "nuevo" ? "✏️ Instrucciones para el correo nuevo" : "📥 Correo Entrante"}
              </div>
              {correoIn && (
                <button onClick={() => setCorreoIn("")} style={S.btnXS}>✕ Limpiar</button>
              )}
            </div>
            <textarea
              value={correoIn}
              onChange={e => setCorreoIn(e.target.value)}
              placeholder={
                tipo === "nuevo"
                  ? "Describe qué correo quieres redactar. Ej: 'Correo para recordar a Juan Pérez que su Toyota Corolla está listo para recoger'"
                  : "Pega aquí el correo del cliente al que necesitas responder..."
              }
              style={{ ...S.textarea, minHeight: 220 }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
              <span style={{ fontSize: 11, color: "#475569" }}>
                {correoIn.length > 0 ? `${correoIn.length} caracteres` : ""}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={limpiar} style={S.btnSecondary}>🗑 Limpiar todo</button>
                <button
                  onClick={generar}
                  disabled={loading}
                  style={{ ...S.btnPrimary, ...(loading ? { opacity: 0.7 } : {}) }}
                >
                  {loading ? "⏳ Generando..." : `✨ Generar Respuesta`}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div style={S.errorBox}>⚠️ {error}</div>
          )}
        </div>

        {/* ══ COLUMNA DERECHA — respuesta ══ */}
        <div style={S.col}>
          <div style={{ ...S.card, flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={S.cardTitle}>
                📤 Borrador de Respuesta
                {tipoActivo && (
                  <span style={S.tipoPill}>
                    {tipoActivo.icon} {tipoActivo.label}
                  </span>
                )}
              </div>
              {respuesta && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={copiar} style={{ ...S.btnPrimary, background: copiado ? "#059669" : undefined }}>
                    {copiado ? "✅ Copiado" : "📋 Copiar"}
                  </button>
                  <button onClick={generar} style={S.btnSecondary} disabled={loading}>
                    🔄 Regenerar
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div style={S.loadingBox}>
                <div style={S.spinner}>✨</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", marginTop: 16 }}>Generando respuesta...</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>OpenAI está redactando tu correo</div>
              </div>
            ) : respuesta ? (
              <>
                <textarea
                  ref={respRef}
                  value={respuesta}
                  onChange={e => setRespuesta(e.target.value)}
                  style={{ ...S.textarea, flex: 1, minHeight: 420, background: "rgba(16,185,129,0.03)", borderColor: "rgba(16,185,129,0.2)", fontFamily: "'Georgia', serif", lineHeight: 1.8 }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                  <span style={{ fontSize: 11, color: "#475569" }}>
                    Puedes editar el texto antes de enviarlo
                    {tokens !== null && <span style={{ marginLeft: 10, color: "#334155" }}>· {tokens} tokens usados</span>}
                  </span>
                  <button onClick={copiar} style={{ ...S.btnPrimary, fontSize: 13, padding: "7px 18px", background: copiado ? "#059669" : undefined }}>
                    {copiado ? "✅ Copiado" : "📋 Copiar todo"}
                  </button>
                </div>
              </>
            ) : (
              <div style={S.emptyBox}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#475569", marginBottom: 8 }}>
                  Listo para generar tu respuesta
                </div>
                <div style={{ fontSize: 13, color: "#334155", textAlign: "center", maxWidth: 300 }}>
                  Selecciona el tipo de correo, pega el mensaje del cliente y presiona{" "}
                  <strong style={{ color: "#6366f1" }}>Generar Respuesta</strong>
                </div>
                <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 320 }}>
                  {["Cotizaciones y presupuestos", "Estado del vehículo", "Reclamos con empatía", "Seguimiento post-servicio"].map(item => (
                    <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#475569" }}>
                      <span style={{ color: "#6366f1" }}>✓</span> {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ HISTORIAL LATERAL ══ */}
      {verHistorial && (
        <div style={S.historialOverlay} onClick={() => setVerHistorial(false)}>
          <div style={S.historialPanel} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#e2e8f0" }}>📋 Borradores generados</div>
              <button onClick={() => setVerHistorial(false)} style={S.btnXS}>✕</button>
            </div>
            {historial.length === 0 ? (
              <div style={{ color: "#475569", fontSize: 13, textAlign: "center", marginTop: 40 }}>
                Sin borradores aún.<br />Genera tu primer correo.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {historial.map(b => {
                  const t = TIPOS_CORREO.find(x => x.key === b.tipo);
                  return (
                    <div
                      key={b.id}
                      style={S.histItem}
                      onClick={() => { setRespuesta(b.respuesta); setVerHistorial(false); }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>
                          {t?.icon} {t?.label}
                        </span>
                        <span style={{ fontSize: 10, color: "#475569" }}>{b.ts}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>👤 {b.cliente}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                        {b.respuesta.substring(0, 100)}...
                      </div>
                      <div style={{ fontSize: 11, color: "#6366f1", marginTop: 6, fontWeight: 700 }}>
                        Clic para restaurar →
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Estilos ─────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0a0f1e",
    color: "#e2e8f0",
    padding: "28px 24px",
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: 900,
    color: "#fff",
    margin: 0,
    fontFamily: "'Syne', 'Inter', sans-serif",
  },
  subtitle: {
    fontSize: 13,
    color: "#475569",
    margin: "4px 0 0",
    fontWeight: 500,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
    alignItems: "start",
  },
  col: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  card: {
    background: "#111827",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: "18px 20px",
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    color: "#64748b",
    marginBottom: 14,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  tiposGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
  },
  tipoBtn: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    padding: "10px 6px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    cursor: "pointer",
    color: "#94a3b8",
    transition: "all .15s",
    gap: 2,
  },
  tipoBtnActive: {
    background: "rgba(99,102,241,0.15)",
    borderColor: "rgba(99,102,241,0.5)",
    color: "#a5b4fc",
  },
  row: {
    display: "flex",
    gap: 12,
    alignItems: "flex-end",
  },
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: "#475569",
    marginBottom: 6,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
  },
  input: {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "9px 12px",
    color: "#e2e8f0",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box" as const,
  },
  select: {
    width: "100%",
    background: "#1e293b",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "9px 12px",
    color: "#e2e8f0",
    fontSize: 13,
    outline: "none",
    cursor: "pointer",
  },
  textarea: {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: "12px 14px",
    color: "#e2e8f0",
    fontSize: 13,
    resize: "vertical" as const,
    outline: "none",
    fontFamily: "inherit",
    lineHeight: 1.6,
    boxSizing: "border-box" as const,
  },
  btnPrimary: {
    background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "9px 20px",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    transition: "all .2s",
  },
  btnSecondary: {
    background: "rgba(255,255,255,0.06)",
    color: "#94a3b8",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "9px 16px",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  btnXS: {
    background: "rgba(255,255,255,0.06)",
    color: "#64748b",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 12,
    cursor: "pointer",
  },
  tipoPill: {
    marginLeft: 10,
    background: "rgba(99,102,241,0.15)",
    color: "#a5b4fc",
    borderRadius: 20,
    padding: "2px 10px",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "none" as const,
    letterSpacing: 0,
  },
  badge: {
    position: "absolute" as const,
    top: -6,
    right: -6,
    background: "#6366f1",
    color: "#fff",
    borderRadius: "50%",
    width: 18,
    height: 18,
    fontSize: 10,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 10,
    padding: "12px 16px",
    fontSize: 13,
    color: "#fca5a5",
  },
  loadingBox: {
    flex: 1,
    minHeight: 300,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: {
    fontSize: 36,
    animation: "spin 1.5s linear infinite",
  },
  emptyBox: {
    flex: 1,
    minHeight: 340,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    color: "#334155",
  },
  historialOverlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    zIndex: 100,
    display: "flex",
    justifyContent: "flex-end",
  },
  historialPanel: {
    width: 360,
    background: "#111827",
    borderLeft: "1px solid rgba(255,255,255,0.08)",
    height: "100%",
    overflowY: "auto" as const,
    padding: "24px 20px",
  },
  histItem: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "12px 14px",
    cursor: "pointer",
    transition: "border-color .15s",
  },
};
