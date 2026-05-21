"use client";
import { useState, useEffect } from "react";
import { API_URL as API } from "@/config";

const ESTADO_INFO = {
  RECIBIDO:        { color: "#60a5fa", grad: "linear-gradient(135deg,#1e3a5f,#2563eb)", emoji: "📋", paso: 1, msg: "Tu vehículo fue recibido. Pronto será evaluado." },
  DIAGNOSTICO:     { color: "#fbbf24", grad: "linear-gradient(135deg,#451a03,#d97706)", emoji: "🔍", paso: 2, msg: "Nuestro técnico está evaluando tu vehículo." },
  REPARACION:      { color: "#f87171", grad: "linear-gradient(135deg,#450a0a,#dc2626)", emoji: "🔧", paso: 3, msg: "Tu vehículo está siendo reparado por nuestro equipo." },
  CONTROL_CALIDAD: { color: "#a78bfa", grad: "linear-gradient(135deg,#2e1065,#7c3aed)", emoji: "✅", paso: 4, msg: "Revisión final de calidad en proceso." },
  LISTO:           { color: "#34d399", grad: "linear-gradient(135deg,#022c22,#059669)", emoji: "🎉", paso: 5, msg: "¡Tu vehículo está listo! Puedes pasar a recogerlo." },
  ENTREGADO:       { color: "#94a3b8", grad: "linear-gradient(135deg,#1e293b,#475569)", emoji: "🚗", paso: 6, msg: "Vehículo entregado. ¡Gracias por tu confianza!" },
};

const PASOS       = ["RECIBIDO","DIAGNOSTICO","REPARACION","CONTROL_CALIDAD","LISTO","ENTREGADO"];
const PASOS_LABEL = ["Recibido","Diagnóstico","Reparación","C. Calidad","Listo","Entregado"];

// ── Función de impresión: historial completo del vehículo ─────────────────────
function imprimirHistorialCompleto(resultado: any, historialPerm: any[]) {
  const v = resultado?.vehiculo || {};
  const diagnosticos: any[] = resultado?.diagnosticos || [];
  const ordenes: any[] = resultado?.ordenes || [];
  const fmtMoney = (n: number) => Number(n || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 });
  const fmtDate  = (d: string) => d ? new Date(d).toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric" }) : "—";

  // Sección por diagnóstico
  const diagSections = diagnosticos.map((d: any) => {
    const items: any[] = d.repuestos_items || [];
    const repTable = items.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:5px 8px;text-align:left">Repuesto</th>
            <th style="padding:5px 8px;text-align:center">Cant.</th>
            <th style="padding:5px 8px;text-align:right">P/U</th>
            <th style="padding:5px 8px;text-align:right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((r: any) => `
            <tr style="border-bottom:1px solid #f1f5f9">
              <td style="padding:4px 8px">${r.nombre || "—"}</td>
              <td style="padding:4px 8px;text-align:center">${r.cantidad || 1}</td>
              <td style="padding:4px 8px;text-align:right">RD$ ${fmtMoney(r.precio_unitario)}</td>
              <td style="padding:4px 8px;text-align:right;font-weight:700">RD$ ${fmtMoney(r.subtotal)}</td>
            </tr>`).join("")}
        </tbody>
      </table>` : "";

    const trabajoLineas = (d.mano_de_obra_detalle || "")
      .split("\n").filter((l: string) => l.trim())
      .map((l: string) => `<div style="font-size:13px;margin-bottom:3px">✓ ${l.trim()}</div>`)
      .join("");

    const moTotal  = Number(d.mano_obra || 0);
    const repTotal = Number(d.repuestos || 0);
    const total    = moTotal + repTotal || Number(d.total || 0);

    return `
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:14px;page-break-inside:avoid">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="font-size:13px;font-weight:700;color:#1e40af">${d.tipo_servicio || "Diagnóstico Técnico"}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px">${fmtDate(d.created_at)}</div>
          </div>
          <div style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${d.terminado ? "#d1fae5" : "#fef3c7"};color:${d.terminado ? "#065f46" : "#92400e"}">
            ${d.terminado ? "Cerrado" : "Borrador"}
          </div>
        </div>

        ${(d.descripcion || d.hallazgos) ? `
          <div style="margin-bottom:10px">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:1px;margin-bottom:4px">Hallazgos / Diagnóstico</div>
            <div style="font-size:13px;color:#374151;background:#f9fafb;border-radius:6px;padding:8px 10px;white-space:pre-wrap;line-height:1.6">${d.descripcion || d.hallazgos}</div>
          </div>` : ""}

        ${trabajoLineas ? `
          <div style="margin-bottom:10px">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:1px;margin-bottom:4px">Trabajos a Realizar</div>
            <div style="background:#f0fdf4;border-radius:6px;padding:8px 10px">${trabajoLineas}</div>
          </div>` : ""}

        ${repTable}

        ${total > 0 ? `
          <div style="background:#f8fafc;border-radius:8px;padding:12px;margin-top:10px;display:flex;gap:20px;flex-wrap:wrap">
            ${moTotal > 0 ? `<div><span style="font-size:11px;color:#64748b">Mano de obra:</span> <strong>RD$ ${fmtMoney(moTotal)}</strong></div>` : ""}
            ${repTotal > 0 ? `<div><span style="font-size:11px;color:#64748b">Repuestos:</span> <strong>RD$ ${fmtMoney(repTotal)}</strong></div>` : ""}
            <div style="margin-left:auto"><span style="font-size:11px;color:#064e3b">TOTAL:</span> <strong style="font-size:16px;color:#059669">RD$ ${fmtMoney(total)}</strong></div>
          </div>` : ""}

        ${d.tiempo_estimado ? `<div style="font-size:12px;color:#64748b;margin-top:8px">⏱ Tiempo estimado: ${d.tiempo_estimado}</div>` : ""}
        ${d.notas ? `<div style="font-size:12px;color:#92400e;background:#fffbeb;border-radius:6px;padding:6px 10px;margin-top:8px">📝 ${d.notas}</div>` : ""}
      </div>`;
  }).join("");

  // Sección historial permanente
  const histSection = historialPerm.map((h: any) => `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:10px;page-break-inside:avoid">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:13px;font-weight:700;color:#1e293b">${h.tipo_servicio || "Servicio"}</div>
        <div style="font-size:11px;color:#64748b">${fmtDate(h.fecha_servicio)}</div>
      </div>
      ${h.tecnico_nombre ? `<div style="font-size:12px;color:#64748b;margin-bottom:6px">Técnico: ${h.tecnico_nombre}</div>` : ""}
      ${h.trabajos_realizados ? `<div style="font-size:12px;color:#374151;white-space:pre-wrap;margin-bottom:6px">${h.trabajos_realizados}</div>` : ""}
      ${h.fallas_identificadas ? `<div style="font-size:12px;color:#92400e;background:#fffbeb;border-radius:6px;padding:6px 10px;margin-bottom:6px">⚠️ ${h.fallas_identificadas}</div>` : ""}
      ${h.costo_total > 0 ? `<div style="font-size:13px;font-weight:700;color:#059669;text-align:right">Total: RD$ ${fmtMoney(h.costo_total)}</div>` : ""}
    </div>`).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Historial — ${v.placa || "Vehículo"}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; padding:32px; color:#1a1a1a; max-width:780px; margin:auto; }
  @media print { body { padding:16px; } }
</style>
</head>
<body>

<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111827;padding-bottom:16px;margin-bottom:20px">
  <div>
    <div style="font-size:22px;font-weight:900">🔧 SÓLIDO AUTO SERVICIO</div>
    <div style="font-size:12px;color:#6b7280;margin-top:3px">Tel: 809-712-2027 · Santo Domingo, RD</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:18px;font-weight:900;color:#1e40af">${v.marca || ""} ${v.modelo || ""} ${v.ano || ""}</div>
    <div style="font-size:14px;font-weight:800;font-family:monospace;color:#374151;margin-top:2px">${v.placa || ""}</div>
    <div style="font-size:11px;color:#6b7280;margin-top:2px">Color: ${v.color || "—"}</div>
  </div>
</div>

<div style="text-align:center;font-size:16px;font-weight:700;color:#1e40af;border:2px solid #1e40af;padding:8px;border-radius:8px;margin-bottom:20px;text-transform:uppercase;letter-spacing:1px">
  Historial Completo de Servicio
</div>

${diagnosticos.length > 0 ? `
<div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#475569;background:#f1f5f9;padding:6px 12px;border-radius:6px;margin-bottom:12px;border-left:4px solid #1e40af">
  Diagnósticos Técnicos (${diagnosticos.length})
</div>
${diagSections}` : ""}

${historialPerm.length > 0 ? `
<div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#475569;background:#f1f5f9;padding:6px 12px;border-radius:6px;margin-bottom:12px;border-left:4px solid #059669;margin-top:20px">
  Historial de Servicios Anteriores (${historialPerm.length})
</div>
${histSection}` : ""}

${ordenes.length > 0 ? `
<div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#475569;background:#f1f5f9;padding:6px 12px;border-radius:6px;margin-bottom:12px;border-left:4px solid #6366f1;margin-top:20px">
  Órdenes de Trabajo (${ordenes.length})
</div>
${ordenes.slice(0, 10).map((o: any) => `
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between">
      <span style="font-weight:700">Orden #${o.id}${o.numero_orden ? ` (${o.numero_orden})` : ""}</span>
      <span style="font-size:12px;color:#64748b">${o.estado?.replace(/_/g, " ") || ""}</span>
    </div>
    <div style="font-size:13px;color:#374151;margin-top:4px">${o.descripcion || "—"}</div>
    <div style="font-size:11px;color:#9ca3af;margin-top:3px">${fmtDate(o.created_at)}</div>
  </div>`).join("")}` : ""}

<div style="text-align:center;margin-top:32px;padding-top:14px;border-top:1px dashed #cbd5e1;color:#9ca3af;font-size:11px;line-height:2">
  <p>Documento generado el ${new Date().toLocaleDateString("es-DO", { year:"numeric", month:"long", day:"numeric" })}</p>
  <p><strong>SÓLIDO AUTO SERVICIO</strong> — Tel: 809-712-2027 — Santo Domingo, República Dominicana</p>
</div>

</body>
</html>`;

  const w = window.open("", "_blank", "width=860,height=1100");
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600); }
}

// ── Función de impresión: expediente de UN servicio ──────────────────────────
function imprimirExpediente(h: any) {
  const fmtMoney = (n: any) => Number(n || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 });
  const fmtDate  = (d: any) => d ? new Date(d).toLocaleDateString("es-DO", { year:"numeric", month:"long", day:"numeric" }) : "—";
  const fmtDT    = (d: any) => d ? new Date(d).toLocaleDateString("es-DO", { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";

  const cot = h.cotizacion_data || {};
  const fac = h.factura_data || {};
  const avances: any[] = Array.isArray(h.avances_data) ? h.avances_data : [];
  const timeline: any[] = Array.isArray(h.timeline_data) ? h.timeline_data : [];
  const fechas = h.fechas_proceso || {};
  const checklist = h.checklist_qc || {};

  const cotItems = Array.isArray(cot.items_detalle) && cot.items_detalle.length > 0 ? cot.items_detalle : (Array.isArray(cot.items) ? cot.items : []);
  const facItems: any[] = Array.isArray(fac.items) ? fac.items : [];

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Expediente — ${h.placa || "Vehículo"} — ${h.numero_orden || ""}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; padding:28px; color:#1a1a1a; max-width:780px; margin:auto; }
  h3 { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1.2px; color:#475569; background:#f1f5f9; padding:5px 10px; border-radius:5px; border-left:4px solid #1e40af; margin:18px 0 10px; }
  .card { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:14px; margin-bottom:10px; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th { background:#f8fafc; padding:6px 8px; text-align:left; font-weight:700; color:#475569; }
  td { padding:5px 8px; border-bottom:1px solid #f1f5f9; color:#374151; }
  .row { display:flex; justify-content:space-between; font-size:13px; margin-bottom:5px; }
  .label { color:#64748b; }
  .total { font-size:18px; font-weight:900; color:#059669; text-align:right; margin-top:8px; padding-top:8px; border-top:2px solid #d1fae5; }
  @media print { body { padding:16px; } h3 { page-break-after:avoid; } .card { page-break-inside:avoid; } }
</style>
</head>
<body>

<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111827;padding-bottom:14px;margin-bottom:18px">
  <div>
    <div style="font-size:20px;font-weight:900">🔧 SÓLIDO AUTO SERVICIO</div>
    <div style="font-size:11px;color:#6b7280;margin-top:2px">Tel: 809-712-2027 · Santo Domingo, RD</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:16px;font-weight:900;color:#1e40af">${h.vehiculo_marca || ""} ${h.vehiculo_modelo || ""} ${h.vehiculo_ano || ""}</div>
    <div style="font-size:13px;font-weight:800;font-family:monospace">${h.placa || ""}</div>
    ${h.numero_orden ? `<div style="font-size:11px;color:#6b7280">Orden #${h.numero_orden}</div>` : ""}
  </div>
</div>

<div style="text-align:center;font-size:15px;font-weight:800;color:#1e40af;border:2px solid #1e40af;padding:7px;border-radius:8px;margin-bottom:18px;text-transform:uppercase;letter-spacing:1px">
  Expediente de Servicio — ${h.tipo_servicio || "Servicio"}
</div>

<div class="card">
  <div class="row"><span class="label">Fecha de servicio</span><span>${fmtDate(h.fecha_servicio)}</span></div>
  <div class="row"><span class="label">Técnico</span><span>${h.tecnico_nombre || "—"}</span></div>
  ${h.motivo_entrada ? `<div class="row"><span class="label">Motivo de entrada</span><span>${h.motivo_entrada}</span></div>` : ""}
  ${h.cliente_nombre ? `<div class="row"><span class="label">Cliente</span><span>${h.cliente_nombre}</span></div>` : ""}
</div>

${(h.inspeccion_mecanica || h.inspeccion_electrica || h.inspeccion_electronica) ? `
<h3>🔍 Inspección Técnica</h3>
<div class="card">
  ${h.inspeccion_mecanica ? `<div style="margin-bottom:8px"><strong>Mecánica:</strong><br><span style="color:#374151;font-size:13px">${h.inspeccion_mecanica}</span></div>` : ""}
  ${h.inspeccion_electrica ? `<div style="margin-bottom:8px"><strong>Eléctrica:</strong><br><span style="color:#374151;font-size:13px">${h.inspeccion_electrica}</span></div>` : ""}
  ${h.inspeccion_electronica ? `<div><strong>Scanner:</strong><br><span style="color:#374151;font-size:13px">${h.inspeccion_electronica}</span></div>` : ""}
</div>` : ""}

${(h.fallas_identificadas || h.codigos_falla) ? `
<h3>⚠️ Fallas Identificadas</h3>
<div class="card" style="background:#fffbeb;border-color:#fde68a">
  ${h.codigos_falla ? `<div style="font-size:12px;margin-bottom:4px"><strong>Códigos:</strong> ${h.codigos_falla}</div>` : ""}
  ${h.fallas_identificadas ? `<div style="font-size:13px">${h.fallas_identificadas}</div>` : ""}
</div>` : ""}

${cotItems.length > 0 || cot.total > 0 ? `
<h3>📄 Cotización${cot.numero ? ` #${cot.numero}` : ""}${cot.aprobado ? " ✓ Aprobada" : ""}</h3>
<div class="card">
  ${cotItems.length > 0 ? `<table><thead><tr><th>Descripción</th><th style="text-align:center">Cant.</th><th style="text-align:right">Subtotal</th></tr></thead><tbody>
    ${cotItems.map((it: any) => `<tr><td>${it.descripcion||"—"}</td><td style="text-align:center">${it.cantidad||1}</td><td style="text-align:right">RD$ ${fmtMoney(it.subtotal)}</td></tr>`).join("")}
  </tbody></table><br>` : ""}
  ${cot.mano_obra > 0 ? `<div class="row"><span class="label">Mano de obra</span><span>RD$ ${fmtMoney(cot.mano_obra)}</span></div>` : ""}
  ${cot.repuestos > 0 ? `<div class="row"><span class="label">Repuestos</span><span>RD$ ${fmtMoney(cot.repuestos)}</span></div>` : ""}
  ${cot.itbis > 0 ? `<div class="row"><span class="label">ITBIS</span><span>RD$ ${fmtMoney(cot.itbis)}</span></div>` : ""}
  <div class="row" style="font-weight:700;font-size:14px;border-top:1px solid #e2e8f0;padding-top:6px;margin-top:4px"><span>Total Cotizado</span><span style="color:#1e40af">RD$ ${fmtMoney(cot.total)}</span></div>
</div>` : ""}

${avances.length > 0 ? `
<h3>🛠️ Avances de Reparación</h3>
<div class="card">
  ${avances.map((a: any, i: number) => `
    <div style="${i < avances.length-1 ? "margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #f1f5f9" : ""}">
      <div style="font-size:11px;color:#64748b;margin-bottom:3px">${fmtDT(a.created_at)}${a.tecnico_nombre ? ` · ${a.tecnico_nombre}` : ""}</div>
      <div style="font-size:13px">${a.descripcion}</div>
    </div>`).join("")}
</div>` : (h.trabajos_realizados ? `<h3>🛠️ Trabajos Realizados</h3><div class="card"><div style="font-size:13px;white-space:pre-wrap">${h.trabajos_realizados}</div></div>` : "")}

${h.resultado_qc ? `
<h3>✅ Control de Calidad</h3>
<div class="card" style="border-color:${h.resultado_qc === "aprobado" ? "#6ee7b7" : "#fca5a5"}">
  <div style="font-size:14px;font-weight:700;color:${h.resultado_qc === "aprobado" ? "#059669" : "#dc2626"};margin-bottom:6px">
    ${h.resultado_qc === "aprobado" ? "✅ Aprobado" : "❌ Rechazado"}
  </div>
  ${h.observaciones_qc ? `<div style="font-size:12px;color:#374151;margin-bottom:8px">${h.observaciones_qc}</div>` : ""}
  ${Object.keys(checklist).length > 0 ? Object.entries(checklist).map(([k,v]) => `<div style="font-size:12px;margin-bottom:3px">${v ? "✅" : "❌"} ${k.replace(/_/g," ")}</div>`).join("") : ""}
</div>` : ""}

${fac.id ? `
<h3>🧾 Factura${fac.ncf ? ` — NCF: ${fac.ncf}` : ""}${fac.metodo_pago ? ` · ${fac.metodo_pago}` : ""}</h3>
<div class="card">
  ${facItems.length > 0 ? `<table><thead><tr><th>Descripción</th><th style="text-align:center">Cant.</th><th style="text-align:right">Subtotal</th></tr></thead><tbody>
    ${facItems.map((fi: any) => `<tr><td>${fi.descripcion||"—"}</td><td style="text-align:center">${fi.cantidad||1}</td><td style="text-align:right">RD$ ${fmtMoney(fi.subtotal)}</td></tr>`).join("")}
  </tbody></table><br>` : ""}
  ${fac.itbis > 0 ? `<div class="row"><span class="label">ITBIS</span><span>RD$ ${fmtMoney(fac.itbis)}</span></div>` : ""}
  <div class="total">Total Pagado: RD$ ${fmtMoney(fac.total || h.costo_total)}</div>
</div>` : (h.costo_total > 0 ? `
<h3>💰 Costos</h3>
<div class="card">
  ${h.costo_mano_obra > 0 ? `<div class="row"><span class="label">Mano de obra</span><span>RD$ ${fmtMoney(h.costo_mano_obra)}</span></div>` : ""}
  ${h.costo_repuestos > 0 ? `<div class="row"><span class="label">Repuestos</span><span>RD$ ${fmtMoney(h.costo_repuestos)}</span></div>` : ""}
  <div class="total">Total: RD$ ${fmtMoney(h.costo_total)}</div>
  ${h.ncf ? `<div style="font-size:11px;color:#64748b;margin-top:6px">NCF: ${h.ncf}</div>` : ""}
</div>` : "")}

${timeline.length > 0 ? `
<h3>📅 Línea de Tiempo</h3>
<div class="card">
  ${timeline.map((t: any, i: number) => `
    <div style="display:flex;gap:10px;${i < timeline.length-1 ? "margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #f1f5f9" : ""}">
      <div style="width:8px;height:8px;border-radius:50%;background:#3b82f6;flex-shrink:0;margin-top:5px"></div>
      <div>
        <div style="font-size:13px;font-weight:700;color:#1e293b">${(t.estado_nuevo||"").replace(/_/g," ").replace(/\b\w/g,(c: string)=>c.toUpperCase())}</div>
        <div style="font-size:11px;color:#64748b">${fmtDT(t.created_at)}${t.usuario_nombre ? ` · ${t.usuario_nombre}` : ""}</div>
        ${t.motivo ? `<div style="font-size:11px;color:#92400e;background:#fffbeb;border-radius:4px;padding:2px 6px;margin-top:2px">${t.motivo}</div>` : ""}
      </div>
    </div>`).join("")}
</div>` : ""}

${Object.values(fechas).some(Boolean) ? `
<h3>📅 Fechas del Proceso</h3>
<div class="card">
  ${[
    ["recibido","Recibido"],["diagnostico","Diagnóstico"],["esperando_aprobacion","En Espera Aprobación"],
    ["aprobacion","Aprobado"],["inicio_reparacion","Inicio Reparación"],["control_calidad","Control Calidad"],
    ["listo","Listo para Entrega"],["entrega","Entregado"]
  ].filter(([k]) => (fechas as any)[k]).map(([k,label]) => `
    <div class="row"><span class="label">${label}</span><span>${fmtDate((fechas as any)[k])}</span></div>`).join("")}
</div>` : ""}

${h.notas_entrega ? `
<h3>📦 Notas de Entrega</h3>
<div class="card"><div style="font-size:13px">${h.notas_entrega}</div></div>` : ""}

${h.observaciones ? `
<h3>📝 Observaciones</h3>
<div class="card"><div style="font-size:13px">${h.observaciones}</div></div>` : ""}

<div style="text-align:center;margin-top:28px;padding-top:12px;border-top:1px dashed #cbd5e1;color:#9ca3af;font-size:11px;line-height:2">
  <p>Documento generado el ${new Date().toLocaleDateString("es-DO",{year:"numeric",month:"long",day:"numeric"})}</p>
  <p><strong>SÓLIDO AUTO SERVICIO</strong> — Tel: 809-712-2027 — Santo Domingo, República Dominicana</p>
</div>

</body>
</html>`;

  const w = window.open("", "_blank", "width=860,height=1100");
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600); }
}

export default function ClienteApp() {
  const [placa, setPlaca]                   = useState("");
  const [resultado, setResultado]           = useState<any>(null);
  const [repuestos, setRepuestos]           = useState<any[]>([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState("");
  const [tab, setTab]                       = useState("estado");
  const [instalable, setInstalable]         = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showRepuestos, setShowRepuestos]   = useState(false);
  const [loadingRepuestos, setLoadingRepuestos] = useState(false);
  const [repuestoAbierto, setRepuestoAbierto]   = useState<number | null>(null);
  const [esIOS, setEsIOS]                   = useState(false);

  // ── REPUESTOS — búsqueda + paginación ──
  const [repuestoSearch, setRepuestoSearch] = useState("");
  const [repuestosPage, setRepuestosPage]   = useState(1);
  const PAGE_SIZE = 15;

  // ── CAFETERÍA ──
  const [showCafe, setShowCafe]             = useState(false);
  const [cafe, setCafe]                     = useState<any[]>([]);
  const [loadingCafe, setLoadingCafe]       = useState(false);
  const [cafeAbierto, setCafeAbierto]       = useState<number | null>(null);
  const [cafeSearch, setCafeSearch]         = useState("");
  const [cafePage, setCafePage]             = useState(1);

  // ── HISTORIAL PERMANENTE ──
  const [historialPerm, setHistorialPerm]   = useState<any[]>([]);
  const [histDetalle, setHistDetalle]       = useState<any>(null);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setEsIOS(ios);

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => console.log('SW registrado:', reg.scope))
          .catch(err => console.error('SW error:', err));
      });
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setInstalable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const verRepuestos = async () => {
    const nuevoEstado = !showRepuestos;
    setShowRepuestos(nuevoEstado);
    setRepuestoAbierto(null);
    if (!nuevoEstado || repuestos.length > 0) return;
    setLoadingRepuestos(true);
    try {
      const res  = await fetch(`${API}/inventario`);
      const data = await res.json();
      setRepuestos(data || []);
    } catch {}
    finally { setLoadingRepuestos(false); }
  };

  const verCafe = async () => {
    const nuevo = !showCafe;
    setShowCafe(nuevo);
    setCafeAbierto(null);
    if (!nuevo || cafe.length > 0) return;
    setLoadingCafe(true);
    try {
      const res  = await fetch(`${API}/cafeteria/productos`);
      const data = await res.json();
      setCafe(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoadingCafe(false); }
  };

  const instalarApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalable(false);
    setDeferredPrompt(null);
  };

  const buscar = async () => {
    if (!placa.trim()) return setError("Ingresa la placa de tu vehículo");
    setLoading(true); setError(""); setResultado(null); setHistorialPerm([]); setHistDetalle(null);
    try {
      const placaNorm = placa.trim().toUpperCase();
      const [vRes, oRes, dRes, hRes] = await Promise.all([
        fetch(`${API}/vehiculos`),
        fetch(`${API}/ordenes`),
        fetch(`${API}/diagnosticos`),
        fetch(`${API}/vehiculo-historial/placa/${encodeURIComponent(placaNorm)}`),
      ]);
      const vehiculos    = await vRes.json();
      const ordenes      = await oRes.json();
      const diagnosticos = await dRes.json();
      const histData     = await hRes.json();

      const vehiculo = vehiculos.find((v: any) =>
        v.placa?.toUpperCase() === placaNorm
      );
      if (!vehiculo && (!histData.found)) {
        setError("No encontramos un vehículo con esa placa. Verifica e intenta de nuevo.");
        return;
      }

      if (histData.found) setHistorialPerm(histData.historial || []);

      if (vehiculo) {
        const ordenesVehiculo = ordenes
          .filter((o: any) => o.vehiculo_id === vehiculo.id || o.vehiculo_info?.includes(vehiculo.placa))
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const diagVehiculo = diagnosticos
          .filter((d: any) => d.vehiculo_id === vehiculo.id)
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setResultado({ vehiculo, ordenes: ordenesVehiculo, diagnosticos: diagVehiculo });
      } else if (histData.found) {
        // Vehículo eliminado del sistema activo pero existe historial
        setResultado({
          vehiculo: { ...histData.vehiculo, id: null },
          ordenes: [], diagnosticos: []
        });
      }
    } catch {
      setError("Error de conexión. Intenta más tarde.");
    } finally {
      setLoading(false);
    }
  };

  const ultimaOrden = resultado?.ordenes?.[0];
  const estadoInfo  = ultimaOrden ? (ESTADO_INFO[ultimaOrden.estado as keyof typeof ESTADO_INFO] || ESTADO_INFO.RECIBIDO) : null;
  const pasoActual  = estadoInfo ? estadoInfo.paso : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080c14; }

        .sas-root {
          max-width: 480px; margin: 0 auto; min-height: 100vh;
          background: #080c14; font-family: 'DM Sans', sans-serif;
          color: #e2e8f0; position: relative; overflow-x: hidden;
        }
        .sas-root::before {
          content:''; position:fixed; inset:0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events:none; z-index:0; opacity:.4;
        }
        .sas-content { position:relative; z-index:1; }

        .sas-header {
          background: linear-gradient(170deg, #0f172a 0%, #1e293b 100%);
          padding: 36px 24px 28px; text-align: center;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          position: relative; overflow: hidden;
        }
        .sas-header::after {
          content:''; position:absolute; width:280px; height:280px; border-radius:50%;
          background: radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%);
          top:-80px; left:50%; transform:translateX(-50%); pointer-events:none;
        }
        .sas-logo {
          width:80px; height:80px; object-fit:contain; border-radius:20px;
          box-shadow: 0 0 30px rgba(59,130,246,0.3); margin-bottom:14px;
        }
        .sas-title {
          font-family:'Syne',sans-serif; font-size:20px; font-weight:800; letter-spacing:2px;
          background: linear-gradient(135deg,#fff 30%,#93c5fd);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        }
        .sas-subtitle { font-size:12px; color:#64748b; margin-top:6px; letter-spacing:.5px; }

        .btn-install {
          margin-top:16px; padding:10px 22px;
          background:linear-gradient(135deg,#1d4ed8,#3b82f6);
          color:#fff; border:none; border-radius:100px;
          font-family:'DM Sans',sans-serif; font-weight:600; font-size:13px;
          cursor:pointer; box-shadow:0 4px 15px rgba(59,130,246,0.3);
          display:block; margin-left:auto; margin-right:auto;
        }
        .ios-hint {
          margin-top:12px; padding:10px 16px;
          background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2);
          border-radius:12px; font-size:12px; color:#93c5fd; line-height:1.7;
        }
        .sas-hint { font-size:11px; color:#334155; margin-top:10px; }

        .quick-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:14px; }
        .btn-quick {
          padding:15px 10px; border-radius:16px; border:none;
          font-family:'DM Sans',sans-serif; font-weight:700; font-size:13px;
          cursor:pointer; transition:transform .15s;
        }
        .btn-quick:active { transform:scale(.97); }
        .btn-repuestos { background:linear-gradient(135deg,#1e3a5f,#2563eb); color:#fff; box-shadow:0 4px 14px rgba(37,99,235,.3); }
        .btn-cafe      { background:linear-gradient(135deg,#7c2d12,#ea580c); color:#fff; box-shadow:0 4px 14px rgba(234,88,12,.3); }
        .btn-wa-q      { background:linear-gradient(135deg,#14532d,#16a34a); color:#fff; box-shadow:0 4px 14px rgba(22,163,74,.3); }

        .card {
          background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.07);
          border-radius:20px; padding:20px; backdrop-filter:blur(12px); margin-bottom:12px;
        }
        .card-title {
          font-family:'Syne',sans-serif; font-size:16px; font-weight:700;
          color:#f1f5f9; margin-bottom:14px; letter-spacing:.5px;
        }

        /* ACORDEÓN */
        .prod-accordion { display:flex; flex-direction:column; gap:6px; }
        .prod-item { border-radius:14px; border:1px solid rgba(255,255,255,0.07); overflow:hidden; transition:border-color .2s; }
        .prod-item.open { border-color:rgba(52,211,153,0.3); }
        .prod-item-header {
          display:flex; justify-content:space-between; align-items:center;
          padding:13px 16px; cursor:pointer; background:rgba(255,255,255,0.03);
          transition:background .15s; user-select:none;
        }
        .prod-item-header:active { background:rgba(255,255,255,0.07); }
        .prod-item-name { font-weight:600; font-size:14px; color:#e2e8f0; display:flex; align-items:center; gap:8px; }
        .prod-item-arrow { font-size:11px; color:#475569; transition:transform .25s; }
        .prod-item-arrow.open { transform:rotate(180deg); color:#34d399; }
        .prod-item-body {
          max-height:0; overflow:hidden; transition:max-height .3s ease, padding .3s ease;
          padding:0 16px; background:rgba(0,0,0,0.2);
        }
        .prod-item-body.open { max-height:120px; padding:12px 16px 14px; }
        .prod-price-big { font-family:'Syne',sans-serif; font-weight:800; font-size:22px; color:#34d399; margin-bottom:4px; }
        .prod-stock-badge { font-size:11px; font-weight:700; padding:3px 10px; border-radius:100px; }
        .stock-ok { background:rgba(52,211,153,0.15); color:#34d399; }
        .stock-no { background:rgba(248,113,113,0.15); color:#f87171; }
        .loading-dots { font-size:13px; color:#475569; text-align:center; padding:12px; }

        /* SEARCH ACORDEÓN */
        .search-acord {
          display:flex; align-items:center; gap:8px;
          background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);
          border-radius:12px; padding:10px 14px; margin-bottom:12px;
        }
        .search-acord input {
          flex:1; background:transparent; border:none; outline:none;
          color:#e2e8f0; font-family:'DM Sans',sans-serif; font-size:14px;
        }
        .search-acord input::placeholder { color:#475569; }
        .search-acord span { font-size:16px; flex-shrink:0; }
        .btn-ver-mas {
          width:100%; margin-top:10px; padding:12px;
          background:rgba(59,130,246,0.12); border:1px solid rgba(59,130,246,0.25);
          border-radius:12px; color:#93c5fd; font-family:'DM Sans',sans-serif;
          font-weight:700; font-size:13px; cursor:pointer; transition:background .15s;
        }
        .btn-ver-mas:active { background:rgba(59,130,246,0.2); }
        .result-count { font-size:11px; color:#475569; margin-bottom:8px; text-align:right; }

        /* BUSCADOR */
        .search-intro { font-size:14px; color:#334155; line-height:1.7; margin-bottom:20px; }
        .field-label { font-size:12px; font-weight:600; color:#64748b; letter-spacing:.8px; text-transform:uppercase; display:block; margin-bottom:10px; }
        .input-placa {
          display:block; width:100%; padding:18px;
          font-family:'Syne',sans-serif; font-size:28px; font-weight:800;
          text-align:center; letter-spacing:8px; text-transform:uppercase;
          background:rgba(255,255,255,0.04); border:2px solid rgba(255,255,255,0.1);
          border-radius:14px; color:#fff; margin-bottom:16px;
          transition:border-color .2s, box-shadow .2s; outline:none;
        }
        .input-placa:focus { border-color:#3b82f6; box-shadow:0 0 0 4px rgba(59,130,246,0.12); }
        .input-placa::placeholder { color:#334155; letter-spacing:4px; }
        .error-banner {
          background:rgba(220,38,38,0.1); border:1px solid rgba(220,38,38,0.3);
          color:#fca5a5; padding:13px 16px; border-radius:12px;
          font-size:13px; font-weight:500; margin-bottom:14px;
        }
        .btn-buscar {
          width:100%; padding:17px; border:none; border-radius:14px;
          font-family:'Syne',sans-serif; font-weight:800; font-size:16px; letter-spacing:.5px;
          cursor:pointer; transition:opacity .2s, transform .15s;
          background:linear-gradient(135deg,#1d4ed8,#3b82f6);
          color:#fff; box-shadow:0 6px 20px rgba(59,130,246,0.35);
        }
        .btn-buscar:disabled { opacity:.4; cursor:not-allowed; }
        .btn-buscar:not(:disabled):active { transform:scale(.98); }

        /* RESULTADO */
        .btn-volver {
          margin-bottom:14px; padding:10px 20px;
          background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);
          border-radius:100px; cursor:pointer; font-weight:600; font-size:13px; color:#94a3b8;
        }
        .car-card {
          background:linear-gradient(135deg,#0f1729 0%,#1e3a5f 100%);
          border:1px solid rgba(59,130,246,0.2); border-radius:22px; padding:22px;
          margin-bottom:12px; position:relative; overflow:hidden;
        }
        .car-card::before {
          content:''; position:absolute; right:-30px; top:-30px;
          width:160px; height:160px; border-radius:50%;
          background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);
        }
        .car-main { display:flex; gap:16px; align-items:center; position:relative; }
        .car-emoji { font-size:52px; }
        .car-marca { font-family:'Syne',sans-serif; font-size:22px; font-weight:800; color:#fff; }
        .car-meta  { font-size:13px; color:#64748b; margin-top:4px; }
        .placa-badge {
          margin-top:12px; display:inline-block;
          background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.15);
          padding:8px 20px; border-radius:10px;
          font-family:'Syne',sans-serif; font-weight:900; font-size:20px;
          letter-spacing:5px; color:#93c5fd;
        }

        /* ESTADO */
        .estado-card { border-radius:22px; padding:22px; margin-bottom:12px; overflow:hidden; }
        .estado-top-label { font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:14px; }
        .estado-row { display:flex; align-items:center; gap:16px; margin-bottom:20px; }
        .estado-emoji { font-size:48px; }
        .estado-name { font-family:'Syne',sans-serif; font-size:22px; font-weight:800; color:#fff; }
        .estado-msg  { font-size:13px; color:rgba(255,255,255,0.6); margin-top:4px; line-height:1.6; }

        .progress-wrap { display:flex; justify-content:space-between; gap:4px; }
        .prog-step { display:flex; flex-direction:column; align-items:center; flex:1; }
        .prog-dot {
          width:28px; height:28px; border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          font-size:11px; font-weight:800;
        }
        .prog-dot-done   { background:rgba(255,255,255,0.2); color:#fff; }
        .prog-dot-active { background:#fff; color:#111; box-shadow:0 0 12px rgba(255,255,255,0.4); }
        .prog-dot-future { background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.25); }
        .prog-label { font-size:8px; margin-top:5px; text-align:center; font-weight:600; white-space:nowrap; }
        .prog-label-on  { color:rgba(255,255,255,0.85); }
        .prog-label-off { color:rgba(255,255,255,0.2); }

        .tabs-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; }
        .tab-btn {
          padding:13px 8px; border-radius:14px; border:1px solid rgba(255,255,255,0.07);
          font-family:'DM Sans',sans-serif; font-weight:700; font-size:13px; cursor:pointer; transition:all .2s;
        }
        .tab-active   { background:linear-gradient(135deg,#1d4ed8,#3b82f6); color:#fff; border-color:transparent; box-shadow:0 4px 14px rgba(59,130,246,.3); }
        .tab-inactive { background:rgba(255,255,255,0.04); color:#64748b; }

        .orden-card {
          border-radius:18px; padding:18px; margin-bottom:10px;
          background:rgba(15,23,42,0.95); border:1px solid rgba(255,255,255,0.07); border-left:4px solid;
        }
        .orden-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
        .orden-id    { font-family:'Syne',sans-serif; font-weight:800; font-size:15px; color:#f1f5f9; }
        .orden-badge { padding:4px 14px; border-radius:100px; font-size:11px; font-weight:700; }
        .orden-desc  { font-size:13px; color:#64748b; line-height:1.6; }
        .btn-wa-card {
          margin-top:14px; width:100%; padding:12px;
          background:linear-gradient(135deg,#14532d,#16a34a);
          color:#fff; border:none; border-radius:12px;
          font-family:'DM Sans',sans-serif; font-weight:700; font-size:13px;
          cursor:pointer; box-shadow:0 4px 14px rgba(22,163,74,.25);
        }

        .btn-camino {
          display:block; width:100%; margin-top:18px; padding:16px;
          background:linear-gradient(135deg,#14532d,#22c55e);
          color:#fff; border:none; border-radius:14px;
          font-family:'Syne',sans-serif; font-weight:800; font-size:16px;
          letter-spacing:.5px; cursor:pointer; text-decoration:none;
          text-align:center;
          box-shadow:0 6px 24px rgba(34,197,94,.45);
          animation: pulse-green 2s infinite;
        }
        @keyframes pulse-green {
          0%,100% { box-shadow:0 6px 24px rgba(34,197,94,.45); }
          50%      { box-shadow:0 8px 32px rgba(34,197,94,.75); }
        }

        .diag-card {
          border-radius:18px; padding:18px; margin-bottom:10px;
          background:rgba(15,23,42,0.95); border:1px solid rgba(255,255,255,0.07);
        }
        .diag-tipo { font-family:'Syne',sans-serif; font-weight:700; font-size:14px; color:#e2e8f0; margin-bottom:6px; }
        .diag-obs  { font-size:13px; color:#64748b; line-height:1.6; }

        /* ── HISTORIAL PERMANENTE ── */
        .hist-timeline { position:relative; padding-left:20px; }
        .hist-timeline::before {
          content:''; position:absolute; left:7px; top:0; bottom:0;
          width:2px; background:rgba(255,255,255,0.07); border-radius:2px;
        }
        .hist-item {
          position:relative; margin-bottom:14px; cursor:pointer;
          background:rgba(15,23,42,0.95); border:1px solid rgba(255,255,255,0.07);
          border-radius:18px; padding:16px 16px 14px;
          transition: border-color .2s, transform .15s;
        }
        .hist-item:active { transform:scale(.98); }
        .hist-item.open { border-color:rgba(52,211,153,0.3); }
        .hist-item::before {
          content:''; position:absolute; left:-16px; top:18px;
          width:14px; height:14px; border-radius:50%;
          background:linear-gradient(135deg,#1d4ed8,#3b82f6);
          box-shadow:0 0 8px rgba(59,130,246,0.5); border:2px solid #080c14;
        }
        .hist-servicio { font-family:'Syne',sans-serif; font-weight:700; font-size:14px; color:#e2e8f0; margin-bottom:4px; }
        .hist-meta { font-size:12px; color:#475569; margin-bottom:8px; }
        .hist-cost { font-family:'Syne',sans-serif; font-weight:800; font-size:18px; color:#34d399; }
        .hist-badge {
          display:inline-block; padding:2px 10px; border-radius:100px;
          font-size:11px; font-weight:700; background:rgba(52,211,153,0.12); color:#34d399; margin-left:8px;
        }
        .hist-body { margin-top:12px; border-top:1px solid rgba(255,255,255,0.06); padding-top:12px; }
        .hist-section { margin-bottom:10px; }
        .hist-section-title { font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#475569; margin-bottom:6px; }
        .hist-section-text { font-size:13px; color:#94a3b8; line-height:1.7; white-space:pre-wrap; }
        .hist-falla { background:rgba(251,191,36,0.08); border:1px solid rgba(251,191,36,0.2); border-radius:10px; padding:10px 12px; margin-bottom:8px; }
        .hist-falla-title { font-size:10px; font-weight:700; color:#fbbf24; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
        .hist-falla-text { font-size:13px; color:#fde68a; line-height:1.6; }
        .hist-costos { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; }
        .hist-costo-box { background:rgba(255,255,255,0.04); border-radius:10px; padding:10px; text-align:center; }
        .hist-costo-label { font-size:10px; color:#475569; text-transform:uppercase; letter-spacing:.8px; margin-bottom:4px; }
        .hist-costo-val { font-family:'Syne',sans-serif; font-weight:700; font-size:14px; color:#e2e8f0; }
        .hist-ncf { font-size:11px; color:#475569; margin-top:8px; }

        .hist-empty { text-align:center; padding:28px 16px; color:#334155; }
        .hist-empty-icon { font-size:36px; margin-bottom:10px; }
        .hist-empty-txt { font-size:14px; font-weight:600; color:#475569; }
        .hist-empty-sub { font-size:12px; color:#1e293b; margin-top:6px; }

        .wa-float {
          position:fixed; bottom:22px; right:22px;
          background:linear-gradient(135deg,#15803d,#22c55e);
          color:#fff; width:58px; height:58px; border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          font-size:26px; text-decoration:none;
          box-shadow:0 6px 24px rgba(34,197,94,.45);
          z-index:999; transition:transform .15s;
        }
        .wa-float:active { transform:scale(.93); }

        .footer { text-align:center; padding:30px 0 80px; color:#1e293b; font-size:12px; }
        .footer-brand { font-family:'Syne',sans-serif; font-weight:700; font-size:14px; color:#334155; margin:6px 0 2px; }

        @keyframes fadeUp { from{ opacity:0; transform:translateY(16px); } to{ opacity:1; transform:translateY(0); } }
        .fade-up  { animation:fadeUp .4s ease both; }
        .delay-1  { animation-delay:.05s; }
        .delay-2  { animation-delay:.10s; }
        .delay-3  { animation-delay:.15s; }
      `}</style>

      <div className="sas-root">
        <div className="sas-content">

          {/* ── HEADER ── */}
          <div className="sas-header">
            <img
              src="/logo-192x192.png"
              alt="Logo Sólido"
              className="sas-logo"
              onError={(e) => { (e.target as HTMLImageElement).src = "/logo.png"; }}
            />
            <div className="sas-title">SÓLIDO AUTO SERVICIO & CAFE</div>
            <div className="sas-subtitle">Portal del Cliente · 809-712-2027</div>

            {instalable && (
              <button onClick={instalarApp} className="btn-install">
                📲 Instalar App
              </button>
            )}
            {!instalable && esIOS && (
              <div className="ios-hint">
                🍎 iPhone/iPad: toca <strong>Compartir</strong> → <strong>Agregar a inicio</strong>
              </div>
            )}
            {!instalable && !esIOS && (
              <div className="sas-hint">📲 Menú del navegador → Agregar a pantalla de inicio</div>
            )}
          </div>

          {/* ── BODY ── */}
          <div style={{ padding:"16px" }}>

            {/* ── ACCIONES RÁPIDAS (3 botones) ── */}
            <div className="quick-grid fade-up">
              <button onClick={verRepuestos} className="btn-quick btn-repuestos">
                🔩 {showRepuestos ? "Ocultar" : "Repuestos"}
              </button>
              <button onClick={verCafe} className="btn-quick btn-cafe">
                ☕ {showCafe ? "Ocultar" : "Menú Café"}
              </button>
              <button
                onClick={() => window.open("https://wa.me/18097122027","_blank")}
                className="btn-quick btn-wa-q"
              >
                💬 WhatsApp
              </button>
            </div>

            {/* ── ACORDEÓN REPUESTOS ── */}
            {showRepuestos && (
              <div className="card fade-up">
                <div className="card-title">🔩 Repuestos Disponibles</div>
                {loadingRepuestos ? (
                  <div className="loading-dots">Cargando repuestos...</div>
                ) : repuestos.length === 0 ? (
                  <div className="loading-dots">Sin repuestos disponibles.</div>
                ) : (() => {
                  const filtrados = repuestos.filter((p: any) =>
                    !repuestoSearch || p.name?.toLowerCase().includes(repuestoSearch.toLowerCase())
                  );
                  const visibles = filtrados.slice(0, repuestosPage * PAGE_SIZE);
                  const hayMas   = visibles.length < filtrados.length;
                  return (
                    <>
                      <div className="search-acord">
                        <span>🔍</span>
                        <input
                          value={repuestoSearch}
                          onChange={e => { setRepuestoSearch(e.target.value); setRepuestosPage(1); }}
                          placeholder="Buscar repuesto por nombre..."
                        />
                        {repuestoSearch && (
                          <span style={{ cursor:"pointer", fontSize:13, color:"#64748b" }}
                            onClick={() => { setRepuestoSearch(""); setRepuestosPage(1); }}>✕</span>
                        )}
                      </div>
                      <div className="result-count">
                        {repuestoSearch ? `${filtrados.length} resultado${filtrados.length !== 1 ? "s" : ""}` : `${repuestos.length} artículos`}
                        {" · "}mostrando {Math.min(visibles.length, filtrados.length)}
                      </div>
                      <div className="prod-accordion">
                        {visibles.map((p: any) => {
                          const abierto  = repuestoAbierto === p.id;
                          const hayStock = Number(p.stock) > 0;
                          return (
                            <div key={p.id} className={`prod-item ${abierto ? "open" : ""}`}>
                              <div className="prod-item-header"
                                onClick={() => setRepuestoAbierto(abierto ? null : p.id)}>
                                <span className="prod-item-name">
                                  <span style={{ fontSize:16 }}>{hayStock ? "🟢" : "🔴"}</span>
                                  {p.name}
                                </span>
                                <span className={`prod-item-arrow ${abierto ? "open" : ""}`}>▼</span>
                              </div>
                              <div className={`prod-item-body ${abierto ? "open" : ""}`}>
                                <div className="prod-price-big">
                                  RD$ {Number(p.price).toLocaleString("es-DO", { minimumFractionDigits:2, maximumFractionDigits:2 })}
                                </div>
                                <span className={`prod-stock-badge ${hayStock ? "stock-ok" : "stock-no"}`}>
                                  {hayStock ? `✓ Disponible (${p.stock})` : "Sin stock"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {hayMas && (
                        <button className="btn-ver-mas"
                          onClick={() => setRepuestosPage(pg => pg + 1)}>
                          ⬇️ Ver más ({filtrados.length - visibles.length} restantes)
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* ── ACORDEÓN MENÚ CAFETERÍA ── */}
            {showCafe && (
              <div className="card fade-up">
                <div className="card-title">☕ MENÚ DE EXPERIENCIAS</div>
                {loadingCafe ? (
                  <div className="loading-dots">Cargando menú...</div>
                ) : cafe.length === 0 ? (
                  <div className="loading-dots">Sin productos en el menú.</div>
                ) : (() => {
                  const filtrados = cafe.filter((p: any) =>
                    !cafeSearch || p.nombre?.toLowerCase().includes(cafeSearch.toLowerCase()) ||
                    p.categoria?.toLowerCase().includes(cafeSearch.toLowerCase())
                  );
                  const visibles = filtrados.slice(0, cafePage * PAGE_SIZE);
                  const hayMas   = visibles.length < filtrados.length;
                  return (
                    <>
                      <div className="search-acord">
                        <span>🔍</span>
                        <input
                          value={cafeSearch}
                          onChange={e => { setCafeSearch(e.target.value); setCafePage(1); }}
                          placeholder="Buscar producto o categoría..."
                        />
                        {cafeSearch && (
                          <span style={{ cursor:"pointer", fontSize:13, color:"#64748b" }}
                            onClick={() => { setCafeSearch(""); setCafePage(1); }}>✕</span>
                        )}
                      </div>
                      <div className="result-count">
                        {cafeSearch ? `${filtrados.length} resultado${filtrados.length !== 1 ? "s" : ""}` : `${cafe.length} productos`}
                        {" · "}mostrando {Math.min(visibles.length, filtrados.length)}
                      </div>
                      <div className="prod-accordion">
                        {visibles.map((p: any) => {
                          const abierto  = cafeAbierto === p.id;
                          const hayStock = Number(p.stock) > 0;
                          return (
                            <div key={p.id} className={`prod-item ${abierto ? "open" : ""}`}>
                              <div className="prod-item-header"
                                onClick={() => setCafeAbierto(abierto ? null : p.id)}>
                                <span className="prod-item-name">
                                  <span style={{ fontSize:16 }}>{hayStock ? "🟢" : "🔴"}</span>
                                  {p.nombre}
                                  {p.categoria && (
                                    <span style={{ fontSize:11, color:"#475569", fontWeight:400 }}>
                                      · {p.categoria}
                                    </span>
                                  )}
                                </span>
                                <span className={`prod-item-arrow ${abierto ? "open" : ""}`}>▼</span>
                              </div>
                              <div className={`prod-item-body ${abierto ? "open" : ""}`}>
                                <div className="prod-price-big">
                                  RD$ {Number(p.precio).toLocaleString("es-DO", { minimumFractionDigits:2, maximumFractionDigits:2 })}
                                </div>
                                <span className={`prod-stock-badge ${hayStock ? "stock-ok" : "stock-no"}`}>
                                  {hayStock ? `✓ Disponible (${p.stock})` : "Sin stock"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {hayMas && (
                        <button className="btn-ver-mas"
                          onClick={() => setCafePage(pg => pg + 1)}>
                          ⬇️ Ver más ({filtrados.length - visibles.length} restantes)
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* ── BUSCADOR ── */}
            {!resultado && (
              <div className="card fade-up delay-1">
                <div className="card-title">🔎 Consulta tu Vehículo</div>
                <p className="search-intro">
                  Ingresa la placa de tu vehículo para ver su estado en tiempo real.
                </p>
                <label className="field-label">Placa del vehículo</label>
                <input
                  value={placa}
                  onChange={e => setPlaca(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && buscar()}
                  placeholder="A123456"
                  maxLength={10}
                  className="input-placa"
                />
                {error && <div className="error-banner">⚠️ {error}</div>}
                <button
                  onClick={buscar}
                  disabled={loading || !placa.trim()}
                  className="btn-buscar"
                >
                  {loading ? "⏳ Buscando..." : "🔍 Consultar Estado"}
                </button>
              </div>
            )}

            {/* ── RESULTADO ── */}
            {resultado && (
              <div>
                <button
                  onClick={() => { setResultado(null); setPlaca(""); }}
                  className="btn-volver"
                >
                  ← Nueva consulta
                </button>

                {/* VEHÍCULO */}
                <div className="car-card fade-up">
                  <div className="car-main">
                    <span className="car-emoji">🚗</span>
                    <div>
                      <div className="car-marca">
                        {resultado.vehiculo.marca} {resultado.vehiculo.modelo}
                      </div>
                      <div className="car-meta">
                        Año {resultado.vehiculo.ano}
                        {resultado.vehiculo.color ? ` · ${resultado.vehiculo.color}` : ""}
                      </div>
                      <div className="placa-badge">{resultado.vehiculo.placa}</div>
                    </div>
                  </div>
                </div>

                {/* ESTADO */}
                {ultimaOrden && estadoInfo && (
                  <div className="estado-card fade-up delay-1" style={{ background: estadoInfo.grad }}>
                    <div className="estado-top-label">Estado Actual</div>
                    <div className="estado-row">
                      <span className="estado-emoji">{estadoInfo.emoji}</span>
                      <div>
                        <div className="estado-name">{ultimaOrden.estado.replace("_"," ")}</div>
                        <div className="estado-msg">{estadoInfo.msg}</div>
                      </div>
                    </div>
                    <div className="progress-wrap">
                      {PASOS.map((paso, i) => {
                        const alcanzado = i < pasoActual;
                        const actual    = i === pasoActual - 1;
                        return (
                          <div key={paso} className="prog-step">
                            <div className={`prog-dot ${actual ? "prog-dot-active" : alcanzado ? "prog-dot-done" : "prog-dot-future"}`}>
                              {alcanzado || actual ? "✓" : i + 1}
                            </div>
                            <div className={`prog-label ${alcanzado || actual ? "prog-label-on" : "prog-label-off"}`}>
                              {PASOS_LABEL[i]}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {ultimaOrden.estado === "LISTO" && (
                      <a
                        href={`https://wa.me/18097122027?text=${encodeURIComponent(
                          `Hola, soy el dueño del vehículo *${resultado.vehiculo.marca} ${resultado.vehiculo.modelo}* · Placa *${resultado.vehiculo.placa}*. Ya estoy en camino a buscarlo. Llegaré aproximadamente en 20 minutos. 🚗`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-camino"
                      >
                        🚗 ¡Voy a buscarlo!
                      </a>
                    )}
                  </div>
                )}

                {/* TABS */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }} className="fade-up delay-2">
                  {[
                    { key:"estado",    label:`📋 Servicios (${resultado.ordenes.length})` },
                    { key:"historial", label:`🔬 Diagnósticos (${resultado.diagnosticos.length})` },
                    { key:"histperm",  label:`📚 Historial (${historialPerm.length})` },
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => { setTab(t.key); setHistDetalle(null); }}
                      className={`tab-btn ${tab === t.key ? "tab-active" : "tab-inactive"}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* ÓRDENES */}
                {tab === "estado" && (
                  <div className="fade-up delay-3">
                    {resultado.ordenes.length === 0 ? (
                      <div className="card" style={{ textAlign:"center", color:"#475569", padding:28 }}>
                        <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
                        Sin órdenes activas registradas.
                      </div>
                    ) : resultado.ordenes.map((o: any) => {
                      const info = (ESTADO_INFO as any)[o.estado] || ESTADO_INFO.RECIBIDO;
                      return (
                        <div key={o.id} className="orden-card" style={{ borderLeftColor: info.color }}>
                          <div className="orden-header">
                            <span className="orden-id">Orden #{o.id}</span>
                            <span className="orden-badge" style={{ background:`${info.color}22`, color:info.color }}>
                              {o.estado.replace("_"," ")}
                            </span>
                          </div>
                          <div className="orden-desc">{o.descripcion}</div>
                          <button
                            onClick={() => {
                              const msg = `Hola, quiero info de mi vehículo (${resultado.vehiculo.placa}), orden #${o.id}`;
                              window.open(`https://wa.me/18097122027?text=${encodeURIComponent(msg)}`,"_blank");
                            }}
                            className="btn-wa-card"
                          >
                            💬 Consultar por WhatsApp
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* DIAGNÓSTICOS */}
                {tab === "historial" && (
                  <div className="fade-up delay-3">
                    {resultado.diagnosticos.length === 0 && historialPerm.length === 0 ? (
                      <div className="card" style={{ textAlign:"center", color:"#475569", padding:28 }}>
                        <div style={{ fontSize:32, marginBottom:8 }}>🔬</div>
                        Sin diagnósticos registrados.
                      </div>
                    ) : (
                      <div>
                        {/* Botón imprimir historial completo */}
                        <button
                          onClick={() => imprimirHistorialCompleto(resultado, historialPerm)}
                          style={{
                            width:"100%", marginBottom:14, padding:"13px 16px",
                            background:"linear-gradient(135deg,#1e3a5f,#1d4ed8)",
                            color:"#fff", border:"none", borderRadius:14,
                            fontWeight:700, fontSize:14, cursor:"pointer",
                            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                            boxShadow:"0 4px 14px rgba(29,78,216,0.35)",
                          }}
                        >
                          🖨️ Imprimir Historial Completo
                        </button>

                        {/* Diagnósticos detallados */}
                        {resultado.diagnosticos.map((d: any) => {
                          const moTotal  = Number(d.mano_obra || 0);
                          const repTotal = Number(d.repuestos || 0);
                          const total    = moTotal + repTotal || Number(d.total || 0);
                          const items: any[] = d.repuestos_items || [];
                          const trabajos = (d.mano_de_obra_detalle || "")
                            .split("\n").filter((l: string) => l.trim());
                          return (
                            <div key={d.id} className="diag-card" style={{ marginBottom:12 }}>
                              {/* Header */}
                              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                                <div>
                                  <div className="diag-tipo">{d.tipo_servicio || "Diagnóstico Técnico"}</div>
                                  {d.created_at && (
                                    <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>
                                      {new Date(d.created_at).toLocaleDateString("es-DO", { year:"numeric", month:"long", day:"numeric" })}
                                    </div>
                                  )}
                                </div>
                                <span style={{
                                  fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20,
                                  background: d.terminado ? "rgba(52,211,153,0.15)" : "rgba(251,191,36,0.15)",
                                  color: d.terminado ? "#34d399" : "#fbbf24",
                                }}>
                                  {d.terminado ? "Cerrado" : "Borrador"}
                                </span>
                              </div>

                              {/* Hallazgos */}
                              {(d.descripcion || d.hallazgos) && (
                                <div style={{ marginBottom:10 }}>
                                  <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", color:"#475569", letterSpacing:1, marginBottom:5 }}>Hallazgos Técnicos</div>
                                  <div className="diag-obs" style={{ background:"rgba(255,255,255,0.04)", borderRadius:8, padding:"8px 10px", whiteSpace:"pre-wrap", lineHeight:1.7 }}>
                                    {d.descripcion || d.hallazgos}
                                  </div>
                                </div>
                              )}

                              {/* Trabajos a realizar */}
                              {trabajos.length > 0 && (
                                <div style={{ marginBottom:10 }}>
                                  <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", color:"#475569", letterSpacing:1, marginBottom:5 }}>Trabajos a Realizar</div>
                                  <div style={{ background:"rgba(52,211,153,0.06)", borderRadius:8, padding:"8px 10px" }}>
                                    {trabajos.map((t: string, i: number) => (
                                      <div key={i} style={{ fontSize:12, color:"#94a3b8", marginBottom:3 }}>✓ {t.trim()}</div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Repuestos */}
                              {items.length > 0 && (
                                <div style={{ marginBottom:10 }}>
                                  <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", color:"#475569", letterSpacing:1, marginBottom:5 }}>Repuestos</div>
                                  {items.map((r: any, i: number) => (
                                    <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"5px 0", borderBottom:"1px solid rgba(255,255,255,0.05)", color:"#94a3b8" }}>
                                      <span>{r.nombre} ×{r.cantidad}</span>
                                      <span style={{ color:"#fbbf24", fontWeight:700 }}>RD$ {Number(r.subtotal || 0).toLocaleString("es-DO", { minimumFractionDigits:2 })}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Costos */}
                              {total > 0 && (
                                <div style={{ background:"rgba(52,211,153,0.06)", borderRadius:10, padding:"10px 12px", marginTop:6 }}>
                                  {moTotal > 0 && (
                                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#94a3b8", marginBottom:4 }}>
                                      <span>Mano de obra</span>
                                      <span>RD$ {Number(moTotal).toLocaleString("es-DO", { minimumFractionDigits:2 })}</span>
                                    </div>
                                  )}
                                  {repTotal > 0 && (
                                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#94a3b8", marginBottom:4 }}>
                                      <span>Repuestos</span>
                                      <span>RD$ {Number(repTotal).toLocaleString("es-DO", { minimumFractionDigits:2 })}</span>
                                    </div>
                                  )}
                                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", borderTop:"1px solid rgba(52,211,153,0.2)", paddingTop:6, marginTop:4 }}>
                                    <span style={{ fontWeight:700, fontSize:13, color:"#e2e8f0" }}>Total</span>
                                    <span style={{ fontFamily:"Syne,sans-serif", fontWeight:800, fontSize:18, color:"#34d399" }}>
                                      RD$ {total.toLocaleString("es-DO", { minimumFractionDigits:2 })}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {d.tiempo_estimado && (
                                <div style={{ fontSize:12, color:"#475569", marginTop:8 }}>⏱ Tiempo estimado: {d.tiempo_estimado}</div>
                              )}
                              {d.notas && (
                                <div style={{ fontSize:12, color:"#fbbf24", background:"rgba(251,191,36,0.07)", borderRadius:8, padding:"6px 10px", marginTop:8 }}>
                                  📝 {d.notas}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Historial permanente resumido debajo de diagnósticos */}
                        {historialPerm.length > 0 && (
                          <div style={{ marginTop:8 }}>
                            <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", color:"#475569", letterSpacing:1, marginBottom:10, paddingLeft:4 }}>
                              📚 Servicios Anteriores ({historialPerm.length})
                            </div>
                            {historialPerm.map((h: any, idx: number) => (
                              <div
                                key={h.id || idx}
                                className="hist-item"
                                onClick={() => { setTab("histperm"); setHistDetalle(h); }}
                                style={{ cursor:"pointer" }}
                              >
                                <div className="hist-servicio">{h.tipo_servicio || "Servicio"}</div>
                                <div className="hist-meta">
                                  {h.fecha_servicio ? new Date(h.fecha_servicio).toLocaleDateString("es-DO", { year:"numeric", month:"short", day:"numeric" }) : "—"}
                                  {h.tecnico_nombre && ` · ${h.tecnico_nombre}`}
                                </div>
                                {h.costo_total > 0 && (
                                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                                    <span className="hist-cost">RD$ {Number(h.costo_total).toLocaleString("es-DO", { minimumFractionDigits:2 })}</span>
                                    <span style={{ fontSize:11, color:"#475569" }}>Ver detalle →</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── HISTORIAL PERMANENTE ── */}
                {tab === "histperm" && (
                  <div className="fade-up delay-3">
                    {histDetalle ? (
                      /* ── DETALLE DE UN SERVICIO ── */
                      <div>
                        {/* Botones Volver / Imprimir */}
                        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                          <button onClick={() => setHistDetalle(null)} className="btn-volver" style={{ flex:1 }}>
                            ← Volver
                          </button>
                          <button
                            onClick={() => imprimirExpediente(histDetalle)}
                            style={{ flex:1, background:"#1e40af", color:"#fff", border:"none", borderRadius:8, padding:"10px 0", fontWeight:700, fontSize:13, cursor:"pointer" }}
                          >
                            🖨️ Imprimir
                          </button>
                        </div>

                        {/* Header */}
                        <div className="card" style={{ background:"linear-gradient(135deg,#0f1729,#1e3a5f)", border:"1px solid rgba(59,130,246,0.2)", marginBottom:10 }}>
                          <div style={{ fontSize:10, color:"#64748b", fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", marginBottom:6 }}>
                            {histDetalle.fecha_servicio ? new Date(histDetalle.fecha_servicio).toLocaleDateString("es-DO",{year:"numeric",month:"long",day:"numeric"}) : "—"}
                            {histDetalle.numero_orden && <span style={{ marginLeft:8 }}>· Orden #{histDetalle.numero_orden}</span>}
                          </div>
                          <div style={{ fontFamily:"Syne,sans-serif", fontSize:20, fontWeight:800, color:"#fff" }}>
                            {histDetalle.tipo_servicio}
                          </div>
                          {histDetalle.tecnico_nombre && (
                            <div style={{ fontSize:13, color:"#64748b", marginTop:4 }}>👨‍🔧 {histDetalle.tecnico_nombre}</div>
                          )}
                          {histDetalle.motivo_entrada && (
                            <div style={{ fontSize:12, color:"#94a3b8", marginTop:6 }}>📋 {histDetalle.motivo_entrada}</div>
                          )}
                        </div>

                        {/* ── INSPECCIÓN VEHICULAR DE RECEPCIÓN ── */}
                        {histDetalle.inspeccion_data && typeof histDetalle.inspeccion_data === "object" && Object.keys(histDetalle.inspeccion_data).length > 0 && (() => {
                          const insp = histDetalle.inspeccion_data;
                          const fmtFH = (v: any) => v ? new Date(v).toLocaleString("es-DO",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : null;
                          const zonas: any[] = Array.isArray(insp.zonas_danio) ? insp.zonas_danio : [];
                          const fotoSlots: Record<string,string> = (insp.fotos_slots && typeof insp.fotos_slots === "object") ? insp.fotos_slots : {};
                          const fotosSlotArr = Object.entries(fotoSlots).filter(([,v]) => v).map(([k,v]) => ({ data: v, label: k.replace(/_/g," ") }));
                          const fotosExtra: any[] = Array.isArray(insp.fotos) ? insp.fotos : [];
                          const todasFotos = [...fotosSlotArr, ...fotosExtra].slice(0, 12);
                          const combPct = Number(insp.nivel_combustible || 0);
                          const combColor = combPct >= 60 ? "#22c55e" : combPct >= 30 ? "#f59e0b" : "#ef4444";
                          const checkItems = [
                            { k:"radio_pantalla",    l:"Radio / Pantalla" },
                            { k:"tapiceria_ok",      l:"Tapicería" },
                            { k:"alfombras_ok",      l:"Alfombras" },
                            { k:"luces_ok",          l:"Luces" },
                            { k:"bocina_ok",         l:"Bocina" },
                            { k:"espejos_ok",        l:"Espejos" },
                            { k:"gato_ok",           l:"Gato" },
                            { k:"llanta_repuesto_ok",l:"Llanta de repuesto" },
                            { k:"documentos_ok",     l:"Documentos" },
                            { k:"herramientas_ok",   l:"Herramientas" },
                          ].filter(c => insp[c.k] !== null && insp[c.k] !== undefined);

                          return (
                            <div className="card" style={{ marginBottom:10, border:"1px solid rgba(249,115,22,0.2)", background:"rgba(249,115,22,0.03)" }}>
                              <div style={{ fontSize:11, fontWeight:700, color:"#fb923c", textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>
                                🚗 Inspección de Recepción
                              </div>

                              {/* Datos principales */}
                              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))", gap:8, marginBottom:12 }}>
                                {insp.km_entrada != null && (
                                  <div style={{ background:"rgba(15,23,42,0.6)", borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                                    <div style={{ fontSize:10, color:"#64748b", textTransform:"uppercase", letterSpacing:.7, marginBottom:3 }}>Kilometraje</div>
                                    <div style={{ fontWeight:800, fontSize:14, color:"#f1f5f9" }}>{Number(insp.km_entrada).toLocaleString("es-DO")} km</div>
                                  </div>
                                )}
                                {insp.condicion_general && (
                                  <div style={{ background:"rgba(15,23,42,0.6)", borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                                    <div style={{ fontSize:10, color:"#64748b", textTransform:"uppercase", letterSpacing:.7, marginBottom:3 }}>Condición</div>
                                    <div style={{ fontWeight:700, fontSize:13, color:"#f1f5f9" }}>{insp.condicion_general}</div>
                                  </div>
                                )}
                                {insp.nivel_combustible != null && (
                                  <div style={{ background:"rgba(15,23,42,0.6)", borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                                    <div style={{ fontSize:10, color:"#64748b", textTransform:"uppercase", letterSpacing:.7, marginBottom:3 }}>Combustible</div>
                                    <div style={{ fontWeight:800, fontSize:14, color: combColor }}>{combPct}%</div>
                                    <div style={{ height:5, background:"rgba(148,163,184,0.15)", borderRadius:3, marginTop:4, overflow:"hidden" }}>
                                      <div style={{ height:"100%", width:`${combPct}%`, background: combColor, borderRadius:3 }} />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Estado exterior */}
                              {(insp.estado_vidrios || insp.estado_llantas || insp.estado_pintura || insp.rayones || insp.golpes) && (
                                <div style={{ marginBottom:10 }}>
                                  <div style={{ fontSize:10, color:"#64748b", fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Condición Exterior</div>
                                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                                    {[
                                      { l:"Vidrios",  v:insp.estado_vidrios },
                                      { l:"Llantas",  v:insp.estado_llantas },
                                      { l:"Pintura",  v:insp.estado_pintura },
                                      { l:"Rayones",  v:insp.rayones },
                                      { l:"Golpes",   v:insp.golpes },
                                    ].filter(x => x.v).map(x => (
                                      <div key={x.l} style={{ background:"rgba(15,23,42,0.5)", borderRadius:7, padding:"6px 10px" }}>
                                        <div style={{ fontSize:10, color:"#64748b", marginBottom:2 }}>{x.l}</div>
                                        <div style={{ fontSize:12, color:"#cbd5e1", fontWeight:600 }}>{x.v}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Zonas de daño */}
                              {zonas.length > 0 && (
                                <div style={{ marginBottom:10 }}>
                                  <div style={{ fontSize:10, color:"#fb923c", fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>⚠️ Zonas con Daño</div>
                                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                                    {zonas.map((z: any, i: number) => (
                                      <span key={i} style={{ fontSize:11, padding:"3px 10px", background:"rgba(249,115,22,0.1)", color:"#fb923c", border:"1px solid rgba(249,115,22,0.2)", borderRadius:20, fontWeight:600 }}>
                                        📍 {(z.zona||"").replace(/_/g," ")}{z.tipo ? ` — ${z.tipo}` : ""}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Checklist de accesorios */}
                              {checkItems.length > 0 && (
                                <div style={{ marginBottom:10 }}>
                                  <div style={{ fontSize:10, color:"#64748b", fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Accesorios e Interior</div>
                                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                                    {checkItems.map(c => (
                                      <span key={c.k} style={{ fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:600,
                                        background: insp[c.k] ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.08)",
                                        color:      insp[c.k] ? "#6ee7b7"              : "#fca5a5",
                                        border:     `1px solid ${insp[c.k] ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.15)"}` }}>
                                        {insp[c.k] ? "✅" : "❌"} {c.l}
                                      </span>
                                    ))}
                                    {insp.otros_accesorios && (
                                      <span style={{ fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:600, background:"rgba(99,102,241,0.1)", color:"#a5b4fc", border:"1px solid rgba(99,102,241,0.2)" }}>
                                        📦 {insp.otros_accesorios}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Observaciones */}
                              {insp.observaciones && (
                                <div style={{ fontSize:12, color:"#94a3b8", background:"rgba(15,23,42,0.5)", borderRadius:7, padding:"8px 10px", marginBottom:10 }}>
                                  {insp.observaciones}
                                </div>
                              )}

                              {/* Fotos */}
                              {todasFotos.length > 0 && (
                                <div style={{ marginBottom:10 }}>
                                  <div style={{ fontSize:10, color:"#64748b", fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>📷 Fotos de Recepción</div>
                                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))", gap:8 }}>
                                    {todasFotos.map((f: any, i: number) => (
                                      <div key={i} style={{ borderRadius:8, overflow:"hidden", border:"1px solid rgba(148,163,184,0.1)", background:"rgba(15,23,42,0.5)" }}>
                                        <img src={f.data} alt={f.label||""} loading="lazy"
                                          style={{ width:"100%", aspectRatio:"4/3", objectFit:"cover", display:"block" }}
                                          onError={(e) => { (e.target as HTMLImageElement).style.display="none"; }} />
                                        {f.label && <div style={{ fontSize:10, textAlign:"center", padding:"3px 4px", color:"#64748b" }}>{f.label}</div>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Firma del cliente */}
                              {insp.firma_cliente && (
                                <div>
                                  <div style={{ fontSize:10, color:"#64748b", fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>✍️ Firma del Cliente</div>
                                  <div style={{ borderRadius:8, overflow:"hidden", border:"1px solid rgba(148,163,184,0.1)", maxWidth:260 }}>
                                    <div style={{ fontSize:10, color:"#64748b", padding:"4px 8px", background:"rgba(15,23,42,0.8)", textAlign:"center" }}>Firmado al momento de la recepción</div>
                                    <img src={insp.firma_cliente} alt="Firma del cliente" style={{ width:"100%", display:"block", background:"#fff" }} />
                                  </div>
                                </div>
                              )}

                              {insp.creado_por_nombre && (
                                <div style={{ fontSize:11, color:"#475569", marginTop:10, paddingTop:8, borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                                  Recibido por: <b style={{ color:"#64748b" }}>{insp.creado_por_nombre}</b>
                                  {insp.fecha_recepcion && <span> · {fmtFH(insp.fecha_recepcion)}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Inspecciones */}
                        {(histDetalle.inspeccion_mecanica || histDetalle.inspeccion_electrica || histDetalle.inspeccion_electronica) && (
                          <div className="card" style={{ marginBottom:10 }}>
                            <div className="hist-section-title" style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>🔍 Inspección Técnica</div>
                            {histDetalle.inspeccion_mecanica && (
                              <div className="hist-section">
                                <div className="hist-section-title">🔧 Mecánica</div>
                                <div className="hist-section-text">{histDetalle.inspeccion_mecanica}</div>
                              </div>
                            )}
                            {histDetalle.inspeccion_electrica && (
                              <div className="hist-section">
                                <div className="hist-section-title">⚡ Eléctrica</div>
                                <div className="hist-section-text">{histDetalle.inspeccion_electrica}</div>
                              </div>
                            )}
                            {histDetalle.inspeccion_electronica && (
                              <div className="hist-section">
                                <div className="hist-section-title">💻 Scanner</div>
                                <div className="hist-section-text">{histDetalle.inspeccion_electronica}</div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Fallas */}
                        {(histDetalle.codigos_falla || histDetalle.fallas_identificadas) && (
                          <div className="hist-falla" style={{ marginBottom:10 }}>
                            <div className="hist-falla-title">⚠️ Fallas Identificadas</div>
                            {histDetalle.codigos_falla && <div className="hist-falla-text" style={{ marginBottom:4 }}>Códigos: {histDetalle.codigos_falla}</div>}
                            {histDetalle.fallas_identificadas && <div className="hist-falla-text">{histDetalle.fallas_identificadas}</div>}
                          </div>
                        )}

                        {/* Cotización */}
                        {histDetalle.cotizacion_data && (histDetalle.cotizacion_data.total > 0 || histDetalle.cotizacion_data.numero) && (
                          <div className="card" style={{ marginBottom:10 }}>
                            <div className="hist-section-title" style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>📄 Cotización</div>
                            {histDetalle.cotizacion_data.numero && (
                              <div style={{ fontSize:12, color:"#94a3b8", marginBottom:8 }}>
                                #{histDetalle.cotizacion_data.numero}
                                {histDetalle.cotizacion_data.aprobado && <span style={{ marginLeft:8, color:"#34d399", fontWeight:700 }}>✓ Aprobada</span>}
                                {histDetalle.cotizacion_data.tiempo_estimado && <span style={{ marginLeft:8 }}>· {histDetalle.cotizacion_data.tiempo_estimado}</span>}
                              </div>
                            )}
                            {(() => {
                              const items = Array.isArray(histDetalle.cotizacion_data.items_detalle) && histDetalle.cotizacion_data.items_detalle.length > 0
                                ? histDetalle.cotizacion_data.items_detalle
                                : (Array.isArray(histDetalle.cotizacion_data.items) ? histDetalle.cotizacion_data.items : []);
                              return items.length > 0 ? (
                                <div style={{ marginBottom:8 }}>
                                  {items.map((item: any, i: number) => (
                                    <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#cbd5e1", padding:"4px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                                      <span>{item.descripcion}{item.cantidad > 1 ? ` x${item.cantidad}` : ""}</span>
                                      <span>RD$ {Number(item.subtotal||0).toLocaleString("es-DO",{minimumFractionDigits:2})}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : null;
                            })()}
                            {histDetalle.cotizacion_data.mano_obra > 0 && (
                              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#94a3b8", marginBottom:4 }}>
                                <span>Mano de obra</span><span>RD$ {Number(histDetalle.cotizacion_data.mano_obra).toLocaleString("es-DO",{minimumFractionDigits:2})}</span>
                              </div>
                            )}
                            {histDetalle.cotizacion_data.repuestos > 0 && (
                              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#94a3b8", marginBottom:4 }}>
                                <span>Repuestos</span><span>RD$ {Number(histDetalle.cotizacion_data.repuestos).toLocaleString("es-DO",{minimumFractionDigits:2})}</span>
                              </div>
                            )}
                            <div style={{ display:"flex", justifyContent:"space-between", fontSize:14, fontWeight:700, color:"#38bdf8", marginTop:6, paddingTop:6, borderTop:"1px solid rgba(255,255,255,0.1)" }}>
                              <span>Total cotizado</span><span>RD$ {Number(histDetalle.cotizacion_data.total||0).toLocaleString("es-DO",{minimumFractionDigits:2})}</span>
                            </div>
                            {histDetalle.cotizacion_data.notas && (
                              <div style={{ fontSize:11, color:"#64748b", marginTop:8 }}>{histDetalle.cotizacion_data.notas}</div>
                            )}
                          </div>
                        )}

                        {/* Avances de Reparación */}
                        {Array.isArray(histDetalle.avances_data) && histDetalle.avances_data.length > 0 && (
                          <div className="card" style={{ marginBottom:10 }}>
                            <div className="hist-section-title" style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>🛠️ Avances de Reparación</div>
                            {histDetalle.avances_data.map((a: any, i: number) => (
                              <div key={i} style={{ paddingBottom:10, marginBottom:10, borderBottom: i < histDetalle.avances_data.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                                <div style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>
                                  {a.created_at ? new Date(a.created_at).toLocaleDateString("es-DO",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : ""}
                                  {a.tecnico_nombre && ` · ${a.tecnico_nombre}`}
                                </div>
                                <div style={{ fontSize:13, color:"#cbd5e1" }}>{a.descripcion}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Trabajos Realizados (fallback legado) */}
                        {histDetalle.trabajos_realizados && !(Array.isArray(histDetalle.avances_data) && histDetalle.avances_data.length > 0) && (
                          <div className="card" style={{ marginBottom:10 }}>
                            <div className="hist-section-title" style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>🛠️ Trabajos Realizados</div>
                            <div className="hist-section-text">{histDetalle.trabajos_realizados}</div>
                          </div>
                        )}

                        {/* Control de Calidad */}
                        {histDetalle.resultado_qc && (
                          <div className="card" style={{ marginBottom:10, border:`1px solid ${histDetalle.resultado_qc === "aprobado" ? "rgba(52,211,153,0.3)" : "rgba(239,68,68,0.3)"}` }}>
                            <div className="hist-section-title" style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>✅ Control de Calidad</div>
                            <div style={{ fontSize:14, fontWeight:700, color: histDetalle.resultado_qc === "aprobado" ? "#34d399" : "#ef4444", marginBottom:8 }}>
                              {histDetalle.resultado_qc === "aprobado" ? "✅ Aprobado" : "❌ Rechazado"}
                            </div>
                            {histDetalle.observaciones_qc && (
                              <div style={{ fontSize:12, color:"#94a3b8", marginBottom:8 }}>{histDetalle.observaciones_qc}</div>
                            )}
                            {histDetalle.checklist_qc && Object.keys(histDetalle.checklist_qc).length > 0 && (
                              <div>
                                {Object.entries(histDetalle.checklist_qc).map(([k, v]: [string, any]) => (
                                  <div key={k} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:"#94a3b8", marginBottom:4 }}>
                                    <span>{v ? "✅" : "❌"}</span>
                                    <span style={{ textTransform:"capitalize" }}>{k.replace(/_/g," ")}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Factura */}
                        {histDetalle.factura_data && histDetalle.factura_data.id && (
                          <div className="card" style={{ marginBottom:10 }}>
                            <div className="hist-section-title" style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>🧾 Factura</div>
                            {histDetalle.factura_data.ncf && (
                              <div style={{ fontSize:12, color:"#94a3b8", marginBottom:8 }}>NCF: {histDetalle.factura_data.ncf}{histDetalle.factura_data.metodo_pago ? ` · ${histDetalle.factura_data.metodo_pago}` : ""}</div>
                            )}
                            {Array.isArray(histDetalle.factura_data.items) && histDetalle.factura_data.items.length > 0 && (
                              <div style={{ marginBottom:10 }}>
                                {histDetalle.factura_data.items.map((fi: any, i: number) => (
                                  <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#cbd5e1", padding:"4px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                                    <span>{fi.descripcion}{fi.cantidad > 1 ? ` x${fi.cantidad}` : ""}</span>
                                    <span>RD$ {Number(fi.subtotal||0).toLocaleString("es-DO",{minimumFractionDigits:2})}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {histDetalle.factura_data.itbis > 0 && (
                              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#94a3b8", marginBottom:4 }}>
                                <span>ITBIS</span><span>RD$ {Number(histDetalle.factura_data.itbis).toLocaleString("es-DO",{minimumFractionDigits:2})}</span>
                              </div>
                            )}
                            <div style={{ display:"flex", justifyContent:"space-between", fontSize:16, fontWeight:800, color:"#34d399", marginTop:8, paddingTop:8, borderTop:"1px solid rgba(255,255,255,0.1)" }}>
                              <span>Total Pagado</span>
                              <span>RD$ {Number(histDetalle.factura_data.total||histDetalle.costo_total||0).toLocaleString("es-DO",{minimumFractionDigits:2})}</span>
                            </div>
                          </div>
                        )}

                        {/* Costos fallback si no hay factura_data */}
                        {!(histDetalle.factura_data && histDetalle.factura_data.id) && histDetalle.costo_total > 0 && (
                          <div className="card" style={{ marginBottom:10 }}>
                            <div className="hist-section-title" style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>💰 Costos del Servicio</div>
                            <div className="hist-costos">
                              <div className="hist-costo-box">
                                <div className="hist-costo-label">Mano de Obra</div>
                                <div className="hist-costo-val">RD$ {Number(histDetalle.costo_mano_obra||0).toLocaleString("es-DO",{minimumFractionDigits:2})}</div>
                              </div>
                              <div className="hist-costo-box">
                                <div className="hist-costo-label">Repuestos</div>
                                <div className="hist-costo-val">RD$ {Number(histDetalle.costo_repuestos||0).toLocaleString("es-DO",{minimumFractionDigits:2})}</div>
                              </div>
                            </div>
                            <div style={{ textAlign:"center", marginTop:12, fontFamily:"Syne,sans-serif", fontWeight:800, fontSize:22, color:"#34d399" }}>
                              Total: RD$ {Number(histDetalle.costo_total).toLocaleString("es-DO",{minimumFractionDigits:2})}
                            </div>
                            {histDetalle.ncf && <div className="hist-ncf">🧾 NCF: {histDetalle.ncf}</div>}
                          </div>
                        )}

                        {/* Línea de Tiempo */}
                        {Array.isArray(histDetalle.timeline_data) && histDetalle.timeline_data.length > 0 && (
                          <div className="card" style={{ marginBottom:10 }}>
                            <div className="hist-section-title" style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>📅 Línea de Tiempo</div>
                            {histDetalle.timeline_data.map((t: any, i: number) => (
                              <div key={i} style={{ display:"flex", gap:10, marginBottom:10 }}>
                                <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                                  <div style={{ width:8, height:8, borderRadius:"50%", background:"#3b82f6", flexShrink:0, marginTop:3 }} />
                                  {i < histDetalle.timeline_data.length - 1 && <div style={{ width:1, flex:1, background:"rgba(59,130,246,0.2)", minHeight:16 }} />}
                                </div>
                                <div style={{ flex:1, paddingBottom:4 }}>
                                  <div style={{ fontSize:12, fontWeight:700, color:"#e2e8f0" }}>
                                    {(t.estado_nuevo||"").replace(/_/g," ").replace(/\b\w/g,(c:string)=>c.toUpperCase())}
                                  </div>
                                  <div style={{ fontSize:11, color:"#475569" }}>
                                    {t.created_at ? new Date(t.created_at).toLocaleDateString("es-DO",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : ""}
                                    {t.usuario_nombre && ` · ${t.usuario_nombre}`}
                                  </div>
                                  {t.motivo && <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>{t.motivo}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Fechas del Proceso */}
                        {histDetalle.fechas_proceso && Object.values(histDetalle.fechas_proceso).some(Boolean) && (
                          <div className="card" style={{ marginBottom:10 }}>
                            <div className="hist-section-title" style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>📅 Fechas del Proceso</div>
                            {([
                              { key:"recibido", label:"Recibido" },
                              { key:"diagnostico", label:"Diagnóstico" },
                              { key:"esperando_aprobacion", label:"En Espera Aprobación" },
                              { key:"aprobacion", label:"Aprobado" },
                              { key:"inicio_reparacion", label:"Inicio Reparación" },
                              { key:"control_calidad", label:"Control de Calidad" },
                              { key:"listo", label:"Listo para Entrega" },
                              { key:"entrega", label:"Entregado" },
                            ] as {key:string,label:string}[]).filter(f => histDetalle.fechas_proceso[f.key]).map(f => (
                              <div key={f.key} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#94a3b8", marginBottom:6 }}>
                                <span>{f.label}</span>
                                <span style={{ color:"#cbd5e1" }}>{new Date(histDetalle.fechas_proceso[f.key]).toLocaleDateString("es-DO",{year:"numeric",month:"short",day:"numeric"})}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Observaciones */}
                        {histDetalle.observaciones && (
                          <div className="card" style={{ marginBottom:10 }}>
                            <div className="hist-section-title" style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>📝 Observaciones</div>
                            <div className="hist-section-text">{histDetalle.observaciones}</div>
                          </div>
                        )}

                        {/* Notas de Entrega */}
                        {histDetalle.notas_entrega && (
                          <div className="card" style={{ marginBottom:10 }}>
                            <div className="hist-section-title" style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>📦 Notas de Entrega</div>
                            <div className="hist-section-text">{histDetalle.notas_entrega}</div>
                          </div>
                        )}

                        {/* Segundo botón imprimir al final */}
                        <button
                          onClick={() => imprimirExpediente(histDetalle)}
                          style={{ width:"100%", background:"#1e40af", color:"#fff", border:"none", borderRadius:8, padding:"12px 0", fontWeight:700, fontSize:14, cursor:"pointer", marginBottom:14 }}
                        >
                          🖨️ Imprimir Expediente
                        </button>
                      </div>
                    ) : (
                      /* ── LISTA TIMELINE ── */
                      historialPerm.length === 0 ? (
                        <div className="card">
                          <div className="hist-empty">
                            <div className="hist-empty-icon">📚</div>
                            <div className="hist-empty-txt">Sin historial permanente</div>
                            <div className="hist-empty-sub">El historial se genera automáticamente cuando se completa un servicio.</div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize:12, color:"#475569", marginBottom:14, paddingLeft:4, fontWeight:600 }}>
                            {historialPerm.length} servicio{historialPerm.length !== 1 ? "s" : ""} registrado{historialPerm.length !== 1 ? "s" : ""}
                          </div>
                          <div className="hist-timeline">
                            {historialPerm.map((h: any, idx: number) => {
                              const abierto = histDetalle?.id === h.id;
                              return (
                                <div
                                  key={h.id}
                                  className={`hist-item ${abierto ? "open" : ""}`}
                                  onClick={() => setHistDetalle(h)}
                                >
                                  <div className="hist-servicio">{h.tipo_servicio || "Servicio"}</div>
                                  <div className="hist-meta">
                                    {h.fecha_servicio ? new Date(h.fecha_servicio).toLocaleDateString("es-DO",{year:"numeric",month:"short",day:"numeric"}) : "—"}
                                    {h.tecnico_nombre && ` · ${h.tecnico_nombre}`}
                                    {idx === 0 && <span className="hist-badge">Más reciente</span>}
                                  </div>
                                  {h.costo_total > 0 && (
                                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                                      <span className="hist-cost">RD$ {Number(h.costo_total).toLocaleString("es-DO",{minimumFractionDigits:2})}</span>
                                      <span style={{ fontSize:11, color:"#475569", fontWeight:600 }}>Ver detalle →</span>
                                    </div>
                                  )}
                                  {!h.costo_total && (
                                    <div style={{ fontSize:11, color:"#475569", fontWeight:600, textAlign:"right" }}>Ver detalle →</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            <footer className="footer">
              <div style={{ fontSize:22 }}>🔧</div>
              <div className="footer-brand">Sólido Auto Servicio</div>
              <div>809-712-2027</div>
            </footer>
          </div>
        </div>

        {/* BOTÓN FLOTANTE WHATSAPP */}
        <a href="https://wa.me/18097122027" target="_blank" className="wa-float">💬</a>
      </div>
    </>
  );
}
