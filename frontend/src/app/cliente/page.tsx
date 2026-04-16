"use client";
import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL!;

const ESTADO_INFO = {
  RECIBIDO:        { color: "#3b82f6", emoji: "📋", msg: "Tu vehículo fue recibido y está en espera de evaluación." },
  DIAGNOSTICO:     { color: "#f59e0b", emoji: "🔍", msg: "Nuestro técnico está evaluando tu vehículo." },
  REPARACION:      { color: "#ef4444", emoji: "🔧", msg: "Tu vehículo está siendo reparado por nuestro equipo." },
  CONTROL_CALIDAD: { color: "#8b5cf6", emoji: "✅", msg: "Revisión final de calidad en proceso." },
  LISTO:           { color: "#10b981", emoji: "🎉", msg: "¡Tu vehículo está listo! Puedes pasar a recogerlo." },
  ENTREGADO:       { color: "#6b7280", emoji: "🚗", msg: "Vehículo entregado. ¡Gracias por tu confianza!" },
};

export default function ClienteApp() {
  const [placa, setPlaca] = useState("");
  const [nombre, setNombre] = useState("");
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("estado");

  const buscar = async () => {
    if (!placa.trim()) return setError("Ingresa la placa de tu vehículo");
    setLoading(true);
    setError("");
    setResultado(null);

    try {
      // Buscar vehículo por placa
      const vRes = await fetch(`${API}/vehiculos`);
      const vehiculos = await vRes.json();
      const vehiculo = vehiculos.find(v =>
        v.placa?.toUpperCase() === placa.trim().toUpperCase()
      );

      if (!vehiculo) {
        setError("No encontramos un vehículo con esa placa. Verifica e intenta de nuevo.");
        return;
      }

      // Buscar órdenes del vehículo
      const oRes = await fetch(`${API}/ordenes`);
      const ordenes = await oRes.json();
      const ordenesVehiculo = ordenes.filter(o => o.vehiculo_id === vehiculo.id || o.vehiculo_info?.includes(vehiculo.placa));

      // Buscar diagnósticos
      const dRes = await fetch(`${API}/diagnosticos`);
      const diagnosticos = await dRes.json();
      const diagVehiculo = diagnosticos.filter(d => d.vehiculo_id === vehiculo.id);

      setResultado({ vehiculo, ordenes: ordenesVehiculo, diagnosticos: diagVehiculo });
    } catch {
      setError("Error de conexión. Intenta más tarde.");
    } finally { setLoading(false); }
  };

  const ultimaOrden = resultado?.ordenes?.[0];
  const estadoInfo = ultimaOrden ? (ESTADO_INFO[ultimaOrden.estado] || ESTADO_INFO.RECIBIDO) : null;

  return (
    <div style={appContainer}>
      {/* HEADER */}
      <div style={header}>
        <div style={{ fontSize: 32, marginBottom: 4 }}>🔧</div>
        <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: "#fff" }}>SÓLIDO AUTO SERVICIO</h1>
        <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0" }}>Portal del Cliente · 809-712-2027</p>
      </div>

      <div style={content}>
        {/* BUSCADOR */}
        {!resultado && (
          <div style={card}>
            <h2 style={cardTitle}>🔎 Consulta tu Vehículo</h2>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
              Ingresa la placa de tu vehículo para ver su estado en tiempo real.
            </p>

            <label style={label}>Placa del vehículo *</label>
            <input
              value={placa}
              onChange={e => setPlaca(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && buscar()}
              placeholder="Ej: A123456"
              style={{ ...input, fontSize: 20, fontWeight: 800, textAlign: "center", letterSpacing: 4, textTransform: "uppercase" }}
            />

            <label style={label}>Tu nombre (opcional)</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Para confirmar tu identidad" style={input} />

            {error && (
              <div style={{ background: "#fee2e2", color: "#dc2626", padding: "12px", borderRadius: 10, fontSize: 13, marginBottom: 12, fontWeight: 600 }}>
                ❌ {error}
              </div>
            )}

            <button onClick={buscar} disabled={loading} style={btnBuscar}>
              {loading ? "Buscando..." : "Consultar Estado"}
            </button>
          </div>
        )}

        {/* RESULTADO */}
        {resultado && (
          <div>
            <button onClick={() => setResultado(null)} style={btnVolver}>← Nueva consulta</button>

            {/* VEHÍCULO */}
            <div style={{ ...card, background: "#111827", color: "#fff", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <span style={{ fontSize: 40 }}>🚗</span>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>
                    {resultado.vehiculo.marca} {resultado.vehiculo.modelo}
                  </div>
                  <div style={{ fontSize: 14, color: "#9ca3af" }}>
                    {resultado.vehiculo.ano} · {resultado.vehiculo.color || ""}
                  </div>
                  <div style={{ marginTop: 6, background: "#1f2937", padding: "4px 14px", borderRadius: 8, display: "inline-block", fontWeight: 800, fontSize: 16, letterSpacing: 2 }}>
                    {resultado.vehiculo.placa}
                  </div>
                </div>
              </div>
            </div>

            {/* ESTADO ACTUAL */}
            {ultimaOrden && estadoInfo && (
              <div style={{ ...card, borderLeft: `5px solid ${estadoInfo.color}`, marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: "#888", marginBottom: 6 }}>ESTADO ACTUAL</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 40 }}>{estadoInfo.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 20, color: estadoInfo.color }}>
                      {ultimaOrden.estado}
                    </div>
                    <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>{estadoInfo.msg}</div>
                  </div>
                </div>

                {/* BARRA DE PROGRESO */}
                <div style={{ marginTop: 16 }}>
                  {["RECIBIDO", "DIAGNOSTICO", "REPARACION", "CONTROL_CALIDAD", "LISTO", "ENTREGADO"].map((est, i) => {
                    const estados = ["RECIBIDO","DIAGNOSTICO","REPARACION","CONTROL_CALIDAD","LISTO","ENTREGADO"];
                    const idx = estados.indexOf(ultimaOrden.estado);
                    const alcanzado = i <= idx;
                    return (
                      <div key={est} style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: "50%",
                          background: alcanzado ? ESTADO_INFO[est]?.color : "#e5e7eb",
                          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700, flexShrink: 0
                        }}>
                          {alcanzado ? "✓" : i + 1}
                        </div>
                        <div style={{ marginLeft: 10, fontSize: 12, fontWeight: alcanzado ? 700 : 400, color: alcanzado ? "#111" : "#9ca3af" }}>
                          {est.replace("_", " ")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TABS */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {["estado", "historial"].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  style={{ ...tabBtn, background: tab === t ? "#111827" : "#fff", color: tab === t ? "#fff" : "#111", flex: 1 }}>
                  {t === "estado" ? "📋 Órdenes" : "🔬 Diagnósticos"}
                </button>
              ))}
            </div>

            {/* ÓRDENES */}
            {tab === "estado" && (
              <div style={card}>
                <h3 style={{ marginBottom: 12, fontSize: 15 }}>📋 Historial de Servicios</h3>
                {resultado.ordenes.length === 0 ? (
                  <p style={{ color: "#888", textAlign: "center", padding: 20 }}>Sin órdenes registradas</p>
                ) : resultado.ordenes.map(o => (
                  <div key={o.id} style={{ borderLeft: `4px solid ${ESTADO_INFO[o.estado]?.color || "#888"}`, paddingLeft: 12, marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 700 }}>Orden #{o.id}</span>
                      <span style={{ background: ESTADO_INFO[o.estado]?.color || "#888", color: "#fff", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                        {o.estado}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>{o.descripcion}</div>
                    <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>
                      {o.created_at ? new Date(o.created_at).toLocaleDateString("es-DO") : "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* DIAGNÓSTICOS */}
            {tab === "historial" && (
              <div style={card}>
                <h3 style={{ marginBottom: 12, fontSize: 15 }}>🔬 Historial de Diagnósticos</h3>
                {resultado.diagnosticos.length === 0 ? (
                  <p style={{ color: "#888", textAlign: "center", padding: 20 }}>Sin diagnósticos registrados</p>
                ) : resultado.diagnosticos.map(d => (
                  <div key={d.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: 700 }}>{d.tipo_servicio}</span>
                      <span style={{ fontSize: 11, color: "#888" }}>
                        {d.created_at ? new Date(d.created_at).toLocaleDateString("es-DO") : "—"}
                      </span>
                    </div>
                    {d.fallas_identificadas && (
                      <div style={{ fontSize: 12, color: "#555" }}>
                        <b>Fallas:</b> {d.fallas_identificadas}
                      </div>
                    )}
                    {d.observaciones && (
                      <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                        <b>Observaciones:</b> {d.observaciones}
                      </div>
                    )}
                    <div style={{ marginTop: 6 }}>
                      <span style={{ background: "#f3f4f6", color: "#374151", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                        {d.estado}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FOOTER */}
        <div style={{ textAlign: "center", padding: "20px 0", fontSize: 12, color: "#9ca3af" }}>
          <div>📞 809-712-2027</div>
          <div>Santo Domingo, República Dominicana</div>
          <div style={{ marginTop: 8, fontSize: 11 }}>© 2025 Sólido Auto Servicio</div>
        </div>
      </div>
    </div>
  );
}

const appContainer = { maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#f5f7fb" };

const header: React.CSSProperties = { background: "#111827", padding: "28px 20px 24px", textAlign: "center" };


const content = { padding: "16px" };
const card = { background: "#fff", borderRadius: 14, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 };
const cardTitle = { fontSize: 17, fontWeight: 700, marginBottom: 8 };
const label = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#555" };


const input: React.CSSProperties = { display: "block", marginBottom: 12, padding: 12, width: "100%", borderRadius: 10, border: "1px solid #e5e7eb", boxSizing: "border-box", fontSize: 14 };

const btnBuscar = { padding: 14, background: "#111827", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", width: "100%", fontSize: 16, fontWeight: 800 };
const btnVolver = { marginBottom: 12, padding: "8px 16px", background: "#f1f5f9", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 };
const tabBtn = { padding: "10px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", fontWeight: 600, fontSize: 13 };