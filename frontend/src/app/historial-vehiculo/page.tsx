"use client";
import { useEffect, useState } from "react";
import { API_URL as API } from "@/config";

// ── Helpers ────────────────────────────────────────────
const moneda = (v: any) =>
  `RD$ ${Number(v || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`;

const fmtFecha = (v: any) =>
  v ? new Date(v).toLocaleDateString("es-DO", { year: "numeric", month: "short", day: "numeric" }) : null;

const fmtFechaHora = (v: any) =>
  v ? new Date(v).toLocaleString("es-DO", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

const ESTADO_COLOR: Record<string, string> = {
  ENTREGADO:            "#10b981",
  LISTO:                "#3b82f6",
  REPARACION:           "#f59e0b",
  CONTROL_CALIDAD:      "#8b5cf6",
  ESPERANDO_APROBACION: "#f97316",
  DIAGNOSTICO:          "#6366f1",
  RECIBIDO:             "#64748b",
  CANCELADO:            "#ef4444",
  APROBADO:             "#10b981",
  RECHAZADO:            "#ef4444",
};

// ── Sub-componentes ────────────────────────────────────
function Seccion({ icono, titulo, children }: { icono: string; titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#6366f1", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
        {icono} {titulo}
      </div>
      {children}
    </div>
  );
}

function Fila({ label, valor, destaca }: { label: string; valor: any; destaca?: boolean }) {
  if (valor === null || valor === undefined || valor === "") return null;
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 7, fontSize: 13 }}>
      <span style={{ color: "#888", minWidth: 140, flexShrink: 0 }}>{label}:</span>
      <span style={{ fontWeight: destaca ? 800 : 600, color: destaca ? "#111" : "#333" }}>{valor}</span>
    </div>
  );
}

function Card({ children, bg, border }: { children: React.ReactNode; bg?: string; border?: string }) {
  return (
    <div style={{ background: bg || "#f8fafc", borderRadius: 12, padding: "14px 18px", border: `1px solid ${border || "#e5e7eb"}` }}>
      {children}
    </div>
  );
}

function Badge({ texto, color }: { texto: string; color?: string }) {
  return (
    <span style={{ background: color || ESTADO_COLOR[texto] || "#888", color: "#fff", padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
      {texto}
    </span>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid #e5e7eb", margin: "22px 0" }} />;
}

function SinDatos({ texto = "Sin información registrada" }: { texto?: string }) {
  return <p style={{ color: "#bbb", fontSize: 13, margin: 0, fontStyle: "italic" }}>{texto}</p>;
}

// ── Página principal ───────────────────────────────────
export default function HistorialVehiculoPage() {
  const [historial, setHistorial] = useState<any[]>([]);
  const [filtrado,  setFiltrado]  = useState<any[]>([]);
  const [busqueda,  setBusqueda]  = useState("");
  const [detalle,   setDetalle]   = useState<any>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/vehiculo-historial`);
      const data = await res.json();
      const lista = Array.isArray(data) ? data : [];
      setHistorial(lista);
      setFiltrado(lista);
    } catch { } finally { setLoading(false); }
  };

  const buscar = (valor: string) => {
    setBusqueda(valor);
    setDetalle(null);
    const q = valor.toUpperCase().trim();
    if (!q) { setFiltrado(historial); return; }
    setFiltrado(historial.filter(h =>
      h.placa?.toUpperCase().includes(q)          ||
      h.cliente_nombre?.toUpperCase().includes(q) ||
      h.marca?.toUpperCase().includes(q)          ||
      h.modelo?.toUpperCase().includes(q)         ||
      h.numero_orden?.toUpperCase().includes(q)   ||
      h.tipo_servicio?.toUpperCase().includes(q)
    ));
  };

  const buscarPorPlaca = async () => {
    const placa = busqueda.trim();
    if (!placa) return cargar();
    setLoading(true);
    try {
      const res  = await fetch(`${API}/vehiculo-historial/placa/${encodeURIComponent(placa)}`);
      const data = await res.json();
      setFiltrado(data.found ? data.historial : []);
    } catch { } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: "24px 28px", background: "#f5f7fb", minHeight: "100vh" }}>

      {/* Encabezado */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>📚 Historial de Vehículos</h1>
          <p style={{ color: "#888", margin: "4px 0 0", fontSize: 14 }}>
            Registro permanente de todos los servicios realizados en el taller
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#111" }}>{historial.length}</div>
          <div style={{ fontSize: 12, color: "#888" }}>registros totales</div>
        </div>
      </div>

      {/* Buscador */}
      <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={busqueda}
            onChange={e => buscar(e.target.value)}
            onKeyDown={e => e.key === "Enter" && buscarPorPlaca()}
            placeholder="🔍 Buscar por placa, orden, cliente, marca, tipo de servicio..."
            style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 15, outline: "none" }}
          />
          <button onClick={buscarPorPlaca}
            style={{ padding: "12px 24px", background: "#111827", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Buscar
          </button>
          {busqueda && (
            <button onClick={() => { setBusqueda(""); setFiltrado(historial); setDetalle(null); }}
              style={{ padding: "12px 16px", background: "#f1f5f9", border: "1px solid #e5e7eb", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13, color: "#555" }}>
              ✕ Limpiar
            </button>
          )}
        </div>
        {busqueda && <div style={{ marginTop: 8, fontSize: 13, color: "#888" }}>{filtrado.length} resultado{filtrado.length !== 1 ? "s" : ""}</div>}
      </div>

      {/* Detalle o Lista */}
      {detalle ? (
        <Expediente h={detalle} onVolver={() => setDetalle(null)} />
      ) : (
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Cargando historial...</div>
          ) : filtrado.length === 0 ? (
            <div style={{ padding: 50, textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#555" }}>
                {busqueda ? `Sin resultados para "${busqueda}"` : "No hay registros de historial aún"}
              </div>
              <div style={{ fontSize: 13, color: "#aaa", marginTop: 8 }}>
                El historial se genera automáticamente al entregar una orden
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Orden", "Placa", "Vehículo", "Cliente", "Servicio", "Técnico", "Total", "Fecha", ""].map(h => (
                      <th key={h} style={{ padding: "13px 14px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrado.map((h: any) => (
                    <tr key={h.id} style={{ borderTop: "1px solid #f0f0f0", cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#fafbff")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}>
                      <td style={{ padding: "12px 14px", fontWeight: 700, fontSize: 13, color: "#6366f1" }}>{h.numero_orden || "—"}</td>
                      <td style={{ padding: "12px 14px", fontWeight: 800, fontSize: 14, color: "#3b82f6", fontFamily: "monospace" }}>{h.placa}</td>
                      <td style={{ padding: "12px 14px", fontSize: 13 }}>{h.marca} {h.modelo} {h.ano && `(${h.ano})`}</td>
                      <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600 }}>{h.cliente_nombre || "—"}</td>
                      <td style={{ padding: "12px 14px", fontSize: 13 }}>{h.tipo_servicio || "—"}</td>
                      <td style={{ padding: "12px 14px", fontSize: 13 }}>{h.tecnico_nombre || "—"}</td>
                      <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "#166534" }}>
                        {h.costo_total > 0 ? moneda(h.costo_total) : <span style={{ color: "#aaa" }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>{fmtFecha(h.fecha_servicio)}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <button onClick={() => setDetalle(h)}
                          style={{ padding: "6px 16px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
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

// ── Expediente completo ────────────────────────────────
const QC_CHECKLIST_LABELS: Record<string, string> = {
  motor:       "Motor funcionando correctamente",
  frenos:      "Sistema de frenos operativo",
  fluidos:     "Sin fugas de fluidos",
  luces:       "Sistema de luces completo",
  electrico:   "Sistema eléctrico sin fallas",
  transmision: "Transmisión / caja de cambios",
  suspension:  "Suspensión y dirección",
  ac:          "A/C y climatización",
  limpieza:    "Limpieza y presentación",
  prueba_ruta: "Prueba de ruta realizada",
  trabajo_ok:  "Trabajo solicitado completado al 100%",
};

function Expediente({ h, onVolver }: { h: any; onVolver: () => void }) {
  const [detalleCompleto, setDetalleCompleto] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/vehiculo-historial/${h.id}/detalle`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDetalleCompleto(d); })
      .catch(() => {});
  }, [h.id]);

  // Snapshot JSONB
  const avancesSnap: any[] = Array.isArray(h.avances_data)   ? h.avances_data   : [];
  const timeline:    any[] = Array.isArray(h.timeline_data)  ? h.timeline_data  : [];
  const cot:         any   = h.cotizacion_data && typeof h.cotizacion_data === "object" && !Array.isArray(h.cotizacion_data) ? h.cotizacion_data : null;
  const fac:         any   = h.factura_data    && typeof h.factura_data    === "object" && !Array.isArray(h.factura_data)    ? h.factura_data    : null;
  const fechas:      any   = h.fechas_proceso  && typeof h.fechas_proceso  === "object" ? h.fechas_proceso : {};
  const checklist:   any   = h.checklist_qc    && typeof h.checklist_qc    === "object" ? h.checklist_qc   : {};
  const inspecSnap:  any   = h.inspeccion_data && typeof h.inspeccion_data === "object" ? h.inspeccion_data : null;
  const cotItems:    any[] = Array.isArray(cot?.items) ? cot.items : Array.isArray(cot?.items_detalle) ? cot.items_detalle : [];
  const facItems:    any[] = Array.isArray(fac?.items) ? fac.items : [];

  // ── Helper: parsear campo que puede venir como JSON string ──
  const parseJsonField = (v: any): any[] => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v.trim().startsWith("[")) {
      try { return JSON.parse(v); } catch { return []; }
    }
    return [];
  };

  // Live data: prefer detalle endpoint, fallback to snapshot
  const inspec:       any   = detalleCompleto?.inspeccion || inspecSnap;
  const avancesLive:  any[] = Array.isArray(detalleCompleto?.avances) && detalleCompleto.avances.length > 0
    ? detalleCompleto.avances : avancesSnap;

  // trabajos_realizados_items: viene en diagnostico.trabajos_realizados_items (puede ser string JSON)
  const rawTrabajosItems = detalleCompleto?.diagnostico?.trabajos_realizados_items
    || cot?.trabajos_realizados_items   // snapshot
    || h.trabajos_realizados_items;     // campo directo si lo hay
  const trabajosItems: any[] = parseJsonField(rawTrabajosItems);

  // mano_de_obra_detalle: del diagnóstico en vivo, luego del snapshot en cotizacion_data, luego campo directo
  const manoDeObraDetalle: string =
    detalleCompleto?.diagnostico?.mano_de_obra_detalle
    || detalleCompleto?.cotizacion?.mano_de_obra_detalle
    || cot?.mano_de_obra_detalle
    || (h as any).mano_de_obra_detalle
    || "";

  // descripcion (trabajo solicitado): de la orden en vivo o del snapshot
  const descripcionTrabajo: string =
    detalleCompleto?.orden?.descripcion
    || (h as any).descripcion
    || h.motivo_entrada
    || "";

  const hayFallas = h.codigos_falla || h.fallas_identificadas;
  const hayQC     = h.resultado_qc || h.observaciones_qc || Object.keys(checklist).length > 0;

  return (
    <div style={{ background: "#fff", borderRadius: 18, padding: 32, boxShadow: "0 4px 32px rgba(0,0,0,0.10)", marginBottom: 24 }}>

      {/* ── Cabecera ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#6366f1", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Expediente de Servicio {h.numero_orden && `· Orden #${h.numero_orden}`}
          </div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>
            🚗 {h.marca} {h.modelo}
            <span style={{ color: "#3b82f6", marginLeft: 10, fontFamily: "monospace", fontSize: 22 }}>{h.placa}</span>
          </h2>
          <div style={{ fontSize: 13, color: "#666", marginTop: 5 }}>
            {h.ano && `${h.ano} · `}{h.color && `${h.color} · `}
            Cliente: <b style={{ color: "#111" }}>{h.cliente_nombre}</b>
            {h.cliente_telefono && <> · 📞 {h.cliente_telefono}</>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Badge texto={h.estado || "ENTREGADO"} />
          <button onClick={onVolver}
            style={{ padding: "9px 20px", background: "#f1f5f9", border: "1px solid #e5e7eb", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            ← Volver
          </button>
        </div>
      </div>

      {/* ── Fila superior: Vehículo · Servicio · Costos ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>🚗 Vehículo</div>
          <Fila label="Placa"         valor={h.placa} destaca />
          <Fila label="Marca / Modelo" valor={`${h.marca || ""} ${h.modelo || ""}`.trim() || null} />
          <Fila label="Año"           valor={h.ano} />
          <Fila label="Color"         valor={h.color} />
          <Fila label="Motivo de entrada" valor={h.motivo_entrada} />
        </Card>
        <Card>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>📋 Servicio</div>
          <Fila label="Tipo de servicio" valor={h.tipo_servicio} destaca />
          <Fila label="Técnico"       valor={h.tecnico_nombre} />
          <Fila label="Fecha entrega" valor={fmtFecha(h.fecha_servicio)} />
          <Fila label="NCF"           valor={h.ncf || fac?.ncf} />
          <Fila label="Notas entrega" valor={h.notas_entrega} />
        </Card>
        <Card bg="#f0fdf4" border="#bbf7d0">
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10, color: "#166534" }}>💰 Costos</div>
          <Fila label="Mano de obra"  valor={moneda(h.costo_mano_obra)} />
          <Fila label="Repuestos"     valor={moneda(h.costo_repuestos)} />
          {fac?.itbis > 0 && <Fila label="ITBIS" valor={moneda(fac.itbis)} />}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #bbf7d0", fontWeight: 900, fontSize: 18, color: "#166534" }}>
            Total: {moneda(h.costo_total)}
          </div>
          {fac?.metodo_pago && <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>Pago: {fac.metodo_pago}</div>}
        </Card>
      </div>

      <Divider />

      {/* ── Trabajo Solicitado ── */}
      {descripcionTrabajo && (
        <>
          <Seccion icono="📝" titulo="Trabajo Solicitado">
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "12px 16px", fontSize: 14, color: "#1e3a5f", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {descripcionTrabajo}
            </div>
          </Seccion>
          <Divider />
        </>
      )}

      {/* ── Inspección de Recepción ── */}
      {inspec && (
        <>
          <Seccion icono="📋" titulo="Inspección de Recepción">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
              <Card>
                <Fila label="KM entrada"  valor={inspec.km_entrada != null ? Number(inspec.km_entrada).toLocaleString() : null} />
                <Fila label="Combustible" valor={inspec.nivel_combustible != null ? `${inspec.nivel_combustible}%` : null} />
                <Fila label="Condición"   valor={inspec.condicion_general} />
              </Card>
              {inspec.observaciones && (
                <div style={{ gridColumn: "span 2" }}>
                  <Card>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 6 }}>📝 Observaciones</div>
                    <p style={{ margin: 0, fontSize: 13, color: "#333", whiteSpace: "pre-wrap" }}>{inspec.observaciones}</p>
                  </Card>
                </div>
              )}
            </div>

            {Array.isArray(inspec.zonas_danio) && inspec.zonas_danio.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>⚠️ Daños al Ingreso</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {inspec.zonas_danio.map((z: any, i: number) => (
                    <span key={i} style={{ background: "#fef9c3", border: "1px solid #fde68a", color: "#92400e", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>
                      {(z.zona || "").replace(/_/g, " ")}: {(z.tipo || "").replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(() => {
              const items: [string, string][] = [
                ["luces_ok","💡 Luces"],["espejos_ok","🔍 Espejos"],["radio_pantalla","📻 Radio"],
                ["tapiceria_ok","🪑 Tapicería"],["alfombras_ok","🧺 Alfombras"],["bocina_ok","📣 Bocina"],
                ["gato_ok","🔩 Gato"],["llanta_repuesto_ok","🛞 Llanta rep."],
                ["documentos_ok","📄 Documentos"],["herramientas_ok","🔧 Herramientas"],
              ];
              const defined = items.filter(([k]) => inspec[k] !== undefined && inspec[k] !== null);
              if (defined.length === 0) return null;
              return (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 8 }}>Artículos verificados</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                    {defined.map(([k, l]) => {
                      const ok = inspec[k] === true || inspec[k] === 1;
                      return (
                        <div key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "5px 8px", borderRadius: 8, background: ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${ok ? "#6ee7b7" : "#fca5a5"}` }}>
                          <span style={{ color: ok ? "#16a34a" : "#dc2626" }}>{ok ? "✓" : "✗"}</span>
                          <span>{l}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {inspec.fotos_slots && Object.values(inspec.fotos_slots as Record<string,any>).some(Boolean) && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 8 }}>📸 Fotos de Recepción</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {(["frente","trasero","lateral_izq","lateral_der"] as const).map(k => {
                    const img = (inspec.fotos_slots as any)?.[k];
                    const lbl: Record<string,string> = { frente:"Frente", trasero:"Trasero", lateral_izq:"Lat. Izq.", lateral_der:"Lat. Der." };
                    return img ? (
                      <div key={k} style={{ textAlign: "center" }}>
                        <img src={img} alt={lbl[k]} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb" }} />
                        <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{lbl[k]}</div>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </Seccion>
          <Divider />
        </>
      )}

      {/* ── Diagnóstico ── */}
      <Seccion icono="🔬" titulo="Diagnóstico Técnico">
        {/* Hallazgos generales */}
        {(h.diagnostico_general || h.fallas_identificadas || detalleCompleto?.diagnostico?.fallas_identificadas) && (
          <div style={{ background: "#eff6ff", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#1e40af", fontWeight: 600, whiteSpace: "pre-wrap" }}>
            {h.diagnostico_general || h.fallas_identificadas || detalleCompleto?.diagnostico?.fallas_identificadas}
          </div>
        )}

        {/* Mano de obra / trabajos solicitados en el diagnóstico */}
        {manoDeObraDetalle && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#065f46", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🔧 Trabajos del Diagnóstico (Mano de Obra)</div>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px" }}>
              {manoDeObraDetalle.split("\n").filter((l: string) => l.trim()).map((l: string, i: number) => (
                <div key={i} style={{ fontSize: 13, marginBottom: 4, display: "flex", gap: 6 }}>
                  <span style={{ color: "#16a34a" }}>✓</span>
                  <span style={{ color: "#374151" }}>{l.trim()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 8 }}>🔧 Inspección Mecánica</div>
            {h.inspeccion_mecanica
              ? <p style={{ margin: 0, fontSize: 12, color: "#333", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{h.inspeccion_mecanica}</p>
              : <SinDatos />}
          </Card>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 8 }}>⚡ Inspección Eléctrica</div>
            {h.inspeccion_electrica
              ? <p style={{ margin: 0, fontSize: 12, color: "#333", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{h.inspeccion_electrica}</p>
              : <SinDatos />}
          </Card>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 8 }}>💻 Escáner / Electrónica</div>
            {h.inspeccion_electronica
              ? <p style={{ margin: 0, fontSize: 12, color: "#333", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{h.inspeccion_electronica}</p>
              : <SinDatos />}
          </Card>
        </div>

        {h.codigos_falla && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "14px 18px", marginTop: 14 }}>
            <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 8, fontSize: 13 }}>⚠️ Códigos de Falla</div>
            <div style={{ fontSize: 13 }}>{h.codigos_falla}</div>
          </div>
        )}

        {h.observaciones && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#888", marginBottom: 6 }}>OBSERVACIONES DEL TÉCNICO</div>
            <p style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 16px", margin: 0, fontSize: 13, color: "#555", whiteSpace: "pre-wrap" }}>
              {h.observaciones}
            </p>
          </div>
        )}
      </Seccion>

      <Divider />

      {/* ── Cotización ── */}
      <Seccion icono="📄" titulo="Cotización">
        {cot ? (
          <div style={{ display: "grid", gridTemplateColumns: cotItems.length > 0 ? "1fr 1fr" : "1fr", gap: 16 }}>
            <Card>
              <Fila label="Número"          valor={cot.numero} />
              <Fila label="Tiempo estimado" valor={cot.tiempo_estimado} />
              <Fila label="Mano de obra"    valor={moneda(cot.mano_obra)} />
              <Fila label="Repuestos"       valor={moneda(cot.repuestos)} />
              {cot.itbis > 0 && <Fila label="ITBIS" valor={moneda(cot.itbis)} />}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e7eb", fontWeight: 800, fontSize: 16, color: "#111" }}>
                Total: {moneda(cot.total)}
              </div>
              {cot.aprobado_at && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#10b981", fontWeight: 700 }}>
                  ✅ Aprobado el {fmtFechaHora(cot.aprobado_at)}
                </div>
              )}
              {cot.notas && <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>{cot.notas}</div>}
            </Card>
            {cotItems.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#888", marginBottom: 8 }}>REPUESTOS / SERVICIOS COTIZADOS</div>
                {cotItems.map((item: any, i: number) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
                    <span>{item.descripcion || item.nombre || item.concepto} {Number(item.cantidad) > 1 && `× ${item.cantidad}`}</span>
                    <span style={{ fontWeight: 700 }}>{moneda(item.precio_unitario || item.precio || item.subtotal)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : <SinDatos texto="Sin cotización registrada para esta orden" />}
      </Seccion>

      <Divider />

      {/* ── Trabajos realizados / Avances ── */}
      <Seccion icono="🛠️" titulo="Trabajos Realizados">
        {trabajosItems.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {trabajosItems.map((t: any, i: number) => {
              const estadoColor = t.estado === "REALIZADO" ? "#065f46" : t.estado === "PENDIENTE" ? "#92400e" : "#6b7280";
              const estadoBg    = t.estado === "REALIZADO" ? "#f0fdf4" : t.estado === "PENDIENTE" ? "#fffbeb" : "#f9fafb";
              return (
                <div key={i} style={{ background: estadoBg, border: `1px solid ${estadoColor}33`, borderLeft: `3px solid ${estadoColor}`, borderRadius: 10, padding: "10px 14px", display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#888", minWidth: 130 }}>{t.tipo || "—"}</div>
                  <div style={{ flex: 1, fontSize: 13, color: "#333" }}>{t.descripcion || "—"}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: estadoColor, whiteSpace: "nowrap" }}>{(t.estado || "").replace("_", " ")}</div>
                </div>
              );
            })}
          </div>
        ) : avancesLive.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {avancesLive.map((a: any, i: number) => (
              <div key={i} style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ minWidth: 90, fontSize: 11, color: "#888", paddingTop: 1 }}>{fmtFecha(a.created_at)}</div>
                <div style={{ flex: 1, fontSize: 13, color: "#333" }}>{a.descripcion}</div>
                {a.tecnico_nombre && (
                  <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 700, whiteSpace: "nowrap" }}>👨‍🔧 {a.tecnico_nombre}</div>
                )}
              </div>
            ))}
          </div>
        ) : h.trabajos_realizados ? (
          <pre style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px", fontSize: 13, whiteSpace: "pre-wrap", fontFamily: "inherit", color: "#333", margin: 0 }}>
            {h.trabajos_realizados}
          </pre>
        ) : (
          <SinDatos texto="Sin avances de reparación registrados" />
        )}
      </Seccion>

      <Divider />

      {/* ── Control de Calidad ── */}
      {hayQC && (
        <>
          <Seccion icono="✅" titulo="Control de Calidad">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Card bg={h.resultado_qc === "APROBADO" ? "#f0fdf4" : h.resultado_qc === "RECHAZADO" ? "#fef2f2" : "#f8fafc"}
                    border={h.resultado_qc === "APROBADO" ? "#bbf7d0" : h.resultado_qc === "RECHAZADO" ? "#fecaca" : "#e5e7eb"}>
                {h.resultado_qc && (
                  <div style={{ marginBottom: 10 }}>
                    <Badge texto={h.resultado_qc} color={h.resultado_qc === "APROBADO" ? "#10b981" : "#ef4444"} />
                  </div>
                )}
                {h.observaciones_qc && <Fila label="Observaciones" valor={h.observaciones_qc} />}
              </Card>
              {Object.keys(checklist).length > 0 && (
                <Card>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 10 }}>CHECKLIST DE CALIDAD</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                    {Object.entries(checklist).map(([k, v]) => (
                      <div key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, background: v ? "#f0fdf4" : "#fef2f2", padding: "5px 10px", borderRadius: 8, border: `1px solid ${v ? "#6ee7b7" : "#fca5a5"}` }}>
                        <span style={{ color: v ? "#16a34a" : "#dc2626" }}>{v ? "✓" : "✗"}</span>
                        <span>{QC_CHECKLIST_LABELS[k] || k.replace(/_/g, " ")}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </Seccion>
          <Divider />
        </>
      )}

      {/* ── Factura ── */}
      <Seccion icono="🧾" titulo="Factura">
        {fac ? (
          <div style={{ display: "grid", gridTemplateColumns: facItems.length > 0 ? "auto 1fr" : "1fr", gap: 16, alignItems: "start" }}>
            <Card>
              <Fila label="NCF"          valor={fac.ncf} destaca />
              <Fila label="Tipo NCF"     valor={fac.ncf_tipo} />
              <Fila label="Estado"       valor={fac.estado} />
              <Fila label="Método pago"  valor={fac.metodo_pago} />
              <Fila label="Subtotal"     valor={moneda(fac.subtotal)} />
              {fac.itbis > 0 && <Fila label="ITBIS" valor={moneda(fac.itbis)} />}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e7eb", fontWeight: 900, fontSize: 17, color: "#166534" }}>
                Total: {moneda(fac.total)}
              </div>
              {fac.created_at && <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>Emitida: {fmtFechaHora(fac.created_at)}</div>}
            </Card>
            {facItems.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#888", marginBottom: 8 }}>DETALLE DE FACTURA</div>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Descripción", "Tipo", "Cant.", "Precio", "Subtotal"].map(h => (
                        <th key={h} style={{ padding: "7px 10px", textAlign: "left", color: "#888", fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {facItems.map((fi: any, i: number) => (
                      <tr key={i} style={{ borderTop: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "7px 10px" }}>{fi.descripcion}</td>
                        <td style={{ padding: "7px 10px", color: "#888" }}>{fi.tipo || "—"}</td>
                        <td style={{ padding: "7px 10px", textAlign: "center" }}>{fi.cantidad}</td>
                        <td style={{ padding: "7px 10px", textAlign: "right" }}>{moneda(fi.precio_unitario)}</td>
                        <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700 }}>{moneda(fi.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : <SinDatos texto="Sin factura registrada para esta orden" />}
      </Seccion>

      <Divider />

      {/* ── Entrega al Cliente ── */}
      {(h.fecha_entrega || h.notas_entrega || h.usuario_entrego || h.firma_entrega) && (
        <>
          <Divider />
          <Seccion icono="🏁" titulo="Entrega al Cliente">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <Card bg="#eff6ff" border="#bfdbfe">
                <Fila label="Fecha de entrega" valor={fmtFechaHora(h.fecha_entrega)} destaca />
                <Fila label="Entregado por"    valor={h.usuario_entrego} />
              </Card>
              {h.notas_entrega && (
                <Card>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 6 }}>📝 Notas</div>
                  <p style={{ margin: 0, fontSize: 13, color: "#333", whiteSpace: "pre-wrap" }}>{h.notas_entrega}</p>
                </Card>
              )}
            </div>
            {h.firma_entrega && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 8 }}>Firma del Cliente</div>
                <img src={h.firma_entrega} alt="Firma del cliente" style={{ maxHeight: 90, border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", padding: 6 }} />
              </div>
            )}
          </Seccion>
        </>
      )}

      <Divider />

      {/* ── Línea de tiempo ── */}
      <Seccion icono="📅" titulo="Línea de Tiempo">
        {timeline.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {timeline.map((t: any, i: number) => (
              <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ minWidth: 155, fontSize: 11, color: "#888", paddingTop: 4 }}>{fmtFechaHora(t.created_at)}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {t.estado_anterior && <Badge texto={t.estado_anterior} />}
                  {t.estado_anterior && <span style={{ color: "#ccc" }}>→</span>}
                  <Badge texto={t.estado_nuevo || t.estado} />
                  {t.usuario_nombre && <span style={{ fontSize: 12, color: "#888" }}>· {t.usuario_nombre}</span>}
                  {t.motivo && <span style={{ fontSize: 12, color: "#555", fontStyle: "italic" }}>"{t.motivo}"</span>}
                </div>
              </div>
            ))}
          </div>
        ) : <SinDatos texto="Sin historial de estados registrado" />}
      </Seccion>

      {/* ── Fechas del proceso ── */}
      {Object.values(fechas).some(Boolean) && (
        <>
          <Divider />
          <Seccion icono="🕐" titulo="Fechas del Proceso">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {[
                { label: "Recibido",             valor: fechas.recibido },
                { label: "Diagnóstico",          valor: fechas.diagnostico },
                { label: "Esp. Aprobación",      valor: fechas.esperando_aprobacion },
                { label: "Aprobado",             valor: fechas.aprobacion },
                { label: "Inicio Reparación",    valor: fechas.inicio_reparacion },
                { label: "Control de Calidad",   valor: fechas.control_calidad },
                { label: "Listo",                valor: fechas.listo },
                { label: "Entregado",            valor: fechas.entrega },
              ].filter(f => f.valor).map(f => (
                <div key={f.label} style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 14px", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{f.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#333" }}>{fmtFechaHora(f.valor)}</div>
                </div>
              ))}
            </div>
          </Seccion>
        </>
      )}

    </div>
  );
}
