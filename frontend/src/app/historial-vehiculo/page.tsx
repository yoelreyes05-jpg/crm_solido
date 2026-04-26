"use client";
import { useEffect, useState } from "react";
import { API_URL as API } from "@/config";

const ESTADO_COLOR: Record<string, string> = {
  ENTREGADO:    "#10b981",
  EN_PROCESO:   "#f59e0b",
  COMPLETADO:   "#3b82f6",
  FACTURADO:    "#6b7280",
};

export default function HistorialVehiculoPage() {
  const [historial, setHistorial]   = useState<any[]>([]);
  const [filtrado, setFiltrado]     = useState<any[]>([]);
  const [busqueda, setBusqueda]     = useState("");
  const [detalle, setDetalle]       = useState<any>(null);
  const [loading, setLoading]       = useState(true);

  const fetchHistorial = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/vehiculo-historial`);
      const data = await res.json();
      setHistorial(Array.isArray(data) ? data : []);
      setFiltrado(Array.isArray(data) ? data : []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetchHistorial(); }, []);

  const buscar = (valor: string) => {
    setBusqueda(valor);
    setDetalle(null);
    const q = valor.toUpperCase().trim();
    if (!q) { setFiltrado(historial); return; }
    setFiltrado(historial.filter(h =>
      h.placa?.toUpperCase().includes(q) ||
      h.cliente_nombre?.toUpperCase().includes(q) ||
      h.marca?.toUpperCase().includes(q) ||
      h.modelo?.toUpperCase().includes(q) ||
      h.tipo_servicio?.toUpperCase().includes(q)
    ));
  };

  const buscarPorPlaca = async () => {
    const placa = busqueda.trim();
    if (!placa) return fetchHistorial();
    setLoading(true);
    try {
      const res = await fetch(`${API}/vehiculo-historial/placa/${encodeURIComponent(placa)}`);
      const data = await res.json();
      if (data.found) {
        setFiltrado(data.historial);
      } else {
        setFiltrado([]);
      }
    } catch { } finally { setLoading(false); }
  };

  return (
    <div style={container}>
      {/* ENCABEZADO */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={title}>📚 Historial de Vehículos</h1>
          <p style={{ color: "#888", margin: 0, fontSize: 14 }}>
            Registro permanente de todos los servicios realizados en el taller
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#111" }}>{historial.length}</div>
          <div style={{ fontSize: 12, color: "#888" }}>registros totales</div>
        </div>
      </div>

      {/* BUSCADOR */}
      <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={busqueda}
            onChange={e => buscar(e.target.value)}
            onKeyDown={e => e.key === "Enter" && buscarPorPlaca()}
            placeholder="🔍 Buscar por placa, cliente, marca, tipo de servicio..."
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 10,
              border: "1.5px solid #e5e7eb", fontSize: 15, outline: "none"
            }}
          />
          <button
            onClick={buscarPorPlaca}
            style={{
              padding: "12px 24px", background: "#111827", color: "#fff",
              border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer"
            }}>
            Buscar
          </button>
          {busqueda && (
            <button
              onClick={() => { setBusqueda(""); setFiltrado(historial); setDetalle(null); }}
              style={{
                padding: "12px 16px", background: "#f1f5f9", border: "1px solid #e5e7eb",
                borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13, color: "#555"
              }}>
              ✕ Limpiar
            </button>
          )}
        </div>
        {busqueda && (
          <div style={{ marginTop: 8, fontSize: 13, color: "#888" }}>
            {filtrado.length} resultado{filtrado.length !== 1 ? "s" : ""} encontrado{filtrado.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* DETALLE */}
      {detalle && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 4px 24px rgba(0,0,0,0.10)", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
                🚗 {detalle.marca} {detalle.modelo} · <span style={{ color: "#3b82f6" }}>{detalle.placa}</span>
              </h2>
              <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
                {detalle.ano} {detalle.color && `· ${detalle.color}`} · Cliente: <b>{detalle.cliente_nombre}</b>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{
                background: ESTADO_COLOR[detalle.estado] || "#888",
                color: "#fff", padding: "6px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13
              }}>
                {detalle.estado}
              </span>
              <button
                onClick={() => setDetalle(null)}
                style={{ padding: "8px 16px", background: "#f1f5f9", border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                ← Volver
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <InfoBox titulo="📋 Servicio">
              <InfoFila label="Tipo" valor={detalle.tipo_servicio} />
              <InfoFila label="Técnico" valor={detalle.tecnico_nombre || "—"} />
              <InfoFila label="Fecha" valor={detalle.fecha_servicio ? new Date(detalle.fecha_servicio).toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric" }) : "—"} />
              {detalle.ncf && <InfoFila label="NCF" valor={detalle.ncf} />}
            </InfoBox>
            <InfoBox titulo="💰 Costos del Servicio">
              <InfoFila label="Mano de Obra" valor={`RD$ ${Number(detalle.costo_mano_obra || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`} />
              <InfoFila label="Repuestos" valor={`RD$ ${Number(detalle.costo_repuestos || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`} />
              <div style={{ marginTop: 10, background: "#f0fdf4", borderRadius: 8, padding: "10px 14px", fontWeight: 800, fontSize: 17, color: "#166534" }}>
                Total: RD$ {Number(detalle.costo_total || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
              </div>
            </InfoBox>
          </div>

          {(detalle.inspeccion_mecanica || detalle.inspeccion_electrica || detalle.inspeccion_electronica) && (
            <div style={{ marginBottom: 16 }}>
              <div style={secTitle}>🔍 Inspección Técnica</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {detalle.inspeccion_mecanica && <InspeccionCard icono="🔧" titulo="Mecánica" texto={detalle.inspeccion_mecanica} />}
                {detalle.inspeccion_electrica && <InspeccionCard icono="⚡" titulo="Eléctrica" texto={detalle.inspeccion_electrica} />}
                {detalle.inspeccion_electronica && <InspeccionCard icono="💻" titulo="Scanner" texto={detalle.inspeccion_electronica} />}
              </div>
            </div>
          )}

          {(detalle.codigos_falla || detalle.fallas_identificadas) && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 8, fontSize: 14 }}>⚠️ Fallas y Códigos Identificados</div>
              {detalle.codigos_falla && <div style={{ fontSize: 13, marginBottom: 6 }}><b>Códigos:</b> {detalle.codigos_falla}</div>}
              {detalle.fallas_identificadas && <div style={{ fontSize: 13 }}>{detalle.fallas_identificadas}</div>}
            </div>
          )}

          {detalle.trabajos_realizados && (
            <div style={{ marginBottom: 16 }}>
              <div style={secTitle}>🛠️ Trabajos Realizados</div>
              <pre style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px", fontSize: 13, whiteSpace: "pre-wrap", fontFamily: "inherit", color: "#333", margin: 0 }}>
                {detalle.trabajos_realizados}
              </pre>
            </div>
          )}

          {detalle.observaciones && (
            <div>
              <div style={secTitle}>📝 Observaciones</div>
              <p style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 16px", margin: 0, fontSize: 13, color: "#555" }}>
                {detalle.observaciones}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TABLA */}
      {!detalle && (
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#888", fontSize: 15 }}>Cargando historial...</div>
          ) : filtrado.length === 0 ? (
            <div style={{ padding: 50, textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#555" }}>
                {busqueda ? `Sin resultados para "${busqueda}"` : "No hay registros de historial aún"}
              </div>
              <div style={{ fontSize: 13, color: "#aaa", marginTop: 8 }}>
                {busqueda ? "Intenta con otro número de placa o nombre de cliente" : "El historial se genera automáticamente al facturar un diagnóstico"}
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Placa", "Vehículo", "Cliente", "Tipo de Servicio", "Técnico", "Costo Total", "Estado", "Fecha", ""].map(h => (
                      <th key={h} style={{ padding: "13px 16px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrado.map((h: any) => (
                    <tr key={h.id} style={{ borderTop: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 800, fontSize: 14, color: "#3b82f6", fontFamily: "monospace" }}>
                        {h.placa}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13 }}>
                        {h.marca} {h.modelo} {h.ano && `(${h.ano})`}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>
                        {h.cliente_nombre || "—"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13 }}>
                        {h.tipo_servicio || "—"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13 }}>
                        {h.tecnico_nombre || "—"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#166534" }}>
                        {h.costo_total > 0
                          ? `RD$ ${Number(h.costo_total).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`
                          : <span style={{ color: "#aaa" }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          background: ESTADO_COLOR[h.estado] || "#888",
                          color: "#fff", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700
                        }}>
                          {h.estado || "ENTREGADO"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>
                        {h.fecha_servicio ? new Date(h.fecha_servicio).toLocaleDateString("es-DO") : "—"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <button
                          onClick={() => setDetalle(h)}
                          style={{ padding: "6px 14px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                          Ver →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes ────────────────────────────────
function InfoBox({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 12, padding: "16px 18px", border: "1px solid #e5e7eb" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: "#333" }}>{titulo}</div>
      {children}
    </div>
  );
}

function InfoFila({ label, valor }: { label: string; valor: string }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 13 }}>
      <span style={{ color: "#888", minWidth: 90 }}>{label}:</span>
      <span style={{ fontWeight: 600, color: "#111" }}>{valor}</span>
    </div>
  );
}

function InspeccionCard({ icono, titulo, texto }: { icono: string; titulo: string; texto: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: "#555" }}>{icono} {titulo}</div>
      <p style={{ margin: 0, fontSize: 12, color: "#444", lineHeight: 1.6 }}>{texto}</p>
    </div>
  );
}

const container: any = { padding: "24px 28px", background: "#f5f7fb", minHeight: "100vh" };
const title: any = { fontSize: 26, fontWeight: 900, margin: 0 };
const secTitle: any = { fontSize: 13, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 };
