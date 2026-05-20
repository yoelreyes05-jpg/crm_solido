"use client";
import { useEffect, useState } from "react";
import { API_URL as API } from "@/config";

// ── Tipos ──────────────────────────────────────────────
interface DetalleCompleto {
  historial: any;
  diagnostico: any;
  orden: any;
  avances: any[];
  cotizacion: any;
  cotizacion_items: any[];
  factura: any;
  factura_items: any[];
  estado_historial: any[];
}

// ── Helpers visuales ───────────────────────────────────
const moneda = (v: any) =>
  `RD$ ${Number(v || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`;

const fecha = (v: any, opts?: Intl.DateTimeFormatOptions) =>
  v ? new Date(v).toLocaleDateString("es-DO", opts || { year: "numeric", month: "short", day: "numeric" }) : "—";

const fechaHora = (v: any) =>
  v ? new Date(v).toLocaleString("es-DO", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const ESTADO_COLOR: Record<string, string> = {
  ENTREGADO:              "#10b981",
  LISTO:                  "#3b82f6",
  REPARACION:             "#f59e0b",
  CONTROL_CALIDAD:        "#8b5cf6",
  ESPERANDO_APROBACION:   "#f97316",
  DIAGNOSTICO:            "#6366f1",
  RECIBIDO:               "#64748b",
  CANCELADO:              "#ef4444",
};

// ── Componentes de UI ──────────────────────────────────
function Seccion({ icono, titulo, children }: { icono: string; titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 12, fontWeight: 800, color: "#6366f1", textTransform: "uppercase",
        letterSpacing: 1, marginBottom: 10, display: "flex", alignItems: "center", gap: 6
      }}>
        <span>{icono}</span> {titulo}
      </div>
      {children}
    </div>
  );
}

function Card({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      background: color || "#f8fafc", borderRadius: 12, padding: "14px 18px",
      border: "1px solid #e5e7eb"
    }}>
      {children}
    </div>
  );
}

function Fila({ label, valor, destaca }: { label: string; valor: any; destaca?: boolean }) {
  if (!valor && valor !== 0) return null;
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 6, fontSize: 13 }}>
      <span style={{ color: "#888", minWidth: 130, flexShrink: 0 }}>{label}:</span>
      <span style={{ fontWeight: destaca ? 700 : 600, color: destaca ? "#111" : "#333" }}>{valor}</span>
    </div>
  );
}

function Badge({ texto, color }: { texto: string; color: string }) {
  return (
    <span style={{
      background: color, color: "#fff", padding: "3px 12px",
      borderRadius: 20, fontSize: 11, fontWeight: 800
    }}>
      {texto}
    </span>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid #e5e7eb", margin: "20px 0" }} />;
}

// ── Página principal ───────────────────────────────────
export default function HistorialVehiculoPage() {
  const [historial, setHistorial]   = useState<any[]>([]);
  const [filtrado, setFiltrado]     = useState<any[]>([]);
  const [busqueda, setBusqueda]     = useState("");
  const [detalle, setDetalle]       = useState<DetalleCompleto | null>(null);
  const [loading, setLoading]       = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  useEffect(() => { fetchHistorial(); }, []);

  const fetchHistorial = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/vehiculo-historial`);
      const data = await res.json();
      const lista = Array.isArray(data) ? data : [];
      setHistorial(lista);
      setFiltrado(lista);
    } catch { } finally { setLoading(false); }
  };

  const verDetalle = async (id: number) => {
    setLoadingDetalle(true);
    try {
      const res = await fetch(`${API}/vehiculo-historial/${id}/detalle`);
      const data = await res.json();
      setDetalle(data);
    } catch { } finally { setLoadingDetalle(false); }
  };

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
      setFiltrado(data.found ? data.historial : []);
    } catch { } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: "24px 28px", background: "#f5f7fb", minHeight: "100vh" }}>

      {/* ENCABEZADO */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>📚 Historial de Vehículos</h1>
          <p style={{ color: "#888", margin: 0, fontSize: 14, marginTop: 4 }}>
            Registro permanente de todos los servicios realizados
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
            style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 15, outline: "none" }}
          />
          <button onClick={buscarPorPlaca} style={{ padding: "12px 24px", background: "#111827", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
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

      {/* VISTA DETALLE */}
      {loadingDetalle && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 40, textAlign: "center", color: "#888", marginBottom: 20 }}>
          Cargando expediente completo...
        </div>
      )}

      {detalle && !loadingDetalle && (
        <DetalleExpediente detalle={detalle} onVolver={() => setDetalle(null)} />
      )}

      {/* TABLA LISTA */}
      {!detalle && !loadingDetalle && (
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
                    {["Placa", "Vehículo", "Cliente", "Tipo de Servicio", "Técnico", "Costo Total", "Estado", "Fecha", ""].map(h => (
                      <th key={h} style={{ padding: "13px 16px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrado.map((h: any) => (
                    <tr key={h.id} style={{ borderTop: "1px solid #f0f0f0" }} onMouseEnter={e => (e.currentTarget.style.background = "#fafbff")} onMouseLeave={e => (e.currentTarget.style.background = "")}>
                      <td style={{ padding: "12px 16px", fontWeight: 800, fontSize: 14, color: "#3b82f6", fontFamily: "monospace" }}>{h.placa}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13 }}>{h.marca} {h.modelo} {h.ano && `(${h.ano})`}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>{h.cliente_nombre || "—"}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13 }}>{h.tipo_servicio || "—"}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13 }}>{h.tecnico_nombre || "—"}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#166534" }}>
                        {h.costo_total > 0 ? moneda(h.costo_total) : <span style={{ color: "#aaa" }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <Badge texto={h.estado || "ENTREGADO"} color={ESTADO_COLOR[h.estado] || "#888"} />
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>{fecha(h.fecha_servicio)}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <button onClick={() => verDetalle(h.id)}
                          style={{ padding: "6px 16px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                          Ver expediente →
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

// ── Vista de expediente completo ────────────────────────
function DetalleExpediente({ detalle, onVolver }: { detalle: DetalleCompleto; onVolver: () => void }) {
  const { historial: h, diagnostico: d, orden: o, avances, cotizacion, cotizacion_items, factura, factura_items, estado_historial } = detalle;

  return (
    <div style={{ background: "#fff", borderRadius: 18, padding: 32, boxShadow: "0 4px 32px rgba(0,0,0,0.10)", marginBottom: 24 }}>

      {/* Cabecera del expediente */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#6366f1", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Expediente de Servicio
          </div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>
            🚗 {h.marca} {h.modelo}
            <span style={{ color: "#3b82f6", marginLeft: 10, fontFamily: "monospace" }}>{h.placa}</span>
          </h2>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
            {h.ano && `${h.ano} · `}{h.color && `${h.color} · `}
            Cliente: <b style={{ color: "#333" }}>{h.cliente_nombre}</b>
            {h.cliente_telefono && <> · 📞 {h.cliente_telefono}</>}
          </div>
          {o?.numero_orden && (
            <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: "#6366f1" }}>
              Orden #{o.numero_orden}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Badge texto={h.estado || "ENTREGADO"} color={ESTADO_COLOR[h.estado] || "#10b981"} />
          <button onClick={onVolver}
            style={{ padding: "8px 18px", background: "#f1f5f9", border: "1px solid #e5e7eb", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            ← Volver
          </button>
        </div>
      </div>

      {/* Grid principal: 3 columnas en la parte superior */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>

        {/* Datos del vehículo */}
        <Card>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10, color: "#333" }}>🚗 Vehículo</div>
          <Fila label="Placa" valor={h.placa} destaca />
          <Fila label="Marca / Modelo" valor={`${h.marca || ""} ${h.modelo || ""}`.trim() || null} />
          <Fila label="Año" valor={h.ano} />
          <Fila label="Color" valor={h.color} />
          {o?.motivo_entrada && <Fila label="Motivo entrada" valor={o.motivo_entrada} />}
        </Card>

        {/* Datos del servicio */}
        <Card>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10, color: "#333" }}>📋 Servicio</div>
          <Fila label="Tipo de servicio" valor={h.tipo_servicio} destaca />
          <Fila label="Técnico" valor={h.tecnico_nombre} />
          <Fila label="Prioridad" valor={o?.prioridad} />
          <Fila label="Fecha de entrega" valor={fecha(h.fecha_servicio, { year: "numeric", month: "long", day: "numeric" })} />
          <Fila label="NCF" valor={h.ncf || factura?.ncf} />
        </Card>

        {/* Costos */}
        <Card color="#f0fdf4">
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10, color: "#166534" }}>💰 Resumen de Costos</div>
          <Fila label="Mano de obra" valor={moneda(h.costo_mano_obra)} />
          <Fila label="Repuestos" valor={moneda(h.costo_repuestos)} />
          {factura?.itbis > 0 && <Fila label="ITBIS" valor={moneda(factura.itbis)} />}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #bbf7d0", fontWeight: 900, fontSize: 18, color: "#166534" }}>
            Total: {moneda(h.costo_total)}
          </div>
          {factura?.metodo_pago && (
            <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
              Pago: {factura.metodo_pago}
            </div>
          )}
        </Card>
      </div>

      <Divider />

      {/* ── DIAGNÓSTICO ── */}
      <Seccion icono="🔬" titulo="Diagnóstico Técnico">
        {d ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Card>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 8 }}>🔧 Inspección Mecánica</div>
              <p style={{ margin: 0, fontSize: 12, color: "#444", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {d.inspeccion_mecanica || h.inspeccion_mecanica || <span style={{ color: "#bbb" }}>Sin datos</span>}
              </p>
            </Card>
            <Card>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 8 }}>⚡ Inspección Eléctrica</div>
              <p style={{ margin: 0, fontSize: 12, color: "#444", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {d.inspeccion_electrica || h.inspeccion_electrica || <span style={{ color: "#bbb" }}>Sin datos</span>}
              </p>
            </Card>
            <Card>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 8 }}>💻 Escáner / Electrónica</div>
              <p style={{ margin: 0, fontSize: 12, color: "#444", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {d.inspeccion_electronica || h.inspeccion_electronica || <span style={{ color: "#bbb" }}>Sin datos</span>}
              </p>
            </Card>
          </div>
        ) : (
          <p style={{ color: "#bbb", fontSize: 13 }}>Diagnóstico no disponible</p>
        )}

        {/* Fallas y códigos */}
        {(d?.scanner_resultado || d?.fallas_identificadas || h.fallas_identificadas || h.codigos_falla) && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "14px 18px", marginTop: 14 }}>
            <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 8, fontSize: 13 }}>⚠️ Fallas y Códigos Identificados</div>
            {(d?.scanner_resultado || h.codigos_falla) && (
              <div style={{ fontSize: 13, marginBottom: 6 }}>
                <b>Códigos scanner:</b> {d?.scanner_resultado || h.codigos_falla}
              </div>
            )}
            {(d?.fallas_identificadas || h.fallas_identificadas) && (
              <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{d?.fallas_identificadas || h.fallas_identificadas}</div>
            )}
          </div>
        )}

        {/* Observaciones del diagnóstico */}
        {(d?.observaciones || h.observaciones) && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#888", marginBottom: 6 }}>OBSERVACIONES</div>
            <p style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 16px", margin: 0, fontSize: 13, color: "#555", whiteSpace: "pre-wrap" }}>
              {d?.observaciones || h.observaciones}
            </p>
          </div>
        )}
      </Seccion>

      <Divider />

      {/* ── COTIZACIÓN ── */}
      {cotizacion && (
        <>
          <Seccion icono="📄" titulo="Cotización Aprobada">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
              <Card>
                <Fila label="Mano de obra" valor={moneda(cotizacion.mano_obra)} />
                <Fila label="Repuestos" valor={moneda(cotizacion.repuestos)} />
                <Fila label="Total cotizado" valor={moneda(cotizacion.total)} destaca />
                {cotizacion.mano_de_obra_detalle && <Fila label="Detalle" valor={cotizacion.mano_de_obra_detalle} />}
              </Card>
              {cotizacion_items.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#888", marginBottom: 8 }}>REPUESTOS COTIZADOS</div>
                  {cotizacion_items.map((item: any) => (
                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderBottom: "1px solid #f0f0f0" }}>
                      <span>{item.descripcion} {item.cantidad > 1 && `x${item.cantidad}`}</span>
                      <span style={{ fontWeight: 700 }}>{moneda(item.precio_unitario)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Seccion>
          <Divider />
        </>
      )}

      {/* ── TRABAJOS REALIZADOS / AVANCES ── */}
      {(avances.length > 0 || h.trabajos_realizados) && (
        <>
          <Seccion icono="🛠️" titulo="Trabajos Realizados">
            {avances.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {avances.map((a: any, i: number) => (
                  <div key={a.id || i} style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ minWidth: 80, fontSize: 11, color: "#888", paddingTop: 1 }}>{fecha(a.created_at)}</div>
                    <div style={{ flex: 1, fontSize: 13, color: "#333" }}>{a.descripcion}</div>
                    {a.tecnico_nombre && (
                      <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 700, whiteSpace: "nowrap" }}>
                        👨‍🔧 {a.tecnico_nombre}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <pre style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px", fontSize: 13, whiteSpace: "pre-wrap", fontFamily: "inherit", color: "#333", margin: 0 }}>
                {h.trabajos_realizados}
              </pre>
            )}
          </Seccion>
          <Divider />
        </>
      )}

      {/* ── FACTURA ── */}
      {factura && (
        <>
          <Seccion icono="🧾" titulo="Factura">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Card>
                <Fila label="NCF" valor={factura.ncf} destaca />
                <Fila label="Estado" valor={factura.estado} />
                <Fila label="Método de pago" valor={factura.metodo_pago} />
                <Fila label="Subtotal" valor={moneda(factura.subtotal)} />
                {factura.itbis > 0 && <Fila label="ITBIS" valor={moneda(factura.itbis)} />}
                <div style={{ marginTop: 10, fontWeight: 900, fontSize: 16, color: "#166534" }}>
                  Total: {moneda(factura.total)}
                </div>
              </Card>
              {factura_items.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#888", marginBottom: 8 }}>DETALLE DE FACTURA</div>
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        <th style={{ padding: "6px 8px", textAlign: "left", color: "#888" }}>Descripción</th>
                        <th style={{ padding: "6px 8px", textAlign: "center", color: "#888" }}>Cant.</th>
                        <th style={{ padding: "6px 8px", textAlign: "right", color: "#888" }}>Precio</th>
                        <th style={{ padding: "6px 8px", textAlign: "right", color: "#888" }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {factura_items.map((fi: any) => (
                        <tr key={fi.id} style={{ borderTop: "1px solid #f0f0f0" }}>
                          <td style={{ padding: "6px 8px" }}>{fi.descripcion}</td>
                          <td style={{ padding: "6px 8px", textAlign: "center" }}>{fi.cantidad}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right" }}>{moneda(fi.precio_unitario)}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{moneda(fi.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Seccion>
          <Divider />
        </>
      )}

      {/* ── LÍNEA DE TIEMPO ── */}
      {estado_historial.length > 0 && (
        <Seccion icono="📅" titulo="Línea de Tiempo de la Orden">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {estado_historial.map((e: any, i: number) => (
              <div key={e.id || i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ minWidth: 150, fontSize: 11, color: "#888", paddingTop: 3 }}>{fechaHora(e.created_at)}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {e.estado_anterior && (
                    <Badge texto={e.estado_anterior} color={ESTADO_COLOR[e.estado_anterior] || "#888"} />
                  )}
                  {e.estado_anterior && <span style={{ color: "#aaa", fontSize: 12 }}>→</span>}
                  <Badge texto={e.estado_nuevo || e.estado} color={ESTADO_COLOR[e.estado_nuevo || e.estado] || "#333"} />
                  {e.usuario_nombre && <span style={{ fontSize: 12, color: "#888" }}>· {e.usuario_nombre}</span>}
                  {e.motivo && <span style={{ fontSize: 12, color: "#555", fontStyle: "italic" }}>"{e.motivo}"</span>}
                </div>
              </div>
            ))}
          </div>
        </Seccion>
      )}

      {/* Fechas del flujo desde la orden */}
      {o && (
        <>
          <Divider />
          <Seccion icono="🕐" titulo="Fechas del Proceso">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {[
                { label: "Recibido", valor: o.created_at },
                { label: "Diagnóstico", valor: o.fecha_diagnostico },
                { label: "Esperando aprobación", valor: o.fecha_esperando_aprobacion },
                { label: "Aprobado", valor: o.fecha_aprobacion },
                { label: "Inicio reparación", valor: o.fecha_inicio_reparacion },
                { label: "Control de calidad", valor: o.fecha_control_calidad },
                { label: "Listo", valor: o.fecha_listo },
                { label: "Entregado", valor: o.fecha_entrega },
              ].filter(f => f.valor).map(f => (
                <div key={f.label} style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 14px", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{f.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>{fechaHora(f.valor)}</div>
                </div>
              ))}
            </div>
          </Seccion>
        </>
      )}

    </div>
  );
}
