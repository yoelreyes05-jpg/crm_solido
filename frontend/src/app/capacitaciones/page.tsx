"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { usePermisos } from "@/lib/usePermisos";
import Link from "next/link";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Curso {
  id: number; nombre: string; instructor: string; horas: number; precio: number;
  modalidad: string; estado: string; descripcion: string; fecha_proxima: string; fecha_fin: string; created_at: string;
}
interface Alumno {
  id: number; curso_id: number; nombre: string; telefono: string; email: string;
  estado: string; fecha_inscripcion: string; monto_pagado: number; notas: string;
}
interface CertData { alumno: Alumno; curso: Curso; }

// ─── Constantes ───────────────────────────────────────────────────────────────
const MODALIDADES = ["Presencial", "Online", "Semipresencial"];
const ESTADOS_ALUMNO = [
  { value: "inscrito",   label: "Inscrito",   color: "#1d4ed8", bg: "#dbeafe" },
  { value: "completado", label: "Completado", color: "#15803d", bg: "#dcfce7" },
  { value: "desertado",  label: "Desertado",  color: "#b91c1c", bg: "#fee2e2" },
];
const CURSO_BLANK = { nombre:"", instructor:"", horas:0, precio:0, modalidad:"Presencial", estado:"activo", descripcion:"", fecha_proxima:"", fecha_fin:"" };
const ALUMNO_BLANK = { nombre:"", telefono:"", email:"", estado:"inscrito", fecha_inscripcion: new Date().toISOString().split("T")[0], monto_pagado:0, notas:"" };

function fmt(n: number) { return "RD$ " + Number(n).toLocaleString("es-DO", { minimumFractionDigits: 0 }); }
function pct(a: number, b: number) { return b === 0 ? 0 : Math.round(a / b * 100); }
function hoy() { return new Date().toLocaleDateString("es-DO", { day:"2-digit", month:"long", year:"numeric" }); }
function numCert(id: number) { return `CERT-${String(id).padStart(4,"0")}-${new Date().getFullYear()}`; }
function calcFechaFin(fechaInicio: string, horas: number): string {
  if (!fechaInicio || horas <= 0) return "";
  const dias = Math.ceil(horas / 8);
  const d = new Date(fechaInicio + "T12:00:00");
  d.setDate(d.getDate() + dias - 1);
  return d.toISOString().split("T")[0];
}
function fmtFecha(iso: string) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("es-DO", { day:"2-digit", month:"short", year:"numeric" });
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function CapacitacionesPage() {
  const { puedeCrear, puedeEditar, puedeEliminar } = usePermisos("capacitaciones");

  const [cursos,    setCursos]   = useState<Curso[]>([]);
  const [alumnos,   setAlumnos]  = useState<Alumno[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [error,     setError]    = useState<string | null>(null);
  const [tab,       setTab]      = useState<"todos"|"activo"|"inactivo">("todos");
  const [busqueda,  setBusqueda] = useState("");

  // Modal curso
  const [modalCurso, setModalCurso] = useState(false);
  const [editCurso,  setEditCurso]  = useState<Curso | null>(null);
  const [formCurso,  setFormCurso]  = useState(CURSO_BLANK);
  const [guardando,  setGuardando]  = useState(false);
  const [errCurso,   setErrCurso]   = useState<string | null>(null);

  // Panel alumnos
  const [cursoActivo,  setCursoActivo]  = useState<Curso | null>(null);
  const [modalAlumno,  setModalAlumno]  = useState(false);
  const [editAlumno,   setEditAlumno]   = useState<Alumno | null>(null);
  const [formAlumno,   setFormAlumno]   = useState(ALUMNO_BLANK);
  const [guardandoAl,  setGuardandoAl]  = useState(false);
  const [errAlumno,    setErrAlumno]    = useState<string | null>(null);

  // Certificado
  const [certData, setCertData] = useState<CertData | null>(null);
  const certRef = useRef<HTMLDivElement>(null);
  const [diplomaEdit, setDiplomaEdit] = useState(false);
  const [diplomaTxt, setDiplomaTxt] = useState({
    titulo:    "Certificado de Participación",
    subtitulo: "Se certifica que:",
    cuerpo:    "Ha completado satisfactoriamente el curso de:",
    ciudad:    "Santo Domingo, República Dominicana",
    gerencia:  "Gerencia General",
  });

  // ── Cargar datos ────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [{ data: c, error: ec }, { data: a, error: ea }] = await Promise.all([
      supabase.from("capacitaciones_cursos").select("*").order("created_at", { ascending: false }),
      supabase.from("capacitaciones_alumnos").select("*").order("created_at", { ascending: false }),
    ]);
    if (ec) {
      setError("⚠️ No se pudo cargar la data. Asegúrate de haber ejecutado el SQL de migración en Supabase.\n\nError: " + ec.message);
    }
    if (ea) console.error("Error alumnos:", ea.message);
    setCursos(c ?? []);
    setAlumnos(a ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Métricas ────────────────────────────────────────────────────────────────
  const totalIngresos    = alumnos.reduce((s, a) => s + Number(a.monto_pagado), 0);
  const totalCompletados = alumnos.filter(a => a.estado === "completado").length;
  const totalDesertados  = alumnos.filter(a => a.estado === "desertado").length;
  const cursosActivos    = cursos.filter(c => c.estado === "activo").length;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const alumnosDeCurso = (cid: number) => alumnos.filter(a => a.curso_id === cid);
  const ingresosCurso  = (cid: number) => alumnosDeCurso(cid).reduce((s,a) => s + Number(a.monto_pagado), 0);

  // ── CRUD Cursos ─────────────────────────────────────────────────────────────
  const abrirNuevoCurso = () => {
    setEditCurso(null); setFormCurso(CURSO_BLANK); setErrCurso(null); setModalCurso(true);
  };
  const abrirEditCurso = (c: Curso) => {
    setEditCurso(c);
    setFormCurso({ nombre:c.nombre, instructor:c.instructor, horas:c.horas, precio:c.precio,
      modalidad:c.modalidad, estado:c.estado, descripcion:c.descripcion, fecha_proxima:c.fecha_proxima??"",
      fecha_fin:c.fecha_fin ?? calcFechaFin(c.fecha_proxima??"", c.horas) });
    setErrCurso(null); setModalCurso(true);
  };

  const guardarCurso = async () => {
    if (!formCurso.nombre.trim()) { setErrCurso("El nombre del curso es requerido."); return; }
    setGuardando(true); setErrCurso(null);
    const payload = { ...formCurso, precio: Number(formCurso.precio), horas: Number(formCurso.horas) };
    let error: any;
    if (editCurso) {
      ({ error } = await supabase.from("capacitaciones_cursos").update(payload).eq("id", editCurso.id));
    } else {
      ({ error } = await supabase.from("capacitaciones_cursos").insert(payload));
    }
    setGuardando(false);
    if (error) {
      const esFechaFin = error.message?.includes("fecha_fin");
      setErrCurso("Error al guardar: " + error.message +
        (error.code === "42P01" ? "\n\n👉 Ejecuta primero el archivo sql/capacitaciones.sql en el panel de Supabase." : "") +
        (esFechaFin ? "\n\n👉 Columna fecha_fin no existe aún. Ejecuta en Supabase SQL Editor:\n\nALTER TABLE capacitaciones_cursos ADD COLUMN IF NOT EXISTS fecha_fin DATE;" : ""));
      return;
    }
    setModalCurso(false); cargar();
  };

  const eliminarCurso = async (id: number) => {
    if (!confirm("¿Eliminar este curso? Se eliminarán también sus alumnos.")) return;
    await supabase.from("capacitaciones_cursos").delete().eq("id", id);
    if (cursoActivo?.id === id) setCursoActivo(null);
    cargar();
  };

  // ── CRUD Alumnos ────────────────────────────────────────────────────────────
  const abrirNuevoAlumno = () => {
    setEditAlumno(null);
    setFormAlumno({ ...ALUMNO_BLANK, fecha_inscripcion: new Date().toISOString().split("T")[0] });
    setErrAlumno(null); setModalAlumno(true);
  };
  const abrirEditAlumno = (a: Alumno) => {
    setEditAlumno(a);
    setFormAlumno({ nombre:a.nombre, telefono:a.telefono, email:a.email, estado:a.estado,
      fecha_inscripcion:a.fecha_inscripcion, monto_pagado:a.monto_pagado, notas:a.notas });
    setErrAlumno(null); setModalAlumno(true);
  };

  const guardarAlumno = async () => {
    if (!cursoActivo) return;
    if (!formAlumno.nombre.trim()) { setErrAlumno("El nombre del alumno es requerido."); return; }
    setGuardandoAl(true); setErrAlumno(null);
    const payload = { ...formAlumno, curso_id: cursoActivo.id, monto_pagado: Number(formAlumno.monto_pagado) };
    let error: any;
    if (editAlumno) {
      ({ error } = await supabase.from("capacitaciones_alumnos").update(payload).eq("id", editAlumno.id));
    } else {
      ({ error } = await supabase.from("capacitaciones_alumnos").insert(payload));
    }
    setGuardandoAl(false);
    if (error) { setErrAlumno("Error: " + error.message); return; }
    setModalAlumno(false); cargar();
  };

  const eliminarAlumno = async (id: number) => {
    if (!confirm("¿Eliminar este alumno?")) return;
    await supabase.from("capacitaciones_alumnos").delete().eq("id", id);
    cargar();
  };

  // Marcar alumno como completado y abrir diploma
  const marcarCompletado = async (alumno: Alumno, curso: Curso) => {
    await supabase.from("capacitaciones_alumnos").update({ estado: "completado" }).eq("id", alumno.id);
    await cargar();
    abrirCertificado({ ...alumno, estado: "completado" }, curso);
  };

  // ── Certificado ─────────────────────────────────────────────────────────────
  const abrirCertificado = (alumno: Alumno, curso: Curso) => {
    setCertData({ alumno, curso });
  };

  const imprimirCertificado = () => {
    const printContents = certRef.current?.innerHTML;
    if (!printContents) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Certificado</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;600&display=swap');
      * { margin:0; padding:0; box-sizing:border-box; }
      body { background:#fff; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
      @page { size: A4 landscape; margin: 0; }
      @media print { body { margin: 0; } }
    </style></head><body>${printContents}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 500);
  };

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const cursosFiltrados = cursos.filter(c => {
    if (tab !== "todos" && c.estado !== tab) return false;
    if (busqueda && !c.nombre.toLowerCase().includes(busqueda.toLowerCase()) &&
        !c.instructor.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  const S = {
    page:    { padding:"28px 32px", background:"#f5f7fb", minHeight:"100vh" },
    card:    { background:"#fff", borderRadius:12, border:"1px solid #e5e7eb", padding:"18px 22px", marginBottom:16 },
    metricRow: { display:"grid" as const, gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))", gap:12, marginBottom:24 },
    metricBox: { background:"#fff", borderRadius:10, border:"1px solid #e5e7eb", padding:"14px 16px", textAlign:"center" as const },
    btn:     { padding:"8px 16px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:600 as const, fontSize:13 },
    btnBlue: { background:"#1d4ed8", color:"#fff" },
    btnGray: { background:"#f3f4f6", color:"#374151", border:"1px solid #d1d5db" },
    btnRed:  { background:"#fef2f2", color:"#b91c1c", border:"1px solid #fecaca" },
    btnGold: { background:"linear-gradient(135deg,#b45309,#d97706)", color:"#fff", border:"none" },
    btnPurple: { background:"#7c3aed", color:"#fff" },
    input:   { width:"100%", padding:"8px 12px", borderRadius:8, border:"1px solid #d1d5db", fontSize:14, outline:"none", background:"#fff", color:"#111827" },
    label:   { fontSize:13, fontWeight:600 as const, color:"#374151", marginBottom:4, display:"block" as const },
    tag:     { display:"inline-block", padding:"2px 10px", borderRadius:50, fontSize:11, fontWeight:700 as const },
    errBox:  { background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#b91c1c", whiteSpace:"pre-wrap" as const },
  };

  return (
    <div style={S.page}>

      {/* ── ENCABEZADO ──────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:"#111827", margin:0 }}>🎓 Capacitaciones</h1>
          <p style={{ fontSize:13, color:"#6b7280", margin:"4px 0 0" }}>Cursos, alumnos, ingresos y certificaciones</p>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <Link href="/capacitaciones/facturacion" style={{ ...S.btn, ...S.btnPurple, textDecoration:"none", display:"flex", alignItems:"center", gap:6 }}>
            🧾 Facturación de Cursos
          </Link>
          <Link href="/capacitaciones/contabilidad" style={{ ...S.btn, textDecoration:"none", display:"flex", alignItems:"center", gap:6, background:"#0d9488", color:"#fff" }}>
            📊 Contabilidad
          </Link>
          {puedeCrear && (
            <button style={{ ...S.btn, ...S.btnBlue }} onClick={abrirNuevoCurso}>+ Nuevo Curso</button>
          )}
        </div>
      </div>

      {/* ── ERROR DE MIGRACIÓN ──────────────────────────────────────────────── */}
      {error && (
        <div style={{ ...S.errBox, marginBottom:20 }}>
          {error}
          <button style={{ marginTop:8, display:"block", ...S.btn, ...S.btnRed, fontSize:12 }} onClick={cargar}>🔄 Reintentar</button>
        </div>
      )}

      {/* ── MÉTRICAS ────────────────────────────────────────────────────────── */}
      <div style={S.metricRow}>
        {[
          { label:"Cursos activos", val:cursosActivos, sub:`de ${cursos.length} total`, color:"#111827" },
          { label:"Total alumnos", val:alumnos.length, sub:"inscritos histórico", color:"#111827" },
          { label:"Ingresos cobrados", val:fmt(totalIngresos), sub:"pagos recibidos", color:"#15803d", small:true },
          { label:"Certificados emitidos", val:totalCompletados, sub:"alumnos", color:"#15803d" },
          { label:"Tasa deserción", val:pct(totalDesertados, alumnos.length)+"%", sub:`${totalDesertados} desertaron`,
            color: pct(totalDesertados,alumnos.length) > 20 ? "#b91c1c" : pct(totalDesertados,alumnos.length) > 10 ? "#b45309" : "#15803d" },
        ].map(m => (
          <div key={m.label} style={S.metricBox}>
            <div style={{ fontSize:12, color:"#6b7280", marginBottom:4 }}>{m.label}</div>
            <div style={{ fontSize: m.small?17:24, fontWeight:700, color:m.color }}>{m.val}</div>
            <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── LAYOUT ──────────────────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns: cursoActivo ? "1fr 390px" : "1fr", gap:20, alignItems:"start" }}>

        {/* ── LISTA DE CURSOS ─────────────────────────────────────────────── */}
        <div>
          <div style={{ ...S.card, display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", padding:"12px 16px" }}>
            <input placeholder="🔍 Buscar por nombre o instructor…" value={busqueda}
              onChange={e => setBusqueda(e.target.value)} style={{ ...S.input, width:260 }} />
            {(["todos","activo","inactivo"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                ...S.btn, ...(tab===t ? S.btnBlue : S.btnGray), padding:"6px 14px",
              }}>{t==="todos"?"Todos":t==="activo"?"Activos":"Inactivos"}</button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign:"center", padding:40, color:"#6b7280" }}>Cargando cursos…</div>
          ) : cursosFiltrados.length === 0 ? (
            <div style={{ textAlign:"center", padding:40, color:"#6b7280" }}>
              No hay cursos.{" "}
              {puedeCrear && <span style={{ color:"#1d4ed8", cursor:"pointer" }} onClick={abrirNuevoCurso}>Crear el primero →</span>}
            </div>
          ) : cursosFiltrados.map(curso => {
            const als     = alumnosDeCurso(curso.id);
            const comp    = als.filter(a => a.estado === "completado").length;
            const des     = als.filter(a => a.estado === "desertado").length;
            const insc    = als.filter(a => a.estado === "inscrito").length;
            const ing     = ingresosCurso(curso.id);
            const compPct = pct(comp, als.length);
            const desPct  = pct(des, als.length);
            const esActivo = cursoActivo?.id === curso.id;

            return (
              <div key={curso.id} style={{ ...S.card, border: esActivo ? "2px solid #1d4ed8" : "1px solid #e5e7eb", cursor:"pointer" }}
                onClick={() => setCursoActivo(esActivo ? null : curso)}>

                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:"#111827" }}>{curso.nombre}</div>
                    <div style={{ fontSize:12, color:"#6b7280", marginTop:3 }}>
                      👤 {curso.instructor} · ⏱ {curso.horas}h
                      {curso.fecha_proxima && ` · 📅 Inicio: ${fmtFecha(curso.fecha_proxima)}`}
                      {curso.fecha_fin && ` → Fin: ${fmtFecha(curso.fecha_fin)}`}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:5, flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end" }}>
                    <span style={{ ...S.tag, background: curso.estado==="activo"?"#dcfce7":"#f3f4f6", color: curso.estado==="activo"?"#15803d":"#6b7280" }}>{curso.estado}</span>
                    <span style={{ ...S.tag, background:"#ede9fe", color:"#5b21b6" }}>{curso.modalidad}</span>
                    <span style={{ ...S.tag, background:"#fff7ed", color:"#c2410c" }}>{fmt(curso.precio)}</span>
                  </div>
                </div>

                {curso.descripcion && <p style={{ fontSize:13, color:"#6b7280", margin:"0 0 12px", lineHeight:1.5 }}>{curso.descripcion}</p>}

                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:10 }}>
                  {[
                    { l:"Inscritos",  v:insc,    c:"#1d4ed8" },
                    { l:"Completaron",v:comp,    c:"#15803d" },
                    { l:"Desertaron", v:des,     c:"#b91c1c" },
                    { l:"Ingresos",   v:fmt(ing),c:"#111827", sm:true },
                  ].map(({ l, v, c, sm }) => (
                    <div key={l} style={{ background:"#f9fafb", borderRadius:8, padding:"8px", textAlign:"center" }}>
                      <div style={{ fontSize:10, color:"#9ca3af", marginBottom:2 }}>{l}</div>
                      <div style={{ fontSize: sm?12:18, fontWeight:700, color:c }}>{v}</div>
                    </div>
                  ))}
                </div>

                {als.length > 0 && (
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ flex:1, height:5, background:"#e5e7eb", borderRadius:50, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${compPct}%`, background:"#22c55e", borderRadius:50 }} />
                      </div>
                      <span style={{ fontSize:11, color:"#15803d", minWidth:40 }}>{compPct}% fin.</span>
                    </div>
                    {des > 0 && (
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ flex:1, height:5, background:"#e5e7eb", borderRadius:50, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${desPct}%`, background:"#ef4444", borderRadius:50 }} />
                        </div>
                        <span style={{ fontSize:11, color:"#b91c1c", minWidth:40 }}>{desPct}% des.</span>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display:"flex", gap:8, marginTop:12, justifyContent:"flex-end" }} onClick={e => e.stopPropagation()}>
                  <button style={{ ...S.btn, ...S.btnGray, padding:"5px 12px" }} onClick={() => setCursoActivo(esActivo ? null : curso)}>
                    👥 {als.length} alumnos
                  </button>
                  {puedeEditar && <button style={{ ...S.btn, ...S.btnGray, padding:"5px 12px" }} onClick={() => abrirEditCurso(curso)}>✏️ Editar</button>}
                  {puedeEliminar && <button style={{ ...S.btn, ...S.btnRed, padding:"5px 10px" }} onClick={() => eliminarCurso(curso.id)}>🗑️</button>}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── PANEL DE ALUMNOS ────────────────────────────────────────────── */}
        {cursoActivo && (() => {
          const als = alumnosDeCurso(cursoActivo.id);
          return (
            <div style={{ ...S.card, position:"sticky", top:80 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14, color:"#111827" }}>👥 Alumnos</div>
                  <div style={{ fontSize:12, color:"#6b7280", maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cursoActivo.nombre}</div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  {puedeCrear && <button style={{ ...S.btn, ...S.btnBlue, padding:"5px 12px" }} onClick={abrirNuevoAlumno}>+ Alumno</button>}
                  <button style={{ ...S.btn, ...S.btnGray, padding:"5px 10px" }} onClick={() => setCursoActivo(null)}>✕</button>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:10 }}>
                {ESTADOS_ALUMNO.map(e => (
                  <div key={e.value} style={{ background:"#f9fafb", borderRadius:8, padding:8, textAlign:"center" }}>
                    <div style={{ fontSize:18, fontWeight:700, color:e.color }}>{als.filter(a => a.estado===e.value).length}</div>
                    <div style={{ fontSize:10, color:"#9ca3af" }}>{e.label}s</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:13, fontWeight:600, color:"#15803d", textAlign:"center", marginBottom:12 }}>
                💰 {fmt(ingresosCurso(cursoActivo.id))} cobrados
              </div>

              {als.length === 0 ? (
                <div style={{ textAlign:"center", padding:20, color:"#9ca3af", fontSize:13 }}>
                  Sin alumnos.{" "}
                  {puedeCrear && <span style={{ color:"#1d4ed8", cursor:"pointer" }} onClick={abrirNuevoAlumno}>Agregar →</span>}
                </div>
              ) : als.map(a => {
                const est = ESTADOS_ALUMNO.find(e => e.value === a.estado)!;
                const pagoCompleto = Number(cursoActivo.precio) === 0 || Number(a.monto_pagado) >= Number(cursoActivo.precio);
                const puedeRecibir = a.estado === "completado";
                const pendiente    = Math.max(0, Number(cursoActivo.precio) - Number(a.monto_pagado));
                const hoyISO = new Date().toISOString().split("T")[0];
                const inscritoTerminado = a.estado === "inscrito" && !!cursoActivo.fecha_fin && cursoActivo.fecha_fin <= hoyISO;

                return (
                  <div key={a.id} style={{ background:"#f9fafb", borderRadius:8, padding:"10px 12px", marginBottom:8 }}>
                    {inscritoTerminado && (
                      <div style={{ background:"#fef3c7", border:"1px solid #fcd34d", borderRadius:6, padding:"6px 10px", marginBottom:8, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                        <span style={{ fontSize:12, color:"#92400e", fontWeight:600 }}>⏰ Curso finalizado — pendiente de completar</span>
                        <button
                          onClick={() => marcarCompletado(a, cursoActivo)}
                          style={{ background:"#d97706", color:"#fff", border:"none", borderRadius:5, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                          ✅ Completar y diploma
                        </button>
                      </div>
                    )}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:13, color:"#111827" }}>{a.nombre}</div>
                        {a.telefono && <div style={{ fontSize:12, color:"#6b7280" }}>📞 {a.telefono}</div>}
                        {a.email    && <div style={{ fontSize:12, color:"#6b7280", overflow:"hidden", textOverflow:"ellipsis" }}>✉️ {a.email}</div>}
                        <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>
                          📅 {a.fecha_inscripcion} · 💵 {fmt(a.monto_pagado)}
                          {pendiente > 0 && <span style={{ color:"#b91c1c" }}> (debe {fmt(pendiente)})</span>}
                        </div>
                        {a.notas && <div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>📝 {a.notas}</div>}
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end", flexShrink:0, marginLeft:8 }}>
                        <span style={{ ...S.tag, background:est.bg, color:est.color }}>{est.label}</span>
                        <div style={{ display:"flex", gap:4 }}>
                          {puedeEditar && <button style={{ ...S.btn, ...S.btnGray, padding:"3px 8px", fontSize:11 }} onClick={() => abrirEditAlumno(a)}>✏️</button>}
                          {puedeEliminar && <button style={{ ...S.btn, ...S.btnRed, padding:"3px 8px", fontSize:11 }} onClick={() => eliminarAlumno(a.id)}>🗑️</button>}
                        </div>
                        {/* ── BOTÓN DIPLOMA ── */}
                        <button
                          onClick={() => abrirCertificado(a, cursoActivo)}
                          disabled={!puedeRecibir}
                          title={!puedeRecibir ? "El alumno no ha completado el curso" : "Generar diploma"}
                          style={{
                            ...S.btn,
                            padding:"3px 9px", fontSize:11,
                            background: puedeRecibir ? "linear-gradient(135deg,#b45309,#d97706)" : "#e5e7eb",
                            color: puedeRecibir ? "#fff" : "#9ca3af",
                            border: puedeRecibir ? "none" : "1px solid #d1d5db",
                            cursor: puedeRecibir ? "pointer" : "not-allowed",
                            display:"flex", alignItems:"center", gap:4,
                          }}>
                          🎓 Diploma
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL CURSO                                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalCurso && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={() => setModalCurso(false)}>
          <div style={{ background:"#fff", borderRadius:14, width:"min(600px,95%)", maxHeight:"90vh", overflow:"auto", padding:28 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:"#111827" }}>{editCurso ? "✏️ Editar Curso" : "🎓 Nuevo Curso"}</h2>
              <button style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#6b7280" }} onClick={() => setModalCurso(false)}>✕</button>
            </div>

            {errCurso && <div style={{ ...S.errBox, marginBottom:14 }}>{errCurso}</div>}

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={S.label}>Nombre del curso *</label>
                <input style={S.input} value={formCurso.nombre} placeholder="Ej: Mecánica de frenos y suspensión"
                  onChange={e => setFormCurso({ ...formCurso, nombre:e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Instructor</label>
                <input style={S.input} value={formCurso.instructor} onChange={e => setFormCurso({ ...formCurso, instructor:e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Duración (horas)</label>
                <input style={S.input} type="number" min={0} value={formCurso.horas} onChange={e => {
                  const horas = Number(e.target.value);
                  setFormCurso(f => ({ ...f, horas, fecha_fin: calcFechaFin(f.fecha_proxima, horas) }));
                }} />
              </div>
              <div>
                <label style={S.label}>Precio por alumno (RD$)</label>
                <input style={S.input} type="number" min={0} value={formCurso.precio} onChange={e => setFormCurso({ ...formCurso, precio:Number(e.target.value) })} />
              </div>
              <div>
                <label style={S.label}>Fecha de inicio</label>
                <input style={S.input} type="date" value={formCurso.fecha_proxima} onChange={e => {
                  const fp = e.target.value;
                  setFormCurso(f => ({ ...f, fecha_proxima: fp, fecha_fin: calcFechaFin(fp, f.horas) }));
                }} />
              </div>
              <div>
                <label style={S.label}>Fecha de fin <span style={{ color:"#9ca3af", fontWeight:400 }}>(auto-calculada)</span></label>
                <input style={{ ...S.input, background:"#f9fafb", color: formCurso.fecha_fin ? "#15803d" : "#9ca3af" }} type="date" value={formCurso.fecha_fin}
                  onChange={e => setFormCurso({ ...formCurso, fecha_fin: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Modalidad</label>
                <select style={S.input} value={formCurso.modalidad} onChange={e => setFormCurso({ ...formCurso, modalidad:e.target.value })}>
                  {MODALIDADES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Estado</label>
                <select style={S.input} value={formCurso.estado} onChange={e => setFormCurso({ ...formCurso, estado:e.target.value })}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={S.label}>Descripción</label>
                <textarea style={{ ...S.input, height:80, resize:"vertical" }} value={formCurso.descripcion}
                  placeholder="Contenido y objetivos del curso…"
                  onChange={e => setFormCurso({ ...formCurso, descripcion:e.target.value })} />
              </div>
            </div>

            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:20 }}>
              <button style={{ ...S.btn, ...S.btnGray }} onClick={() => setModalCurso(false)}>Cancelar</button>
              <button style={{ ...S.btn, ...S.btnBlue, opacity: guardando?0.7:1 }} onClick={guardarCurso} disabled={guardando}>
                {guardando ? "Guardando…" : "💾 Guardar Curso"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL ALUMNO                                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalAlumno && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={() => setModalAlumno(false)}>
          <div style={{ background:"#fff", borderRadius:14, width:"min(480px,95%)", padding:24 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
              <h2 style={{ margin:0, fontSize:17, fontWeight:700 }}>{editAlumno ? "✏️ Editar Alumno" : "👤 Nuevo Alumno"}</h2>
              <button style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#6b7280" }} onClick={() => setModalAlumno(false)}>✕</button>
            </div>

            {errAlumno && <div style={{ ...S.errBox, marginBottom:14 }}>{errAlumno}</div>}

            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <label style={S.label}>Nombre *</label>
                <input style={S.input} value={formAlumno.nombre} placeholder="Nombre completo"
                  onChange={e => setFormAlumno({ ...formAlumno, nombre:e.target.value })} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <label style={S.label}>Teléfono</label>
                  <input style={S.input} value={formAlumno.telefono} placeholder="809-000-0000"
                    onChange={e => setFormAlumno({ ...formAlumno, telefono:e.target.value })} />
                </div>
                <div>
                  <label style={S.label}>Email</label>
                  <input style={S.input} type="email" value={formAlumno.email}
                    onChange={e => setFormAlumno({ ...formAlumno, email:e.target.value })} />
                </div>
                <div>
                  <label style={S.label}>Estado</label>
                  <select style={S.input} value={formAlumno.estado}
                    onChange={e => setFormAlumno({ ...formAlumno, estado:e.target.value })}>
                    {ESTADOS_ALUMNO.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Monto pagado (RD$)</label>
                  <input style={S.input} type="number" min={0} value={formAlumno.monto_pagado}
                    onChange={e => setFormAlumno({ ...formAlumno, monto_pagado:Number(e.target.value) })} />
                </div>
                <div>
                  <label style={S.label}>Fecha de inscripción</label>
                  <input style={S.input} type="date" value={formAlumno.fecha_inscripcion}
                    onChange={e => setFormAlumno({ ...formAlumno, fecha_inscripcion:e.target.value })} />
                </div>
              </div>
              <div>
                <label style={S.label}>Notas</label>
                <textarea style={{ ...S.input, height:60, resize:"vertical" }} value={formAlumno.notas}
                  onChange={e => setFormAlumno({ ...formAlumno, notas:e.target.value })} />
              </div>
            </div>

            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:18 }}>
              <button style={{ ...S.btn, ...S.btnGray }} onClick={() => setModalAlumno(false)}>Cancelar</button>
              <button style={{ ...S.btn, ...S.btnBlue, opacity: guardandoAl?0.7:1 }} onClick={guardarAlumno} disabled={guardandoAl}>
                {guardandoAl ? "Guardando…" : "💾 Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL CERTIFICADO / DIPLOMA                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {certData && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12, overflowY:"auto", padding:"20px 0" }}>
          {/* Botones de control */}
          <div style={{ display:"flex", gap:10, zIndex:10, flexWrap:"wrap", justifyContent:"center" }}>
            <button style={{ ...S.btn, background:"linear-gradient(135deg,#b45309,#d97706)", color:"#fff", fontSize:14 }} onClick={imprimirCertificado}>
              🖨️ Imprimir / Descargar PDF
            </button>
            <button style={{ ...S.btn, background: diplomaEdit ? "#1d4ed8" : "#f3f4f6", color: diplomaEdit ? "#fff" : "#374151", border:"1px solid #d1d5db" }}
              onClick={() => setDiplomaEdit(!diplomaEdit)}>
              ✏️ {diplomaEdit ? "Ocultar editor" : "Editar texto diploma"}
            </button>
            <button style={{ ...S.btn, ...S.btnGray }} onClick={() => { setCertData(null); setDiplomaEdit(false); }}>✕ Cerrar</button>
          </div>

          {/* Panel editor de texto */}
          {diplomaEdit && (
            <div style={{ background:"#fff", borderRadius:12, padding:"16px 20px", width:"min(700px,95vw)", display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, boxShadow:"0 4px 20px rgba(0,0,0,0.3)" }}>
              <div style={{ gridColumn:"1/-1", fontSize:13, fontWeight:700, color:"#374151", marginBottom:2 }}>✏️ Personalizar texto del diploma</div>
              {([
                { key:"titulo",    label:"Título principal" },
                { key:"subtitulo", label:"Subtítulo (\"Se certifica que:\")"},
                { key:"cuerpo",    label:"Cuerpo (antes del nombre del curso)"},
                { key:"ciudad",    label:"Ciudad / Lugar"},
                { key:"gerencia",  label:"Cargo firma derecha"},
              ] as const).map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:11, fontWeight:600, color:"#6b7280", display:"block", marginBottom:2 }}>{f.label}</label>
                  <input style={{ width:"100%", padding:"6px 10px", borderRadius:6, border:"1px solid #d1d5db", fontSize:13, boxSizing:"border-box" as const }}
                    value={diplomaTxt[f.key]}
                    onChange={e => setDiplomaTxt(t => ({ ...t, [f.key]: e.target.value }))} />
                </div>
              ))}
            </div>
          )}

          {/* Certificado (A4 landscape) */}
          <div ref={certRef} style={{ width:1050, height:742, overflow:"hidden", borderRadius:4, boxShadow:"0 25px 60px rgba(0,0,0,0.5)" }}>
            <div style={{
              width:1050, height:742,
              background:"#fff",
              fontFamily:"Georgia, 'Times New Roman', serif",
              position:"relative",
              overflow:"hidden",
            }}>
              {/* Fondo decorativo — triángulo azul superior */}
              <div style={{ position:"absolute", top:0, left:0, width:0, height:0, borderStyle:"solid", borderWidth:"140px 200px 0 0", borderColor:"#1d4ed8 transparent transparent transparent" }} />
              {/* Fondo decorativo — triángulo dorado inferior */}
              <div style={{ position:"absolute", bottom:0, right:0, width:0, height:0, borderStyle:"solid", borderWidth:"0 0 120px 180px", borderColor:"transparent transparent #b45309 transparent" }} />

              {/* Marco doble exterior */}
              <div style={{ position:"absolute", inset:16, border:"3px solid #1d4ed8", borderRadius:2, pointerEvents:"none" }} />
              <div style={{ position:"absolute", inset:22, border:"1px solid #b45309", borderRadius:1, pointerEvents:"none" }} />

              {/* Contenido principal */}
              <div style={{ position:"relative", zIndex:2, display:"flex", flexDirection:"column", alignItems:"center", height:"100%", padding:"36px 60px" }}>

                {/* Logo + empresa */}
                <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:10 }}>
                  <img src="/logo.png" alt="Logo" style={{ width:60, height:60, objectFit:"contain" }} onError={e => (e.currentTarget.style.display="none")} />
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:22, fontWeight:900, color:"#1d4ed8", letterSpacing:3, fontFamily:"Arial,sans-serif", textTransform:"uppercase" }}>
                      SÓLIDO AUTO SERVICIO
                    </div>
                    <div style={{ fontSize:11, color:"#6b7280", letterSpacing:2, fontFamily:"Arial,sans-serif", textTransform:"uppercase" }}>
                      Servicio Automotriz &amp; Café
                    </div>
                  </div>
                </div>

                {/* Línea decorativa */}
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, width:"80%" }}>
                  <div style={{ flex:1, height:1, background:"linear-gradient(to right, transparent, #b45309)" }} />
                  <span style={{ color:"#b45309", fontSize:20 }}>✦</span>
                  <div style={{ flex:1, height:1, background:"linear-gradient(to left, transparent, #b45309)" }} />
                </div>

                {/* Título */}
                <div style={{ fontSize:30, fontWeight:700, color:"#1d4ed8", letterSpacing:4, textTransform:"uppercase", fontFamily:"Arial,sans-serif", marginBottom:6 }}>
                  {diplomaTxt.titulo}
                </div>
                <div style={{ fontSize:13, color:"#6b7280", letterSpacing:2, fontFamily:"Arial,sans-serif", textTransform:"uppercase", marginBottom:20 }}>
                  {diplomaTxt.subtitulo}
                </div>

                {/* Nombre del alumno */}
                <div style={{ fontSize:48, color:"#111827", marginBottom:6, fontStyle:"italic", letterSpacing:1, textAlign:"center", lineHeight:1.1 }}>
                  {certData.alumno.nombre}
                </div>

                {/* Separador */}
                <div style={{ width:320, height:2, background:"linear-gradient(to right, transparent, #1d4ed8, transparent)", marginBottom:16 }} />

                {/* Descripción */}
                <div style={{ fontSize:14, color:"#374151", textAlign:"center", fontFamily:"Arial,sans-serif", lineHeight:1.7, marginBottom:20 }}>
                  {diplomaTxt.cuerpo}
                  <br />
                  <strong style={{ fontSize:19, color:"#1d4ed8", display:"block", marginTop:4 }}>
                    {certData.curso.nombre}
                  </strong>
                  <span style={{ fontSize:12, color:"#6b7280" }}>
                    Con una duración de <strong>{certData.curso.horas} horas</strong> · Modalidad: {certData.curso.modalidad}
                  </span>
                </div>

                {/* Firmas */}
                <div style={{ display:"flex", justifyContent:"space-around", width:"80%", marginTop:"auto", marginBottom:12 }}>
                  {[
                    { titulo:"Instructor", nombre:certData.curso.instructor || "Instructor" },
                    { titulo:diplomaTxt.gerencia, nombre:"Sólido Auto Servicio" },
                  ].map(f => (
                    <div key={f.titulo} style={{ textAlign:"center" }}>
                      <div style={{ width:160, borderBottom:"1.5px solid #374151", marginBottom:6 }} />
                      <div style={{ fontSize:12, fontWeight:700, color:"#111827", fontFamily:"Arial,sans-serif" }}>{f.nombre}</div>
                      <div style={{ fontSize:11, color:"#6b7280", fontFamily:"Arial,sans-serif" }}>{f.titulo}</div>
                    </div>
                  ))}
                </div>

                {/* Pie */}
                <div style={{ display:"flex", justifyContent:"space-between", width:"100%", fontSize:10, color:"#9ca3af", fontFamily:"Arial,sans-serif", marginTop:4 }}>
                  <span>{diplomaTxt.ciudad}</span>
                  <span style={{ fontSize:11, color:"#b45309", fontWeight:700 }}>{numCert(certData.alumno.id)}</span>
                  <span>Fecha: {hoy()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
