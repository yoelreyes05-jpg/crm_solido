"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { API_URL as API } from "@/config";
import { usePermisos } from "@/lib/usePermisos";

type Suplidor = {
  id: number;
  name: string;
  rnc?: string;
  direccion?: string;
  telefono?: string;
  correo?: string;
  tipo_servicio?: string;
};

const TIPOS_SERVICIO = [
  { value: "",             label: "— Sin clasificar —" },
  { value: "repuestos",    label: "🔩 Repuestos y Autopartes" },
  { value: "lubricantes",  label: "🛢️ Lubricantes y Aceites" },
  { value: "neumaticos",   label: "🛞 Neumáticos y Llantas" },
  { value: "herramientas", label: "🔧 Herramientas y Equipos" },
  { value: "carroceria",   label: "🎨 Carrocería y Pintura" },
  { value: "electrico",    label: "⚡ Eléctrico y Electrónico" },
  { value: "limpieza",     label: "🧴 Limpieza y Detailing" },
  { value: "varios",       label: "📦 Servicios Varios" },
];

const TIPO_LABEL: Record<string, string> = Object.fromEntries(
  TIPOS_SERVICIO.filter(t => t.value).map(t => [t.value, t.label])
);

const TIPO_COLOR: Record<string, string> = {
  repuestos:    "#6366f1",
  lubricantes:  "#f59e0b",
  neumaticos:   "#64748b",
  herramientas: "#0ea5e9",
  carroceria:   "#ec4899",
  electrico:    "#eab308",
  limpieza:     "#10b981",
  varios:       "#94a3b8",
};

const vacioForm = { name: "", rnc: "", direccion: "", telefono: "", correo: "", tipo_servicio: "" };

export default function SuplidoresPage() {
  const { puedeCrear, puedeEditar, puedeEliminar } = usePermisos("suplidores");
  const [suppliers, setSuppliers] = useState<Suplidor[]>([]);
  const [loading, setLoading]     = useState(true);
  const [form, setForm]           = useState({ ...vacioForm });
  const [editando, setEditando]   = useState<Suplidor | null>(null);
  const [saving, setSaving]       = useState(false);
  const [busqueda, setBusqueda]   = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [buscandoRNC, setBuscandoRNC]           = useState(false);
  const [rncEstado, setRncEstado]               = useState<"ok" | "notfound" | "">("");
  const [busqNombre, setBusqNombre]             = useState("");
  const [resultadosNombre, setResultadosNombre] = useState<any[]>([]);
  const [buscandoNombre, setBuscandoNombre]     = useState(false);
  const nombreDebounce  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nombreAbortCtrl = useRef<AbortController | null>(null);

  const consultarRNC = async (rnc: string) => {
    const limpio = rnc.replace(/\D/g, "");
    if (limpio.length < 9) return;
    setBuscandoRNC(true);
    setRncEstado("");
    try {
      const res  = await fetch(`${API}/rnc/${limpio}`);
      const data = await res.json();
      if (res.ok && data?.razon_social) {
        setForm(f => ({ ...f, name: data.razon_social }));
        setRncEstado("ok");
      } else {
        setRncEstado("notfound");
      }
    } catch { setRncEstado("notfound"); }
    finally { setBuscandoRNC(false); }
  };

  const buscarPorNombre = (q: string) => {
    setBusqNombre(q);
    if (nombreDebounce.current) clearTimeout(nombreDebounce.current);
    if (q.length < 2) { setResultadosNombre([]); setBuscandoNombre(false); return; }

    setBuscandoNombre(true);
    nombreDebounce.current = setTimeout(async () => {
      if (nombreAbortCtrl.current) nombreAbortCtrl.current.abort();
      nombreAbortCtrl.current = new AbortController();
      try {
        const res  = await fetch(`${API}/rnc/buscar?q=${encodeURIComponent(q)}`,
          { signal: nombreAbortCtrl.current.signal });
        const data = await res.json();
        setResultadosNombre(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (e.name !== "AbortError") setResultadosNombre([]);
      } finally {
        setBuscandoNombre(false);
      }
    }, 320);
  };

  const seleccionarDeNombre = (item: any) => {
    setForm(f => ({ ...f, rnc: item.rnc, name: item.razon_social }));
    setBusqNombre("");
    setResultadosNombre([]);
    setRncEstado("ok");
  };

  const cargar = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/suplidores`);
      const data = await res.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch { setSuppliers([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    if (!form.name.trim()) return alert("Nombre requerido");
    setSaving(true);
    try {
      if (editando) {
        await fetch(`${API}/suplidores/${editando.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        setEditando(null);
      } else {
        await fetch(`${API}/suplidores`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      setForm({ ...vacioForm });
      cargar();
    } catch { alert("Error al guardar"); }
    setSaving(false);
  };

  const iniciarEdicion = (sup: Suplidor) => {
    setEditando(sup);
    setForm({
      name:          sup.name,
      rnc:           sup.rnc           || "",
      direccion:     sup.direccion     || "",
      telefono:      sup.telefono      || "",
      correo:        sup.correo        || "",
      tipo_servicio: sup.tipo_servicio || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelarEdicion = () => {
    setEditando(null);
    setForm({ ...vacioForm });
  };

  const eliminar = async (sup: Suplidor) => {
    if (!confirm(`¿Eliminar el suplidor "${sup.name}"?\nEsta acción no se puede deshacer.`)) return;
    await fetch(`${API}/suplidores/${sup.id}`, { method: "DELETE" });
    cargar();
  };

  const filtrados = suppliers.filter(sup => {
    const q = busqueda.toLowerCase();
    const matchTexto = !q ||
      sup.name?.toLowerCase().includes(q) ||
      sup.rnc?.toLowerCase().includes(q) ||
      sup.telefono?.toLowerCase().includes(q) ||
      sup.correo?.toLowerCase().includes(q);
    const matchTipo = !filtroTipo || sup.tipo_servicio === filtroTipo;
    return matchTexto && matchTipo;
  });

  // Conteo por tipo para los badges del filtro
  const conteoTipos = TIPOS_SERVICIO.filter(t => t.value).map(t => ({
    ...t,
    count: suppliers.filter(s => s.tipo_servicio === t.value).length,
  })).filter(t => t.count > 0);

  return (
    <div style={s.page}>
      <h1 style={s.title}>📦 Suplidores</h1>

      <div style={s.grid}>
        {/* ── FORMULARIO — visible si puede crear o editar ── */}
        {(puedeCrear || puedeEditar) && <div style={s.card}>
          <h2 style={s.cardTitle}>
            {editando ? `✏️ Editando: ${editando.name}` : "➕ Nuevo Suplidor"}
          </h2>

          {/* ── Buscar en DGII por nombre ── */}
          <label style={s.label}>🔎 Buscar en padrón DGII por nombre</label>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <input
              value={busqNombre}
              onChange={e => buscarPorNombre(e.target.value)}
              placeholder="Escribe el nombre de la empresa o persona…"
              style={{ ...s.input, marginBottom: 0, paddingRight: buscandoNombre ? 36 : undefined }}
            />
            {buscandoNombre && (
              <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>⏳</span>
            )}
            {resultadosNombre.length > 0 && (
              <div style={{
                position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, zIndex: 100,
                background: "#1e293b", border: "1px solid #334155", borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,.4)", maxHeight: 260, overflowY: "auto",
              }}>
                {resultadosNombre.map((r, i) => (
                  <div key={i} onClick={() => seleccionarDeNombre(r)}
                    style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #334155", transition: "background .15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#2563eb22")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#f1f5f9" }}>{r.razon_social}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      RNC: {r.rnc}
                      {r.nombre_comercial && ` · ${r.nombre_comercial}`}
                      <span style={{
                        marginLeft: 8, padding: "1px 6px", borderRadius: 4, fontSize: 10,
                        background: r.estado === "ACTIVO" ? "#16a34a33" : "#dc262633",
                        color: r.estado === "ACTIVO" ? "#4ade80" : "#f87171",
                      }}>{r.estado}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {busqNombre.length >= 3 && !buscandoNombre && resultadosNombre.length === 0 && (
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Sin resultados para "{busqNombre}"</p>
            )}
          </div>

          <label style={s.label}>Nombre *</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Nombre del suplidor" style={s.input} />

          <label style={s.label}>RNC / Cédula</label>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              value={form.rnc}
              onChange={e => { setForm(f => ({ ...f, rnc: e.target.value })); setRncEstado(""); }}
              onBlur={e => consultarRNC(e.target.value)}
              placeholder="Ej: 101XXXXX o 000XXXXXXX"
              style={{ ...s.input, flex: 1, marginBottom: 0 }}
            />
            <button type="button" onClick={() => consultarRNC(form.rnc)}
              disabled={buscandoRNC || form.rnc.replace(/\D/g,"").length < 9}
              style={{ padding: "8px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                background: rncEstado === "ok" ? "#16a34a" : rncEstado === "notfound" ? "#dc2626" : "#2563eb",
                color: "#fff", fontSize: 13, whiteSpace: "nowrap", opacity: buscandoRNC ? 0.7 : 1 }}>
              {buscandoRNC ? "⏳" : rncEstado === "ok" ? "✅ Encontrado" : rncEstado === "notfound" ? "❌ No hallado" : "🔍 Consultar DGII"}
            </button>
          </div>
          {rncEstado === "notfound" && (
            <p style={{ fontSize: 11, color: "#ef4444", marginTop: 3 }}>RNC no encontrado en el padrón DGII. Puede escribir el nombre manualmente.</p>
          )}

          {/* ── TIPO DE SERVICIO (NUEVO) ── */}
          <label style={{ ...s.label, marginTop: 12 }}>Tipo de servicio que suple</label>
          <select
            value={form.tipo_servicio}
            onChange={e => setForm(f => ({ ...f, tipo_servicio: e.target.value }))}
            style={{ ...s.input, cursor: "pointer" }}
          >
            {TIPOS_SERVICIO.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <label style={s.label}>Teléfono</label>
          <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
            placeholder="809-000-0000" style={s.input} />

          <label style={s.label}>Correo electrónico</label>
          <input type="email" value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))}
            placeholder="ejemplo@correo.com" style={s.input} />

          <label style={s.label}>Dirección</label>
          <input value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
            placeholder="Av. ..." style={s.input} />

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={guardar} disabled={saving}
              style={{ ...s.btnPrimary, flex: 2, background: editando ? "#2563eb" : "#111827" }}>
              {saving ? "Guardando..." : editando ? "💾 Actualizar Suplidor" : "💾 Guardar Suplidor"}
            </button>
            {editando && (
              <button onClick={cancelarEdicion} style={{ ...s.btnPrimary, flex: 1, background: "#6b7280" }}>
                ✕ Cancelar
              </button>
            )}
          </div>
        </div>}

        {/* ── LISTA ── */}
        <div style={s.card}>
          {/* Cabecera con buscador */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ ...s.cardTitle, marginBottom: 0 }}>📋 Lista de Suplidores ({filtrados.length})</h2>
            <input placeholder="Buscar..." value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ ...s.input, width: 200, marginBottom: 0, fontSize: 13 }} />
          </div>

          {/* Filtros rápidos por tipo */}
          {conteoTipos.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              <button onClick={() => setFiltroTipo("")}
                style={{ ...s.chip, background: !filtroTipo ? "#111827" : "#f1f5f9", color: !filtroTipo ? "#fff" : "#374151" }}>
                Todos ({suppliers.length})
              </button>
              {conteoTipos.map(t => (
                <button key={t.value} onClick={() => setFiltroTipo(filtroTipo === t.value ? "" : t.value)}
                  style={{
                    ...s.chip,
                    background: filtroTipo === t.value ? TIPO_COLOR[t.value] + "22" : "#f1f5f9",
                    color:      filtroTipo === t.value ? TIPO_COLOR[t.value] : "#374151",
                    border:     filtroTipo === t.value ? `1px solid ${TIPO_COLOR[t.value]}` : "1px solid transparent",
                  }}>
                  {t.label} ({t.count})
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <p style={s.empty}>Cargando...</p>
          ) : filtrados.length === 0 ? (
            <p style={s.empty}>Sin suplidores registrados.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {["#", "Nombre", "Tipo de Servicio", "RNC", "Teléfono", "Correo", "Acciones"].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(sup => (
                    <tr key={sup.id} style={{ background: editando?.id === sup.id ? "#eff6ff" : "transparent" }}>
                      <td style={s.td}>#{sup.id}</td>
                      <td style={{ ...s.td, fontWeight: 700 }}>
                        <div>{sup.name}</div>
                        {sup.direccion && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sup.direccion}</div>}
                      </td>
                      <td style={s.td}>
                        {sup.tipo_servicio ? (
                          <span style={{
                            padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                            background: (TIPO_COLOR[sup.tipo_servicio] || "#94a3b8") + "22",
                            color:      TIPO_COLOR[sup.tipo_servicio] || "#94a3b8",
                            whiteSpace: "nowrap",
                          }}>
                            {TIPO_LABEL[sup.tipo_servicio] || sup.tipo_servicio}
                          </span>
                        ) : (
                          <span style={{ color: "#cbd5e1", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ ...s.td, fontFamily: "monospace", fontSize: 12 }}>{sup.rnc || "—"}</td>
                      <td style={s.td}>{sup.telefono || "—"}</td>
                      <td style={{ ...s.td, fontSize: 12 }}>{sup.correo || "—"}</td>
                      <td style={s.td}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {puedeEditar && (
                            <button onClick={() => iniciarEdicion(sup)}
                              style={{ padding: "6px 12px", background: "#dbeafe", color: "#1d4ed8", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                              ✏️ Editar
                            </button>
                          )}
                          {puedeEliminar && (
                            <button onClick={() => eliminar(sup)}
                              style={{ padding: "6px 12px", background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                              🗑️ Borrar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  page:      { padding: "24px", background: "#f5f7fb", minHeight: "100vh" } as React.CSSProperties,
  title:     { fontSize: 28, fontWeight: "bold" as const, marginBottom: 22 } as React.CSSProperties,
  grid:      { display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20 } as React.CSSProperties,
  card:      { background: "#fff", padding: 22, borderRadius: 15, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" } as React.CSSProperties,
  cardTitle: { marginBottom: 16, fontSize: 18, fontWeight: 700 as const } as React.CSSProperties,
  label:     { display: "block", fontSize: 13, fontWeight: 600 as const, marginBottom: 4, color: "#555" } as React.CSSProperties,
  input:     { display: "block", marginBottom: 12, padding: "11px 13px", width: "100%", borderRadius: 8, border: "1px solid #ddd", boxSizing: "border-box" as const, fontSize: 14 } as React.CSSProperties,
  btnPrimary:{ padding: "13px", background: "#111827", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", width: "100%", fontWeight: 700, fontSize: 14 } as React.CSSProperties,
  chip:      { padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, border: "1px solid transparent", cursor: "pointer", whiteSpace: "nowrap" as const } as React.CSSProperties,
  table:     { width: "100%", borderCollapse: "collapse" as const } as React.CSSProperties,
  th:        { textAlign: "left" as const, padding: "10px 12px", background: "#f1f5f9", fontSize: 13, fontWeight: 700 as const } as React.CSSProperties,
  td:        { padding: "10px 12px", borderBottom: "1px solid #eee", fontSize: 14 } as React.CSSProperties,
  empty:     { color: "#aaa", padding: "16px 0", textAlign: "center" as const } as React.CSSProperties,
};
