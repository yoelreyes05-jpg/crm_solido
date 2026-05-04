"use client";
import { useEffect, useState } from "react";

import { API_URL as API } from "@/config";

const ROLES = [
  { value: "gerente",    label: "👑 Gerente",           desc: "Acceso total al sistema" },
  { value: "secretaria", label: "💼 Secretaria",         desc: "Clientes, Vehículos, Órdenes, Facturación, inteligencia, mantenimiento, contabilidad" },
  { value: "tecnico",    label: "🔧 Técnico",            desc: "Órdenes de trabajo y Diagnósticos" },
  { value: "almacen",    label: "📦 Almacén",            desc: "Inventario, Suplidores, Ventas" },
  { value: "cafeteria",  label: "☕ Cafetería",          desc: "Solo módulo de Cafetería" },
];

const PERMISOS = {
  gerente:    ["Dashboard", "Clientes", "Vehículos", "Órdenes", "Diagnósticos", "Inventario", "Suplidores", "Ventas", "Facturación", "Contabilidad", "Cafetería", "inteligencia", "Usuarios"],
  secretaria: ["Dashboard", "Clientes", "Vehículos", "Diagnostico", "Órdenes", "Contabilidad", "Suplidores",  "mantenimiento", "inteligencia", "Facturación"],
  tecnico:    ["Órdenes", "Diagnósticos"],
  almacen:    ["Inventario", "Suplidores", "Ventas"],
  cafeteria:  ["Cafetería"],
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nombre: "", email: "", password_hash: "", rol: "secretaria" });
  const [editando, setEditando] = useState(null);
  const [tab, setTab] = useState("lista");

  const fetchUsuarios = async () => {
    try {
      const res = await fetch(`${API}/usuarios`);
      const data = await res.json();
      setUsuarios(Array.isArray(data) ? data : []);
    } catch { setUsuarios([]); }
    setLoading(false);
  };

  useEffect(() => { fetchUsuarios(); }, []);

  const crearUsuario = async () => {
    if (!form.nombre || !form.email || !form.password_hash) return alert("Completa todos los campos");
    try {
      const res = await fetch(`${API}/usuarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.error) return alert(data.error);
      alert(`✅ Usuario "${form.nombre}" creado correctamente`);
      setForm({ nombre: "", email: "", password_hash: "", rol: "secretaria" });
      setTab("lista");
      fetchUsuarios();
    } catch { alert("Error al crear usuario"); }
  };

  const toggleActivo = async (usuario) => {
    try {
      await fetch(`${API}/usuarios/${usuario.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !usuario.activo })
      });
      fetchUsuarios();
    } catch { alert("Error al actualizar"); }
  };

  const cambiarRol = async (id, rol) => {
    try {
      await fetch(`${API}/usuarios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rol })
      });
      fetchUsuarios();
    } catch { alert("Error al cambiar rol"); }
  };

  const cambiarPassword = async (id) => {
    const nueva = prompt("Nueva contraseña:");
    if (!nueva || nueva.length < 4) return alert("Contraseña muy corta");
    try {
      await fetch(`${API}/usuarios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password_hash: nueva })
      });
      alert("✅ Contraseña actualizada");
    } catch { alert("Error"); }
  };

  const eliminarUsuario = async (id, nombre) => {
    if (!confirm(`¿Eliminar al usuario "${nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await fetch(`${API}/usuarios/${id}`, { method: "DELETE" });
      fetchUsuarios();
    } catch { alert("Error al eliminar"); }
  };

  const rolInfo = (rol) => ROLES.find(r => r.value === rol);

  return (
    <div style={container}>
      <h1 style={title}>👥 Gestión de Usuarios</h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {["lista", "nuevo", "permisos"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...tabBtn, background: tab === t ? "#111827" : "#fff", color: tab === t ? "#fff" : "#111" }}>
            {t === "lista" ? `📋 Usuarios (${usuarios.length})` : t === "nuevo" ? "➕ Nuevo Usuario" : "🔐 Tabla de Permisos"}
          </button>
        ))}
      </div>

      {/* ====== LISTA ====== */}
      {tab === "lista" && (
        <div style={card}>
          {loading ? <p>Cargando...</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead>
                  <tr>
                    {["Nombre", "Email", "Rol", "Acceso a", "Estado", "Acciones"].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(u => {
                    const info = rolInfo(u.rol);
                    return (
                      <tr key={u.id} style={{ opacity: u.activo ? 1 : 0.5 }}>
                        <td style={{ ...td, fontWeight: 700 }}>{u.nombre}</td>
                        <td style={{ ...td, fontSize: 12 }}>{u.email}</td>
                        <td style={td}>
                          <select value={u.rol} onChange={e => cambiarRol(u.id, e.target.value)}
                            style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13, cursor: "pointer" }}>
                            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        </td>
                        <td style={td}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {(PERMISOS[u.rol] || []).map(p => (
                              <span key={p} style={{ background: "#f1f5f9", color: "#475569", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{p}</span>
                            ))}
                          </div>
                        </td>
                        <td style={td}>
                          <button onClick={() => toggleActivo(u)}
                            style={{ padding: "4px 12px", background: u.activo ? "#dcfce7" : "#fee2e2", color: u.activo ? "#16a34a" : "#dc2626", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                            {u.activo ? "✅ Activo" : "❌ Inactivo"}
                          </button>
                        </td>
                        <td style={td}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => cambiarPassword(u.id)}
                              style={btnAcc("#f59e0b")} title="Cambiar contraseña">🔑</button>
                            <button onClick={() => eliminarUsuario(u.id, u.nombre)}
                              style={btnAcc("#dc2626")} title="Eliminar">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ====== NUEVO USUARIO ====== */}
      {tab === "nuevo" && (
        <div style={{ maxWidth: 520 }}>
          <div style={card}>
            <h2 style={cardTitle}>➕ Crear Nuevo Usuario</h2>

            <label style={label}>Nombre completo *</label>
            <input placeholder="Ej: María García" value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })} style={input} />

            <label style={label}>Correo electrónico *</label>
            <input type="email" placeholder="usuario@solidoauto.com" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} style={input} />

            <label style={label}>Contraseña *</label>
            <input type="password" placeholder="Mínimo 4 caracteres" value={form.password_hash}
              onChange={e => setForm({ ...form, password_hash: e.target.value })} style={input} />

            <label style={label}>Rol / Cargo *</label>
            <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })} style={input}>
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
              ))}
            </select>

            {/* Preview de permisos */}
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 8 }}>
                🔐 Este usuario tendrá acceso a:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(PERMISOS[form.rol] || []).map(p => (
                  <span key={p} style={{ background: "#111827", color: "#fff", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{p}</span>
                ))}
              </div>
            </div>

            <button onClick={crearUsuario} style={btnPrimary}>✅ Crear Usuario</button>
          </div>
        </div>
      )}

      {/* ====== TABLA DE PERMISOS ====== */}
      {tab === "permisos" && (
        <div style={card}>
          <h2 style={cardTitle}>🔐 Tabla de Permisos por Rol</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Módulo</th>
                  {ROLES.map(r => <th key={r.value} style={th}>{r.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {["Dashboard","Clientes","Vehículos","Órdenes","Diagnósticos","Inventario","Mantenimiento", "Inteligencia", "Suplidores","Ventas","Facturación","Cafetería","Usuarios"].map(modulo => (
                  <tr key={modulo}>
                    <td style={{ ...td, fontWeight: 600 }}>{modulo}</td>
                    {ROLES.map(r => (
                      <td key={r.value} style={{ ...td, textAlign: "center" }}>
                        {PERMISOS[r.value]?.includes(modulo)
                          ? <span style={{ color: "#16a34a", fontSize: 18 }}>✅</span>
                          : <span style={{ color: "#e2e8f0", fontSize: 18 }}>—</span>
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const container: React.CSSProperties = { padding: "20px", background: "#f5f7fb", minHeight: "100vh" };
const title: React.CSSProperties = { fontSize: 28, fontWeight: "bold", marginBottom: 20 };
const card: React.CSSProperties = { background: "#fff", padding: 20, borderRadius: 15, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" };
const cardTitle: React.CSSProperties = { marginBottom: 14, fontSize: 18, fontWeight: 600 };
const tabBtn: React.CSSProperties = { padding: "10px 18px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", fontWeight: 600, fontSize: 13 };
const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#555" };
const input: React.CSSProperties = { display: "block", marginBottom: 12, padding: 12, width: "100%", borderRadius: 8, border: "1px solid #ddd", boxSizing: "border-box", fontSize: 14 };
const btnPrimary: React.CSSProperties = { padding: 13, background: "#111827", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", width: "100%", fontWeight: 700, fontSize: 14 };
const btnAcc = (bg) => ({ padding: "5px 10px", background: bg, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 });
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", background: "#f8fafc", fontSize: 13, fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #eee", fontSize: 13 };