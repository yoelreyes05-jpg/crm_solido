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
function imprimirExpediente(h: any, detalleCompleto: any) {
  const fmtMoney = (n: any) => Number(n || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 });
  const fmtDate  = (d: any) => d ? new Date(d).toLocaleDateString("es-DO", { year:"numeric", month:"long", day:"numeric" }) : "—";
  const fmtDT    = (d: any) => d ? new Date(d).toLocaleString("es-DO", { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
  const parseArr = (v: any): any[] => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v.trim().startsWith("[")) { try { return JSON.parse(v); } catch { return []; } }
    return [];
  };

  // ── Fuentes de datos: live > snapshot ──
  const cot        = h.cotizacion_data && typeof h.cotizacion_data === "object" ? h.cotizacion_data : {};
  const fac        = h.factura_data    && typeof h.factura_data    === "object" ? h.factura_data    : {};
  const fechas     = h.fechas_proceso  && typeof h.fechas_proceso  === "object" ? h.fechas_proceso  : {};
  const checklist  = h.checklist_qc   && typeof h.checklist_qc    === "object" ? h.checklist_qc    : {};
  const inspecSnap = h.inspeccion_data && typeof h.inspeccion_data === "object" ? h.inspeccion_data : null;
  const inspec: any = detalleCompleto?.inspeccion || inspecSnap || null;

  const avancesSnap: any[] = Array.isArray(h.avances_data) ? h.avances_data : [];
  const avances: any[] = Array.isArray(detalleCompleto?.avances) && detalleCompleto.avances.length > 0
    ? detalleCompleto.avances : avancesSnap;
  const timeline: any[] = Array.isArray(h.timeline_data) ? h.timeline_data : [];

  const cotItems  = Array.isArray(cot.items_detalle) && cot.items_detalle.length > 0 ? cot.items_detalle : (Array.isArray(cot.items) ? cot.items : []);
  const facItems: any[] = Array.isArray(fac.items) ? fac.items : [];

  // ── Campos enriquecidos ──
  const rawTrabItems = detalleCompleto?.diagnostico?.trabajos_realizados_items
    || cot?.trabajos_realizados_items || h.trabajos_realizados_items;
  const trabajosItems: any[] = parseArr(rawTrabItems);

  const manoDeObraDetalle: string =
    detalleCompleto?.diagnostico?.mano_de_obra_detalle
    || detalleCompleto?.cotizacion?.mano_de_obra_detalle
    || cot?.mano_de_obra_detalle
    || h.mano_de_obra_detalle || "";

  const descripcionTrabajo: string =
    detalleCompleto?.orden?.descripcion || h.descripcion || h.motivo_entrada || "";

  const firmaEntrega: string = detalleCompleto?.orden?.firma_entrega || h.firma_entrega || "";
  const usuarioEntrego: string = detalleCompleto?.orden?.usuario_entrego || h.usuario_entrego || h.tecnico_nombre || "";
  const fechaEntrega: string  = detalleCompleto?.orden?.fecha_entrega  || h.fecha_entrega  || (fechas as any).entrega || "";

  const diagLive: any = detalleCompleto?.diagnostico || null;
  const hallazgos: string = diagLive?.descripcion || diagLive?.hallazgos || h.fallas_identificadas || "";
  const codigosFalla: string = diagLive?.codigos_falla || h.codigos_falla || "";

  const QC_LBL: Record<string,string> = {
    motor:"Motor",transmision:"Transmisión",frenos:"Frenos",suspension:"Suspensión",
    direccion:"Dirección",electrico:"Eléctrico",ac:"A/C",escape:"Escape",
    neumaticos:"Neumáticos",limpieza:"Limpieza",documentos:"Documentos",fluidos:"Fluidos",
  };

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Expediente — ${h.placa || "Vehículo"} — ${h.numero_orden || ""}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; padding:28px; color:#1a1a1a; max-width:780px; margin:auto; }
  h3 { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1.2px; color:#475569;
       background:#f1f5f9; padding:5px 10px; border-radius:5px; border-left:4px solid #1e40af; margin:18px 0 10px; }
  .card { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:14px; margin-bottom:10px; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th { background:#f8fafc; padding:6px 8px; text-align:left; font-weight:700; color:#475569; }
  td { padding:5px 8px; border-bottom:1px solid #f1f5f9; color:#374151; }
  .row { display:flex; justify-content:space-between; font-size:13px; margin-bottom:5px; }
  .label { color:#64748b; }
  .chip { display:inline-block; padding:2px 9px; border-radius:12px; font-size:11px; font-weight:700;
          margin:2px 3px; background:#fee2e2; color:#991b1b; }
  .total { font-size:18px; font-weight:900; color:#059669; text-align:right; margin-top:8px;
           padding-top:8px; border-top:2px solid #d1fae5; }
  @media print { body { padding:16px; } h3 { page-break-after:avoid; } .card { page-break-inside:avoid; } }
</style>
</head>
<body>

<!-- ══ Encabezado empresa ══ -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111827;padding-bottom:14px;margin-bottom:18px">
  <div>
    <div style="font-size:20px;font-weight:900">🔧 SÓLIDO AUTO SERVICIO</div>
    <div style="font-size:11px;color:#6b7280;margin-top:2px">Tel: 809-712-2027 · Santo Domingo, RD</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:16px;font-weight:900;color:#1e40af">${h.marca || h.vehiculo_marca || ""} ${h.modelo || h.vehiculo_modelo || ""} ${h.ano || h.vehiculo_ano || ""}</div>
    <div style="font-size:13px;font-weight:800;font-family:monospace">${h.placa || ""}</div>
    ${h.numero_orden ? `<div style="font-size:11px;color:#6b7280">Orden #${h.numero_orden}</div>` : ""}
    <div style="font-size:11px;color:#6b7280;margin-top:2px">Estado: <strong>${(h.estado||"ENTREGADO").replace(/_/g," ")}</strong></div>
  </div>
</div>

<div style="text-align:center;font-size:15px;font-weight:800;color:#1e40af;border:2px solid #1e40af;padding:7px;border-radius:8px;margin-bottom:18px;text-transform:uppercase;letter-spacing:1px">
  Expediente de Servicio — ${h.tipo_servicio || "Servicio"}
</div>

<!-- ══ Datos generales ══ -->
<div class="card">
  <div class="row"><span class="label">Fecha de servicio</span><span>${fmtDate(h.fecha_servicio)}</span></div>
  ${h.tecnico_nombre ? `<div class="row"><span class="label">Técnico asignado</span><span>${h.tecnico_nombre}</span></div>` : ""}
  ${h.cliente_nombre ? `<div class="row"><span class="label">Cliente</span><span>${h.cliente_nombre}</span></div>` : ""}
  ${h.cliente_telefono ? `<div class="row"><span class="label">Teléfono</span><span>${h.cliente_telefono}</span></div>` : ""}
  ${h.motivo_entrada ? `<div class="row"><span class="label">Motivo de entrada</span><span>${h.motivo_entrada}</span></div>` : ""}
</div>

<!-- ══ Trabajo solicitado ══ -->
${descripcionTrabajo && descripcionTrabajo !== h.motivo_entrada ? `
<h3>📝 Trabajo Solicitado</h3>
<div class="card">
  <div style="font-size:13px;color:#374151;white-space:pre-wrap;line-height:1.6">${descripcionTrabajo}</div>
</div>` : ""}

<!-- ══ Inspección de recepción ══ -->
${inspec ? `
<h3>🔍 Inspección de Recepción</h3>
<div class="card">
  ${inspec.zonas_danio && inspec.zonas_danio.length > 0 ? `
    <div style="margin-bottom:10px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:5px">Zonas con daño</div>
      <div>${(Array.isArray(inspec.zonas_danio) ? inspec.zonas_danio : []).map((z: string) => `<span class="chip">${z}</span>`).join("")}</div>
    </div>` : ""}
  ${inspec.kilometraje ? `<div class="row"><span class="label">Kilometraje</span><span>${Number(inspec.kilometraje).toLocaleString()} km</span></div>` : ""}
  ${inspec.combustible ? `<div class="row"><span class="label">Combustible</span><span>${inspec.combustible}%</span></div>` : ""}
  ${inspec.observaciones_generales ? `
    <div style="margin-top:8px;font-size:13px;color:#374151;background:#f9fafb;border-radius:6px;padding:8px 10px;white-space:pre-wrap">${inspec.observaciones_generales}</div>` : ""}
</div>` : ""}

<!-- ══ Diagnóstico / Hallazgos ══ -->
${(hallazgos || codigosFalla) ? `
<h3>🔎 Diagnóstico / Hallazgos</h3>
<div class="card" style="background:#fffbeb;border-color:#fde68a">
  ${codigosFalla ? `<div style="font-size:12px;margin-bottom:6px"><strong>Códigos de falla:</strong> ${codigosFalla}</div>` : ""}
  ${hallazgos    ? `<div style="font-size:13px;white-space:pre-wrap;line-height:1.6">${hallazgos}</div>` : ""}
</div>` : ""}

<!-- ══ Mano de obra (trabajos a realizar) ══ -->
${manoDeObraDetalle ? `
<h3>🔧 Trabajos a Realizar (Mano de Obra)</h3>
<div class="card" style="background:#f0fdf4;border-color:#bbf7d0">
  ${manoDeObraDetalle.split("\n").filter((l: string) => l.trim())
    .map((l: string) => `<div style="font-size:13px;margin-bottom:4px">✓ ${l.trim()}</div>`)
    .join("")}
</div>` : ""}

<!-- ══ Trabajos realizados estructurados ══ -->
${trabajosItems.length > 0 ? `
<h3>🛠️ Trabajos Realizados</h3>
<div class="card">
  <table>
    <thead><tr>
      <th>Trabajo</th>
      <th style="text-align:center">Tipo</th>
      <th style="text-align:center">Estado</th>
    </tr></thead>
    <tbody>
      ${trabajosItems.map((t: any) => `
        <tr>
          <td>${t.nombre || t.descripcion || "—"}</td>
          <td style="text-align:center;font-size:11px">${t.tipo || "—"}</td>
          <td style="text-align:center">
            <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;
              background:${t.estado === "REALIZADO" ? "#d1fae5" : t.estado === "PENDIENTE" ? "#fef3c7" : "#f1f5f9"};
              color:${t.estado === "REALIZADO" ? "#065f46" : t.estado === "PENDIENTE" ? "#92400e" : "#475569"}">
              ${t.estado || "—"}
            </span>
          </td>
        </tr>`).join("")}
    </tbody>
  </table>
</div>` : ""}

<!-- ══ Cotización ══ -->
${cotItems.length > 0 || cot.total > 0 ? `
<h3>📄 Cotización${cot.numero ? ` #${cot.numero}` : ""}${cot.aprobado ? " ✓ Aprobada" : ""}</h3>
<div class="card">
  ${cotItems.length > 0 ? `
  <table>
    <thead><tr><th>Descripción</th><th style="text-align:center">Cant.</th><th style="text-align:right">Subtotal</th></tr></thead>
    <tbody>
      ${cotItems.map((it: any) => `<tr><td>${it.descripcion||"—"}</td><td style="text-align:center">${it.cantidad||1}</td><td style="text-align:right">RD$ ${fmtMoney(it.subtotal)}</td></tr>`).join("")}
    </tbody>
  </table><br>` : ""}
  ${cot.mano_obra  > 0 ? `<div class="row"><span class="label">Mano de obra</span><span>RD$ ${fmtMoney(cot.mano_obra)}</span></div>` : ""}
  ${cot.repuestos  > 0 ? `<div class="row"><span class="label">Repuestos</span><span>RD$ ${fmtMoney(cot.repuestos)}</span></div>` : ""}
  ${cot.itbis      > 0 ? `<div class="row"><span class="label">ITBIS</span><span>RD$ ${fmtMoney(cot.itbis)}</span></div>` : ""}
  <div class="row" style="font-weight:700;font-size:14px;border-top:1px solid #e2e8f0;padding-top:6px;margin-top:4px">
    <span>Total Cotizado</span><span style="color:#1e40af">RD$ ${fmtMoney(cot.total)}</span>
  </div>
</div>` : ""}

<!-- ══ Avances de reparación ══ -->
${avances.length > 0 ? `
<h3>📋 Avances de Reparación</h3>
<div class="card">
  ${avances.map((a: any, i: number) => `
    <div style="${i < avances.length-1 ? "margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #f1f5f9" : ""}">
      <div style="font-size:11px;color:#64748b;margin-bottom:3px">${fmtDT(a.created_at)}${a.tecnico_nombre ? ` · ${a.tecnico_nombre}` : ""}</div>
      <div style="font-size:13px;white-space:pre-wrap">${a.descripcion || "—"}</div>
    </div>`).join("")}
</div>` : (h.trabajos_realizados ? `
<h3>📋 Avances de Reparación</h3>
<div class="card"><div style="font-size:13px;white-space:pre-wrap">${h.trabajos_realizados}</div></div>` : "")}

<!-- ══ Control de Calidad ══ -->
${h.resultado_qc ? `
<h3>✅ Control de Calidad</h3>
<div class="card" style="border-color:${h.resultado_qc === "aprobado" ? "#6ee7b7" : "#fca5a5"}">
  <div style="font-size:14px;font-weight:700;color:${h.resultado_qc === "aprobado" ? "#059669" : "#dc2626"};margin-bottom:8px">
    ${h.resultado_qc === "aprobado" ? "✅ Aprobado" : "❌ Rechazado"}
  </div>
  ${h.observaciones_qc ? `<div style="font-size:12px;color:#374151;margin-bottom:10px">${h.observaciones_qc}</div>` : ""}
  ${Object.keys(checklist).length > 0 ? `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
    ${Object.entries(checklist).map(([k,v]) => `
      <div style="font-size:12px;padding:3px 0">${v ? "✅" : "❌"} ${QC_LBL[k] || k.replace(/_/g," ")}</div>`).join("")}
  </div>` : ""}
</div>` : ""}

<!-- ══ Factura ══ -->
${fac.id ? `
<h3>🧾 Factura${fac.ncf ? ` — NCF: ${fac.ncf}` : ""}${fac.metodo_pago ? ` · ${fac.metodo_pago}` : ""}</h3>
<div class="card">
  ${facItems.length > 0 ? `
  <table>
    <thead><tr><th>Descripción</th><th style="text-align:center">Cant.</th><th style="text-align:right">Subtotal</th></tr></thead>
    <tbody>
      ${facItems.map((fi: any) => `<tr><td>${fi.descripcion||"—"}</td><td style="text-align:center">${fi.cantidad||1}</td><td style="text-align:right">RD$ ${fmtMoney(fi.subtotal)}</td></tr>`).join("")}
    </tbody>
  </table><br>` : ""}
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

<!-- ══ Entrega al cliente ══ -->
${(usuarioEntrego || fechaEntrega || firmaEntrega) ? `
<h3>🏁 Entrega al Cliente</h3>
<div class="card">
  ${usuarioEntrego ? `<div class="row"><span class="label">Entregado por</span><span>${usuarioEntrego}</span></div>` : ""}
  ${fechaEntrega   ? `<div class="row"><span class="label">Fecha de entrega</span><span>${fmtDate(fechaEntrega)}</span></div>` : ""}
  ${h.notas_entrega ? `<div style="font-size:12px;color:#374151;margin-top:8px;background:#f9fafb;border-radius:6px;padding:7px 10px">${h.notas_entrega}</div>` : ""}
  ${firmaEntrega ? `
    <div style="margin-top:12px">
      <div style="font-size:11px;color:#64748b;margin-bottom:6px">Firma del cliente:</div>
      <img src="${firmaEntrega}" style="max-width:220px;border:1px solid #e2e8f0;border-radius:6px;display:block" />
    </div>` : ""}
</div>` : ""}

<!-- ══ Línea de tiempo ══ -->
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

<!-- ══ Fechas del proceso ══ -->
${Object.values(fechas).some(Boolean) ? `
<h3>📅 Fechas del Proceso</h3>
<div class="card">
  ${([["recibido","Recibido"],["diagnostico","Diagnóstico"],["esperando_aprobacion","Espera Aprobación"],
     ["aprobacion","Aprobado"],["inicio_reparacion","Inicio Reparación"],["control_calidad","Control Calidad"],
     ["listo","Listo para Entrega"],["entrega","Entregado"]] as [string,string][])
    .filter(([k]) => (fechas as any)[k])
    .map(([k,label]) => `<div class="row"><span class="label">${label}</span><span>${fmtDate((fechas as any)[k])}</span></div>`)
    .join("")}
</div>` : ""}

${h.observaciones ? `
<h3>📝 Observaciones</h3>
<div class="card"><div style="font-size:13px">${h.observaciones}</div></div>` : ""}

<!-- ══ Pie de página ══ -->
<div style="text-align:center;margin-top:28px;padding-top:12px;border-top:1px dashed #cbd5e1;color:#9ca3af;font-size:11px;line-height:2">
  <p>Documento generado el ${new Date().toLocaleDateString("es-DO",{year:"numeric",month:"long",day:"numeric"})}</p>
  <p><strong>SÓLIDO AUTO SERVICIO</strong> — Tel: 809-712-2027 — Santo Domingo, República Dominicana</p>
</div>

</body>
</html>`;

  // Usar iframe para evitar bloqueador de popups
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (doc) { doc.open(); doc.write(html); doc.close(); }
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 2000);
  }, 800);
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
  const [histDetalleCompleto, setHistDetalleCompleto] = useState<any>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

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

  // Abre el detalle del historial y carga datos completos desde el backend
  const abrirDetalleHist = async (h: any) => {
    setHistDetalle(h);
    setHistDetalleCompleto(null);
    setTab("histperm");
    setLoadingDetalle(true);
    try {
      // Las órdenes activas tienen id "orden_XX" — usan el endpoint de orden activa
      const esOrdenActiva = typeof h.id === "string" && h.id.startsWith("orden_");
      const url = esOrdenActiva
        ? `${API}/vehiculo-historial/orden/${h._orden_id}/detalle`
        : `${API}/vehiculo-historial/${h.id}/detalle`;
      const res  = await fetch(url);
      const data = await res.json();
      if (res.ok) setHistDetalleCompleto(data);
    } catch {}
    finally { setLoadingDetalle(false); }
  };

  const cerrarDetalleHist = () => {
    setHistDetalle(null);
    setHistDetalleCompleto(null);
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
                                onClick={() => abrirDetalleHist(h)}
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
                          <button onClick={cerrarDetalleHist} className="btn-volver" style={{ flex:1 }}>
                            ← Volver
                          </button>
                          <button
                            onClick={() => imprimirExpediente(histDetalle, histDetalleCompleto)}
                            style={{ flex:1, background:"#1e40af", color:"#fff", border:"none", borderRadius:8, padding:"10px 0", fontWeight:700, fontSize:13, cursor:"pointer" }}
                          >
                            🖨️ Imprimir
                          </button>
                        </div>
                        {loadingDetalle && (
                          <div style={{ textAlign:"center", padding:"14px 0", fontSize:13, color:"#64748b", marginBottom:10 }}>
                            <span style={{ display:"inline-block", animation:"spin 1s linear infinite", marginRight:8 }}>⏳</span>
                            Cargando expediente completo...
                          </div>
                        )}

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
                          {/* Cliente — disponible inmediatamente sin esperar el fetch async */}
                          {(histDetalle.cliente_nombre || histDetalleCompleto?.cliente?.nombre) && (
                            <div style={{ fontSize:12, color:"#94a3b8", marginTop:4 }}>
                              👤 {histDetalle.cliente_nombre || histDetalleCompleto?.cliente?.nombre}
                              {(histDetalle.cliente_telefono || histDetalleCompleto?.cliente?.telefono) && (
                                <span style={{ marginLeft:6, color:"#60a5fa" }}>
                                  · {histDetalle.cliente_telefono || histDetalleCompleto?.cliente?.telefono}
                                </span>
                              )}
                            </div>
                          )}
                          {histDetalle.motivo_entrada && (
                            <div style={{ fontSize:12, color:"#94a3b8", marginTop:6 }}>📋 {histDetalle.motivo_entrada}</div>
                          )}
                        </div>

                        {/* ── Trabajo Solicitado ── */}
                        {(histDetalle.descripcion || histDetalleCompleto?.orden?.descripcion) && (
                          <div className="card" style={{ marginBottom:10, border:"1px solid rgba(59,130,246,0.15)" }}>
                            <div style={{ fontSize:10, color:"#60a5fa", fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>📝 Trabajo Solicitado</div>
                            <div style={{ fontSize:13, color:"#cbd5e1", lineHeight:1.7, whiteSpace:"pre-wrap" }}>
                              {histDetalle.descripcion || histDetalleCompleto?.orden?.descripcion}
                            </div>
                          </div>
                        )}

                        {/* ── INSPECCIÓN VEHICULAR DE RECEPCIÓN (datos vivos o snapshot) ── */}
                        {(() => {
                          const insp = histDetalleCompleto?.inspeccion
                            || (histDetalle.inspeccion_data && Object.keys(histDetalle.inspeccion_data||{}).length > 0 ? histDetalle.inspeccion_data : null);
                          if (!insp) return null;
                          const insp2 = insp;
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

                        {/* ── SECCIONES VIVAS (usan histDetalleCompleto cuando está disponible) ── */}
                        {(() => {
                          const h    = histDetalle;
                          const d    = histDetalleCompleto;
                          const diag = d?.diagnostico || null;
                          const orden = d?.orden || null;
                          const clienteExtra = d?.cliente || null;
                          const avancesVivos: any[] = d?.avances?.length > 0 ? d.avances : (Array.isArray(h.avances_data) ? h.avances_data : []);
                          const timelineVivo: any[] = d?.estado_historial?.length > 0 ? d.estado_historial : (Array.isArray(h.timeline_data) ? h.timeline_data : []);
                          // trabajos_realizados_items del diagnóstico (puede ser string JSON o array)
                          const _rawTrab = diag?.trabajos_realizados_items || (h.cotizacion_data as any)?.trabajos_realizados_items;
                          const trabajosItemsPWA: any[] = (() => {
                            if (Array.isArray(_rawTrab)) return _rawTrab;
                            if (typeof _rawTrab === "string" && _rawTrab.trim().startsWith("[")) {
                              try { return JSON.parse(_rawTrab); } catch { return []; }
                            }
                            return [];
                          })();
                          // mano_de_obra_detalle del diagnóstico
                          const manoObraDet: string = diag?.mano_de_obra_detalle || (h.cotizacion_data as any)?.mano_de_obra_detalle || "";
                          const fmtF  = (v: any) => v ? new Date(v).toLocaleDateString("es-DO",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"}) : null;
                          const moneda = (v: any) => `RD$ ${Number(v||0).toLocaleString("es-DO",{minimumFractionDigits:2})}`;

                          // Inspecciones técnicas del diagnóstico
                          const insM = diag?.inspeccion_mecanica    || h.inspeccion_mecanica;
                          const insE = diag?.inspeccion_electrica    || h.inspeccion_electrica;
                          const insS = diag?.inspeccion_electronica  || h.inspeccion_electronica;
                          const fallas = diag?.fallas_identificadas  || h.fallas_identificadas;
                          const codigos = diag?.codigos_falla        || h.codigos_falla;
                          const hallazgos = diag?.descripcion        || diag?.hallazgos;
                          const moDetalle = manoObraDet; // usa fallbacks: diag → cotizacion_data snapshot
                          const trabajosCheck = moDetalle.split("\n").map((l: string) => l.trim()).filter(Boolean);

                          return (
                            <>
                              {/* ── DIAGNÓSTICO TÉCNICO ── */}
                              {(insM || insE || insS || fallas || hallazgos || trabajosCheck.length > 0 || h.diagnostico_general) && (
                                <div className="card" style={{ marginBottom:10 }}>
                                  <div className="hist-section-title" style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>🔬 Diagnóstico Técnico</div>

                                  {/* Técnico + fecha */}
                                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                                    <div style={{ background:"rgba(15,23,42,0.5)", borderRadius:7, padding:"8px 10px" }}>
                                      <div style={{ fontSize:10, color:"#64748b", marginBottom:2 }}>TÉCNICO</div>
                                      <div style={{ fontSize:13, fontWeight:700, color:"#e2e8f0" }}>{diag?.tecnico_nombre || diag?.usuario_nombre || h.tecnico_nombre || "—"}</div>
                                      {diag?.tipo_servicio && <div style={{ fontSize:11, color:"#64748b" }}>Tipo: {diag.tipo_servicio}</div>}
                                    </div>
                                    {diag?.created_at && (
                                      <div style={{ background:"rgba(15,23,42,0.5)", borderRadius:7, padding:"8px 10px" }}>
                                        <div style={{ fontSize:10, color:"#64748b", marginBottom:2 }}>REGISTRADO</div>
                                        <div style={{ fontSize:12, color:"#94a3b8" }}>{fmtF(diag.created_at)}</div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Hallazgos */}
                                  {hallazgos && (
                                    <div style={{ marginBottom:10 }}>
                                      <div style={{ fontSize:10, color:"#64748b", fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:4 }}>Hallazgos</div>
                                      <div style={{ fontSize:13, color:"#cbd5e1", background:"rgba(15,23,42,0.4)", borderRadius:7, padding:"8px 10px", lineHeight:1.6, whiteSpace:"pre-wrap" }}>{hallazgos}</div>
                                    </div>
                                  )}

                                  {/* Fallas */}
                                  {(fallas || codigos) && (
                                    <div style={{ background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.18)", borderRadius:8, padding:"8px 10px", marginBottom:10 }}>
                                      <div style={{ fontSize:10, color:"#fca5a5", fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:4 }}>⚠️ Fallas Identificadas</div>
                                      {codigos && <div style={{ fontSize:12, color:"#fecaca", marginBottom:3 }}>Códigos: {codigos}</div>}
                                      {fallas && <div style={{ fontSize:13, color:"#fecaca", lineHeight:1.6 }}>{fallas}</div>}
                                    </div>
                                  )}

                                  {/* Trabajos checkmarks */}
                                  {trabajosCheck.length > 0 && (
                                    <div style={{ marginBottom:10 }}>
                                      <div style={{ fontSize:10, color:"#64748b", fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Trabajos a Realizar</div>
                                      <div style={{ background:"rgba(16,185,129,0.05)", border:"1px solid rgba(16,185,129,0.15)", borderRadius:8, padding:"8px 10px" }}>
                                        {trabajosCheck.map((l: string, i: number) => (
                                          <div key={i} style={{ fontSize:13, color:"#6ee7b7", marginBottom:i < trabajosCheck.length-1 ? 4 : 0 }}>✓ {l}</div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Inspecciones por tipo */}
                                  {(insM || insE || insS) && (
                                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:8 }}>
                                      {insM && <div style={{ background:"rgba(15,23,42,0.5)", borderRadius:7, padding:"8px 10px" }}><div style={{ fontSize:10, color:"#64748b", marginBottom:3 }}>🔧 Mecánica</div><div style={{ fontSize:12, color:"#cbd5e1" }}>{insM}</div></div>}
                                      {insE && <div style={{ background:"rgba(15,23,42,0.5)", borderRadius:7, padding:"8px 10px" }}><div style={{ fontSize:10, color:"#64748b", marginBottom:3 }}>⚡ Eléctrica</div><div style={{ fontSize:12, color:"#cbd5e1" }}>{insE}</div></div>}
                                      {insS && <div style={{ background:"rgba(15,23,42,0.5)", borderRadius:7, padding:"8px 10px" }}><div style={{ fontSize:10, color:"#64748b", marginBottom:3 }}>💻 Scanner</div><div style={{ fontSize:12, color:"#cbd5e1" }}>{insS}</div></div>}
                                    </div>
                                  )}

                                  {/* Costos del diagnóstico */}
                                  <div style={{ marginTop:12, paddingTop:10, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#64748b", marginBottom:4 }}>
                                      <span>Mano de obra</span><span>{moneda(h.costo_mano_obra)}</span>
                                    </div>
                                    {h.costo_repuestos > 0 && (
                                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#64748b", marginBottom:4 }}>
                                        <span>Repuestos</span><span>{moneda(h.costo_repuestos)}</span>
                                      </div>
                                    )}
                                    <div style={{ display:"flex", justifyContent:"space-between", fontWeight:800, fontSize:16, color:"#34d399", paddingTop:6, borderTop:"1px solid rgba(255,255,255,0.06)", marginTop:4 }}>
                                      <span>TOTAL</span><span>{moneda(h.costo_total)}</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* ── TRABAJOS REALIZADOS (items estructurados con tipo/estado) ── */}
                              {trabajosItemsPWA.length > 0 && (
                                <div className="card" style={{ marginBottom:10 }}>
                                  <div style={{ fontSize:10, color:"#64748b", fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>🛠️ Trabajos Realizados</div>
                                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                                    {trabajosItemsPWA.map((t: any, i: number) => {
                                      const ok = t.estado === "REALIZADO";
                                      return (
                                        <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"7px 10px", borderRadius:8, background: ok ? "rgba(52,211,153,0.06)" : "rgba(245,158,11,0.06)", borderLeft:`2px solid ${ok ? "#34d399" : "#f59e0b"}` }}>
                                          <div style={{ flex:1 }}>
                                            <div style={{ fontSize:11, color:"#64748b", fontWeight:600 }}>{t.tipo || "—"}</div>
                                            <div style={{ fontSize:13, color:"#cbd5e1", marginTop:2 }}>{t.descripcion || "—"}</div>
                                          </div>
                                          <span style={{ fontSize:10, fontWeight:700, color: ok ? "#34d399" : "#f59e0b", background: ok ? "rgba(52,211,153,0.12)" : "rgba(245,158,11,0.12)", padding:"2px 8px", borderRadius:20, whiteSpace:"nowrap" }}>
                                            {(t.estado || "").replace(/_/g," ")}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* ── AVANCES DE REPARACIÓN (cronología) ── */}
                              {avancesVivos.length > 0 && (
                                <div className="card" style={{ marginBottom:10 }}>
                                  <div style={{ fontSize:10, color:"#64748b", fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>📋 Avances de Reparación</div>
                                  {avancesVivos.map((a: any, i: number) => (
                                    <div key={i} style={{ paddingBottom:8, marginBottom:8, borderBottom: i < avancesVivos.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                                      <div style={{ fontSize:11, color:"#64748b", marginBottom:3 }}>
                                        {a.tecnico_nombre && <><b style={{ color:"#94a3b8" }}>{a.tecnico_nombre}</b> · </>}
                                        {a.created_at ? fmtF(a.created_at) : ""}
                                      </div>
                                      <div style={{ fontSize:13, color:"#cbd5e1" }}>{a.descripcion}</div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Fallback: si no hay ninguno de los anteriores */}
                              {trabajosItemsPWA.length === 0 && avancesVivos.length === 0 && !manoObraDet && h.trabajos_realizados && (
                                <div className="card" style={{ marginBottom:10 }}>
                                  <div style={{ fontSize:10, color:"#64748b", fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>🛠️ Trabajos Realizados</div>
                                  <div style={{ fontSize:13, color:"#94a3b8", whiteSpace:"pre-wrap" }}>{h.trabajos_realizados}</div>
                                </div>
                              )}

                              {/* ── CONTROL DE CALIDAD ── */}
                              {h.resultado_qc && (
                                <div className="card" style={{ marginBottom:10, border:`1px solid ${h.resultado_qc?.toUpperCase().includes("APROBADO") ? "rgba(52,211,153,0.3)" : "rgba(239,68,68,0.3)"}` }}>
                                  <div className="hist-section-title" style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>✅ Control de Calidad — Resultado: {h.resultado_qc}</div>
                                  {orden?.tecnico_qc && <div style={{ fontSize:13, color:"#94a3b8", marginBottom:8 }}>Técnico QC: <b style={{ color:"#e2e8f0" }}>{orden.tecnico_qc}</b></div>}
                                  {h.observaciones_qc && <div style={{ fontSize:12, color:"#94a3b8", marginBottom:8 }}>{h.observaciones_qc}</div>}
                                  {h.checklist_qc && Object.keys(h.checklist_qc).length > 0 && (
                                    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                                      {(() => {
                                          const QC_LBL: Record<string,string> = {
                                            motor:"Motor OK",frenos:"Frenos OK",fluidos:"Sin fugas",
                                            luces:"Luces OK",electrico:"Eléctrico OK",transmision:"Transmisión",
                                            suspension:"Suspensión",ac:"A/C",limpieza:"Limpieza",
                                            prueba_ruta:"Prueba de ruta",trabajo_ok:"Trabajo al 100%",
                                          };
                                          return Object.entries(h.checklist_qc).map(([k, v]: [string, any]) => (
                                            <span key={k} style={{ fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:600, background: v ? "rgba(52,211,153,0.1)" : "rgba(239,68,68,0.08)", color: v ? "#6ee7b7" : "#fca5a5", border:`1px solid ${v ? "rgba(52,211,153,0.2)" : "rgba(239,68,68,0.15)"}` }}>
                                              {v ? "✅" : "❌"} {QC_LBL[k] || k.replace(/_/g," ")}
                                            </span>
                                          ));
                                        })()}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* ── ENTREGA AL CLIENTE ── */}
                              {h.fechas_proceso?.entrega && (
                                <div className="card" style={{ marginBottom:10, border:"1px solid rgba(148,163,184,0.15)" }}>
                                  <div className="hist-section-title" style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>🏁 Entrega al Cliente</div>
                                  <div style={{ fontSize:13, color:"#94a3b8", marginBottom:6 }}>
                                    Fecha entrega: <b style={{ color:"#e2e8f0" }}>{fmtF(h.fechas_proceso.entrega)}</b>
                                  </div>
                                  {(h.usuario_entrego || orden?.usuario_entrego) && (
                                    <div style={{ fontSize:13, color:"#94a3b8", marginBottom:6 }}>
                                      Entregado por: <b style={{ color:"#e2e8f0" }}>{h.usuario_entrego || orden?.usuario_entrego}</b>
                                    </div>
                                  )}
                                  {(h.notas_entrega || orden?.notas_entrega) && (
                                    <div style={{ fontSize:12, color:"#64748b", background:"rgba(15,23,42,0.4)", borderRadius:7, padding:"8px 10px", marginTop:6 }}>
                                      {h.notas_entrega || orden?.notas_entrega}
                                    </div>
                                  )}
                                  {(h.firma_entrega || orden?.firma_entrega) && (
                                    <div style={{ marginTop:10 }}>
                                      <div style={{ fontSize:10, color:"#64748b", fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Firma del Cliente</div>
                                      <img src={h.firma_entrega || orden?.firma_entrega} alt="Firma" style={{ maxHeight:70, border:"1px solid rgba(148,163,184,0.2)", borderRadius:6, background:"rgba(255,255,255,0.05)", padding:4 }} />
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* ── HISTORIAL DEL PROCESO (timeline) ── */}
                              {timelineVivo.length > 0 && (
                                <div className="card" style={{ marginBottom:10 }}>
                                  <div className="hist-section-title" style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>📜 Historial del Proceso</div>
                                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4, fontSize:11, color:"#475569", fontWeight:700, textTransform:"uppercase", letterSpacing:.7, marginBottom:8, paddingBottom:6, borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                                    <span>Estado</span><span>Fecha y Usuario</span>
                                  </div>
                                  {timelineVivo.map((t: any, i: number) => {
                                    const estadoLabel = (t.estado_nuevo || t.estado || "").replace(/_/g," ");
                                    const motivo = t.motivo || "";
                                    return (
                                      <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10, alignItems:"start" }}>
                                        <div>
                                          <div style={{ fontSize:12, fontWeight:700, color:"#e2e8f0" }}>{estadoLabel}</div>
                                          {motivo && <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>— {motivo}</div>}
                                        </div>
                                        <div style={{ fontSize:11, color:"#64748b" }}>
                                          {t.created_at ? fmtF(t.created_at) : ""}
                                          {t.usuario_nombre && <> · <b style={{ color:"#94a3b8" }}>{t.usuario_nombre}</b></>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          );
                        })()}

                        {/* ── BOTÓN IMPRIMIR ── */}
                        <button
                          onClick={() => imprimirExpediente(histDetalle, histDetalleCompleto)}
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
                              const avancesResumen: any[] = Array.isArray(h.avances_data) ? h.avances_data : [];
                              return (
                                <div
                                  key={h.id}
                                  className={`hist-item ${abierto ? "open" : ""}`}
                                  onClick={() => abrirDetalleHist(h)}
                                >
                                  {/* Cabecera: tipo de servicio + estado */}
                                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
                                    <div className="hist-servicio" style={{ flex:1 }}>{h.tipo_servicio || "Servicio"}</div>
                                    {h.estado && (
                                      <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, marginLeft:8, whiteSpace:"nowrap",
                                        background: h._activa ? "rgba(59,130,246,0.15)" : "rgba(52,211,153,0.12)",
                                        color:      h._activa ? "#60a5fa"              : "#34d399" }}>
                                        {h.estado.replace(/_/g," ")}
                                      </span>
                                    )}
                                  </div>

                                  {/* Fecha + técnico + badge */}
                                  <div className="hist-meta">
                                    {h.fecha_servicio ? new Date(h.fecha_servicio).toLocaleDateString("es-DO",{year:"numeric",month:"short",day:"numeric"}) : "—"}
                                    {h.tecnico_nombre && ` · 👨‍🔧 ${h.tecnico_nombre}`}
                                    {h.numero_orden && <span style={{ marginLeft:6, color:"#475569" }}>#{h.numero_orden}</span>}
                                    {idx === 0 && <span className="hist-badge">Más reciente</span>}
                                  </div>

                                  {/* Fallas identificadas (resumen) */}
                                  {h.fallas_identificadas && (
                                    <div style={{ fontSize:12, color:"#fbbf24", background:"rgba(251,191,36,0.06)", borderRadius:7, padding:"5px 8px", marginTop:6, lineHeight:1.5 }}>
                                      ⚠️ {String(h.fallas_identificadas).substring(0, 120)}{String(h.fallas_identificadas).length > 120 ? "…" : ""}
                                    </div>
                                  )}

                                  {/* Trabajos realizados (resumen) */}
                                  {h.trabajos_realizados && !h.fallas_identificadas && (
                                    <div style={{ fontSize:12, color:"#94a3b8", marginTop:6, lineHeight:1.5 }}>
                                      🔧 {String(h.trabajos_realizados).substring(0, 120)}{String(h.trabajos_realizados).length > 120 ? "…" : ""}
                                    </div>
                                  )}

                                  {/* Avances recientes (máx 2) */}
                                  {avancesResumen.slice(0, 2).map((a: any, ai: number) => (
                                    <div key={ai} style={{ fontSize:11, color:"#64748b", marginTop:4, paddingLeft:8, borderLeft:"2px solid rgba(99,102,241,0.3)" }}>
                                      {a.descripcion?.substring(0, 80)}{(a.descripcion?.length ?? 0) > 80 ? "…" : ""}
                                    </div>
                                  ))}

                                  {/* Costo + Ver detalle */}
                                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8 }}>
                                    {h.costo_total > 0
                                      ? <span className="hist-cost">RD$ {Number(h.costo_total).toLocaleString("es-DO",{minimumFractionDigits:2})}</span>
                                      : <span />}
                                    <span style=