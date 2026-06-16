"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Curso {
  id: number; nombre: string; instructor: string; precio: number;
  modalidad: string; estado: string; horas: number;
}
interface Alumno {
  id: number; curso_id: number; nombre: string; telefono: string; email: string;
  estado: string; fecha_inscripcion: string; monto_pagado: number; notas: string;
}
interface Pago {
  id: number; alumno_id: number; monto: number; fecha: string; metodo: string;
  referencia: string; notas: string; created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) { return "RD$ " + Number(n).toLocaleString("es-DO", { minimumFractionDigits: 0 }); }
function hoyISO() { return new Date().toISOString().split("T")[0]; }

// Impresion via iframe oculto (NO usa window.open, asi no lo bloquea el navegador como popup).
function imprimirHTML(html: string) {
  const prev = document.getElementById("__cap_print_iframe__");
  if (prev) prev.remove();
  const iframe = document.createElement("iframe");
  iframe.id = "__cap_print_iframe__";
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:820px;height:1000px;border:none;opacity:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
    return;
  }
  doc.open(); doc.write(html); doc.close();
  iframe.onload = () => {
    try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }
    catch { const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); } }
  };
}

// ─── Colores ──────────────────────────────────────────────────────────────────
const METODOS = ["Efectivo", "Transferencia", "Tarjeta de débito", "Tarjeta de crédito", "Cheque", "Otro"];

const S = {
  page:  { padding:"28px 32px", background:"#f5f7fb", minHeight:"100vh" },
  card:  { background:"#fff", borderRadius:12, border:"1px solid #e5e7eb", padding:"20px 24px", marginBottom:16 },
  btn:   { padding:"8px 16px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:600 as const, fontSize:13 },
  btnBlue: { background:"#1d4ed8", color:"#fff" },
  btnGray: { background:"#f3f4f6", color:"#374151", border:"1px solid #d1d5db" },
  btnRed:  { background:"#fef2f2", color:"#b91c1c", border:"1px solid #fecaca" },
  btnGreen: { background:"#dcfce7", color:"#15803d", border:"1px solid #bbf7d0" },
  input:   { width:"100%", padding:"8px 12px", borderRadius:8, border:"1px solid #d1d5db", fontSize:14, outline:"none", background:"#fff", color:"#111827" },
  label:   { fontSize:13, fontWeight:600 as const, color:"#374151", marginBottom:4, display:"block" as const },
  tag:     { display:"inline-block", padding:"2px 10px", borderRadius:50, fontSize:11, fontWeight:700 as const },
  errBox:  { background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#b91c1c" },
  grid:    { display:"grid" as const, gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:24 },
  metricBox: { background:"#fff", borderRadius:10, border:"1px solid #e5e7eb", padding:"14px 16px", textAlign:"center" as const },
};

// ─────────────────────────────────────────────────────────────────────────────
export default function CapacitacionesFacturacionPage() {
  const [cursos,  setCursos]  = useState<Curso[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [pagos,   setPagos]   = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Filtros
  const [filtroCurso,  setFiltroCurso]  = useState<number | "todos">("todos");
  const [filtroEstado, setFiltroEstado] = useState<"todos"|"completo"|"pendiente"|"desertado">("todos");
  const [busqueda,     setBusqueda]     = useState("");

  // Modal pago
  const [modalPago,  setModalPago]  = useState(false);
  const [alumnoSel,  setAlumnoSel]  = useState<Alumno | null>(null);
  const [cursoPago,  setCursoPago]  = useState<Curso | null>(null);
  const [formPago,   setFormPago]   = useState({ monto:0, fecha:hoyISO(), metodo:"Efectivo", referencia:"", notas:"" });
  const [guardando,  setGuardando]  = useState(false);
  const [errPago,    setErrPago]    = useState<string | null>(null);

  // Modal recibo
  const [reciboDatos, setReciboDatos] = useState<{ pago:Pago; alumno:Alumno; curso:Curso } | null>(null);

  // ── Cargar ──────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    const [{ data: c, error: ec }, { data: a, error: ea }, { data: p }] = await Promise.all([
      supabase.from("capacitaciones_cursos").select("*").order("nombre"),
      supabase.from("capacitaciones_alumnos").select("*").order("nombre"),
      supabase.from("capacitaciones_pagos").select("*").order("fecha", { ascending: false }),
    ]);
    if (ec) {
      setError("No se pudo cargar la data. " + ec.message +
        (ec.code === "42P01" ? "\n\n👉 Ejecuta primero sql/capacitaciones.sql en Supabase." : ""));
    }
    setCursos(c ?? []); setAlumnos(a ?? []); setPagos(p ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Derivados ───────────────────────────────────────────────────────────────
  const getCurso = (id: number) => cursos.find(c => c.id === id);

  const alumnoConEstado = (a: Alumno) => {
    const curso = getCurso(a.curso_id);
    if (!curso) return "sin_curso";
    if (a.estado === "desertado") return "desertado";
    const pendiente = Number(curso.precio) - Number(a.monto_pagado);
    return pendiente <= 0 ? "completo" : "pendiente";
  };

  const pendiente = (a: Alumno) => {
    const curso = getCurso(a.curso_id);
    if (!curso) return 0;
    return Math.max(0, Number(curso.precio) - Number(a.monto_pagado));
  };

  // Métricas globales
  const totalCobrado   = alumnos.reduce((s, a) => s + Number(a.monto_pagado), 0);
  const totalPendiente = alumnos.filter(a => a.estado !== "desertado").reduce((s, a) => s + pendiente(a), 0);
  const completos      = alumnos.filter(a => alumnoConEstado(a) === "completo").length;
  const pendientes     = alumnos.filter(a => alumnoConEstado(a) === "pendiente").length;

  // Alumnos filtrados
  const alumnosFiltrados = alumnos.filter(a => {
    if (filtroCurso !== "todos" && a.curso_id !== filtroCurso) return false;
    const est = alumnoConEstado(a);
    if (filtroEstado !== "todos" && est !== filtroEstado) return false;
    if (busqueda && !a.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  // Pagos de un alumno
  const pagosDe = (alumnoId: number) => pagos.filter(p => p.alumno_id === alumnoId);

  // ── Registrar pago ──────────────────────────────────────────────────────────
  const abrirPago = (a: Alumno) => {
    const curso = getCurso(a.curso_id);
    setAlumnoSel(a); setCursoPago(curso ?? null);
    setFormPago({ monto: Math.max(0, pendiente(a)), fecha:hoyISO(), metodo:"Efectivo", referencia:"", notas:"" });
    setErrPago(null); setModalPago(true);
  };

  const registrarPago = async () => {
    if (!alumnoSel) return;
    if (formPago.monto <= 0) { setErrPago("El monto debe ser mayor a cero."); return; }
    setGuardando(true); setErrPago(null);

    // 1. Insertar en tabla de pagos
    const { error: ep } = await supabase.from("capacitaciones_pagos").insert({
      alumno_id:  alumnoSel.id,
      monto:      Number(formPago.monto),
      fecha:      formPago.fecha,
      metodo:     formPago.metodo,
      referencia: formPago.referencia,
      notas:      formPago.notas,
    });

    if (ep && ep.code !== "42P01") {
      // Si la tabla de pagos no existe, de igual forma actualizar monto_pagado
      if (ep.code !== "42P01") {
        setErrPago("Error registrando pago: " + ep.message);
        setGuardando(false); return;
      }
    }

    // 2. Actualizar monto_pagado en el alumno
    const nuevoMonto = Number(alumnoSel.monto_pagado) + Number(formPago.monto);
    const { error: ea } = await supabase.from("capacitaciones_alumnos")
      .update({ monto_pagado: nuevoMonto })
      .eq("id", alumnoSel.id);

    if (ea) { setErrPago("Error actualizando alumno: " + ea.message); setGuardando(false); return; }

    setGuardando(false); setModalPago(false); await cargar();
  };

  // ── Factura completa (solo cuando pago completo) ────────────────────────────
  const imprimirFactura = (alumno: Alumno, curso: Curso) => {
    const ps = pagosDe(alumno.id);
    const totalPagado = ps.reduce((s, p) => s + Number(p.monto), 0);
    const saldoPend = Math.max(0, Number(curso.precio) - totalPagado);
    const estadoPago = saldoPend <= 0 ? "PAGADO" : (totalPagado > 0 ? "PARCIAL" : "PENDIENTE");
    const estadoBadge = saldoPend <= 0
      ? `<span class="badge" style="background:#dcfce7;color:#15803d">Pagado ✓</span>`
      : (totalPagado > 0
        ? `<span class="badge" style="background:#dbeafe;color:#1d4ed8">Pago parcial</span>`
        : `<span class="badge" style="background:#fef9c3;color:#854d0e">Pendiente</span>`);
    const html = `<!DOCTYPE html><html><head><title>Factura Capacitación</title>
    <style>
      body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:680px;margin:0 auto;}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:3px solid #1d4ed8;padding-bottom:16px;}
      .logo{font-size:22px;font-weight:900;color:#1d4ed8;letter-spacing:2px;}
      .sub{font-size:11px;color:#6b7280;margin-top:2px;}
      .titulo{font-size:18px;font-weight:700;color:#1d4ed8;margin-bottom:4px;}
      .num{font-size:12px;color:#9ca3af;}
      .seccion{margin-bottom:18px;}
      .seccion h3{font-size:13px;text-transform:uppercase;color:#9ca3af;letter-spacing:1px;margin:0 0 8px;}
      table{width:100%;border-collapse:collapse;margin-bottom:16px;}
      th{padding:8px 10px;background:#f9fafb;font-size:12px;color:#6b7280;text-align:left;border-bottom:2px solid #e5e7eb;}
      td{padding:8px 10px;font-size:13px;border-bottom:1px solid #f3f4f6;}
      .total-row td{font-weight:700;font-size:15px;color:#111;background:#f0fdf4;border-top:2px solid #22c55e;}
      .badge{display:inline-block;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;background:#dcfce7;color:#15803d;}
      .firma{margin-top:48px;display:flex;justify-content:space-between;}
      .firma div{text-align:center;width:180px;}
      .firma hr{margin-bottom:6px;border-color:#ccc;}
      @media print{body{padding:20px;} button{display:none;}}
    </style></head><body>
    <div class="header">
      <div>
        <div class="logo">SÓLIDO AUTO SERVICIO</div>
        <div class="sub">Servicio Automotriz &amp; Café · Santo Domingo, RD</div>
      </div>
      <div style="text-align:right">
        <div class="titulo">FACTURA DE CAPACITACIÓN</div>
        <div class="num">FAC-CAP-${String(alumno.id).padStart(6,"0")}</div>
        <div class="num">Fecha: ${new Date().toLocaleDateString("es-DO")}</div>
      </div>
    </div>

    <div class="seccion">
      <h3>Datos del alumno</h3>
      <table>
        <tr><td style="color:#6b7280;width:35%">Nombre</td><td><strong>${alumno.nombre}</strong></td></tr>
        ${alumno.telefono ? `<tr><td style="color:#6b7280">Teléfono</td><td>${alumno.telefono}</td></tr>` : ""}
        ${alumno.email ? `<tr><td style="color:#6b7280">Email</td><td>${alumno.email}</td></tr>` : ""}
        <tr><td style="color:#6b7280">Inscripción</td><td>${alumno.fecha_inscripcion}</td></tr>
        <tr><td style="color:#6b7280">Estado de pago</td><td>${estadoBadge}</td></tr>
      </table>
    </div>

    <div class="seccion">
      <h3>Detalle del curso</h3>
      <table>
        <tr><td style="color:#6b7280;width:35%">Curso</td><td><strong>${curso.nombre}</strong></td></tr>
        <tr><td style="color:#6b7280">Instructor</td><td>${curso.instructor || "—"}</td></tr>
        <tr><td style="color:#6b7280">Modalidad</td><td>${curso.modalidad}</td></tr>
        <tr><td style="color:#6b7280">Duración</td><td>${curso.horas} horas</td></tr>
        <tr><td style="color:#6b7280">Precio del curso</td><td><strong>RD$ ${Number(curso.precio).toLocaleString("es-DO")}</strong></td></tr>
      </table>
    </div>

    <div class="seccion">
      <h3>Historial de pagos</h3>
      <table>
        <thead><tr><th>Fecha</th><th>Método</th><th>Referencia</th><th style="text-align:right">Monto</th></tr></thead>
        <tbody>
          ${ps.map(p => `<tr>
            <td>${p.fecha}</td>
            <td>${p.metodo}</td>
            <td style="color:#6b7280">${p.referencia || "—"}</td>
            <td style="text-align:right;color:#15803d;font-weight:600">RD$ ${Number(p.monto).toLocaleString("es-DO")}</td>
          </tr>`).join("")}
          <tr class="total-row">
            <td colspan="3">TOTAL PAGADO</td>
            <td style="text-align:right">RD$ ${totalPagado.toLocaleString("es-DO")}</td>
          </tr>
          <tr><td colspan="3" style="font-weight:700;color:${saldoPend > 0 ? "#b45309" : "#15803d"}">SALDO PENDIENTE</td>
            <td style="text-align:right;font-weight:700;color:${saldoPend > 0 ? "#b45309" : "#15803d"}">RD$ ${saldoPend.toLocaleString("es-DO")}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="firma">
      <div><hr>Sello / Firma empresa</div>
      <div><hr>Firma del alumno</div>
    </div>
    <div style="margin-top:24px;font-size:10px;color:#9ca3af;text-align:center">Emitido: ${new Date().toLocaleString("es-DO")} · Estado: ${estadoPago} · SÓLIDO AUTO SERVICIO</div>
    </body></html>`;
    imprimirHTML(html);
  };

  // ── Recibo ──────────────────────────────────────────────────────────────────
  const imprimirRecibo = (pago: Pago, alumno: Alumno, curso: Curso) => {
    const html = `<!DOCTYPE html><html><head><title>Recibo</title>
    <style>
      body{font-family:Arial,sans-serif;padding:40px;color:#111;}
      .logo{font-size:22px;font-weight:900;color:#1d4ed8;letter-spacing:2px;}
      .sub{font-size:12px;color:#6b7280;margin-bottom:24px;}
      .titulo{font-size:18px;font-weight:700;border-bottom:2px solid #1d4ed8;padding-bottom:8px;margin-bottom:16px;}
      table{width:100%;border-collapse:collapse;margin-bottom:20px;}
      td{padding:8px 4px;font-size:14px;border-bottom:1px solid #f3f4f6;}
      td:first-child{color:#6b7280;width:40%;}
      td:last-child{font-weight:600;}
      .total{font-size:20px;font-weight:700;color:#15803d;text-align:right;}
      .num{font-size:11px;color:#9ca3af;text-align:right;}
      .firma{margin-top:48px;display:flex;justify-content:space-between;}
      .firma div{text-align:center;width:160px;}
      .firma hr{margin-bottom:6px;}
      @media print{body{padding:20px;} button{display:none;}}
    </style></head><body>
    <div class="logo">SÓLIDO AUTO SERVICIO</div>
    <div class="sub">Servicio Automotriz &amp; Café · Santo Domingo, RD</div>
    <div class="titulo">Recibo de Pago — Capacitaciones</div>
    <table>
      <tr><td>N° Recibo</td><td>REC-${String(pago.id ?? alumno.id).padStart(6,"0")}</td></tr>
      <tr><td>Fecha</td><td>${pago.fecha}</td></tr>
      <tr><td>Alumno</td><td>${alumno.nombre}</td></tr>
      ${alumno.telefono ? `<tr><td>Teléfono</td><td>${alumno.telefono}</td></tr>` : ""}
      ${alumno.email ? `<tr><td>Email</td><td>${alumno.email}</td></tr>` : ""}
      <tr><td>Curso</td><td>${curso.nombre}</td></tr>
      <tr><td>Precio del curso</td><td>RD$ ${Number(curso.precio).toLocaleString("es-DO")}</td></tr>
      <tr><td>Método de pago</td><td>${pago.metodo}</td></tr>
      ${pago.referencia ? `<tr><td>Referencia</td><td>${pago.referencia}</td></tr>` : ""}
    </table>
    <div class="total">Monto recibido: RD$ ${Number(pago.monto).toLocaleString("es-DO")}</div>
    <div class="num">Emitido: ${new Date().toLocaleString("es-DO")}</div>
    <div class="firma">
      <div><hr>Sello / Firma empresa</div>
      <div><hr>Firma del alumno</div>
    </div>
    </body></html>`;
    imprimirHTML(html);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  if (loading) return <div style={{ ...S.page, textAlign:"center", paddingTop:80, color:"#6b7280" }}>Cargando facturación…</div>;

  const estadoColor: Record<string,{bg:string;color:string;label:string}> = {
    completo:  { bg:"#dcfce7", color:"#15803d", label:"Pagado ✓" },
    pendiente: { bg:"#fff7ed", color:"#b45309", label:"Pendiente" },
    desertado: { bg:"#fee2e2", color:"#b91c1c", label:"Desertado" },
    sin_curso: { bg:"#f3f4f6", color:"#6b7280", label:"Sin curso" },
  };

  return (
    <div style={S.page}>

      {/* ── ENCABEZADO ──────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <Link href="/capacitaciones" style={{ fontSize:13, color:"#1d4ed8", textDecoration:"none" }}>← Capacitaciones</Link>
          </div>
          <h1 style={{ fontSize:22, fontWeight:700, color:"#111827", margin:"6px 0 4px" }}>🧾 Facturación de Capacitaciones</h1>
          <p style={{ fontSize:13, color:"#6b7280", margin:0 }}>Control de pagos, deudas y recibos por alumno</p>
        </div>
      </div>

      {error && <div style={{ ...S.errBox, marginBottom:20, whiteSpace:"pre-wrap" }}>{error}</div>}

      {/* ── MÉTRICAS ────────────────────────────────────────────────────────── */}
      <div style={S.grid}>
        {[
          { label:"Total cobrado",   val:fmt(totalCobrado),   color:"#15803d" },
          { label:"Por cobrar",      val:fmt(totalPendiente), color: totalPendiente > 0 ? "#b45309" : "#15803d" },
          { label:"Pagos completos", val:completos,           color:"#15803d" },
          { label:"Con saldo pend.", val:pendientes,          color: pendientes > 0 ? "#b91c1c" : "#15803d" },
          { label:"Total alumnos",   val:alumnos.length,      color:"#111827" },
        ].map(m => (
          <div key={m.label} style={S.metricBox}>
            <div style={{ fontSize:11, color:"#9ca3af", marginBottom:4 }}>{m.label}</div>
            <div style={{ fontSize:typeof m.val==="string"?16:24, fontWeight:700, color:m.color }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* ── RESUMEN POR CURSO ───────────────────────────────────────────────── */}
      <div style={S.card}>
        <div style={{ fontWeight:700, marginBottom:12, color:"#111827", fontSize:15 }}>📊 Ingresos por curso</div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f9fafb", textAlign:"left" }}>
                {["Curso","Alumnos","Cobrado","Por cobrar","Avance"].map(h => (
                  <th key={h} style={{ padding:"8px 10px", fontWeight:600, color:"#6b7280", borderBottom:"1px solid #e5e7eb" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cursos.map(c => {
                const als    = alumnos.filter(a => a.curso_id === c.id && a.estado !== "desertado");
                const cobrad = als.reduce((s,a) => s + Number(a.monto_pagado), 0);
                const pend   = als.reduce((s,a) => s + Math.max(0, Number(c.precio) - Number(a.monto_pagado)), 0);
                const maxPos = als.length * Number(c.precio);
                const avance = maxPos === 0 ? 0 : Math.round(cobrad / maxPos * 100);
                return (
                  <tr key={c.id}
                    onClick={() => setFiltroCurso(filtroCurso===c.id?"todos":c.id)}
                    style={{ borderBottom:"1px solid #f3f4f6", cursor:"pointer", background: filtroCurso===c.id?"#eff6ff":"transparent" }}>
                    <td style={{ padding:"9px 10px", fontWeight:600, color:"#111827" }}>{c.nombre}</td>
                    <td style={{ padding:"9px 10px", color:"#374151" }}>{als.length}</td>
                    <td style={{ padding:"9px 10px", color:"#15803d", fontWeight:600 }}>{fmt(cobrad)}</td>
                    <td style={{ padding:"9px 10px", color: pend>0?"#b45309":"#9ca3af" }}>{fmt(pend)}</td>
                    <td style={{ padding:"9px 10px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ flex:1, height:6, background:"#e5e7eb", borderRadius:50, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${avance}%`, background: avance===100?"#22c55e":"#1d4ed8", borderRadius:50 }} />
                        </div>
                        <span style={{ fontSize:11, color:"#6b7280", minWidth:32 }}>{avance}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── FILTROS + TABLA ALUMNOS ─────────────────────────────────────────── */}
      <div style={S.card}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:14, alignItems:"center" }}>
          <input placeholder="🔍 Buscar alumno…" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ ...S.input, width:220 }} />
          <select value={filtroCurso} onChange={e => setFiltroCurso(e.target.value==="todos"?"todos":Number(e.target.value))}
            style={{ ...S.input, width:200 }}>
            <option value="todos">Todos los cursos</option>
            {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          {(["todos","completo","pendiente","desertado"] as const).map(f => (
            <button key={f} onClick={() => setFiltroEstado(f)}
              style={{ ...S.btn, ...(filtroEstado===f ? S.btnBlue : S.btnGray), padding:"6px 12px" }}>
              {f==="todos"?"Todos":estadoColor[f].label}
            </button>
          ))}
          <span style={{ marginLeft:"auto", fontSize:13, color:"#6b7280" }}>{alumnosFiltrados.length} alumnos</span>
        </div>

        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f9fafb", textAlign:"left" }}>
                {["Alumno","Curso","Inscripción","Precio","Pagado","Pendiente","Estado","Acciones"].map(h => (
                  <th key={h} style={{ padding:"8px 10px", fontWeight:600, color:"#6b7280", borderBottom:"1px solid #e5e7eb", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alumnosFiltrados.length === 0 ? (
                <tr><td colSpan={8} style={{ padding:"24px", textAlign:"center", color:"#9ca3af" }}>Sin alumnos que coincidan con el filtro.</td></tr>
              ) : alumnosFiltrados.map(a => {
                const curso = getCurso(a.curso_id);
                const est   = alumnoConEstado(a);
                const { bg, color, label } = estadoColor[est] ?? estadoColor.sin_curso;
                const pend  = pendiente(a);
                return (
                  <tr key={a.id} style={{ borderBottom:"1px solid #f3f4f6" }}>
                    <td style={{ padding:"9px 10px" }}>
                      <div style={{ fontWeight:600, color:"#111827" }}>{a.nombre}</div>
                      {a.telefono && <div style={{ fontSize:11, color:"#9ca3af" }}>{a.telefono}</div>}
                    </td>
                    <td style={{ padding:"9px 10px", color:"#374151", maxWidth:160 }}>
                      {curso?.nombre ?? "—"}
                    </td>
                    <td style={{ padding:"9px 10px", color:"#6b7280", whiteSpace:"nowrap" }}>{a.fecha_inscripcion}</td>
                    <td style={{ padding:"9px 10px", whiteSpace:"nowrap" }}>{fmt(curso?.precio ?? 0)}</td>
                    <td style={{ padding:"9px 10px", color:"#15803d", fontWeight:600, whiteSpace:"nowrap" }}>{fmt(a.monto_pagado)}</td>
                    <td style={{ padding:"9px 10px", color: pend>0?"#b91c1c":"#15803d", fontWeight:600, whiteSpace:"nowrap" }}>
                      {pend > 0 ? fmt(pend) : "—"}
                    </td>
                    <td style={{ padding:"9px 10px" }}>
                      <span style={{ ...S.tag, background:bg, color }}>{label}</span>
                    </td>
                    <td style={{ padding:"9px 10px" }}>
                      <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                        {a.estado !== "desertado" && pend > 0 && (
                          <button style={{ ...S.btn, ...S.btnBlue, padding:"4px 10px", fontSize:12 }}
                            onClick={() => abrirPago(a)}>
                            + Pago
                          </button>
                        )}
                        {pagosDe(a.id).length > 0 && curso && (
                          <button style={{ ...S.btn, ...S.btnGreen, padding:"4px 10px", fontSize:12 }}
                            onClick={() => imprimirRecibo(pagosDe(a.id)[0], a, curso)}>
                            🖨️ Recibo
                          </button>
                        )}
                        {curso && (
                          <button
                            style={{ ...S.btn, padding:"4px 10px", fontSize:12, background:"linear-gradient(135deg,#b45309,#d97706)", color:"#fff", border:"none" }}
                            onClick={() => imprimirFactura(a, curso)}
                            title="Imprimir factura (disponible en cualquier estado de pago)">
                            🧾 Factura
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── HISTORIAL DE PAGOS ──────────────────────────────────────────────── */}
      {pagos.length > 0 && (
        <div style={S.card}>
          <div style={{ fontWeight:700, marginBottom:12, color:"#111827", fontSize:15 }}>📋 Últimos pagos registrados</div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"#f9fafb", textAlign:"left" }}>
                  {["Fecha","Alumno","Curso","Monto","Método","Ref.","Acciones"].map(h => (
                    <th key={h} style={{ padding:"7px 10px", fontWeight:600, color:"#6b7280", borderBottom:"1px solid #e5e7eb" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagos.slice(0,50).map(p => {
                  const al = alumnos.find(a => a.id === p.alumno_id);
                  const cu = al ? getCurso(al.curso_id) : undefined;
                  return (
                    <tr key={p.id} style={{ borderBottom:"1px solid #f3f4f6" }}>
                      <td style={{ padding:"8px 10px", whiteSpace:"nowrap" }}>{p.fecha}</td>
                      <td style={{ padding:"8px 10px", fontWeight:600 }}>{al?.nombre ?? "—"}</td>
                      <td style={{ padding:"8px 10px", color:"#6b7280" }}>{cu?.nombre ?? "—"}</td>
                      <td style={{ padding:"8px 10px", color:"#15803d", fontWeight:600 }}>{fmt(p.monto)}</td>
                      <td style={{ padding:"8px 10px" }}>{p.metodo}</td>
                      <td style={{ padding:"8px 10px", color:"#6b7280" }}>{p.referencia || "—"}</td>
                      <td style={{ padding:"8px 10px" }}>
                        {al && cu && (
                          <button style={{ ...S.btn, ...S.btnGray, padding:"3px 9px", fontSize:11 }}
                            onClick={() => imprimirRecibo(p, al, cu)}>
                            🖨️ Recibo
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL REGISTRAR PAGO ────────────────────────────────────────────── */}
      {modalPago && alumnoSel && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={() => setModalPago(false)}>
          <div style={{ background:"#fff", borderRadius:14, width:"min(460px,95%)", padding:26 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:"#111827" }}>💵 Registrar Pago</h2>
              <button style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#6b7280" }} onClick={() => setModalPago(false)}>✕</button>
            </div>

            {/* Info del alumno */}
            <div style={{ background:"#f9fafb", borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:13 }}>
              <div style={{ fontWeight:700, color:"#111827", marginBottom:2 }}>{alumnoSel.nombre}</div>
              <div style={{ color:"#6b7280" }}>Curso: {cursoPago?.nombre ?? "—"}</div>
              <div style={{ display:"flex", gap:16, marginTop:6 }}>
                <span>💰 Precio: <strong>{fmt(cursoPago?.precio ?? 0)}</strong></span>
                <span>✅ Pagado: <strong style={{ color:"#15803d" }}>{fmt(alumnoSel.monto_pagado)}</strong></span>
                <span>⏳ Pendiente: <strong style={{ color:"#b91c1c" }}>{fmt(pendiente(alumnoSel))}</strong></span>
              </div>
            </div>

            {errPago && <div style={{ ...S.errBox, marginBottom:14 }}>{errPago}</div>}

            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <label style={S.label}>Monto a pagar (RD$) *</label>
                  <input style={S.input} type="number" min={1} value={formPago.monto}
                    onChange={e => setFormPago({ ...formPago, monto:Number(e.target.value) })} />
                </div>
                <div>
                  <label style={S.label}>Fecha del pago</label>
                  <input style={S.input} type="date" value={formPago.fecha}
                    onChange={e => setFormPago({ ...formPago, fecha:e.target.value })} />
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <label style={S.label}>Método de pago</label>
                  <select style={S.input} value={formPago.metodo}
                    onChange={e => setFormPago({ ...formPago, metodo:e.target.value })}>
                    {METODOS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Referencia / N° transacción</label>
                  <input style={S.input} value={formPago.referencia} placeholder="Opcional"
                    onChange={e => setFormPago({ ...formPago, referencia:e.target.value })} />
                </div>
              </div>
              <div>
                <label style={S.label}>Notas</label>
                <input style={S.input} value={formPago.notas} placeholder="Opcional"
                  onChange={e => setFormPago({ ...formPago, notas:e.target.value })} />
              </div>
            </div>

            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:18 }}>
              <button style={{ ...S.btn, ...S.btnGray }} onClick={() => setModalPago(false)}>Cancelar</button>
              <button style={{ ...S.btn, ...S.btnBlue, opacity:guardando?0.7:1 }} onClick={registrarPago} disabled={guardando}>
                {guardando ? "Guardando…" : "💾 Registrar pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
