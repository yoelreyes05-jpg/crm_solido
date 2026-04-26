"use client";
import { useEffect, useState, useMemo } from "react";
import { API_URL as API } from "@/config";

// ─── DATOS EMPRESA (mismo que FacturaPage) ─────────────────────────────────
const EMPRESA = {
  nombre: "SÓLIDO AUTO SERVICIO SRL",
  telefono: "809-712-2027",
  rnc: "1-32-XXXXX-X",
  direccion: "Santo Domingo, República Dominicana",
  email: "info@solidoauto.com",
  logo: "/logo.png"
};

// ─── REIMPRIMIR (replica de FacturaPage para no depender de imports) ────────
function abrirImpresion(html: string) {
  const prev = document.getElementById("__print_iframe__");
  if (prev) prev.remove();
  const iframe = document.createElement("iframe");
  iframe.id = "__print_iframe__";
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:820px;height:1000px;border:none;opacity:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || (iframe.contentWindow as any)?.document;
  if (!doc) { const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); } return; }
  doc.open(); doc.write(html); doc.close();
  iframe.onload = () => {
    try { (iframe.contentWindow as any)?.focus(); (iframe.contentWindow as any)?.print(); }
    catch { const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); } }
  };
}

function generarHTMLReimpresion(fac: any, items: any[]) {
  const subtotal = Number(fac.subtotal || 0);
  const itbis    = Number(fac.itbis    || 0);
  const total    = Number(fac.total    || 0);
  const fecha = new Date(fac.created_at || Date.now()).toLocaleString("es-DO", { day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit" });
  const ncfVence = (() => { const d = new Date(fac.created_at || Date.now()); d.setFullYear(d.getFullYear()+2); return d.toLocaleDateString("es-DO"); })();
  const lineas = items.map((p:any) => {
    const cant = Number(p.cantidad ?? 1);
    const precio = Number(p.precio_unitario ?? p.price ?? 0);
    return `<tr><td style="padding:9px 8px;border-bottom:1px solid #eee;"><div style="font-weight:600;">${p.descripcion ?? p.name ?? ""}</div>${p.tipo ? `<div style="font-size:11px;color:#888;">${String(p.tipo).replace("_"," ")}</div>` : ""}</td><td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:center;">${cant}</td><td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;">RD$ ${precio.toFixed(2)}</td><td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:center;">${p.itbis_aplica?"18%":"—"}</td><td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;">RD$ ${(cant*precio).toFixed(2)}</td></tr>`;
  }).join("");
  const etiquetaCliente = fac.ncf_tipo && ["B01","B14","B15"].includes(fac.ncf_tipo) ? "Comprobante Fiscal" : "Cliente";
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Factura ${fac.ncf||""}</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:30px;max-width:780px;margin:auto;}.cabecera{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111;padding-bottom:18px;margin-bottom:20px;gap:24px;}.empresa-nombre{font-size:18px;font-weight:900;letter-spacing:.5px;text-transform:uppercase;}.empresa-meta{font-size:12px;color:#555;margin-top:6px;line-height:1.8;}.cab-doc{flex:1;text-align:right;border-left:2px solid #f0f0f0;padding-left:20px;}.doc-tipo{font-size:22px;font-weight:900;}.doc-num{font-size:14px;color:#444;font-weight:600;}.doc-meta{font-size:12px;color:#666;margin-top:4px;line-height:1.7;}.doc-badge{display:inline-block;background:#111;color:#fff;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;margin-top:6px;}.ncf-box{background:#1a1a2e;color:#fff;display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-radius:8px;margin:18px 0;}.ncf-num{font-size:22px;font-weight:900;letter-spacing:4px;}.ncf-right{text-align:right;font-size:12px;color:rgba(255,255,255,.65);line-height:1.8;}.dos-col{display:flex;gap:14px;margin-bottom:20px;}.info-box{flex:1;background:#f8f8f8;border-radius:8px;padding:14px 16px;border:1px solid #ebebeb;}.info-box h3{font-size:10px;text-transform:uppercase;color:#888;margin-bottom:8px;letter-spacing:1px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;}table{width:100%;border-collapse:collapse;margin-bottom:16px;}thead th{background:#111;color:#fff;padding:10px 8px;font-size:12px;text-align:left;}.totales{margin-left:auto;width:300px;}.t-row{display:flex;justify-content:space-between;padding:7px 0;font-size:14px;border-bottom:1px solid #eee;}.t-total{font-size:20px;font-weight:900;border-top:3px solid #111;border-bottom:none;padding-top:12px;margin-top:6px;}.footer{text-align:center;margin-top:30px;padding-top:16px;border-top:1px dashed #ccc;color:#777;font-size:12px;line-height:2;}.btn-imprimir{display:block;margin:16px auto 0;padding:12px 32px;background:#111;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;}@media print{.btn-imprimir{display:none!important;}}</style></head><body>
  <div class="cabecera"><div><img src="${EMPRESA.logo}" style="height:56px;margin-bottom:8px;" onerror="this.style.display='none'"/><div class="empresa-nombre">${EMPRESA.nombre}</div><div class="empresa-meta"><strong>RNC:</strong> ${EMPRESA.rnc}<br/><strong>Tel:</strong> ${EMPRESA.telefono}<br/>${EMPRESA.direccion}<br/>${EMPRESA.email}</div></div><div class="cab-doc"><div class="doc-tipo">Factura</div><div class="doc-num">FAC-${String(fac.id).padStart(5,"0")}</div><div class="doc-meta"><strong>Fecha:</strong> ${fecha}<br/><strong>Vence NCF:</strong> ${ncfVence}<br/><strong>Método:</strong> ${fac.metodo_pago||"EFECTIVO"}<br/><strong>Tipo NCF:</strong> ${fac.ncf_tipo||"B02"}</div><div class="doc-badge">${fac.ncf_tipo||"B02"}</div></div></div>
  <div class="ncf-box"><div><div style="font-size:10px;letter-spacing:1.5px;opacity:.55;text-transform:uppercase;margin-bottom:3px;">Número de Comprobante Fiscal (NCF)</div><div class="ncf-num">${fac.ncf||"—"}</div></div><div class="ncf-right">Tipo: ${fac.ncf_tipo||"B02"}<br/>Vencimiento: ${ncfVence}<br/>${fac.estado==="CANCELADA"?"⚠️ CANCELADA":"✓ Vigente"}</div></div>
  <div class="dos-col"><div class="info-box"><h3>${etiquetaCliente}</h3><p><strong>${fac.cliente_nombre||"Consumidor Final"}</strong></p>${fac.cliente_rnc?`<p>RNC/Cédula: ${fac.cliente_rnc}</p>`:""}</div><div class="info-box"><h3>Vehículo</h3>${fac.vehiculo_info?`<p>🚗 ${fac.vehiculo_info}`:"<p style='color:#888'>Sin vehículo asociado</p>"}</div></div>
  <table><thead><tr><th>Descripción</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">Precio Unit.</th><th style="text-align:center;">ITBIS</th><th style="text-align:right;">Total</th></tr></thead><tbody>${lineas}</tbody></table>
  <div class="totales"><div class="t-row"><span>Subtotal:</span><span>RD$ ${subtotal.toFixed(2)}</span></div><div class="t-row"><span>ITBIS (18%):</span><span>RD$ ${itbis.toFixed(2)}</span></div><div class="t-row t-total"><span>TOTAL:</span><span>RD$ ${total.toFixed(2)}</span></div></div>
  <button class="btn-imprimir" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
  <div class="footer"><p>¡Gracias por confiar en <strong>${EMPRESA.nombre}</strong>! · ${EMPRESA.telefono}</p><p style="font-size:10.5px;color:#aaa;margin-top:3px;">Documento fiscal emitido conforme a la Norma General 06-2018 de la DGII — República Dominicana</p><p style="font-size:10.5px;color:#aaa;">Valide este comprobante en: <strong>www.dgii.gov.do</strong></p></div>
  <script>document.addEventListener("DOMContentLoaded",function(){setTimeout(function(){window.print();},800);});<\/script>
  </body></html>`;
}

// ─── EXPORTAR CSV para DGII / contabilidad ─────────────────────────────────
function exportarCSV(ventas: any[]) {
  const headers = ["Factura","NCF","Tipo NCF","Cliente","RNC Cliente","Método Pago","Subtotal","ITBIS","Total","Estado","Fecha"];
  const rows = ventas.map(v => [
    `FAC-${String(v.id).padStart(5,"0")}`,
    v.ncf || "",
    v.ncf_tipo || "",
    v.cliente_nombre || "Consumidor Final",
    v.cliente_rnc || "",
    v.metodo_pago || "",
    Number(v.subtotal).toFixed(2),
    Number(v.itbis).toFixed(2),
    Number(v.total).toFixed(2),
    v.estado || "ACTIVA",
    v.created_at ? new Date(v.created_at).toLocaleString("es-DO") : ""
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `ventas_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ─── MINI SPARKLINE SVG ────────────────────────────────────────────────────
function Sparkline({ data, color = "#10b981" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 120, h = 36;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(data.length - 1) / (data.length - 1) * w} cy={h - (data[data.length - 1] / max) * h} r={3} fill={color} />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
type Factura = {
  id: number; ncf: string; ncf_tipo: string;
  cliente_nombre: string; cliente_rnc: string;
  metodo_pago: string; subtotal: number; itbis: number; total: number;
  estado: string; created_at: string; vehiculo_info?: string;
};

export default function VentasPage() {
  const [facturas, setFacturas]       = useState<Factura[]>([]);
  const [loading, setLoading]         = useState(true);
  const [busqueda, setBusqueda]       = useState("");
  const [fechaDesde, setFechaDesde]   = useState("");
  const [fechaHasta, setFechaHasta]   = useState("");
  const [metodoFiltro, setMetodoFiltro] = useState("");
  const [ncfFiltro, setNcfFiltro]     = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("ACTIVA");
  const [vistaActiva, setVistaActiva] = useState<"tabla"|"resumen">("tabla");
  const [reimprimiendo, setReimprimiendo] = useState<number | null>(null);

  // ── Fetch: usa /facturas (mismo endpoint que FacturaPage) ─────────────────
  const fetchFacturas = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/facturas`);
      const data = await res.json();
      setFacturas(Array.isArray(data) ? data : []);
    } catch (err) { console.error("Error cargando facturas:", err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchFacturas(); }, []);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    return facturas.filter(v => {
      const q = busqueda.toLowerCase();
      const matchQ = !busqueda ||
        v.cliente_nombre?.toLowerCase().includes(q) ||
        v.ncf?.toLowerCase().includes(q) ||
        v.cliente_rnc?.includes(busqueda);
      const fecha = new Date(v.created_at);
      const matchDesde = !fechaDesde || fecha >= new Date(fechaDesde);
      const matchHasta = !fechaHasta || fecha <= new Date(fechaHasta + "T23:59:59");
      const matchMetodo = !metodoFiltro || v.metodo_pago === metodoFiltro;
      const matchNcf = !ncfFiltro || v.ncf_tipo === ncfFiltro;
      const matchEstado = !estadoFiltro || v.estado === estadoFiltro;
      return matchQ && matchDesde && matchHasta && matchMetodo && matchNcf && matchEstado;
    });
  }, [facturas, busqueda, fechaDesde, fechaHasta, metodoFiltro, ncfFiltro, estadoFiltro]);

  // ── KPIs sobre TODO el historial (no filtrado) ────────────────────────────
  const activas     = facturas.filter(f => f.estado !== "CANCELADA");
  const totalGlobal = activas.reduce((a, v) => a + Number(v.total), 0);
  const itbisGlobal = activas.reduce((a, v) => a + Number(v.itbis), 0);

  // ── KPIs del período filtrado ─────────────────────────────────────────────
  const filtradasActivas = filtradas.filter(f => f.estado !== "CANCELADA");
  const totalFiltrado    = filtradasActivas.reduce((a, v) => a + Number(v.total), 0);
  const itbisFiltrado    = filtradasActivas.reduce((a, v) => a + Number(v.itbis), 0);
  const subtotalFiltrado = filtradasActivas.reduce((a, v) => a + Number(v.subtotal), 0);

  // ── Ventas por día (últimos 14 días) para sparkline ───────────────────────
  const ventasPorDia = useMemo(() => {
    const mapa: Record<string, number> = {};
    const hoy = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(hoy); d.setDate(hoy.getDate() - i);
      mapa[d.toISOString().slice(0, 10)] = 0;
    }
    activas.forEach(v => {
      const dia = v.created_at?.slice(0, 10);
      if (dia && dia in mapa) mapa[dia] += Number(v.total);
    });
    return Object.values(mapa);
  }, [facturas]);

  // ── Desglose por tipo NCF ─────────────────────────────────────────────────
  const porNcf = useMemo(() => {
    const mapa: Record<string, { count: number; total: number; itbis: number }> = {};
    filtradasActivas.forEach(v => {
      const t = v.ncf_tipo || "S/N";
      if (!mapa[t]) mapa[t] = { count: 0, total: 0, itbis: 0 };
      mapa[t].count++;
      mapa[t].total += Number(v.total);
      mapa[t].itbis += Number(v.itbis);
    });
    return Object.entries(mapa).sort((a, b) => b[1].total - a[1].total);
  }, [filtradasActivas]);

  // ── Desglose por método de pago ───────────────────────────────────────────
  const porMetodo = useMemo(() => {
    const mapa: Record<string, { count: number; total: number }> = {};
    filtradasActivas.forEach(v => {
      const m = v.metodo_pago || "OTROS";
      if (!mapa[m]) mapa[m] = { count: 0, total: 0 };
      mapa[m].count++;
      mapa[m].total += Number(v.total);
    });
    return Object.entries(mapa).sort((a, b) => b[1].total - a[1].total);
  }, [filtradasActivas]);

  // ── Top 5 clientes ────────────────────────────────────────────────────────
  const topClientes = useMemo(() => {
    const mapa: Record<string, { count: number; total: number; rnc: string }> = {};
    filtradasActivas.forEach(v => {
      const k = v.cliente_nombre || "Consumidor Final";
      if (!mapa[k]) mapa[k] = { count: 0, total: 0, rnc: v.cliente_rnc || "" };
      mapa[k].count++;
      mapa[k].total += Number(v.total);
    });
    return Object.entries(mapa).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  }, [filtradasActivas]);

  // ── Reimprimir factura ────────────────────────────────────────────────────
  const reimprimir = async (fac: Factura) => {
    setReimprimiendo(fac.id);
    try {
      const res  = await fetch(`${API}/facturas/${fac.id}/items`);
      const data = await res.json();
      abrirImpresion(generarHTMLReimpresion(fac, data.items || []));
    } catch { alert("Error al cargar los ítems de la factura"); }
    finally { setReimprimiendo(null); }
  };

  // ── Limpiar filtros ───────────────────────────────────────────────────────
  const limpiarFiltros = () => {
    setBusqueda(""); setFechaDesde(""); setFechaHasta("");
    setMetodoFiltro(""); setNcfFiltro(""); setEstadoFiltro("ACTIVA");
  };

  const hayFiltros = busqueda || fechaDesde || fechaHasta || metodoFiltro || ncfFiltro || estadoFiltro !== "ACTIVA";

  // ── Ingresos de Hoy ──────────────────────────────────────────────────────
  const hoyStr = new Date().toISOString().slice(0, 10);
  const facturasHoy = activas.filter(f => f.created_at?.slice(0, 10) === hoyStr);
  const ingresoHoy  = facturasHoy.reduce((a, f) => a + Number(f.total), 0);
  const porMetodoHoy = facturasHoy.reduce((acc: Record<string, number>, f) => {
    const m = f.metodo_pago || "OTROS";
    acc[m] = (acc[m] || 0) + Number(f.total);
    return acc;
  }, {});

  // ── NCF color badge ───────────────────────────────────────────────────────
  const ncfColor: Record<string, { bg: string; color: string }> = {
    B01: { bg: "#dbeafe", color: "#1e40af" },
    B02: { bg: "#dcfce7", color: "#166534" },
    B14: { bg: "#fef3c7", color: "#92400e" },
    B15: { bg: "#f3e8ff", color: "#6b21a8" },
  };

  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div style={sc.container}>

      {/* ── ENCABEZADO ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={sc.title}>💰 Ventas & Reportes</h1>
          <p style={{ color: "#6b7280", fontSize: 14, marginTop: 2 }}>
            {activas.length} facturas activas · Actualizado ahora
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setVistaActiva("tabla")}
            style={{ ...sc.tabBtn, background: vistaActiva === "tabla" ? "#111827" : "#fff", color: vistaActiva === "tabla" ? "#fff" : "#111" }}>
            📋 Tabla
          </button>
          <button onClick={() => setVistaActiva("resumen")}
            style={{ ...sc.tabBtn, background: vistaActiva === "resumen" ? "#111827" : "#fff", color: vistaActiva === "resumen" ? "#fff" : "#111" }}>
            📊 Resumen
          </button>
          <button onClick={() => exportarCSV(filtradas)}
            style={{ ...sc.tabBtn, background: "#10b981", color: "#fff", border: "none" }}>
            ⬇️ CSV
          </button>
          <button onClick={fetchFacturas}
            style={{ ...sc.tabBtn, background: "#f1f5f9", color: "#111" }}>
            🔄
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ─────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
        <div style={sc.kpiCard}>
          <div style={sc.kpiLabel}>Total facturado</div>
          <div style={sc.kpiNum}>RD$ {totalGlobal.toLocaleString("es-DO",{minimumFractionDigits:2})}</div>
          <div style={{ marginTop: 8 }}><Sparkline data={ventasPorDia} color="#10b981" /></div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{activas.length} facturas</div>
        </div>
        <div style={{ ...sc.kpiCard, borderLeftColor: "#3b82f6" }}>
          <div style={sc.kpiLabel}>ITBIS declarable</div>
          <div style={{ ...sc.kpiNum, color: "#1d4ed8" }}>RD$ {itbisGlobal.toLocaleString("es-DO",{minimumFractionDigits:2})}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 12 }}>18% acumulado</div>
        </div>
        <div style={{ ...sc.kpiCard, borderLeftColor: "#8b5cf6" }}>
          <div style={sc.kpiLabel}>Período seleccionado</div>
          <div style={{ ...sc.kpiNum, color: "#7c3aed" }}>RD$ {totalFiltrado.toLocaleString("es-DO",{minimumFractionDigits:2})}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 12 }}>{filtradasActivas.length} registros · ITBIS RD$ {itbisFiltrado.toFixed(2)}</div>
        </div>
        <div style={{ ...sc.kpiCard, borderLeftColor: "#f59e0b" }}>
          <div style={sc.kpiLabel}>Canceladas</div>
          <div style={{ ...sc.kpiNum, color: "#d97706" }}>{facturas.filter(f => f.estado === "CANCELADA").length}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 12 }}>de {facturas.length} totales</div>
        </div>
      </div>

      {/* ── INGRESOS DE HOY ──────────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",
        borderRadius: 16, padding: "20px 24px", marginBottom: 24,
        display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)"
      }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            💵 Ingresos de Hoy
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, color: "#10b981", lineHeight: 1 }}>
            RD$ {ingresoHoy.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
            {facturasHoy.length} factura{facturasHoy.length !== 1 ? "s" : ""} · {hoyStr}
          </div>
        </div>
        {Object.entries(porMetodoHoy).map(([metodo, total]) => {
          const colors: Record<string, string> = { EFECTIVO: "#10b981", TARJETA: "#3b82f6", TRANSFERENCIA: "#8b5cf6", CHEQUE: "#f59e0b" };
          const color = colors[metodo] || "#6b7280";
          return (
            <div key={metodo} style={{
              background: "rgba(255,255,255,0.07)", borderRadius: 12,
              padding: "12px 18px", border: `1px solid ${color}44`, minWidth: 130
            }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4, fontWeight: 600 }}>{metodo}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color }}>{(total as number).toLocaleString("es-DO", { minimumFractionDigits: 2 })}</div>
            </div>
          );
        })}
        {facturasHoy.length === 0 && (
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, fontStyle: "italic" }}>
            Sin facturas registradas hoy
          </div>
        )}
      </div>

      {/* ── FILTROS ───────────────────────────────────────────────────────── */}
      <div style={sc.filtrosBox}>
        <div style={{ flex: 2, minWidth: 200 }}>
          <label style={sc.label}>🔍 Buscar</label>
          <input placeholder="Cliente, NCF o RNC..." value={busqueda}
            onChange={e => setBusqueda(e.target.value)} style={sc.input} />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={sc.label}>📅 Desde</label>
          <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={sc.input} />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={sc.label}>📅 Hasta</label>
          <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={sc.input} />
        </div>
        <div style={{ flex: 1, minWidth: 130 }}>
          <label style={sc.label}>💳 Método</label>
          <select value={metodoFiltro} onChange={e => setMetodoFiltro(e.target.value)} style={sc.input}>
            <option value="">Todos</option>
            <option value="EFECTIVO">Efectivo</option>
            <option value="TARJETA">Tarjeta</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="CHEQUE">Cheque</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={sc.label}>🧾 NCF</label>
          <select value={ncfFiltro} onChange={e => setNcfFiltro(e.target.value)} style={sc.input}>
            <option value="">Todos</option>
            <option value="B01">B01 — Crédito Fiscal</option>
            <option value="B02">B02 — Consumidor Final</option>
            <option value="B14">B14 — Régimen Especial</option>
            <option value="B15">B15 — Gubernamental</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={sc.label}>📌 Estado</label>
          <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)} style={sc.input}>
            <option value="">Todos</option>
            <option value="ACTIVA">Solo activas</option>
            <option value="CANCELADA">Solo canceladas</option>
          </select>
        </div>
        {hayFiltros && (
          <button onClick={limpiarFiltros}
            style={{ alignSelf: "flex-end", padding: "12px 16px", background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* ── BANNER RESUMEN FILTRADO ───────────────────────────────────────── */}
      {hayFiltros && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "12px 18px", marginBottom: 16, display: "flex", gap: 24, fontSize: 14, flexWrap: "wrap" }}>
          <span>📊 <b>{filtradasActivas.length}</b> ventas activas en el período</span>
          <span>💰 Subtotal: <b>RD$ {subtotalFiltrado.toFixed(2)}</b></span>
          <span>🧾 ITBIS: <b>RD$ {itbisFiltrado.toFixed(2)}</b></span>
          <span style={{ fontWeight: 800, color: "#1d4ed8" }}>TOTAL: RD$ {totalFiltrado.toFixed(2)}</span>
        </div>
      )}

      {/* ══════ VISTA TABLA ══════════════════════════════════════════════════ */}
      {vistaActiva === "tabla" && (
        <div style={sc.card}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#111827" }}>
                  {["Factura","NCF","Tipo","Cliente","RNC","Método","Subtotal","ITBIS","Total","Estado","Fecha",""].map(h => (
                    <th key={h} style={{ padding: "13px 14px", textAlign: "left", fontSize: 13, color: "#fff", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12} style={{ padding: 40, textAlign: "center", color: "#aaa" }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>Cargando facturas...
                  </td></tr>
                ) : filtradas.length === 0 ? (
                  <tr><td colSpan={12} style={{ padding: 48, textAlign: "center", color: "#aaa" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>Sin resultados para este filtro
                  </td></tr>
                ) : filtradas.map((v, i) => {
                  const cancelada = v.estado === "CANCELADA";
                  const badge = ncfColor[v.ncf_tipo] || { bg: "#f1f5f9", color: "#374151" };
                  return (
                    <tr key={v.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb", opacity: cancelada ? 0.55 : 1, borderBottom: "1px solid #f0f0f0" }}>
                      <td style={sc.td}><b style={{ fontFamily: "monospace" }}>FAC-{String(v.id).padStart(5,"0")}</b></td>
                      <td style={{ ...sc.td, fontSize: 11, fontFamily: "monospace", color: "#6b7280" }}>{v.ncf}</td>
                      <td style={sc.td}>
                        <span style={{ background: badge.bg, color: badge.color, padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{v.ncf_tipo}</span>
                      </td>
                      <td style={{ ...sc.td, fontWeight: 600, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.cliente_nombre || "Consumidor Final"}</td>
                      <td style={{ ...sc.td, fontSize: 12, color: "#6b7280" }}>{v.cliente_rnc || "—"}</td>
                      <td style={sc.td}>
                        <span style={{ fontSize: 12 }}>
                          {v.metodo_pago === "EFECTIVO" ? "💵" : v.metodo_pago === "TARJETA" ? "💳" : v.metodo_pago === "TRANSFERENCIA" ? "🏦" : "📄"} {v.metodo_pago}
                        </span>
                      </td>
                      <td style={{ ...sc.td, color: "#374151" }}>RD$ {Number(v.subtotal).toFixed(2)}</td>
                      <td style={{ ...sc.td, color: "#1d4ed8" }}>RD$ {Number(v.itbis).toFixed(2)}</td>
                      <td style={{ ...sc.td, fontWeight: 800, color: cancelada ? "#9ca3af" : "#059669" }}>RD$ {Number(v.total).toFixed(2)}</td>
                      <td style={sc.td}>
                        {cancelada
                          ? <span style={{ background: "#fee2e2", color: "#dc2626", padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>CANCELADA</span>
                          : <span style={{ background: "#dcfce7", color: "#166534", padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>ACTIVA</span>}
                      </td>
                      <td style={{ ...sc.td, fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>
                        {v.created_at ? new Date(v.created_at).toLocaleString("es-DO") : "—"}
                      </td>
                      <td style={sc.td}>
                        <button onClick={() => reimprimir(v)}
                          disabled={reimprimiendo === v.id}
                          title="Reimprimir factura"
                          style={{ padding: "5px 10px", background: reimprimiendo === v.id ? "#f1f5f9" : "#111827", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, opacity: reimprimiendo === v.id ? 0.6 : 1 }}>
                          {reimprimiendo === v.id ? "⏳" : "🖨️"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* FOOTER TABLA */}
          {filtradas.length > 0 && (
            <div style={{ background: "#111827", borderRadius: "0 0 12px 12px", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff", flexWrap: "wrap", gap: 12 }}>
              <span style={{ fontSize: 13, color: "#9ca3af" }}>{filtradas.length} registros · {filtradasActivas.length} activas</span>
              <div style={{ display: "flex", gap: 24, fontSize: 14 }}>
                <span>Subtotal: <b>RD$ {subtotalFiltrado.toLocaleString("es-DO",{minimumFractionDigits:2})}</b></span>
                <span>ITBIS: <b style={{ color: "#93c5fd" }}>RD$ {itbisFiltrado.toLocaleString("es-DO",{minimumFractionDigits:2})}</b></span>
                <span style={{ fontSize: 16, fontWeight: 900 }}>TOTAL: RD$ {totalFiltrado.toLocaleString("es-DO",{minimumFractionDigits:2})}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════ VISTA RESUMEN / ANALÍTICA ════════════════════════════════════ */}
      {vistaActiva === "resumen" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* DESGLOSE POR TIPO NCF */}
          <div style={sc.card}>
            <h3 style={sc.cardTitle}>🧾 Desglose por Tipo NCF</h3>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
              Para declaración DGII — período filtrado
            </p>
            {porNcf.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic" }}>Sin datos</p>
            ) : porNcf.map(([tipo, d]) => {
              const badge = ncfColor[tipo] || { bg: "#f1f5f9", color: "#374151" };
              const pct = totalFiltrado > 0 ? (d.total / totalFiltrado) * 100 : 0;
              return (
                <div key={tipo} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ background: badge.bg, color: badge.color, padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{tipo}</span>
                      <span style={{ fontSize: 13, color: "#374151" }}>{d.count} facturas</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>RD$ {d.total.toLocaleString("es-DO",{minimumFractionDigits:2})}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>ITBIS: RD$ {d.itbis.toLocaleString("es-DO",{minimumFractionDigits:2})}</div>
                    </div>
                  </div>
                  <div style={{ background: "#f1f5f9", borderRadius: 4, height: 6, overflow: "hidden" }}>
                    <div style={{ background: badge.color, height: "100%", width: `${pct}%`, borderRadius: 4, transition: "width 0.5s" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESGLOSE POR MÉTODO DE PAGO */}
          <div style={sc.card}>
            <h3 style={sc.cardTitle}>💳 Métodos de Pago</h3>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
              Distribución del período filtrado
            </p>
            {porMetodo.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic" }}>Sin datos</p>
            ) : porMetodo.map(([met, d]) => {
              const pct = totalFiltrado > 0 ? (d.total / totalFiltrado) * 100 : 0;
              const iconos: Record<string,string> = { EFECTIVO:"💵", TARJETA:"💳", TRANSFERENCIA:"🏦", CHEQUE:"📄" };
              const colores: Record<string,string> = { EFECTIVO:"#10b981", TARJETA:"#3b82f6", TRANSFERENCIA:"#8b5cf6", CHEQUE:"#f59e0b" };
              const c = colores[met] || "#6b7280";
              return (
                <div key={met} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{iconos[met] || "💰"} {met}</span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700 }}>RD$ {d.total.toLocaleString("es-DO",{minimumFractionDigits:2})}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>{d.count} facturas · {pct.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div style={{ background: "#f1f5f9", borderRadius: 4, height: 8, overflow: "hidden" }}>
                    <div style={{ background: c, height: "100%", width: `${pct}%`, borderRadius: 4, transition: "width 0.5s" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* TOP CLIENTES */}
          <div style={sc.card}>
            <h3 style={sc.cardTitle}>🏆 Top Clientes del Período</h3>
            {topClientes.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic" }}>Sin datos</p>
            ) : topClientes.map(([nombre, d], i) => (
              <div key={nombre} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < topClientes.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: ["#111827","#1d4ed8","#7c3aed","#b45309","#047857"][i], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14 }}>
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{nombre}</div>
                    {d.rnc && <div style={{ fontSize: 11, color: "#6b7280" }}>RNC: {d.rnc}</div>}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#059669" }}>RD$ {d.total.toLocaleString("es-DO",{minimumFractionDigits:2})}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{d.count} facturas</div>
                </div>
              </div>
            ))}
          </div>

          {/* RESUMEN DGII */}
          <div style={{ ...sc.card, background: "#1a1a2e", color: "#fff" }}>
            <h3 style={{ ...sc.cardTitle, color: "#e2e8f0", marginBottom: 6 }}>📑 Resumen DGII</h3>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 20 }}>
              Período filtrado — exportable a CSV para IT-1
            </p>
            {[
              { label: "Ventas B02 (Consumidor Final)", val: porNcf.find(([t])=>t==="B02")?.[1].total || 0, color: "#4ade80" },
              { label: "Ventas B01 (Crédito Fiscal)",   val: porNcf.find(([t])=>t==="B01")?.[1].total || 0, color: "#60a5fa" },
              { label: "Ventas B14 (Régimen Especial)", val: porNcf.find(([t])=>t==="B14")?.[1].total || 0, color: "#fbbf24" },
              { label: "Ventas B15 (Gubernamental)",    val: porNcf.find(([t])=>t==="B15")?.[1].total || 0, color: "#c084fc" },
              { label: "ITBIS cobrado total",           val: itbisFiltrado,                                  color: "#f87171" },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.08)", fontSize: 13 }}>
                <span style={{ color: "rgba(255,255,255,0.6)" }}>{row.label}</span>
                <span style={{ fontWeight: 700, color: row.color }}>
                  RD$ {row.val.toLocaleString("es-DO",{minimumFractionDigits:2})}
                </span>
              </div>
            ))}
            <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 900, paddingTop: 10, borderTop: "2px solid rgba(255,255,255,0.2)" }}>
              <span style={{ color: "rgba(255,255,255,0.7)" }}>Total Ingresos</span>
              <span style={{ color: "#4ade80" }}>RD$ {totalFiltrado.toLocaleString("es-DO",{minimumFractionDigits:2})}</span>
            </div>
            <button onClick={() => exportarCSV(filtradasActivas)}
              style={{ marginTop: 16, width: "100%", padding: "12px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
              ⬇️ Exportar para DGII (CSV)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ESTILOS ───────────────────────────────────────────────────────────────
const sc = {
  container: { padding: 24, background: "#f5f7fb", minHeight: "100vh" } as React.CSSProperties,
  title:     { fontSize: 26, fontWeight: 900, marginBottom: 2 } as React.CSSProperties,
  card:      { background: "#fff", borderRadius: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.07)", overflow: "hidden", marginBottom: 0 } as React.CSSProperties,
  cardTitle: { fontSize: 16, fontWeight: 700, marginBottom: 4 } as React.CSSProperties,
  kpiCard:   { background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", borderLeft: "5px solid #10b981" } as React.CSSProperties,
  kpiLabel:  { fontSize: 12, color: "#6b7280", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  kpiNum:    { fontSize: 22, fontWeight: 900, color: "#111" } as React.CSSProperties,
  tabBtn:    { padding: "9px 18px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", fontWeight: 600, fontSize: 13 } as React.CSSProperties,
  label:     { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#555" } as React.CSSProperties,
  input:     { display: "block", padding: "11px 12px", width: "100%", borderRadius: 8, border: "1px solid #ddd", boxSizing: "border-box" as const, fontSize: 14, marginBottom: 0 },
  filtrosBox:{ background: "#fff", borderRadius: 14, padding: "16px 20px", marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" as const },
  td:        { padding: "12px 14px", fontSize: 13 } as React.CSSProperties,
};
