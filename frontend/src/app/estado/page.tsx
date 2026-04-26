"use client";
import { useState } from "react";
import { API_URL as API } from "@/config";

const ESTADO_INFO: Record<string, { color: string; icon: string; label: string; desc: string }> = {
  EN_PROCESO:   { color: "#f59e0b", icon: "🔧", label: "En Proceso",   desc: "Tu vehículo está siendo atendido por nuestro equipo." },
  COMPLETADO:   { color: "#3b82f6", icon: "✅", label: "Completado",   desc: "El servicio fue completado. Listo para retirar." },
  ENTREGADO:    { color: "#10b981", icon: "🏁", label: "Entregado",    desc: "Tu vehículo fue entregado satisfactoriamente." },
  FACTURADO:    { color: "#6b7280", icon: "🧾", label: "Facturado",    desc: "Servicio facturado y completado." },
};

export default function EstadoVehiculoPage() {
  const [placa, setPlaca]         = useState("");
  const [resultado, setResultado] = useState<any>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [detalleId, setDetalleId] = useState<number | null>(null);

  const consultar = async () => {
    const placaNorm = placa.trim().toUpperCase().replace(/\s+/g, "");
    if (!placaNorm) { setError("Ingresa un número de placa."); return; }
    setLoading(true);
    setError("");
    setResultado(null);
    setDetalleId(null);
    try {
      const res = await fetch(`${API}/vehiculo-historial/placa/${encodeURIComponent(placaNorm)}`);
      const data = await res.json();
      if (data.error) { setError("Error al consultar. Intenta de nuevo."); return; }
      if (!data.found || data.historial.length === 0) {
        setError("No encontramos registros para esta placa. Verifica el número o contacta al taller.");
        return;
      }
      setResultado(data);
    } catch {
      setError("Error de conexión. Verifica tu internet e intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const detalle = resultado?.historial?.find((h: any) => h.id === detalleId);
  const ultimo  = resultado?.historial?.[0];
  const estadoInfo = ESTADO_INFO[ultimo?.estado] || ESTADO_INFO["ENTREGADO"];

  return (
    <div style={outer}>

      {/* HEADER */}
      <div style={header}>
        <img src="/logo.png" alt="Logo" style={{ width: 52, height: 52, borderRadius: 12, objectFit: "contain", marginBottom: 10, background: "rgba(255,255,255,0.1)", padding: 4 }} />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: 0.5 }}>SÓLIDO AUTO SERVICIO</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#93c5fd" }}>Consulta el estado de tu vehículo</p>
      </div>

      <div style={body}>

        {/* BUSCADOR */}
        {!resultado && (
          <div style={card}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>🚗</div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111" }}>¿Cómo está tu vehículo?</h2>
              <p style={{ margin: "8px 0 0", fontSize: 14, color: "#888" }}>Ingresa el número de placa para ver el estado actual e historial de servicios.</p>
            </div>

            <label style={labelStyle}>Número de Placa</label>
            <input
              value={placa}
              onChange={e => { setPlaca(e.target.value.toUpperCase()); setError(""); }}
              onKeyDown={e => e.key === "Enter" && consultar()}
              placeholder="Ej: A123456"
              maxLength={10}
              style={inputStyle}
              autoFocus
            />

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#dc2626", display: "flex", gap: 8 }}>
                <span>⚠️</span><span>{error}</span>
              </div>
            )}

            <button onClick={consultar} disabled={loading} style={btnPrimary}>
              {loading ? "Consultando..." : "🔍 Consultar Estado"}
            </button>

            <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #f0f0f0", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 12, color: "#aaa" }}>¿Necesitas hablar con nosotros?</p>
              <a href="tel:8097122027" style={{ fontSize: 15, fontWeight: 700, color: "#3b82f6", textDecoration: "none", display: "block", marginTop: 6 }}>
                📞 809-712-2027
              </a>
            </div>
          </div>
        )}

        {/* RESULTADO */}
        {resultado && !detalle && (
          <div>
            {/* VEHÍCULO + ESTADO ACTUAL */}
            <div style={{ ...card, marginBottom: 16, background: "#111827", color: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Tu Vehículo</div>
                  <div style={{ fontSize: 22, fontWeight: 900 }}>
                    {resultado.vehiculo.marca} {resultado.vehiculo.modelo}
                  </div>
                  <div style={{ fontSize: 14, color: "#9ca3af", marginTop: 2 }}>
                    {resultado.vehiculo.ano && `${resultado.vehiculo.ano} · `}
                    {resultado.vehiculo.color && `${resultado.vehiculo.color}`}
                  </div>
                </div>
                <div style={{
                  background: "rgba(255,255,255,0.08)",
                  borderRadius: 10, padding: "8px 16px",
                  fontFamily: "monospace", fontSize: 18, fontWeight: 900, letterSpacing: 2, color: "#60a5fa"
                }}>
                  {resultado.vehiculo.placa}
                </div>
              </div>

              {/* ESTADO ACTUAL */}
              <div style={{ background: `${estadoInfo.color}22`, border: `1.5px solid ${estadoInfo.color}55`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 28 }}>{estadoInfo.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: estadoInfo.color }}>{estadoInfo.label}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{estadoInfo.desc}</div>
                </div>
              </div>
            </div>

            {/* RESUMEN ÚLTIMO SERVICIO */}
            {ultimo && (
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Último Servicio</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "#111" }}>{ultimo.tipo_servicio || "Servicio general"}</div>
                    <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
                      {ultimo.fecha_servicio ? new Date(ultimo.fecha_servicio).toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric" }) : "—"}
                      {ultimo.tecnico_nombre && ` · Técnico: ${ultimo.tecnico_nombre}`}
                    </div>
                  </div>
                  {ultimo.costo_total > 0 && (
                    <div style={{ fontWeight: 800, fontSize: 18, color: "#166534", background: "#f0fdf4", padding: "8px 14px", borderRadius: 10 }}>
                      RD$ {Number(ultimo.costo_total).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
                {ultimo.trabajos_realizados && (
                  <div style={{ marginTop: 12, background: "#f8fafc", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Trabajos Realizados</div>
                    <pre style={{ margin: 0, fontSize: 12, color: "#444", whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.7 }}>
                      {ultimo.trabajos_realizados}
                    </pre>
                  </div>
                )}
                {(ultimo.fallas_identificadas || ultimo.observaciones) && (
                  <div style={{ marginTop: 10, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", marginBottom: 6 }}>Observaciones</div>
                    {ultimo.fallas_identificadas && <p style={{ margin: "0 0 4px", fontSize: 12, color: "#555" }}>{ultimo.fallas_identificadas}</p>}
                    {ultimo.observaciones && <p style={{ margin: 0, fontSize: 12, color: "#555" }}>{ultimo.observaciones}</p>}
                  </div>
                )}
                {ultimo.ncf && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#888" }}>🧾 NCF: <b style={{ color: "#111" }}>{ultimo.ncf}</b></div>
                )}
              </div>
            )}

            {/* HISTORIAL TIMELINE */}
            {resultado.historial.length > 1 && (
              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>
                  Historial de Servicios ({resultado.historial.length} visitas)
                </div>
                <div style={{ position: "relative" }}>
                  {resultado.historial.map((h: any, idx: number) => {
                    const ei = ESTADO_INFO[h.estado] || ESTADO_INFO["ENTREGADO"];
                    return (
                      <div key={h.id} style={{ display: "flex", gap: 14, marginBottom: 16, position: "relative" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: "50%",
                            background: idx === 0 ? ei.color : "#e5e7eb",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 18, flexShrink: 0
                          }}>
                            {ei.icon}
                          </div>
                          {idx < resultado.historial.length - 1 && (
                            <div style={{ width: 2, flex: 1, background: "#e5e7eb", marginTop: 4, minHeight: 20 }} />
                          )}
                        </div>
                        <div
                          onClick={() => setDetalleId(h.id)}
                          style={{
                            flex: 1, background: idx === 0 ? "#f0fdf4" : "#f8fafc",
                            borderRadius: 12, padding: "12px 14px",
                            border: `1.5px solid ${idx === 0 ? "#86efac" : "#e5e7eb"}`,
                            cursor: "pointer"
                          }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 6 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>{h.tipo_servicio || "Servicio"}</div>
                            <span style={{
                              background: ei.color, color: "#fff",
                              padding: "2px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700
                            }}>
                              {ei.label}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                            {h.fecha_servicio ? new Date(h.fecha_servicio).toLocaleDateString("es-DO", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                            {h.tecnico_nombre && ` · ${h.tecnico_nombre}`}
                          </div>
                          {h.costo_total > 0 && (
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#166534", marginTop: 4 }}>
                              RD$ {Number(h.costo_total).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: "#3b82f6", marginTop: 6, fontWeight: 600 }}>Ver detalle →</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ACCIONES */}
            <div style={{ ...card, marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <a href="tel:8097122027" style={{ ...btnPrimary, textAlign: "center", textDecoration: "none", display: "block" }}>
                📞 Llamar al Taller
              </a>
              <button
                onClick={() => { setResultado(null); setPlaca(""); setError(""); setDetalleId(null); }}
                style={{ ...btnSecondary, width: "100%" }}>
                🔍 Consultar otro vehículo
              </button>
            </div>
          </div>
        )}

        {/* DETALLE DE UN SERVICIO ESPECÍFICO */}
        {detalle && (
          <div>
            <button onClick={() => setDetalleId(null)} style={{ ...btnSecondary, marginBottom: 16, width: "100%" }}>
              ← Volver al historial
            </button>

            <div style={{ ...card, background: "#111827", color: "#fff", marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
                {detalle.fecha_servicio ? new Date(detalle.fecha_servicio).toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric" }) : "—"}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{detalle.tipo_servicio}</div>
              {detalle.tecnico_nombre && <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>Técnico: {detalle.tecnico_nombre}</div>}
            </div>

            {(detalle.inspeccion_mecanica || detalle.inspeccion_electrica || detalle.inspeccion_electronica) && (
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={secTitleMobile}>🔍 Inspección Técnica</div>
                {detalle.inspeccion_mecanica && (
                  <div style={inspecBlock}>
                    <div style={inspecTit}>🔧 Mecánica</div>
                    <p style={inspecTxt}>{detalle.inspeccion_mecanica}</p>
                  </div>
                )}
                {detalle.inspeccion_electrica && (
                  <div style={inspecBlock}>
                    <div style={inspecTit}>⚡ Eléctrica</div>
                    <p style={inspecTxt}>{detalle.inspeccion_electrica}</p>
                  </div>
                )}
                {detalle.inspeccion_electronica && (
                  <div style={inspecBlock}>
                    <div style={inspecTit}>💻 Scanner / Electrónica</div>
                    <p style={inspecTxt}>{detalle.inspeccion_electronica}</p>
                  </div>
                )}
              </div>
            )}

            {(detalle.codigos_falla || detalle.fallas_identificadas) && (
              <div style={{ ...card, marginBottom: 16, background: "#fffbeb", border: "1px solid #fde68a" }}>
                <div style={secTitleMobile}>⚠️ Fallas Identificadas</div>
                {detalle.codigos_falla && <p style={{ fontSize: 13, margin: "0 0 6px", color: "#555" }}><b>Códigos:</b> {detalle.codigos_falla}</p>}
                {detalle.fallas_identificadas && <p style={{ fontSize: 13, margin: 0, color: "#555" }}>{detalle.fallas_identificadas}</p>}
              </div>
            )}

            {detalle.trabajos_realizados && (
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={secTitleMobile}>🛠️ Trabajos Realizados</div>
                <pre style={{ margin: 0, fontSize: 13, color: "#333", whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.7 }}>
                  {detalle.trabajos_realizados}
                </pre>
              </div>
            )}

            {detalle.observaciones && (
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={secTitleMobile}>📝 Observaciones</div>
                <p style={{ margin: 0, fontSize: 13, color: "#555" }}>{detalle.observaciones}</p>
              </div>
            )}

            {detalle.costo_total > 0 && (
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={secTitleMobile}>💰 Resumen de Costos</div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f0f0f0", fontSize: 14 }}>
                  <span style={{ color: "#888" }}>Mano de Obra</span>
                  <span style={{ fontWeight: 600 }}>RD$ {Number(detalle.costo_mano_obra || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f0f0f0", fontSize: 14 }}>
                  <span style={{ color: "#888" }}>Repuestos</span>
                  <span style={{ fontWeight: 600 }}>RD$ {Number(detalle.costo_repuestos || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontSize: 17, fontWeight: 800, color: "#166534" }}>
                  <span>Total</span>
                  <span>RD$ {Number(detalle.costo_total).toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
                </div>
                {detalle.ncf && <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>NCF: <b>{detalle.ncf}</b></div>}
              </div>
            )}
          </div>
        )}

        {/* FOOTER */}
        <div style={{ textAlign: "center", padding: "24px 0 8px", color: "#bbb", fontSize: 12 }}>
          <div style={{ fontWeight: 700, color: "#888", marginBottom: 4 }}>SÓLIDO AUTO SERVICIO</div>
          Tel: 809-712-2027 · Santo Domingo, RD
        </div>
      </div>
    </div>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────
const outer: any = {
  minHeight: "100vh",
  background: "linear-gradient(160deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
  fontFamily: "Arial, sans-serif",
};
const header: any = {
  textAlign: "center",
  padding: "36px 20px 28px",
};
const body: any = {
  maxWidth: 480,
  margin: "0 auto",
  padding: "0 16px 40px",
};
const card: any = {
  background: "#fff",
  borderRadius: 18,
  padding: 20,
  boxShadow: "0 4px 32px rgba(0,0,0,0.16)",
  marginBottom: 0,
};
const labelStyle: any = {
  display: "block",
  fontSize: 13,
  fontWeight: 700,
  color: "#555",
  marginBottom: 6,
};
const inputStyle: any = {
  display: "block",
  width: "100%",
  padding: "14px 16px",
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: 4,
  textTransform: "uppercase",
  borderRadius: 12,
  border: "2px solid #e5e7eb",
  marginBottom: 14,
  boxSizing: "border-box",
  textAlign: "center",
  outline: "none",
};
const btnPrimary: any = {
  padding: "15px 0",
  background: "#111827",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  fontWeight: 800,
  fontSize: 16,
  cursor: "pointer",
  width: "100%",
  display: "block",
};
const btnSecondary: any = {
  padding: "12px 0",
  background: "#f1f5f9",
  color: "#555",
  border: "1.5px solid #e5e7eb",
  borderRadius: 12,
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};
const secTitleMobile: any = {
  fontSize: 12,
  fontWeight: 700,
  color: "#888",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 10,
};
const inspecBlock: any = {
  background: "#f8fafc",
  borderRadius: 10,
  padding: "10px 14px",
  marginBottom: 8,
};
const inspecTit: any = { fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 4 };
const inspecTxt: any = { margin: 0, fontSize: 13, color: "#444", lineHeight: 1.6 };
