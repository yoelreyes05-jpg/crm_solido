"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
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

// ── Interfaces ────────────────────────────────────────────────────────────────
interface TrabajoItem {
  id: string;
  tipo: string;
  descripcion: string;
  estado: "REALIZADO" | "PENDIENTE" | "NO_APLICA";
}

// ── Constantes ────────────────────────────────────────────────────────────────
const TRABAJO_TIPOS = [
  "Mecánica general","Eléctrica","Electrónica / Scanner",
  "Mantenimiento preventivo","A/C y Refrigeración",
  "Transmisión","Suspensión / Dirección","Frenos",
  "Carrocería / Pintura","Programación ECU","Otro",
];

const QC_CHECKLIST_ITEMS = [
  { key:"motor",       label:"Motor funcionando correctamente" },
  { key:"frenos",      label:"Sistema de frenos operativo" },
  { key:"fluidos",     label:"Sin fugas de fluidos" },
  { key:"luces",       label:"Sistema de luces completo" },
  { key:"electrico",   label:"Sistema eléctrico sin fallas" },
  { key:"transmision", label:"Transmisión / caja de cambios" },
  { key:"suspension",  label:"Suspensión y dirección" },
  { key:"ac",          label:"A/C y climatización" },
  { key:"limpieza",    label:"Limpieza y presentación" },
  { key:"prueba_ruta", label:"Prueba de ruta realizada" },
  { key:"trabajo_ok",  label:"Trabajo solicitado completado al 100%" },
];

// ── Helper de impresión por iframe (evita bloqueo de popups) ────────────────
function abrirImpresion(html: string) {
  const prev = document.getElementById("__print_iframe__");
  if (prev) prev.remove();
  const iframe = document.createElement("iframe");
  iframe.id = "__print_iframe__";
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:820px;height:1100px;border:none;opacity:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || (iframe.contentWindow as any)?.document;
  if (!doc) {
    const w = window.open("", "_blank", "width=860,height=1100");
    if (w) { w.document.write(html); w.document.close(); }
    return;
  }
  doc.open(); doc.write(html); doc.close();
  iframe.onload = () => {
    try {
      (iframe.contentWindow as any)?.focus();
      (iframe.contentWindow as any)?.print();
    } catch (_e) {
      const w = window.open("", "_blank", "width=860,height=1100");
      if (w) { w.document.write(html); w.document.close(); }
    }
  };
}

// ── Imprimir diagnóstico / cotización ─────────────────────────────────────────
function imprimirDiagnostico(orden: any, cliente: any, vehiculo: any, diag: any) {
  const manoObra    = Number(diag.mano_obra  || 0);
  const repuestos   = Number(diag.repuestos  || 0);
  const total       = manoObra + repuestos || Number(diag.total || diag.costo_estimado || 0);
  const tecnicoNombre = diag.tecnico_nombre || diag.usuario_nombre || "—";
  const detalleLineas = (diag.mano_de_obra_detalle || diag.detalle || "")
    .split("\n").filter((l: string) => l.trim())
    .map((l: string) => `<tr><td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px">✔ ${l.trim()}</td><td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-size:14px">—</td></tr>`)
    .join("") || `<tr><td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px">Servicios Profesionales de Mano de Obra</td><td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-size:14px">RD$ ${manoObra.toLocaleString("es-DO",{minimumFractionDigits:2})}</td></tr>`;
  const numeroOrden = orden.numero_orden || `OT-${String(orden.id).padStart(4,"0")}`;
  const logoUrl     = typeof window !== "undefined" ? window.location.origin + "/logo.png" : "/logo.png";

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Diagnóstico ${numeroOrden}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;padding:36px;color:#1a1a1a;line-height:1.6;max-width:780px;margin:auto}
    .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #111827;padding-bottom:18px;margin-bottom:22px;gap:20px}
    .logo-block{display:flex;align-items:center;gap:14px}
    .logo-block img{height:58px;max-width:160px;object-fit:contain;border-radius:6px}
    .empresa-nombre{font-size:18px;font-weight:900;letter-spacing:-.3px;line-height:1.1}
    .empresa-meta{font-size:11px;color:#555;margin-top:4px;line-height:1.7}
    .titulo-doc{text-align:center;font-size:16px;font-weight:700;margin:0 0 18px;letter-spacing:1px;color:#1e40af;text-transform:uppercase;border:2px solid #1e40af;padding:7px;border-radius:8px}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}
    .info-box{border:1px solid #e2e8f0;padding:14px;border-radius:8px;background:#f8fafc}
    .box-title{font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid #e2e8f0;letter-spacing:1px}
    .info-row{font-size:13px;margin-bottom:4px}
    .sec-titulo{font-size:11px;font-weight:700;text-transform:uppercase;color:#475569;background:#f1f5f9;padding:6px 10px;border-radius:6px;margin:12px 0 6px;border-left:3px solid #334155}
    .sec-texto{font-size:13px;padding:10px 14px;background:#fff;border:1px solid #e2e8f0;border-radius:6px;white-space:pre-wrap}
    table{width:100%;border-collapse:collapse;margin-bottom:14px}
    thead th{background:#111827;color:#fff;padding:11px 12px;text-align:left;font-size:12px}
    .total-row{background:#1e40af;color:#fff}
    .total-row td{padding:13px 12px;font-size:17px;font-weight:900}
    .firma-area{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px}
    .firma-linea{border-top:1px solid #111;padding-top:8px;text-align:center;font-size:12px;color:#64748b}
    .footer{text-align:center;margin-top:36px;padding-top:14px;border-top:1px dashed #cbd5e1;color:#94a3b8;font-size:11px;line-height:2}
    @media print{body{padding:18px}@page{margin:8mm 10mm}}
  </style>
  </head><body>
  <div class="header">
    <div class="logo-block">
      <img src="${logoUrl}" alt="Logo" onerror="this.style.display='none'"/>
      <div>
        <div class="empresa-nombre">SÓLIDO AUTO SERVICIO</div>
        <div class="empresa-meta">Expertos en Mecánica &amp; Detallado<br>Tel: 849-569-2027 · Santo Domingo, Rep. Dom.</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:22px;font-weight:900;color:#1e40af">${numeroOrden}</div>
      <div style="font-size:11px;color:#64748b;margin-top:3px">${new Date(diag.created_at||orden.created_at).toLocaleString("es-DO")}</div>
    </div>
  </div>
  <div class="titulo-doc">Informe de Diagnóstico Técnico</div>
  <div class="info-grid">
    <div class="info-box"><div class="box-title">👤 Cliente y Vehículo</div>
      <div class="info-row"><strong>Cliente:</strong> ${cliente?.nombre||"Particular"}</div>
      <div class="info-row"><strong>Teléfono:</strong> ${cliente?.telefono||"N/A"}</div>
      <div class="info-row"><strong>Vehículo:</strong> ${vehiculo?.marca||""} ${vehiculo?.modelo||""} ${vehiculo?.ano||""}</div>
      <div class="info-row"><strong>Placa:</strong> ${vehiculo?.placa||"N/A"}</div>
    </div>
    <div class="info-box"><div class="box-title">📋 Detalles del Servicio</div>
      <div class="info-row"><strong>Orden:</strong> ${numeroOrden}</div>
      <div class="info-row"><strong>Técnico:</strong> ${tecnicoNombre}</div>
      <div class="info-row"><strong>Tipo:</strong> ${diag.tipo_servicio||orden.descripcion||"—"}</div>
      ${diag.tiempo_estimado?`<div class="info-row"><strong>Tiempo estimado:</strong> ${diag.tiempo_estimado}</div>`:""}
    </div>
  </div>
  ${diag.descripcion||diag.fallas_identificadas?`<div class="sec-titulo">🔍 Hallazgos / Diagnóstico</div><div class="sec-texto">${diag.descripcion||diag.fallas_identificadas}</div>`:""}
  ${(diag.notas||diag.observaciones)?`<div class="sec-titulo" style="background:#fffbeb;border-left-color:#f59e0b;color:#92400e">📝 Notas</div><div class="sec-texto">${diag.notas||diag.observaciones}</div>`:""}
  ${total>0?`<div class="sec-titulo">💰 Cotización</div>
  <table><thead><tr><th>Descripción</th><th style="text-align:right;width:200px">Monto (RD$)</th></tr></thead>
  <tbody>${detalleLineas}${repuestos>0?`<tr><td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px">Repuestos e Insumos</td><td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-size:14px">RD$ ${repuestos.toLocaleString("es-DO",{minimumFractionDigits:2})}</td></tr>`:""}</tbody>
  <tfoot><tr class="total-row"><td>TOTAL PRESUPUESTO</td><td style="text-align:right">RD$ ${total.toLocaleString("es-DO",{minimumFractionDigits:2})}</td></tr></tfoot></table>`:""}
  <div class="firma-area">
    <div><div style="height:36px"></div><div class="firma-linea">Técnico Responsable: ${tecnicoNombre}</div></div>
    <div><div style="height:36px"></div><div class="firma-linea">Firma del Cliente — Conforme</div></div>
  </div>
  <div class="footer"><p>Este informe tiene validez de 15 días hábiles.</p><p><strong>SÓLIDO AUTO SERVICIO</strong> — Tel: 849-569-2027 — Santo Domingo, RD</p></div>
  </body></html>`;
  abrirImpresion(html);
}

// ── Impresión contextual según etapa de la orden ─────────────────────────────
function imprimirSegunEstado(
  orden: any, cliente: any, vehiculo: any,
  diag: any, log: any[], inspeccion: any, historial: any[] = [],
  trabajosItems: TrabajoItem[] = [], avancesRep: any[] = []
) {
  const estado = orden.estado || "RECIBIDO";
  const ETAPAS = ["RECIBIDO","DIAGNOSTICO","ESPERANDO_APROBACION","REPARACION","CONTROL_CALIDAD","LISTO","ENTREGADO","CANCELADA"];
  const idxActual = ETAPAS.indexOf(estado);
  // avancesEfectivos: preferir avancesRep (estado independiente), luego diag.avances
  const avancesEfectivos = avancesRep.length > 0 ? avancesRep : (diag?.avances || []);
  const mostrar = {
    recepcion:   true,
    inspeccion:  !!inspeccion,
    diagnostico: !!diag && idxActual >= 1,
    cotizacion:  !!diag && idxActual >= 2,
    reparacion:  (avancesEfectivos.length > 0 || trabajosItems.length > 0) && idxActual >= 3,
    calidad:     idxActual >= 4,
    entrega:     idxActual >= 6,
    cancelacion: estado === "CANCELADA",
  };
  imprimirOrdenCompleta(orden, cliente, vehiculo, diag, log, inspeccion, historial, mostrar, trabajosItems, avancesEfectivos);
}

// ── Imprimir resumen completo de la orden ─────────────────────────────────────
function imprimirOrdenCompleta(
  orden: any, cliente: any, vehiculo: any, diag: any, log: any[],
  inspeccion: any, historial: any[] = [], mostrar?: any, trabajosItems: TrabajoItem[] = [],
  avancesRep: any[] = []
) {
  const numeroOrden = orden.numero_orden || `OT-${String(orden.id).padStart(4,"0")}`;
  const fmtDate = (d: string) => d ? new Date(d).toLocaleString("es-DO",{ year:"numeric", month:"long", day:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
  const fmtMoney = (n: number) => n.toLocaleString("es-DO",{ minimumFractionDigits:2 });
  const manoObra  = Number(diag?.mano_obra  || 0);
  const repuestos = Number(diag?.repuestos  || 0);
  const totalCot  = manoObra + repuestos || Number(diag?.total || 0);

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
    return `<tr>
      <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top;width:28px;text-align:center;font-size:14px">${icon}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top">
        <span style="font-weight:700;color:${color};font-size:11px">${label}</span>
        ${e.motivo ? `<span style="font-size:10px;color:#6b7280"> — ${e.motivo}</span>` : ""}
      </td>
      <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top;font-size:10px;color:#9ca3af;white-space:nowrap">
        ${fmtDate(e.created_at)} · ${e.usuario_nombre||"Sistema"}
      </td></tr>`;
  }).join("");

  // Usar avancesRep (estado independiente) — si vacío, caer en diag.avances
  const avancesEfectivos = avancesRep.length > 0 ? avancesRep : (diag?.avances || []);
  const avancesRows = avancesEfectivos.map((av: any) => `
    <tr><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;vertical-align:top">
      <div style="font-weight:600">${av.descripcion || av.detalle || "—"}</div>
      <div style="font-size:11px;color:#9ca3af;margin-top:2px">👤 ${av.tecnico_nombre || av.usuario_nombre || "Técnico"} · ${fmtDate(av.created_at)}</div>
    </td></tr>`).join("");

  const repuestosItems: any[] = diag?.repuestos_items || [];
  const repuestosTabla = repuestosItems.length > 0 ? `
    <div style="margin-top:10px">
      <div style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:6px">REPUESTOS Y MATERIALES:</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#f1f5f9">
          <th style="padding:6px 10px;text-align:left;font-weight:700">Repuesto</th>
          <th style="padding:6px 10px;text-align:center;font-weight:700">Cant.</th>
          <th style="padding:6px 10px;text-align:right;font-weight:700">P/U</th>
          <th style="padding:6px 10px;text-align:right;font-weight:700">Subtotal</th>
        </tr></thead>
        <tbody>${repuestosItems.map((r: any) => `
          <tr style="border-bottom:1px solid #f1f5f9">
            <td style="padding:5px 10px">${r.nombre||"—"}</td>
            <td style="padding:5px 10px;text-align:center">${r.cantidad||1}</td>
            <td style="padding:5px 10px;text-align:right">RD$ ${Number(r.precio_unitario||0).toLocaleString("es-DO",{minimumFractionDigits:2})}</td>
            <td style="padding:5px 10px;text-align:right;font-weight:700">RD$ ${Number(r.subtotal||0).toLocaleString("es-DO",{minimumFractionDigits:2})}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : "";

  // Trabajos realizados tabla
  const trabajosTabla = trabajosItems.length > 0 ? `
    <div style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#475569;background:#f5f3ff;padding:6px 10px;border-radius:6px;margin-bottom:8px;border-left:3px solid #8b5cf6">
        🔧 Trabajos Realizados
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#f1f5f9">
          <th style="padding:6px 10px;text-align:left;font-weight:700">Tipo</th>
          <th style="padding:6px 10px;text-align:left;font-weight:700">Descripción</th>
          <th style="padding:6px 10px;text-align:center;font-weight:700">Estado</th>
        </tr></thead>
        <tbody>${trabajosItems.map((t: TrabajoItem) => {
          const estadoColor = t.estado === "REALIZADO" ? "#065f46" : t.estado === "PENDIENTE" ? "#92400e" : "#6b7280";
          return `<tr style="border-bottom:1px solid #f1f5f9">
            <td style="padding:5px 10px;font-weight:600">${t.tipo}</td>
            <td style="padding:5px 10px">${t.descripcion || "—"}</td>
            <td style="padding:5px 10px;text-align:center;font-weight:700;color:${estadoColor}">${t.estado.replace("_"," ")}</td>
          </tr>`;
        }).join("")}
        </tbody>
      </table>
    </div>` : "";

  // QC section
  const moDetalle = diag?.mano_de_obra_detalle || "";
  const moLineas  = moDetalle.split("\n").filter((l: string) => l.trim());
  const trabajosHtmlQC = moLineas.length > 0 ? `
    <div style="margin-bottom:10px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#5b21b6;margin-bottom:6px">🔧 Trabajos a Realizar / Realizados</div>
      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:6px;padding:8px 12px">
        ${moLineas.map((l: string) => `<div style="font-size:11px;margin-bottom:4px;padding:3px 0;border-bottom:1px solid #ede9fe">✓ ${l.trim()}</div>`).join("")}
      </div>
    </div>` : "";

  const bitacoraHtmlQC = avancesRep.length > 0 ? `
    <div style="margin-bottom:10px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#374151;margin-bottom:6px">📋 Bitácora de Reparación</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="background:#111827;color:#fff">
          <th style="padding:5px 8px;text-align:left;font-weight:700">Técnico</th>
          <th style="padding:5px 8px;text-align:left;font-weight:700">Descripción del Trabajo</th>
          <th style="padding:5px 8px;text-align:right;font-weight:700;white-space:nowrap">Fecha</th>
        </tr></thead>
        <tbody>
          ${avancesRep.map((av: any, i: number) => `
            <tr style="background:${i%2===0?"#fff":"#f9fafb"};border-bottom:1px solid #f1f5f9">
              <td style="padding:6px 8px;font-weight:700;color:#5b21b6;white-space:nowrap;vertical-align:top">${av.tecnico_nombre || av.usuario_nombre || "Técnico"}</td>
              <td style="padding:6px 8px;vertical-align:top">${(av.descripcion || av.detalle || "—").replace(/\n/g,"<br/>")}</td>
              <td style="padding:6px 8px;color:#9ca3af;text-align:right;white-space:nowrap;vertical-align:top">${av.created_at ? new Date(av.created_at).toLocaleDateString("es-DO",{day:"2-digit",month:"short",year:"numeric"}) : "—"}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>` : "";

  const qcHtml = `
    <div style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#5b21b6;background:#f5f3ff;padding:6px 10px;border-radius:6px;margin-bottom:8px;border-left:3px solid #8b5cf6">
        ✅ Control de Calidad${orden.resultado_qc ? ` — Resultado: ${orden.resultado_qc}` : ""}
      </div>
      ${trabajosHtmlQC}
      ${bitacoraHtmlQC}
      ${orden.tecnico_qc ? `<div style="font-size:12px;margin-bottom:4px"><strong>Técnico QC:</strong> ${orden.tecnico_qc}</div>` : ""}
      ${orden.observaciones_qc ? `<div style="font-size:12px;margin-bottom:8px"><strong>Observaciones QC:</strong> ${orden.observaciones_qc}</div>` : ""}
    </div>`;

  // Entrega section
  const entregaHtml = orden.fecha_entrega ? `
    <div style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#1d4ed8;background:#eff6ff;padding:6px 10px;border-radius:6px;margin-bottom:8px;border-left:3px solid #1d4ed8">
        🏁 Entrega al Cliente
      </div>
      <div style="font-size:12px;margin-bottom:3px"><strong>Fecha entrega:</strong> ${fmtDate(orden.fecha_entrega)}</div>
      ${orden.usuario_entrego ? `<div style="font-size:12px;margin-bottom:3px"><strong>Entregado por:</strong> ${orden.usuario_entrego}</div>` : ""}
      ${orden.notas_entrega ? `<div style="font-size:12px;margin-bottom:6px"><strong>Notas:</strong> ${orden.notas_entrega}</div>` : ""}
      ${orden.firma_entrega ? `<div style="margin-top:8px"><div style="font-size:10px;color:#6b7280;margin-bottom:3px">Firma del cliente:</div><img src="${orden.firma_entrega}" style="height:60px;border:1px solid #e2e8f0;border-radius:4px"/></div>` : ""}
    </div>` : "";

  // Cancelación section
  const cancelacionHtml = orden.estado === "CANCELADA" ? `
    <div style="margin-bottom:16px;background:#fef2f2;border:1.5px solid #fca5a5;border-radius:8px;padding:12px 16px">
      <div style="font-size:13px;font-weight:900;color:#7f1d1d;margin-bottom:8px">❌ ORDEN CANCELADA</div>
      ${orden.fecha_cancelacion ? `<div style="font-size:12px;margin-bottom:3px"><strong>Fecha:</strong> ${fmtDate(orden.fecha_cancelacion)}</div>` : ""}
      ${orden.usuario_cancelo ? `<div style="font-size:12px;margin-bottom:3px"><strong>Responsable:</strong> ${orden.usuario_cancelo}</div>` : ""}
      ${orden.motivo_cancelacion ? `<div style="font-size:12px"><strong>Motivo:</strong> ${orden.motivo_cancelacion}</div>` : ""}
    </div>` : "";

  const clienteNombre  = cliente?.nombre   || orden.cliente_nombre  || "Sin nombre";
  const clienteTel     = cliente?.telefono || orden.cliente_telefono || "—";
  const clienteEmail   = cliente?.email    || orden.cliente_email    || "—";
  const clienteCedula  = cliente?.cedula   || orden.cliente_cedula   || null;
  const vMarca  = vehiculo?.marca  || orden.vehiculo_marca  || "";
  const vModelo = vehiculo?.modelo || orden.vehiculo_modelo || "";
  const vAno    = vehiculo?.ano    || orden.vehiculo_ano    || "";
  const vPlaca  = vehiculo?.placa  || orden.vehiculo_placa  || "N/A";
  const vColor  = vehiculo?.color  || orden.vehiculo_color  || "—";
  const vVin    = vehiculo?.vin    || orden.vehiculo_vin    || null;

  // Normalizar zonas_danio: soporta ambos formatos
  //   recepcion  → { zona_id, tipo_danio, label }
  //   inspeccion → { zona,    tipo             }
  const _danioColorMap: Record<string,string> = {
    rayon_leve:"#f59e0b", rayon_profundo:"#ef4444",
    golpe:"#7c3aed", falta_pieza:"#1d4ed8", sin_danio:"#10b981",
  };
  const _danioLabelMap: Record<string,string> = {
    rayon_leve:"Rayón leve", rayon_profundo:"Rayón profundo",
    golpe:"Golpe", falta_pieza:"Falta pieza", sin_danio:"Sin daño",
  };
  const inspZonas = (inspeccion?.zonas_danio || []).map((z: any) => {
    const zonaLabel = z.label || (z.zona || z.zona_id || "").replace(/_/g," ");
    const tipo      = z.tipo_danio || z.tipo || "";
    const tipoLabel = _danioLabelMap[tipo] || tipo.replace(/_/g," ") || "—";
    const color     = _danioColorMap[tipo] || "#94a3b8";
    return `<span style="display:inline-flex;align-items:center;gap:4px;background:#fef9c3;border:1px solid #fde68a;color:#92400e;border-radius:5px;padding:2px 8px;font-size:11px;font-weight:600;margin:2px">
      <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
      ${zonaLabel}: ${tipoLabel}
    </span>`;
  }).join("");

  const inspFotos = (() => {
    const slots = inspeccion?.fotos_slots;
    const fotoLegacy: any[] = Array.isArray(inspeccion?.fotos) ? inspeccion.fotos : [];
    const labels: Record<string,string> = {
      frente:"Frente", trasero:"Trasero", lateral_izq:"Lat. Izq.", lateral_der:"Lat. Der.",
      interior:"Interior", tablero:"Tablero", danos_visibles:"Daños Visibles",
    };
    const slotImgs = slots
      ? ["frente","trasero","lateral_izq","lateral_der","interior","tablero","danos_visibles"]
          .filter(k => (slots as any)[k])
          .map(k => ({ src:(slots as any)[k], lbl:labels[k]||k }))
      : [];
    const legacyImgs = fotoLegacy.filter((f:any)=>f.data).map((f:any)=>({ src:f.data, lbl:f.label||f.tipo||"Foto" }));
    const allImgs = [...slotImgs, ...legacyImgs];
    const imgs = allImgs.map(f =>
      `<div style="text-align:center"><img src="${f.src}" style="width:140px;height:105px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0"/><div style="font-size:10px;color:#6b7280;margin-top:3px">${f.lbl}</div></div>`
    ).join("");
    return imgs ? `<div style="margin-top:10px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:6px">📸 Fotos de Recepción</div><div style="display:flex;gap:10px;flex-wrap:wrap">${imgs}</div></div>` : "";
  })();

  const checklist = (() => {
    if (!inspeccion) return "";
    const items = [
      ["luces_ok","💡 Luces"],["espejos_ok","🔍 Espejos"],["radio_pantalla","📻 Radio"],
      ["tapiceria_ok","🪑 Tapicería"],["alfombras_ok","🧺 Alfombras"],["bocina_ok","📣 Bocina"],
      ["gato_ok","🔩 Gato"],["llanta_repuesto_ok","🛞 Llanta rep."],
      ["documentos_ok","📄 Documentos"],["herramientas_ok","🔧 Herramientas"],
    ];
    return `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:8px">
      ${items.map(([k,l]) => {
        const ok = inspeccion[k] === true || inspeccion[k] === 1;
        return `<span style="font-size:11px"><span style="color:${ok?"#16a34a":"#dc2626"}">${ok?"✓":"✗"}</span> ${l}</span>`;
      }).join("")}
    </div>`;
  })();

  // ── Diagrama SVG de daños para el print ──────────────────────────────────
  // Mismas coordenadas que ZONAS_DANIO_MAP / ZONAS en recepcion e inspeccion
  const _ZONAS_PRINT = [
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
  const _zonasData = (inspeccion?.zonas_danio || []) as any[];
  const getDanioById = (id: string) => _zonasData.find((z: any) => (z.zona_id || z.zona) === id);

  const inspSvgDiagram = _zonasData.length > 0 ? `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 370" width="200" height="185" style="display:block;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc">
      <!-- Silueta del vehículo (top-view) -->
      <!-- Cuerpo principal -->
      <rect x="130" y="80" width="140" height="200" rx="20" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
      <!-- Capó frontal -->
      <path d="M145 80 Q200 20 255 80 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
      <!-- Maletero trasero -->
      <path d="M145 280 Q200 340 255 280 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
      <!-- Ruedas izq -->
      <rect x="90" y="110" width="40" height="50" rx="5" fill="#94a3b8"/>
      <rect x="90" y="200" width="40" height="50" rx="5" fill="#94a3b8"/>
      <!-- Ruedas der -->
      <rect x="270" y="110" width="40" height="50" rx="5" fill="#94a3b8"/>
      <rect x="270" y="200" width="40" height="50" rx="5" fill="#94a3b8"/>
      <!-- Techo / habitáculo -->
      <rect x="145" y="135" width="110" height="90" rx="5" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1.5"/>
      <!-- Marcadores de daño -->
      ${_ZONAS_PRINT.map(z => {
        const d = getDanioById(z.id);
        if (!d) return `<circle cx="${z.cx}" cy="${z.cy}" r="8" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1" opacity="0.5"/>`;
        const tipo = d.tipo_danio || d.tipo || "";
        const col = _danioColorMap[tipo] || "#94a3b8";
        const sym = tipo === "rayon_leve" ? "R" : tipo === "rayon_profundo" ? "R!" : tipo === "golpe" ? "G" : tipo === "falta_pieza" ? "FP" : "✓";
        return `<circle cx="${z.cx}" cy="${z.cy}" r="12" fill="${col}" stroke="white" stroke-width="2" opacity="0.9"/>
                <text x="${z.cx}" y="${z.cy+4}" text-anchor="middle" fill="white" font-size="8" font-weight="bold">${sym}</text>`;
      }).join("")}
    </svg>
  ` : "";

  const inspHtml = inspeccion ? `
    <div style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#475569;background:#f1f5f9;padding:6px 10px;border-radius:6px;margin-bottom:8px;border-left:3px solid #10b981">
        📋 Inspección de Recepción
      </div>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:6px 12px;font-size:13px"><strong>KM entrada:</strong> ${Number(inspeccion.km_entrada||0).toLocaleString()||"N/A"}</td>
          <td style="padding:6px 12px;font-size:13px"><strong>Combustible:</strong> ${inspeccion.nivel_combustible??"-"}%</td>
          <td style="padding:6px 12px;font-size:13px"><strong>Condición:</strong> ${inspeccion.condicion_general||"—"}</td>
        </tr>
      </table>
      ${_zonasData.length > 0 ? `
        <div style="margin-top:10px;display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
          ${inspSvgDiagram}
          <div style="flex:1;min-width:160px">
            <div style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">DAÑOS AL INGRESO</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px">${inspZonas}</div>
          </div>
        </div>
      ` : `<div style="margin-top:6px;font-size:11px;color:#9ca3af">Sin daños marcados al ingreso.</div>`}
      ${checklist}
      ${inspeccion.observaciones?`<div style="margin-top:8px;font-size:13px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 12px">📝 ${inspeccion.observaciones}</div>`:""}
      ${inspFotos}
    </div>` : "";

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Resumen de Servicio — ${numeroOrden}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;padding:18px 22px;color:#1a1a1a;line-height:1.4;max-width:820px;margin:auto;font-size:12px}
  .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #111827;padding-bottom:12px;margin-bottom:14px}
  .titulo-doc{text-align:center;font-size:13px;font-weight:700;color:#1e40af;border:1.5px solid #1e40af;padding:5px;border-radius:6px;margin-bottom:12px;text-transform:uppercase;letter-spacing:1px}
  .section-title{font-size:10px;font-weight:700;text-transform:uppercase;color:#475569;background:#f1f5f9;padding:4px 8px;border-radius:4px;margin:10px 0 6px;border-left:3px solid #334155;letter-spacing:.5px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
  .info-box{border:1px solid #e2e8f0;padding:8px 10px;border-radius:6px;background:#f8fafc}
  .info-box-title{font-size:9px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:5px;padding-bottom:4px;border-bottom:1px solid #e2e8f0;letter-spacing:.8px}
  .info-row{font-size:11px;margin-bottom:2px}
  .hallazgos{font-size:11px;padding:6px 10px;background:#fff;border:1px solid #e2e8f0;border-radius:6px;white-space:pre-wrap;line-height:1.5}
  table.timeline{width:100%;border-collapse:collapse;background:#fff;border:1px solid #f1f5f9}
  .firmas{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:30px}
  .firma-line{border-top:1px solid #111;padding-top:5px;text-align:center;font-size:10px;color:#64748b}
  .footer{text-align:center;margin-top:16px;padding-top:8px;border-top:1px dashed #cbd5e1;color:#94a3b8;font-size:9px;line-height:1.8}
  @media print{@page{margin:8mm 10mm}body{padding:0}}
</style></head><body>
<div class="header">
  <div style="display:flex;align-items:center;gap:12px">
    <img src="${window.location.origin}/logo.png" alt="Logo" style="height:60px;max-width:180px;object-fit:contain;border-radius:6px" onerror="this.style.display='none'"/>
    <div>
      <div style="font-size:18px;font-weight:900;letter-spacing:-0.5px">SÓLIDO AUTO SERVICIO</div>
      <div style="font-size:10px;color:#6b7280;margin-top:2px;line-height:1.4">Expertos en Mecánica &amp; Detallado<br>Tel: 849-569-2027 · Santo Domingo, Rep. Dom.</div>
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:18px;font-weight:900;color:#1e40af">${numeroOrden}</div>
    <div style="font-size:10px;color:#6b7280;margin-top:2px">Recibido: ${fmtDate(orden.created_at)}</div>
    ${orden.fecha_entrega ? `<div style="font-size:10px;color:#6b7280">Entregado: ${fmtDate(orden.fecha_entrega)}</div>` : ""}
    <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;border:1.5px solid ${EST[orden.estado]?.color||"#374151"};color:${EST[orden.estado]?.color||"#374151"};margin-top:4px">
      ${EST[orden.estado]?.icon||""} ${EST[orden.estado]?.label||orden.estado}
    </span>
  </div>
</div>
<div class="titulo-doc">${mostrar?.entrega ? "Resumen Completo de Servicio" : mostrar?.calidad ? "Informe hasta Control de Calidad" : mostrar?.reparacion ? "Informe de Reparación" : mostrar?.cotizacion ? "Diagnóstico y Cotización" : "Orden de Trabajo — Recepción"}</div>
<div class="info-grid">
  <div class="info-box"><div class="info-box-title">👤 Cliente</div>
    <div class="info-row"><strong>${clienteNombre}</strong></div>
    <div class="info-row">📞 ${clienteTel}</div>
    <div class="info-row">✉️ ${clienteEmail}</div>
    ${clienteCedula ? `<div class="info-row">🪪 ${clienteCedula}</div>` : ""}
  </div>
  <div class="info-box"><div class="info-box-title">🚗 Vehículo</div>
    <div class="info-row"><strong>${vMarca} ${vModelo} ${vAno}</strong></div>
    <div class="info-row">🪪 Placa: <strong style="font-family:monospace">${vPlaca}</strong></div>
    <div class="info-row">🎨 Color: ${vColor}</div>
    ${vVin ? `<div class="info-row">VIN: ${vVin}</div>` : ""}
  </div>
</div>
<div class="section-title">📝 Trabajo Solicitado</div>
<div class="hallazgos">${orden.descripcion||"Sin descripción"}</div>
${inspHtml}
${(mostrar ? mostrar.diagnostico : !!diag) ? `
<div class="section-title">🔬 Diagnóstico Técnico</div>
<div class="info-grid" style="margin-bottom:8px">
  <div class="info-box"><div class="info-box-title">Técnico</div><div class="info-row"><strong>${diag.tecnico_nombre||diag.usuario_nombre||"—"}</strong></div><div class="info-row">Tipo: ${diag.tipo_servicio||"—"}</div>${diag.tiempo_estimado?`<div class="info-row">Tiempo: ${diag.tiempo_estimado}</div>`:""}</div>
  <div class="info-box"><div class="info-box-title">Estado</div><div class="info-row"><strong>${diag.estado||"—"}</strong></div><div class="info-row">Registrado: ${fmtDate(diag.created_at)}</div></div>
</div>
${diag.descripcion||diag.fallas_identificadas?`<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:4px">Hallazgos</div><div class="hallazgos">${diag.descripcion||diag.fallas_identificadas}</div></div>`:""}
${diag.mano_de_obra_detalle?`<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:4px">Trabajos</div><div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px 12px">${(diag.mano_de_obra_detalle||"").split("\n").filter((l:string)=>l.trim()).map((l:string)=>`<div style="font-size:11px;margin-bottom:2px">✓ ${l.trim()}</div>`).join("")}</div></div>`:""}
${repuestosTabla}
${(mostrar ? mostrar.cotizacion : totalCot > 0) && totalCot > 0 ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px 12px;margin-bottom:10px"><div style="font-size:11px;font-weight:700;color:#065f46;margin-bottom:6px">💰 Costos</div><table style="width:100%;border-collapse:collapse"><tr style="border-bottom:1px solid #d1fae5"><td style="padding:4px 0;font-size:11px">Mano de obra</td><td style="padding:4px 0;font-size:11px;text-align:right;font-weight:700">RD$ ${fmtMoney(manoObra)}</td></tr>${repuestos>0?`<tr style="border-bottom:1px solid #d1fae5"><td style="padding:4px 0;font-size:11px">Repuestos</td><td style="padding:4px 0;font-size:11px;text-align:right;font-weight:700">RD$ ${fmtMoney(repuestos)}</td></tr>`:""}<tr><td style="padding:8px 0 0;font-size:14px;font-weight:900;color:#065f46">TOTAL</td><td style="padding:8px 0 0;font-size:14px;font-weight:900;color:#065f46;text-align:right">RD$ ${fmtMoney(totalCot)}</td></tr></table></div>` : ""}
` : ""}
${(mostrar ? mostrar.reparacion : true) && trabajosItems.length > 0 ? trabajosTabla : ""}
${(mostrar ? mostrar.reparacion : avancesEfectivos.length > 0) && avancesEfectivos.length > 0 ? `<div class="section-title">🔧 Avances de Reparación</div><table class="timeline">${avancesRows}</table>` : ""}
${(mostrar ? mostrar.calidad : true) ? qcHtml : ""}
${(mostrar ? mostrar.entrega : true) ? entregaHtml : ""}
${(mostrar ? mostrar.cancelacion : true) ? cancelacionHtml : ""}
<div class="section-title">📜 Historial del Proceso</div>
${log?.length > 0 ? `<table class="timeline"><thead><tr style="background:#111827;color:#fff"><th style="padding:10px 14px;font-size:12px;font-weight:700;width:36px"></th><th style="padding:10px 14px;font-size:12px;font-weight:700;text-align:left">Estado</th><th style="padding:10px 14px;font-size:12px;font-weight:700;text-align:left">Fecha y Usuario</th></tr></thead><tbody>${timelineRows}</tbody></table>` : `<div style="font-size:11px;color:#9ca3af;padding:8px">Sin historial.</div>`}
${historial.length > 0 ? `<div class="section-title" style="border-left-color:#6366f1;color:#4338ca">Historial del Vehículo</div><table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #f1f5f9"><thead><tr style="background:#1e1b4b;color:#fff"><th style="padding:5px 8px;font-size:9px;text-align:left">Fecha</th><th style="padding:5px 8px;font-size:9px;text-align:left">Tipo</th><th style="padding:5px 8px;font-size:9px;text-align:left">Diagnóstico</th><th style="padding:5px 8px;font-size:9px;text-align:right">Total</th></tr></thead><tbody>${historial.slice(0,8).map((h:any)=>`<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:4px 8px;font-size:10px;color:#6b7280;white-space:nowrap">${h.fecha_servicio?new Date(h.fecha_servicio).toLocaleDateString("es-DO"):"—"}</td><td style="padding:4px 8px;font-size:10px;font-weight:600">${h.tipo_servicio||"—"}</td><td style="padding:4px 8px;font-size:10px">${((h.diagnostico_general||h.descripcion||"—")).substring(0,80)}${(h.diagnostico_general||h.descripcion||"").length>80?"…":""}</td><td style="padding:4px 8px;font-size:10px;text-align:right;font-weight:700;color:#065f46">RD$ ${Number(h.total_cobrado||h.mano_obra||0).toLocaleString("es-DO",{minimumFractionDigits:2})}</td></tr>`).join("")}</tbody></table>` : ""}
<div class="firmas">
  <div style="margin-top:10px"><div style="height:32px"></div><div class="firma-line">Técnico / Responsable del Servicio</div></div>
  <div style="margin-top:10px"><div style="height:32px"></div><div class="firma-line">Firma del Cliente — Conforme</div></div>
</div>
<div class="footer">
  <p>Este documento certifica que el vehículo fue recibido, diagnosticado y devuelto conforme a lo indicado.</p>
  <p><strong>SÓLIDO AUTO SERVICIO</strong> · Tel: 849-569-2027 · Santo Domingo, República Dominicana · Impreso el ${new Date().toLocaleDateString("es-DO",{year:"numeric",month:"long",day:"numeric"})}</p>
</div>
</body></html>`;
  abrirImpresion(html);
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function OrdenDetallePage() {
  const { id }  = useParams() as { id: string };
  const router  = useRouter();

  const [data,      setData]     = useState<any>(null);
  const [loading,   setLoading]  = useState(true);
  const [usuario,   setUsuario]  = useState<any>(null);
  const [msg,       setMsg]      = useState<{ tipo:"ok"|"err"; texto:string } | null>(null);
  const [historial, setHistorial]= useState<any[]>([]);

  const [modalAccion,  setModalAccion]  = useState<"aprobar"|"rechazar"|"calidad"|"calidad-rechazada"|"entregar"|null>(null);
  const [motivoModal,  setMotivoModal]  = useState("");
  const [procesando,   setProcesando]   = useState(false);
  const [mostrarInspFotos, setMostrarInspFotos] = useState(false);

  // Avances cargados de forma independiente (siempre actualizados)
  const [avancesReparacion, setAvancesReparacion] = useState<any[]>([]);

  // Nuevos estados
  const [trabajosItems,    setTrabajosItems]    = useState<TrabajoItem[]>([]);
  const [guardandoTrabajos,setGuardandoTrabajos]= useState(false);
  const [qcData,           setQcData]           = useState({ tecnico_qc:"", checklist_qc:{} as Record<string,boolean>, observaciones_qc:"" });
  const [entregaData,      setEntregaData]      = useState({ notas_entrega:"", firma_entrega:"", usuario_entrego:"" });
  const [facturaOrden,     setFacturaOrden]     = useState<any>(null);

  // Canvas de firma
  const firmaCanvasRef = useRef<HTMLCanvasElement>(null);
  const [firmaDibujando, setFirmaDibujando] = useState(false);
  const firmaLastPos = useRef<{x:number;y:number}|null>(null);

  // ── Canvas firma helpers ───────────────────────────────────────────────────
  const getPosCanvas = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const iniciarFirma = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = firmaCanvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    setFirmaDibujando(true);
    const pos = getPosCanvas(e, canvas);
    firmaLastPos.current = pos;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2);
      ctx.fillStyle = "#1d4ed8";
      ctx.fill();
    }
  };

  const continuarFirma = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!firmaDibujando) return;
    const canvas = firmaCanvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext("2d");
    if (!ctx || !firmaLastPos.current) return;
    const pos = getPosCanvas(e, canvas);
    ctx.beginPath();
    ctx.moveTo(firmaLastPos.current.x, firmaLastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    firmaLastPos.current = pos;
  };

  const terminarFirma = () => {
    setFirmaDibujando(false);
    firmaLastPos.current = null;
    capturarFirma();
  };

  const limpiarFirma = () => {
    const canvas = firmaCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setEntregaData(prev => ({ ...prev, firma_entrega: "" }));
  };

  const capturarFirma = () => {
    const canvas = firmaCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setEntregaData(prev => ({ ...prev, firma_entrega: dataUrl }));
  };

  // ── Carga con fallback robusto ─────────────────────────────────────────────
  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`${API}/ordenes/${id}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json?.orden) {
          let finalData: any = { ...json };
          if (!json.diagnostico) {
            try {
              const diagRes = await fetch(`${API}/diagnosticos?orden_id=${id}`).then(r => r.ok ? r.json() : null).catch(() => null);
              let diag: any = null;
              if (Array.isArray(diagRes) && diagRes.length > 0) {
                diag = diagRes.find((d: any) => String(d.orden_id) === String(id)) || diagRes[0];
              } else if (diagRes && !Array.isArray(diagRes) && diagRes.id) {
                diag = diagRes;
              }
              if (diag) {
                // Cargar avances y adjuntarlos al diagnóstico
                let avances: any[] = [];
                try {
                  const avRes = await fetch(`${API}/avances/${id}`).then(r => r.ok ? r.json() : []).catch(() => []);
                  avances = Array.isArray(avRes) ? avRes : [];
                } catch (_e2) {}
                finalData = { ...finalData, diagnostico: { ...diag, avances } };
              } else {
                // Sin diagnóstico aún, igual cargamos avances por si acaso
                try {
                  const avRes = await fetch(`${API}/avances/${id}`).then(r => r.ok ? r.json() : []).catch(() => []);
                  const avances = Array.isArray(avRes) ? avRes : [];
                  finalData = { ...finalData, _avances: avances };
                } catch (_e2) {}
              }
            } catch (_e) {}
          } else if (finalData.diagnostico) {
            // diagnostico ya venía en la respuesta — cargar avances igual
            try {
              const avRes = await fetch(`${API}/avances/${id}`).then(r => r.ok ? r.json() : []).catch(() => []);
              const avances = Array.isArray(avRes) ? avRes : [];
              finalData = { ...finalData, diagnostico: { ...finalData.diagnostico, avances } };
            } catch (_e) {}
          }
          setData(finalData);

          // Poblar trabajosItems — puede ser array o JSON string
          const rawItems = finalData.diagnostico?.trabajos_realizados_items;
          let items: any[] = [];
          if (Array.isArray(rawItems)) {
            items = rawItems;
          } else if (typeof rawItems === "string" && rawItems.trim().startsWith("[")) {
            try { items = JSON.parse(rawItems); } catch { items = []; }
          }
          if (items.length > 0) {
            setTrabajosItems(items);
          } else if (finalData.diagnostico?.avances?.length > 0) {
            setTrabajosItems(finalData.diagnostico.avances.map((av: any) => ({
              id: String(av.id),
              tipo: "Mecánica general",
              descripcion: av.descripcion || "",
              estado: "REALIZADO" as const,
            })));
          }

          const vehiculoId = json.vehiculo?.id || json.orden?.vehiculo_id;
          if (vehiculoId) {
            fetch(`${API}/vehiculo-historial/vehiculo/${vehiculoId}`)
              .then(r => r.ok ? r.json() : [])
              .then(h => setHistorial(Array.isArray(h) ? h : []))
              .catch(() => {});
          }
          setLoading(false);
          return;
        }
      }

      // Fallback: construir desde listado
      const [listRes, diagRes, logRes, inspRes, avRes, facturasRes] = await Promise.all([
        fetch(`${API}/ordenes`).then(r => r.ok ? r.json() : []),
        fetch(`${API}/diagnosticos?orden_id=${id}`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API}/ordenes/${id}/log`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API}/inspeccion/orden/${id}`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API}/avances/${id}`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API}/facturas?orden_id=${id}`).then(r => r.ok ? r.json() : []).catch(() => []),
      ]);

      const lista = Array.isArray(listRes) ? listRes : [];
      const ordenBase = lista.find((o: any) => String(o.id) === String(id)) || null;
      if (!ordenBase) { setData(null); setLoading(false); return; }

      const [clienteRes, vehiculoRes] = await Promise.all([
        ordenBase.cliente_id
          ? fetch(`${API}/clientes/${ordenBase.cliente_id}`).then(r => r.ok ? r.json() : null).catch(() => null)
          : Promise.resolve(null),
        ordenBase.vehiculo_id
          ? fetch(`${API}/vehiculos/${ordenBase.vehiculo_id}`).then(r => r.ok ? r.json() : null).catch(() => null)
          : Promise.resolve(null),
      ]);

      let diag = null;
      if (Array.isArray(diagRes) && diagRes.length > 0) diag = diagRes[0];
      else if (diagRes && !Array.isArray(diagRes) && diagRes.id) diag = diagRes;
      if (diag) diag = { ...diag, avances: Array.isArray(avRes) ? avRes : [] };

      const finalData = {
        orden: { ...ordenBase, numero_orden: ordenBase.numero_orden || `OT-${String(ordenBase.id).padStart(4,"0")}` },
        cliente: clienteRes, vehiculo: vehiculoRes,
        diagnostico: diag, log: Array.isArray(logRes) ? logRes : [], inspeccion: inspRes,
      };
      setData(finalData);

      // Guardar factura activa de esta orden (para validar pago antes de entregar)
      const facturasArr = Array.isArray(facturasRes) ? facturasRes : [];
      const factActiva = facturasArr.find((f: any) => f.estado !== "CANCELADA") || null;
      setFacturaOrden(factActiva);

      const rawItems2 = diag?.trabajos_realizados_items;
      let items2: any[] = [];
      if (Array.isArray(rawItems2)) {
        items2 = rawItems2;
      } else if (typeof rawItems2 === "string" && rawItems2.trim().startsWith("[")) {
        try { items2 = JSON.parse(rawItems2); } catch { items2 = []; }
      }
      if (items2.length > 0) {
        setTrabajosItems(items2);
      } else if (diag?.avances?.length > 0) {
        setTrabajosItems(diag.avances.map((av: any) => ({
          id: String(av.id), tipo: "Mecánica general",
          descripcion: av.descripcion || "", estado: "REALIZADO" as const,
        })));
      }
    } catch (err) {
      console.error("Error cargando orden:", err);
      setData(null);
    }
    setLoading(false);

    // Siempre cargar avances por separado — fuente de verdad independiente
    try {
      const avRes = await fetch(`${API}/avances/${id}`).then(r => r.ok ? r.json() : []).catch(() => []);
      const lista = Array.isArray(avRes) ? avRes : [];
      setAvancesReparacion(lista);
    } catch (_e) {}
  }, [id]);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("usuario") || "{}");
      setUsuario(u);
      setQcData(prev => ({ ...prev, tecnico_qc: u?.nombre || "" }));
      setEntregaData(prev => ({ ...prev, usuario_entrego: u?.nombre || "" }));
    } catch (_e) {}
    cargar();
  }, [cargar]);

  // ── Guardar trabajos realizados ─────────────────────────────────────────────
  const guardarTrabajos = async () => {
    const diagnostico = data?.diagnostico;
    if (!diagnostico?.id) return;
    setGuardandoTrabajos(true);
    try {
      await fetch(`${API}/diagnosticos/${diagnostico.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trabajos_realizados_items: trabajosItems }),
      });
      setMsg({ tipo:"ok", texto:"Trabajos guardados correctamente." });
    } catch {
      setMsg({ tipo:"err", texto:"Error al guardar trabajos." });
    }
    setGuardandoTrabajos(false);
  };

  // ── Acción de flujo ───────────────────────────────────────────────────────
  const ejecutarAccion = async (accion: string) => {
    setProcesando(true);
    setMsg(null);
    try {
      const endpointMap: Record<string,string> = {
        aprobar: "aprobar", rechazar: "rechazar",
        calidad: "calidad-aprobada",
        "calidad-rechazada": "calidad-rechazada",
        entregar: "entregar",
      };
      const endpoint = endpointMap[accion] || accion;

      let body: Record<string, any> = {
        usuario_id: usuario?.id,
        usuario_nombre: usuario?.nombre,
        motivo: motivoModal,
      };

      if (accion === "calidad") {
        body = { ...body, tecnico_qc: qcData.tecnico_qc || usuario?.nombre, checklist_qc: qcData.checklist_qc, observaciones_qc: qcData.observaciones_qc };
      } else if (accion === "calidad-rechazada") {
        body = { ...body, tecnico_qc: qcData.tecnico_qc || usuario?.nombre, checklist_qc: qcData.checklist_qc, observaciones_qc: qcData.observaciones_qc };
      } else if (accion === "entregar") {
        body = { ...body, notas_entrega: entregaData.notas_entrega, firma_entrega: entregaData.firma_entrega, usuario_entrego: entregaData.usuario_entrego || usuario?.nombre };
      }

      const res  = await fetch(`${API}/ordenes/${id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMsg({ tipo:"ok", texto: json.mensaje || "Acción ejecutada correctamente." });
      setModalAccion(null);
      setMotivoModal("");
      await cargar();
    } catch (err: any) {
      setMsg({ tipo:"err", texto: err.message });
      // Refrescar siempre — el estado real puede haber cambiado aunque hubo error
      await cargar();
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
      <button onClick={() => { setLoading(true); cargar(); }}
        style={{ padding:"8px 18px", background:"#3b82f6", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:700, marginRight:10 }}>
        🔄 Reintentar
      </button>
      <button onClick={() => router.push("/ordenes")}
        style={{ padding:"8px 18px", background:"#f3f4f6", border:"none", borderRadius:8, cursor:"pointer", fontWeight:600 }}>
        ← Volver a Órdenes
      </button>
    </div>
  );

  const { orden, cliente, vehiculo, diagnostico, log, inspeccion } = data;
  const estado  = orden.estado || "RECIBIDO";
  const estCfg  = EST[estado] || EST.RECIBIDO;

  // ── Permisos por rol ─────────────────────────────────────────────────────────
  const rolUsuario    = (usuario?.rol || "tecnico").toLowerCase();
  const puedeAprobar  = ["gerente","secretaria","admin"].includes(rolUsuario);
  const puedeCalidad  = ["gerente","admin"].includes(rolUsuario);
  const puedeEntregar = ["gerente","secretaria","admin"].includes(rolUsuario);

  const accionesFlujo: { key: string; label: string; color: string }[] = [];
  if (estado === "ESPERANDO_APROBACION" && puedeAprobar) {
    accionesFlujo.push(
      { key:"aprobar",  label:"✅ Cliente Aprobó",  color:"#16a34a" },
      { key:"rechazar", label:"❌ Cliente Rechazó",  color:"#dc2626" },
    );
  }
  // Los botones de QC viven dentro de la sección Control de Calidad (con checklist completo)
  // No se duplican aquí para evitar doble envío al servidor
  if (estado === "LISTO" && puedeEntregar && facturaOrden) {
    accionesFlujo.push({ key:"entregar", label:"🏁 Vehículo Entregado", color:"#1d4ed8" });
  }

  let botonTaller: { label: string; href: string; color: string } | null = null;
  if (["RECIBIDO","DIAGNOSTICO"].includes(estado)) {
    botonTaller = { label:"🔬 Ir al Taller — Diagnóstico", href:`/taller/diagnostico/${id}`, color:"#f59e0b" };
  } else if (estado === "REPARACION") {
    botonTaller = { label:"🔧 Ir al Taller — Reparación", href:`/taller/reparacion/${id}`, color:"#ef4444" };
  }

  // Acción directa: completar reparación → CONTROL_CALIDAD
  const puedeCompletarReparacion = estado === "REPARACION";

  const card: React.CSSProperties = {
    background:"#fff", borderRadius:14, padding:20,
    marginBottom:16, boxShadow:"0 1px 6px rgba(0,0,0,0.07)",
  };
  const sTitle: React.CSSProperties = {
    fontWeight:800, fontSize:15, color:"#111", marginBottom:14,
    paddingBottom:8, borderBottom:"1px solid #f3f4f6",
    display:"flex", alignItems:"center", justifyContent:"space-between",
  };
  const fmtDate = (d: string) => d ? new Date(d).toLocaleString("es-DO",{ year:"numeric", month:"long", day:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";

  return (
    <div style={{ padding:"24px 28px", maxWidth:1000, margin:"0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, flexWrap:"wrap" }}>
        <button onClick={() => router.push("/ordenes")}
          style={{ background:"#f3f4f6", border:"none", borderRadius:8, padding:"7px 14px", cursor:"pointer", fontSize:13, fontWeight:600 }}>
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
        <span style={{ background: estCfg.bg, color: estCfg.color, padding:"6px 18px", borderRadius:20, fontWeight:800, fontSize:14, border:`1.5px solid ${estCfg.color}44` }}>
          {estCfg.icon} {estCfg.label}
        </span>
        {cliente?.telefono && (
          <a href={`https://wa.me/${cliente.telefono.replace(/\D/g,"")}?text=${encodeURIComponent(`Hola ${cliente.nombre}, le escribimos de Sólido Auto Servicio sobre su vehículo ${vehiculo?.placa || vehiculo?.marca || ""}.`)}`}
            target="_blank" rel="noreferrer"
            style={{ background:"#25d366", color:"#fff", padding:"7px 14px", borderRadius:8, fontWeight:700, fontSize:13, textDecoration:"none", display:"flex", alignItems:"center", gap:5 }}>
            💬 WhatsApp
          </a>
        )}
        <button
          onClick={() => imprimirSegunEstado(orden, cliente, vehiculo, diagnostico, log, inspeccion, historial, trabajosItems, avancesReparacion)}
          style={{ background:"#111827", color:"#fff", padding:"7px 16px", borderRadius:8, fontWeight:700, fontSize:13, border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
          🖨️ Imprimir {estado === "RECIBIDO" ? "Recepción" : estado === "ESPERANDO_APROBACION" ? "Cotización" : estado === "REPARACION" ? "Reparación" : estado === "ENTREGADO" ? "Resumen Final" : "Resumen"}
        </button>
      </div>

      {/* ── Feedback ── */}
      {msg && (
        <div style={{ padding:"10px 16px", borderRadius:10, marginBottom:16, fontWeight:600, fontSize:14,
          background: msg.tipo === "ok" ? "#d1fae5" : "#fee2e2",
          color:      msg.tipo === "ok" ? "#065f46" : "#991b1b",
          border:`1px solid ${msg.tipo === "ok" ? "#6ee7b7" : "#fca5a5"}` }}>
          {msg.tipo === "ok" ? "✅" : "❌"} {msg.texto}
        </div>
      )}

      {/* ── Banner informativo para técnico en etapas que requieren aprobación ── */}
      {accionesFlujo.length === 0 && estado === "ESPERANDO_APROBACION" && !puedeAprobar && (
        <div style={{ ...card, borderLeft:"4px solid #f59e0b", background:"#fffbeb", display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:22 }}>⏳</span>
          <div>
            <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#92400e" }}>Esperando aprobación del cliente</p>
            <p style={{ margin:"2px 0 0", fontSize:12, color:"#b45309" }}>Secretaría/Gerencia contactará al cliente para aprobar o rechazar la cotización.</p>
          </div>
        </div>
      )}

      {/* ── Banner de acción requerida ── */}
      {accionesFlujo.length > 0 && (
        <div style={{ ...card, borderLeft:`4px solid ${accionesFlujo[0].color}`, background: accionesFlujo[0].color + "08",
          display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div>
            <p style={{ margin:0, fontWeight:800, fontSize:15, color:"#111" }}>⚡ Acción requerida</p>
            <p style={{ margin:"2px 0 0", fontSize:13, color:"#6b7280" }}>
              {estado === "ESPERANDO_APROBACION" && "El cliente necesita ser contactado para aprobar o rechazar la cotización."}
              {estado === "CONTROL_CALIDAD"      && "Realiza el control de calidad antes de notificar al cliente que el vehículo está listo."}
              {estado === "LISTO"                && "El vehículo está listo. Procesa la entrega cuando el cliente llegue."}
            </p>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            {accionesFlujo.map(a => (
              <button key={a.key}
                onClick={() => { setModalAccion(a.key as any); setMotivoModal(""); }}
                style={{ padding:"10px 22px", background:a.color, color:"#fff", border:"none", borderRadius:10, cursor:"pointer", fontWeight:800, fontSize:14, boxShadow:`0 4px 14px ${a.color}44` }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Botón taller ── */}
      {botonTaller && (
        <div style={{ marginBottom:16, display:"flex", gap:10, flexWrap:"wrap" }}>
          <Link href={botonTaller.href} style={{ flex:1 }}>
            <button style={{ width:"100%", padding:"12px 20px", borderRadius:11, background: botonTaller.color + "15",
              color: botonTaller.color, border:`1.5px solid ${botonTaller.color}44`, cursor:"pointer", fontWeight:800, fontSize:14,
              display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
              {botonTaller.label}
              <span style={{ fontSize:12, fontWeight:500, opacity:0.8 }}>→ Módulo Taller</span>
            </button>
          </Link>
          {/* Completar reparación directo desde esta vista */}
          {puedeCompletarReparacion && (
            <button
              onClick={async () => {
                setProcesando(true);
                setMsg(null);
                try {
                  const res = await fetch(`${API}/ordenes/${id}/completar-reparacion`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ usuario_id: usuario?.id, usuario_nombre: usuario?.nombre, motivo: "Reparación completada" }),
                  });
                  const json = await res.json();
                  if (json.error) throw new Error(json.error);
                  setMsg({ tipo:"ok", texto:"Reparación completada — orden en Control de Calidad." });
                  await cargar();
                } catch (err: any) {
                  setMsg({ tipo:"err", texto: err.message });
                }
                setProcesando(false);
              }}
              disabled={procesando}
              style={{ padding:"12px 20px", borderRadius:11, background:"#7c3aed15", color:"#7c3aed",
                border:"1.5px solid #7c3aed44", cursor:"pointer", fontWeight:800, fontSize:14,
                display:"flex", alignItems:"center", gap:8, whiteSpace:"nowrap" }}>
              ✅ Completar Reparación → QC
            </button>
          )}
        </div>
      )}

      {/* ── Grid: cliente + vehículo ── */}
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
          ) : orden.cliente_nombre ? (
            <p style={{ margin:0, fontWeight:700, fontSize:15 }}>{orden.cliente_nombre}</p>
          ) : <p style={{ color:"#9ca3af", margin:0 }}>Sin cliente registrado</p>}
        </div>
        <div style={card}>
          <div style={sTitle as any}>🚗 Vehículo</div>
          {vehiculo ? (
            <>
              <p style={{ margin:"0 0 5px", fontWeight:700, fontSize:16 }}>{vehiculo.marca} {vehiculo.modelo} {vehiculo.ano}</p>
              <p style={{ margin:"0 0 3px", color:"#6b7280", fontSize:13 }}>🪪 Placa: <strong style={{ color:"#111", fontFamily:"monospace" }}>{vehiculo.placa}</strong></p>
              <p style={{ margin:"0 0 3px", color:"#6b7280", fontSize:13 }}>🎨 Color: {vehiculo.color || "—"}</p>
              {vehiculo.vin && <p style={{ margin:0, color:"#6b7280", fontSize:13 }}>VIN: {vehiculo.vin}</p>}
            </>
          ) : (orden.vehiculo_info && orden.vehiculo_info !== "—") ? (
            <>
              <p style={{ margin:"0 0 4px", fontWeight:700, fontSize:15 }}>{orden.vehiculo_info}</p>
              {orden.vehiculo_placa && <p style={{ margin:0, color:"#6b7280", fontSize:13 }}>Placa: <strong style={{ color:"#111", fontFamily:"monospace" }}>{orden.vehiculo_placa}</strong></p>}
            </>
          ) : <p style={{ color:"#9ca3af", margin:0 }}>Sin vehículo</p>}
        </div>
      </div>

      {/* ── Trabajo solicitado ── */}
      <div style={{ ...card, marginTop:16, borderLeft:"4px solid #3b82f6" }}>
        <div style={sTitle as any}>📝 Trabajo Solicitado</div>
        <p style={{ margin:0, fontSize:14, color:"#374151", lineHeight:1.6 }}>{orden.descripcion || "Sin descripción del trabajo."}</p>
      </div>

      {/* ── Inspección de recepción ── */}
      {inspeccion ? (
        <div style={{ ...card, marginTop:16, borderLeft:"4px solid #10b981" }}>
          <div style={sTitle as any}>
            <span>📋 Inspección de Recepción</span>
            <Link href={`/inspeccion/${id}`} style={{ fontSize:12, color:"#059669", fontWeight:600, textDecoration:"none" }}>Ver completa →</Link>
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
          {inspeccion.fotos_slots && Object.values(inspeccion.fotos_slots).some(Boolean) && (
            <>
              <button onClick={() => setMostrarInspFotos(v => !v)}
                style={{ background:"transparent", border:"none", color:"#059669", fontWeight:600, fontSize:12, cursor:"pointer", padding:0, marginBottom:6 }}>
                {mostrarInspFotos ? "▲ Ocultar fotos" : "▼ Ver 4 fotos del vehículo"}
              </button>
              {mostrarInspFotos && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8, marginTop:6 }}>
                  {(["frente","trasero","lateral_izq","lateral_der"] as const).map(k => {
                    const img = inspeccion.fotos_slots?.[k];
                    const lbl: Record<string,string> = { frente:"Frente", trasero:"Trasero", lateral_izq:"Lat. Izq.", lateral_der:"Lat. Der." };
                    return img ? (
                      <div key={k} style={{ textAlign:"center" }}>
                        <img src={img} alt={lbl[k]} style={{ width:"100%", aspectRatio:"4/3", objectFit:"cover", borderRadius:8, border:"1px solid #e5e7eb" }} />
                        <p style={{ margin:"3px 0 0", fontSize:10, color:"#9ca3af" }}>{lbl[k]}</p>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </>
          )}
          {!inspeccion.fotos_slots && inspeccion.fotos?.length > 0 && (
            <>
              <button onClick={() => setMostrarInspFotos(v => !v)}
                style={{ background:"transparent", border:"none", color:"#059669", fontWeight:600, fontSize:12, cursor:"pointer", padding:0, marginBottom:6 }}>
                {mostrarInspFotos ? "▲ Ocultar fotos" : `▼ Ver fotos (${inspeccion.fotos.length})`}
              </button>
              {mostrarInspFotos && (
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:6 }}>
                  {inspeccion.fotos.map((f: any, i: number) => (
                    <img key={i} src={f.data} alt={f.label} style={{ width:80, height:62, objectFit:"cover", borderRadius:8, border:"1px solid #e5e7eb" }} />
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

      {/* ── Diagnóstico Técnico ── */}
      <div style={{ ...card, marginTop:16, borderLeft:"4px solid #f59e0b" }}>
        <div style={sTitle as any}>
          <span>🔬 Diagnóstico Técnico</span>
          <div style={{ display:"flex", gap:8 }}>
            {diagnostico && (
              <button onClick={() => imprimirDiagnostico(orden, cliente, vehiculo, diagnostico)}
                style={{ padding:"6px 14px", background:"#1e40af", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:12 }}>
                🖨️ Cotización
              </button>
            )}
            <Link href={`/taller/diagnostico/${id}`} style={{ padding:"6px 14px", background:"#fef3c7", color:"#92400e", border:"none", borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:12, textDecoration:"none", display:"flex", alignItems:"center" }}>
              ✏️ Editar diagnóstico →
            </Link>
          </div>
        </div>

        {diagnostico ? (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:14, fontSize:13 }}>
              <div>
                <span style={{ color:"#6b7280", fontSize:11, fontWeight:700, textTransform:"uppercase" }}>Técnico</span>
                <p style={{ margin:"3px 0 0", fontWeight:700 }}>{diagnostico.tecnico_nombre || diagnostico.usuario_nombre || "—"}</p>
              </div>
              <div>
                <span style={{ color:"#6b7280", fontSize:11, fontWeight:700, textTransform:"uppercase" }}>Tipo de servicio</span>
                <p style={{ margin:"3px 0 0", fontWeight:700 }}>{diagnostico.tipo_servicio || "—"}</p>
              </div>
              <div>
                <span style={{ color:"#6b7280", fontSize:11, fontWeight:700, textTransform:"uppercase" }}>Fecha diagnóstico</span>
                <p style={{ margin:"3px 0 0", fontWeight:700 }}>{diagnostico.created_at ? new Date(diagnostico.created_at).toLocaleDateString("es-DO") : "—"}</p>
              </div>
            </div>

            {(diagnostico.descripcion || diagnostico.fallas_identificadas) && (
              <div style={{ marginBottom:14 }}>
                <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#6b7280", textTransform:"uppercase" }}>Hallazgos / Fallas</p>
                <div style={{ background:"#f9fafb", border:"1px solid #f1f5f9", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#374151", whiteSpace:"pre-wrap", lineHeight:1.6 }}>
                  {diagnostico.descripcion || diagnostico.fallas_identificadas}
                </div>
              </div>
            )}

            {diagnostico.mano_de_obra_detalle && (
              <div style={{ marginBottom:14 }}>
                <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#6b7280", textTransform:"uppercase" }}>Trabajos a realizar</p>
                <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8, padding:"10px 14px" }}>
                  {(diagnostico.mano_de_obra_detalle || "").split("\n").filter((l: string) => l.trim()).map((l: string, i: number) => (
                    <div key={i} style={{ fontSize:13, marginBottom:3 }}>✓ {l.trim()}</div>
                  ))}
                </div>
              </div>
            )}

            {diagnostico.repuestos_items?.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:700, color:"#6b7280", textTransform:"uppercase" }}>🔩 Repuestos</p>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, border:"1px solid #f1f5f9", borderRadius:8, overflow:"hidden" }}>
                  <thead>
                    <tr style={{ background:"#f8fafc" }}>
                      {["Repuesto","Cant.","P/U","Subtotal"].map(h => (
                        <th key={h} style={{ padding:"6px 10px", textAlign:"left", fontWeight:700, color:"#6b7280", fontSize:11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {diagnostico.repuestos_items.map((r: any, i: number) => (
                      <tr key={i} style={{ borderTop:"1px solid #f1f5f9" }}>
                        <td style={{ padding:"7px 10px", fontWeight:600 }}>{r.nombre}</td>
                        <td style={{ padding:"7px 10px" }}>{r.cantidad}</td>
                        <td style={{ padding:"7px 10px", color:"#6b7280" }}>RD$ {Number(r.precio_unitario||0).toLocaleString("es-DO",{minimumFractionDigits:2})}</td>
                        <td style={{ padding:"7px 10px", fontWeight:700, color:"#1d4ed8" }}>RD$ {Number(r.subtotal||0).toLocaleString("es-DO",{minimumFractionDigits:2})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(diagnostico.mano_obra > 0 || diagnostico.repuestos > 0 || diagnostico.total > 0) && (
              <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"12px 16px", marginBottom:14 }}>
                <p style={{ margin:"0 0 8px", fontWeight:700, fontSize:13, color:"#065f46" }}>💰 Resumen de Costos</p>
                <div style={{ display:"flex", gap:24, fontSize:13, flexWrap:"wrap" }}>
                  {diagnostico.mano_obra > 0 && (
                    <div><span style={{ color:"#6b7280" }}>Mano de obra:</span> <strong>RD$ {Number(diagnostico.mano_obra).toLocaleString("es-DO",{minimumFractionDigits:2})}</strong></div>
                  )}
                  {diagnostico.repuestos > 0 && (
                    <div><span style={{ color:"#6b7280" }}>Repuestos:</span> <strong>RD$ {Number(diagnostico.repuestos).toLocaleString("es-DO",{minimumFractionDigits:2})}</strong></div>
                  )}
                  <div style={{ borderLeft:"2px solid #6ee7b7", paddingLeft:16 }}>
                    <span style={{ color:"#065f46" }}>Total:</span>{" "}
                    <strong style={{ fontSize:17, color:"#065f46" }}>
                      RD$ {(Number(diagnostico.mano_obra||0)+Number(diagnostico.repuestos||0)||Number(diagnostico.total||0)).toLocaleString("es-DO",{minimumFractionDigits:2})}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {diagnostico.tiempo_estimado && (
              <p style={{ margin:"0 0 6px", fontSize:13, color:"#6b7280" }}>⏱️ Tiempo estimado: <strong style={{ color:"#374151" }}>{diagnostico.tiempo_estimado}</strong></p>
            )}
            {(diagnostico.notas || diagnostico.observaciones) && (
              <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, padding:"8px 12px", fontSize:13, color:"#92400e" }}>
                📝 {diagnostico.notas || diagnostico.observaciones}
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

      {/* ── Trabajos Realizados ── */}
      {diagnostico && (
        <div style={{ ...card, marginTop:16, borderLeft:"4px solid #8b5cf6" }}>
          <div style={sTitle as any}>
            <span>🔧 Trabajos Realizados</span>
            <span style={{ fontSize:12, color:"#8b5cf6", fontWeight:600 }}>{trabajosItems.length} item{trabajosItems.length !== 1 ? "s" : ""}</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:14 }}>
            {trabajosItems.length === 0 && (
              <p style={{ color:"#9ca3af", fontSize:13, margin:0 }}>Sin trabajos registrados aún. Añade los trabajos realizados en este vehículo.</p>
            )}
            {trabajosItems.map((item, idx) => {
              const estadoColor = item.estado === "REALIZADO" ? "#065f46" : item.estado === "PENDIENTE" ? "#92400e" : "#6b7280";
              const estadoBg    = item.estado === "REALIZADO" ? "#f0fdf4" : item.estado === "PENDIENTE" ? "#fffbeb" : "#f9fafb";
              return (
                <div key={item.id} style={{ display:"grid", gridTemplateColumns:"1fr 2fr 1fr auto", gap:10, alignItems:"start", background:"#f9fafb", borderRadius:10, padding:"12px 14px", borderLeft:`3px solid ${estadoColor}` }}>
                  <select
                    value={item.tipo}
                    onChange={e => setTrabajosItems(prev => prev.map((t,i) => i===idx ? {...t, tipo: e.target.value} : t))}
                    style={{ padding:"6px 8px", border:"1px solid #e5e7eb", borderRadius:7, fontSize:12, background:"#fff" }}>
                    {TRABAJO_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <textarea
                    value={item.descripcion}
                    onChange={e => setTrabajosItems(prev => prev.map((t,i) => i===idx ? {...t, descripcion: e.target.value} : t))}
                    placeholder="Descripción del trabajo realizado..."
                    rows={2}
                    style={{ padding:"6px 8px", border:"1px solid #e5e7eb", borderRadius:7, fontSize:12, resize:"vertical", fontFamily:"inherit" }}
                  />
                  <select
                    value={item.estado}
                    onChange={e => setTrabajosItems(prev => prev.map((t,i) => i===idx ? {...t, estado: e.target.value as TrabajoItem["estado"]} : t))}
                    style={{ padding:"6px 8px", border:`1px solid ${estadoColor}44`, borderRadius:7, fontSize:12, background:estadoBg, color:estadoColor, fontWeight:700 }}>
                    <option value="REALIZADO">✓ Realizado</option>
                    <option value="PENDIENTE">⏳ Pendiente</option>
                    <option value="NO_APLICA">— No aplica</option>
                  </select>
                  <button
                    onClick={() => setTrabajosItems(prev => prev.filter((_,i) => i !== idx))}
                    style={{ padding:"6px 10px", background:"#fee2e2", color:"#dc2626", border:"none", borderRadius:7, cursor:"pointer", fontWeight:700, fontSize:13 }}>
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <button
              onClick={() => setTrabajosItems(prev => [...prev, { id: Date.now().toString(), tipo:"Mecánica general", descripcion:"", estado:"REALIZADO" }])}
              style={{ padding:"8px 16px", background:"#ede9fe", color:"#7c3aed", border:"none", borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:13 }}>
              + Agregar trabajo
            </button>
            <button
              onClick={guardarTrabajos}
              disabled={guardandoTrabajos}
              style={{ padding:"8px 20px", background:"#8b5cf6", color:"#fff", border:"none", borderRadius:8, cursor:guardandoTrabajos?"not-allowed":"pointer", fontWeight:800, fontSize:13, opacity:guardandoTrabajos?0.7:1 }}>
              {guardandoTrabajos ? "Guardando..." : "💾 Guardar trabajos"}
            </button>
          </div>
        </div>
      )}

      {/* ── Avances de Reparación ── fuente: avancesReparacion (estado independiente) */}
      {(avancesReparacion.length > 0 || diagnostico?.avances?.length > 0) && (
        <div style={{ ...card, marginTop:16 }}>
          <div style={sTitle as any}>
            <span>📋 Avances de Reparación</span>
            <span style={{ fontSize:12, color:"#9ca3af", fontWeight:500 }}>
              {(avancesReparacion.length || diagnostico?.avances?.length || 0)} registros
            </span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {(avancesReparacion.length > 0 ? avancesReparacion : (diagnostico?.avances || [])).map((av: any, idx: number) => (
              <div key={av.id ?? idx} style={{ padding:"9px 12px", background:"#f9fafb", borderRadius:8, borderLeft:"3px solid #8b5cf6" }}>
                <p style={{ margin:"0 0 3px", fontSize:13, fontWeight:600, whiteSpace:"pre-wrap" }}>
                  {av.descripcion || av.detalle || "—"}
                </p>
                <p style={{ margin:0, fontSize:11, color:"#9ca3af" }}>
                  {av.tecnico_nombre || av.usuario_nombre || "Técnico"} · {new Date(av.created_at).toLocaleString("es-DO")}
                </p>
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

      {/* ── Control de Calidad ── */}
      {["CONTROL_CALIDAD","LISTO","ENTREGADO"].includes(estado) && (
        <div style={{ ...card, marginTop:16, borderLeft:"4px solid #8b5cf6" }}>
          <div style={sTitle as any}>✅ Control de Calidad</div>

          {/* Trabajos realizados — campo mano_de_obra_detalle del diagnóstico */}
          {diagnostico?.mano_de_obra_detalle && (
            <div style={{ marginBottom:14, background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:10, padding:"12px 14px" }}>
              <p style={{ margin:"0 0 8px", fontSize:12, fontWeight:700, color:"#5b21b6", textTransform:"uppercase" }}>
                🔧 Trabajos Realizados por el Técnico
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {(diagnostico.mano_de_obra_detalle as string)
                  .split("\n")
                  .filter((l: string) => l.trim())
                  .map((l: string, i: number) => (
                    <div key={i} style={{ fontSize:13, color:"#374151", padding:"4px 0", borderBottom:"1px solid #ede9fe", display:"flex", gap:8 }}>
                      <span style={{ color:"#7c3aed", fontWeight:700, flexShrink:0 }}>✓</span>
                      <span style={{ whiteSpace:"pre-wrap" }}>{l.trim()}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Avances de reparación anclados al QC — quién hizo qué y cuándo */}
          {(avancesReparacion.length > 0) && (
            <div style={{ marginBottom:14, border:"1px solid #e5e7eb", borderRadius:10, overflow:"hidden" }}>
              <div style={{ background:"#111827", color:"#fff", padding:"8px 14px", fontSize:12, fontWeight:700, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span>📋 Bitácora de Reparación — {avancesReparacion.length} {avancesReparacion.length === 1 ? "entrada" : "entradas"}</span>
                <span style={{ fontSize:11, color:"#9ca3af", fontWeight:400 }}>Para verificación QC</span>
              </div>
              <div style={{ display:"flex", flexDirection:"column" }}>
                {avancesReparacion.map((av: any, idx: number) => (
                  <div key={av.id ?? idx} style={{
                    padding:"10px 14px",
                    borderBottom: idx < avancesReparacion.length - 1 ? "1px solid #f3f4f6" : "none",
                    background: idx % 2 === 0 ? "#fff" : "#fafafa",
                  }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, marginBottom:4 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:"#7c3aed", background:"#f5f3ff", padding:"2px 8px", borderRadius:12, whiteSpace:"nowrap" }}>
                        👤 {av.tecnico_nombre || av.usuario_nombre || "Técnico"}
                      </span>
                      <span style={{ fontSize:11, color:"#9ca3af", whiteSpace:"nowrap" }}>
                        {new Date(av.created_at).toLocaleString("es-DO", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                      </span>
                    </div>
                    <p style={{ margin:0, fontSize:13, color:"#374151", whiteSpace:"pre-wrap", lineHeight:1.5 }}>
                      {av.descripcion || av.detalle || "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {estado === "CONTROL_CALIDAD" && !puedeCalidad ? (
            /* Técnico: solo puede ver que está pendiente de QC */
            <div style={{ background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:10, padding:"16px 20px", textAlign:"center", color:"#5b21b6" }}>
              <p style={{ margin:"0 0 4px", fontWeight:700, fontSize:14 }}>⏳ Pendiente de Control de Calidad</p>
              <p style={{ margin:0, fontSize:12, color:"#7c3aed" }}>El gerente realizará la revisión antes de notificar al cliente.</p>
            </div>
          ) : estado === "CONTROL_CALIDAD" ? (
            /* Formulario editable de QC */
            <div>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, fontWeight:700, color:"#6b7280", display:"block", marginBottom:4 }}>Técnico QC</label>
                <input
                  value={qcData.tecnico_qc}
                  onChange={e => setQcData(p => ({ ...p, tecnico_qc: e.target.value }))}
                  placeholder={usuario?.nombre || "Nombre del técnico de calidad"}
                  style={{ width:"100%", padding:"8px 10px", border:"1px solid #e5e7eb", borderRadius:8, fontSize:13, boxSizing:"border-box" }}
                />
              </div>
              <div style={{ marginBottom:14 }}>
                <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:"#6b7280" }}>Checklist de Calidad</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {QC_CHECKLIST_ITEMS.map(item => (
                    <label key={item.key} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", padding:"8px 10px", borderRadius:8, background: qcData.checklist_qc[item.key] ? "#f0fdf4" : "#f9fafb", border:`1px solid ${qcData.checklist_qc[item.key] ? "#6ee7b7" : "#e5e7eb"}` }}>
                      <input
                        type="checkbox"
                        checked={!!qcData.checklist_qc[item.key]}
                        onChange={e => setQcData(p => ({ ...p, checklist_qc: { ...p.checklist_qc, [item.key]: e.target.checked } }))}
                        style={{ width:16, height:16, accentColor:"#16a34a" }}
                      />
                      <span style={{ fontSize:13, color:"#374151" }}>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:12, fontWeight:700, color:"#6b7280", display:"block", marginBottom:4 }}>Observaciones del QC</label>
                <textarea
                  value={qcData.observaciones_qc}
                  onChange={e => setQcData(p => ({ ...p, observaciones_qc: e.target.value }))}
                  placeholder="Anotar cualquier observación adicional..."
                  rows={3}
                  style={{ width:"100%", padding:"8px 10px", border:"1px solid #e5e7eb", borderRadius:8, fontSize:13, resize:"vertical", boxSizing:"border-box" }}
                />
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button
                  onClick={() => { setModalAccion("calidad"); setMotivoModal(""); }}
                  style={{ flex:1, padding:"11px 20px", background:"#16a34a", color:"#fff", border:"none", borderRadius:10, cursor:"pointer", fontWeight:800, fontSize:14 }}>
                  ✅ Aprobar Control de Calidad
                </button>
                <button
                  onClick={() => { setModalAccion("calidad-rechazada"); setMotivoModal(""); }}
                  style={{ flex:1, padding:"11px 20px", background:"#dc2626", color:"#fff", border:"none", borderRadius:10, cursor:"pointer", fontWeight:800, fontSize:14 }}>
                  ❌ Rechazar — Regresar a Reparación
                </button>
              </div>
            </div>
          ) : (
            /* Resultado de QC readonly */
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                <span style={{
                  padding:"5px 16px", borderRadius:20, fontWeight:800, fontSize:14,
                  background: orden.resultado_qc === "APROBADO" ? "#d1fae5" : "#fee2e2",
                  color: orden.resultado_qc === "APROBADO" ? "#065f46" : "#991b1b",
                  border:`1.5px solid ${orden.resultado_qc === "APROBADO" ? "#6ee7b7" : "#fca5a5"}`,
                }}>
                  {orden.resultado_qc === "APROBADO" ? "✅ APROBADO" : orden.resultado_qc === "RECHAZADO" ? "❌ RECHAZADO" : "—"}
                </span>
                {orden.tecnico_qc && <span style={{ fontSize:13, color:"#6b7280" }}>Técnico: <strong style={{ color:"#374151" }}>{orden.tecnico_qc}</strong></span>}
              </div>
              {orden.observaciones_qc && (
                <p style={{ fontSize:13, color:"#374151", background:"#f9fafb", padding:"8px 12px", borderRadius:8, marginBottom:14 }}>
                  📝 {orden.observaciones_qc}
                </p>
              )}
              {orden.checklist_qc && Object.keys(orden.checklist_qc).length > 0 && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                  {QC_CHECKLIST_ITEMS.map(item => {
                    const val = orden.checklist_qc[item.key];
                    return (
                      <div key={item.key} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", borderRadius:8, background: val ? "#f0fdf4" : "#fef2f2", border:`1px solid ${val ? "#6ee7b7" : "#fca5a5"}` }}>
                        <span style={{ color: val ? "#16a34a" : "#dc2626", fontSize:15 }}>{val ? "✓" : "✗"}</span>
                        <span style={{ fontSize:12, color:"#374151" }}>{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Entrega ── */}
      {["LISTO","ENTREGADO"].includes(estado) && (
        <div style={{ ...card, marginTop:16, borderLeft:"4px solid #1d4ed8" }}>
          <div style={sTitle as any}>🏁 Entrega al Cliente</div>

          {estado === "LISTO" && !puedeEntregar ? (
            /* Técnico: ver que está listo, pero no puede procesar entrega */
            <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:10, padding:"16px 20px", textAlign:"center", color:"#1d4ed8" }}>
              <p style={{ margin:"0 0 4px", fontWeight:700, fontSize:14 }}>🎉 Vehículo listo para entrega</p>
              <p style={{ margin:0, fontSize:12, color:"#3b82f6" }}>La entrega al cliente será procesada por secretaría o gerencia.</p>
            </div>
          ) : estado === "LISTO" && !facturaOrden ? (
            /* Sin factura pagada: bloquear entrega */
            <div style={{ background:"#fef2f2", border:"2px solid #fca5a5", borderRadius:10, padding:"20px 24px", textAlign:"center" }}>
              <p style={{ margin:"0 0 8px", fontWeight:800, fontSize:16, color:"#dc2626" }}>🚫 Pago pendiente</p>
              <p style={{ margin:"0 0 12px", fontSize:13, color:"#7f1d1d" }}>
                El cliente no ha realizado su pago. Debe pagar la factura antes de retirar el vehículo.
              </p>
              <p style={{ margin:0, fontSize:12, color:"#991b1b" }}>
                Una vez registrado el pago en Facturación, podrá procesar la entrega aquí.
              </p>
            </div>
          ) : estado === "LISTO" ? (
            /* Formulario de entrega */
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:700, color:"#6b7280", display:"block", marginBottom:4 }}>Entregado por</label>
                  <input
                    value={entregaData.usuario_entrego}
                    onChange={e => setEntregaData(p => ({ ...p, usuario_entrego: e.target.value }))}
                    placeholder={usuario?.nombre || "Nombre de quien entrega"}
                    style={{ width:"100%", padding:"8px 10px", border:"1px solid #e5e7eb", borderRadius:8, fontSize:13, boxSizing:"border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:700, color:"#6b7280", display:"block", marginBottom:4 }}>Observaciones finales</label>
                  <textarea
                    value={entregaData.notas_entrega}
                    onChange={e => setEntregaData(p => ({ ...p, notas_entrega: e.target.value }))}
                    placeholder="Notas adicionales de la entrega..."
                    rows={2}
                    style={{ width:"100%", padding:"8px 10px", border:"1px solid #e5e7eb", borderRadius:8, fontSize:13, resize:"vertical", boxSizing:"border-box" }}
                  />
                </div>
              </div>
              <div style={{ marginBottom:16 }}>
                <p style={{ fontSize:12, fontWeight:700, color:"#6b7280", marginBottom:8 }}>Firma del cliente (opcional)</p>
                <div style={{ border:"2px dashed #bfdbfe", borderRadius:10, padding:10, display:"inline-block", background:"#f8faff" }}>
                  <canvas
                    ref={firmaCanvasRef}
                    width={300} height={150}
                    style={{ display:"block", background:"#fff", borderRadius:6, border:"1px solid #e5e7eb", cursor:"crosshair", touchAction:"none" }}
                    onMouseDown={iniciarFirma}
                    onMouseMove={continuarFirma}
                    onMouseUp={terminarFirma}
                    onMouseLeave={terminarFirma}
                    onTouchStart={iniciarFirma}
                    onTouchMove={continuarFirma}
                    onTouchEnd={terminarFirma}
                  />
                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                    <button onClick={limpiarFirma}
                      style={{ padding:"5px 12px", background:"#f3f4f6", border:"none", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:600 }}>
                      🗑️ Limpiar firma
                    </button>
                    {entregaData.firma_entrega && (
                      <span style={{ fontSize:11, color:"#16a34a", display:"flex", alignItems:"center" }}>✓ Firma capturada</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setModalAccion("entregar"); setMotivoModal(""); }}
                style={{ width:"100%", padding:"12px 20px", background:"#1d4ed8", color:"#fff", border:"none", borderRadius:10, cursor:"pointer", fontWeight:800, fontSize:15 }}>
                🏁 Confirmar Entrega al Cliente
              </button>
            </div>
          ) : (
            /* Entrega completada readonly */
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:12, fontSize:13 }}>
                <div>
                  <span style={{ color:"#6b7280", fontSize:11, fontWeight:700, textTransform:"uppercase" }}>Fecha de entrega</span>
                  <p style={{ margin:"3px 0 0", fontWeight:700 }}>{fmtDate(orden.fecha_entrega)}</p>
                </div>
                <div>
                  <span style={{ color:"#6b7280", fontSize:11, fontWeight:700, textTransform:"uppercase" }}>Entregado por</span>
                  <p style={{ margin:"3px 0 0", fontWeight:700 }}>{orden.usuario_entrego || "—"}</p>
                </div>
                <div>
                  <span style={{ color:"#6b7280", fontSize:11, fontWeight:700, textTransform:"uppercase" }}>Estado</span>
                  <p style={{ margin:"3px 0 0", fontWeight:700, color:"#065f46" }}>🏁 Entregado</p>
                </div>
              </div>
              {orden.notas_entrega && (
                <p style={{ fontSize:13, color:"#374151", background:"#eff6ff", padding:"8px 12px", borderRadius:8, marginBottom:12 }}>
                  📝 {orden.notas_entrega}
                </p>
              )}
              {orden.firma_entrega && (
                <div>
                  <p style={{ fontSize:11, color:"#6b7280", fontWeight:700, marginBottom:6 }}>FIRMA DEL CLIENTE:</p>
                  <img src={orden.firma_entrega} alt="Firma del cliente" style={{ maxHeight:80, border:"1px solid #e5e7eb", borderRadius:6, background:"#fff", padding:4 }} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Cancelación ── */}
      {estado === "CANCELADA" && (
        <div style={{ ...card, marginTop:16, borderLeft:"4px solid #ef4444", background:"#fef2f2" }}>
          <div style={sTitle as any}>
            <span style={{ color:"#7f1d1d" }}>❌ Orden Cancelada</span>
            <span style={{ background:"#fee2e2", color:"#7f1d1d", padding:"4px 14px", borderRadius:20, fontWeight:900, fontSize:14, border:"1.5px solid #fca5a5" }}>CANCELADA</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:12, fontSize:13 }}>
            <div>
              <span style={{ color:"#9ca3af", fontSize:11, fontWeight:700, textTransform:"uppercase" }}>Fecha de cancelación</span>
              <p style={{ margin:"3px 0 0", fontWeight:700, color:"#7f1d1d" }}>{fmtDate(orden.fecha_cancelacion)}</p>
            </div>
            <div>
              <span style={{ color:"#9ca3af", fontSize:11, fontWeight:700, textTransform:"uppercase" }}>Responsable</span>
              <p style={{ margin:"3px 0 0", fontWeight:700 }}>{orden.usuario_cancelo || "—"}</p>
            </div>
          </div>
          {orden.motivo_cancelacion && (
            <div style={{ background:"#fee2e2", border:"1px solid #fca5a5", borderRadius:8, padding:"10px 14px", marginBottom:10 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"#991b1b", textTransform:"uppercase", display:"block", marginBottom:4 }}>Motivo de cancelación</span>
              <p style={{ margin:0, fontSize:14, color:"#7f1d1d", fontWeight:600 }}>{orden.motivo_cancelacion}</p>
            </div>
          )}
          <p style={{ margin:0, fontSize:12, color:"#9ca3af", fontStyle:"italic" }}>
            Esta orden queda archivada en el historial del vehículo.
          </p>
        </div>
      )}

      {/* ── Historial completo del proceso ── */}
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
                  <div style={{ width:32, height:32, borderRadius:"50%", flexShrink:0, background: ec.bg, color: ec.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, zIndex:1, border:`2px solid ${ec.color}33` }}>
                    {ec.icon}
                  </div>
                  <div style={{ flex:1, paddingTop:4 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <span style={{ fontWeight:700, fontSize:14, color: ec.color }}>{ec.label}</span>
                      {entry.estado_anterior && (
                        <span style={{ fontSize:12, color:"#9ca3af" }}>(anterior: {EST[entry.estado_anterior]?.label || entry.estado_anterior})</span>
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

      {/* ── Modal de confirmación de acción ── */}
      {modalAccion && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999 }}>
          <div style={{ background:"#fff", borderRadius:18, padding:28, minWidth:340, maxWidth:500, width:"92%", boxShadow:"0 24px 60px rgba(0,0,0,0.25)", maxHeight:"90vh", overflowY:"auto" }}>
            <h3 style={{ margin:"0 0 8px", fontSize:18 }}>
              {modalAccion === "aprobar"           && "✅ Confirmar aprobación del cliente"}
              {modalAccion === "rechazar"          && "❌ Confirmar rechazo del cliente"}
              {modalAccion === "calidad"           && "✅ Confirmar: Control de Calidad Aprobado"}
              {modalAccion === "calidad-rechazada" && "❌ Rechazar QC — Regresar a Reparación"}
              {modalAccion === "entregar"          && "🏁 Confirmar entrega del vehículo"}
            </h3>
            <p style={{ color:"#6b7280", fontSize:13, marginBottom:14 }}>
              {modalAccion === "calidad"           && `Técnico QC: ${qcData.tecnico_qc || usuario?.nombre || "—"} · ${Object.values(qcData.checklist_qc).filter(Boolean).length}/${QC_CHECKLIST_ITEMS.length} items aprobados`}
              {modalAccion === "calidad-rechazada" && "El vehículo regresará al estado REPARACIÓN para corrección."}
              {modalAccion === "entregar"          && `Entregado por: ${entregaData.usuario_entrego || usuario?.nombre || "—"}`}
              {(modalAccion === "aprobar" || modalAccion === "rechazar") && "Esta acción cambiará el estado de la orden de forma permanente."}
            </p>
            <label style={{ fontSize:12, color:"#6b7280", fontWeight:600, display:"block", marginBottom:4 }}>
              Motivo / Notas {(modalAccion === "rechazar" || modalAccion === "calidad-rechazada") ? "(requerido)" : "(opcional)"}
            </label>
            <textarea
              value={motivoModal}
              onChange={e => setMotivoModal(e.target.value)}
              style={{ width:"100%", padding:"8px 10px", border:"1px solid #e5e7eb", borderRadius:8, fontSize:13, minHeight:60, resize:"vertical", boxSizing:"border-box", marginBottom:16 }}
              placeholder={
                modalAccion === "calidad-rechazada" ? "Describir qué debe corregirse..."
                : modalAccion === "rechazar" ? "Motivo del rechazo del cliente..."
                : "Observaciones adicionales..."
              }
            />
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => { setModalAccion(null); setMotivoModal(""); }}
                style={{ flex:1, padding:10, background:"#f3f4f6", border:"none", borderRadius:9, cursor:"pointer", fontWeight:700 }}>
                Cancelar
              </button>
              <button
                onClick={() => ejecutarAccion(modalAccion)}
                disabled={procesando || ((modalAccion === "rechazar" || modalAccion === "calidad-rechazada") && !motivoModal.trim())}
                style={{
                  flex:1, padding:10,
                  background: (modalAccion === "rechazar" || modalAccion === "calidad-rechazada") ? "#dc2626" : "#16a34a",
                  color:"#fff", border:"none", borderRadius:9,
                  cursor: procesando ? "not-allowed" : "pointer", fontWeight:800,
                  opacity: procesando ? 0.7 : 1,
                }}>
                {procesando ? "Procesando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
