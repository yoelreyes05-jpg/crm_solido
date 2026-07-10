"use client";
import React, { useEffect, useState } from "react";

import { API_URL as API } from "@/config";
import { usePermisos } from "@/lib/usePermisos";
import { auditHeaders } from "@/lib/audit";

// ─────────────────────────────────────────────────────────────────────────────
// 💎 PLANES / MEMBRESÍAS — Lavado · Básico · Premium · VIP
// Conectado automático con Car Wash, Facturación, Fidelización y Caja.
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n: any) =>
  "RD$ " + Number(n || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtFecha = (d: string) =>
  d ? new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—";

// Tipos de beneficio que el backend entiende
const BENEFICIO_TIPOS: { tipo: string; label: string; hint: string }[] = [
  { tipo: "lavados_mes",          label: "Lavados por mes",        hint: "-1 = ilimitado, 0 = no incluye" },
  { tipo: "diagnosticos_mes",     label: "Diagnósticos por mes",   hint: "-1 = ilimitado, 0 = no incluye" },
  { tipo: "desc_servicios",       label: "% desc. en servicios",   hint: "0 a 100" },
  { tipo: "desc_repuestos",       label: "% desc. en repuestos",   hint: "0 a 100" },
  { tipo: "multiplicador_puntos", label: "Multiplicador de puntos", hint: "1, 2 o 3" },
  { tipo: "prioridad",            label: "Prioridad en taller",    hint: "1 = sí, 0 = no" },
];

const beneficioLabel = (tipo: string) => BENEFICIO_TIPOS.find(b => b.tipo === tipo)?.label || tipo;
const valorLabel = (tipo: string, valor: number) => {
  if (tipo === "lavados_mes" || tipo === "diagnosticos_mes") return valor < 0 ? "Ilimitados" : String(valor);
  if (tipo === "desc_servicios" || tipo === "desc_repuestos") return `${valor}%`;
  if (tipo === "multiplicador_puntos") return `x${valor}`;
  if (tipo === "prioridad") return valor ? "Sí" : "No";
  return String(valor);
};

const ESTADO_COLOR: Record<string, { bg: string; color: string }> = {
  ACTIVA:    { bg: "#dcfce7", color: "#166534" },
  VENCIDA:   { bg: "#fee2e2", color: "#991b1b" },
  CANCELADA: { bg: "#f3f4f6", color: "#374151" },
};

const S = {
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 20, marginBottom: 16 } as React.CSSProperties,
  input: { display: "block", padding: "10px 12px", width: "100%", borderRadius: 9, border: "1px solid #e2e8f0", fontSize: 14, background: "#fafafa", color: "#111827", boxSizing: "border-box" } as React.CSSProperties,
  label: { fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 4, display: "block" } as React.CSSProperties,
  btn: { padding: "10px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: "#6366f1", color: "#fff" } as React.CSSProperties,
  btnGhost: { padding: "7px 12px", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "pointer", fontWeight: 700, fontSize: 12, background: "#fff", color: "#334155" } as React.CSSProperties,
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#64748b", background: "#f8fafc", textTransform: "uppercase" as const, letterSpacing: 0.4 },
  td: { padding: "10px 12px", fontSize: 13, color: "#111827", borderBottom: "1px solid #eef2f7" },
};

export default function PlanesPage() {
  const { usuario, listo, puedeVer, puedeCrear, puedeEditar, puedeEliminar } = usePermisos("planes");
  const [tab, setTab] = useState<"planes" | "miembros" | "consumos" | "ingresos" | "alertas">("miembros");

  if (listo && !puedeVer) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#111827" }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <h2>Sin acceso al módulo de Planes</h2>
        <p style={{ color: "#64748b" }}>Pide al gerente que te asigne permisos desde /permisos.</p>
      </div>
    );
  }

  const TABS = [
    { k: "miembros", label: "👥 Miembros" },
    { k: "planes",   label: "💎 Planes" },
    { k: "consumos", label: "📋 Consumos" },
    { k: "ingresos", label: "💰 Ingresos" },
    { k: "alertas",  label: "🔔 Alertas" },
  ] as const;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fb", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ fontSize: 34 }}>💎</div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#111827", margin: 0 }}>Planes y Membresías</h1>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            Lavados, descuentos, puntos y prioridad — aplicados automáticamente en todo el CRM
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)} style={{
            padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13,
            background: tab === t.k ? "#6366f1" : "#fff",
            color: tab === t.k ? "#fff" : "#64748b",
            border: tab === t.k ? "1px solid transparent" : "1px solid #e5e7eb",
            boxShadow: tab === t.k ? "0 2px 8px rgba(99,102,241,0.35)" : "none",
          }}>{t.label}</button>
        ))}
      </div>

      {tab === "planes"   && <CatalogoPlanes puedeCrear={puedeCrear} puedeEditar={puedeEditar} puedeEliminar={puedeEliminar} />}
      {tab === "miembros" && <Miembros usuario={usuario} puedeCrear={puedeCrear} puedeEditar={puedeEditar} />}
      {tab === "consumos" && <Consumos />}
      {tab === "ingresos" && <Ingresos />}
      {tab === "alertas"  && <Alertas />}
    </div>
  );
}

// ════════════════════════════ CATÁLOGO DE PLANES ════════════════════════════
function CatalogoPlanes({ puedeCrear, puedeEditar, puedeEliminar }: any) {
  const vacio = { nombre: "", emoji: "⭐", color: "#3b82f6", descripcion: "", precio_mensual: "", precio_anual: "", orden: "0" };
  const [planes, setPlanes] = useState<any[]>([]);
  const [form, setForm] = useState<any>(vacio);
  const [editId, setEditId] = useState<any>(null);
  const [benefPlan, setBenefPlan] = useState<any>(null);        // plan cuyo editor de beneficios está abierto
  const [benefValores, setBenefValores] = useState<Record<string, string>>({});

  const cargar = async () => {
    try {
      const d = await fetch(`${API}/planes`).then(r => r.json());
      setPlanes(Array.isArray(d) ? d : []);
    } catch { /* */ }
  };
  useEffect(() => { cargar(); }, []);

  const guardar = async () => {
    if (!form.nombre.trim() || form.precio_mensual === "") return alert("Nombre y precio mensual son requeridos");
    const url = editId ? `${API}/planes/${editId}` : `${API}/planes`;
    const r = await fetch(url, {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", ...auditHeaders() },
      body: JSON.stringify({
        nombre: form.nombre, emoji: form.emoji, color: form.color, descripcion: form.descripcion,
        precio_mensual: Number(form.precio_mensual), precio_anual: Number(form.precio_anual || 0),
        orden: Number(form.orden || 0),
      }),
    });
    const d = await r.json();
    if (d.error) return alert("Error: " + d.error);
    setForm(vacio); setEditId(null); cargar();
  };

  const eliminar = async (p: any) => {
    if (!confirm(`¿Desactivar el plan "${p.nombre}"? Los miembros actuales lo conservan hasta su vencimiento.`)) return;
    await fetch(`${API}/planes/${p.id}`, { method: "DELETE", headers: auditHeaders() });
    cargar();
  };

  const abrirBeneficios = (p: any) => {
    const vals: Record<string, string> = {};
    for (const b of BENEFICIO_TIPOS) {
      const actual = (p.plan_beneficios || []).find((x: any) => x.tipo === b.tipo);
      vals[b.tipo] = actual !== undefined ? String(actual.valor) : "";
    }
    setBenefValores(vals);
    setBenefPlan(p);
  };

  const guardarBeneficios = async () => {
    const beneficios = BENEFICIO_TIPOS
      .filter(b => benefValores[b.tipo] !== "" && benefValores[b.tipo] !== undefined)
      .map(b => ({ tipo: b.tipo, valor: Number(benefValores[b.tipo]) }))
      .filter(b => !isNaN(b.valor) && b.valor !== 0);
    const r = await fetch(`${API}/planes/${benefPlan.id}/beneficios`, {
      method: "POST", headers: { "Content-Type": "application/json", ...auditHeaders() },
      body: JSON.stringify({ beneficios }),
    });
    const d = await r.json();
    if (d.error) return alert("Error: " + d.error);
    setBenefPlan(null); cargar();
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, alignItems: "start" }}>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 14 }}>
          {planes.map(p => (
            <div key={p.id} style={{ ...S.card, marginBottom: 0, borderTop: `4px solid ${p.color || "#3b82f6"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 26 }}>{p.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: "#111827" }}>{p.nombre}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {fmt(p.precio_mensual)}/mes{Number(p.precio_anual) > 0 ? ` · ${fmt(p.precio_anual)}/año` : ""}
                  </div>
                </div>
              </div>
              {p.descripcion && <div style={{ fontSize: 12, color: "#64748b", margin: "8px 0" }}>{p.descripcion}</div>}
              <div style={{ margin: "10px 0" }}>
                {(p.plan_beneficios || []).map((b: any) => (
                  <div key={b.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: "1px dashed #eef2f7" }}>
                    <span style={{ color: "#64748b" }}>{beneficioLabel(b.tipo)}</span>
                    <b style={{ color: "#111827" }}>{valorLabel(b.tipo, Number(b.valor))}</b>
                  </div>
                ))}
                {(p.plan_beneficios || []).length === 0 && <div style={{ fontSize: 12, color: "#94a3b8" }}>Sin beneficios configurados</div>}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {puedeEditar && <button onClick={() => abrirBeneficios(p)} style={S.btnGhost}>🎁 Beneficios</button>}
                {puedeEditar && <button onClick={() => { setEditId(p.id); setForm({ nombre: p.nombre, emoji: p.emoji || "⭐", color: p.color || "#3b82f6", descripcion: p.descripcion || "", precio_mensual: String(p.precio_mensual), precio_anual: String(p.precio_anual || ""), orden: String(p.orden || 0) }); }} style={S.btnGhost}>✏️ Editar</button>}
                {puedeEliminar && <button onClick={() => eliminar(p)} style={{ ...S.btnGhost, color: "#ef4444" }}>🗑️</button>}
              </div>
            </div>
          ))}
        </div>
        {planes.length === 0 && <div style={{ ...S.card, color: "#64748b" }}>Sin planes. Corre la migración v19 o crea uno nuevo.</div>}
      </div>

      <div style={S.card}>
        <h3 style={{ color: "#111827", fontWeight: 800, marginBottom: 12 }}>{editId ? "✏️ Editar plan" : "➕ Nuevo plan"}</h3>
        <label style={S.label}>Nombre *</label>
        <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={{ ...S.input, marginBottom: 8 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div><label style={S.label}>Emoji</label>
            <input value={form.emoji} onChange={e => setForm({ ...form, emoji: e.target.value })} style={{ ...S.input, marginBottom: 8 }} /></div>
          <div><label style={S.label}>Color</label>
            <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={{ ...S.input, marginBottom: 8, padding: 4, height: 40 }} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div><label style={S.label}>Precio mensual *</label>
            <input type="number" value={form.precio_mensual} onChange={e => setForm({ ...form, precio_mensual: e.target.value })} style={{ ...S.input, marginBottom: 8 }} /></div>
          <div><label style={S.label}>Precio anual</label>
            <input type="number" value={form.precio_anual} onChange={e => setForm({ ...form, precio_anual: e.target.value })} style={{ ...S.input, marginBottom: 8 }} /></div>
        </div>
        <label style={S.label}>Descripción</label>
        <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows={2} style={{ ...S.input, marginBottom: 10 }} />
        <button onClick={guardar} disabled={!puedeCrear && !editId} style={{ ...S.btn, width: "100%", opacity: (!puedeCrear && !editId) ? 0.55 : 1 }}>
          {editId ? "Guardar cambios" : "Crear plan"}
        </button>
        {editId && <button onClick={() => { setEditId(null); setForm(vacio); }} style={{ ...S.btnGhost, width: "100%", marginTop: 8 }}>Cancelar</button>}
      </div>

      {/* Modal editor de beneficios */}
      {benefPlan && (
        <div onClick={() => setBenefPlan(null)} style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, width: 440, margin: 0 }}>
            <h3 style={{ fontWeight: 800, color: "#111827" }}>🎁 Beneficios — {benefPlan.emoji} {benefPlan.nombre}</h3>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>Deja vacío o 0 para que el plan no incluya ese beneficio.</p>
            {BENEFICIO_TIPOS.map(b => (
              <div key={b.tipo} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{b.label}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{b.hint}</div>
                </div>
                <input type="number" value={benefValores[b.tipo] ?? ""} placeholder="0"
                  onChange={e => setBenefValores({ ...benefValores, [b.tipo]: e.target.value })}
                  style={{ ...S.input, width: 110, marginBottom: 0 }} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={guardarBeneficios} style={{ ...S.btn, flex: 1 }}>Guardar beneficios</button>
              <button onClick={() => setBenefPlan(null)} style={S.btnGhost}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════ MIEMBROS ════════════════════════════
function Miembros({ usuario, puedeCrear, puedeEditar }: any) {
  const [membresias, setMembresias] = useState<any[]>([]);
  const [planes, setPlanes] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("TODAS");
  const [form, setForm] = useState({ cliente_id: "", plan_id: "", ciclo: "MENSUAL", metodo_pago: "EFECTIVO" });
  const [buscaCliente, setBuscaCliente] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      const [m, p, c] = await Promise.all([
        fetch(`${API}/planes/membresias`).then(r => r.json()),
        fetch(`${API}/planes`).then(r => r.json()),
        fetch(`${API}/clientes`).then(r => r.json()),
      ]);
      setMembresias(Array.isArray(m) ? m : []);
      setPlanes(Array.isArray(p) ? p : []);
      setClientes(Array.isArray(c) ? c : []);
    } catch { /* */ }
  };
  useEffect(() => { cargar(); }, []);

  const inscribir = async () => {
    if (!form.cliente_id || !form.plan_id) return alert("Selecciona cliente y plan");
    setGuardando(true);
    try {
      const r = await fetch(`${API}/planes/membresias`, {
        method: "POST", headers: { "Content-Type": "application/json", ...auditHeaders() },
        body: JSON.stringify({ ...form, usuario: usuario?.nombre || "Sistema" }),
      });
      const d = await r.json();
      if (d.error) return alert("Error: " + d.error);
      alert("✅ Membresía activada");
      setForm({ cliente_id: "", plan_id: "", ciclo: "MENSUAL", metodo_pago: "EFECTIVO" });
      setBuscaCliente("");
      cargar();
    } catch { alert("Error de conexión"); }
    finally { setGuardando(false); }
  };

  const renovar = async (m: any) => {
    const metodo = prompt(`Renovar ${m.plan_catalogo?.nombre} de ${m.cliente?.nombre}.\nMétodo de pago (EFECTIVO / TARJETA / TRANSFERENCIA):`, "EFECTIVO");
    if (!metodo) return;
    const r = await fetch(`${API}/planes/membresias/${m.id}/renovar`, {
      method: "POST", headers: { "Content-Type": "application/json", ...auditHeaders() },
      body: JSON.stringify({ metodo_pago: metodo.toUpperCase(), usuario: usuario?.nombre || "Sistema" }),
    });
    const d = await r.json();
    if (d.error) return alert("Error: " + d.error);
    cargar();
  };

  const cancelar = async (m: any) => {
    if (!confirm(`¿Cancelar la membresía de ${m.cliente?.nombre}?`)) return;
    await fetch(`${API}/planes/membresias/${m.id}/cancelar`, { method: "POST", headers: auditHeaders() });
    cargar();
  };

  const clientesFiltrados = buscaCliente
    ? clientes.filter((c: any) => `${c.nombre} ${c.telefono || ""}`.toLowerCase().includes(buscaCliente.toLowerCase())).slice(0, 8)
    : [];

  const visibles = membresias.filter(m => {
    if (filtro !== "TODAS" && m.estado !== filtro) return false;
    if (busqueda && !`${m.cliente?.nombre || ""} ${m.plan_catalogo?.nombre || ""}`.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  const activas = membresias.filter(m => m.estado === "ACTIVA").length;
  const mrr = membresias.filter(m => m.estado === "ACTIVA").reduce((a, m) => {
    const p = m.plan_catalogo;
    if (!p) return a;
    return a + (m.ciclo === "ANUAL" ? Number(p.precio_anual || 0) / 12 : Number(p.precio_mensual || 0));
  }, 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, alignItems: "start" }}>
      <div style={S.card}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input placeholder="🔍 Buscar miembro…" value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ ...S.input, maxWidth: 260, marginBottom: 0 }} />
          <select value={filtro} onChange={e => setFiltro(e.target.value)} style={{ ...S.input, maxWidth: 160, marginBottom: 0 }}>
            <option value="TODAS">Todas</option>
            <option value="ACTIVA">Activas</option>
            <option value="VENCIDA">Vencidas</option>
            <option value="CANCELADA">Canceladas</option>
          </select>
          <div style={{ marginLeft: "auto", fontSize: 13, color: "#64748b" }}>
            <b style={{ color: "#166534" }}>{activas} activas</b> · Ingreso mensual recurrente: <b style={{ color: "#6366f1" }}>{fmt(mrr)}</b>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={S.th}>Cliente</th><th style={S.th}>Plan</th><th style={S.th}>Ciclo</th>
            <th style={S.th}>Renueva</th><th style={S.th}>Estado</th><th style={S.th}></th>
          </tr></thead>
          <tbody>
            {visibles.map(m => {
              const ec = ESTADO_COLOR[m.estado] || ESTADO_COLOR.CANCELADA;
              return (
                <tr key={m.id}>
                  <td style={S.td}>
                    <b>{m.cliente?.nombre}</b>
                    {m.cliente?.telefono && <div style={{ fontSize: 11, color: "#94a3b8" }}>{m.cliente.telefono}</div>}
                  </td>
                  <td style={S.td}>
                    <span style={{ background: `${m.plan_catalogo?.color || "#3b82f6"}22`, color: m.plan_catalogo?.color || "#3b82f6", padding: "3px 10px", borderRadius: 20, fontWeight: 800, fontSize: 12 }}>
                      {m.plan_catalogo?.emoji} {m.plan_catalogo?.nombre}
                    </span>
                  </td>
                  <td style={S.td}>{m.ciclo === "ANUAL" ? "Anual" : "Mensual"}</td>
                  <td style={S.td}>{fmtFecha(m.fecha_renovacion)}</td>
                  <td style={S.td}>
                    <span style={{ background: ec.bg, color: ec.color, padding: "3px 10px", borderRadius: 20, fontWeight: 800, fontSize: 11 }}>{m.estado}</span>
                  </td>
                  <td style={{ ...S.td, whiteSpace: "nowrap" }}>
                    {puedeEditar && m.estado !== "CANCELADA" && <button onClick={() => renovar(m)} style={S.btnGhost}>🔄 Renovar</button>}{" "}
                    {puedeEditar && m.estado === "ACTIVA" && <button onClick={() => cancelar(m)} style={{ ...S.btnGhost, color: "#ef4444" }}>✕</button>}
                  </td>
                </tr>
              );
            })}
            {visibles.length === 0 && <tr><td style={S.td} colSpan={6}>Sin membresías.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={S.card}>
        <h3 style={{ color: "#111827", fontWeight: 800, marginBottom: 12 }}>➕ Inscribir miembro</h3>

        <label style={S.label}>Cliente *</label>
        {form.cliente_id ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: "#eef2ff", borderRadius: 9, padding: "8px 12px" }}>
            <b style={{ flex: 1, fontSize: 13 }}>{clientes.find((c: any) => String(c.id) === String(form.cliente_id))?.nombre || `Cliente #${form.cliente_id}`}</b>
            <button onClick={() => setForm({ ...form, cliente_id: "" })} style={{ ...S.btnGhost, padding: "3px 8px" }}>✕</button>
          </div>
        ) : (
          <div style={{ position: "relative", marginBottom: 8 }}>
            <input placeholder="Escribe para buscar…" value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)} style={{ ...S.input, marginBottom: 0 }} />
            {clientesFiltrados.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 9, zIndex: 20, maxHeight: 220, overflowY: "auto", boxShadow: "0 8px 20px rgba(0,0,0,0.08)" }}>
                {clientesFiltrados.map((c: any) => (
                  <div key={c.id} onClick={() => { setForm({ ...form, cliente_id: String(c.id) }); setBuscaCliente(""); }}
                    style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f1f5f9" }}>
                    <b>{c.nombre}</b>{c.telefono && <span style={{ color: "#94a3b8" }}> — {c.telefono}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <label style={S.label}>Plan *</label>
        <select value={form.plan_id} onChange={e => setForm({ ...form, plan_id: e.target.value })} style={{ ...S.input, marginBottom: 8 }}>
          <option value="">Seleccionar plan…</option>
          {planes.map(p => (
            <option key={p.id} value={p.id}>
              {p.emoji} {p.nombre} — {fmt(p.precio_mensual)}/mes
            </option>
          ))}
        </select>

        <label style={S.label}>Ciclo</label>
        <select value={form.ciclo} onChange={e => setForm({ ...form, ciclo: e.target.value })} style={{ ...S.input, marginBottom: 8 }}>
          <option value="MENSUAL">Mensual</option>
          <option value="ANUAL">Anual</option>
        </select>

        <label style={S.label}>Método de pago</label>
        <select value={form.metodo_pago} onChange={e => setForm({ ...form, metodo_pago: e.target.value })} style={{ ...S.input, marginBottom: 12 }}>
          <option value="EFECTIVO">💵 Efectivo</option>
          <option value="TARJETA">💳 Tarjeta</option>
          <option value="TRANSFERENCIA">🏦 Transferencia</option>
        </select>

        {form.plan_id && (
          <div style={{ background: "#f8fafc", borderRadius: 9, padding: "10px 12px", fontSize: 13, marginBottom: 12, color: "#334155" }}>
            Cobro hoy: <b style={{ color: "#6366f1" }}>
              {(() => {
                const p = planes.find(x => String(x.id) === String(form.plan_id));
                if (!p) return "—";
                return fmt(form.ciclo === "ANUAL" ? p.precio_anual : p.precio_mensual);
              })()}
            </b> · entra a caja y a ingresos del plan automáticamente.
          </div>
        )}

        <button onClick={inscribir} disabled={guardando || !puedeCrear} style={{ ...S.btn, width: "100%", opacity: guardando || !puedeCrear ? 0.55 : 1 }}>
          {guardando ? "Guardando…" : "💎 Activar membresía"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════ CONSUMOS ════════════════════════════
function Consumos() {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" });
  const hace30 = new Date(Date.now() - 30 * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" });
  const [desde, setDesde] = useState(hace30);
  const [hasta, setHasta] = useState(hoy);
  const [consumos, setConsumos] = useState<any[]>([]);

  const buscar = async () => {
    try {
      const d = await fetch(`${API}/planes/consumos?desde=${desde}&hasta=${hasta}`).then(r => r.json());
      setConsumos(Array.isArray(d) ? d : []);
    } catch { setConsumos([]); }
  };
  useEffect(() => { buscar(); }, []);

  return (
    <div style={S.card}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 14, flexWrap: "wrap" }}>
        <div><label style={S.label}>Desde</label><input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ ...S.input, marginBottom: 0 }} /></div>
        <div><label style={S.label}>Hasta</label><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ ...S.input, marginBottom: 0 }} /></div>
        <button onClick={buscar} style={S.btn}>🔍 Buscar</button>
        <div style={{ marginLeft: "auto", fontSize: 13, color: "#64748b" }}>{consumos.length} consumos</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={S.th}>Fecha</th><th style={S.th}>Cliente</th><th style={S.th}>Plan</th>
          <th style={S.th}>Beneficio</th><th style={S.th}>Detalle</th><th style={S.th}>Registró</th>
        </tr></thead>
        <tbody>
          {consumos.map(c => (
            <tr key={c.id}>
              <td style={S.td}>{new Date(c.created_at).toLocaleString("es-DO", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
              <td style={S.td}><b>{c.cliente?.nombre}</b></td>
              <td style={S.td}>{c.plan_nombre}</td>
              <td style={S.td}>{c.tipo === "lavado" ? "🚿 Lavado" : c.tipo === "diagnostico" ? "🔍 Diagnóstico" : c.tipo}</td>
              <td style={S.td}>{c.descripcion || "—"}</td>
              <td style={S.td}>{c.usuario || "—"}</td>
            </tr>
          ))}
          {consumos.length === 0 && <tr><td style={S.td} colSpan={6}>Sin consumos en este rango.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ════════════════════════════ INGRESOS ════════════════════════════
function Ingresos() {
  const [pagos, setPagos] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetch(`${API}/planes/pagos`).then(r => r.json()).then(d => {
      setPagos(d.pagos || []); setTotal(d.total || 0);
    }).catch(() => {});
  }, []);

  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ fontWeight: 800, color: "#111827", margin: 0 }}>💰 Ingresos por membresías</h3>
        <div style={{ fontSize: 14, color: "#64748b" }}>Total histórico: <b style={{ color: "#166534" }}>{fmt(total)}</b></div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={S.th}>Fecha</th><th style={S.th}>Cliente</th><th style={S.th}>Concepto</th>
          <th style={S.th}>Método</th><th style={S.th}>Monto</th><th style={S.th}>Registró</th>
        </tr></thead>
        <tbody>
          {pagos.map(p => (
            <tr key={p.id}>
              <td style={S.td}>{new Date(p.created_at).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })}</td>
              <td style={S.td}><b>{p.cliente?.nombre}</b></td>
              <td style={S.td}>{p.concepto}</td>
              <td style={S.td}>{p.metodo}</td>
              <td style={{ ...S.td, fontWeight: 800, color: "#166534" }}>{fmt(p.monto)}</td>
              <td style={S.td}>{p.usuario || "—"}</td>
            </tr>
          ))}
          {pagos.length === 0 && <tr><td style={S.td} colSpan={6}>Sin pagos registrados todavía.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ════════════════════════════ ALERTAS ════════════════════════════
function Alertas() {
  const [alertas, setAlertas] = useState<{ por_vencer: any[]; vencidas: any[] }>({ por_vencer: [], vencidas: [] });

  useEffect(() => {
    fetch(`${API}/planes/alertas`).then(r => r.json())
      .then(d => setAlertas({ por_vencer: d.por_vencer || [], vencidas: d.vencidas || [] }))
      .catch(() => {});
  }, []);

  const linkWhatsApp = (m: any, tipo: "por_vencer" | "vencida") => {
    const tel = String(m.cliente?.telefono || "").replace(/\D/g, "");
    if (!tel) return null;
    const numero = tel.length === 10 ? `1${tel}` : tel;
    const plan = `${m.plan_catalogo?.emoji || ""} ${m.plan_catalogo?.nombre || "su plan"}`;
    const msj = tipo === "por_vencer"
      ? `Hola ${m.cliente?.nombre} 👋 Le recordamos que ${plan} en Sólido Auto Servicio se renueva el ${fmtFecha(m.fecha_renovacion)}. ¡Le esperamos para mantener sus beneficios activos! 🚗`
      : `Hola ${m.cliente?.nombre} 👋 Su ${plan} en Sólido Auto Servicio venció el ${fmtFecha(m.fecha_renovacion)}. Renuévelo hoy y siga disfrutando sus lavados, descuentos y puntos. 🚗`;
    return `https://wa.me/${numero}?text=${encodeURIComponent(msj)}`;
  };

  const Bloque = ({ titulo, lista, color, tipo }: any) => (
    <div style={S.card}>
      <h3 style={{ fontWeight: 800, color, marginBottom: 12 }}>{titulo} ({lista.length})</h3>
      {lista.length === 0 && <div style={{ fontSize: 13, color: "#94a3b8" }}>Nada pendiente. 🎉</div>}
      {lista.map((m: any) => {
        const wa = linkWhatsApp(m, tipo);
        return (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #eef2f7" }}>
            <span style={{ fontSize: 22 }}>{m.plan_catalogo?.emoji || "💎"}</span>
            <div style={{ flex: 1 }}>
              <b style={{ fontSize: 13, color: "#111827" }}>{m.cliente?.nombre}</b>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {m.plan_catalogo?.nombre} · {tipo === "por_vencer" ? "renueva" : "venció"} el {fmtFecha(m.fecha_renovacion)}
                {m.cliente?.telefono ? ` · ${m.cliente.telefono}` : ""}
              </div>
            </div>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" style={{ ...S.btnGhost, textDecoration: "none", background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" }}>
                💬 WhatsApp
              </a>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      <Bloque titulo="🔔 Renuevan en los próximos 5 días" lista={alertas.por_vencer} color="#b45309" tipo="por_vencer" />
      <Bloque titulo="⛔ Vencidas — recuperar clientes" lista={alertas.vencidas} color="#991b1b" tipo="vencida" />
    </div>
  );
}
