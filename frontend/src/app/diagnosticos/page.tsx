"use client";
import { useEffect, useState, useCallback } from "react";
import { API_URL as API } from "@/config";

const TIPOS_SERVICIO = [
  "CAMBIO DE ACEITE", "ALINEACIÓN Y BALANCEO", "FRENOS", "SUSPENSIÓN",
  "SISTEMA ELÉCTRICO", "SISTEMA ELECTRÓNICO / SCANNER", "TRANSMISIÓN",
  "MOTOR", "AIRE ACONDICIONADO", "DIAGNÓSTICO GENERAL", "OTRO"
];

const ESTADOS_COLOR: Record<string, string> = {
  PENDIENTE: "#f59e0b", COTIZADO: "#3b82f6", APROBADO: "#8b5cf6",
  EN_REPARACION: "#ef4444", COMPLETADO: "#10b981", FACTURADO: "#64748b"
};

const ORDEN_ESTADO_LABEL: Record<string, { label: string; color: string }> = {
  RECIBIDO:        { label: "Recibido",       color: "#3b82f6" },
  DIAGNOSTICO:     { label: "Diagnóstico",    color: "#f59e0b" },
  REPARACION:      { label: "En Reparación",  color: "#ef4444" },
  CONTROL_CALIDAD: { label: "Ctrl. Calidad",  color: "#8b5cf6" },
  LISTO:           { label: "Listo",          color: "#10b981" },
  ENTREGADO:       { label: "Entregado",      color: "#6b7280" },
};

const imprimirFormatoTecnico = (detalle: any) => {
  const { diag, cliente, vehiculo, cotizacion } = detalle;
  const total = Number(cotizacion?.mano_obra || 0) + Number(cotizacion?.repuestos || 0);
  const filasDetalle = cotizacion?.mano_de_obra_detalle
    ? cotizacion.mano_de_obra_detalle.split("\n").filter((l: string) => l.trim())
        .map((linea: string) => `<tr><td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px;">✔ ${linea.trim()}</td><td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-size:14px;">—</td></tr>`).join("")
    : `<tr><td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px;">Servicios Profesionales de Mano de Obra</td><td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-size:14px;">RD$ ${Number(cotizacion?.mano_obra || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}</td></tr>`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Diagnóstico #${diag.id} - Sólido Auto Servicio</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;color:#1a1a1a;line-height:1.6;max-width:760px;margin:auto}.header{text-align:center;border-bottom:3px solid #111;padding-bottom:20px;margin-bottom:25px}.logo{font-size:26px;font-weight:900;letter-spacing:1px}.sub{font-size:13px;color:#555;margin-top:6px}.titulo-doc{text-align:center;font-size:18px;font-weight:700;margin:20px 0;letter-spacing:1px;color:#1e40af;text-transform:uppercase;border:2px solid #1e40af;padding:8px;border-radius:8px}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}.info-box{border:1px solid #e2e8f0;padding:14px;border-radius:8px;background:#f8fafc}.box-title{font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e2e8f0;letter-spacing:1px}.info-row{font-size:13px;margin-bottom:4px}.sec-titulo{font-size:12px;font-weight:700;text-transform:uppercase;color:#475569;background:#f1f5f9;padding:6px 10px;border-radius:6px;margin:12px 0 6px;border-left:3px solid #334155}.sec-texto{font-size:13px;padding:10px 14px;background:#fff;border:1px solid #e2e8f0;border-radius:6px;white-space:pre-wrap}.fallas-box{background:#fffbeb;border:1px solid #fde68a;padding:14px;border-radius:8px;margin:16px 0}.fallas-titulo{font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;margin-bottom:8px}table{width:100%;border-collapse:collapse;margin-bottom:16px}thead th{background:#111827;color:#fff;padding:12px;text-align:left;font-size:13px}.total-row{background:#1e40af;color:#fff}.total-row td{padding:14px 12px;font-size:18px;font-weight:900}.firma-area{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px}.firma-linea{border-top:1px solid #111;padding-top:8px;text-align:center;font-size:12px;color:#64748b}.footer{text-align:center;margin-top:40px;padding-top:16px;border-top:1px dashed #cbd5e1;color:#94a3b8;font-size:11px;line-height:2}@media print{body{padding:20px}}</style></head><body>
    <div class="header"><div class="logo">🔧 SÓLIDO AUTO SERVICIO</div><div class="sub">Expertos en Mecánica &amp; Detallado | Tel: 809-712-2027<br>Santo Domingo, República Dominicana</div></div>
    <div class="titulo-doc">Informe de Diagnóstico Técnico #${String(diag.id).padStart(4,"0")}</div>
    <div class="info-grid">
      <div class="info-box"><div class="box-title">👤 Cliente y Vehículo</div><div class="info-row"><strong>Cliente:</strong> ${cliente?.nombre||"Particular"}</div><div class="info-row"><strong>Teléfono:</strong> ${cliente?.telefono||"N/A"}</div><div class="info-row"><strong>Vehículo:</strong> ${vehiculo?.marca||""} ${vehiculo?.modelo||""} ${vehiculo?.ano||""}</div><div class="info-row"><strong>Placa:</strong> ${vehiculo?.placa||"N/A"}</div></div>
      <div class="info-box"><div class="box-title">📋 Detalles del Servicio</div><div class="info-row"><strong>Servicio:</strong> ${diag.tipo_servicio}</div><div class="info-row"><strong>Técnico:</strong> ${diag.tecnico_nombre||"—"}</div><div class="info-row"><strong>Fecha:</strong> ${new Date(diag.created_at).toLocaleString("es-DO")}</div>${cotizacion?.tiempo_estimado?`<div class="info-row"><strong>Tiempo estimado:</strong> ${cotizacion.tiempo_estimado}</div>`:""}</div>
    </div>
    ${diag.inspeccion_mecanica||diag.inspeccion_electrica||diag.inspeccion_electronica?`<div class="sec-titulo">🔍 Inspección Técnica</div>${diag.inspeccion_mecanica?`<div class="sec-texto">${diag.inspeccion_mecanica}</div>`:""}${diag.inspeccion_electrica?`<div class="sec-texto">${diag.inspeccion_electrica}</div>`:""}${diag.inspeccion_electronica?`<div class="sec-texto">${diag.inspeccion_electronica}</div>`:""}`:""}
    ${diag.fallas_identificadas?`<div class="fallas-box"><div class="fallas-titulo">⚠️ Fallas Identificadas</div><p style="font-size:13px">${diag.fallas_identificadas}</p></div>`:""}
    ${cotizacion?`<div class="sec-titulo">💰 Cotización de Trabajos</div><table><thead><tr><th>Descripción</th><th style="text-align:right;width:200px">Monto (RD$)</th></tr></thead><tbody>${filasDetalle}${Number(cotizacion.repuestos)>0?`<tr><td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px">Repuestos e Insumos</td><td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-size:14px">RD$ ${Number(cotizacion.repuestos).toLocaleString("es-DO",{minimumFractionDigits:2})}</td></tr>`:""}</tbody><tfoot><tr class="total-row"><td>TOTAL PRESUPUESTO</td><td style="text-align:right">RD$ ${total.toLocaleString("es-DO",{minimumFractionDigits:2})}</td></tr></tfoot></table>${cotizacion.aprobado?`<div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:10px 14px;font-size:13px;color:#166534;font-weight:600">✅ Aprobado por: ${cotizacion.firma_cliente}</div>`:""}`:""}
    <div class="firma-area"><div><div class="firma-linea">Técnico: ${diag.tecnico_nombre||"___________________"}</div></div><div><div class="firma-linea">${cotizacion?.aprobado?`Aprobado por: ${cotizacion.firma_cliente}`:"Firma del Cliente"}</div></div></div>
    <div class="footer"><p>Este informe tiene validez de 15 días hábiles.</p><p><strong>SÓLIDO AUTO SERVICIO</strong> — Tel: 809-712-2027 — Santo Domingo, RD</p></div>
    <script>window.onload=function(){setTimeout(function(){window.print()},500)};window.onafterprint=function(){window.close()}</script>
  </body></html>`;

  const win = window.open("","_blank","width=820,height=1000");
  if (win) { win.document.write(html); win.document.close(); }
  else alert("⚠️ Permite ventanas emergentes para imprimir.");
};

// ─────────────────────────────────────────────────────────────────
export default function DiagnosticosPage() {
  // ── Estado de sesión ──────────────────────────────────────────
  const [usuario, setUsuario]   = useState<any>(null);
  const [rol, setRol]           = useState<string>("");

  // ── Datos ──────────────────────────────────────────────────────
  const [diagnosticos, setDiagnosticos] = useState<any[]>([]);
  const [ordenesPendientes, setOrdenesPendientes] = useState<any[]>([]);  // para el técnico
  const [loading, setLoading]   = useState(true);

  // ── Vista ──────────────────────────────────────────────────────
  const [tab, setTab]           = useState<"lista" | "cola" | "nuevo">("lista");
  const [detalle, setDetalle]   = useState<any>(null);

  // ── Formulario de nuevo diagnóstico ──────────────────────────
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<any>(null);  // para técnico
  const [form, setForm] = useState({
    cliente_id: "", vehiculo_id: "", orden_id: "",
    tipo_servicio: "", tecnico_nombre: "",
    inspeccion_mecanica: "", inspeccion_electrica: "", inspeccion_electronica: "",
    scanner_resultado: "", fallas_identificadas: "", observaciones: ""
  });

  // ── Cotización / avances / aprobación ──────────────────────
  const [cotForm, setCotForm]       = useState({ mano_obra: "", repuestos: "", tiempo_estimado: "", notas: "" });
  const [detalleManoObra, setDetalleManoObra] = useState("");
  const [avanceForm, setAvanceForm] = useState({ descripcion: "", tecnico_nombre: "" });
  const [firmaCliente, setFirmaCliente] = useState("");
  const [guardandoCot, setGuardandoCot] = useState(false);

  // ── Leer sesión una vez ───────────────────────────────────────
  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("usuario") || "{}");
    setUsuario(u);
    setRol(u.rol || "");
    if (u.nombre) setForm(f => ({ ...f, tecnico_nombre: u.nombre }));
    if (u.nombre) setAvanceForm(f => ({ ...f, tecnico_nombre: u.nombre }));
  }, []);

  // ── Fetch principal ───────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [dRes, oRes] = await Promise.all([
        fetch(`${API}/diagnosticos`),
        fetch(`${API}/ordenes`),
      ]);
      const diags = await dRes.json();
      const ords  = await oRes.json();
      setDiagnosticos(Array.isArray(diags) ? diags : []);
      // Cola del técnico: órdenes en RECIBIDO sin diagnóstico aún
      const conDiag = new Set((Array.isArray(diags) ? diags : []).map((d: any) => d.orden_id).filter(Boolean));
      const pendientes = (Array.isArray(ords) ? ords : []).filter(
        (o: any) => o.estado === "RECIBIDO" && !conDiag.has(o.id)
      );
      setOrdenesPendientes(pendientes);
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Selección de orden (técnico) ─────────────────────────────
  const seleccionarOrden = async (orden: any) => {
    setOrdenSeleccionada(orden);
    // Buscar el detalle completo de la orden para obtener IDs de cliente/vehículo
    const res = await fetch(`${API}/ordenes/${orden.id}`);
    const detOrden = await res.json();
    const o = detOrden.orden || orden;
    setForm(f => ({
      ...f,
      cliente_id:  String(o.cliente_id  || detOrden.cliente?.id || ""),
      vehiculo_id: String(o.vehiculo_id || detOrden.vehiculo?.id || ""),
      orden_id:    String(orden.id),
    }));
    setTab("nuevo");
  };

  // ── Crear diagnóstico ────────────────────────────────────────
  const crearDiagnostico = async () => {
    if (!form.tipo_servicio) return alert("Selecciona el tipo de servicio");
    // Para técnico, orden_id ya está; para secretaria/gerente, puede no tenerla
    if (!form.cliente_id)  return alert("Falta el cliente. Selecciona una orden primero.");
    if (!form.vehiculo_id) return alert("Falta el vehículo. Selecciona una orden primero.");
    try {
      const res = await fetch(`${API}/diagnosticos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          cliente_id:  Number(form.cliente_id),
          vehiculo_id: Number(form.vehiculo_id),
          orden_id:    form.orden_id ? Number(form.orden_id) : null,
          usuario_id:     usuario?.id     || null,
          usuario_nombre: usuario?.nombre || "Sistema",
        })
      });
      const data = await res.json();
      if (data.error) return alert("Error: " + data.error);
      alert("✅ Diagnóstico creado correctamente");
      setOrdenSeleccionada(null);
      setForm(f => ({
        ...f, cliente_id: "", vehiculo_id: "", orden_id: "",
        tipo_servicio: "", inspeccion_mecanica: "", inspeccion_electrica: "",
        inspeccion_electronica: "", scanner_resultado: "", fallas_identificadas: "", observaciones: ""
      }));
      setTab("lista");
      fetchAll();
    } catch { alert("Error al crear diagnóstico"); }
  };

  // ── Abrir detalle ────────────────────────────────────────────
  const abrirDetalle = async (id: number) => {
    const res = await fetch(`${API}/diagnosticos/${id}`);
    const data = await res.json();
    setDetalle(data);
    setCotForm({
      mano_obra: data.cotizacion?.mano_obra || "",
      repuestos: data.cotizacion?.repuestos || "",
      tiempo_estimado: data.cotizacion?.tiempo_estimado || "",
      notas: data.cotizacion?.notas || ""
    });
    setDetalleManoObra(data.cotizacion?.mano_de_obra_detalle || "");
    setFirmaCliente("");
  };

  // ── Guardar cotización ───────────────────────────────────────
  const guardarCotizacion = async () => {
    if (!cotForm.mano_obra && !cotForm.repuestos) return alert("Ingresa al menos un monto");
    setGuardandoCot(true);
    try {
      const res = await fetch(`${API}/cotizaciones/diagnostico`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnostico_id: detalle.diag.id,
          mano_obra: Number(cotForm.mano_obra || 0),
          repuestos:  Number(cotForm.repuestos || 0),
          total: Number(cotForm.mano_obra || 0) + Number(cotForm.repuestos || 0),
          tiempo_estimado: cotForm.tiempo_estimado,
          notas: cotForm.notas,
          mano_de_obra_detalle: detalleManoObra || null
        })
      });
      const result = await res.json();
      if (result?.error) return alert("Error: " + result.error);
      await abrirDetalle(detalle.diag.id);
      fetchAll();
      alert("💰 Cotización guardada");
    } catch { alert("Error al guardar cotización"); }
    finally { setGuardandoCot(false); }
  };

  // ── Aprobar cotización (secretaria presenta al cliente) ──────
  const aprobarCotizacion = async () => {
    if (!firmaCliente.trim()) return alert("Escribe el nombre del cliente como aprobación");
    if (!confirm(`¿Confirmar que el cliente "${firmaCliente}" aprobó el trabajo?`)) return;
    await fetch(`${API}/cotizaciones/${detalle.cotizacion.id}/aprobar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firma_cliente: firmaCliente })
    });
    // Si tiene orden vinculada, aprobar la orden también
    if (detalle.diag.orden_id) {
      await fetch(`${API}/ordenes/${detalle.diag.orden_id}/aprobar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_nombre: usuario?.nombre || "Secretaria", aprobado_por: firmaCliente })
      });
    }
    await abrirDetalle(detalle.diag.id);
    fetchAll();
  };

  // ── Rechazar cotización (cliente rechaza) ────────────────────
  const rechazarCotizacion = async () => {
    const motivo = prompt("Motivo del rechazo del cliente:");
    if (motivo === null) return;
    if (detalle.diag.orden_id) {
      await fetch(`${API}/ordenes/${detalle.diag.orden_id}/rechazar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_nombre: usuario?.nombre || "Secretaria", motivo: motivo || "Rechazado por el cliente" })
      });
    }
    await abrirDetalle(detalle.diag.id);
    fetchAll();
    alert("❌ Diagnóstico rechazado. La orden pasó a CANCELADA.");
  };

  // ── Agregar avance ───────────────────────────────────────────
  const agregarAvance = async () => {
    if (!avanceForm.descripcion.trim()) return alert("Describe el avance");
    await fetch(`${API}/avances`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        diagnostico_id: detalle.diag.id,
        ...avanceForm,
        usuario_id:     usuario?.id     || null,
        usuario_nombre: usuario?.nombre || avanceForm.tecnico_nombre,
      })
    });
    setAvanceForm(f => ({ ...f, descripcion: "" }));
    await abrirDetalle(detalle.diag.id);
    fetchAll();
  };

  // ── Marcar terminado (técnico) ───────────────────────────────
  const marcarTerminado = async () => {
    if (!confirm("¿Marcar la reparación como terminada? La orden pasará a Control de Calidad.")) return;
    await fetch(`${API}/diagnosticos/${detalle.diag.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ terminado: true, usuario_id: usuario?.id, usuario_nombre: usuario?.nombre })
    });
    await abrirDetalle(detalle.diag.id);
    fetchAll();
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  const esTecnico     = rol === "tecnico";
  const esSecretaria  = rol === "secretaria" || rol === "gerente";

  return (
    <div style={container}>
      <h1 style={title}>🔬 Diagnósticos Técnicos</h1>

      {/* Tabs */}
      {!detalle && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <button onClick={() => setTab("lista")}
            style={{ ...tabBtn, background: tab==="lista" ? "#111827" : "#fff", color: tab==="lista" ? "#fff" : "#111" }}>
            📋 Lista de Diagnósticos
          </button>
          {/* Cola solo para técnico */}
          {esTecnico && (
            <button onClick={() => setTab("cola")}
              style={{ ...tabBtn, background: tab==="cola" ? "#3b82f6" : "#fff", color: tab==="cola" ? "#fff" : "#111", position:"relative" }}>
              🚗 Cola de Órdenes
              {ordenesPendientes.length > 0 && (
                <span style={{ position:"absolute", top:-8, right:-8, background:"#ef4444", color:"#fff", borderRadius:999, fontSize:11, fontWeight:800, padding:"1px 7px" }}>
                  {ordenesPendientes.length}
                </span>
              )}
            </button>
          )}
          {/* Nuevo solo para técnico (desde cola) o secretaria/gerente */}
          {(!esTecnico || ordenSeleccionada) && (
            <button onClick={() => !esTecnico && setTab("nuevo")}
              style={{ ...tabBtn, background: tab==="nuevo" ? "#10b981" : "#fff", color: tab==="nuevo" ? "#fff" : "#111", cursor: esTecnico ? "default" : "pointer" }}>
              {esTecnico && ordenSeleccionada
                ? `✏️ Diagnóstico — Orden #${ordenSeleccionada.id}`
                : "➕ Nuevo Diagnóstico"}
            </button>
          )}
        </div>
      )}

      {/* ══════════ COLA DEL TÉCNICO ══════════ */}
      {!detalle && tab === "cola" && (
        <div style={card}>
          <h2 style={{ ...cardTitle, marginBottom: 6 }}>🚗 Órdenes Esperando Diagnóstico</h2>
          <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
            Selecciona una orden para comenzar el diagnóstico. La orden pasará automáticamente a estado <strong>DIAGNÓSTICO</strong>.
          </p>
          {ordenesPendientes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <p style={{ fontWeight: 600 }}>No hay órdenes pendientes de diagnóstico</p>
              <p style={{ fontSize: 13, marginTop: 6 }}>Cuando la secretaria cree nuevas órdenes aparecerán aquí.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {ordenesPendientes.map(o => (
                <div key={o.id} style={{
                  border: "2px solid #dbeafe",
                  borderRadius: 12,
                  padding: "16px 20px",
                  background: "#f0f9ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap"
                }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#1e40af" }}>
                      Orden #{o.id}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 15, marginTop: 2 }}>{o.cliente_nombre}</div>
                    <div style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>{o.vehiculo_info}</div>
                    {o.descripcion && (
                      <div style={{ fontSize: 13, color: "#374151", marginTop: 6, fontStyle: "italic" }}>
                        "{o.descripcion}"
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                      Recibido: {o.created_at ? new Date(o.created_at).toLocaleString("es-DO") : "—"}
                    </div>
                  </div>
                  <button
                    onClick={() => seleccionarOrden(o)}
                    style={{
                      padding: "10px 22px",
                      background: "#1d4ed8",
                      color: "#fff",
                      border: "none",
                      borderRadius: 9,
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 14,
                      whiteSpace: "nowrap",
                    }}>
                    🔬 Iniciar Diagnóstico
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════ NUEVO DIAGNÓSTICO ══════════ */}
      {!detalle && tab === "nuevo" && (
        <div>
          {/* Banner de orden vinculada */}
          {ordenSeleccionada && (
            <div style={{ background: "#eff6ff", border: "2px solid #bfdbfe", borderRadius: 12, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <span style={{ fontWeight: 800, color: "#1e40af", fontSize: 15 }}>📋 Orden #{ordenSeleccionada.id}</span>
                <span style={{ fontWeight: 600, color: "#374151", marginLeft: 12, fontSize: 14 }}>{ordenSeleccionada.cliente_nombre}</span>
                <span style={{ color: "#6b7280", marginLeft: 8, fontSize: 13 }}>— {ordenSeleccionada.vehiculo_info}</span>
              </div>
              <button onClick={() => { setOrdenSeleccionada(null); setForm(f => ({ ...f, cliente_id:"", vehiculo_id:"", orden_id:"" })); setTab(esTecnico ? "cola" : "lista"); }}
                style={{ fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                Cambiar orden
              </button>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Formulario izquierda */}
            <div style={card}>
              <h2 style={cardTitle}>📝 Datos del Diagnóstico</h2>

              <label style={label}>Tipo de Servicio *</label>
              <select value={form.tipo_servicio}
                onChange={e => setForm({ ...form, tipo_servicio: e.target.value })} style={input}>
                <option value="">— Seleccionar —</option>
                {TIPOS_SERVICIO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <label style={label}>Técnico Responsable</label>
              <input placeholder="Nombre del técnico" value={form.tecnico_nombre}
                onChange={e => setForm({ ...form, tecnico_nombre: e.target.value })} style={input} />

              <label style={label}>Fallas Identificadas</label>
              <textarea placeholder="Lista las fallas encontradas..." value={form.fallas_identificadas}
                onChange={e => setForm({ ...form, fallas_identificadas: e.target.value })}
                rows={3} style={{ ...input, resize: "vertical" }} />

              <label style={label}>Observaciones Adicionales</label>
              <textarea placeholder="Notas del técnico..." value={form.observaciones}
                onChange={e => setForm({ ...form, observaciones: e.target.value })}
                rows={2} style={{ ...input, resize: "vertical" }} />
            </div>

            {/* Formulario derecha */}
            <div style={card}>
              <h2 style={cardTitle}>🔍 Inspección Técnica</h2>

              <label style={label}>Inspección Mecánica</label>
              <textarea placeholder="Hallazgos mecánicos..." value={form.inspeccion_mecanica}
                onChange={e => setForm({ ...form, inspeccion_mecanica: e.target.value })}
                rows={3} style={{ ...input, resize: "vertical" }} />

              <label style={label}>Inspección Eléctrica</label>
              <textarea placeholder="Hallazgos eléctricos..." value={form.inspeccion_electrica}
                onChange={e => setForm({ ...form, inspeccion_electrica: e.target.value })}
                rows={3} style={{ ...input, resize: "vertical" }} />

              <label style={label}>Scanner / Electrónica</label>
              <textarea placeholder="Códigos de falla, resultado del escáner..." value={form.inspeccion_electronica}
                onChange={e => setForm({ ...form, inspeccion_electronica: e.target.value })}
                rows={2} style={{ ...input, resize: "vertical" }} />

              <button onClick={crearDiagnostico} style={btnPrimary}>
                ✅ {ordenSeleccionada ? `Crear Diagnóstico (Orden #${ordenSeleccionada.id})` : "Guardar Diagnóstico"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ LISTA ══════════ */}
      {!detalle && tab === "lista" && (
        <div style={card}>
          {loading ? <p>Cargando...</p> : diagnosticos.length === 0 ? (
            <p style={{ color: "#888", textAlign: "center", padding: 30 }}>Sin diagnósticos registrados.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead>
                  <tr>
                    {["#Diag", "Orden", "Cliente", "Vehículo", "Tipo", "Técnico", "Costo", "Estado", "Fecha", ""].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {diagnosticos.map((d: any) => (
                    <tr key={d.id}>
                      <td style={td}>#{d.id}</td>
                      <td style={td}>{d.orden_id ? `#${d.orden_id}` : <span style={{ color: "#ccc" }}>—</span>}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{d.cliente_nombre}</td>
                      <td style={td}>{d.vehiculo_info}</td>
                      <td style={td}>{d.tipo_servicio}</td>
                      <td style={td}>{d.tecnico_nombre || "—"}</td>
                      <td style={{ ...td, fontWeight: 600 }}>
                        {d.costo_estimado > 0
                          ? `RD$ ${Number(d.costo_estimado).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`
                          : <span style={{ color: "#aaa" }}>—</span>}
                      </td>
                      <td style={td}>
                        <span style={{ background: ESTADOS_COLOR[d.estado]||"#888", color:"#fff", padding:"3px 10px", borderRadius:6, fontSize:12, fontWeight:700 }}>
                          {d.estado}
                        </span>
                      </td>
                      <td style={{ ...td, fontSize: 12 }}>
                        {d.created_at ? new Date(d.created_at).toLocaleDateString("es-DO") : "—"}
                      </td>
                      <td style={td}>
                        <button onClick={() => abrirDetalle(d.id)} style={btnVer}>Ver →</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════ DETALLE ══════════ */}
      {detalle && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <button onClick={() => setDetalle(null)} style={btnBack}>← Volver a lista</button>
            <button onClick={() => imprimirFormatoTecnico(detalle)}
              style={{ ...btnPrimary, width:"auto", padding:"8px 24px" }}>
              🖨️ Imprimir
            </button>
          </div>

          {/* Enlace a orden vinculada */}
          {detalle.diag.orden_id && (
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13 }}>
              📋 Orden de trabajo vinculada:{" "}
              <a href={`/ordenes/${detalle.diag.orden_id}`} style={{ color: "#1d4ed8", fontWeight: 700, textDecoration: "none" }}>
                Ver Orden #{detalle.diag.orden_id} →
              </a>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* ─── Col izquierda: info + avances ─── */}
            <div>
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <h2 style={{ ...cardTitle, marginBottom:0 }}>📋 Diagnóstico #{detalle.diag.id}</h2>
                  <span style={{ background: ESTADOS_COLOR[detalle.diag.estado]||"#888", color:"#fff", padding:"4px 12px", borderRadius:8, fontWeight:700, fontSize:13 }}>
                    {detalle.diag.estado}
                  </span>
                </div>

                <div style={infoRow}><span style={infoLabel}>Cliente:</span><span style={{ fontWeight:600 }}>{detalle.cliente?.nombre}</span></div>
                <div style={infoRow}><span style={infoLabel}>Vehículo:</span><span>{detalle.vehiculo?.marca} {detalle.vehiculo?.modelo} ({detalle.vehiculo?.placa})</span></div>
                <div style={infoRow}><span style={infoLabel}>Servicio:</span><span>{detalle.diag.tipo_servicio}</span></div>
                <div style={infoRow}><span style={infoLabel}>Técnico:</span><span>{detalle.diag.tecnico_nombre||"—"}</span></div>

                {detalle.diag.inspeccion_mecanica   && <><div style={secLabel}>🔧 Mecánica</div><p style={secText}>{detalle.diag.inspeccion_mecanica}</p></>}
                {detalle.diag.inspeccion_electrica  && <><div style={secLabel}>⚡ Eléctrica</div><p style={secText}>{detalle.diag.inspeccion_electrica}</p></>}
                {detalle.diag.inspeccion_electronica && <><div style={secLabel}>💻 Scanner</div><p style={secText}>{detalle.diag.inspeccion_electronica}</p></>}
                {detalle.diag.fallas_identificadas  && <><div style={secLabel}>⚠️ Fallas</div><p style={secText}>{detalle.diag.fallas_identificadas}</p></>}
                {detalle.diag.observaciones         && <><div style={secLabel}>📝 Observaciones</div><p style={secText}>{detalle.diag.observaciones}</p></>}

                {/* WhatsApp */}
                {detalle.cliente?.telefono && (
                  <a href={`https://wa.me/${detalle.cliente.telefono.replace(/\D/g,"")}?text=${encodeURIComponent(
                    `Hola ${detalle.cliente.nombre} 👋, le compartimos el diagnóstico de su ${detalle.vehiculo?.marca||""} ${detalle.vehiculo?.modelo||""} (${detalle.vehiculo?.placa||""}):\n\n` +
                    (detalle.diag.fallas_identificadas ? `⚠️ *Fallas:* ${detalle.diag.fallas_identificadas}\n` : "") +
                    (detalle.diag.costo_estimado > 0 ? `💰 *Costo estimado:* RD$ ${Number(detalle.diag.costo_estimado).toLocaleString("es-DO",{minimumFractionDigits:2})}\n` : "") +
                    `\n¿Aprueba que procedamos? — Sólido Auto Servicio 809-712-2027`
                  )}`}
                    target="_blank" rel="noreferrer"
                    style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:12,padding:"10px 0",background:"#25d366",color:"#fff",borderRadius:8,fontWeight:700,fontSize:13,textDecoration:"none" }}>
                    💬 Compartir diagnóstico por WhatsApp
                  </a>
                )}
              </div>

              {/* ── Avances de reparación ── */}
              <div style={card}>
                <h2 style={cardTitle}>⚙️ Avances de Reparación</h2>
                {!detalle.avances || detalle.avances.length === 0 ? (
                  <p style={{ color:"#888", fontSize:13, marginBottom:12 }}>Sin avances registrados aún</p>
                ) : (
                  <div style={{ marginBottom:14 }}>
                    {detalle.avances.map((a: any) => (
                      <div key={a.id} style={{ borderLeft:"3px solid #8b5cf6", paddingLeft:12, marginBottom:10 }}>
                        <div style={{ fontSize:12, color:"#888" }}>
                          {new Date(a.created_at).toLocaleString("es-DO")} — {a.tecnico_nombre||"Técnico"}
                        </div>
                        <div style={{ fontSize:14, marginTop:2 }}>{a.descripcion}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Solo técnico o gerente agregan avances */}
                {(esTecnico || rol === "gerente") && detalle.diag.estado !== "COMPLETADO" && detalle.diag.estado !== "FACTURADO" && (
                  <>
                    <label style={label}>Nuevo Avance</label>
                    <textarea value={avanceForm.descripcion}
                      onChange={e => setAvanceForm({ ...avanceForm, descripcion: e.target.value })}
                      placeholder="Describe el trabajo realizado..." rows={2}
                      style={{ ...input, resize:"vertical" }} />
                    <label style={label}>Técnico</label>
                    <input value={avanceForm.tecnico_nombre}
                      onChange={e => setAvanceForm({ ...avanceForm, tecnico_nombre: e.target.value })}
                      placeholder="Nombre del técnico" style={input} />
                    <button onClick={agregarAvance} style={{ ...btnPrimary, background:"#8b5cf6" }}>
                      ➕ Registrar Avance
                    </button>

                    <button onClick={marcarTerminado}
                      style={{ ...btnPrimary, background:"#10b981", marginTop:10 }}>
                      ✅ Marcar Reparación como Terminada
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ─── Col derecha: cotización + aprobación ─── */}
            <div>
              <div style={card}>
                <h2 style={cardTitle}>💰 Cotización</h2>

                {detalle.cotizacion?.aprobado ? (
                  <div style={{ background:"#dcfce7", border:"1px solid #86efac", borderRadius:8, padding:"10px 14px", marginBottom:12, fontSize:13, color:"#166534", fontWeight:600 }}>
                    ✅ Aprobado por el cliente: <strong>{detalle.cotizacion.firma_cliente}</strong>
                  </div>
                ) : (
                  detalle.cotizacion && (
                    <div style={{ background:"#fef3c7", border:"1px solid #fde68a", borderRadius:8, padding:"10px 14px", marginBottom:12, fontSize:13, color:"#92400e", fontWeight:600 }}>
                      ⏳ Pendiente de aprobación del cliente
                    </div>
                  )
                )}

                <label style={label}>Mano de Obra (RD$)</label>
                <input type="number" value={cotForm.mano_obra}
                  onChange={e => setCotForm({ ...cotForm, mano_obra: e.target.value })}
                  style={input} placeholder="0.00" />

                <label style={label}>Detalle de Mano de Obra</label>
                <textarea value={detalleManoObra} onChange={e => setDetalleManoObra(e.target.value)}
                  rows={3} placeholder={"Ej:\nCambio de aceite y filtro\nRevisión de frenos\nScanner diagnóstico"}
                  style={{ ...input, resize:"vertical", fontFamily:"inherit", fontSize:13 }} />

                <label style={label}>Repuestos (RD$)</label>
                <input type="number" value={cotForm.repuestos}
                  onChange={e => setCotForm({ ...cotForm, repuestos: e.target.value })}
                  style={input} placeholder="0.00" />

                <div style={{ background:"#f0fdf4", borderRadius:8, padding:"10px 14px", marginBottom:12, fontWeight:700, fontSize:16, color:"#166534" }}>
                  Total: RD$ {(Number(cotForm.mano_obra||0)+Number(cotForm.repuestos||0)).toLocaleString("es-DO",{minimumFractionDigits:2})}
                </div>

                <label style={label}>Tiempo Estimado</label>
                <input value={cotForm.tiempo_estimado}
                  onChange={e => setCotForm({ ...cotForm, tiempo_estimado: e.target.value })}
                  style={input} placeholder="Ej: 2 días hábiles" />

                <label style={label}>Notas adicionales</label>
                <textarea value={cotForm.notas}
                  onChange={e => setCotForm({ ...cotForm, notas: e.target.value })}
                  rows={2} style={{ ...input, resize:"vertical" }} />

                <button onClick={guardarCotizacion} disabled={guardandoCot}
                  style={{ ...btnPrimary, opacity: guardandoCot ? 0.6 : 1 }}>
                  {guardandoCot ? "Guardando..." : "💾 Guardar Cotización"}
                </button>

                {/* Aprobación/Rechazo — solo secretaria y gerente */}
                {detalle.cotizacion && !detalle.cotizacion.aprobado && esSecretaria && (
                  <div style={{ marginTop: 16, borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
                    <p style={{ fontSize: 13, color: "#374151", marginBottom: 10, fontWeight: 600 }}>
                      📋 Presentar cotización al cliente:
                    </p>
                    <label style={label}>Nombre del Cliente (firma de aprobación)</label>
                    <input value={firmaCliente} onChange={e => setFirmaCliente(e.target.value)}
                      placeholder="Nombre completo del cliente" style={input} />
                    <div style={{ display:"flex", gap:10 }}>
                      <button onClick={aprobarCotizacion}
                        style={{ ...btnPrimary, flex:1, background:"#10b981" }}>
                        ✅ Cliente Aprueba
                      </button>
                      <button onClick={rechazarCotizacion}
                        style={{ flex:1, padding:13, background:"#fee2e2", color:"#dc2626", border:"1px solid #fca5a5", borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:14 }}>
                        ❌ Cliente Rechaza
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Estilos ─────────────────────────────────────────────────────────────────
const container: any = { padding: 20, background: "#f5f7fb", minHeight: "100vh" };
const title: any = { fontSize: 28, fontWeight: "bold", marginBottom: 20 };
const card: any = { background: "#fff", padding: 20, borderRadius: 15, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" };
const cardTitle: any = { marginBottom: 14, fontSize: 18, fontWeight: 600 };
const tabBtn: any = { padding: "9px 18px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", fontWeight: 600, fontSize: 13 };
const label: any = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#555" };
const input: any = { display: "block", marginBottom: 12, padding: 12, width: "100%", borderRadius: 8, border: "1px solid #ddd", boxSizing: "border-box", fontSize: 14 };
const btnPrimary: any = { padding: 13, background: "#111827", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", width: "100%", fontWeight: 700, fontSize: 14 };
const btnVer: any = { padding: "6px 12px", background: "#8b5cf6", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 };
const btnBack: any = { padding: "8px 16px", background: "#f1f5f9", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontWeight: 600 };
const table: any = { width: "100%", borderCollapse: "collapse" };
const th: any = { textAlign: "left", padding: "10px 12px", background: "#f8fafc", fontSize: 13, fontWeight: 600 };
const td: any = { padding: "10px 12px", borderBottom: "1px solid #eee", fontSize: 13 };
const infoRow: any = { display: "flex", gap: 10, marginBottom: 8, fontSize: 14 };
const infoLabel: any = { color: "#888", minWidth: 80 };
const secLabel: any = { fontSize: 12, fontWeight: 700, color: "#555", marginTop: 10, marginBottom: 4, textTransform: "uppercase" };
const secText: any = { fontSize: 13, color: "#333", background: "#f8fafc", borderRadius: 8, padding: "8px 12px", marginBottom: 8 };
