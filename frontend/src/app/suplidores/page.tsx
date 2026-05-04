"use client";
import { useState, useEffect, useCallback } from "react";
import { API_URL as API } from "@/config";

type Suplidor = {
  id: number;
  name: string;
  rnc?: string;
  direccion?: string;
  telefono?: string;
  correo?: string;
};

const vacioForm = { name: "", rnc: "", direccion: "", telefono: "", correo: "" };

export default function SuplidoresPage() {
  const [suppliers, setSuppliers] = useState<Suplidor[]>([]);
  const [loading, setLoading]     = useState(true);
  const [form, setForm]           = useState({ ...vacioForm });
  const [editando, setEditando]   = useState<Suplidor | null>(null);
  const [saving, setSaving]       = useState(false);
  const [busqueda, setBusqueda]   = useState("");

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

  const iniciarEdicion = (s: Suplidor) => {
    setEditando(s);
    setForm({ name: s.name, rnc: s.rnc || "", direccion: s.direccion || "", telefono: s.telefono || "", correo: s.correo || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelarEdicion = () => {
    setEditando(null);
    setForm({ ...vacioForm });
  };

  const eliminar = async (s: Suplidor) => {
    if (!confirm(`¿Eliminar el suplidor "${s.name}"?\nEsta acción no se puede deshacer.`)) return;
    await fetch(`${API}/suplidores/${s.id}`, { method: "DELETE" });
    cargar();
  };

  const filtrados = suppliers.filter(s =>
    !busqueda ||
    s.name?.toLowerCase().includes(busqueda.toLowerCase()) ||
    s.rnc?.toLowerCase().includes(busqueda.toLowerCase()) ||
    s.telefono?.toLowerCase().includes(busqueda.toLowerCase()) ||
    s.correo?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={s.page}>
      <h1 style={s.title}>📦 Suplidores</h1>

      <div style={s.grid}>
        {/* ── FORMULARIO ── */}
        <div style={s.card}>
          <h2 style={s.cardTitle}>
            {editando ? `✏️ Editando: ${editando.name}` : "➕ Nuevo Suplidor"}
          </h2>

          <label style={s.label}>Nombre *</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Nombre del suplidor" style={s.input} />

          <label style={s.label}>RNC / Cédula</label>
          <input value={form.rnc} onChange={e => setForm(f => ({ ...f, rnc: e.target.value }))}
            placeholder="Ej: 1-01-XXXXX-X" style={s.input} />

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
        </div>

        {/* ── LISTA ── */}
        <div style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ ...s.cardTitle, marginBottom: 0 }}>📋 Lista de Suplidores ({filtrados.length})</h2>
            <input placeholder="Buscar..." value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ ...s.input, width: 200, marginBottom: 0, fontSize: 13 }} />
          </div>

          {loading ? (
            <p style={s.empty}>Cargando...</p>
          ) : filtrados.length === 0 ? (
            <p style={s.empty}>Sin suplidores registrados.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {["#", "Nombre", "RNC", "Teléfono", "Correo", "Dirección", "Acciones"].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(sup => (
                    <tr key={sup.id} style={{ background: editando?.id === sup.id ? "#eff6ff" : "transparent" }}>
                      <td style={s.td}>#{sup.id}</td>
                      <td style={{ ...s.td, fontWeight: 700 }}>{sup.name}</td>
                      <td style={{ ...s.td, fontFamily: "monospace", fontSize: 12 }}>{sup.rnc || "—"}</td>
                      <td style={s.td}>{sup.telefono || "—"}</td>
                      <td style={{ ...s.td, fontSize: 12 }}>{sup.correo || "—"}</td>
                      <td style={{ ...s.td, maxWidth: 180, fontSize: 12 }}>{sup.direccion || "—"}</td>
                      <td style={s.td}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => iniciarEdicion(sup)}
                            style={{ padding: "6px 12px", background: "#dbeafe", color: "#1d4ed8", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                            ✏️ Editar
                          </button>
                          <button onClick={() => eliminar(sup)}
                            style={{ padding: "6px 12px", background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                            🗑️ Borrar
                          </button>
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
  table:     { width: "100%", borderCollapse: "collapse" as const } as React.CSSProperties,
  th:        { textAlign: "left" as const, padding: "10px 12px", background: "#f1f5f9", fontSize: 13, fontWeight: 700 as const } as React.CSSProperties,
  td:        { padding: "10px 12px", borderBottom: "1px solid #eee", fontSize: 14 } as React.CSSProperties,
  empty:     { color: "#aaa", padding: "16px 0", textAlign: "center" as const } as React.CSSProperties,
};
