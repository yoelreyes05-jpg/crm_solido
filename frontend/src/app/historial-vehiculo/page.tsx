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
                  {filtrado.map((h: any) => {
                    const activa = !!h._activa;
                    const estadoColor = ESTADO_COLOR[h.estado] || "#6b7280";
                    return (
                    <tr key={h.id} style={{ borderTop: "1px solid #f0f0f0", cursor: "pointer", background: activa ? "#fffbeb" : "" }}
                      onMouseEnter={e => (e.currentTarget.style.background = activa ? "#fef9c3" : "#fafbff")}
                      onMouseLeave={e => (e.currentTarget.style.background = activa ? "#fffbeb" : "")}>
                      <td style={{ padding: "12px 14px", fontWeight: 700, fontSize: 13, color: "#6366f1" }}>
                        {h.numero_orden || "—"}
                        {activa && (
                          <span style={{ marginLeft: 6, fontSize: 10, background: estadoColor + "22", color: estadoColor,
                            border: `1px solid ${estadoColor}55`, borderRadius: 20, padding: "1px 7px", fontWeight: 700, verticalAlign: "middle" }}>
                            {h.estado}
                          </span>
                        )}
                      </td>
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
                          style={{ padding: "6px 16px", background: activa ? "#f59e0b" : "#6366f1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                          Ver →
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Función de impresión del expediente ───────────────
function imprimirExpedienteHistorial(h: any, detalleCompleto: any, manoDeObraDetalle: string, trabajosItems: any[], descripcionTrabajo: string, resolvedDiag?: { fallasIdentificadas: string; inspeccionMecanica: string; inspeccionElectrica: string; inspeccionElectronica: string; codigosFalla: string; observacionesDiag: string; resultadoQC: string; observacionesQC: string; }) {
  const fmtD  = (v: any) => v ? new Date(v).toLocaleDateString("es-DO", { year:"numeric", month:"short", day:"numeric" }) : "—";
  const fmtDH = (v: any) => v ? new Date(v).toLocaleString("es-DO", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
  const fmt$  = (v: any) => `RD$ ${Number(v||0).toLocaleString("es-DO", { minimumFractionDigits:2 })}`;

  // Datos resueltos
  const facLive: any   = detalleCompleto?.factura || null;
  const cotLive: any   = detalleCompleto?.cotizacion || null;
  const facItemsLive: any[] = Array.isArray(detalleCompleto?.factura_items) ? detalleCompleto.factura_items : [];
  const cotSnap: any   = h.cotizacion_data && typeof h.cotizacion_data === "object" ? h.cotizacion_data : {};
  const facSnap: any   = h.factura_data    && typeof h.factura_data    === "object" ? h.factura_data    : {};
  const cot: any       = cotLive || cotSnap;
  const fac: any       = facLive || facSnap;
  const facItems: any[] = facItemsLive.length > 0 ? facItemsLive : (Array.isArray(fac?.items) ? fac.items : []);
  const timeline: any[] = Array.isArray(detalleCompleto?.estado_historial) && detalleCompleto.estado_historial.length > 0
    ? detalleCompleto.estado_historial : (Array.isArray(h.timeline_data) ? h.timeline_data : []);
  const fechas: any    = detalleCompleto?.fechas_proceso || (h.fechas_proceso && typeof h.fechas_proceso === "object" ? h.fechas_proceso : {});
  const checklist: any = h.checklist_qc && typeof h.checklist_qc === "object" ? h.checklist_qc : {};
  const inspec: any    = detalleCompleto?.inspeccion || (h.inspeccion_data && typeof h.inspeccion_data === "object" ? h.inspeccion_data : null);
  const avancesSnap: any[] = Array.isArray(h.avances_data) ? h.avances_data : [];
  const avances: any[] = Array.isArray(detalleCompleto?.avances) && detalleCompleto.avances.length > 0 ? detalleCompleto.avances : avancesSnap;

  const QC_LBL: Record<string,string> = {
    motor:"Motor",frenos:"Frenos",fluidos:"Sin fugas",luces:"Luces",
    electrico:"Eléctrico",transmision:"Transmisión",suspension:"Suspensión",
    ac:"A/C",limpieza:"Limpieza",prueba_ruta:"Prueba ruta",trabajo_ok:"Trabajo 100%",
  };

  const logoUrl = typeof window !== "undefined" ? window.location.origin + "/logo.png" : "/logo.png";

  // Helpers compactos
  const ST = (ico: string, t: string) =>
    `<div style="font-size:9.5px;font-weight:800;color:#4f46e5;text-transform:uppercase;letter-spacing:1px;margin:10px 0 4px;padding:3px 8px;background:#f5f3ff;border-left:2px solid #6366f1;border-radius:3px">${ico} ${t}</div>`;
  const FL = (l: string, v: any) => v
    ? `<span style="color:#888;font-size:10px">${l}: </span><b style="font-size:10px;color:#222">${v}</b>  ` : "";

  // ── TRABAJO SOLICITADO
  const secTrabSol = descripcionTrabajo
    ? `${ST("📝","Trabajo Solicitado")}<div style="background:#eff6ff;border-radius:5px;padding:5px 10px;font-size:10.5px;color:#1e3a5f;white-space:pre-wrap;line-height:1.5">${descripcionTrabajo}</div>` : "";

  // ── INSPECCIÓN con diagrama SVG + fotos ──────────────────────────────────
  const secInsp = inspec ? (() => {
    const zonas = Array.isArray(inspec.zonas_danio) ? inspec.zonas_danio : [];

    // Tabla de datos de zonas para el SVG
    const ZONAS_P = [
      { id:"frontal_centro",  cx:200, cy:45  }, { id:"frontal_izq",    cx:110, cy:65  },
      { id:"frontal_der",     cx:290, cy:65  }, { id:"lateral_izq_f",  cx:65,  cy:130 },
      { id:"lateral_izq_t",  cx:65,  cy:230  }, { id:"lateral_der_f",  cx:335, cy:130 },
      { id:"lateral_der_t",  cx:335, cy:230  }, { id:"techo",          cx:200, cy:175 },
      { id:"trasero_izq",    cx:110, cy:295  }, { id:"trasero_der",    cx:290, cy:295 },
      { id:"trasero_centro", cx:200, cy:315  },
    ];
    const DCOLOR: Record<string,string> = {
      rayon_leve:"#f59e0b", rayon_profundo:"#ef4444",
      golpe:"#7c3aed", falta_pieza:"#1d4ed8", sin_danio:"#10b981",
    };
    const DLABEL: Record<string,string> = {
      rayon_leve:"Rayón leve", rayon_profundo:"Rayón profundo",
      golpe:"Golpe", falta_pieza:"Falta pieza", sin_danio:"Sin daño",
    };
    const getZ = (id: string) => zonas.find((z:any)=>(z.zona_id||z.zona)===id);

    // SVG top-view del vehículo con marcadores
    const svgDiagram = zonas.length > 0 ? `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 370" width="160" height="148" style="display:block;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;flex-shrink:0">
        <rect x="130" y="80" width="140" height="200" rx="20" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
        <path d="M145 80 Q200 20 255 80 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
        <path d="M145 280 Q200 340 255 280 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
        <rect x="90"  y="110" width="40" height="50" rx="5" fill="#94a3b8"/>
        <rect x="90"  y="200" width="40" height="50" rx="5" fill="#94a3b8"/>
        <rect x="270" y="110" width="40" height="50" rx="5" fill="#94a3b8"/>
        <rect x="270" y="200" width="40" height="50" rx="5" fill="#94a3b8"/>
        <rect x="145" y="135" width="110" height="90" rx="5" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1.5"/>
        ${ZONAS_P.map(z => {
          const d = getZ(z.id);
          if (!d) return `<circle cx="${z.cx}" cy="${z.cy}" r="7" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1" opacity="0.4"/>`;
          const tipo = d.tipo_danio||d.tipo||"";
          const col  = DCOLOR[tipo] || "#94a3b8";
          const sym  = tipo==="rayon_leve"?"R":tipo==="rayon_profundo"?"R!":tipo==="golpe"?"G":tipo==="falta_pieza"?"FP":"✓";
          return `<circle cx="${z.cx}" cy="${z.cy}" r="13" fill="${col}" stroke="white" stroke-width="2" opacity="0.9"/>
                  <text x="${z.cx}" y="${z.cy+4}" text-anchor="middle" fill="white" font-size="8" font-weight="bold">${sym}</text>`;
        }).join("")}
      </svg>` : "";

    // Chips de zonas
    const chipsHtml = zonas.length > 0
      ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${zonas.map((z:any)=>{
          const lab  = z.label||(z.zona||z.zona_id||"").replace(/_/g," ");
          const tipo = z.tipo_danio||z.tipo||"";
          const col  = DCOLOR[tipo]||"#94a3b8";
          const tLab = DLABEL[tipo]||tipo.replace(/_/g," ")||"—";
          return `<span style="display:inline-flex;align-items:center;gap:3px;background:#fef9c3;border:1px solid #fde68a;color:#92400e;border-radius:4px;padding:2px 7px;font-size:9.5px;font-weight:600">
            <span style="width:7px;height:7px;border-radius:50%;background:${col};display:inline-block"></span>${lab}: ${tLab}
          </span>`;
        }).join("")}</div>` : "";

    // Bloque SVG + chips lado a lado
    const danosHtml = zonas.length > 0
      ? `<div style="margin-top:6px">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#92400e;margin-bottom:5px">⚠️ Daños al ingreso</div>
          <div style="display:flex;gap:10px;align-items:flex-start">
            ${svgDiagram}
            <div style="flex:1">${chipsHtml}</div>
          </div>
        </div>` : "";

    // Fotos de recepción
    const slots = inspec.fotos_slots && typeof inspec.fotos_slots === "object" ? inspec.fotos_slots : {};
    const fotoKeys = ["frente","trasero","lateral_izq","lateral_der","interior","tablero","danos_visibles"];
    const fotoLbls: Record<string,string> = {
      frente:"Frente", trasero:"Trasero", lateral_izq:"Lat. Izq.", lateral_der:"Lat. Der.",
      interior:"Interior", tablero:"Tablero", danos_visibles:"Daños Visibles",
    };
    const fotosArr: any[] = Array.isArray(inspec.fotos) ? inspec.fotos : [];
    const fotoImgs = [
      ...fotoKeys.filter(k => (slots as any)[k]).map(k => ({ src:(slots as any)[k], lbl:fotoLbls[k]||k })),
      ...fotosArr.filter((f:any)=>f.data).map((f:any)=>({ src:f.data, lbl:f.label||f.tipo||"Foto" })),
    ];
    const fotosHtml = fotoImgs.length > 0
      ? `<div style="margin-top:8px">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:5px">📸 Fotos de Recepción</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${fotoImgs.map(f=>`<div style="text-align:center">
              <img src="${f.src}" style="width:120px;height:90px;object-fit:cover;border-radius:5px;border:1px solid #e2e8f0;display:block"/>
              <div style="font-size:8px;color:#9ca3af;margin-top:2px">${f.lbl}</div>
            </div>`).join("")}
          </div>
        </div>` : "";

    const kmComb = [
      inspec.km_entrada != null ? `KM: ${Number(inspec.km_entrada).toLocaleString()}` : "",
      inspec.nivel_combustible != null ? `Comb: ${inspec.nivel_combustible}%` : "",
      inspec.condicion_general ? `Cond: ${inspec.condicion_general}` : "",
    ].filter(Boolean).join("  ·  ");

    return `${ST("📋","Recepción")}
      <div style="font-size:10px;color:#374151">${kmComb}</div>
      ${inspec.observaciones ? `<div style="font-size:10px;color:#555;margin-top:2px">${inspec.observaciones}</div>` : ""}
      ${danosHtml}
      ${fotosHtml}`;
  })() : "";

  // ── DIAGNÓSTICO
  const secDiag = (() => {
    const fallas   = resolvedDiag?.fallasIdentificadas || h.fallas_identificadas || h.diagnostico_general;
    const inspecMec  = resolvedDiag?.inspeccionMecanica    || h.inspeccion_mecanica;
    const inspecElec = resolvedDiag?.inspeccionElectrica   || h.inspeccion_electrica;
    const inspecEle  = resolvedDiag?.inspeccionElectronica || h.inspeccion_electronica;
    const mo = manoDeObraDetalle;
    if (!fallas && !mo && !inspecMec && !inspecElec) return "";
    const fallasHtml = fallas ? `<div style="background:#eff6ff;border-radius:5px;padding:5px 10px;font-size:10.5px;color:#1e40af;font-weight:600;white-space:pre-wrap;margin-bottom:4px">${fallas}</div>` : "";
    const moHtml = mo ? `<div style="font-size:9.5px;font-weight:700;color:#065f46;margin:4px 0 2px">MANO DE OBRA</div><div style="display:flex;flex-wrap:wrap;gap:3px">${mo.split("\n").filter((l:string)=>l.trim()).map((l:string)=>`<span style="font-size:9.5px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;padding:2px 7px">✓ ${l.trim()}</span>`).join("")}</div>` : "";
    const inspecGrid = (inspecMec || inspecElec || inspecEle)
      ? `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:9.5px;margin-top:4px">${inspecMec?`<div><b style="color:#555">🔧 Mecánica</b><br>${inspecMec}</div>`:""}${inspecElec?`<div><b style="color:#555">⚡ Eléctrica</b><br>${inspecElec}</div>`:""}${inspecEle?`<div><b style="color:#555">💻 Scanner</b><br>${inspecEle}</div>`:""}</div>` : "";
    return `${ST("🔬","Diagnóstico Técnico")}${fallasHtml}${moHtml}${inspecGrid}`;
  })();

  // ── TRABAJOS REALIZADOS
  const secTrabajos = trabajosItems.length > 0
    ? `${ST("🛠️","Trabajos Realizados")}<table style="width:100%;border-collapse:collapse;font-size:9.5px"><thead><tr style="background:#f8fafc"><th style="padding:3px 6px;text-align:left;color:#6b7280">Tipo</th><th style="padding:3px 6px;text-align:left;color:#6b7280">Descripción</th><th style="padding:3px 6px;text-align:left;color:#6b7280">Estado</th></tr></thead><tbody>${trabajosItems.map((t:any)=>`<tr style="border-top:1px solid #f0f0f0"><td style="padding:3px 6px;font-weight:600">${t.tipo||"—"}</td><td style="padding:3px 6px">${t.descripcion||"—"}</td><td style="padding:3px 6px;font-weight:700;color:${t.estado==="REALIZADO"?"#065f46":"#92400e"}">${(t.estado||"").replace(/_/g," ")}</td></tr>`).join("")}</tbody></table>`
    : avances.length > 0
    ? `${ST("🛠️","Avances")}${avances.map((a:any)=>`<div style="font-size:9.5px;padding:2px 0;border-bottom:1px solid #f0f0f0"><b>${a.tecnico_nombre||""}</b>${a.created_at?` · ${fmtD(a.created_at)}`:""} — ${a.descripcion||""}</div>`).join("")}`
    : h.trabajos_realizados ? `${ST("🛠️","Trabajos Realizados")}<div style="font-size:9.5px;white-space:pre-wrap">${h.trabajos_realizados}</div>` : "";

  // ── COTIZACIÓN + FACTURA (en dos columnas si ambas existen)
  const hayCot = cot && (Number(cot.mano_obra||0) > 0 || Number(cot.total||0) > 0);
  const hayFac = fac && Number(fac.total||0) > 0;

  const cotHtml = hayCot ? `${ST("📄","Cotización")}<table style="width:100%;border-collapse:collapse;font-size:9.5px"><tbody>${Number(cot.mano_obra||0)>0?`<tr style="border-bottom:1px solid #f0f0f0"><td style="padding:2px 6px">Mano de obra</td><td style="padding:2px 6px;text-align:right;font-weight:700">${fmt$(cot.mano_obra)}</td></tr>`:""}${Number(cot.repuestos||0)>0?`<tr style="border-bottom:1px solid #f0f0f0"><td style="padding:2px 6px">Repuestos</td><td style="padding:2px 6px;text-align:right;font-weight:700">${fmt$(cot.repuestos)}</td></tr>`:""}${Number(cot.itbis||0)>0?`<tr style="border-bottom:1px solid #f0f0f0"><td style="padding:2px 6px">ITBIS</td><td style="padding:2px 6px;text-align:right">${fmt$(cot.itbis)}</td></tr>`:""}<tr style="background:#f0fdf4"><td style="padding:4px 6px;font-weight:900">TOTAL</td><td style="padding:4px 6px;text-align:right;font-weight:900;color:#065f46">${fmt$(cot.total||(Number(cot.mano_obra||0)+Number(cot.repuestos||0)))}</td></tr></tbody></table>` : "";

  const facHtml = hayFac ? `${ST("🧾","Factura")}` +
    `<div style="font-size:9.5px;margin-bottom:3px">${FL("NCF",fac.ncf)}${FL("Tipo",fac.ncf_tipo)}${FL("Pago",fac.metodo_pago)}</div>` +
    (facItems.length > 0
      ? `<table style="width:100%;border-collapse:collapse;font-size:9.5px"><thead><tr style="background:#f8fafc"><th style="padding:2px 6px;text-align:left">Descripción</th><th style="padding:2px 6px;text-align:center">Cant.</th><th style="padding:2px 6px;text-align:right">Subtotal</th></tr></thead><tbody>${facItems.map((fi:any)=>`<tr style="border-top:1px solid #f0f0f0"><td style="padding:2px 6px">${fi.descripcion||"—"}</td><td style="padding:2px 6px;text-align:center">${fi.cantidad||1}</td><td style="padding:2px 6px;text-align:right;font-weight:700">${fmt$(fi.subtotal)}</td></tr>`).join("")}</tbody></table>` : "") +
    `<div style="font-weight:900;font-size:11px;color:#166534;margin-top:3px;text-align:right">Total: ${fmt$(fac.total)}</div>` : "";

  const secFinanciero = (hayCot || hayFac)
    ? `<div style="display:grid;grid-template-columns:${hayCot && hayFac ? "1fr 1fr" : "1fr"};gap:10px">${cotHtml}${facHtml}</div>` : "";

  // ── CONTROL DE CALIDAD
  const _resQC = resolvedDiag?.resultadoQC || h.resultado_qc;
  const _obsQC = resolvedDiag?.observacionesQC || h.observaciones_qc;
  const secQC = _resQC ? (() => {
    const aprobado = _resQC === "APROBADO";
    const clItems = Object.entries(checklist).filter(([,v]) => v !== undefined);
    const clHtml = clItems.length > 0
      ? `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px">${clItems.map(([k,v])=>`<span style="font-size:9px;padding:2px 6px;border-radius:10px;background:${v?"#f0fdf4":"#fef2f2"};color:${v?"#065f46":"#991b1b"};border:1px solid ${v?"#bbf7d0":"#fca5a5"}">${v?"✓":"✗"} ${QC_LBL[k]||k.replace(/_/g," ")}</span>`).join("")}</div>` : "";
    return `${ST("✅","Control de Calidad")}<span style="display:inline-block;padding:2px 12px;border-radius:20px;font-weight:800;font-size:10px;background:${aprobado?"#d1fae5":"#fee2e2"};color:${aprobado?"#065f46":"#991b1b"}">${_resQC}</span>${_obsQC?`<span style="font-size:9.5px;color:#555;margin-left:8px">${_obsQC}</span>`:""}${clHtml}`;
  })() : "";

  // ── ENTREGA
  const secEntrega = (h.fecha_entrega || (h as any).notas_entrega)
    ? `${ST("🏁","Entrega")}<div style="font-size:9.5px">${FL("Fecha",fmtDH(h.fecha_entrega))}${FL("Por",(h as any).usuario_entrego)}</div>${(h as any).notas_entrega?`<div style="font-size:9.5px;color:#374151;margin-top:2px;padding:3px 8px;background:#eff6ff;border-radius:4px">${(h as any).notas_entrega}</div>`:""}` : "";

  // ── TIMELINE (compacto — inline)
  const secTimeline = timeline.length > 0
    ? `${ST("📅","Historial")}<table style="width:100%;border-collapse:collapse;font-size:9px">${timeline.map((t:any)=>`<tr style="border-bottom:1px solid #f5f5f5"><td style="padding:2px 5px;white-space:nowrap;color:#888;width:105px">${fmtDH(t.created_at)}</td><td style="padding:2px 5px;font-weight:700;color:#374151;width:150px">${(t.estado_nuevo||"").replace(/_/g," ")}</td><td style="padding:2px 5px;color:#6b7280">${t.usuario_nombre||""}</td><td style="padding:2px 5px;color:#92400e;font-style:italic">${t.motivo||""}</td></tr>`).join("")}</table>` : "";

  // ── FECHAS (barra horizontal)
  const fechasArr = [
    {l:"Recibido",v:fechas.recibido},{l:"Diagnóstico",v:fechas.diagnostico},
    {l:"Aprobación",v:fechas.aprobacion},{l:"Reparación",v:fechas.inicio_reparacion},
    {l:"QC",v:fechas.control_calidad},{l:"Listo",v:fechas.listo},{l:"Entregado",v:fechas.entrega},
  ].filter(f=>f.v);
  const secFechas = fechasArr.length > 0
    ? `${ST("🕐","Fechas")}<div style="display:flex;flex-wrap:wrap;gap:5px">${fechasArr.map(f=>`<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:5px;padding:3px 8px"><div style="font-size:8.5px;color:#888">${f.l}</div><div style="font-size:9.5px;font-weight:700;color:#333">${fmtDH(f.v)}</div></div>`).join("")}</div>` : "";

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Expediente — ${h.placa} · ${h.numero_orden||""}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:10.5px;color:#1a1a1a;line-height:1.4;max-width:780px;margin:auto;padding:12px 16px}
  @media print{
    @page{margin:6mm 8mm;size:A4}
    body{padding:0}
  }
</style></head><body>

<!-- CABECERA compacta -->
<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #111827;padding-bottom:8px;margin-bottom:8px">
  <div style="display:flex;align-items:center;gap:10px">
    <img src="${logoUrl}" alt="Logo" style="height:40px;max-width:120px;object-fit:contain;border-radius:4px" onerror="this.style.display='none'"/>
    <div>
      <div style="font-size:13px;font-weight:900;line-height:1.2">SÓLIDO AUTO SERVICIO</div>
      <div style="font-size:9px;color:#6b7280">Mecánica &amp; Detallado · Tel: 849-569-2027 · Santo Domingo, RD</div>
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:15px;font-weight:900;color:#4f46e5">${h.numero_orden||`ID #${h.id}`}</div>
    <div style="font-size:9px;color:#6b7280">${fmtD(h.fecha_servicio)}</div>
    <span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:9px;font-weight:700;background:#d1fae5;color:#065f46">✅ ENTREGADO</span>
  </div>
</div>

<!-- INFO PRINCIPAL: vehículo + cliente + costos en una sola fila -->
<div style="display:grid;grid-template-columns:1.1fr 1fr 0.9fr;gap:8px;margin-bottom:8px">
  <div style="border:1px solid #e5e7eb;border-radius:6px;padding:6px 10px;background:#f8fafc">
    <div style="font-size:8.5px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:3px">🚗 Vehículo</div>
    <div style="font-weight:800;font-size:12px;color:#3b82f6;font-family:monospace">${h.placa}</div>
    <div style="font-size:10.5px;font-weight:600">${h.marca||""} ${h.modelo||""} ${h.ano?`(${h.ano})`:""}</div>
    <div style="font-size:9.5px;color:#6b7280">${h.color||""}</div>
  </div>
  <div style="border:1px solid #e5e7eb;border-radius:6px;padding:6px 10px;background:#f8fafc">
    <div style="font-size:8.5px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:3px">👤 Cliente</div>
    <div style="font-size:11px;font-weight:700">${h.cliente_nombre||"Particular"}</div>
    ${h.cliente_telefono?`<div style="font-size:9.5px;color:#6b7280">📞 ${h.cliente_telefono}</div>`:""}
    ${detalleCompleto?.cliente?.email?`<div style="font-size:9px;color:#6b7280">${detalleCompleto.cliente.email}</div>`:""}
  </div>
  <div style="border:1px solid #bbf7d0;border-radius:6px;padding:6px 10px;background:#f0fdf4">
    <div style="font-size:8.5px;font-weight:700;color:#065f46;text-transform:uppercase;margin-bottom:3px">💰 Total</div>
    ${Number(h.costo_mano_obra||0)>0?`<div style="font-size:9.5px;color:#374151">M.O.: <b>${fmt$(h.costo_mano_obra)}</b></div>`:""}
    ${Number(h.costo_repuestos||0)>0?`<div style="font-size:9.5px;color:#374151">Rep.: <b>${fmt$(h.costo_repuestos)}</b></div>`:""}
    <div style="font-size:13px;font-weight:900;color:#065f46">${fmt$(h.costo_total)}</div>
    ${(h as any).ncf?`<div style="font-size:9px;color:#6b7280">NCF: ${(h as any).ncf}</div>`:""}
  </div>
</div>

${secTrabSol}${secInsp}${secDiag}${secTrabajos}${secFinanciero}${secQC}${secEntrega}${secTimeline}${secFechas}

<!-- PIE -->
<div style="margin-top:10px;padding-top:6px;border-top:1px dashed #cbd5e1;text-align:center;font-size:9px;color:#9ca3af">
  Expediente generado el ${fmtD(new Date().toISOString())} · <b>SÓLIDO AUTO SERVICIO</b> · Tel: 849-569-2027
</div>
</body></html>`;

  const prev = document.getElementById("__print_hist__");
  if (prev) prev.remove();
  const iframe = document.createElement("iframe");
  iframe.id = "__print_hist__";
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:820px;height:1200px;border:none;opacity:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || (iframe.contentWindow as any)?.document;
  if (!doc) { const w = window.open("","_blank","width=820,height=1200"); if (w) { w.document.write(html); w.document.close(); } return; }
  doc.open(); doc.write(html); doc.close();
  iframe.onload = () => { try { (iframe.contentWindow as any)?.focus(); (iframe.contentWindow as any)?.print(); } catch { const w = window.open("","_blank","width=820,height=1200"); if (w) { w.document.write(html); w.document.close(); } } };
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
    // Si tiene id numérico de vehiculo_historial → endpoint de historial cerrado
    // Si es una orden activa (id = "orden_X") → endpoint de orden activa
    const ordenId = h.orden_id;
    const tieneHistorial = h._historial_id || (typeof h.id === "number");
    const url = tieneHistorial
      ? `${API}/vehiculo-historial/${h._historial_id || h.id}/detalle`
      : `${API}/vehiculo-historial/orden/${ordenId}/detalle`;
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDetalleCompleto(d); })
      .catch(() => {});
  }, [h.id, h.orden_id, h._historial_id]);

  // ── Helper: parsear campo que puede venir como JSON string ──
  const parseJsonField = (v: any): any[] => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v.trim().startsWith("[")) {
      try { return JSON.parse(v); } catch { return []; }
    }
    return [];
  };

  // Datos vivos del endpoint de detalle (prioritarios)
  const diagVivo   = detalleCompleto?.diagnostico   || null;
  const ordenViva  = detalleCompleto?.orden         || null;
  const cotViva    = detalleCompleto?.cotizacion    || null;
  const facViva    = detalleCompleto?.factura       || null;
  const inspecViva = detalleCompleto?.inspeccion    || null;

  // Snapshots JSONB de vehiculo_historial (fallback para órdenes con historial cerrado)
  const avancesSnap: any[] = Array.isArray(h.avances_data)   ? h.avances_data   : [];
  const cotSnap:     any   = h.cotizacion_data && typeof h.cotizacion_data === "object" && !Array.isArray(h.cotizacion_data) ? h.cotizacion_data : null;
  const facSnap:     any   = h.factura_data    && typeof h.factura_data    === "object" && !Array.isArray(h.factura_data)    ? h.factura_data    : null;
  const fechasSnap:  any   = h.fechas_proceso  && typeof h.fechas_proceso  === "object" ? h.fechas_proceso : {};
  const checklist:   any   = h.checklist_qc    && typeof h.checklist_qc    === "object" ? h.checklist_qc   : {};
  const inspecSnap:  any   = h.inspeccion_data && typeof h.inspeccion_data === "object" ? h.inspeccion_data : null;

  // Fuentes resueltas (live primero, snapshot como fallback)
  const inspec:      any   = inspecViva || inspecSnap;
  const cot:         any   = cotViva    || cotSnap;
  const fac:         any   = facViva    || facSnap;
  const fechas:      any   = detalleCompleto?.fechas_proceso || fechasSnap || {};

  const avancesLive: any[] = Array.isArray(detalleCompleto?.avances) && detalleCompleto.avances.length > 0
    ? detalleCompleto.avances : avancesSnap;

  // Timeline: live (estado_historial del endpoint) > snapshot (timeline_data)
  const timeline: any[] = Array.isArray(detalleCompleto?.estado_historial) && detalleCompleto.estado_historial.length > 0
    ? detalleCompleto.estado_historial.map((t: any) => ({
        ...t, estado_nuevo: t.estado_nuevo || t.estado, estado_anterior: t.estado_anterior || null,
      }))
    : Array.isArray(h.timeline_data) ? h.timeline_data : [];

  // Items de cotización y factura
  const cotItems: any[] = detalleCompleto?.cotizacion_items?.length
    ? detalleCompleto.cotizacion_items
    : parseJsonField(cot?.items_detalle || cot?.items || []);
  const facItems: any[] = detalleCompleto?.factura_items?.length
    ? detalleCompleto.factura_items
    : parseJsonField(fac?.items || []);

  // trabajos_realizados_items
  const rawTrabajosItems = diagVivo?.trabajos_realizados_items
    || cot?.trabajos_realizados_items
    || h.trabajos_realizados_items;
  const trabajosItems: any[] = parseJsonField(rawTrabajosItems);

  // mano_de_obra_detalle
  const manoDeObraDetalle: string =
    diagVivo?.mano_de_obra_detalle
    || cotViva?.mano_de_obra_detalle
    || cotSnap?.mano_de_obra_detalle
    || (h as any).mano_de_obra_detalle
    || "";

  // descripcion (trabajo solicitado)
  const descripcionTrabajo: string =
    ordenViva?.descripcion || ordenViva?.motivo_entrada
    || (h as any).descripcion
    || h.motivo_entrada
    || "";

  // Campos de diagnóstico: live > snapshot en h
  const fallasIdentificadas = diagVivo?.fallas_identificadas || h.fallas_identificadas || h.diagnostico_general || "";
  const inspeccionMecanica  = diagVivo?.inspeccion_mecanica  || h.inspeccion_mecanica  || "";
  const inspeccionElectrica = diagVivo?.inspeccion_electrica || h.inspeccion_electrica || "";
  const inspeccionElectronica = diagVivo?.inspeccion_electronica || h.inspeccion_electronica || "";
  const codigosFalla        = diagVivo?.codigos_falla        || h.codigos_falla        || "";
  const observacionesDiag   = diagVivo?.observaciones        || h.observaciones        || "";
  const resultadoQC         = ordenViva?.resultado_qc || h.resultado_qc || "";
  const observacionesQC     = ordenViva?.observaciones_qc || h.observaciones_qc || "";
  const tecnicoNombre       = detalleCompleto?.tecnico_nombre || diagVivo?.tecnico_nombre || h.tecnico_nombre || "";

  const hayFallas = codigosFalla || fallasIdentificadas;
  const hayQC     = resultadoQC || observacionesQC || Object.keys(checklist).length > 0;

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
          <button
            onClick={() => imprimirExpedienteHistorial(h, detalleCompleto, manoDeObraDetalle, trabajosItems, descripcionTrabajo, { fallasIdentificadas, inspeccionMecanica, inspeccionElectrica, inspeccionElectronica, codigosFalla, observacionesDiag, resultadoQC, observacionesQC })}
            style={{ padding: "9px 20px", background: "#111827", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            🖨️ Imprimir
          </button>
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
          <Fila label="Tipo de servicio" valor={diagVivo?.tipo_servicio || h.tipo_servicio} destaca />
          <Fila label="Técnico"       valor={tecnicoNombre} />
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

            {Array.isArray(inspec.zonas_danio) && inspec.zonas_danio.length > 0 && (() => {
              const ZONAS_H = [
                { id:"frontal_centro",  label:"Frontal centro",       cx:200, cy:45  },
                { id:"frontal_izq",     label:"Frontal izquierdo",    cx:110, cy:65  },
                { id:"frontal_der",     label:"Frontal derecho",      cx:290, cy:65  },
                { id:"lateral_izq_f",   label:"Lat. izq. frente",     cx:65,  cy:130 },
                { id:"lateral_izq_t",   label:"Lat. izq. trasero",    cx:65,  cy:230 },
                { id:"lateral_der_f",   label:"Lat. der. frente",     cx:335, cy:130 },
                { id:"lateral_der_t",   label:"Lat. der. trasero",    cx:335, cy:230 },
                { id:"techo",           label:"Techo",                cx:200, cy:175 },
                { id:"trasero_izq",     label:"Trasero izquierdo",    cx:110, cy:295 },
                { id:"trasero_der",     label:"Trasero derecho",      cx:290, cy:295 },
                { id:"trasero_centro",  label:"Trasero centro",       cx:200, cy:315 },
              ];
              const TIPO_COLOR_H: Record<string,string> = {
                rayon_leve:"#f59e0b", rayon_profundo:"#ef4444",
                golpe:"#7c3aed", falta_pieza:"#1d4ed8", sin_danio:"#10b981",
              };
              const TIPO_LABEL_H: Record<string,string> = {
                rayon_leve:"Rayón leve", rayon_profundo:"Rayón profundo",
                golpe:"Golpe", falta_pieza:"Falta pieza", sin_danio:"Sin daño",
              };
              const getZona = (id: string) => inspec.zonas_danio.find((z: any) => (z.zona_id||z.zona) === id);
              return (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 10 }}>⚠️ Daños al Ingreso</div>
                  <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
                    {/* Diagrama SVG */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 370" style={{ width: 200, height: 185, border: "1px solid #e5e7eb", borderRadius: 10, background: "#f8fafc", flexShrink: 0 }}>
                      <rect x="130" y="80" width="140" height="200" rx="20" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2"/>
                      <path d="M145 80 Q200 20 255 80 Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2"/>
                      <path d="M145 280 Q200 340 255 280 Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2"/>
                      <rect x="90" y="110" width="40" height="50" rx="5" fill="#94a3b8"/>
                      <rect x="90" y="200" width="40" height="50" rx="5" fill="#94a3b8"/>
                      <rect x="270" y="110" width="40" height="50" rx="5" fill="#94a3b8"/>
                      <rect x="270" y="200" width="40" height="50" rx="5" fill="#94a3b8"/>
                      <rect x="145" y="135" width="110" height="90" rx="5" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1.5"/>
                      {ZONAS_H.map(z => {
                        const d = getZona(z.id);
                        if (!d) return <circle key={z.id} cx={z.cx} cy={z.cy} r={7} fill="#e2e8f0" stroke="#cbd5e1" strokeWidth={1} opacity={0.4}/>;
                        const tipo = d.tipo_danio||d.tipo||"";
                        const col = TIPO_COLOR_H[tipo] || "#94a3b8";
                        return (
                          <g key={z.id}>
                            <circle cx={z.cx} cy={z.cy} r={13} fill={col} stroke="white" strokeWidth={2} opacity={0.9}/>
                            <text x={z.cx} y={z.cy+4} textAnchor="middle" fill="white" fontSize={8} fontWeight="bold">
                              {tipo==="rayon_leve"?"R":tipo==="rayon_profundo"?"R!":tipo==="golpe"?"G":tipo==="falta_pieza"?"FP":"✓"}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                    {/* Chips de detalle */}
                    <div style={{ flex: 1, minWidth: 160 }}>
                      {/* Leyenda */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {[
                          { tipo:"rayon_leve", col:"#f59e0b", sym:"R", label:"Rayón leve" },
                          { tipo:"rayon_profundo", col:"#ef4444", sym:"R!", label:"Rayón profundo" },
                          { tipo:"golpe", col:"#7c3aed", sym:"G", label:"Golpe" },
                          { tipo:"falta_pieza", col:"#1d4ed8", sym:"FP", label:"Falta pieza" },
                        ].filter(l => inspec.zonas_danio.some((z: any) => (z.tipo_danio||z.tipo) === l.tipo)).map(l => (
                          <span key={l.tipo} style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, color:"#555" }}>
                            <span style={{ width:16, height:16, borderRadius:"50%", background:l.col, color:"#fff", fontSize:8, fontWeight:700, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>{l.sym}</span>
                            {l.label}
                          </span>
                        ))}
                      </div>
                      {/* Lista de zonas */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {inspec.zonas_danio.map((z: any, i: number) => {
                          const lab  = z.label || (z.zona||z.zona_id||"").replace(/_/g," ");
                          const tipo = z.tipo_danio||z.tipo||"";
                          const col  = TIPO_COLOR_H[tipo] || "#94a3b8";
                          const tLab = TIPO_LABEL_H[tipo] || tipo.replace(/_/g," ");
                          return (
                            <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:5, background:"#fef9c3", border:"1px solid #fde68a", color:"#92400e", borderRadius:6, padding:"4px 10px", fontSize:12, fontWeight:600 }}>
                              <span style={{ width:8, height:8, borderRadius:"50%", background:col, display:"inline-block", flexShrink:0 }}/>
                              {lab}: {tLab}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

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
        {fallasIdentificadas && (
          <div style={{ background: "#eff6ff", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#1e40af", fontWeight: 600, whiteSpace: "pre-wrap" }}>
            {fallasIdentificadas}
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
            {inspeccionMecanica
              ? <p style={{ margin: 0, fontSize: 12, color: "#333", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{inspeccionMecanica}</p>
              : <SinDatos />}
          </Card>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 8 }}>⚡ Inspección Eléctrica</div>
            {inspeccionElectrica
              ? <p style={{ margin: 0, fontSize: 12, color: "#333", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{inspeccionElectrica}</p>
              : <SinDatos />}
          </Card>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 8 }}>💻 Escáner / Electrónica</div>
            {inspeccionElectronica
              ? <p style={{ margin: 0, fontSize: 12, color: "#333", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{inspeccionElectronica}</p>
              : <SinDatos />}
          </Card>
        </div>

        {codigosFalla && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "14px 18px", marginTop: 14 }}>
            <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 8, fontSize: 13 }}>⚠️ Códigos de Falla</div>
            <div style={{ fontSize: 13 }}>{codigosFalla}</div>
          </div>
        )}

        {observacionesDiag && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#888", marginBottom: 6 }}>OBSERVACIONES DEL TÉCNICO</div>
            <p style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 16px", margin: 0, fontSize: 13, color: "#555", whiteSpace: "pre-wrap" }}>
              {observacionesDiag}
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
              <Card bg={resultadoQC === "APROBADO" ? "#f0fdf4" : resultadoQC === "RECHAZADO" ? "#fef2f2" : "#f8fafc"}
                    border={resultadoQC === "APROBADO" ? "#bbf7d0" : resultadoQC === "RECHAZADO" ? "#fecaca" : "#e5e7eb"}>
                {resultadoQC && (
                  <div style={{ marginBottom: 10 }}>
                    <Badge texto={resultadoQC} color={resultadoQC === "APROBADO" ? "#10b981" : "#ef4444"} />
                  </div>
                )}
                {observacionesQC && <Fila label="Observaciones" valor={observacionesQC} />}
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
