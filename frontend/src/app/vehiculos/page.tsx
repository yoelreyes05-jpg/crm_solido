"use client";
import { useEffect, useState } from "react";

import { API_URL as API } from "@/config";

export default function Vehiculos() {
  const [clientes, setClientes] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [catalogo, setCatalogo] = useState({});
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const [form, setForm] = useState({
    cliente_id: "", marca: "", modelo: "", ano: "", placa: "", color: ""
  });
  const [editVehiculo, setEditVehiculo] = useState<any>(null);
  const [editForm, setEditForm] = useState({ marca: "", modelo: "", ano: "", placa: "", color: "", cliente_id: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const getClientes = async () => {
    try { const r = await fetch(`${API}/clientes`); setClientes(await r.json()); } catch { setClientes([]); }
  };

  const getVehiculos = async () => {
    try { const r = await fetch(`${API}/vehiculos`); const d = await r.json(); setVehiculos(Array.isArray(d) ? d : []); } catch { setVehiculos([]); }
  };

  const getCatalogo = async () => {
    try { const r = await fetch(`${API}/vehiculos/catalogo`); setCatalogo(await r.json()); } catch { setCatalogo({}); }
  };

  useEffect(() => { getClientes(); getVehiculos(); getCatalogo(); }, []);

  const handleMarcaChange = (marca) => setForm({ ...form, marca, modelo: "" });

  const validar = () => {
    if (!form.cliente_id) return "Selecciona un cliente";
    if (!form.marca) return "Selecciona una marca";
    if (!form.modelo) return "Selecciona un modelo";
    if (!form.ano) return "Selecciona el año";
    if (!form.placa.trim()) return "Ingresa la placa";
    return null;
  };

  const crearVehiculo = async () => {
    const error = validar();
    if (error) return alert(error);
    setLoading(true);
    try {
      const res = await fetch(`${API}/vehiculos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: Number(form.cliente_id),
          marca: form.marca, modelo: form.modelo,
          ano: Number(form.ano),
          placa: form.placa.toUpperCase().trim(),
          color: form.color
        })
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      alert("✅ Vehículo registrado correctamente");
      setForm({ cliente_id: "", marca: "", modelo: "", ano: "", placa: "", color: "" });
      await getVehiculos();
    } catch { alert("Error al guardar"); }
    finally { setLoading(false); }
  };

  const eliminarVehiculo = async (id, info) => {
    if (!confirm(`¿Eliminar el vehículo "${info}"?\n\nEsta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`${API}/vehiculos/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) return alert("Error: " + data.error);
      await getVehiculos();
    } catch { alert("Error al eliminar"); }
  };

  const abrirEdicion = (v: any) => {
    setEditVehiculo(v);
    setEditForm({ marca: v.marca, modelo: v.modelo, ano: String(v.ano), placa: v.placa, color: v.color || "", cliente_id: String(v.cliente_id || "") });
  };

  const guardarEdicion = async () => {
    if (!editVehiculo) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`${API}/vehiculos/${editVehiculo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, ano: Number(editForm.ano), cliente_id: Number(editForm.cliente_id), placa: editForm.placa.toUpperCase().trim() }),
      });
      const data = await res.json();
      if (data.error) return alert("Error: " + data.error);
      setEditVehiculo(null);
      await getVehiculos();
    } catch { alert("Error al actualizar"); }
    setSavingEdit(false);
  };

  const modelosDisponibles = form.marca ? (catalogo[form.marca] || []) : [];

  const vehiculosFiltrados = vehiculos.filter(v =>
    !busqueda ||
    v.cliente_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    v.marca?.toLowerCase().includes(busqueda.toLowerCase()) ||
    v.modelo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    v.placa?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={container}>
      <h1 style={title}>🚗 Vehículos</h1>

      <div style={grid}>
        {/* FORMULARIO */}
        <div style={card}>
          <h2 style={cardTitle}>➕ Registrar Vehículo</h2>

          <label style={label}>Cliente *</label>
          <select value={form.cliente_id}
            onChange={e => setForm({ ...form, cliente_id: e.target.value })} style={input}>
            <option value="">— Seleccionar cliente —</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>

          <label style={label}>Marca *</label>
          <select value={form.marca} onChange={e => handleMarcaChange(e.target.value)} style={input}>
            <option value="">— Seleccionar marca —</option>
            {Object.keys(catalogo).map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <label style={label}>Modelo *</label>
          <select value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })}
            style={input} disabled={!form.marca}>
            <option value="">— Seleccionar modelo —</option>
            {modelosDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          {form.marca === "OTRO" && (
            <input placeholder="Escribe el modelo" value={form.modelo === "Personalizado" ? "" : form.modelo}
              onChange={e => setForm({ ...form, modelo: e.target.value })} style={input} />
          )}

          <label style={label}>Año *</label>
          <select value={form.ano} onChange={e => setForm({ ...form, ano: e.target.value })} style={input}>
            <option value="">— Seleccionar año —</option>
            {Array.from({ length: 36 }, (_, i) => 2025 - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <label style={label}>Placa *</label>
          <input placeholder="Ej: A123456" value={form.placa}
            onChange={e => setForm({ ...form, placa: e.target.value.toUpperCase() })} style={input} />

          <label style={label}>Color</label>
          <input placeholder="Ej: Rojo, Negro, Blanco..." value={form.color}
            onChange={e => setForm({ ...form, color: e.target.value })} style={input} />

          <button onClick={crearVehiculo} disabled={loading} style={btnPrimary}>
            {loading ? "Guardando..." : "💾 Guardar Vehículo"}
          </button>
        </div>

        {/* LISTA */}
        <div style={card}>
          <h2 style={cardTitle}>📋 Lista de Vehículos ({vehiculosFiltrados.length})</h2>

          <input placeholder="Buscar por cliente, marca, modelo o placa..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ ...input, marginBottom: 16 }} />

          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  {["Cliente", "Marca", "Modelo", "Año", "Placa", "Color", ""].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vehiculosFiltrados.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#aaa" }}>Sin vehículos</td></tr>
                ) : vehiculosFiltrados.map(v => (
                  <tr key={v.id}>
                    <td style={{ ...td, fontWeight: 700 }}>{v.cliente_nombre}</td>
                    <td style={td}>{v.marca}</td>
                    <td style={td}>{v.modelo}</td>
                    <td style={td}>{v.ano}</td>
                    <td style={td}>
                      <span style={{ background: "#1e3a5f", color: "#fff", padding: "3px 10px", borderRadius: 6, fontWeight: 800, fontSize: 13, letterSpacing: 1 }}>
                        {v.placa}
                      </span>
                    </td>
                    <td style={td}>{v.color || "—"}</td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => abrirEdicion(v)}
                          style={{ padding: "6px 12px", background: "#dbeafe", color: "#1d4ed8", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                          ✏️ Editar
                        </button>
                        <button onClick={() => eliminarVehiculo(v.id, `${v.marca} ${v.modelo} (${v.placa})`)}
                          style={{ padding: "6px 12px", background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                          🗑️ Borrar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── MODAL EDITAR VEHÍCULO ── */}
      {editVehiculo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 480, maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 18 }}>✏️ Editar: {editVehiculo.marca} {editVehiculo.modelo} — {editVehiculo.placa}</h3>

            <label style={label}>Cliente</label>
            <select value={editForm.cliente_id} onChange={e => setEditForm(f => ({ ...f, cliente_id: e.target.value }))} style={input}>
              <option value="">— Sin cliente —</option>
              {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>

            <label style={label}>Marca</label>
            <select value={editForm.marca} onChange={e => setEditForm(f => ({ ...f, marca: e.target.value, modelo: "" }))} style={input}>
              <option value="">— Seleccionar —</option>
              {Object.keys(catalogo).map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            <label style={label}>Modelo</label>
            <select value={editForm.modelo} onChange={e => setEditForm(f => ({ ...f, modelo: e.target.value }))} style={input}
              disabled={!editForm.marca}>
              <option value="">— Seleccionar —</option>
              {(catalogo[editForm.marca] || []).map((m: string) => <option key={m} value={m}>{m}</option>)}
            </select>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={label}>Año</label>
                <select value={editForm.ano} onChange={e => setEditForm(f => ({ ...f, ano: e.target.value }))} style={{ ...input, marginBottom: 0 }}>
                  {Array.from({ length: 36 }, (_, i) => 2025 - i).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Color</label>
                <input value={editForm.color} onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))} style={{ ...input, marginBottom: 0 }} placeholder="Color" />
              </div>
            </div>

            <label style={{ ...label, marginTop: 12 }}>Placa</label>
            <input value={editForm.placa} onChange={e => setEditForm(f => ({ ...f, placa: e.target.value.toUpperCase() }))} style={input} />

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={guardarEdicion} disabled={savingEdit}
                style={{ ...btnPrimary, flex: 2, background: "#2563eb" }}>
                {savingEdit ? "Guardando..." : "💾 Guardar cambios"}
              </button>
              <button onClick={() => setEditVehiculo(null)}
                style={{ ...btnPrimary, flex: 1, background: "#6b7280" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const container: React.CSSProperties = { padding: "24px", background: "#f5f7fb", minHeight: "100vh" };
const title: React.CSSProperties = { fontSize: 28, fontWeight: "bold", marginBottom: 22 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px" };
const card: React.CSSProperties = { background: "#fff", padding: "22px", borderRadius: "15px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" };
const cardTitle: React.CSSProperties = { marginBottom: "16px", fontSize: 19, fontWeight: 700 };
const label: React.CSSProperties = { display: "block", fontSize: 14, fontWeight: 600, marginBottom: 5, color: "#444" };
const input: React.CSSProperties = { display: "block", marginBottom: "14px", padding: "13px", width: "100%", borderRadius: "8px", border: "1px solid #ddd", boxSizing: "border-box", fontSize: 15 };
const btnPrimary: React.CSSProperties = { padding: "14px", background: "#111827", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", width: "100%", fontWeight: 700, fontSize: 15 };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const th: React.CSSProperties = { textAlign: "left", padding: "12px 14px", background: "#f1f5f9", fontSize: 14, fontWeight: 700 };
const td: React.CSSProperties = { padding: "12px 14px", borderBottom: "1px solid #eee", fontSize: 14 };