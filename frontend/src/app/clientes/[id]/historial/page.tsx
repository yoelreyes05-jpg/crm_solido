"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { auditHeaders } from "@/lib/audit";
import GenerarCodigoPortal from "@/components/GenerarCodigoPortal";

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

  // Modales de la ficha unificada
  const [modalVehiculo, setModalVehiculo] = useState(false);
  const [modalMembresia, setModalMembresia] = useState<false | "nueva" | "renovar">(false);

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
  const membresia = data.membresia || null;
  const factPend = data.facturas_pendientes || { cantidad: 0, total: 0 };

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
          {factPend.cantidad > 0 && (
            <span
              onClick={() => setTab("facturas")}
              style={{ display: "inline-block", marginTop: 4, background: "#fef3c7", color: "#92400e", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              title="Ver facturas">
              💰 {factPend.cantidad} factura(s) pendiente(s) de cobro · {fmt(factPend.total)}
            </span>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            {cliente?.telefono && (
              <button onClick={whatsappDirecto} style={{ background: "#25d366", color: "#fff", border: "none", padding: "7px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                💬 WhatsApp
              </button>
            )}
            <button onClick={() => router.push("/citas")} style={{ background: "#111827", color: "#fff", border: "none", padding: "7px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              📅 Agendar cita
            </button>
            {/* Código de 8 dígitos para que el cliente entre al portal desde su
                celular. Imprescindible para quien no tiene teléfono ni correo
                en ficha: es su única vía de acceso.
                Se usa el id de la URL y no `cliente.id` para que el botón esté
                disponible aunque la ficha todavía esté cargando. */}
            <GenerarCodigoPortal
              clienteId={Number(id)}
              clienteNombre={cliente?.nombre}
              telefono={cliente?.telefono}
              etiqueta="Código de acceso al portal"
              estiloBoton={{ background: "#0ea5e9", color: "#fff", border: "none", padding: "7px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            />
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

      {/* 💎 MEMBRESÍA — estados: activa / sin membresía / vencida */}
      <WidgetMembresia
        membresia={membresia}
        onHacerMiembro={() => setModalMembresia("nueva")}
        onRenovar={() => setModalMembresia("renovar")}
      />

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
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <button onClick={() => setModalVehiculo(true)}
                style={{ padding: "8px 16px", background: "#111827", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                ➕ Agregar vehículo
              </button>
            </div>
            {vehiculos.length === 0 ? (
              <p style={empty}>
                Este cliente no tiene vehículos.{" "}
                <button onClick={() => setModalVehiculo(true)}
                  style={{ background: "none", border: "none", color: "#3b82f6", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                  Agregar el primero
                </button>
              </p>
            ) : (
            <table style={table}>
              <thead><tr>{["Marca", "Modelo", "Año", "Placa", "Color", "Último servicio", "Órdenes"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {vehiculos.map((v: any) => (
                  <tr key={v.id}>
                    <td style={td}>{v.marca}</td>
                    <td style={td}>{v.modelo}</td>
                    <td style={td}>{v.ano}</td>
                    <td style={td}><span style={{ background: "#1e3a5f", color: "#fff", padding: "3px 10px", borderRadius: 6, fontWeight: 700, fontSize: 13 }}>{v.placa}</span></td>
                    <td style={td}>{v.color || "—"}</td>
                    <td style={{ ...td, fontSize: 12 }}>
                      {v.ultimo_servicio
                        ? <>{fmtFecha(v.ultimo_servicio.created_at)} <span style={{ color: "#888" }}>· {v.ultimo_servicio.descripcion || v.ultimo_servicio.estado}</span></>
                        : <span style={{ color: "#aaa" }}>Sin servicios</span>}
                    </td>
                    <td style={{ ...td, fontWeight: 700, textAlign: "center" }}>{v.total_ordenes ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </>
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

      {/* ── MODALES ── */}
      {modalVehiculo && (
        <ModalVehiculoInline
          clienteId={String(id)}
          onCerrar={() => setModalVehiculo(false)}
          onCreado={() => { setModalVehiculo(false); cargar(); }}
        />
      )}
      {modalMembresia && (
        <ModalMembresia
          clienteId={String(id)}
          modo={modalMembresia}
          membresia={membresia}
          vehiculos={vehiculos}
          onCerrar={() => setModalMembresia(false)}
          onLista={() => { setModalMembresia(false); cargar(); }}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 💎 Widget de membresía — A: activa · B: sin membresía · C: vencida
// ────────────────────────────────────────────────────────────────
function WidgetMembresia({ membresia, onHacerMiembro, onRenovar }: {
  membresia: any; onHacerMiembro: () => void; onRenovar: () => void;
}) {
  // B — sin membresía
  if (!membresia) {
    return (
      <div style={{ ...wmCard, borderLeft: "5px solid #3b82f6", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>💎 Membresía</h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>Este cliente no es miembro todavía.</p>
        </div>
        <button onClick={onHacerMiembro}
          style={{ padding: "10px 22px", background: "linear-gradient(90deg,#2563eb,#7c3aed)", color: "#fff", border: "none", borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
          💎 Hacer miembro
        </button>
      </div>
    );
  }

  const plan = membresia.plan || {};

  // C — vencida o cancelada
  if (membresia.estado !== "ACTIVA") {
    return (
      <div style={{ ...wmCard, borderLeft: "5px solid #9ca3af", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#6b7280" }}>
            {plan.emoji || "💎"} {plan.nombre || "Membresía"} — {membresia.estado === "CANCELADA" ? "cancelada" : "vencida"}
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>
            Venció el {membresia.fecha_renovacion ? new Date(membresia.fecha_renovacion + "T12:00:00").toLocaleDateString("es-DO") : "—"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onRenovar}
            style={{ padding: "9px 20px", background: "#fff", color: "#2563eb", border: "2px solid #2563eb", borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
            🔄 Renovar
          </button>
          <button onClick={onHacerMiembro}
            style={{ padding: "9px 20px", background: "#f1f5f9", color: "#374151", border: "1px solid #e2e8f0", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Cambiar plan
          </button>
        </div>
      </div>
    );
  }

  // A — activa
  const uso = membresia.uso || {};
  const ben = membresia.beneficios || {};
  const restante = (disp: number) => disp < 0 ? "ilimitados" : `${disp} disponible(s)`;
  return (
    <div style={{ ...wmCard, borderLeft: `5px solid ${plan.color || "#10b981"}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
          {plan.emoji || "💎"} {plan.nombre}
          <span style={{ marginLeft: 10, background: "#dcfce7", color: "#16a34a", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800 }}>ACTIVA</span>
          <span style={{ marginLeft: 8, fontSize: 11, color: "#888", fontWeight: 600 }}>({membresia.ciclo === "ANUAL" ? "anual" : "mensual"})</span>
        </h3>
        <span style={{ fontSize: 12, color: "#888" }}>
          Renueva el {membresia.fecha_renovacion ? new Date(membresia.fecha_renovacion + "T12:00:00").toLocaleDateString("es-DO") : "—"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 10, flexWrap: "wrap", fontSize: 13 }}>
        {ben.lavados_mes !== undefined && (
          <span>🚿 Lavados: <b>{restante(uso.lavados_disponibles)}</b> este mes</span>
        )}
        {ben.diagnosticos_mes !== undefined && (
          <span>🔍 Diagnósticos: <b>{restante(uso.diagnosticos_disponibles)}</b> este mes</span>
        )}
        {Number(ben.desc_servicios) > 0 && <span>🔧 {ben.desc_servicios}% desc. servicios</span>}
        {Number(ben.desc_repuestos) > 0 && <span>⚙️ {ben.desc_repuestos}% desc. repuestos</span>}
        <span style={{ color: "#888" }}>🚗 {(membresia.vehiculo_ids || []).length} vehículo(s) amarrado(s)</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 🚗 Modal: agregar vehículo inline (con decodificación de VIN)
// ────────────────────────────────────────────────────────────────
function ModalVehiculoInline({ clienteId, onCerrar, onCreado }: {
  clienteId: string; onCerrar: () => void; onCreado: () => void;
}) {
  const [form, setForm] = useState({ placa: "", marca: "", modelo: "", ano: "", color: "", vin: "" });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [decodificando, setDecodificando] = useState(false);

  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  const decodificarVin = async () => {
    const vin = form.vin.trim().toUpperCase();
    if (vin.length !== 17) return setError("El VIN debe tener 17 caracteres");
    setDecodificando(true); setError("");
    try {
      const r = await fetch(`${API}/vin/${vin}`);
      const d = await r.json();
      if (d.error) return setError(d.error);
      setForm(f => ({
        ...f, vin,
        marca:  d.marca  || f.marca,
        modelo: d.modelo || f.modelo,
        ano:    d.ano ? String(d.ano) : f.ano,
      }));
    } catch { setError("No se pudo decodificar el VIN"); }
    finally { setDecodificando(false); }
  };

  const guardar = async () => {
    setGuardando(true); setError("");
    try {
      const r = await fetch(`${API}/clientes/${clienteId}/vehiculos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auditHeaders() },
        body: JSON.stringify({ ...form, ano: Number(form.ano) || null, vin: form.vin || null }),
      });
      const d = await r.json();
      if (!r.ok || d.error) return setError(d.error || "Error creando el vehículo");
      onCreado();
    } catch { setError("Error de conexión"); }
    finally { setGuardando(false); }
  };

  return (
    <div style={mOverlay} onClick={onCerrar}>
      <div style={mModal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>🚗 Agregar vehículo</h2>
          <button onClick={onCerrar} style={mCerrar}>×</button>
        </div>

        <label style={mLabel}>Placa *</label>
        <input value={form.placa} onChange={set("placa")} placeholder="A123456" style={mInput} />

        <label style={mLabel}>VIN (opcional — 17 caracteres)</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input value={form.vin} onChange={set("vin")} placeholder="1HGCM82633A004352"
            style={{ ...mInput, marginBottom: 0, flex: 1, fontFamily: "monospace" }} />
          <button onClick={decodificarVin} disabled={decodificando}
            style={{ padding: "0 14px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>
            {decodificando ? "..." : "🔎 Decodificar"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={mLabel}>Marca *</label>
            <input value={form.marca} onChange={set("marca")} placeholder="Toyota" style={mInput} />
          </div>
          <div>
            <label style={mLabel}>Modelo</label>
            <input value={form.modelo} onChange={set("modelo")} placeholder="Corolla" style={mInput} />
          </div>
          <div>
            <label style={mLabel}>Año</label>
            <input value={form.ano} onChange={set("ano")} placeholder="2020" style={mInput} />
          </div>
          <div>
            <label style={mLabel}>Color</label>
            <input value={form.color} onChange={set("color")} placeholder="Gris" style={mInput} />
          </div>
        </div>

        {error && <p style={{ color: "#dc2626", fontSize: 13, margin: "4px 0 10px" }}>{error}</p>}
        <button onClick={guardar} disabled={guardando || !form.placa.trim() || !form.marca.trim()}
          style={{ ...mBtnPrimario, opacity: guardando || !form.placa.trim() || !form.marca.trim() ? 0.5 : 1 }}>
          {guardando ? "Guardando…" : "💾 Guardar vehículo"}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 💎 Modal: hacer miembro / renovar (plan → vehículos → pago)
// Reutiliza POST /planes/membresias y /planes/membresias/:id/renovar
// ────────────────────────────────────────────────────────────────
function ModalMembresia({ clienteId, modo, membresia, vehiculos, onCerrar, onLista }: {
  clienteId: string; modo: "nueva" | "renovar"; membresia: any;
  vehiculos: any[]; onCerrar: () => void; onLista: () => void;
}) {
  const [planes, setPlanes] = useState<any[]>([]);
  const [plan, setPlan] = useState<any>(null);
  const [ciclo, setCiclo] = useState<"MENSUAL" | "ANUAL">("MENSUAL");
  const [seleccion, setSeleccion] = useState<number[]>([]);
  const [metodoPago, setMetodoPago] = useState("EFECTIVO");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const esRenovar = modo === "renovar" && membresia?.id;

  useEffect(() => {
    if (esRenovar) return;
    fetch(`${API}/planes`).then(r => r.json()).then(d => setPlanes(Array.isArray(d) ? d : [])).catch(() => {});
  }, [esRenovar]);

  const benDe = (p: any): Record<string, number> => {
    const m: Record<string, number> = {};
    (p?.plan_beneficios || []).forEach((b: any) => { m[b.tipo] = Number(b.valor); });
    return m;
  };
  const vmaxDe = (p: any) => {
    const b = benDe(p);
    return b.vehiculos_max !== undefined ? b.vehiculos_max : 1;
  };

  const toggleVehiculo = (vid: number) => {
    setSeleccion(s => {
      if (s.includes(vid)) return s.filter(x => x !== vid);
      const vmax = plan ? vmaxDe(plan) : 1;
      if (vmax >= 0 && s.length >= vmax) return s; // respeta el límite del plan
      return [...s, vid];
    });
  };

  const usuarioNombre = () => {
    try { return JSON.parse(localStorage.getItem("usuario") || "null")?.nombre || "Sistema"; }
    catch { return "Sistema"; }
  };

  const confirmar = async () => {
    setGuardando(true); setError("");
    try {
      const url = esRenovar
        ? `${API}/planes/membresias/${membresia.id}/renovar`
        : `${API}/planes/membresias`;
      const body = esRenovar
        ? { metodo_pago: metodoPago, usuario: usuarioNombre() }
        : { cliente_id: Number(clienteId), plan_id: plan.id, ciclo, metodo_pago: metodoPago, vehiculo_ids: seleccion, usuario: usuarioNombre() };
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auditHeaders() },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok || d.error) return setError(d.error || "Error procesando la membresía");
      onLista();
    } catch { setError("Error de conexión"); }
    finally { setGuardando(false); }
  };

  const precio = (p: any) => ciclo === "ANUAL" ? Number(p?.precio_anual || 0) : Number(p?.precio_mensual || 0);
  const planRenovar = esRenovar ? membresia.plan : null;
  const montoRenovar = esRenovar
    ? (membresia.ciclo === "ANUAL" ? Number(planRenovar?.precio_anual || 0) : Number(planRenovar?.precio_mensual || 0))
    : 0;

  return (
    <div style={mOverlay} onClick={onCerrar}>
      <div style={{ ...mModal, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>
            {esRenovar ? "🔄 Renovar membresía" : "💎 Hacer miembro"}
          </h2>
          <button onClick={onCerrar} style={mCerrar}>×</button>
        </div>

        {esRenovar ? (
          <p style={{ fontSize: 14, marginTop: 0 }}>
            {planRenovar?.emoji} <b>{planRenovar?.nombre}</b> ({membresia.ciclo === "ANUAL" ? "anual" : "mensual"}) — {fmt(montoRenovar)}
          </p>
        ) : (
          <>
            {/* Paso 1: ciclo + plan */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {(["MENSUAL", "ANUAL"] as const).map(c => (
                <button key={c} onClick={() => setCiclo(c)}
                  style={{ ...mChip, ...(ciclo === c ? mChipActivo : {}) }}>
                  {c === "MENSUAL" ? "Mensual" : "Anual"}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {planes.length === 0 && <p style={{ gridColumn: "1 / -1", color: "#888", fontSize: 13 }}>Cargando planes…</p>}
              {planes.map(p => {
                const b = benDe(p);
                const vmax = vmaxDe(p);
                return (
                  <button key={p.id}
                    onClick={() => { setPlan(p); setSeleccion(s => vmax >= 0 ? s.slice(0, vmax) : s); }}
                    style={{
                      textAlign: "left", padding: 12, borderRadius: 12, cursor: "pointer", background: "#fff",
                      border: plan?.id === p.id ? `2px solid ${p.color || "#2563eb"}` : "1px solid #e2e8f0",
                      boxShadow: plan?.id === p.id ? `0 0 0 3px ${p.color || "#2563eb"}22` : "none",
                    }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{p.emoji} {p.nombre}</div>
                    <div style={{ fontSize: 13, color: "#555" }}>{fmt(precio(p))}{ciclo === "ANUAL" ? "/año" : "/mes"}</div>
                    <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                      {b.lavados_mes !== undefined && <>{b.lavados_mes < 0 ? "Lavados ilimitados" : `${b.lavados_mes} lavado(s)/mes`} · </>}
                      {vmax < 0 ? "vehículos ilimitados" : `hasta ${vmax} vehículo(s)`}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Paso 2: vehículos a amarrar */}
            {plan && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px" }}>
                  Vehículos a amarrar ({seleccion.length}{vmaxDe(plan) >= 0 ? `/${vmaxDe(plan)}` : ""})
                </p>
                {(vehiculos || []).length === 0 ? (
                  <p style={{ fontSize: 13, color: "#888", margin: 0 }}>
                    El cliente no tiene vehículos — agrégalo primero desde la pestaña 🚗 Vehículos.
                  </p>
                ) : (
                  (vehiculos || []).map((v: any) => (
                    <label key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "4px 0", cursor: "pointer" }}>
                      <input type="checkbox" checked={seleccion.includes(v.id)} onChange={() => toggleVehiculo(v.id)} />
                      <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{v.placa}</span>
                      <span style={{ color: "#666" }}>— {v.marca} {v.modelo} {v.ano || ""}</span>
                    </label>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {/* Paso 3: forma de pago */}
        {(esRenovar || plan) && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px" }}>Forma de pago</p>
            <div style={{ display: "flex", gap: 8 }}>
              {["EFECTIVO", "TARJETA", "TRANSFERENCIA"].map(m => (
                <button key={m} onClick={() => setMetodoPago(m)}
                  style={{ ...mChip, ...(metodoPago === m ? mChipActivo : {}) }}>
                  {m.charAt(0) + m.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p style={{ color: "#dc2626", fontSize: 13, margin: "4px 0 10px" }}>{error}</p>}
        <button onClick={confirmar} disabled={guardando || (!esRenovar && !plan)}
          style={{ ...mBtnPrimario, background: "linear-gradient(90deg,#2563eb,#7c3aed)", opacity: guardando || (!esRenovar && !plan) ? 0.5 : 1 }}>
          {guardando ? "Procesando…"
            : esRenovar ? `🔄 Renovar — ${fmt(montoRenovar)}`
            : plan ? `💎 Activar ${plan.nombre} — ${fmt(precio(plan))}`
            : "Elige un plan"}
        </button>
      </div>
    </div>
  );
}

// Estilos de los modales y el widget de membresía
const wmCard: any = { background: "#fff", borderRadius: 14, padding: "16px 20px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: 20 };
const mOverlay: any = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
const mModal: any = { background: "#fff", borderRadius: 16, padding: 26, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" };
const mCerrar: any = { background: "none", border: "none", fontSize: 24, color: "#9ca3af", cursor: "pointer", lineHeight: 1 };
const mLabel: any = { display: "block", fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 4 };
const mInput: any = { display: "block", width: "100%", padding: 11, marginBottom: 12, borderRadius: 8, border: "1px solid #ddd", boxSizing: "border-box", fontSize: 14 };
const mBtnPrimario: any = { width: "100%", padding: 13, background: "#111827", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 800, fontSize: 14 };
const mChip: any = { padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13, color: "#374151" };
const mChipActivo: any = { border: "2px solid #2563eb", background: "#eff6ff", color: "#1d4ed8", fontWeight: 800 };

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
