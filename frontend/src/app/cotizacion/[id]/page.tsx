"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { API_URL as API } from "@/config";

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface RepuestoItem {
  inventario_id: number;
  nombre: string;
  codigo?: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

interface Cotizacion {
  id: number;
  diagnostico_id: number;
  mano_obra: number;
  repuestos: number;
  total: number;
  tiempo_estimado?: string;
  notas?: string;
  aprobado?: boolean;
  aprobado_at?: string;
  items_detalle?: RepuestoItem[];
  created_at?: string;
}

interface Diagnostico {
  id: number;
  orden_id?: number;
  descripcion: string;
  mano_obra: number;
  repuestos: number;
  total: number;
  tiempo_estimado?: string;
  mano_de_obra_detalle?: string;
  notas?: string;
  terminado?: boolean;
  estado?: string;
  repuestos_items?: RepuestoItem[];
}

interface Cliente {
  id: number;
  nombre: string;
  telefono?: string;
  email?: string;
  rnc?: string;
  direccion?: string;
}

interface Vehiculo {
  id: number;
  marca: string;
  modelo: string;
  ano?: string;
  placa: string;
  color?: string;
  vin?: string;
}

interface Inspeccion {
  id?: number;
  km_entrada?: number;
  nivel_combustible?: number;
  condicion_general?: string;
  observaciones?: string;
  zonas_danio?: { zona: string; tipo: string }[];
  fotos_slots?: Record<string, string | null>;
  fotos?: { data: string; label: string }[];
  radio_pantalla?: boolean;
  tapiceria_ok?: boolean;
  alfombras_ok?: boolean;
  luces_ok?: boolean;
  bocina_ok?: boolean;
  espejos_ok?: boolean;
  gato_ok?: boolean;
  llanta_repuesto_ok?: boolean;
  documentos_ok?: boolean;
  herramientas_ok?: boolean;
  rayones?: string;
  golpes?: string;
  estado_vidrios?: string;
  estado_llantas?: string;
  estado_pintura?: string;
}

interface Orden {
  id: number;
  descripcion?: string;
  motivo_entrada?: string;
  numero_orden?: string;
  prioridad?: string;
  created_at?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDinero = (n: number | string | undefined) =>
  new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 2 }).format(Number(n) || 0);

const fmtFecha = (s?: string) =>
  s ? new Date(s).toLocaleDateString("es-DO", { day: "2-digit", month: "long", year: "numeric" }) : "—";

const TIPO_LABEL: Record<string, string> = {
  rayon_leve: "Rayón leve", rayon_profundo: "Rayón profundo",
  golpe: "Golpe / Abolladura", falta_pieza: "Falta pieza",
};

const CHECKLIST_LABELS: { key: keyof Inspeccion; label: string }[] = [
  { key: "luces_ok",           label: "💡 Luces" },
  { key: "espejos_ok",         label: "🔍 Espejos" },
  { key: "radio_pantalla",     label: "📻 Radio / Pantalla" },
  { key: "tapiceria_ok",       label: "🪑 Tapicería" },
  { key: "alfombras_ok",       label: "🧺 Alfombras" },
  { key: "bocina_ok",          label: "📣 Bocina" },
  { key: "gato_ok",            label: "🔩 Gato hidráulico" },
  { key: "llanta_repuesto_ok", label: "🛞 Llanta repuesto" },
  { key: "documentos_ok",      label: "📄 Documentos" },
  { key: "herramientas_ok",    label: "🔧 Herramientas" },
];

// Número de cotización formateado
const numCot = (id: number) => `COT-${String(id).padStart(5, "0")}`;

// ── Componente principal ──────────────────────────────────────────────────────
export default function CotizacionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [cotizacion,  setCotizacion]  = useState<Cotizacion | null>(null);
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);
  const [cliente,     setCliente]     = useState<Cliente | null>(null);
  const [vehiculo,    setVehiculo]    = useState<Vehiculo | null>(null);
  const [inspeccion,  setInspeccion]  = useState<Inspeccion | null>(null);
  const [orden,       setOrden]       = useState<Orden | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  // Firma del cliente
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing,   setDrawing]   = useState(false);
  const [lastPos,   setLastPos]   = useState({ x: 0, y: 0 });
  const [firmada,   setFirmada]   = useState(false);
  const [aprobando, setAprobando] = useState(false);
  const [aprobado,  setAprobado]  = useState(false);

  // ── Carga ─────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`${API}/cotizaciones/${id}`);
      if (!res.ok) { setError("Cotización no encontrada"); setLoading(false); return; }
      const data = await res.json();
      setCotizacion(data.cotizacion);
      setDiagnostico(data.diagnostico);
      setCliente(data.cliente);
      setVehiculo(data.vehiculo);
      setInspeccion(data.inspeccion);
      setOrden(data.orden || null);
      if (data.cotizacion?.aprobado) setAprobado(true);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Firma canvas ──────────────────────────────────────────────────────────
  const getPos = (e: any, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };
  const startDraw = (e: any) => { const c = canvasRef.current!; setDrawing(true); setLastPos(getPos(e, c)); };
  const stopDraw  = ()        => { setDrawing(false); setFirmada(true); };
  const draw      = (e: any) => {
    if (!drawing) return;
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const pos = getPos(e, c);
    ctx.beginPath(); ctx.strokeStyle = "#1d4ed8"; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.moveTo(lastPos.x, lastPos.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    setLastPos(pos);
    e.preventDefault();
  };
  const limpiarFirma = () => {
    canvasRef.current!.getContext("2d")!.clearRect(0, 0, 400, 120);
    setFirmada(false);
  };

  const aprobar = async () => {
    if (!firmada) { alert("Por favor, capture la firma del cliente antes de aprobar."); return; }
    setAprobando(true);
    try {
      const firma = canvasRef.current!.toDataURL();
      const res = await fetch(`${API}/cotizaciones/${id}/aprobar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firma_cliente: firma }),
      });
      const data = await res.json();
      if (data?.aprobado) {
        setAprobado(true);
        setCotizacion(prev => prev ? { ...prev, aprobado: true, aprobado_at: data.aprobado_at } : prev);
      }
    } catch (e: any) {
      alert("Error al aprobar: " + e.message);
    }
    setAprobando(false);
  };

  const imprimir = () => {
    const doc = document.getElementById("cotizacion-doc");
    if (!doc) { window.print(); return; }
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none;";
    document.body.appendChild(iframe);
    const iDoc = iframe.contentWindow?.document;
    if (!iDoc) { document.body.removeChild(iframe); window.print(); return; }
    iDoc.open();
    iDoc.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Cotización ${cotizacion ? numCot(cotizacion.id) : ""}</title>
<style>
  body{margin:16px;font-family:system-ui,-apple-system,sans-serif;color:#111827;background:#fff;}
  *{-webkit-print-color-adjust:exact!important;color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;}
  img{max-width:100%;}
  table{border-collapse:collapse;width:100%;}
  .no-print{display:none!important;}
  @media print{
    body{margin:0;}
    @page{margin:14mm 12mm;size:A4;}
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  }
</style></head><body>${doc.outerHTML}</body></html>`);
    iDoc.close();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 400);
  };

  // ── Render de carga / error ───────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>
      ⏳ Cargando cotización...
    </div>
  );
  if (error || !cotizacion) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#ef4444" }}>
      <span style={{ fontSize: 32 }}>⚠️</span>
      <p style={{ margin: 0, fontWeight: 700 }}>{error || "Cotización no encontrada"}</p>
      <button onClick={() => router.back()} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontWeight: 600 }}>← Volver</button>
    </div>
  );

  const items: RepuestoItem[] = cotizacion.items_detalle || diagnostico?.repuestos_items || [];
  const condicionColor: Record<string, string> = { Excelente: "#10b981", Buena: "#3b82f6", Regular: "#f59e0b", Mala: "#ef4444" };
  const condColor = condicionColor[inspeccion?.condicion_general || ""] || "#6b7280";

  return (
    <>
      {/* ── Barra de acciones (no imprime) ─────────────────────────────── */}
      <div className="no-print" style={{
        background: "#1e293b", color: "#e2e8f0",
        padding: "12px 24px", display: "flex", alignItems: "center", gap: 14,
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}>
        <button onClick={() => router.back()}
          style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18, padding: 0 }}>
          ←
        </button>
        <span style={{ fontWeight: 800, fontSize: 15 }}>
          📄 Cotización {numCot(cotizacion.id)}
        </span>
        {aprobado && (
          <span style={{ background: "#10b98122", color: "#10b981", border: "1px solid #10b98155",
            borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
            ✅ Aprobada por el cliente
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button onClick={imprimir}
            style={{ background: "#334155", color: "#e2e8f0", border: "none", borderRadius: 8,
              padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            🖨️ Imprimir
          </button>
        </div>
      </div>

      {/* ── Documento de cotización ─────────────────────────────────────── */}
      <div id="cotizacion-doc" style={{
        maxWidth: 860, margin: "24px auto 60px", background: "#fff",
        borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
        fontFamily: "system-ui, sans-serif", color: "#111827",
        overflow: "hidden",
      }}>

        {/* Encabezado del taller */}
        <div style={{
          background: "linear-gradient(135deg, #0f172a, #1e3a5f)",
          color: "#fff", padding: "20px 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Sólido Auto Servicio"
              style={{ height: 64, width: "auto", objectFit: "contain", borderRadius: 8, background: "#fff", padding: 4 }} />
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 0.5, color: "#fff" }}>SÓLIDO AUTO SERVICIO</div>
              <div style={{ fontSize: 12, color: "#93c5fd", marginTop: 3 }}>Taller Automotriz · Reparación &amp; Mantenimiento</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>RNC: 1-31-12345-6 · Tel: 849-569-2027</div>
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#60a5fa" }}>{numCot(cotizacion.id)}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
              Fecha: {fmtFecha(cotizacion.created_at || new Date().toISOString())}
            </div>
            {cotizacion.tiempo_estimado && (
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                Tiempo est.: <strong style={{ color: "#fbbf24" }}>{cotizacion.tiempo_estimado}</strong>
              </div>
            )}
            {aprobado && (
              <div style={{ marginTop: 6, fontSize: 11, background: "#10b98133", color: "#6ee7b7",
                borderRadius: 20, padding: "2px 10px", display: "inline-block", fontWeight: 700 }}>
                ✅ APROBADA {cotizacion.aprobado_at ? fmtFecha(cotizacion.aprobado_at) : ""}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Motivo de entrada — por qué trajo el vehículo */}
          {(orden?.motivo_entrada || orden?.descripcion) && (
            <div style={{
              background: "#eff6ff", border: "1px solid #bfdbfe",
              borderRadius: 10, padding: "14px 18px",
            }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#1d4ed8", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                📋 Motivo de Entrada — Por qué el cliente trajo el vehículo
              </div>
              <div style={{ fontSize: 14, color: "#1e3a5f", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {orden.motivo_entrada || orden.descripcion}
              </div>
              {orden.numero_orden && (
                <div style={{ marginTop: 6, fontSize: 11, color: "#6b7280" }}>
                  Orden: <strong>{orden.numero_orden}</strong>
                  {orden.prioridad && orden.prioridad !== "NORMAL" && (
                    <span style={{
                      marginLeft: 8, padding: "1px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700,
                      background: orden.prioridad === "URGENTE" ? "#fef2f2" : "#fff7ed",
                      color: orden.prioridad === "URGENTE" ? "#dc2626" : "#c2410c",
                      border: orden.prioridad === "URGENTE" ? "1px solid #fca5a5" : "1px solid #fed7aa",
                    }}>⚠️ {orden.prioridad}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Cliente + Vehículo */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Section title="👤 Datos del Cliente">
              <Row label="Nombre"    value={cliente?.nombre || "—"} />
              <Row label="Teléfono"  value={cliente?.telefono || "—"} />
              <Row label="RNC"       value={cliente?.rnc || "—"} />
              <Row label="Email"     value={cliente?.email || "—"} />
              {cliente?.direccion && <Row label="Dirección" value={cliente.direccion} />}
            </Section>

            <Section title="🚗 Vehículo">
              <Row label="Marca / Modelo" value={vehiculo ? `${vehiculo.marca} ${vehiculo.modelo}` : "—"} />
              <Row label="Año"            value={vehiculo?.ano || "—"} />
              <Row label="Placa"          value={vehiculo?.placa || "—"} mono />
              {vehiculo?.color && <Row label="Color"  value={vehiculo.color} />}
              {vehiculo?.vin   && <Row label="VIN"    value={vehiculo.vin} mono />}
              {inspeccion?.km_entrada && (
                <Row label="KM al recibir" value={`${Number(inspeccion.km_entrada).toLocaleString()} km`} />
              )}
            </Section>
          </div>

          {/* Estado de inspección */}
          {inspeccion && (
            <Section title="📋 Estado de Inspección al Recibir">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>CONDICIÓN GENERAL</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: condColor }}>
                    {inspeccion.condicion_general || "—"}
                  </div>
                </div>
                {inspeccion.nivel_combustible != null && (
                  <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>COMBUSTIBLE</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#f59e0b" }}>{inspeccion.nivel_combustible}%</div>
                  </div>
                )}
              </div>

              {/* Zonas de daño */}
              {inspeccion.zonas_danio && inspeccion.zonas_danio.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, marginBottom: 6 }}>DAÑOS OBSERVADOS AL INGRESO</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {inspeccion.zonas_danio.map((z, i) => (
                      <span key={i} style={{
                        background: "#fef9c3", color: "#92400e", border: "1px solid #fde68a",
                        borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600,
                      }}>
                        {z.zona.replace(/_/g, " ")}: {TIPO_LABEL[z.tipo] || z.tipo}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Checklist */}
              <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, marginBottom: 6 }}>CHECKLIST DE ACCESORIOS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
                {CHECKLIST_LABELS.map(({ key, label }) => {
                  const ok = (inspeccion as any)[key] === true || (inspeccion as any)[key] === 1;
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                      <span style={{ color: ok ? "#16a34a" : "#dc2626" }}>{ok ? "✓" : "✗"}</span>
                      <span style={{ color: "#374151" }}>{label}</span>
                    </div>
                  );
                })}
              </div>

              {inspeccion.observaciones && (
                <div style={{ marginTop: 10, background: "#fff7ed", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400e" }}>
                  <strong>Obs. recepción:</strong> {inspeccion.observaciones}
                </div>
              )}

              {/* Campos de condición visual */}
              {(inspeccion.rayones || inspeccion.golpes || inspeccion.estado_vidrios || inspeccion.estado_llantas || inspeccion.estado_pintura) && (
                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Rayones", value: inspeccion.rayones },
                    { label: "Golpes / Abolladuras", value: inspeccion.golpes },
                    { label: "Estado Vidrios", value: inspeccion.estado_vidrios },
                    { label: "Estado Llantas", value: inspeccion.estado_llantas },
                    { label: "Estado Pintura", value: inspeccion.estado_pintura },
                  ].filter(f => f.value).map(f => (
                    <div key={f.label} style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 12px" }}>
                      <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, marginBottom: 3, textTransform: "uppercase" }}>{f.label}</div>
                      <div style={{ fontSize: 13, color: "#374151" }}>{f.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Fotos de inspección */}
              {inspeccion.fotos_slots && Object.values(inspeccion.fotos_slots).some(Boolean) && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, marginBottom: 8 }}>FOTOS AL INGRESO</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                    {(["frente","trasero","lateral_izq","lateral_der"] as const).map(key => {
                      const img = inspeccion.fotos_slots?.[key];
                      const labels: Record<string, string> = { frente: "Frente", trasero: "Trasero", lateral_izq: "Lateral Izq.", lateral_der: "Lateral Der." };
                      return img ? (
                        <div key={key}>
                          <img src={img} alt={labels[key]}
                            style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 6, border: "1px solid #e5e7eb" }} />
                          <div style={{ fontSize: 10, color: "#6b7280", textAlign: "center", marginTop: 3 }}>{labels[key]}</div>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Diagnóstico técnico */}
          <Section title="🔍 Diagnóstico Técnico">
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: "12px 16px", fontSize: 14, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {diagnostico?.descripcion || "—"}
            </div>

            {diagnostico?.mano_de_obra_detalle && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, marginBottom: 6 }}>DETALLE DE TRABAJOS A REALIZAR</div>
                <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "10px 14px" }}>
                  {diagnostico.mano_de_obra_detalle.split("\n").filter(Boolean).map((linea, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4, fontSize: 13 }}>
                      <span style={{ color: "#16a34a", flexShrink: 0 }}>✓</span>
                      <span style={{ color: "#374151" }}>{linea}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* Repuestos */}
          {items.length > 0 && (
            <Section title="🔩 Repuestos y Materiales">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    {["#","Repuesto","Código","Cant.","Precio Unit.","Subtotal"].map(h => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, color: "#6b7280", fontWeight: 700, borderBottom: "2px solid #e5e7eb" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "9px 12px", color: "#9ca3af" }}>{i + 1}</td>
                      <td style={{ padding: "9px 12px", fontWeight: 600, color: "#111827" }}>{item.nombre}</td>
                      <td style={{ padding: "9px 12px", color: "#6b7280", fontFamily: "monospace", fontSize: 11 }}>{item.codigo || "—"}</td>
                      <td style={{ padding: "9px 12px", color: "#374151", fontWeight: 700 }}>{item.cantidad}</td>
                      <td style={{ padding: "9px 12px", color: "#374151" }}>{fmtDinero(item.precio_unitario)}</td>
                      <td style={{ padding: "9px 12px", fontWeight: 700, color: "#1d4ed8" }}>{fmtDinero(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* Resumen de costos */}
          <Section title="💰 Resumen de Costos">
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 360, marginLeft: "auto" }}>
              <CostoRow label="Mano de obra" value={fmtDinero(cotizacion.mano_obra)} />
              <CostoRow label="Repuestos y materiales" value={fmtDinero(cotizacion.repuestos)} />
              <div style={{ height: 1, background: "#e5e7eb", margin: "4px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, fontSize: 16, color: "#111827" }}>TOTAL</span>
                <span style={{ fontWeight: 900, fontSize: 22, color: "#1d4ed8" }}>{fmtDinero(cotizacion.total)}</span>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "right" }}>Precios en pesos dominicanos (RD$)</div>
            </div>

            {cotizacion.notas && (
              <div style={{ marginTop: 14, background: "#fff7ed", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400e" }}>
                <strong>Notas:</strong> {cotizacion.notas}
              </div>
            )}
          </Section>

          {/* Aprobación del cliente */}
          {!aprobado ? (
            <Section title="✍️ Aprobación del Cliente">
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
                Al firmar, el cliente acepta los trabajos y costos descritos en esta cotización y autoriza al taller a proceder con las reparaciones.
              </p>
              <div style={{ border: "2px dashed #d1d5db", borderRadius: 10, overflow: "hidden", maxWidth: 400, background: "#fafafa" }}>
                <canvas
                  ref={canvasRef} width={400} height={120}
                  style={{ display: "block", touchAction: "none", cursor: "crosshair" }}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
                />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
                <button onClick={limpiarFirma}
                  style={{ padding: "7px 14px", background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  🗑️ Borrar
                </button>
                {firmada && (
                  <button onClick={aprobar} disabled={aprobando}
                    style={{
                      padding: "9px 22px", background: aprobando ? "#9ca3af" : "#16a34a",
                      color: "#fff", border: "none", borderRadius: 9,
                      cursor: aprobando ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 800,
                      boxShadow: "0 4px 12px rgba(22,163,74,0.4)",
                    }}>
                    {aprobando ? "Guardando..." : "✅ Aprobar Cotización"}
                  </button>
                )}
                {!firmada && (
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>Firma arriba para habilitar la aprobación</span>
                )}
              </div>
            </Section>
          ) : (
            <div style={{
              background: "#f0fdf4", border: "2px solid #bbf7d0",
              borderRadius: 10, padding: "16px 20px",
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <span style={{ fontSize: 32 }}>✅</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#16a34a" }}>Cotización aprobada por el cliente</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  Aprobada el {fmtFecha(cotizacion.aprobado_at)} — El taller puede proceder con las reparaciones.
                </div>
              </div>
            </div>
          )}

          {/* Pie de página */}
          <div style={{
            marginTop: 8, padding: "16px 0 0",
            borderTop: "1px solid #f1f5f9",
            textAlign: "center", fontSize: 11, color: "#9ca3af",
          }}>
            <p style={{ margin: "0 0 4px" }}>Sólido Auto Servicio — Esta cotización es válida por 15 días desde su emisión.</p>
            <p style={{ margin: 0 }}>Generado por el Sistema CRM Automotriz · {numCot(cotizacion.id)}</p>
          </div>

        </div>
      </div>

      {/* Estilos de impresión */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          #cotizacion-doc {
            max-width: 100% !important;
            margin: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
      <div style={{
        background: "#f8fafc", padding: "10px 16px",
        fontWeight: 800, fontSize: 13, color: "#374151",
        borderBottom: "1px solid #e5e7eb",
      }}>
        {title}
      </div>
      <div style={{ padding: "14px 16px" }}>{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, fontSize: 13 }}>
      <span style={{ color: "#6b7280", minWidth: 110 }}>{label}</span>
      <span style={{ fontWeight: 600, color: "#111827", fontFamily: mono ? "monospace" : "inherit", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function CostoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#374151" }}>
      <span>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
