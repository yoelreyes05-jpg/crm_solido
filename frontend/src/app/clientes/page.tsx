"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

import { API_URL as API } from "@/config";
import { usePermisos } from "@/lib/usePermisos";
import { auditHeaders } from "@/lib/audit";
import GenerarCodigoPortal from "@/components/GenerarCodigoPortal";

// Consulta exacta al padrón DGII por RNC/cédula. Devuelve null si no existe.
async function dgiiPorRNC(rnc: string) {
  const limpio = (rnc || "").replace(/\D/g, "");
  if (limpio.length < 9) return null;
  try {
    const res = await fetch(`${API}/rnc/${limpio}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Buscador reutilizable del padrón DGII: por RNC (números) o por nombre.
// Al elegir un resultado llama onSelect({ rnc, razon_social, ... }).
function BuscadorDGII({ onSelect }: { onSelect: (d: any) => void }) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortCtrl = useRef<AbortController | null>(null);

  const buscar = (val: string) => {
    setQ(val);
    if (debounce.current) clearTimeout(debounce.current);
    if (val.trim().length < 2) { setResultados([]); setBuscando(false); return; }
    setBuscando(true);
    debounce.current = setTimeout(async () => {
      if (abortCtrl.current) abortCtrl.current.abort();
      abortCtrl.current = new AbortController();
      try {
        const res = await fetch(`${API}/rnc/buscar?q=${encodeURIComponent(val.trim())}`,
          { signal: abortCtrl.current.signal });
        const data = await res.json();
        setResultados(Array.isArray(data) ? data : []);
      } catch (e: any) { if (e.name !== "AbortError") setResultados([]); }
      finally { setBuscando(false); }
    }, 320);
  };

  const elegir = (item: any) => { onSelect(item); setQ(""); setResultados([]); };

  return (
    <div style={{ position: "relative", marginBottom: 10 }}>
      <label style={label}>🔍 Buscar empresa en DGII (RNC o nombre)</label>
      <input value={q} onChange={e => buscar(e.target.value)}
        placeholder="Escribe el RNC o el nombre de la empresa" style={{ ...input, marginBottom: 0 }} />
      {buscando && <p style={{ fontSize: 12, color: "#888", margin: "4px 0 0" }}>Buscando en el padrón DGII…</p>}
      {resultados.length > 0 && (
        <div style={dgiiDrop}>
          {resultados.map((r, i) => (
            <div key={r.rnc + "_" + i} onClick={() => elegir(r)} style={dgiiItem}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{r.razon_social || r.nombre_comercial}</div>
              <div style={{ fontSize: 11, color: "#666" }}>
                RNC: {r.rnc}{r.estado ? " · " + r.estado : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Clientes() {
  const router = useRouter();
  const { usuario, puedeCrear, puedeEditar, puedeEliminar } = usePermisos("clientes");
  const [clientes, setClientes] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [nuevo, setNuevo] = useState({
    nombre: "", telefono: "", email: "",
    tipo_cliente: "INDIVIDUAL", rnc: "", razon_social: "", contacto_nombre: "", contacto_telefono: "",
  });

  // Membresía al crear cliente
  const [planes, setPlanes] = useState<any[]>([]);
  const [esMiembro, setEsMiembro] = useState(false);
  const [membForm, setMembForm] = useState({ plan_id: "", ciclo: "MENSUAL", metodo_pago: "EFECTIVO" });

  // Modal de edición
  const [editando, setEditando] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    nombre: "", telefono: "", email: "",
    tipo_cliente: "INDIVIDUAL", rnc: "", razon_social: "", contacto_nombre: "", contacto_telefono: "",
  });
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
    setNuevo({ nombre: "", telefono: "", email: "",
      tipo_cliente: "INDIVIDUAL", rnc: "", razon_social: "", contacto_nombre: "", contacto_telefono: "" });
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
    setEditForm({
      nombre: c.nombre || "", telefono: c.telefono || "", email: c.email || "",
      tipo_cliente: c.tipo_cliente || "INDIVIDUAL",
      rnc: c.rnc || "", razon_social: c.razon_social || "",
      contacto_nombre: c.contacto_nombre || "", contacto_telefono: c.contacto_telefono || "",
    });
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

          {/* TIPO DE CLIENTE */}
          <label style={label}>Tipo de cliente</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {[["INDIVIDUAL", "👤 Individual"], ["EMPRESA", "🏢 Empresa / Flotilla"]].map(([val, txt]) => (
              <button key={val} type="button"
                onClick={() => setNuevo({ ...nuevo, tipo_cliente: val })}
                style={tipoBtn(nuevo.tipo_cliente === val)}>
                {txt}
              </button>
            ))}
          </div>

          <label style={label}>{nuevo.tipo_cliente === "EMPRESA" ? "Nombre de la empresa *" : "Nombre *"}</label>
          <input placeholder={nuevo.tipo_cliente === "EMPRESA" ? "Ej. Transporte XYZ SRL" : "Nombre completo"} value={nuevo.nombre}
            onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} style={input} />

          {nuevo.tipo_cliente === "EMPRESA" && (
            <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 10px" }}>
                🚚 Todos los vehículos de la flotilla se registran bajo esta empresa desde su Ficha 360.
              </p>
              <BuscadorDGII onSelect={(d) => setNuevo(n => ({
                ...n,
                rnc: d.rnc || n.rnc,
                razon_social: d.razon_social || n.razon_social,
                nombre: n.nombre || d.razon_social || d.nombre_comercial || "",
              }))} />
              <label style={label}>RNC</label>
              <input placeholder="1-31-00000-0" value={nuevo.rnc}
                onChange={e => setNuevo({ ...nuevo, rnc: e.target.value })}
                onBlur={async () => {
                  const d = await dgiiPorRNC(nuevo.rnc);
                  if (d?.razon_social) setNuevo(n => ({ ...n, razon_social: d.razon_social, nombre: n.nombre || d.razon_social }));
                }}
                style={input} />
              <label style={label}>Razón social</label>
              <input placeholder="Razón social (para factura)" value={nuevo.razon_social}
                onChange={e => setNuevo({ ...nuevo, razon_social: e.target.value })} style={input} />
              <label style={label}>Persona de contacto</label>
              <input placeholder="Nombre de quien autoriza" value={nuevo.contacto_nombre}
                onChange={e => setNuevo({ ...nuevo, contacto_nombre: e.target.value })} style={input} />
              <label style={label}>Teléfono de contacto</label>
              <input placeholder="809-000-0000" value={nuevo.contacto_telefono}
                onChange={e => setNuevo({ ...nuevo, contacto_telefono: e.target.value })} style={{ ...input, marginBottom: 0 }} />
            </div>
          )}

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
                    <td style={{ ...td, fontWeight: 600 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span>{c.nombre}</span>
                        {c.tipo_cliente === "EMPRESA" && (
                          <span style={{ background: "#e0e7ff", color: "#3730a3", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                            🏢 Empresa
                          </span>
                        )}
                      </div>
                      {c.tipo_cliente === "EMPRESA" && c.rnc && (
                        <div style={{ fontSize: 11, color: "#888", fontWeight: 400, marginTop: 2 }}>RNC: {c.rnc}</div>
                      )}
                    </td>
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
                        {/* Código para que el cliente entre al portal desde su
                            celular. Es la vía para quien no tiene teléfono ni
                            correo en ficha y no puede usar los otros métodos. */}
                        <GenerarCodigoPortal
                          clienteId={c.id}
                          clienteNombre={c.nombre}
                          telefono={c.telefono}
                          estiloBoton={btnAccion("#0ea5e9")}
                          etiqueta="Portal"
                        />
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

            <label style={label}>Tipo de cliente</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {[["INDIVIDUAL", "👤 Individual"], ["EMPRESA", "🏢 Empresa / Flotilla"]].map(([val, txt]) => (
                <button key={val} type="button"
                  onClick={() => setEditForm({ ...editForm, tipo_cliente: val })}
                  style={tipoBtn(editForm.tipo_cliente === val)}>
                  {txt}
                </button>
              ))}
            </div>

            <label style={label}>{editForm.tipo_cliente === "EMPRESA" ? "Nombre de la empresa *" : "Nombre *"}</label>
            <input
              value={editForm.nombre}
              onChange={e => setEditForm({ ...editForm, nombre: e.target.value })}
              style={input}
              placeholder={editForm.tipo_cliente === "EMPRESA" ? "Ej. Transporte XYZ SRL" : "Nombre completo"}
            />

            {editForm.tipo_cliente === "EMPRESA" && (
              <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 12 }}>
                <BuscadorDGII onSelect={(d) => setEditForm(f => ({
                  ...f,
                  rnc: d.rnc || f.rnc,
                  razon_social: d.razon_social || f.razon_social,
                  nombre: f.nombre || d.razon_social || d.nombre_comercial || "",
                }))} />
                <label style={label}>RNC</label>
                <input value={editForm.rnc}
                  onChange={e => setEditForm({ ...editForm, rnc: e.target.value })}
                  onBlur={async () => {
                    const d = await dgiiPorRNC(editForm.rnc);
                    if (d?.razon_social) setEditForm(f => ({ ...f, razon_social: d.razon_social, nombre: f.nombre || d.razon_social }));
                  }}
                  style={input} placeholder="1-31-00000-0" />
                <label style={label}>Razón social</label>
                <input value={editForm.razon_social}
                  onChange={e => setEditForm({ ...editForm, razon_social: e.target.value })}
                  style={input} placeholder="Razón social (para factura)" />
                <label style={label}>Persona de contacto</label>
                <input value={editForm.contacto_nombre}
                  onChange={e => setEditForm({ ...editForm, contacto_nombre: e.target.value })}
                  style={input} placeholder="Nombre de quien autoriza" />
                <label style={label}>Teléfono de contacto</label>
                <input value={editForm.contacto_telefono}
                  onChange={e => setEditForm({ ...editForm, contacto_telefono: e.target.value })}
                  style={{ ...input, marginBottom: 0 }} placeholder="809-000-0000" />
              </div>
            )}

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
const tipoBtn = (activo: boolean): any => ({ flex: 1, padding: "10px 8px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, border: activo ? "2px solid #111827" : "1px solid #ddd", background: activo ? "#111827" : "#fff", color: activo ? "#fff" : "#374151" });
const dgiiDrop: any = { position: "absolute", left: 0, right: 0, top: "100%", zIndex: 50, background: "#fff", border: "1px solid #ddd", borderRadius: 8, marginTop: 4, maxHeight: 240, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" };
const dgiiItem: any = { padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" };
const btnAccion = (bg: string): any => ({ padding: "5px 10px", background: bg, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" });
const table: any = { width: "100%", borderCollapse: "collapse" };
const th: any = { textAlign: "left", padding: "10px 12px", background: "#f1f5f9", fontSize: 13 };
const td: any = { padding: "10px 12px", borderBottom: "1px solid #eee", fontSize: 14 };
const overlay: any = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" };
const modal: any = { background: "#fff", borderRadius: 16, padding: 30, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" };
