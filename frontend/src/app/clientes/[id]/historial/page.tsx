"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL!;

const fmt = (n: number) => "RD$ " + Number(n || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 });
const fmtFecha = (d: string) => d ? new Date(d).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtFechaHora = (d: string) => d ? new Date(d).toLocaleString("es-DO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

const ESTADO_COLOR: Record<string, string> = {
  RECIBIDO: "#3b82f6", DIAGNOSTICO: "#f59e0b", REPARACION: "#ef4444",
  CONTROL_CALIDAD: "#8b5cf6", LISTO: "#10b981", ENTREGADO: "#6b7280"
};

const INTERACCION_ICON: Record<string, string> = {
  WHATSAPP: "💬", LLAMADA: "📞", EMAIL: "✉️", VISITA: "🏢", NOTA: "📝", SISTEMA: "⚙️",
};

const CITA_ESTADO: Record<string, { bg: string; color: string }> = {
  PENDIENTE:  { bg: "#fef3c7", color: "#d97706" },
  CONFIRMADA: { bg: "#dbeafe", color: "#1d4ed8" },
  COMPLETADA: { bg: "#dcfce7", color: "#16a34a" },
  CANCELADA:  { bg: "#fee2e2", color: "#dc2626" },
  NO_ASISTIO: { bg: "#f3f4f6", color: "#6b7280" },
};

type Tab = "resumen" | "ordenes" | "vehiculos" | "facturas" | "citas" | "interacciones";

export default function FichaCliente() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("resumen");

  // Memoria editable
  const [editandoNotas, setEditandoNotas] = useState(false);
  const [notas, setNotas] = useState("");
  const [prefContacto, setPrefContacto] = useState("");

  // Nueva interacción manual
  const [nuevaInt, setNuevaInt] = useState({ tipo: "NOTA", descripcion: "" });

  const cargar = useCallback(() => {
    fetch(`${API}/clientes/${id}/ficha`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setNotas(d.cliente?.notas || "");
        setPrefContacto(d.cliente?.preferencia_contacto || "");
      })
      .catch(console.error);
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  if (!data) return <div style={{ padding: 40, textAlign: "center" }}>Cargando ficha del cliente...</div>;

  const { cliente, vehiculos, ordenes, facturas, diagnosticos, citas, interacciones, mantenimientos, kpis } = data;

  const guardarMemoria = async () => {
    await fetch(`${API}/clientes/${id}/memoria`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notas, preferencia_contacto: prefContacto }),
    });
    setEditandoNotas(false);
    cargar();
  };

  const agregarInteraccion = async () => {
    if (!nuevaInt.descripcion.trim()) return alert("Escribe una descripción");
    await fetch(`${API}/clientes/${id}/interacciones`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nuevaInt),
    });
    setNuevaInt({ tipo: "NOTA", descripcion: "" });
    cargar();
  };

  const whatsappDirecto = () => {
    if (!cliente?.telefono) return;
    const msg = `Hola ${cliente.nombre} 👋, le saludamos de *Sólido Auto Servicio*. `;
    window.open(`https://wa.me/${cliente.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
    fetch(`${API}/clientes/${id}/interacciones`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "WHATSAPP", descripcion: "WhatsApp iniciado desde la ficha 360" }),
    }).then(() => cargar());
  };

  const proximosMant = (mantenimientos || []).slice(0, 4);
  const proximasCitas = (citas || []).filter((c: any) => ["PENDIENTE", "CONFIRMADA"].includes(c.estado)).slice(0, 3);

  return (
    <div style={container}>
      <button onClick={() => router.back()} style={btnBack}>← Volver</button>

      {/* HEADER — identidad + memoria */}
      <div style={headerCard}>
        <div style={{ fontSize: 48 }}>👤</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{cliente?.nombre}</h1>
            <span style={badge("#111827")}>Ficha 360</span>
            {cliente?.preferencia_contacto && (
              <span style={badge("#8b5cf6")}>Prefiere: {cliente.preferencia_contacto}</span>
            )}
          </div>
          <p style={{ color: "#888", margin: "4px 0" }}>
            📞 {cliente?.telefono || "Sin teléfono"} &nbsp;|&nbsp; ✉️ {cliente?.email || "Sin email"}
            {kpis?.cliente_desde && <> &nbsp;|&nbsp; 🤝 Cliente desde {fmtFecha(kpis.cliente_desde)}</>}
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            {cliente?.telefono && (
              <button onClick={whatsappDirecto} style={{ background: "#25d366", color: "#fff", border: "none", padding: "7px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                💬 WhatsApp
              </button>
            )}
            <button onClick={() => router.push("/citas")} style={{ background: "#111827", color: "#fff", border: "none", padding: "7px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              📅 Agendar cita
            </button>
          </div>
        </div>
        {/* KPIs de la relación */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <MiniKpi label="Total gastado" value={fmt(kpis?.total_gastado || 0)} color="#10b981" />
          <MiniKpi label="Visitas" value={String(kpis?.visitas ?? 0)} color="#3b82f6" />
          <MiniKpi label="Última visita" value={kpis?.ultima_visita ? fmtFecha(kpis.ultima_visita) : "—"} color="#f59e0b" />
        </div>
      </div>

      {/* MEMORIA DEL CLIENTE — notas y preferencias */}
      <div style={{ ...card, marginBottom: 20, borderLeft: "5px solid #8b5cf6" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>🧠 Memoria del cliente</h3>
          {!editandoNotas
            ? <button onClick={() => setEditandoNotas(true)} style={btnMini}>✏️ Editar</button>
            : <div style={{ display: "flex", gap: 6 }}>
                <button onClick={guardarMemoria} style={{ ...btnMini, background: "#10b981", color: "#fff" }}>💾 Guardar</button>
                <button onClick={() => { setEditandoNotas(false); setNotas(cliente?.notas || ""); setPrefContacto(cliente?.preferencia_contacto || ""); }} style={btnMini}>Cancelar</button>
              </div>}
        </div>
        {editandoNotas ? (
          <>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>Canal preferido de contacto</label>
              <select value={prefContacto} onChange={e => setPrefContacto(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}>
                <option value="">— Sin definir —</option>
                <option value="WHATSAPP">💬 WhatsApp</option>
                <option value="LLAMADA">📞 Llamada</option>
                <option value="EMAIL">✉️ Email</option>
              </select>
            </div>
            <textarea value={notas} onChange={e => setNotas(e.target.value)}
              placeholder='Ej: "Siempre pide factura con NCF", "Prefiere que lo llamen en la tarde", "Cliente exigente con la limpieza"...'
              style={{ width: "100%", minHeight: 80, padding: 12, borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: cliente?.notas ? "#374151" : "#aaa", whiteSpace: "pre-wrap" }}>
            {cliente?.notas || "Sin notas todavía. Anota aquí las preferencias y detalles importantes de este cliente — el CRM los recordará por ti."}
          </p>
        )}
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {([
          { key: "resumen",       label: "⭐ Resumen" },
          { key: "ordenes",       label: `🧾 Órdenes (${ordenes.length})` },
          { key: "vehiculos",     label: `🚗 Vehículos (${vehiculos.length})` },
          { key: "facturas",      label: `💰 Facturas (${facturas.length})` },
          { key: "citas",         label: `📅 Citas (${citas.length})` },
          { key: "interacciones", label: `💬 Interacciones (${interacciones.length})` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ ...tabBtn, background: tab === t.key ? "#111827" : "#fff", color: tab === t.key ? "#fff" : "#111" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={card}>
        {/* ── RESUMEN ── */}
        {tab === "resumen" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <h4 style={h4}>🔧 Próximos mantenimientos</h4>
              {proximosMant.length === 0 ? <p style={empty}>Sin mantenimientos programados</p> :
                proximosMant.map((m: any) => {
                  const dias = m.proximo_fecha ? Math.ceil((new Date(m.proximo_fecha).getTime() - Date.now()) / 86400000) : null;
                  const vencido = dias !== null && dias < 0;
                  return (
                    <div key={m.id} style={{ ...miniRow, borderLeft: `4px solid ${vencido ? "#ef4444" : dias !== null && dias <= 7 ? "#f59e0b" : "#10b981"}` }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{m.tipo_servicio?.replace(/_/g, " ")}</div>
                      <div style={{ fontSize: 12, color: vencido ? "#dc2626" : "#666" }}>
                        {m.proximo_fecha ? fmtFecha(m.proximo_fecha) : "—"}
                        {dias !== null && (vencido ? ` · ${Math.abs(dias)}d vencido 🔴` : ` · en ${dias}d`)}
                      </div>
                    </div>
                  );
                })}
              <h4 style={{ ...h4, marginTop: 20 }}>📅 Citas pendientes</h4>
              {proximasCitas.length === 0 ? <p style={empty}>Sin citas pendientes</p> :
                proximasCitas.map((c: any) => (
                  <div key={c.id} style={{ ...miniRow, borderLeft: "4px solid #3b82f6" }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{fmtFecha(c.fecha)} · {c.hora}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{c.tipo_servicio?.replace(/_/g, " ") || c.descripcion || "Servicio"} — {c.estado}</div>
                  </div>
                ))}
            </div>
            <div>
              <h4 style={h4}>💬 Últimos contactos</h4>
              {interacciones.length === 0 ? <p style={empty}>Sin interacciones registradas</p> :
                interacciones.slice(0, 6).map((i: any) => (
                  <div key={i.id} style={{ ...miniRow, borderLeft: "4px solid #8b5cf6" }}>
                    <div style={{ fontSize: 13 }}>
                      {INTERACCION_ICON[i.tipo] || "📝"} <b>{i.tipo}</b> — {fmtFechaHora(i.created_at)}
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>{i.descripcion}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── ÓRDENES ── */}
        {tab === "ordenes" && (
          ordenes.length === 0 ? <p style={empty}>Sin órdenes registradas</p> :
          <table style={table}>
            <thead><tr>{["#", "Descripción", "Estado", "Total", "Fecha"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {ordenes.map((o: any) => (
                <tr key={o.id}>
                  <td style={td}>#{o.id}</td>
                  <td style={td}>{o.descripcion}</td>
                  <td style={td}>
                    <span style={{ background: ESTADO_COLOR[o.estado] || "#888", color: "#fff", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                      {o.estado}
                    </span>
                  </td>
                  <td style={td}>{fmt(o.total)}</td>
                  <td style={td}>{fmtFecha(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── VEHÍCULOS ── */}
        {tab === "vehiculos" && (
          vehiculos.length === 0 ? <p style={empty}>Sin vehículos registrados</p> :
          <table style={table}>
            <thead><tr>{["Marca", "Modelo", "Año", "Placa", "Color"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {vehiculos.map((v: any) => (
                <tr key={v.id}>
                  <td style={td}>{v.marca}</td>
                  <td style={td}>{v.modelo}</td>
                  <td style={td}>{v.ano}</td>
                  <td style={td}><span style={{ background: "#1e3a5f", color: "#fff", padding: "3px 10px", borderRadius: 6, fontWeight: 700, fontSize: 13 }}>{v.placa}</span></td>
                  <td style={td}>{v.color || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── FACTURAS ── */}
        {tab === "facturas" && (
          facturas.length === 0 ? <p style={empty}>Sin facturas registradas</p> :
          <table style={table}>
            <thead><tr>{["Factura", "NCF", "Total", "Método", "Fecha"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {facturas.map((v: any) => (
                <tr key={v.id}>
                  <td style={td}><b>FAC-{String(v.id).padStart(5, "0")}</b></td>
                  <td style={{ ...td, fontSize: 12 }}>{v.ncf}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{fmt(v.total)}</td>
                  <td style={td}>{v.metodo_pago || "—"}</td>
                  <td style={td}>{fmtFecha(v.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── CITAS ── */}
        {tab === "citas" && (
          citas.length === 0 ? <p style={empty}>Sin citas registradas. Agenda una desde el botón "📅 Agendar cita".</p> :
          <table style={table}>
            <thead><tr>{["Fecha", "Hora", "Servicio", "Estado", "Recordada"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {citas.map((c: any) => {
                const est = CITA_ESTADO[c.estado] || CITA_ESTADO.PENDIENTE;
                return (
                  <tr key={c.id}>
                    <td style={{ ...td, fontWeight: 700 }}>{fmtFecha(c.fecha)}</td>
                    <td style={td}>{c.hora}</td>
                    <td style={td}>{c.tipo_servicio?.replace(/_/g, " ") || c.descripcion || "—"}</td>
                    <td style={td}>
                      <span style={{ background: est.bg, color: est.color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{c.estado}</span>
                    </td>
                    <td style={td}>{c.recordatorio_enviado ? "✅" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* ── INTERACCIONES ── */}
        {tab === "interacciones" && (
          <>
            {/* Registrar contacto manual */}
            <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
              <select value={nuevaInt.tipo} onChange={e => setNuevaInt(n => ({ ...n, tipo: e.target.value }))}
                style={{ padding: "10px 12px", borderRadius: 9, border: "1px solid #e2e8f0", fontSize: 13, background: "#fafafa" }}>
                <option value="NOTA">📝 Nota</option>
                <option value="LLAMADA">📞 Llamada</option>
                <option value="WHATSAPP">💬 WhatsApp</option>
                <option value="EMAIL">✉️ Email</option>
                <option value="VISITA">🏢 Visita</option>
              </select>
              <input value={nuevaInt.descripcion}
                onChange={e => setNuevaInt(n => ({ ...n, descripcion: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && agregarInteraccion()}
                placeholder="Ej: Llamó preguntando por el precio del cambio de correa..."
                style={{ flex: 1, minWidth: 250, padding: "10px 14px", borderRadius: 9, border: "1px solid #e2e8f0", fontSize: 13, background: "#fafafa" }} />
              <button onClick={agregarInteraccion}
                style={{ padding: "10px 20px", background: "#111827", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                ➕ Registrar
              </button>
            </div>
            {/* Timeline */}
            {interacciones.length === 0 ? <p style={empty}>Sin interacciones. Cada WhatsApp, llamada o nota quedará registrada aquí.</p> :
              interacciones.map((i: any) => (
                <div key={i.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <div style={{ fontSize: 20, width: 28, textAlign: "center" }}>{INTERACCION_ICON[i.tipo] || "📝"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{i.descripcion}</div>
                    <div style={{ fontSize: 11, color: "#999" }}>
                      {fmtFechaHora(i.created_at)} {i.usuario_nombre && `· por ${i.usuario_nombre}`}
                    </div>
                  </div>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}

function MiniKpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 12, padding: "10px 16px", minWidth: 110, borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "#888" }}>{label}</div>
    </div>
  );
}

const container: any = { padding: 20, background: "#f5f7fb", minHeight: "100vh" };
const headerCard: any = { background: "#fff", borderRadius: 16, padding: 24, display: "flex", gap: 20, alignItems: "center", marginBottom: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", flexWrap: "wrap" };
const card: any = { background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" };
const tabBtn: any = { padding: "9px 16px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", fontWeight: 600, fontSize: 13 };
const btnBack: any = { marginBottom: 16, padding: "8px 16px", background: "#f1f5f9", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontWeight: 600 };
const btnMini: any = { padding: "5px 12px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 7, cursor: "pointer", fontWeight: 600, fontSize: 12 };
const badge = (color: string): any => ({ background: color, color: "#fff", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 });
const table: any = { width: "100%", borderCollapse: "collapse" };
const th: any = { textAlign: "left", padding: "10px 12px", background: "#f8fafc", fontSize: 13, fontWeight: 600 };
const td: any = { padding: "10px 12px", borderBottom: "1px solid #eee", fontSize: 14 };
const empty: any = { textAlign: "center", color: "#888", padding: 20, fontSize: 13 };
const h4: any = { fontSize: 14, fontWeight: 700, margin: "0 0 10px", color: "#374151" };
const miniRow: any = { background: "#f8fafc", borderRadius: 8, padding: "8px 12px", marginBottom: 8 };
