"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL as API } from "@/config";

// ── Config de estados ─────────────────────────────────────────────────────────
const ESTADO_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  RECIBIDO:             { color: "#1d4ed8", bg: "#dbeafe", icon: "📥", label: "Recibido" },
  DIAGNOSTICO:          { color: "#92400e", bg: "#fef3c7", icon: "🔬", label: "Diagnóstico" },
  ESPERANDO_APROBACION: { color: "#c2410c", bg: "#ffedd5", icon: "⏳", label: "Esp. Aprobación" },
  REPARACION:           { color: "#991b1b", bg: "#fee2e2", icon: "🔧", label: "Reparación" },
  CONTROL_CALIDAD:      { color: "#5b21b6", bg: "#ede9fe", icon: "✅", label: "Control Calidad" },
  LISTO:                { color: "#065f46", bg: "#d1fae5", icon: "🎉", label: "Listo" },
  ENTREGADO:            { color: "#374151", bg: "#f3f4f6", icon: "🏁", label: "Entregado" },
  CANCELADA:            { color: "#7f1d1d", bg: "#fee2e2", icon: "❌", label: "Cancelada" },
};

export default function OrdenDetallePage() {
  const { id } = useParams() as { id: string };
  const router  = useRouter();

  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [usuario, setUsuario] = useState<any>(null);

  // Modal aprobar/rechazar
  const [modalAccion, setModalAccion] = useState<"aprobar" | "rechazar" | "calidad" | "entregar" | null>(null);
  const [motivoModal, setMotivoModal] = useState("");
  const [procesando, setProcesando]   = useState(false);
  const [msg, setMsg]                 = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);

  // Diagnóstico / Avances
  const [diagForm, setDiagForm]   = useState({ hallazgos: "", tecnico_nombre: "", tipo_servicio: "" });
  const [avanceTexto, setAvanceTexto] = useState("");
  const [guardandoDiag, setGuardandoDiag] = useState(false);
  const [guardandoAvance, setGuardandoAvance] = useState(false);
  const [marcandoTerminado, setMarcandoTerminado] = useState(false);

  const cargar = async () => {
    try {
      const res = await fetch(`${API}/ordenes/${id}`);
      const json = await res.json();
      setData(json);
      if (json.diagnostico) {
        setDiagForm({
          hallazgos:      json.diagnostico.hallazgos      || json.diagnostico.descripcion || "",
          tecnico_nombre: json.diagnostico.tecnico_nombre || "",
          tipo_servicio:  json.diagnostico.tipo_servicio  || "",
        });
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => {
    try { setUsuario(JSON.parse(localStorage.getItem("usuario") || "{}")); } catch {}
    cargar();
  }, [id]);

  // ── Acción de flujo ───────────────────────────────────────────────────────
  const ejecutarAccion = async (accion: string) => {
    setProcesando(true);
    setMsg(null);
    try {
      const endpoint = { aprobar: "aprobar", rechazar: "rechazar", calidad: "calidad-aprobada", entregar: "entregar" }[accion];
      const res = await fetch(`${API}/ordenes/${id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id: usuario?.id, usuario_nombre: usuario?.nombre, motivo: motivoModal }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMsg({ tipo: "ok", texto: json.mensaje || "Acción ejecutada" });
      setModalAccion(null); setMotivoModal("");
      await cargar();
    } catch (err: any) {
      setMsg({ tipo: "err", texto: err.message });
    }
    setProcesando(false);
  };

  // ── Guardar diagnóstico ───────────────────────────────────────────────────
  const guardarDiagnostico = async () => {
    setGuardandoDiag(true);
    try {
      const hasDiag = data?.diagnostico;
      let res;
      if (hasDiag) {
        res = await fetch(`${API}/diagnosticos/${hasDiag.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hallazgos: diagForm.hallazgos, tecnico_nombre: diagForm.tecnico_nombre, tipo_servicio: diagForm.tipo_servicio, usuario_id: usuario?.id, usuario_nombre: usuario?.nombre }),
        });
      } else {
        res = await fetch(`${API}/diagnosticos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orden_id: Number(id), cliente_id: data?.cliente?.id, vehiculo_id: data?.vehiculo?.id,
            hallazgos: diagForm.hallazgos, tecnico_nombre: diagForm.tecnico_nombre,
            tipo_servicio: diagForm.tipo_servicio, usuario_id: usuario?.id, usuario_nombre: usuario?.nombre,
          }),
        });
      }
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMsg({ tipo: "ok", texto: "Diagnóstico guardado" });
      await cargar();
    } catch (err: any) { setMsg({ tipo: "err", texto: err.message }); }
    setGuardandoDiag(false);
  };

  // ── Registrar avance ──────────────────────────────────────────────────────
  const registrarAvance = async () => {
    if (!avanceTexto.trim()) return;
    setGuardandoAvance(true);
    try {
      const res = await fetch(`${API}/avances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnostico_id: data?.diagnostico?.id, descripcion: avanceTexto,
          tecnico_nombre: diagForm.tecnico_nombre || usuario?.nombre,
          usuario_id: usuario?.id,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setAvanceTexto(""); setMsg({ tipo: "ok", texto: "Avance registrado" });
      await cargar();
    } catch (err: any) { setMsg({ tipo: "err", texto: err.message }); }
    setGuardandoAvance(false);
  };

  // ── Marcar reparación terminada ───────────────────────────────────────────
  const marcarTerminado = async () => {
    setMarcandoTerminado(true);
    try {
      const res = await fetch(`${API}/diagnosticos/${data?.diagnostico?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "TERMINADO", terminado: true, usuario_id: usuario?.id, usuario_nombre: usuario?.nombre }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMsg({ tipo: "ok", texto: "Reparación marcada como terminada → Control de Calidad" });
      await cargar();
    } catch (err: any) { setMsg({ tipo: "err", texto: err.message }); }
    setMarcandoTerminado(false);
  };

  // ── Acciones disponibles según estado ────────────────────────────────────
  const getAcciones = (estado: string) => {
    if (estado === "DIAGNOSTICO") return [
      { key: "aprobar",  label: "✅ Cliente Aprobó",    color: "#16a34a" },
      { key: "rechazar", label: "❌ Cliente Rechazó",   color: "#dc2626" },
    ];
    if (estado === "CONTROL_CALIDAD") return [
      { key: "calidad", label: "✅ Aprobó Prueba de Calidad", color: "#7c3aed" },
    ];
    if (estado === "LISTO") return [
      { key: "entregar", label: "🏁 Vehículo Entregado", color: "#1d4ed8" },
    ];
    return [];
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <div style={{ padding: 40, color: "#6b7280" }}>Cargando orden...</div>;
  if (!data?.orden) return <div style={{ padding: 40, color: "#ef4444" }}>Orden #{id} no encontrada.</div>;

  const { orden, cliente, vehiculo, diagnostico, log, inspeccion } = data;
  const estado  = orden.estado || "RECIBIDO";
  const estadoC = ESTADO_CONFIG[estado] || ESTADO_CONFIG.RECIBIDO;
  const acciones = getAcciones(estado);
  const puedeEditarDiag = ["DIAGNOSTICO","REPARACION"].includes(estado);
  const puedeAvance     = estado === "REPARACION" && diagnostico;
  const puedeTerminar   = estado === "REPARACION" && diagnostico;

  const sty = {
    card: { background: "#fff", borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.07)" } as React.CSSProperties,
    sectionTitle: { fontWeight: 800, fontSize: 15, color: "#111", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #f3f4f6" } as React.CSSProperties,
    label: { fontSize: 12, color: "#6b7280", fontWeight: 600, marginBottom: 4, display: "block" } as React.CSSProperties,
    input: { width: "100%", padding: "9px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, boxSizing: "border-box" } as React.CSSProperties,
    textarea: { width: "100%", padding: "9px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, minHeight: 90, resize: "vertical", boxSizing: "border-box" } as React.CSSProperties,
  };

  return (
    <div style={{ padding: "24px 28px", maxWidth: 960, margin: "0 auto" }}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={() => router.back()}
          style={{ background: "#f3f4f6", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          ← Volver
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Orden #{id}</h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>
            {new Date(orden.created_at).toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        {/* Badge estado */}
        <span style={{
          background: estadoC.bg, color: estadoC.color,
          padding: "6px 16px", borderRadius: 20, fontWeight: 800, fontSize: 14,
          border: `1.5px solid ${estadoC.color}33`,
        }}>
          {estadoC.icon} {estadoC.label}
        </span>

        {/* Botón inspección */}
        <Link href={`/inspeccion/${id}`} style={{ marginLeft: "auto" }}>
          <button style={{
            padding: "8px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0",
            borderRadius: 9, cursor: "pointer", color: "#065f46", fontWeight: 700, fontSize: 13,
          }}>
            📋 {inspeccion ? "Ver Inspección" : "Registrar Inspección"}
          </button>
        </Link>
      </div>

      {/* Mensaje de feedback */}
      {msg && (
        <div style={{
          padding: "10px 16px", borderRadius: 10, marginBottom: 16, fontWeight: 600, fontSize: 14,
          background: msg.tipo === "ok" ? "#d1fae5" : "#fee2e2",
          color: msg.tipo === "ok" ? "#065f46" : "#991b1b",
          border: `1px solid ${msg.tipo === "ok" ? "#6ee7b7" : "#fca5a5"}`,
        }}>
          {msg.tipo === "ok" ? "✅" : "❌"} {msg.texto}
        </div>
      )}

      {/* ── Grid principal ─────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Cliente */}
        <div style={sty.card}>
          <div style={sty.sectionTitle}>👤 Cliente</div>
          {cliente ? (
            <>
              <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 15 }}>{cliente.nombre}</p>
              <p style={{ margin: "0 0 2px", color: "#6b7280", fontSize: 13 }}>📞 {cliente.telefono || "—"}</p>
              <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>✉️ {cliente.email || "—"}</p>
            </>
          ) : <p style={{ color: "#9ca3af", margin: 0 }}>Sin cliente</p>}
        </div>

        {/* Vehículo */}
        <div style={sty.card}>
          <div style={sty.sectionTitle}>🚗 Vehículo</div>
          {vehiculo ? (
            <>
              <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 15 }}>{vehiculo.marca} {vehiculo.modelo} {vehiculo.ano}</p>
              <p style={{ margin: "0 0 2px", color: "#6b7280", fontSize: 13 }}>🪪 Placa: <b style={{ color: "#111" }}>{vehiculo.placa}</b></p>
              <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>🎨 Color: {vehiculo.color || "—"}</p>
            </>
          ) : <p style={{ color: "#9ca3af", margin: 0 }}>Sin vehículo</p>}
        </div>
      </div>

      {/* ── Inspección resumen ──────────────────────────────────────────── */}
      {inspeccion && (
        <div style={{ ...sty.card, borderLeft: "4px solid #10b981" }}>
          <div style={sty.sectionTitle}>📋 Inspección de Recepción</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, fontSize: 13 }}>
            <div><span style={{ color: "#6b7280" }}>KM entrada:</span> <b>{inspeccion.km_entrada?.toLocaleString() || "—"}</b></div>
            <div><span style={{ color: "#6b7280" }}>Combustible:</span> <b>{inspeccion.nivel_combustible}%</b></div>
            <div><span style={{ color: "#6b7280" }}>Condición:</span> <b>{inspeccion.condicion_general || "—"}</b></div>
          </div>
          {inspeccion.observaciones && (
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "#374151" }}>📝 {inspeccion.observaciones}</p>
          )}
          {inspeccion.fotos?.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {inspeccion.fotos.slice(0, 5).map((f: any, i: number) => (
                <img key={i} src={f.data} alt={f.label}
                  style={{ width: 70, height: 55, objectFit: "cover", borderRadius: 7, border: "1px solid #e5e7eb" }} />
              ))}
              {inspeccion.fotos.length > 5 && (
                <div style={{ width: 70, height: 55, background: "#f3f4f6", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
                  +{inspeccion.fotos.length - 5}
                </div>
              )}
            </div>
          )}
          <Link href={`/inspeccion/${id}`} style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: "#059669", fontWeight: 700, textDecoration: "none" }}>
            Ver inspección completa →
          </Link>
        </div>
      )}

      {/* ── Diagnóstico ─────────────────────────────────────────────────── */}
      <div style={sty.card}>
        <div style={sty.sectionTitle}>🔬 Diagnóstico</div>

        {puedeEditarDiag || !diagnostico ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={sty.label}>Técnico responsable</label>
                <input value={diagForm.tecnico_nombre} onChange={e => setDiagForm(p => ({ ...p, tecnico_nombre: e.target.value }))}
                  placeholder="Nombre del técnico" style={sty.input} />
              </div>
              <div>
                <label style={sty.label}>Tipo de servicio</label>
                <input value={diagForm.tipo_servicio} onChange={e => setDiagForm(p => ({ ...p, tipo_servicio: e.target.value }))}
                  placeholder="Ej: Cambio de aceite, Frenos..." style={sty.input} />
              </div>
            </div>
            <div>
              <label style={sty.label}>Hallazgos / Descripción del diagnóstico</label>
              <textarea value={diagForm.hallazgos} onChange={e => setDiagForm(p => ({ ...p, hallazgos: e.target.value }))}
                style={sty.textarea} placeholder="Describe los hallazgos encontrados en el vehículo..." />
            </div>
            <button onClick={guardarDiagnostico} disabled={guardandoDiag}
              style={{ marginTop: 12, padding: "9px 20px", background: "linear-gradient(135deg,#4c1d95,#8b5cf6)", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
              {guardandoDiag ? "Guardando..." : diagnostico ? "💾 Actualizar diagnóstico" : "💾 Crear diagnóstico"}
            </button>
          </>
        ) : (
          <div style={{ fontSize: 14, color: "#374151" }}>
            <p style={{ margin: "0 0 6px" }}><b>Técnico:</b> {diagnostico.tecnico_nombre || "—"}</p>
            <p style={{ margin: "0 0 6px" }}><b>Tipo:</b> {diagnostico.tipo_servicio || "—"}</p>
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}><b>Hallazgos:</b> {diagnostico.hallazgos || diagnostico.descripcion || "Sin descripción"}</p>
          </div>
        )}

        {/* Avances de reparación */}
        {diagnostico && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #f3f4f6" }}>
            <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: "#374151" }}>📋 Avances de Reparación</p>

            {(data.diagnostico?.avances || []).length === 0 && (
              <p style={{ color: "#9ca3af", fontSize: 13 }}>Sin avances registrados aún.</p>
            )}
            {(data.diagnostico?.avances || []).map((av: any) => (
              <div key={av.id} style={{ marginBottom: 8, padding: "8px 12px", background: "#f9fafb", borderRadius: 8, borderLeft: "3px solid #8b5cf6" }}>
                <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 600 }}>{av.descripcion}</p>
                <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{av.tecnico_nombre} · {new Date(av.created_at).toLocaleString("es-DO")}</p>
              </div>
            ))}

            {puedeAvance && (
              <div style={{ marginTop: 10 }}>
                <textarea value={avanceTexto} onChange={e => setAvanceTexto(e.target.value)}
                  style={{ ...sty.textarea, minHeight: 60 }}
                  placeholder="Describe el trabajo realizado en este avance..." />
                <button onClick={registrarAvance} disabled={guardandoAvance || !avanceTexto.trim()}
                  style={{ marginTop: 8, padding: "8px 18px", background: "#4c1d95", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                  {guardandoAvance ? "Registrando..." : "➕ Registrar avance"}
                </button>
              </div>
            )}

            {puedeTerminar && (
              <button onClick={marcarTerminado} disabled={marcandoTerminado}
                style={{ marginTop: 12, padding: "10px 22px", background: "linear-gradient(135deg,#065f46,#10b981)", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 800, fontSize: 14, display: "block" }}>
                {marcandoTerminado ? "Procesando..." : "✅ Marcar reparación como TERMINADA"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Acciones de flujo ───────────────────────────────────────────── */}
      {acciones.length > 0 && (
        <div style={sty.card}>
          <div style={sty.sectionTitle}>⚡ Acción requerida</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {acciones.map(a => (
              <button key={a.key} onClick={() => { setModalAccion(a.key as any); setMotivoModal(""); }}
                style={{ padding: "11px 24px", background: a.color, color: "#fff", border: "none", borderRadius: 11, cursor: "pointer", fontWeight: 800, fontSize: 14, boxShadow: `0 4px 14px ${a.color}55` }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Timeline de estados (log de auditoría) ──────────────────────── */}
      <div style={sty.card}>
        <div style={sty.sectionTitle}>📜 Historial de la Orden</div>
        {(!log || log.length === 0) ? (
          <p style={{ color: "#9ca3af", fontSize: 13 }}>Sin registros de auditoría. (Ejecuta el SQL de la Fase 1)</p>
        ) : (
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 16, top: 0, bottom: 0, width: 2, background: "#e5e7eb" }} />
            {log.map((entry: any, i: number) => {
              const ec = ESTADO_CONFIG[entry.estado_nuevo] || { icon: "🔄", color: "#6b7280", bg: "#f3f4f6", label: entry.estado_nuevo };
              return (
                <div key={entry.id || i} style={{ display: "flex", gap: 14, marginBottom: 16, paddingLeft: 4, position: "relative" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: ec.bg, color: ec.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, zIndex: 1,
                    border: `2px solid ${ec.color}44`,
                  }}>
                    {ec.icon}
                  </div>
                  <div style={{ flex: 1, paddingTop: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: ec.color }}>{ec.label}</span>
                      {entry.estado_anterior && (
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>
                          (antes: {ESTADO_CONFIG[entry.estado_anterior]?.label || entry.estado_anterior})
                        </span>
                      )}
                    </div>
                    {entry.motivo && (
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>📝 {entry.motivo}</p>
                    )}
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af" }}>
                      👤 {entry.usuario_nombre || "Sistema"} ·{" "}
                      {new Date(entry.created_at).toLocaleString("es-DO", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal confirmación ───────────────────────────────────────────── */}
      {modalAccion && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999
        }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 28, minWidth: 340, boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>
              {modalAccion === "aprobar"  && "✅ Confirmar aprobación del cliente"}
              {modalAccion === "rechazar" && "❌ Confirmar rechazo del cliente"}
              {modalAccion === "calidad"  && "✅ Confirmar control de calidad aprobado"}
              {modalAccion === "entregar" && "🏁 Confirmar entrega del vehículo"}
            </h3>
            <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 14 }}>
              Esta acción cambiará el estado de la orden de forma permanente.
            </p>
            <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, display: "block", marginBottom: 4 }}>
              Motivo / Notas (opcional)
            </label>
            <textarea value={motivoModal} onChange={e => setMotivoModal(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, minHeight: 60, resize: "vertical", boxSizing: "border-box", marginBottom: 16 }}
              placeholder="Observaciones adicionales..." />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setModalAccion(null); setMotivoModal(""); }}
                style={{ flex: 1, padding: "10px", background: "#f3f4f6", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 700 }}>
                Cancelar
              </button>
              <button onClick={() => ejecutarAccion(modalAccion)} disabled={procesando}
                style={{
                  flex: 1, padding: "10px",
                  background: modalAccion === "rechazar" ? "#dc2626" : "#16a34a",
                  color: "#fff", border: "none", borderRadius: 9, cursor: procesando ? "not-allowed" : "pointer", fontWeight: 800
                }}>
                {procesando ? "Procesando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
