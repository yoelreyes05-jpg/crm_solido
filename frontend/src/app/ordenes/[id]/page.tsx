"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL as API } from "@/config";

// ── Config estados ────────────────────────────────────────────────────────────
const EST: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  RECIBIDO:             { color:"#1d4ed8", bg:"#dbeafe",  icon:"📥", label:"Recibido" },
  DIAGNOSTICO:          { color:"#92400e", bg:"#fef3c7",  icon:"🔬", label:"Diagnóstico" },
  ESPERANDO_APROBACION: { color:"#c2410c", bg:"#ffedd5",  icon:"⏳", label:"Esp. Aprobación" },
  REPARACION:           { color:"#991b1b", bg:"#fee2e2",  icon:"🔧", label:"En Reparación" },
  CONTROL_CALIDAD:      { color:"#5b21b6", bg:"#ede9fe",  icon:"✅", label:"Control Calidad" },
  LISTO:                { color:"#065f46", bg:"#d1fae5",  icon:"🎉", label:"Listo para Entrega" },
  ENTREGADO:            { color:"#374151", bg:"#f3f4f6",  icon:"🏁", label:"Entregado" },
  CANCELADA:            { color:"#7f1d1d", bg:"#fee2e2",  icon:"❌", label:"Cancelada" },
};

const ESTADO_LABEL: Record<string, string> = {
  RECIBIDO:"Recibido", DIAGNOSTICO:"Diagnóstico",
  ESPERANDO_APROBACION:"Esperando Aprobación", REPARACION:"En Reparación",
  CONTROL_CALIDAD:"Control de Calidad", LISTO:"Listo para Entrega",
  ENTREGADO:"Entregado", CANCELADA:"Cancelada",
};

// ── Imprimir diagnóstico / cotización ─────────────────────────────────────────
function imprimirDiagnostico(orden: any, cliente: any, vehiculo: any, diag: any) {
  const manoObra  = Number(diag.mano_obra  || 0);
  const repuestos = Number(diag.repuestos  || 0);
  const total     = manoObra + repuestos;
  const detalleLineas = (diag.mano_de_obra_detalle || diag.detalle || "")
    .split("\n").filter((l: string) => l.trim())
    .map((l: string) => `<tr><td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px">✔ ${l.trim()}</td><td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-size:14px">—</td></tr>`)
    .join("") || `<tr><td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px">Servicios Profesionales de Mano de Obra</td><td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-size:14px">RD$ ${manoObra.toLocaleString("es-DO",{minimumFractionDigits:2})}</td></tr>`;
  const numeroOrden = orden.numero_orden || `OT-${String(orden.id).padStart(4,"0")}`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Diagnóstico ${numeroOrden}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;color:#1a1a1a;line-height:1.6;max-width:760px;margin:auto}.header{text-align:center;border-bottom:3px solid #111;padding-bottom:20px;margin-bottom:25px}.logo{font-size:26px;font-weight:900}.sub{font-size:13px;color:#555;margin-top:6px}.titulo-doc{text-align:center;font-size:18px;font-weight:700;margin:20px 0;letter-spacing:1px;color:#1e40af;text-transform:uppercase;border:2px solid #1e40af;padding:8px;border-radius:8px}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}.info-box{border:1px solid #e2e8f0;padding:14px;border-radius:8px;background:#f8fafc}.box-title{font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e2e8f0;letter-spacing:1px}.info-row{font-size:13px;margin-bottom:4px}.sec-titulo{font-size:12px;font-weight:700;text-transform:uppercase;color:#475569;background:#f1f5f9;padding:6px 10px;border-radius:6px;margin:12px 0 6px;border-left:3px solid #334155}.sec-texto{font-size:13px;padding:10px 14px;background:#fff;border:1px solid #e2e8f0;border-radius:6px;white-space:pre-wrap}table{width:100%;border-collapse:collapse;margin-bottom:16px}thead th{background:#111827;color:#fff;padding:12px;text-align:left;font-size:13px}.total-row{background:#1e40af;color:#fff}.total-row td{padding:14px 12px;font-size:18px;font-weight:900}.firma-area{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px}.firma-linea{border-top:1px solid #111;padding-top:8px;text-align:center;font-size:12px;color:#64748b}.footer{text-align:center;margin-top:40px;padding-top:16px;border-top:1px dashed #cbd5e1;color:#94a3b8;font-size:11px;line-height:2}@media print{body{padding:20px}}</style>
  </head><body>
  <div class="header"><div class="logo">🔧 SÓLIDO AUTO SERVICIO</div><div class="sub">Expertos en Mecánica &amp; Detallado | Tel: 809-712-2027<br>Santo Domingo, República Dominicana</div></div>
  <div class="titulo-doc">Informe de Diagnóstico Técnico — ${numeroOrden}</div>
  <div class="info-grid">
    <div class="info-box"><div class="box-title">👤 Cliente y Vehículo</div>
      <div class="info-row"><strong>Cliente:</strong> ${cliente?.nombre||"Particular"}</div>
      <div class="info-row"><strong>Teléfono:</strong> ${cliente?.telefono||"N/A"}</div>
      <div class="info-row"><strong>Vehículo:</strong> ${vehiculo?.marca||""} ${vehiculo?.modelo||""} ${vehiculo?.ano||""}</div>
      <div class="info-row"><strong>Placa:</strong> ${vehiculo?.placa||"N/A"}</div>
    </div>
    <div class="info-box"><div class="box-title">📋 Detalles</div>
      <div class="info-row"><strong>Orden:</strong> ${numeroOrden}</div>
      <div class="info-row"><strong>Técnico:</strong> ${diag.tecnico_nombre||"—"}</div>
      <div class="info-row"><strong>Tipo:</strong> ${diag.tipo_servicio||orden.descripcion||"—"}</div>
      <div class="info-row"><strong>Fecha:</strong> ${new Date(diag.created_at||orden.created_at).toLocaleString("es-DO")}</div>
      ${diag.tiempo_estimado?`<div class="info-row"><strong>Tiempo estimado:</strong> ${diag.tiempo_estimado}</div>`:""}
    </div>
  </div>
  ${diag.hallazgos||diag.descripcion?`<div class="sec-titulo">🔍 Hallazgos / Diagnóstico</div><div class="sec-texto">${diag.hallazgos||diag.descripcion}</div>`:""}
  ${diag.notas?`<div class="sec-titulo" style="background:#fffbeb;border-left-color:#f59e0b;color:#92400e">📝 Notas</div><div class="sec-texto">${diag.notas}</div>`:""}
  ${total>0?`<div class="sec-titulo">💰 Cotización</div>
  <table><thead><tr><th>Descripción</th><th style="text-align:right;width:200px">Monto (RD$)</th></tr></thead>
  <tbody>${detalleLineas}${repuestos>0?`<tr><td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px">Repuestos e Insumos</td><td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-size:14px">RD$ ${repuestos.toLocaleString("es-DO",{minimumFractionDigits:2})}</td></tr>`:""}</tbody>
  <tfoot><tr class="total-row"><td>TOTAL PRESUPUESTO</td><td style="text-align:right">RD$ ${total.toLocaleString("es-DO",{minimumFractionDigits:2})}</td></tr></tfoot></table>`:""}
  <div class="firma-area"><div><div class="firma-linea">Técnico: ${diag.tecnico_nombre||"_______________"}</div></div><div><div class="firma-linea">Firma del Cliente</div></div></div>
  <div class="footer"><p>Este informe tiene validez de 15 días hábiles.</p><p><strong>SÓLIDO AUTO SERVICIO</strong> — Tel: 809-712-2027 — Santo Domingo, RD</p></div>
  <script>window.onload=function(){setTimeout(function(){window.print()},500)};window.onafterprint=function(){window.close()}</script>
  </body></html>`;

  const win = window.open("","_blank","width=820,height=1000");
  if (win) { win.document.write(html); win.document.close(); }
}

// ── Imprimir resumen completo de la orden (entregable al cliente) ─────────────
function imprimirOrdenCompleta(orden: any, cliente: any, vehiculo: any, diag: any, log: any[], inspeccion: any) {
  const numeroOrden = orden.numero_orden || `OT-${String(orden.id).padStart(4,"0")}`;
  const fmtDate = (d: string) => d ? new Date(d).toLocaleString("es-DO",{ year:"numeric", month:"long", day:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
  const fmtMoney = (n: number) => n.toLocaleString("es-DO",{ minimumFractionDigits:2 });
  const manoObra  = Number(diag?.mano_obra  || 0);
  const repuestos = Number(diag?.repuestos  || 0);
  const totalCot  = manoObra + repuestos || Number(diag?.total || 0);

  // Timeline de estados
  const timelineRows = (log || []).map((e: any) => {
    const iconos: Record<string,string> = {
      RECIBIDO:"📥", DIAGNOSTICO:"🔬", ESPERANDO_APROBACION:"⏳",
      REPARACION:"🔧", CONTROL_CALIDAD:"✅", LISTO:"🎉", ENTREGADO:"🏁", CANCELADA:"❌",
    };
    const colores: Record<string,string> = {
      RECIBIDO:"#1d4ed8", DIAGNOSTICO:"#92400e", ESPERANDO_APROBACION:"#c2410c",
      REPARACION:"#991b1b", CONTROL_CALIDAD:"#5b21b6", LISTO:"#065f46",
      ENTREGADO:"#374151", CANCELADA:"#7f1d1d",
    };
    const label = ESTADO_LABEL[e.estado_nuevo] || e.estado_nuevo;
    const color = colores[e.estado_nuevo] || "#374151";
    const icon  = iconos[e.estado_nuevo] || "🔄";
    return `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;vertical-align:top;width:36px;text-align:center;font-size:18px">${icon}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;vertical-align:top">
          <span style="font-weight:700;color:${color};font-size:14px">${label}</span>
          ${e.motivo ? `<br><span style="font-size:12px;color:#6b7280">📝 ${e.motivo}</span>` : ""}
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;vertical-align:top;font-size:12px;color:#9ca3af;white-space:nowrap">
          ${fmtDate(e.created_at)}<br>
          <span style="color:#6b7280">👤 ${e.usuario_nombre||"Sistema"}</span>
        </td>
      </tr>`;
  }).join("");

  // Avances de reparación
  const avancesRows = (diag?.avances || []).map((av: any) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;vertical-align:top">
        <div style="font-weight:600">${av.descripcion || "—"}</div>
        <div style="font-size:11px;color:#9ca3af;margin-top:2px">
          👤 ${av.tecnico_nombre || "Técnico"} &nbsp;·&nbsp; ${fmtDate(av.created_at)}
        </div>
      </td>
    </tr>`).join("");

  // Inspección
  const inspHtml = inspeccion ? `
    <div style="margin-bottom:24px">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#475569;background:#f1f5f9;padding:6px 10px;border-radius:6px;margin-bottom:8px;border-left:3px solid #10b981">
        📋 Inspección de Recepción
      </div>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:6px 12px;font-size:13px"><strong>KM entrada:</strong> ${inspeccion.km_entrada?.toLocaleString()||"N/A"}</td>
          <td style="padding:6px 12px;font-size:13px"><strong>Combustible:</strong> ${inspeccion.nivel_combustible??"-"}%</td>
          <td style="padding:6px 12px;font-size:13px"><strong>Condición:</strong> ${inspeccion.condicion_general||"—"}</td>
        </tr>
      </table>
      ${inspeccion.observaciones?`<div style="margin-top:6px;font-size:13px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 12px">📝 ${inspeccion.observaciones}</div>`:""}
    </div>` : "";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Resumen de Servicio — ${numeroOrden}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; padding:36px; color:#1a1a1a; line-height:1.6; max-width:820px; margin:auto; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #111827; padding-bottom:18px; margin-bottom:24px; }
  .logo { font-size:22px; font-weight:900; }
  .logo-sub { font-size:12px; color:#6b7280; margin-top:4px; line-height:1.5; }
  .orden-badge { text-align:right; }
  .orden-num { font-size:20px; font-weight:900; color:#1e40af; }
  .orden-fecha { font-size:12px; color:#6b7280; margin-top:3px; }
  .estado-badge { display:inline-block; padding:4px 14px; border-radius:20px; font-size:12px; font-weight:700; border:1.5px solid currentColor; margin-top:6px; }
  .section-title { font-size:12px; font-weight:700; text-transform:uppercase; color:#475569; background:#f1f5f9; padding:6px 10px; border-radius:6px; margin:20px 0 10px; border-left:3px solid #334155; letter-spacing:.5px; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; }
  .info-box { border:1px solid #e2e8f0; padding:14px 16px; border-radius:10px; background:#f8fafc; }
  .info-box-title { font-size:11px; font-weight:700; text-transform:uppercase; color:#64748b; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid #e2e8f0; letter-spacing:.8px; }
  .info-row { font-size:13px; margin-bottom:4px; }
  .hallazgos { font-size:13px; padding:12px 16px; background:#fff; border:1px solid #e2e8f0; border-radius:8px; white-space:pre-wrap; line-height:1.7; }
  table.timeline { width:100%; border-collapse:collapse; background:#fff; border-radius:10px; overflow:hidden; border:1px solid #f1f5f9; }
  table.avances { width:100%; border-collapse:collapse; background:#fff; border:1px solid #f1f5f9; border-radius:8px; overflow:hidden; }
  .cotizacion { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:14px 18px; margin-top:14px; }
  .total-final { background:#111827; color:#fff; padding:14px 18px; border-radius:10px; margin-top:16px; display:flex; justify-content:space-between; align-items:center; }
  .total-num { font-size:22px; font-weight:900; }
  .firmas { display:grid; grid-template-columns:1fr 1fr; gap:60px; margin-top:50px; }
  .firma-line { border-top:1px solid #111; padding-top:8px; text-align:center; font-size:12px; color:#64748b; }
  .footer { text-align:center; margin-top:40px; padding-top:14px; border-top:1px dashed #cbd5e1; color:#94a3b8; font-size:11px; line-height:2; }
  @media print { body { padding:20px; } }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div>
    <div class="logo">🔧 SÓLIDO AUTO SERVICIO</div>
    <div class="logo-sub">
      Expertos en Mecánica &amp; Detallado<br>
      Tel: 809-712-2027 · Santo Domingo, República Dominicana
    </div>
  </div>
  <div class="orden-badge">
    <div class="orden-num">${numeroOrden}</div>
    <div class="orden-fecha">Recibido: ${fmtDate(orden.created_at)}</div>
    ${orden.fecha_entrega ? `<div class="orden-fecha">Entregado: ${fmtDate(orden.fecha_entrega)}</div>` : ""}
    <span class="estado-badge" style="color:${EST[orden.estado]?.color||"#374151"};border-color:${EST[orden.estado]?.color||"#374151"}">
      ${EST[orden.estado]?.icon||""} ${EST[orden.estado]?.label||orden.estado}
    </span>
  </div>
</div>

<!-- TITULO -->
<div style="text-align:center;font-size:17px;font-weight:700;color:#1e40af;border:2px solid #1e40af;padding:8px;border-radius:8px;margin-bottom:24px;letter-spacing:1px;text-transform:uppercase">
  Resumen Completo de Servicio
</div>

<!-- INFO CLIENTE + VEHÍCULO -->
<div class="info-grid">
  <div class="info-box">
    <div class="info-box-title">👤 Cliente</div>
    <div class="info-row"><strong>${cliente?.nombre||"Particular"}</strong></div>
    <div class="info-row">📞 ${cliente?.telefono||"—"}</div>
    <div class="info-row">✉️ ${cliente?.email||"—"}</div>
    ${cliente?.cedula ? `<div class="info-row">🪪 ${cliente.cedula}</div>` : ""}
  </div>
  <div class="info-box">
    <div class="info-box-title">🚗 Vehículo</div>
    <div class="info-row"><strong>${vehiculo?.marca||""} ${vehiculo?.modelo||""} ${vehiculo?.ano||""}</strong></div>
    <div class="info-row">🪪 Placa: <strong style="font-family:monospace">${vehiculo?.placa||"N/A"}</strong></div>
    <div class="info-row">🎨 Color: ${vehiculo?.color||"—"}</div>
    ${vehiculo?.vin ? `<div class="info-row">VIN: ${vehiculo.vin}</div>` : ""}
  </div>
</div>

<!-- TRABAJO SOLICITADO -->
<div class="section-title">📝 Trabajo Solicitado</div>
<div class="hallazgos">${orden.descripcion||"Sin descripción"}</div>

<!-- INSPECCIÓN -->
${inspHtml}

<!-- DIAGNÓSTICO TÉCNICO -->
${diag ? `
<div class="section-title">🔬 Diagnóstico Técnico</div>
<div class="info-grid" style="margin-bottom:10px">
  <div class="info-box">
    <div class="info-box-title">Técnico responsable</div>
    <div class="info-row"><strong>${diag.tecnico_nombre||"—"}</strong></div>
    <div class="info-row">Tipo: ${diag.tipo_servicio||orden.descripcion||"—"}</div>
    ${diag.tiempo_estimado ? `<div class="info-row">Tiempo estimado: ${diag.tiempo_estimado}</div>` : ""}
  </div>
  <div class="info-box">
    <div class="info-box-title">Estado del diagnóstico</div>
    <div class="info-row"><strong>${diag.estado||"—"}</strong></div>
    <div class="info-row">Registrado: ${fmtDate(diag.created_at)}</div>
  </div>
</div>
${diag.hallazgos||diag.descripcion ? `
  <div style="margin-bottom:12px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:4px">Hallazgos / Descripción</div>
    <div class="hallazgos">${diag.hallazgos||diag.descripcion}</div>
  </div>` : ""}
${diag.notas ? `
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-bottom:12px">
    <div style="font-size:11px;font-weight:700;color:#92400e;margin-bottom:4px">📝 NOTAS</div>
    <div style="font-size:13px">${diag.notas}</div>
  </div>` : ""}

<!-- COTIZACIÓN -->
${totalCot > 0 ? `
<div class="cotizacion">
  <div style="font-size:12px;font-weight:700;color:#065f46;text-transform:uppercase;margin-bottom:10px">💰 Cotización Aprobada</div>
  <table style="width:100%;border-collapse:collapse">
    <tr style="border-bottom:1px solid #d1fae5">
      <td style="padding:6px 0;font-size:13px">Mano de obra</td>
      <td style="padding:6px 0;font-size:13px;text-align:right;font-weight:700">RD$ ${fmtMoney(manoObra)}</td>
    </tr>
    ${repuestos > 0 ? `<tr style="border-bottom:1px solid #d1fae5">
      <td style="padding:6px 0;font-size:13px">Repuestos e insumos</td>
      <td style="padding:6px 0;font-size:13px;text-align:right;font-weight:700">RD$ ${fmtMoney(repuestos)}</td>
    </tr>` : ""}
    <tr>
      <td style="padding:10px 0 0;font-size:15px;font-weight:900;color:#065f46">TOTAL</td>
      <td style="padding:10px 0 0;font-size:15px;font-weight:900;color:#065f46;text-align:right">RD$ ${fmtMoney(totalCot)}</td>
    </tr>
  </table>
</div>` : ""}
` : `<div class="section-title">🔬 Diagnóstico Técnico</div>
<div style="font-size:13px;color:#9ca3af;padding:10px">Sin diagnóstico registrado.</div>`}

<!-- AVANCES DE REPARACIÓN -->
${diag?.avances?.length > 0 ? `
<div class="section-title">🔧 Avances de Reparación</div>
<table class="avances">
  ${avancesRows}
</table>` : ""}

<!-- TIMELINE DE ESTADOS -->
<div class="section-title">📜 Historial Completo del Proceso</div>
${log?.length > 0 ? `
<table class="timeline">
  <thead>
    <tr style="background:#111827;color:#fff">
      <th style="padding:10px 14px;font-size:12px;font-weight:700;width:36px"></th>
      <th style="padding:10px 14px;font-size:12px;font-weight:700;text-align:left">Estado</th>
      <th style="padding:10px 14px;font-size:12px;font-weight:700;text-align:left">Fecha y Usuario</th>
    </tr>
  </thead>
  <tbody>${timelineRows}</tbody>
</table>` : `<div style="font-size:13px;color:#9ca3af;padding:10px">Sin historial de estados registrado.</div>`}

<!-- FIRMAS -->
<div class="firmas">
  <div><div class="firma-line">Técnico / Responsable del Servicio</div></div>
  <div><div class="firma-line">Firma del Cliente — Conforme</div></div>
</div>

<div class="footer">
  <p>Este documento certifica que el vehículo fue recibido, diagnosticado y devuelto conforme a lo indicado.</p>
  <p><strong>SÓLIDO AUTO SERVICIO</strong> — Tel: 809-712-2027 — Santo Domingo, República Dominicana</p>
  <p>Impreso el ${new Date().toLocaleDateString("es-DO",{ year:"numeric", month:"long", day:"numeric" })}</p>
</div>

<script>window.onload=function(){setTimeout(function(){window.print()},600)};window.onafterprint=function(){window.close()}</script>
</body>
</html>`;

  const win = window.open("","_blank","width=900,height=1100");
  if (win) { win.document.write(html); win.document.close(); }
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function OrdenDetallePage() {
  const { id }  = useParams() as { id: string };
  const router  = useRouter();

  const [data,     setData]     = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [usuario,  setUsuario]  = useState<any>(null);
  const [msg,      setMsg]      = useState<{ tipo:"ok"|"err"; texto:string } | null>(null);

  const [modalAccion,  setModalAccion]  = useState<"aprobar"|"rechazar"|"calidad"|"entregar"|null>(null);
  const [motivoModal,  setMotivoModal]  = useState("");
  const [procesando,   setProcesando]   = useState(false);
  const [mostrarInspFotos, setMostrarInspFotos] = useState(false);

  // ── Carga con fallback robusto ─────────────────────────────────────────────
  const cargar = useCallback(async () => {
    try {
      // Intento 1: endpoint completo /ordenes/:id
      const res = await fetch(`${API}/ordenes/${id}`);
      if (res.ok) {
        const json = await res.json();
        if (json?.orden) { setData(json); setLoading(false); return; }
      }

      // Intento 2: construir desde el listado + llamadas paralelas
      const [listRes, diagRes, logRes, inspRes, avRes] = await Promise.all([
        fetch(`${API}/ordenes`).then(r => r.ok ? r.json() : []),
        fetch(`${API}/diagnosticos?orden_id=${id}`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API}/ordenes/${id}/log`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API}/inspeccion/orden/${id}`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API}/avances/${id}`).then(r => r.ok ? r.json() : []).catch(() => []),
      ]);

      const lista = Array.isArray(listRes) ? listRes : [];
      const ordenBase = lista.find((o: any) => String(o.id) === String(id)) || null;

      if (!ordenBase) { setData(null); setLoading(false); return; }

      // Resolver cliente y vehículo si tenemos IDs
      const [clienteRes, vehiculoRes] = await Promise.all([
        ordenBase.cliente_id
          ? fetch(`${API}/clientes/${ordenBase.cliente_id}`).then(r => r.ok ? r.json() : null).catch(() => null)
          : Promise.resolve(null),
        ordenBase.vehiculo_id
          ? fetch(`${API}/vehiculos/${ordenBase.vehiculo_id}`).then(r => r.ok ? r.json() : null).catch(() => null)
          : Promise.resolve(null),
      ]);

      // Normalizar diagnóstico (puede venir como array o como objeto)
      let diag = null;
      if (Array.isArray(diagRes) && diagRes.length > 0) diag = diagRes[0];
      else if (diagRes && !Array.isArray(diagRes) && diagRes.id) diag = diagRes;
      if (diag) diag = { ...diag, avances: Array.isArray(avRes) ? avRes : [] };

      setData({
        orden:       { ...ordenBase, numero_orden: ordenBase.numero_orden || `OT-${String(ordenBase.id).padStart(4,"0")}` },
        cliente:     clienteRes,
        vehiculo:    vehiculoRes,
        diagnostico: diag,
        log:         Array.isArray(logRes) ? logRes : [],
        inspeccion:  inspRes,
      });
    } catch (err) {
      console.error("Error cargando orden:", err);
      setData(null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    try { setUsuario(JSON.parse(localStorage.getItem("usuario") || "{}")); } catch {}
    cargar();
  }, [cargar]);

  // ── Acción de flujo ───────────────────────────────────────────────────────
  const ejecutarAccion = async (accion: string) => {
    setProcesando(true);
    setMsg(null);
    try {
      const endpoint: Record<string,string> = {
        aprobar: "aprobar", rechazar: "rechazar",
        calidad: "calidad-aprobada", entregar: "entregar",
      };
      const res  = await fetch(`${API}/ordenes/${id}/${endpoint[accion]}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id: usuario?.id, usuario_nombre: usuario?.nombre, motivo: motivoModal }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMsg({ tipo:"ok", texto: json.mensaje || "Acción ejecutada correctamente." });
      setModalAccion(null);
      setMotivoModal("");
      await cargar();
    } catch (err: any) {
      setMsg({ tipo:"err", texto: err.message });
    }
    setProcesando(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding:40, color:"#6b7280", display:"flex", alignItems:"center", gap:10 }}>
      <span style={{ fontSize:20 }}>⏳</span> Cargando orden...
    </div>
  );

  if (!data?.orden) return (
    <div style={{ padding:40 }}>
      <div style={{ color:"#ef4444", fontSize:15, marginBottom:16 }}>⚠️ No se pudo cargar la orden #{id}.</div>
      <button
        onClick={() => { setLoading(true); cargar(); }}
        style={{ padding:"8px 18px", background:"#3b82f6", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:700, marginRight:10 }}
      >
        🔄 Reintentar
      </button>
      <button
        onClick={() => router.push("/ordenes")}
        style={{ padding:"8px 18px", background:"#f3f4f6", border:"none", borderRadius:8, cursor:"pointer", fontWeight:600 }}
      >
        ← Volver a Órdenes
      </button>
    </div>
  );

  const { orden, cliente, vehiculo, diagnostico, log, inspeccion } = data;
  const estado  = orden.estado || "RECIBIDO";
  const estCfg  = EST[estado] || EST.RECIBIDO;

  const accionesFlujo: { key: string; label: string; color: string }[] = [];
  if (estado === "ESPERANDO_APROBACION") {
    accionesFlujo.push(
      { key:"aprobar",  label:"✅ Cliente Aprobó",  color:"#16a34a" },
      { key:"rechazar", label:"❌ Cliente Rechazó",  color:"#dc2626" },
    );
  }
  if (estado === "CONTROL_CALIDAD") {
    accionesFlujo.push({ key:"calidad",  label:"✅ Aprobó Control de Calidad", color:"#7c3aed" });
  }
  if (estado === "LISTO") {
    accionesFlujo.push({ key:"entregar", label:"🏁 Vehículo Entregado", color:"#1d4ed8" });
  }

  let botonTaller: { label: string; href: string; color: string } | null = null;
  if (["RECIBIDO","DIAGNOSTICO"].includes(estado)) {
    botonTaller = { label:"🔬 Ir al Taller — Diagnóstico", href:`/taller/diagnostico/${id}`, color:"#f59e0b" };
  } else if (estado === "REPARACION") {
    botonTaller = { label:"🔧 Ir al Taller — Reparación", href:`/taller/reparacion/${id}`, color:"#ef4444" };
  }

  const card: React.CSSProperties = {
    background:"#fff", borderRadius:14, padding:20,
    marginBottom:16, boxShadow:"0 1px 6px rgba(0,0,0,0.07)",
  };
  const sTitle: React.CSSProperties = {
    fontWeight:800, fontSize:15, color:"#111", marginBottom:14,
    paddingBottom:8, borderBottom:"1px solid #f3f4f6",
    display:"flex", alignItems:"center", justifyContent:"space-between",
  };

  return (
    <div style={{ padding:"24px 28px", maxWidth:1000, margin:"0 auto" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, flexWrap:"wrap" }}>
        <button
          onClick={() => router.push("/ordenes")}
          style={{ background:"#f3f4f6", border:"none", borderRadius:8, padding:"7px 14px", cursor:"pointer", fontSize:13, fontWeight:600 }}
        >
          ← Órdenes
        </button>
        <div style={{ flex:1 }}>
          <h1 style={{ margin:0, fontSize:20, fontWeight:900 }}>
            {orden.numero_orden || `OT-${String(orden.id).padStart(4,"0")}`}
          </h1>
          <p style={{ margin:"2px 0 0", color:"#6b7280", fontSize:13 }}>
            {new Date(orden.created_at).toLocaleDateString("es-DO",{ year:"numeric", month:"long", day:"numeric", hour:"2-digit", minute:"2-digit" })}
          </p>
        </div>
        <span style={{
          background: estCfg.bg, color: estCfg.color,
          padding:"6px 18px", borderRadius:20, fontWeight:800, fontSize:14,
          border:`1.5px solid ${estCfg.color}44`,
        }}>
          {estCfg.icon} {estCfg.label}
        </span>
        {/* WhatsApp */}
        {cliente?.telefono && (
          <a
            href={`https://wa.me/${cliente.telefono.replace(/\D/g,"")}?text=${encodeURIComponent(`Hola ${cliente.nombre}, le escribimos de Sólido Auto Servicio sobre su vehículo ${vehiculo?.placa || vehiculo?.marca || ""}.`)}`}
            target="_blank" rel="noreferrer"
            style={{ background:"#25d366", color:"#fff", padding:"7px 14px", borderRadius:8, fontWeight:700, fontSize:13, textDecoration:"none", display:"flex", alignItems:"center", gap:5 }}
          >
            💬 WhatsApp
          </a>
        )}
        {/* Botón imprimir resumen completo */}
        <button
          onClick={() => imprimirOrdenCompleta(orden, cliente, vehiculo, diagnostico, log, inspeccion)}
          style={{ background:"#111827", color:"#fff", padding:"7px 16px", borderRadius:8, fontWeight:700, fontSize:13, border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}
        >
          🖨️ Imprimir Resumen
        </button>
      </div>

      {/* Feedback */}
      {msg && (
        <div style={{
          padding:"10px 16px", borderRadius:10, marginBottom:16, fontWeight:600, fontSize:14,
          background: msg.tipo === "ok" ? "#d1fae5" : "#fee2e2",
          color:      msg.tipo === "ok" ? "#065f46" : "#991b1b",
          border:`1px solid ${msg.tipo === "ok" ? "#6ee7b7" : "#fca5a5"}`,
        }}>
          {msg.tipo === "ok" ? "✅" : "❌"} {msg.texto}
        </div>
      )}

      {/* Banner de acción requerida */}
      {accionesFlujo.length > 0 && (
        <div style={{
          ...card, borderLeft:`4px solid ${accionesFlujo[0].color}`,
          background: accionesFlujo[0].color + "08",
          display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12,
        }}>
          <div>
            <p style={{ margin:0, fontWeight:800, fontSize:15, color:"#111" }}>⚡ Acción requerida</p>
            <p style={{ margin:"2px 0 0", fontSize:13, color:"#6b7280" }}>
              {estado === "ESPERANDO_APROBACION" && "El cliente necesita ser contactado para aprobar o rechazar la cotización."}
              {estado === "CONTROL_CALIDAD"      && "Verifica la calidad del trabajo antes de notificar al cliente."}
              {estado === "LISTO"                && "El vehículo está listo. Procesa la entrega cuando el cliente llegue."}
            </p>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            {accionesFlujo.map(a => (
              <button
                key={a.key}
                onClick={() => { setModalAccion(a.key as any); setMotivoModal(""); }}
                style={{ padding:"10px 22px", background:a.color, color:"#fff", border:"none", borderRadius:10, cursor:"pointer", fontWeight:800, fontSize:14, boxShadow:`0 4px 14px ${a.color}44` }}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Botón de navegación al taller */}
      {botonTaller && (
        <div style={{ marginBottom:16 }}>
          <Link href={botonTaller.href}>
            <button style={{
              width:"100%", padding:"12px 20px", borderRadius:11,
              background: botonTaller.color + "15",
              color: botonTaller.color,
              border:`1.5px solid ${botonTaller.color}44`,
              cursor:"pointer", fontWeight:800, fontSize:14,
              display:"flex", alignItems:"center", justifyContent:"center", gap:10,
            }}>
              {botonTaller.label}
              <span style={{ fontSize:12, fontWeight:500, opacity:0.8 }}>→ Módulo Taller</span>
            </button>
          </Link>
        </div>
      )}

      {/* Grid: cliente + vehículo */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:0 }}>
        <div style={card}>
          <div style={sTitle as any}>👤 Cliente</div>
          {cliente ? (
            <>
              <p style={{ margin:"0 0 5px", fontWeight:700, fontSize:16 }}>{cliente.nombre}</p>
              <p style={{ margin:"0 0 3px", color:"#6b7280", fontSize:13 }}>📞 {cliente.telefono || "—"}</p>
              <p style={{ margin:"0 0 3px", color:"#6b7280", fontSize:13 }}>✉️  {cliente.email || "—"}</p>
              {cliente.cedula && <p style={{ margin:0, color:"#6b7280", fontSize:13 }}>🪪 {cliente.cedula}</p>}
            </>
          ) : <p style={{ color:"#9ca3af", margin:0 }}>Sin cliente registrado</p>}
        </div>
        <div style={card}>
          <div style={sTitle as any}>🚗 Vehículo</div>
          {vehiculo ? (
            <>
              <p style={{ margin:"0 0 5px", fontWeight:700, fontSize:16 }}>{vehiculo.marca} {vehiculo.modelo} {vehiculo.ano}</p>
              <p style={{ margin:"0 0 3px", color:"#6b7280", fontSize:13 }}>
                🪪 Placa: <strong style={{ color:"#111", fontFamily:"monospace" }}>{vehiculo.placa}</strong>
              </p>
              <p style={{ margin:"0 0 3px", color:"#6b7280", fontSize:13 }}>🎨 Color: {vehiculo.color || "—"}</p>
              {vehiculo.vin && <p style={{ margin:0, color:"#6b7280", fontSize:13 }}>VIN: {vehiculo.vin}</p>}
            </>
          ) : <p style={{ color:"#9ca3af", margin:0 }}>Sin vehículo</p>}
        </div>
      </div>

      {/* Trabajo solicitado */}
      <div style={{ ...card, marginTop:16, borderLeft:"4px solid #3b82f6" }}>
        <div style={sTitle as any}>📝 Trabajo Solicitado</div>
        <p style={{ margin:0, fontSize:14, color:"#374151", lineHeight:1.6 }}>
          {orden.descripcion || "Sin descripción del trabajo."}
        </p>
      </div>

      {/* Inspección de recepción */}
      {inspeccion ? (
        <div style={{ ...card, marginTop:16, borderLeft:"4px solid #10b981" }}>
          <div style={sTitle as any}>
            <span>📋 Inspección de Recepción</span>
            <Link href={`/inspeccion/${id}`} style={{ fontSize:12, color:"#059669", fontWeight:600, textDecoration:"none" }}>
              Ver completa →
            </Link>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, fontSize:13, marginBottom:10 }}>
            <div><span style={{ color:"#6b7280" }}>KM entrada:</span> <strong>{inspeccion.km_entrada?.toLocaleString() || "—"}</strong></div>
            <div><span style={{ color:"#6b7280" }}>Combustible:</span> <strong>{inspeccion.nivel_combustible ?? "—"}%</strong></div>
            <div><span style={{ color:"#6b7280" }}>Condición:</span> <strong>{inspeccion.condicion_general || "—"}</strong></div>
          </div>
          {inspeccion.observaciones && (
            <p style={{ margin:"0 0 10px", fontSize:13, color:"#374151", background:"#f9fafb", padding:"8px 12px", borderRadius:8, borderLeft:"3px solid #10b981" }}>
              📝 {inspeccion.observaciones}
            </p>
          )}
          {inspeccion.fotos?.length > 0 && (
            <>
              <button
                onClick={() => setMostrarInspFotos(v => !v)}
                style={{ background:"transparent", border:"none", color:"#059669", fontWeight:600, fontSize:12, cursor:"pointer", padding:0, marginBottom:6 }}
              >
                {mostrarInspFotos ? "▲ Ocultar fotos" : `▼ Ver fotos (${inspeccion.fotos.length})`}
              </button>
              {mostrarInspFotos && (
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:6 }}>
                  {inspeccion.fotos.map((f: any, i: number) => (
                    <img key={i} src={f.data} alt={f.label}
                      style={{ width:80, height:62, objectFit:"cover", borderRadius:8, border:"1px solid #e5e7eb" }} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div style={{ ...card, marginTop:16, borderLeft:"4px solid #e5e7eb", background:"#f9fafb" }}>
          <div style={sTitle as any}>📋 Inspección de Recepción</div>
          <p style={{ margin:0, fontSize:13, color:"#9ca3af" }}>
            No se registró inspección al momento de la recepción.
            {["RECIBIDO"].includes(estado) && (
              <> <Link href={`/inspeccion/${id}`} style={{ color:"#3b82f6", fontWeight:700, textDecoration:"none" }}>Registrar ahora →</Link></>
            )}
          </p>
        </div>
      )}

      {/* Diagnóstico */}
      <div style={{ ...card, marginTop:16 }}>
        <div style={sTitle as any}>
          <span>🔬 Diagnóstico Técnico</span>
          {diagnostico && (
            <button
              onClick={() => imprimirDiagnostico(orden, cliente, vehiculo, diagnostico)}
              style={{
                padding:"6px 14px", background:"#1e40af", color:"#fff",
                border:"none", borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:12,
                display:"flex", alignItems:"center", gap:6,
              }}
            >
              🖨️ Cotización
            </button>
          )}
        </div>

        {diagnostico ? (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:14, fontSize:13 }}>
              <div>
                <span style={{ color:"#6b7280", fontSize:11, fontWeight:700, textTransform:"uppercase" }}>Técnico</span>
                <p style={{ margin:"3px 0 0", fontWeight:700 }}>{diagnostico.tecnico_nombre || "—"}</p>
              </div>
              <div>
                <span style={{ color:"#6b7280", fontSize:11, fontWeight:700, textTransform:"uppercase" }}>Tipo de servicio</span>
                <p style={{ margin:"3px 0 0", fontWeight:700 }}>{diagnostico.tipo_servicio || "—"}</p>
              </div>
              {diagnostico.tiempo_estimado && (
                <div>
                  <span style={{ color:"#6b7280", fontSize:11, fontWeight:700, textTransform:"uppercase" }}>Tiempo estimado</span>
                  <p style={{ margin:"3px 0 0", fontWeight:700 }}>{diagnostico.tiempo_estimado}</p>
                </div>
              )}
            </div>

            {(diagnostico.hallazgos || diagnostico.descripcion) && (
              <div style={{ marginBottom:14 }}>
                <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#6b7280", textTransform:"uppercase" }}>Hallazgos</p>
                <div style={{ background:"#f9fafb", border:"1px solid #f1f5f9", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#374151", whiteSpace:"pre-wrap", lineHeight:1.6 }}>
                  {diagnostico.hallazgos || diagnostico.descripcion}
                </div>
              </div>
            )}

            {(diagnostico.mano_obra > 0 || diagnostico.repuestos > 0 || diagnostico.total > 0) && (
              <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"12px 16px" }}>
                <p style={{ margin:"0 0 8px", fontWeight:700, fontSize:13, color:"#065f46" }}>💰 Cotización</p>
                <div style={{ display:"flex", gap:24, fontSize:13, flexWrap:"wrap" }}>
                  {diagnostico.mano_obra > 0 && (
                    <div><span style={{ color:"#6b7280" }}>Mano de obra:</span> <strong>RD$ {Number(diagnostico.mano_obra).toLocaleString("es-DO",{minimumFractionDigits:2})}</strong></div>
                  )}
                  {diagnostico.repuestos > 0 && (
                    <div><span style={{ color:"#6b7280" }}>Repuestos:</span> <strong>RD$ {Number(diagnostico.repuestos).toLocaleString("es-DO",{minimumFractionDigits:2})}</strong></div>
                  )}
                  <div style={{ borderLeft:"2px solid #6ee7b7", paddingLeft:16 }}>
                    <span style={{ color:"#065f46" }}>Total:</span>{" "}
                    <strong style={{ fontSize:15, color:"#065f46" }}>
                      RD$ {(Number(diagnostico.mano_obra||0)+Number(diagnostico.repuestos||0)||Number(diagnostico.total||0)).toLocaleString("es-DO",{minimumFractionDigits:2})}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Avances de reparación */}
            {diagnostico.avances?.length > 0 && (
              <div style={{ marginTop:16 }}>
                <p style={{ margin:"0 0 10px", fontWeight:700, fontSize:13, color:"#374151" }}>📋 Avances de Reparación ({diagnostico.avances.length})</p>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {diagnostico.avances.map((av: any) => (
                    <div key={av.id} style={{ padding:"9px 12px", background:"#f9fafb", borderRadius:8, borderLeft:"3px solid #8b5cf6" }}>
                      <p style={{ margin:"0 0 3px", fontSize:13, fontWeight:600, whiteSpace:"pre-wrap" }}>{av.descripcion}</p>
                      <p style={{ margin:0, fontSize:11, color:"#9ca3af" }}>{av.tecnico_nombre} · {new Date(av.created_at).toLocaleString("es-DO")}</p>
                    </div>
                  ))}
                </div>
                {estado === "REPARACION" && (
                  <Link href={`/taller/reparacion/${id}`} style={{ display:"inline-block", marginTop:10, fontSize:13, color:"#7c3aed", fontWeight:700, textDecoration:"none" }}>
                    → Agregar avance en el Taller
                  </Link>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ background:"#f9fafb", borderRadius:10, padding:"20px 16px", textAlign:"center", color:"#9ca3af" }}>
            <p style={{ margin:"0 0 6px", fontSize:14, fontWeight:600 }}>No hay diagnóstico registrado aún.</p>
            {["RECIBIDO","DIAGNOSTICO"].includes(estado) && (
              <Link href={`/taller/diagnostico/${id}`} style={{ color:"#f59e0b", fontWeight:700, textDecoration:"none", fontSize:13 }}>
                → El técnico puede iniciarlo desde el Taller
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Historial de la orden */}
      <div style={{ ...card, marginTop:16 }}>
        <div style={sTitle as any}>
          <span>📜 Historial Completo del Proceso</span>
          <span style={{ fontSize:12, color:"#9ca3af", fontWeight:500 }}>{log?.length || 0} eventos</span>
        </div>
        {(!log || log.length === 0) ? (
          <p style={{ color:"#9ca3af", fontSize:13, margin:0 }}>Sin registros de historial.</p>
        ) : (
          <div style={{ position:"relative" }}>
            <div style={{ position:"absolute", left:15, top:4, bottom:4, width:2, background:"#f1f5f9" }} />
            {log.map((entry: any, i: number) => {
              const ec = EST[entry.estado_nuevo] || { icon:"🔄", color:"#6b7280", bg:"#f3f4f6", label: entry.estado_nuevo };
              return (
                <div key={entry.id||i} style={{ display:"flex", gap:14, marginBottom:16, position:"relative" }}>
                  <div style={{
                    width:32, height:32, borderRadius:"50%", flexShrink:0,
                    background: ec.bg, color: ec.color,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:15, zIndex:1, border:`2px solid ${ec.color}33`,
                  }}>
                    {ec.icon}
                  </div>
                  <div style={{ flex:1, paddingTop:4 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <span style={{ fontWeight:700, fontSize:14, color: ec.color }}>{ec.label}</span>
                      {entry.estado_anterior && (
                        <span style={{ fontSize:12, color:"#9ca3af" }}>
                          (anterior: {EST[entry.estado_anterior]?.label || entry.estado_anterior})
                        </span>
                      )}
                    </div>
                    {entry.motivo && <p style={{ margin:"2px 0 0", fontSize:12, color:"#6b7280" }}>📝 {entry.motivo}</p>}
                    <p style={{ margin:"2px 0 0", fontSize:11, color:"#9ca3af" }}>
                      👤 {entry.usuario_nombre||"Sistema"} · {new Date(entry.created_at).toLocaleString("es-DO",{ year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal confirmación de acción */}
      {modalAccion && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999 }}>
          <div style={{ background:"#fff", borderRadius:18, padding:28, minWidth:340, maxWidth:420, width:"90%", boxShadow:"0 24px 60px rgba(0,0,0,0.25)" }}>
            <h3 style={{ margin:"0 0 8px", fontSize:18 }}>
              {modalAccion === "aprobar"  && "✅ Confirmar aprobación del cliente"}
              {modalAccion === "rechazar" && "❌ Confirmar rechazo del cliente"}
              {modalAccion === "calidad"  && "✅ Control de calidad aprobado"}
              {modalAccion === "entregar" && "🏁 Confirmar entrega del vehículo"}
            </h3>
            <p style={{ color:"#6b7280", fontSize:13, marginBottom:14 }}>
              Esta acción cambiará el estado de la orden de forma permanente.
            </p>
            <label style={{ fontSize:12, color:"#6b7280", fontWeight:600, display:"block", marginBottom:4 }}>
              Motivo / Notas {modalAccion === "rechazar" ? "(requerido)" : "(opcional)"}
            </label>
            <textarea
              value={motivoModal}
              onChange={e => setMotivoModal(e.target.value)}
              style={{ width:"100%", padding:"8px 10px", border:"1px solid #e5e7eb", borderRadius:8, fontSize:13, minHeight:60, resize:"vertical", boxSizing:"border-box", marginBottom:16 }}
              placeholder="Observaciones adicionales..."
            />
            <div style={{ display:"flex", gap:10 }}>
              <button
                onClick={() => { setModalAccion(null); setMotivoModal(""); }}
                style={{ flex:1, padding:10, background:"#f3f4f6", border:"none", borderRadius:9, cursor:"pointer", fontWeight:700 }}
              >
                Cancelar
              </button>
              <button
                onClick={() => ejecutarAccion(modalAccion)}
                disabled={procesando || (modalAccion === "rechazar" && !motivoModal.trim())}
                style={{
                  flex:1, padding:10,
                  background: modalAccion === "rechazar" ? "#dc2626" : "#16a34a",
                  color:"#fff", border:"none", borderRadius:9,
                  cursor: procesando ? "not-allowed" : "pointer", fontWeight:800,
                  opacity: procesando ? 0.7 : 1,
                }}
              >
                {procesando ? "Procesando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
