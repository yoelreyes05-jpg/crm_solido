"use client";
import { useEffect, useState, useCallback } from "react";
import { API_URL as API } from "@/config";

const fmt = (n: number) =>
  "RD$ " + Number(n || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 });

const fmtDate = (d: string) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const TIPOS_SERVICIO = [
  "CAMBIO_ACEITE", "FILTROS", "FRENOS", "CORREAS", "BUJIAS",
  "ALINEACION", "TRANSMISION", "AC", "SUSPENSION", "DIAGNOSTICO", "OTRO",
];

const TIPO_LABEL: Record<string, string> = {
  CAMBIO_ACEITE: "🛢️ Cambio de Aceite",
  FILTROS:       "🔩 Filtros",
  FRENOS:        "🛑 Frenos",
  CORREAS:       "⚙️ Correas",
  BUJIAS:        "⚡ Bujías",
  ALINEACION:    "🔄 Alineación",
  TRANSMISION:   "⚙️ Transmisión",
  AC:            "❄️ Aire Acondicionado",
  SUSPENSION:    "🔧 Suspensión",
  DIAGNOSTICO:   "🔬 Diagnóstico",
  OTRO:          "🔧 Otro",
};

const INTERVALO_DEFECTO: Record<string, number> = {
  CAMBIO_ACEITE: 90, FILTROS: 180, FRENOS: 365, CORREAS: 730,
  BUJIAS: 365, ALINEACION: 180, TRANSMISION: 365, AC: 365, SUSPENSION: 365,
  DIAGNOSTICO: 180, OTRO: 180,
};

type Plan = {
  id: number;
  vehiculo_id: number;
  vehiculo_info: string;
  vehiculo_placa: string;
  cliente_nombre: string;
  cliente_telefono: string;
  tipo_servicio: string;
  descripcion: string;
  intervalo_dias: number;
  ultimo_servicio_fecha: string;
  proximo_fecha: string;
  estado: string;
  dias_restantes: number | null;
  semaforo: "verde" | "amarillo" | "rojo" | "gris";
};

type Stats = { vencidos: number; proximos7dias: number; alDia: number; total: number };

export default function MantenimientoPage() {
  const [planes, setPlanes]   = useState<Plan[]>([]);
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro]   = useState("TODOS");
  const [showForm, setShowForm]   = useState(false);
  const [modalCompletar, setModalCompletar] = useState<Plan | null>(null);
  const [usuario, setUsuario] = useState<any>(null);

  // Vehiculos para el select del formulario
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [clientes,  setClientes]  = useState<any[]>([]);

  const [form, setForm] = useState({
    vehiculo_id: "", cliente_id: "", tipo_servicio: "CAMBIO_ACEITE",
    descripcion: "", intervalo_dias: "90", intervalo_km: "",
    ultimo_servicio_fecha: new Date().toISOString().slice(0, 10),
    proximo_fecha: "",
  });

  const [completarForm, setCompletarForm] = useState({
    ultimo_servicio_fecha: new Date().toISOString().slice(0, 10),
    notas: "",
  });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [rPlanes, rStats] = await Promise.all([
        fetch(`${API}/mantenimiento`),
        fetch(`${API}/mantenimiento/stats`),
      ]);
      const dPlanes = await rPlanes.json();
      const dStats  = await rStats.json();
      setPlanes(Array.isArray(dPlanes) ? dPlanes : []);
      setStats(dStats);
    } catch { setPlanes([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const u = localStorage.getItem("usuario");
    if (u) setUsuario(JSON.parse(u));
    cargar();
    // Cargar vehiculos y clientes para el formulario
    Promise.all([
      fetch(`${API}/vehiculos`).then(r => r.json()),
      fetch(`${API}/clientes`).then(r => r.json()),
    ]).then(([v, c]) => {
      setVehiculos(Array.isArray(v) ? v : []);
      setClientes(Array.isArray(c) ? c : []);
    });
  }, [cargar]);

  // Cuando cambia el tipo de servicio en el form, actualizar el intervalo por defecto
  const handleTipoChange = (tipo: string) => {
    const dias = INTERVALO_DEFECTO[tipo] || 180;
    const ultima = form.ultimo_servicio_fecha;
    let proxima = "";
    if (ultima) {
      const d = new Date(ultima + "T12:00:00");
      d.setDate(d.getDate() + dias);
      proxima = d.toISOString().slice(0, 10);
    }
    setForm(f => ({ ...f, tipo_servicio: tipo, intervalo_dias: String(dias), proximo_fecha: proxima }));
  };

  const handleUltimaFechaChange = (fecha: string) => {
    const dias = Number(form.intervalo_dias) || 180;
    const d = new Date(fecha + "T12:00:00");
    d.setDate(d.getDate() + dias);
    setForm(f => ({ ...f, ultimo_servicio_fecha: fecha, proximo_fecha: d.toISOString().slice(0, 10) }));
  };

  const handleVehiculoChange = (vId: string) => {
    const v = vehiculos.find(x => String(x.id) === vId);
    setForm(f => ({ ...f, vehiculo_id: vId, cliente_id: v ? String(v.cliente_id || "") : "" }));
  };

  const guardarPlan = async () => {
    if (!form.vehiculo_id || !form.tipo_servicio || !form.proximo_fecha)
      return alert("Vehículo, tipo de servicio y próxima fecha son requeridos");
    try {
      const body = {
        vehiculo_id:           Number(form.vehiculo_id),
        cliente_id:            form.cliente_id ? Number(form.cliente_id) : null,
        tipo_servicio:         form.tipo_servicio,
        descripcion:           form.descripcion || TIPO_LABEL[form.tipo_servicio],
        intervalo_dias:        Number(form.intervalo_dias || 180),
        intervalo_km:          form.intervalo_km ? Number(form.intervalo_km) : null,
        ultimo_servicio_fecha: form.ultimo_servicio_fecha || null,
        proximo_fecha:         form.proximo_fecha,
      };
      const r = await fetch(`${API}/mantenimiento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.error) return alert(d.error);
      setShowForm(false);
      setForm({ vehiculo_id: "", cliente_id: "", tipo_servicio: "CAMBIO_ACEITE",
        descripcion: "", intervalo_dias: "90", intervalo_km: "",
        ultimo_servicio_fecha: new Date().toISOString().slice(0, 10), proximo_fecha: "" });
      cargar();
    } catch (e: any) { alert("Error: " + e.message); }
  };

  const completarServicio = async () => {
    if (!modalCompletar) return;
    try {
      const r = await fetch(`${API}/mantenimiento/${modalCompletar.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: "COMPLETADO",
          tipo_servicio: modalCompletar.tipo_servicio,
          intervalo_dias: modalCompletar.intervalo_dias,
          ultimo_servicio_fecha: completarForm.ultimo_servicio_fecha,
          notas_completado: completarForm.notas,
        }),
      });
      const d = await r.json();
      if (d.error) return alert(d.error);
      setModalCompletar(null);
      cargar();
    } catch (e: any) { alert("Error: " + e.message); }
  };

  const eliminarPlan = async (id: number) => {
    if (!confirm("¿Eliminar este plan de mantenimiento?")) return;
    await fetch(`${API}/mantenimiento/${id}`, { method: "DELETE" });
    cargar();
  };

  // Filtrado
  const planesFiltrados = planes.filter(p => {
    if (filtro === "VENCIDO")   return p.semaforo === "rojo";
    if (filtro === "PROXIMO")   return p.semaforo === "amarillo";
    if (filtro === "AL_DIA")    return p.semaforo === "verde";
    return true;
  });

  const semColor = (s: string) => ({
    rojo:     "#ef4444",
    amarillo: "#f59e0b",
    verde:    "#10b981",
    gris:     "#9ca3af",
  }[s] || "#9ca3af");

  const semEmoji = (s: string) => ({
    rojo: "🔴", amarillo: "🟡", verde: "🟢", gris: "⚪"
  }[s] || "⚪");

  return (
    <div style={S.page}>
      {/* HEADER */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>🔧 Mantenimiento Preventivo</h1>
          <p style={S.subtitle}>SÓLIDO AUTO SERVICIO — Control de servicios programados</p>
        </div>
        <button onClick={() => setShowForm(f => !f)} style={S.btnPrimary}>
          {showForm ? "✕ Cancelar" : "➕ Nuevo Plan"}
        </button>
      </div>

      {/* KPIs */}
      {stats && (
        <div style={S.kpiRow}>
          <KpiCard icon="🔴" label="Vencidos"       value={stats.vencidos}      color="#ef4444" />
          <KpiCard icon="🟡" label="Próximos 7 días" value={stats.proximos7dias} color="#f59e0b" />
          <KpiCard icon="🟢" label="Al día"          value={stats.alDia}         color="#10b981" />
          <KpiCard icon="📋" label="Total activos"   value={stats.total}         color="#6366f1" />
        </div>
      )}

      {/* FORMULARIO NUEVO PLAN */}
      {showForm && (
        <div style={{ ...S.card, border: "2px solid #6366f1", marginBottom: 20 }}>
          <h3 style={{ ...S.cardTitle, color: "#4338ca" }}>📋 Nuevo Plan de Mantenimiento</h3>
          <div style={S.formGrid}>
            <div>
              <label style={S.label}>Vehículo</label>
              <select value={form.vehiculo_id} onChange={e => handleVehiculoChange(e.target.value)} style={S.input}>
                <option value="">— Seleccionar vehículo —</option>
                {vehiculos.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.marca} {v.modelo} ({v.placa})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={S.label}>Tipo de servicio</label>
              <select value={form.tipo_servicio} onChange={e => handleTipoChange(e.target.value)} style={S.input}>
                {TIPOS_SERVICIO.map(t => (
                  <option key={t} value={t}>{TIPO_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={S.label}>Último servicio (fecha)</label>
              <input type="date" value={form.ultimo_servicio_fecha}
                onChange={e => handleUltimaFechaChange(e.target.value)} style={S.input} />
            </div>
            <div>
              <label style={S.label}>Intervalo (días)</label>
              <input type="number" value={form.intervalo_dias}
                onChange={e => setForm(f => ({ ...f, intervalo_dias: e.target.value }))}
                style={S.input} placeholder="90" />
            </div>
            <div>
              <label style={S.label}>Próxima fecha (calculada)</label>
              <input type="date" value={form.proximo_fecha}
                onChange={e => setForm(f => ({ ...f, proximo_fecha: e.target.value }))}
                style={{ ...S.input, background: "#eff6ff" }} />
            </div>
            <div>
              <label style={S.label}>Intervalo en km (opcional)</label>
              <input type="number" value={form.intervalo_km}
                onChange={e => setForm(f => ({ ...f, intervalo_km: e.target.value }))}
                style={S.input} placeholder="5000" />
            </div>
          </div>
          <button onClick={guardarPlan} style={{ ...S.btnPrimary, width: "100%", marginTop: 8 }}>
            💾 Guardar Plan
          </button>
        </div>
      )}

      {/* FILTROS */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { key: "TODOS",   label: "📋 Todos", count: planes.length },
          { key: "VENCIDO", label: "🔴 Vencidos", count: stats?.vencidos || 0 },
          { key: "PROXIMO", label: "🟡 Próximos", count: stats?.proximos7dias || 0 },
          { key: "AL_DIA",  label: "🟢 Al día",   count: stats?.alDia || 0 },
        ].map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            style={filtro === f.key ? S.tabActive : S.tabInactive}>
            {f.label} <span style={S.badge}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* TABLA */}
      <div style={S.card}>
        <h3 style={S.cardTitle}>
          📋 Planes de Mantenimiento ({planesFiltrados.length})
        </h3>
        {loading ? (
          <p style={S.empty}>Cargando...</p>
        ) : planesFiltrados.length === 0 ? (
          <p style={S.empty}>No hay planes en este filtro.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {["", "Vehículo", "Cliente", "Tipo de Servicio", "Último Servicio",
                    "Próxima Fecha", "Días", "Estado", "Acciones"].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {planesFiltrados.map(p => (
                  <tr key={p.id} style={{ background: p.semaforo === "rojo" ? "#fff5f5" : "transparent" }}>
                    <td style={S.td}>{semEmoji(p.semaforo)}</td>
                    <td style={{ ...S.td, fontWeight: 700 }}>
                      <div>{p.vehiculo_info}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>{p.vehiculo_placa}</div>
                    </td>
                    <td style={S.td}>
                      <div style={{ fontSize: 13 }}>{p.cliente_nombre}</div>
                      {p.cliente_telefono && (
                        <div style={{ fontSize: 11, color: "#60a5fa" }}>📞 {p.cliente_telefono}</div>
                      )}
                    </td>
                    <td style={S.td}>{TIPO_LABEL[p.tipo_servicio] || p.tipo_servicio}</td>
                    <td style={S.td}>{fmtDate(p.ultimo_servicio_fecha)}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: semColor(p.semaforo) }}>
                      {fmtDate(p.proximo_fecha)}
                    </td>
                    <td style={{ ...S.td, fontWeight: 700, color: semColor(p.semaforo) }}>
                      {p.dias_restantes === null ? "—"
                        : p.dias_restantes < 0
                          ? `${Math.abs(p.dias_restantes)}d vencido`
                          : p.dias_restantes === 0
                            ? "Hoy"
                            : `${p.dias_restantes}d`}
                    </td>
                    <td style={S.td}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: p.semaforo === "rojo" ? "#fee2e2"
                          : p.semaforo === "amarillo" ? "#fef3c7" : "#dcfce7",
                        color: p.semaforo === "rojo" ? "#dc2626"
                          : p.semaforo === "amarillo" ? "#d97706" : "#16a34a",
                      }}>
                        {p.estado}
                      </span>
                    </td>
                    <td style={S.td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => {
                          setModalCompletar(p);
                          setCompletarForm({ ultimo_servicio_fecha: new Date().toISOString().slice(0, 10), notas: "" });
                        }} style={S.btnSmall}>✅ Completar</button>
                        <button onClick={() => eliminarPlan(p.id)}
                          style={{ ...S.btnSmall, background: "#fee2e2", color: "#dc2626" }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL COMPLETAR SERVICIO */}
      {modalCompletar && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <h3 style={{ ...S.cardTitle, marginBottom: 4 }}>✅ Completar Servicio</h3>
            <p style={{ color: "#555", fontSize: 14, marginBottom: 16 }}>
              {TIPO_LABEL[modalCompletar.tipo_servicio] || modalCompletar.tipo_servicio} —{" "}
              <strong>{modalCompletar.vehiculo_info}</strong>
            </p>
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Fecha en que se realizó el servicio</label>
              <input type="date" value={completarForm.ultimo_servicio_fecha}
                onChange={e => setCompletarForm(f => ({ ...f, ultimo_servicio_fecha: e.target.value }))}
                style={S.input} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Notas (opcional)</label>
              <textarea value={completarForm.notas}
                onChange={e => setCompletarForm(f => ({ ...f, notas: e.target.value }))}
                style={{ ...S.input, height: 70, resize: "vertical" as const }}
                placeholder="Observaciones del servicio..." />
            </div>
            <div style={{ background: "#eff6ff", borderRadius: 8, padding: 10, fontSize: 13, color: "#1e40af", marginBottom: 14 }}>
              ℹ️ El sistema calculará automáticamente la próxima fecha en{" "}
              <strong>{modalCompletar.intervalo_dias} días</strong>.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={completarServicio} style={{ ...S.btnPrimary, flex: 1, background: "#10b981" }}>
                ✅ Confirmar completado
              </button>
              <button onClick={() => setModalCompletar(null)}
                style={{ ...S.btnPrimary, flex: 1, background: "#6b7280" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
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
  tabActive: { padding: "9px 18px", borderRadius: 10, border: "none", background: "#111827",
               color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 },
  tabInactive: { padding: "9px 18px", borderRadius: 10, border: "1px solid #e2e8f0",
                 background: "#fff", color: "#374151", cursor: "pointer", fontWeight: 600, fontSize: 13 },
  badge:     { background: "rgba(255,255,255,0.2)", padding: "1px 7px", borderRadius: 20,
               fontSize: 11, marginLeft: 4 },
  table:     { width: "100%", borderCollapse: "collapse" },
  th:        { textAlign: "left", padding: "10px 12px", background: "#f8fafc", fontSize: 12,
               fontWeight: 700, color: "#555", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" },
  td:        { padding: "11px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 13 },
  empty:     { color: "#aaa", textAlign: "center", padding: "32px 0", fontStyle: "italic" },
  overlay:   { position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex",
               alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal:     { background: "#fff", borderRadius: 16, padding: 28, width: 460, maxWidth: "95vw",
               boxShadow: "0 20px 60px rgba(0,0,0,.3)" },
};
