"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { usePermisos } from "@/lib/usePermisos";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Curso {
  id: number;
  nombre: string;
  instructor: string;
  horas: number;
  precio: number;
  modalidad: string;
  estado: string;
  descripcion: string;
  fecha_proxima: string;
  created_at: string;
}

interface Alumno {
  id: number;
  curso_id: number;
  nombre: string;
  telefono: string;
  email: string;
  estado: string;
  fecha_inscripcion: string;
  monto_pagado: number;
  notas: string;
}

interface Metricas {
  totalCursos: number;
  cursosActivos: number;
  totalInscritos: number;
  totalIngresos: number;
  totalCompletados: number;
  totalDesertados: number;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const MODALIDADES = ["Presencial", "Online", "Semipresencial"];
const ESTADOS_ALUMNO = [
  { value: "inscrito",   label: "Inscrito",   color: "#1d4ed8" },
  { value: "completado", label: "Completado", color: "#15803d" },
  { value: "desertado",  label: "Desertado",  color: "#b91c1c" },
];

const cursoBlanc: Omit<Curso, "id" | "created_at"> = {
  nombre: "", instructor: "", horas: 0, precio: 0,
  modalidad: "Presencial", estado: "activo", descripcion: "", fecha_proxima: "",
};
const alumnoBlanc: Omit<Alumno, "id" | "curso_id"> = {
  nombre: "", telefono: "", email: "",
  estado: "inscrito", fecha_inscripcion: new Date().toISOString().split("T")[0],
  monto_pagado: 0, notas: "",
};

function fmt(n: number) {
  return "RD$ " + Number(n).toLocaleString("es-DO", { minimumFractionDigits: 0 });
}
function pct(a: number, b: number) { return b === 0 ? 0 : Math.round(a / b * 100); }

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CapacitacionesPage() {
  const { puedeCrear, puedeEditar, puedeEliminar } = usePermisos("capacitaciones");

  const [cursos,    setCursos]   = useState<Curso[]>([]);
  const [alumnos,   setAlumnos]  = useState<Alumno[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [tab,       setTab]      = useState<"todos" | "activo" | "inactivo">("todos");
  const [busqueda,  setBusqueda] = useState("");

  // Modal curso
  const [modalCurso, setModalCurso] = useState(false);
  const [editCurso,  setEditCurso]  = useState<Curso | null>(null);
  const [formCurso,  setFormCurso]  = useState(cursoBlanc);
  const [guardando,  setGuardando]  = useState(false);

  // Modal alumnos (panel lateral de un curso)
  const [cursoActivo,   setCursoActivo]   = useState<Curso | null>(null);
  const [modalAlumno,   setModalAlumno]   = useState(false);
  const [editAlumno,    setEditAlumno]    = useState<Alumno | null>(null);
  const [formAlumno,    setFormAlumno]    = useState(alumnoBlanc);
  const [guardandoAl,   setGuardandoAl]   = useState(false);

  // ── Carga de datos ────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from("capacitaciones_cursos").select("*").order("created_at", { ascending: false }),
      supabase.from("capacitaciones_alumnos").select("*").order("created_at", { ascending: false }),
    ]);
    setCursos(c ?? []);
    setAlumnos(a ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Métricas globales ─────────────────────────────────────────────────────
  const metricas: Metricas = {
    totalCursos:     cursos.length,
    cursosActivos:   cursos.filter(c => c.estado === "activo").length,
    totalInscritos:  alumnos.length,
    totalIngresos:   alumnos.reduce((s, a) => s + Number(a.monto_pagado), 0),
    totalCompletados: alumnos.filter(a => a.estado === "completado").length,
    totalDesertados: alumnos.filter(a => a.estado === "desertado").length,
  };

  // ── Helpers por curso ─────────────────────────────────────────────────────
  const alumnosDeCurso = (cid: number) => alumnos.filter(a => a.curso_id === cid);
  const ingresosCurso  = (cid: number) =>
    alumnosDeCurso(cid).reduce((s, a) => s + Number(a.monto_pagado), 0);

  // ── CRUD Cursos ───────────────────────────────────────────────────────────
  const abrirNuevoCurso = () => {
    setEditCurso(null);
    setFormCurso(cursoBlanc);
    setModalCurso(true);
  };
  const abrirEditCurso = (c: Curso) => {
    setEditCurso(c);
    setFormCurso({ nombre: c.nombre, instructor: c.instructor, horas: c.horas,
      precio: c.precio, modalidad: c.modalidad, estado: c.estado,
      descripcion: c.descripcion, fecha_proxima: c.fecha_proxima ?? "" });
    setModalCurso(true);
  };

  const guardarCurso = async () => {
    if (!formCurso.nombre.trim()) return alert("El nombre del curso es requerido.");
    setGuardando(true);
    const payload = { ...formCurso, precio: Number(formCurso.precio), horas: Number(formCurso.horas) };
    if (editCurso) {
      await supabase.from("capacitaciones_cursos").update(payload).eq("id", editCurso.id);
    } else {
      await supabase.from("capacitaciones_cursos").insert(payload);
    }
    setGuardando(false);
    setModalCurso(false);
    cargar();
  };

  const eliminarCurso = async (id: number) => {
    if (!confirm("¿Eliminar este curso? Se eliminarán también sus alumnos.")) return;
    await supabase.from("capacitaciones_cursos").delete().eq("id", id);
    if (cursoActivo?.id === id) setCursoActivo(null);
    cargar();
  };

  // ── CRUD Alumnos ──────────────────────────────────────────────────────────
  const abrirNuevoAlumno = () => {
    setEditAlumno(null);
    setFormAlumno({ ...alumnoBlanc, fecha_inscripcion: new Date().toISOString().split("T")[0] });
    setModalAlumno(true);
  };
  const abrirEditAlumno = (a: Alumno) => {
    setEditAlumno(a);
    setFormAlumno({ nombre: a.nombre, telefono: a.telefono, email: a.email,
      estado: a.estado, fecha_inscripcion: a.fecha_inscripcion,
      monto_pagado: a.monto_pagado, notas: a.notas });
    setModalAlumno(true);
  };

  const guardarAlumno = async () => {
    if (!cursoActivo) return;
    if (!formAlumno.nombre.trim()) return alert("El nombre del alumno es requerido.");
    setGuardandoAl(true);
    const payload = { ...formAlumno, curso_id: cursoActivo.id, monto_pagado: Number(formAlumno.monto_pagado) };
    if (editAlumno) {
      await supabase.from("capacitaciones_alumnos").update(payload).eq("id", editAlumno.id);
    } else {
      await supabase.from("capacitaciones_alumnos").insert(payload);
    }
    setGuardandoAl(false);
    setModalAlumno(false);
    cargar();
  };

  const eliminarAlumno = async (id: number) => {
    if (!confirm("¿Eliminar este alumno?")) return;
    await supabase.from("capacitaciones_alumnos").delete().eq("id", id);
    cargar();
  };

  // ── Filtros ───────────────────────────────────────────────────────────────
  const cursosFiltrados = cursos.filter(c => {
    if (tab !== "todos" && c.estado !== tab) return false;
    if (busqueda && !c.nombre.toLowerCase().includes(busqueda.toLowerCase()) &&
        !c.instructor.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  const S = {
    page:    { padding: "28px 32px", background: "#f5f7fb", minHeight: "100vh" },
    card:    { background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "18px 22px", marginBottom: 20 },
    metricRow: { display: "grid" as const, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 24 },
    metricBox: { background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 16px", textAlign: "center" as const },
    metricVal: { fontSize: 24, fontWeight: 700, color: "#111827" },
    metricLabel: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
    btn:     { padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13 },
    btnBlue: { background: "#1d4ed8", color: "#fff" },
    btnGray: { background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db" },
    btnRed:  { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" },
    input:   { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none" },
    label:   { fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" as const },
    tag:     { display: "inline-block", padding: "2px 10px", borderRadius: 50, fontSize: 11, fontWeight: 700 },
  };

  return (
    <div style={S.page}>
      {/* ── ENCABEZADO ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>🎓 Capacitaciones</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
            Gestión de cursos, alumnos, ingresos y tasas de deserción
          </p>
        </div>
        {puedeCrear && (
          <button style={{ ...S.btn, ...S.btnBlue, display: "flex", alignItems: "center", gap: 6 }}
            onClick={abrirNuevoCurso}>
            + Nuevo Curso
          </button>
        )}
      </div>

      {/* ── MÉTRICAS ───────────────────────────────────────────────────────── */}
      <div style={S.metricRow}>
        <div style={S.metricBox}>
          <div style={S.metricLabel}>Cursos activos</div>
          <div style={S.metricVal}>{metricas.cursosActivos}</div>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>de {metricas.totalCursos} total</div>
        </div>
        <div style={S.metricBox}>
          <div style={S.metricLabel}>Total alumnos</div>
          <div style={S.metricVal}>{metricas.totalInscritos}</div>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>inscritos histórico</div>
        </div>
        <div style={S.metricBox}>
          <div style={S.metricLabel}>Ingresos totales</div>
          <div style={{ ...S.metricVal, fontSize: 18, color: "#15803d" }}>{fmt(metricas.totalIngresos)}</div>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>cobrado</div>
        </div>
        <div style={S.metricBox}>
          <div style={S.metricLabel}>Certificados</div>
          <div style={{ ...S.metricVal, color: "#15803d" }}>{metricas.totalCompletados}</div>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>alumnos</div>
        </div>
        <div style={S.metricBox}>
          <div style={S.metricLabel}>Tasa deserción</div>
          <div style={{
            ...S.metricVal,
            color: metricas.totalInscritos === 0 ? "#111827"
              : pct(metricas.totalDesertados, metricas.totalInscritos) > 20 ? "#b91c1c"
              : pct(metricas.totalDesertados, metricas.totalInscritos) > 10 ? "#b45309"
              : "#15803d",
          }}>
            {pct(metricas.totalDesertados, metricas.totalInscritos)}%
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>{metricas.totalDesertados} desertaron</div>
        </div>
      </div>

      {/* ── LAYOUT PRINCIPAL: lista + detalle ──────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: cursoActivo ? "1fr 380px" : "1fr", gap: 20, alignItems: "start" }}>

        {/* ── LISTA DE CURSOS ──────────────────────────────────────────────── */}
        <div>
          {/* Filtros */}
          <div style={{ ...S.card, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
            <input placeholder="🔍 Buscar por nombre o instructor..." value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ ...S.input, width: 260 }} />
            {(["todos", "activo", "inactivo"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                ...S.btn, ...(tab === t ? S.btnBlue : S.btnGray),
                padding: "6px 14px", textTransform: "capitalize",
              }}>{t === "todos" ? "Todos" : t === "activo" ? "Activos" : "Inactivos"}</button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>Cargando cursos…</div>
          ) : cursosFiltrados.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
              No hay cursos que coincidan. {puedeCrear && <span style={{ color: "#1d4ed8", cursor: "pointer" }} onClick={abrirNuevoCurso}>Crear el primero →</span>}
            </div>
          ) : cursosFiltrados.map(curso => {
            const als     = alumnosDeCurso(curso.id);
            const comp    = als.filter(a => a.estado === "completado").length;
            const des     = als.filter(a => a.estado === "desertado").length;
            const insc    = als.filter(a => a.estado === "inscrito").length;
            const ing     = ingresosCurso(curso.id);
            const desPct  = pct(des, als.length);
            const compPct = pct(comp, als.length);
            const esActivo = cursoActivo?.id === curso.id;

            return (
              <div key={curso.id} style={{
                ...S.card,
                border: esActivo ? "2px solid #1d4ed8" : "1px solid #e5e7eb",
                cursor: "pointer",
                transition: "box-shadow 0.15s",
              }} onClick={() => setCursoActivo(esActivo ? null : curso)}>

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{curso.nombre}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
                      👤 {curso.instructor} &nbsp;·&nbsp; ⏱ {curso.horas}h
                      {curso.fecha_proxima && (
                        <span> &nbsp;·&nbsp; 📅 {new Date(curso.fecha_proxima + "T00:00:00").toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                    <span style={{
                      ...S.tag,
                      background: curso.estado === "activo" ? "#dcfce7" : "#f3f4f6",
                      color: curso.estado === "activo" ? "#15803d" : "#6b7280",
                    }}>{curso.estado}</span>
                    <span style={{
                      ...S.tag,
                      background: curso.modalidad === "Online" ? "#dbeafe" : curso.modalidad === "Semipresencial" ? "#fef9c3" : "#fef3c7",
                      color: curso.modalidad === "Online" ? "#1d4ed8" : curso.modalidad === "Semipresencial" ? "#854d0e" : "#92400e",
                    }}>{curso.modalidad}</span>
                  </div>
                </div>

                {curso.descripcion && (
                  <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 12px", lineHeight: 1.5 }}>{curso.descripcion}</p>
                )}

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
                  {[
                    { label: "Inscritos", val: insc,  color: "#1d4ed8" },
                    { label: "Completaron", val: comp, color: "#15803d" },
                    { label: "Desertaron",  val: des,  color: "#b91c1c" },
                    { label: "Ingresos",    val: fmt(ing), color: "#111827", small: true },
                  ].map(({ label, val, color, small }) => (
                    <div key={label} style={{ background: "#f9fafb", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: small ? 12 : 18, fontWeight: 700, color }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Barras de progreso */}
                {als.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 5, background: "#e5e7eb", borderRadius: 50, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${compPct}%`, background: "#22c55e", borderRadius: 50 }} />
                      </div>
                      <span style={{ fontSize: 11, color: "#15803d", minWidth: 40 }}>{compPct}% fin.</span>
                    </div>
                    {des > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 5, background: "#e5e7eb", borderRadius: 50, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${desPct}%`, background: "#ef4444", borderRadius: 50 }} />
                        </div>
                        <span style={{ fontSize: 11, color: "#b91c1c", minWidth: 40 }}>{desPct}% des.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Acciones */}
                <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }} onClick={e => e.stopPropagation()}>
                  <button style={{ ...S.btn, ...S.btnGray, padding: "5px 12px" }}
                    onClick={() => setCursoActivo(esActivo ? null : curso)}>
                    👥 {als.length} alumnos
                  </button>
                  {puedeEditar && (
                    <button style={{ ...S.btn, ...S.btnGray, padding: "5px 12px" }} onClick={() => abrirEditCurso(curso)}>✏️ Editar</button>
                  )}
                  {puedeEliminar && (
                    <button style={{ ...S.btn, ...S.btnRed, padding: "5px 12px" }} onClick={() => eliminarCurso(curso.id)}>🗑️</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── PANEL DE ALUMNOS ─────────────────────────────────────────────── */}
        {cursoActivo && (() => {
          const als = alumnosDeCurso(cursoActivo.id);
          return (
            <div style={{ ...S.card, position: "sticky", top: 80 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>👥 Alumnos</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{cursoActivo.nombre}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {puedeCrear && (
                    <button style={{ ...S.btn, ...S.btnBlue, padding: "5px 12px" }} onClick={abrirNuevoAlumno}>+ Alumno</button>
                  )}
                  <button style={{ ...S.btn, ...S.btnGray, padding: "5px 10px" }} onClick={() => setCursoActivo(null)}>✕</button>
                </div>
              </div>

              {/* Resumen rápido */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
                {ESTADOS_ALUMNO.map(e => (
                  <div key={e.value} style={{ background: "#f9fafb", borderRadius: 8, padding: "8px", textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: e.color }}>
                      {als.filter(a => a.estado === e.value).length}
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>{e.label}s</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, color: "#15803d", marginBottom: 12, textAlign: "center" }}>
                💰 Ingresos: {fmt(ingresosCurso(cursoActivo.id))}
              </div>

              {/* Lista de alumnos */}
              {als.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px", color: "#9ca3af", fontSize: 13 }}>
                  Sin alumnos registrados. {puedeCrear && <span style={{ color: "#1d4ed8", cursor: "pointer" }} onClick={abrirNuevoAlumno}>Agregar →</span>}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {als.map(a => {
                    const est = ESTADOS_ALUMNO.find(e => e.value === a.estado);
                    return (
                      <div key={a.id} style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{a.nombre}</div>
                            {a.telefono && <div style={{ fontSize: 12, color: "#6b7280" }}>📞 {a.telefono}</div>}
                            {a.email    && <div style={{ fontSize: 12, color: "#6b7280" }}>✉️ {a.email}</div>}
                            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                              📅 {a.fecha_inscripcion} &nbsp;·&nbsp; 💵 {fmt(a.monto_pagado)}
                            </div>
                            {a.notas && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>📝 {a.notas}</div>}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                            <span style={{ ...S.tag, background: `${est?.color}20`, color: est?.color }}>{est?.label}</span>
                            <div style={{ display: "flex", gap: 4 }}>
                              {puedeEditar && (
                                <button style={{ ...S.btn, ...S.btnGray, padding: "3px 8px", fontSize: 11 }} onClick={() => abrirEditAlumno(a)}>✏️</button>
                              )}
                              {puedeEliminar && (
                                <button style={{ ...S.btn, ...S.btnRed, padding: "3px 8px", fontSize: 11 }} onClick={() => eliminarAlumno(a.id)}>🗑️</button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL CURSO                                                            */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {modalCurso && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setModalCurso(false)}>
          <div style={{ background: "#fff", borderRadius: 14, width: "min(600px,95%)", maxHeight: "90vh", overflow: "auto", padding: 28 }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>
                {editCurso ? "✏️ Editar Curso" : "🎓 Nuevo Curso"}
              </h2>
              <button style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }} onClick={() => setModalCurso(false)}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* Nombre */}
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.label}>Nombre del curso *</label>
                <input style={S.input} value={formCurso.nombre} placeholder="Ej: Mecánica de frenos y suspensión"
                  onChange={e => setFormCurso({ ...formCurso, nombre: e.target.value })} />
              </div>
              {/* Instructor */}
              <div>
                <label style={S.label}>Instructor</label>
                <input style={S.input} value={formCurso.instructor} placeholder="Nombre del instructor"
                  onChange={e => setFormCurso({ ...formCurso, instructor: e.target.value })} />
              </div>
              {/* Horas */}
              <div>
                <label style={S.label}>Duración (horas)</label>
                <input style={S.input} type="number" min={0} value={formCurso.horas}
                  onChange={e => setFormCurso({ ...formCurso, horas: Number(e.target.value) })} />
              </div>
              {/* Precio */}
              <div>
                <label style={S.label}>Precio por alumno (RD$)</label>
                <input style={S.input} type="number" min={0} value={formCurso.precio}
                  onChange={e => setFormCurso({ ...formCurso, precio: Number(e.target.value) })} />
              </div>
              {/* Fecha próxima */}
              <div>
                <label style={S.label}>Próxima fecha</label>
                <input style={S.input} type="date" value={formCurso.fecha_proxima}
                  onChange={e => setFormCurso({ ...formCurso, fecha_proxima: e.target.value })} />
              </div>
              {/* Modalidad */}
              <div>
                <label style={S.label}>Modalidad</label>
                <select style={S.input} value={formCurso.modalidad}
                  onChange={e => setFormCurso({ ...formCurso, modalidad: e.target.value })}>
                  {MODALIDADES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              {/* Estado */}
              <div>
                <label style={S.label}>Estado</label>
                <select style={S.input} value={formCurso.estado}
                  onChange={e => setFormCurso({ ...formCurso, estado: e.target.value })}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              {/* Descripción */}
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.label}>Descripción</label>
                <textarea style={{ ...S.input, height: 80, resize: "vertical" }} value={formCurso.descripcion}
                  placeholder="Contenido y objetivos del curso…"
                  onChange={e => setFormCurso({ ...formCurso, descripcion: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button style={{ ...S.btn, ...S.btnGray }} onClick={() => setModalCurso(false)}>Cancelar</button>
              <button style={{ ...S.btn, ...S.btnBlue, opacity: guardando ? 0.7 : 1 }} onClick={guardarCurso} disabled={guardando}>
                {guardando ? "Guardando…" : "💾 Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL ALUMNO                                                           */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {modalAlumno && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setModalAlumno(false)}>
          <div style={{ background: "#fff", borderRadius: 14, width: "min(480px,95%)", padding: 24 }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>
                {editAlumno ? "✏️ Editar Alumno" : "👤 Nuevo Alumno"}
              </h2>
              <button style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }} onClick={() => setModalAlumno(false)}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={S.label}>Nombre *</label>
                <input style={S.input} value={formAlumno.nombre} placeholder="Nombre completo"
                  onChange={e => setFormAlumno({ ...formAlumno, nombre: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={S.label}>Teléfono</label>
                  <input style={S.input} value={formAlumno.telefono} placeholder="809-000-0000"
                    onChange={e => setFormAlumno({ ...formAlumno, telefono: e.target.value })} />
                </div>
                <div>
                  <label style={S.label}>Email</label>
                  <input style={S.input} type="email" value={formAlumno.email}
                    onChange={e => setFormAlumno({ ...formAlumno, email: e.target.value })} />
                </div>
                <div>
                  <label style={S.label}>Estado</label>
                  <select style={S.input} value={formAlumno.estado}
                    onChange={e => setFormAlumno({ ...formAlumno, estado: e.target.value })}>
                    {ESTADOS_ALUMNO.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Monto pagado (RD$)</label>
                  <input style={S.input} type="number" min={0} value={formAlumno.monto_pagado}
                    onChange={e => setFormAlumno({ ...formAlumno, monto_pagado: Number(e.target.value) })} />
                </div>
                <div>
                  <label style={S.label}>Fecha de inscripción</label>
                  <input style={S.input} type="date" value={formAlumno.fecha_inscripcion}
                    onChange={e => setFormAlumno({ ...formAlumno, fecha_inscripcion: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={S.label}>Notas</label>
                <textarea style={{ ...S.input, height: 60, resize: "vertical" }} value={formAlumno.notas}
                  onChange={e => setFormAlumno({ ...formAlumno, notas: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button style={{ ...S.btn, ...S.btnGray }} onClick={() => setModalAlumno(false)}>Cancelar</button>
              <button style={{ ...S.btn, ...S.btnBlue, opacity: guardandoAl ? 0.7 : 1 }} onClick={guardarAlumno} disabled={guardandoAl}>
                {guardandoAl ? "Guardando…" : "💾 Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
