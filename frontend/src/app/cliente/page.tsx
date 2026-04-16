
"use client";
import { useState, useEffect } from "react";

import { API_URL as API } from "@/config";

const ESTADO_INFO = {
  RECIBIDO:        { color: "#3b82f6", emoji: "📋", paso: 1, msg: "Tu vehículo fue recibido. Pronto será evaluado." },
  DIAGNOSTICO:     { color: "#f59e0b", emoji: "🔍", paso: 2, msg: "Nuestro técnico está evaluando tu vehículo." },
  REPARACION:      { color: "#ef4444", emoji: "🔧", paso: 3, msg: "Tu vehículo está siendo reparado por nuestro equipo." },
  CONTROL_CALIDAD: { color: "#8b5cf6", emoji: "✅", paso: 4, msg: "Revisión final de calidad en proceso." },
  LISTO:           { color: "#10b981", emoji: "🎉", paso: 5, msg: "¡Tu vehículo está listo! Puedes pasar a recogerlo." },
  ENTREGADO:       { color: "#6b7280", emoji: "🚗", paso: 6, msg: "Vehículo entregado. ¡Gracias por tu confianza!" },
};

const PASOS = ["RECIBIDO", "DIAGNOSTICO", "REPARACION", "CONTROL_CALIDAD", "LISTO", "ENTREGADO"];
const PASOS_LABEL = ["Recibido", "Diagnóstico", "Reparación", "Control Calidad", "Listo", "Entregado"];

export default function ClienteApp() {
  const [placa, setPlaca] = useState("");
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("estado");
  const [instalable, setInstalable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // Detectar si se puede instalar como PWA
  useEffect(() => {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setInstalable(true);
    });
  }, []);

  const instalarApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalable(false);
    setDeferredPrompt(null);
  };

  const buscar = async () => {
    if (!placa.trim()) return setError("Ingresa la placa de tu vehículo");
    setLoading(true);
    setError("");
    setResultado(null);

    try {
      const [vRes, oRes, dRes] = await Promise.all([
        fetch(`${API}/vehiculos`),
        fetch(`${API}/ordenes`),
        fetch(`${API}/diagnosticos`)
      ]);

      const vehiculos = await vRes.json();
      const ordenes = await oRes.json();
      const diagnosticos = await dRes.json();

      const vehiculo = vehiculos.find(v =>
        v.placa?.toUpperCase() === placa.trim().toUpperCase()
      );

      if (!vehiculo) {
        setError("No encontramos un vehículo con esa placa. Verifica e intenta de nuevo.");
        return;
      }

      const ordenesVehiculo = ordenes
        .filter(o => o.vehiculo_id === vehiculo.id || o.vehiculo_info?.includes(vehiculo.placa))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      const diagVehiculo = diagnosticos
        .filter(d => d.vehiculo_id === vehiculo.id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setResultado({ vehiculo, ordenes: ordenesVehiculo, diagnosticos: diagVehiculo });
    } catch {
      setError("Error de conexión. Intenta más tarde.");
    } finally {
      setLoading(false);
    }
  };

  const ultimaOrden = resultado?.ordenes?.[0];
  const estadoInfo = ultimaOrden ? (ESTADO_INFO[ultimaOrden.estado] || ESTADO_INFO.RECIBIDO) : null;
  const pasoActual = estadoInfo ? estadoInfo.paso : 0;

  return (
    <div style={appWrap}>
      {/* HEADER */}
      <div style={header}>
        <div style={{ fontSize: 36, marginBottom: 6 }}>🔧</div>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: "#fff", letterSpacing: 1 }}>
          SÓLIDO AUTO SERVICIO
        </h1>
        <p style={{ fontSize: 12, color: "#9ca3af", margin: "6px 0 0" }}>
          Portal del Cliente · 809-712-2027
        </p>

        {/* BOTÓN INSTALAR APP */}
        {instalable && (
          <button onClick={instalarApp} style={btnInstalar}>
            📲 Instalar App en tu celular
          </button>
        )}
      </div>

      <div style={content}>

        {/* ====== BUSCADOR ====== */}
        {!resultado && (
          <div style={card}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>🔎 Consulta tu Vehículo</h2>
            <p style={{ fontSize: 14, color: "#888", marginBottom: 20, lineHeight: 1.6 }}>
              Ingresa la placa de tu vehículo para ver su estado en tiempo real.
            </p>

            <label style={labelStyle}>Placa del vehículo</label>
            <input
              value={placa}
              onChange={e => setPlaca(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && buscar()}
              placeholder="Ej: A123456"
              maxLength={10}
              style={{
                display: "block", width: "100%", padding: "16px",
                fontSize: 24, fontWeight: 900, textAlign: "center",
                letterSpacing: 6, textTransform: "uppercase",
                borderRadius: 12, border: "2px solid #e5e7eb",
                boxSizing: "border-box", marginBottom: 16,
                background: "#f8fafc"
              }}
            />

            {error && (
              <div style={{ background: "#fee2e2", color: "#dc2626", padding: 14, borderRadius: 10, fontSize: 14, marginBottom: 14, fontWeight: 600, lineHeight: 1.5 }}>
                ❌ {error}
              </div>
            )}

            <button onClick={buscar} disabled={loading || !placa.trim()}
              style={{ ...btnBuscar, background: (!placa.trim() || loading) ? "#9ca3af" : "#111827" }}>
              {loading ? "⏳ Buscando..." : "🔍 Consultar Estado"}
            </button>

            {/* INFO */}
            <div style={{ marginTop: 24, padding: 16, background: "#f8fafc", borderRadius: 12, fontSize: 13, color: "#666", lineHeight: 1.8 }}>
              <b>¿Cómo funciona?</b><br />
              1. Ingresa la placa de tu vehículo<br />
              2. Ve el estado en tiempo real<br />
              3. Consulta el historial completo
            </div>
          </div>
        )}

        {/* ====== RESULTADO ====== */}
        {resultado && (
          <div>
            <button onClick={() => { setResultado(null); setPlaca(""); }}
              style={btnVolver}>
              ← Nueva consulta
            </button>

            {/* TARJETA VEHÍCULO */}
            <div style={{ background: "#111827", borderRadius: 18, padding: 20, marginBottom: 14, color: "#fff" }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <span style={{ fontSize: 48 }}>🚗</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 22, fontWeight: 900 }}>
                    {resultado.vehiculo.marca} {resultado.vehiculo.modelo}
                  </div>
                  <div style={{ fontSize: 14, color: "#9ca3af", marginTop: 2 }}>
                    Año {resultado.vehiculo.ano} {resultado.vehiculo.color ? `· ${resultado.vehiculo.color}` : ""}
                  </div>
                  <div style={{
                    marginTop: 10, display: "inline-block",
                    background: "#1f2937", padding: "6px 18px",
                    borderRadius: 8, fontWeight: 900, fontSize: 20,
                    letterSpacing: 4, border: "2px solid #374151"
                  }}>
                    {resultado.vehiculo.placa}
                  </div>
                </div>
              </div>
            </div>

            {/* ESTADO ACTUAL */}
            {ultimaOrden && estadoInfo && (
              <div style={{ ...card, borderLeft: `5px solid ${estadoInfo.color}`, marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: "#888", fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                  Estado Actual
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <span style={{ fontSize: 44 }}>{estadoInfo.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 22, color: estadoInfo.color }}>
                      {ultimaOrden.estado.replace("_", " ")}
                    </div>
                    <div style={{ fontSize: 14, color: "#555", marginTop: 4, lineHeight: 1.5 }}>
                      {estadoInfo.msg}
                    </div>
                  </div>
                </div>

                {/* BARRA DE PROGRESO */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                  {PASOS.map((paso, i) => {
                    const alcanzado = i < pasoActual;
                    const actual = i === pasoActual - 1;
                    return (
                      <div key={paso} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: alcanzado || actual ? ESTADO_INFO[paso]?.color || "#888" : "#e5e7eb",
                          color: "#fff", display: "flex", alignItems: "center",
                          justifyContent: "center", fontSize: 12, fontWeight: 800,
                          border: actual ? `3px solid ${estadoInfo.color}` : "none",
                          boxShadow: actual ? `0 0 0 3px ${estadoInfo.color}33` : "none"
                        }}>
                          {alcanzado || actual ? "✓" : i + 1}
                        </div>
                        <div style={{
                          fontSize: 9, marginTop: 4, textAlign: "center",
                          color: alcanzado || actual ? "#111" : "#aaa",
                          fontWeight: alcanzado || actual ? 700 : 400,
                          lineHeight: 1.2
                        }}>
                          {PASOS_LABEL[i]}
                        </div>
                        {i < PASOS.length - 1 && (
                          <div style={{
                            position: "absolute",
                            display: "none"
                          }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!ultimaOrden && (
              <div style={{ ...card, textAlign: "center", color: "#888", padding: 30 }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
                <p style={{ fontSize: 15 }}>No hay órdenes registradas para este vehículo aún.</p>
              </div>
            )}

            {/* TABS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[
                { key: "estado",    label: `📋 Servicios (${resultado.ordenes.length})` },
                { key: "historial", label: `🔬 Diagnósticos (${resultado.diagnosticos.length})` },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  style={{
                    padding: "12px 8px", borderRadius: 10, border: "1px solid #ddd",
                    cursor: "pointer", fontWeight: 700, fontSize: 13,
                    background: tab === t.key ? "#111827" : "#fff",
                    color: tab === t.key ? "#fff" : "#111"
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ÓRDENES */}
            {tab === "estado" && (
              <div>
                {resultado.ordenes.length === 0 ? (
                  <div style={{ ...card, textAlign: "center", color: "#888", padding: 24 }}>Sin servicios registrados</div>
                ) : resultado.ordenes.map(o => {
                  const info = ESTADO_INFO[o.estado] || ESTADO_INFO.RECIBIDO;
                  return (
                    <div key={o.id} style={{ ...card, borderLeft: `4px solid ${info.color}`, marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: 15 }}>Orden #{o.id}</span>
                        <span style={{ background: info.color, color: "#fff", padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                          {o.estado.replace("_", " ")}
                        </span>
                      </div>
                      {o.descripcion && (
                        <div style={{ fontSize: 14, color: "#555", marginBottom: 6, lineHeight: 1.5 }}>
                          {o.descripcion}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: "#aaa" }}>
                        📅 {o.created_at ? new Date(o.created_at).toLocaleDateString("es-DO", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* DIAGNÓSTICOS */}
            {tab === "historial" && (
              <div>
                {resultado.diagnosticos.length === 0 ? (
                  <div style={{ ...card, textAlign: "center", color: "#888", padding: 24 }}>Sin diagnósticos registrados</div>
                ) : resultado.diagnosticos.map(d => (
                  <div key={d.id} style={{ ...card, marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 15 }}>{d.tipo_servicio || "Diagnóstico"}</span>
                      <span style={{ background: "#f3f4f6", color: "#374151", padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                        {d.estado}
                      </span>
                    </div>
                    {d.fallas_identificadas && (
                      <div style={{ fontSize: 13, color: "#555", marginBottom: 6, padding: "8px 12px", background: "#fef9c3", borderRadius: 8, lineHeight: 1.5 }}>
                        ⚠️ <b>Fallas:</b> {d.fallas_identificadas}
                      </div>
                    )}
                    {d.observaciones && (
                      <div style={{ fontSize: 13, color: "#555", marginBottom: 6, lineHeight: 1.5 }}>
                        📝 {d.observaciones}
                      </div>
                    )}
                    {d.tecnico_nombre && (
                      <div style={{ fontSize: 12, color: "#888" }}>🔧 Técnico: {d.tecnico_nombre}</div>
                    )}
                    <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
                      📅 {d.created_at ? new Date(d.created_at).toLocaleDateString("es-DO", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FOOTER */}
        <div style={{ textAlign: "center", padding: "24px 0 16px", fontSize: 13, color: "#9ca3af", lineHeight: 2 }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>🔧</div>
          <div style={{ fontWeight: 700, color: "#555" }}>Sólido Auto Servicio</div>
          <div>📞 809-712-2027</div>
          <div>📍 Santo Domingo, República Dominicana</div>
          <div style={{ marginTop: 8, fontSize: 11 }}>© 2025 · Todos los derechos reservados</div>
        </div>
      </div>
    </div>
  );
}

const appWrap = { maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#f5f7fb" };
const header = { background: "#111827", padding: "32px 20px 28px", textAlign: "center" };
const content = { padding: "16px" };
const card = { background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 };
const labelStyle = { display: "block", fontSize: 14, fontWeight: 700, marginBottom: 8, color: "#555" };
const btnBuscar = { padding: 16, color: "#fff", border: "none", borderRadius: 14, cursor: "pointer", width: "100%", fontSize: 17, fontWeight: 800, transition: "all 0.2s" };
const btnVolver = { marginBottom: 14, padding: "10px 18px", background: "#f1f5f9", border: "1px solid #ddd", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 14 };
const btnInstalar = { marginTop: 14, padding: "10px 20px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 14 };