"use client";
import { useEffect, useState, useCallback } from "react";
import { API_URL as API } from "@/config";

const fmtDateLarga = (d: string) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("es-DO", { weekday: "long", day: "2-digit", month: "long" }) : "";

const TIPOS_SERVICIO = [
  "CAMBIO_ACEITE", "FILTROS", "FRENOS", "CORREAS", "BUJIAS",
  "ALINEACION", "TRANSMISION", "AC", "SUSPENSION", "DIAGNOSTICO", "LAVADO", "OTRO",
];
const TIPO_LABEL: Record<string, string> = {
  CAMBIO_ACEITE: "🛢️ Cambio de Aceite", FILTROS: "🔩 Filtros", FRENOS: "🛑 Frenos",
  CORREAS: "⚙️ Correas", BUJIAS: "⚡ Bujías", ALINEACION: "🔄 Alineación",
  TRANSMISION: "⚙️ Transmisión", AC: "❄️ Aire Acondicionado", SUSPENSION: "🔧 Suspensión",
  DIAGNOSTICO: "🔬 Diagnóstico", LAVADO: "🚿 Lavado", OTRO: "🔧 Otro",
};
const ESTADO_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PENDIENTE:  { bg: "#fef3c7", color: "#d97706", label: "⏳ Pendiente"  },
  CONFIRMADA: { bg: "#dbeafe", color: "#1d4ed8", label: "✅ Confirmada" },
  COMPLETADA: { bg: "#dcfce7", color: "#16a34a", label: "🏁 Completada" },
  CANCELADA:  { bg: "#fee2e2", color: "#dc2626", label: "✕ Cancelada"   },
  NO_ASISTIO: { bg: "#f3f4f6", color: "#6b7280", label: "👻 No asistió" },
};
const HORAS = ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00"];

type Cita = {
  id: number; cliente_id: number; vehiculo_id: number; fecha: string; hora: string;
  tipo_servicio: string; descripcion: string; estado: string; recordatorio_enviado: boolean;
  cliente_nombre: string; cliente_telefono: string; vehiculo_info: string; notas: string;
  cliente_email?: string; origen?: string;
};

export default function CitasPage() {
  const [citas, setCitas]     = useState<Cita[]>([]);
  const [stats, setStats]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro]   = useState<"HOY" | "MANANA" | "SEMANA" | "TODAS">("SEMANA");
  const [showForm, setShowForm] = useState(false);
  const [clientes, setClientes]   = useState<any[]>([]);
  const [vehiculos, setVehiculos] = useState<any[]>([]);

  const hoy = new Date().toISOString().slice(0, 10);
  const manana = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();

  const [form, setForm] = useState({
    cliente_id: "", vehiculo_id: "", fecha: hoy, hora: "09:00",
    tipo_servicio: "DIAGNOSTICO", descripcion: "",
  });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      let qs = "";
      if (filtro === "HOY")    qs = `?desde=${hoy}&hasta=${hoy}`;
      if (filtro === "MANANA") qs = `?desde=${manana}&hasta=${manana}`;
      if (filtro === "SEMANA") {
        const en7 = new Date(); en7.setDate(en7.getDate() + 7);
        qs = `?desde=${hoy}&hasta=${en7.toISOString().slice(0, 10)}`;
      }
      const [rC, rS] = await Promise.all([
        fetch(`${API}/citas${qs}`), fetch(`${API}/citas/stats`),
      ]);
      const dC = await rC.json();
      setCitas(Array.isArray(dC) ? dC : []);
      setStats(await rS.json());
    } catch { setCitas([]); }
    setLoading(false);
  }, [filtro]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    fetch(`${API}/clientes`).then(r => r.json()).then(d => setClientes(Array.isArray(d) ? d : []));
  }, []);

  // Al elegir cliente, cargar sus vehículos
  const onCliente = async (cid: string) => {
    setForm(f => ({ ...f, cliente_id: cid, vehiculo_id: "" }));
    if (!cid) { setVehiculos([]); return; }
    const r = await fetch(`${API}/clientes/${cid}/vehiculos`);
    const d = await r.json();
    setVehiculos(Array.isArray(d) ? d : []);
  };

  const guardar = async () => {
    if (!form.cliente_id || !form.fecha) return alert("Cliente y fecha son requeridos");
    const r = await fetch(`${API}/citas`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        cliente_id: Number(form.cliente_id),
        vehiculo_id: form.vehiculo_id ? Number(form.vehiculo_id) : null,
      }),
    });
    const d = await r.json();
    if (d.error) return alert(d.error);
    setShowForm(false);
    setForm({ cliente_id: "", vehiculo_id: "", fecha: hoy, hora: "09:00", tipo_servicio: "DIAGNOSTICO", descripcion: "" });
    cargar();
  };

  const cambiarEstado = async (c: Cita, estado: string) => {
    await fetch(`${API}/citas/${c.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    cargar();
  };

  const eliminar = async (id: number) => {
    if (!confirm("¿Eliminar esta cita?")) return;
    await fetch(`${API}/citas/${id}`, { method: "DELETE" });
    cargar();
  };

  // WhatsApp de confirmación de cita con un clic
  const whatsappCita = async (c: Cita) => {
    const msg = `Hola ${c.cliente_nombre} 👋, le saludamos de *Sólido Auto Servicio*.\n\n` +
      `Le confirmamos su cita:\n📅 *${fmtDateLarga(c.fecha)}* a las *${c.hora}*\n` +
      (c.vehiculo_info ? `🚗 ${c.vehiculo_info}\n` : "") +
      (c.tipo_servicio ? `🔧 ${(TIPO_LABEL[c.tipo_servicio] || c.tipo_servicio).replace(/^[^\s]+\s/, "")}\n` : "") +
      `\nSi necesita cambiar la fecha, responda este mensaje o llámenos al 849-569-2027. ¡Le esperamos!`;
    window.open(`https://wa.me/${c.cliente_telefono.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
    await fetch(`${API}/recordatorios/enviado`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "cita", id: c.id, cliente_id: c.cliente_id, vehiculo_id: c.vehiculo_id, mensaje: msg }),
    });
    cargar();
  };

  // Agrupar por fecha para la vista de agenda
  const porFecha: Record<string, Cita[]> = {};
  citas.forEach(c => { (porFecha[c.fecha] = porFecha[c.fecha] || []).push(c); });

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}>📅 Citas</h1>
          <p style={S.subtitle}>SÓLIDO AUTO SERVICIO — Agenda del taller</p>
        </div>
        <button onClick={() => setShowForm(f => !f)} style={S.btnPrimary}>
          {showForm ? "✕ Cancelar" : "➕ Nueva Cita"}
        </button>
      </div>

      {stats && (
        <div style={S.kpiRow}>
          <KpiCard icon="📌" label="Hoy"            value={stats.hoy}        color="#ef4444" />
          <KpiCard icon="🌅" label="Mañana"         value={stats.manana}     color="#f59e0b" />
          <KpiCard icon="🗓️" label="Esta semana"    value={stats.semana}     color="#3b82f6" />
          <KpiCard icon="⏳" label="Sin confirmar"  value={stats.pendientes} color="#8b5cf6" />
        </div>
      )}

      {showForm && (
        <div style={{ ...S.card, border: "2px solid #6366f1", marginBottom: 20 }}>
          <h3 style={{ ...S.cardTitle, color: "#4338ca" }}>📅 Nueva Cita</h3>
          <div style={S.formGrid}>
            <div>
              <label style={S.label}>Cliente</label>
              <select value={form.cliente_id} onChange={e => onCliente(e.target.value)} style={S.input}>
                <option value="">— Seleccionar cliente —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.telefono ? `(${c.telefono})` : ""}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Vehículo</label>
              <select value={form.vehiculo_id} onChange={e => setForm(f => ({ ...f, vehiculo_id: e.target.value }))} style={S.input}>
                <option value="">— Seleccionar vehículo —</option>
                {vehiculos.map(v => <option key={v.id} value={v.id}>{v.marca} {v.modelo} ({v.placa})</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Fecha</label>
              <input type="date" value={form.fecha} min={hoy}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} style={S.input} />
            </div>
            <div>
              <label style={S.label}>Hora</label>
              <select value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} style={S.input}>
                {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Tipo de servicio</label>
              <select value={form.tipo_servicio} onChange={e => setForm(f => ({ ...f, tipo_servicio: e.target.value }))} style={S.input}>
                {TIPOS_SERVICIO.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Descripción (opcional)</label>
              <input value={form.descripcion} placeholder="Ej: ruido en tren delantero"
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} style={S.input} />
            </div>
          </div>
          <button onClick={guardar} style={{ ...S.btnPrimary, width: "100%", marginTop: 8 }}>
            💾 Agendar Cita
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {([
          { key: "HOY",    label: "📌 Hoy" },
          { key: "MANANA", label: "🌅 Mañana" },
          { key: "SEMANA", label: "🗓️ Semana" },
          { key: "TODAS",  label: "📋 Todas" },
        ] as const).map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            style={filtro === f.key ? S.tabActive : S.tabInactive}>{f.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={S.card}><p style={S.empty}>Cargando...</p></div>
      ) : citas.length === 0 ? (
        <div style={S.card}><p style={S.empty}>No hay citas en este período. Usa "➕ Nueva Cita" para agendar.</p></div>
      ) : (
        Object.keys(porFecha).sort().map(fecha => (
          <div key={fecha} style={S.card}>
            <h3 style={{ ...S.cardTitle, textTransform: "capitalize" }}>
              {fecha === hoy ? "📌 Hoy — " : fecha === manana ? "🌅 Mañana — " : ""}
              {fmtDateLarga(fecha)} ({porFecha[fecha].length})
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>{["Hora", "Cliente", "Vehículo", "Servicio", "Estado", "Recordado", "Acciones"].map(h =>
                    <th key={h} style={S.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {porFecha[fecha].map(c => {
                    const est = ESTADO_STYLE[c.estado] || ESTADO_STYLE.PENDIENTE;
                    return (
                      <tr key={c.id}>
                        <td style={{ ...S.td, fontWeight: 800, fontSize: 15 }}>{c.hora}</td>
                        <td style={S.td}>
                          <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            {c.cliente_nombre}
                            {c.origen === "WEB" && (
                              <span style={{ padding: "1px 7px", borderRadius: 20, fontSize: 10, fontWeight: 800, background: "#e0e7ff", color: "#4338ca" }}>🌐 Web</span>
                            )}
                          </div>
                          {c.cliente_telefono && <div style={{ fontSize: 11, color: "#60a5fa" }}>📞 {c.cliente_telefono}</div>}
                          {c.cliente_email && <div style={{ fontSize: 11, color: "#888" }}>✉️ {c.cliente_email}</div>}
                        </td>
                        <td style={S.td}>{c.vehiculo_info || "—"}</td>
                        <td style={S.td}>
                          <div>{TIPO_LABEL[c.tipo_servicio] || c.tipo_servicio || "—"}</div>
                          {c.descripcion && <div style={{ fontSize: 11, color: "#888" }}>{c.descripcion}</div>}
                        </td>
                        <td style={S.td}>
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: est.bg, color: est.color }}>
                            {est.label}
                          </span>
                        </td>
                        <td style={S.td}>{c.recordatorio_enviado ? "✅" : "—"}</td>
                        <td style={S.td}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {c.cliente_telefono && ["PENDIENTE", "CONFIRMADA"].includes(c.estado) && (
                              <button onClick={() => whatsappCita(c)} style={S.btnWhatsapp}>💬 WhatsApp</button>
                            )}
                            {c.estado === "PENDIENTE" && (
                              <button onClick={() => cambiarEstado(c, "CONFIRMADA")} style={S.btnSmall}>✅ Confirmar</button>
                            )}
                            {["PENDIENTE", "CONFIRMADA"].includes(c.estado) && (
                              <>
                                <button onClick={() => cambiarEstado(c, "COMPLETADA")} style={{ ...S.btnSmall, background: "#dcfce7", color: "#16a34a" }}>🏁 Llegó</button>
                                <button onClick={() => cambiarEstado(c, "NO_ASISTIO")} style={{ ...S.btnSmall, background: "#f3f4f6", color: "#6b7280" }}>👻</button>
                                <button onClick={() => cambiarEstado(c, "CANCELADA")} style={{ ...S.btnSmall, background: "#fee2e2", color: "#dc2626" }}>✕</button>
                              </>
                            )}
                            <button onClick={() => eliminar(c.id)} style={{ ...S.btnSmall, background: "#fee2e2", color: "#dc2626" }}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px",
      boxShadow: "0 2px 12px rgba(0,0,0,.07)", flex: 1, minWidth: 140,
      borderLeft: `5px solid ${color}` }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 30, fontWeight: 900, color, marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#888" }}>{label}</div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:      { padding: "24px 28px", background: "#f5f7fb", minHeight: "100vh" },
  header:    { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  title:     { fontSize: 26, fontWeight: 900, color: "#111827", margin: 0 },
  subtitle:  { fontSize: 13, color: "#6b7280", marginTop: 4 },
  kpiRow:    { display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" },
  card:      { background: "#fff", padding: 22, borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,.07)", marginBottom: 20 },
  cardTitle: { fontSize: 17, fontWeight: 700, marginBottom: 16, color: "#111827" },
  formGrid:  { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" },
  label:     { display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 5 },
  input:     { display: "block", padding: "11px 14px", width: "100%", borderRadius: 9,
               border: "1px solid #e2e8f0", fontSize: 14, marginBottom: 14,
               boxSizing: "border-box", background: "#fafafa" },
  btnPrimary: { padding: "11px 22px", background: "#111827", color: "#fff", border: "none",
                borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 14 },
  btnSmall:  { padding: "6px 12px", background: "#f1f5f9", color: "#374151", border: "none",
               borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 12 },
  btnWhatsapp: { padding: "6px 12px", background: "#25d366", color: "#fff", border: "none",
                 borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12 },
  tabActive: { padding: "9px 18px", borderRadius: 10, border: "none", background: "#111827",
               color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 },
  tabInactive: { padding: "9px 18px", borderRadius: 10, border: "1px solid #e2e8f0",
                 background: "#fff", color: "#374151", cursor: "pointer", fontWeight: 600, fontSize: 13 },
  table:     { width: "100%", borderCollapse: "collapse" },
  th:        { textAlign: "left", padding: "10px 12px", background: "#f8fafc", fontSize: 12,
               fontWeight: 700, color: "#555", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" },
  td:        { padding: "11px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 13 },
  empty:     { color: "#aaa", textAlign: "center", padding: "32px 0", fontStyle: "italic" },
};
