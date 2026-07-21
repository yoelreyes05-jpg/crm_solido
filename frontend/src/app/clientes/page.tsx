"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { API_URL as API } from "@/config";
import { usePermisos } from "@/lib/usePermisos";
import { auditHeaders } from "@/lib/audit";

export default function Clientes() {
  const router = useRouter();
  const { usuario, puedeCrear, puedeEditar, puedeEliminar } = usePermisos("clientes");
  const [clientes, setClientes] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [nuevo, setNuevo] = useState({ nombre: "", telefono: "", email: "" });

  // Membresía al crear cliente
  const [planes, setPlanes] = useState<any[]>([]);
  const [esMiembro, setEsMiembro] = useState(false);
  const [membForm, setMembForm] = useState({ plan_id: "", ciclo: "MENSUAL", metodo_pago: "EFECTIVO" });

  // Modal de edición
  const [editando, setEditando] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ nombre: "", telefono: "", email: "" });
  const [guardando, setGuardando] = useState(false);

  const obtenerClientes = async () => {
    try {
      const res = await fetch(`${API}/clientes`);
      const data = await res.json();
      setClientes(Array.isArray(data) ? data : []);
    } catch { setClientes([]); }
  };

  const obtenerPlanes = async () => {
    try {
      const res = await fetch(`${API}/planes`);
      const data = await res.json();
      setPlanes(Array.isArray(data) ? data : []);
    } catch { setPlanes([]); }
  };

  useEffect(() => { obtenerClientes(); obtenerPlanes(); }, []);

  const resetForm = () => {
    setNuevo({ nombre: "", telefono: "", email: "" });
    setEsMiembro(false);
    setMembForm({ plan_id: "", ciclo: "MENSUAL", metodo_pago: "EFECTIVO" });
  };

  const crearCliente = async () => {
    if (!nuevo.nombre.trim()) return alert("Nombre requerido");
    if (esMiembro && !membForm.plan_id) return alert("Selecciona un plan de membresía");
    setGuardando(true);
    try {
      const res = await fetch(`${API}/clientes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevo)
      });
      const data = await res.json();
      if (data.error) return alert(data.error);

      // Si es miembro, inscribir en el plan seleccionado (registra pago + caja)
      if (esMiembro && membForm.plan_id && data.id) {
        try {
          const resM = await fetch(`${API}/planes/membresias`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cliente_id: data.id,
              plan_id: Number(membForm.plan_id),
              ciclo: membForm.ciclo,
              metodo_pago: membForm.metodo_pago,
              usuario: usuario?.nombre || "Sistema",
            })
          });
          const dataM = await resM.json();
          if (dataM.error) alert("Cliente creado, pero la membresía no se registró: " + dataM.error);
        } catch { alert("Cliente creado, pero la membresía no se registró (error de conexión)."); }
      }

      resetForm();
      obtenerClientes();
    } catch { alert("Error al guardar"); }
    finally { setGuardando(false); }
  };

  const abrirEditar = (c: any) => {
    setEditando(c);
    setEditForm({ nombre: c.nombre || "", telefono: c.telefono || "", email: c.email || "" });
  };

  const guardarEdicion = async () => {
    if (!editForm.nombre.trim()) return alert("Nombre requerido");
    setGuardando(true);
    try {
      const res = await fetch(`${API}/clientes/${editando.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      });
      const data = await res.json();
      if (data.error) return alert("Error: " + data.error);
      setEditando(null);
      obtenerClientes();
    } catch { alert("Error al guardar cambios"); }
    finally { setGuardando(false); }
  };

  const eliminarCliente = async (id: number, nombre: string) => {
    if (!confirm(`¿Eliminar a "${nombre}"? Se eliminarán también sus vehículos registrados.`)) return;
    try {
      const res = await fetch(`${API}/clientes/${id}`, { method: "DELETE", headers: auditHeaders() });
      const data = await res.json();
      if (data.error) return alert("No se puede eliminar: " + data.error);
      obtenerClientes();
    } catch { alert("Error al eliminar"); }
  };

  const clientesFiltrados = clientes.filter(c =>
    c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.telefono?.includes(busqueda) ||
    c.email?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={container}>
      <h1 style={title}>👤 Clientes</h1>
      <div style={grid}>
        {/* FORMULARIO NUEVO — solo si puede crear */}
        {puedeCrear && <div style={card}>
          <h2 style={cardTitle}>➕ Nuevo Cliente</h2>
          <label style={label}>Nombre *</label>
          <input placeholder="Nombre completo" value={nuevo.nombre}
            onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} style={input} />
          <label style={label}>Teléfono</label>
          <input placeholder="809-000-0000" value={nuevo.telefono}
            onChange={e => setNuevo({ ...nuevo, telefono: e.target.value })} style={input} />
          <label style={label}>Email</label>
          <input placeholder="correo@ejemplo.com" value={nuevo.email}
            onChange={e => setNuevo({ ...nuevo, email: e.target.value })} style={input} />

          {/* MEMBRESÍA */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0 12px", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#374151" }}>
            <input type="checkbox" checked={esMiembro}
              onChange={e => setEsMiembro(e.target.checked)}
              style={{ width: 18, height: 18, cursor: "pointer" }} />
            💳 ¿Desea ser miembro?
          </label>

          {esMiembro && (
            <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <label style={label}>Plan / Membresía *</label>
              {planes.length === 0 ? (
                <p style={{ fontSize: 13, color: "#888", margin: "4px 0 8px" }}>No hay planes disponibles.</p>
              ) : (
                <select value={membForm.plan_id}
                  onChange={e => setMembForm({ ...membForm, plan_id: e.target.value })}
                  style={input}>
                  <option value="">— Selecciona un plan —</option>
                  {planes.map(p => {
                    const precio = membForm.ciclo === "ANUAL" ? p.precio_anual : p.precio_mensual;
                    return (
                      <option key={p.id} value={p.id}>
                        {(p.emoji || "⭐") + " " + p.nombre + " — RD$" + Number(precio || 0).toLocaleString("es-DO") + (membForm.ciclo === "ANUAL" ? "/año" : "/mes")}
                      </option>
                    );
                  })}
                </select>
              )}

              <label style={label}>Ciclo</label>
              <select value={membForm.ciclo}
                onChange={e => setMembForm({ ...membForm, ciclo: e.target.value })}
                style={input}>
                <option value="MENSUAL">📅 Mensual</option>
                <option value="ANUAL">🗓️ Anual</option>
              </select>

              <label style={label}>Método de pago</label>
              <select value={membForm.metodo_pago}
                onChange={e => setMembForm({ ...membForm, metodo_pago: e.target.value })}
                style={{ ...input, marginBottom: 0 }}>
                <option value="EFECTIVO">💵 Efectivo</option>
                <option value="TARJETA">💳 Tarjeta</option>
                <option value="TRANSFERENCIA">🏦 Transferencia</option>
              </select>
            </div>
          )}

          <button onClick={crearCliente} disabled={guardando} style={{ ...btnPrimary, opacity: guardando ? 0.6 : 1 }}>
            {guardando ? "Guardando..." : (esMiembro ? "Guardar Cliente + Membresía" : "Guardar Cliente")}
          </button>
        </div>}

        {/* LISTA */}
        <div style={card}>
          <h2 style={cardTitle}>📋 Lista de Clientes ({clientes.length})</h2>
          <input placeholder="Buscar por nombre, teléfono o email..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ ...input, marginBottom: 14 }} />
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  {["ID", "Nombre", "Teléfono", "Email", "Acciones"].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.length === 0 ? (
                  <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#888" }}>Sin resultados</td></tr>
                ) : clientesFiltrados.map(c => (
                  <tr key={c.id}>
                    <td style={td}>{c.id}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{c.nombre}</td>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span>{c.telefono || "—"}</span>
                        {c.telefono && (
                          <a
                            href={`https://wa.me/${c.telefono.replace(/\D/g,"")}?text=${encodeURIComponent(`Hola ${c.nombre}, le contactamos desde Sólido Auto Servicio. `)}`}
                            target="_blank" rel="noreferrer"
                            style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"3px 8px", background:"#25d366", color:"#fff", borderRadius:6, fontSize:11, fontWeight:700, textDecoration:"none", whiteSpace:"nowrap" }}>
                            💬 WA
                          </a>
                        )}
                      </div>
                    </td>
                    <td style={td}>{c.email || "—"}</td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {puedeEditar && (
                          <button onClick={() => abrirEditar(c)}
                            style={btnAccion("#f59e0b")} title="Editar cliente">
                            ✏️ Editar
                          </button>
                        )}
                        <button onClick={() => router.push(`/clientes/${c.id}/historial`)}
                          style={btnAccion("#3b82f6")} title="Ficha 360 — historial, citas, notas e interacciones">
                          👤 Ficha 360
                        </button>
                        {puedeEliminar && (
                          <button onClick={() => eliminarCliente(c.id, c.nombre)}
                            style={btnAccion("#dc2626")} title="Eliminar">
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL EDITAR CLIENTE — solo si puede editar */}
      {editando && puedeEditar && (
        <div style={overlay} onClick={() => setEditando(null)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, marginBottom: 20, fontSize: 20, fontWeight: 700 }}>
              ✏️ Editar Cliente
            </h2>
            <label style={label}>Nombre *</label>
            <input
              value={editForm.nombre}
              onChange={e => setEditForm({ ...editForm, nombre: e.target.value })}
              style={input}
              placeholder="Nombre completo"
            />
            <label style={label}>Teléfono</label>
            <input
              value={editForm.telefono}
              onChange={e => setEditForm({ ...editForm, telefono: e.target.value })}
              style={input}
              placeholder="809-000-0000"
            />
            <label style={label}>Email</label>
            <input
              value={editForm.email}
              onChange={e => setEditForm({ ...editForm, email: e.target.value })}
              style={input}
              placeholder="correo@ejemplo.com"
            />
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button
                onClick={guardarEdicion}
                disabled={guardando}
                style={{ ...btnPrimary, flex: 1, opacity: guardando ? 0.6 : 1 }}
              >
                {guardando ? "Guardando..." : "💾 Guardar Cambios"}
              </button>
              <button
                onClick={() => setEditando(null)}
                style={{ flex: 1, padding: 13, background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const container: any = { padding: "20px", background: "#f5f7fb", minHeight: "100vh" };
const title: any = { fontSize: 28, fontWeight: "bold", marginBottom: 20 };
const grid: any = { display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20 };
const card: any = { background: "#fff", padding: 20, borderRadius: 15, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" };
const cardTitle: any = { marginBottom: 15, fontSize: 18, fontWeight: 600 };
const label: any = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#555" };
const input: any = { display: "block", marginBottom: 12, padding: 12, width: "100%", borderRadius: 8, border: "1px solid #ddd", boxSizing: "border-box", fontSize: 14 };
const btnPrimary: any = { padding: 13, background: "#111827", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", width: "100%", fontWeight: 700 };
const btnAccion = (bg: string): any => ({ padding: "5px 10px", background: bg, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" });
const table: any = { width: "100%", borderCollapse: "collapse" };
const th: any = { textAlign: "left", padding: "10px 12px", background: "#f1f5f9", fontSize: 13 };
const td: any = { padding: "10px 12px", borderBottom: "1px solid #eee", fontSize: 14 };
const overlay: any = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" };
const modal: any = { background: "#fff", borderRadius: 16, padding: 30, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" };
