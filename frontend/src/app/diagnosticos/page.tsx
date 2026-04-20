"use client";
import { useEffect, useState } from "react";
import { API_URL as API } from "@/config";

const TIPOS_SERVICIO = [
  "CAMBIO DE ACEITE", "ALINEACIÓN Y BALANCEO", "FRENOS", "SUSPENSIÓN",
  "SISTEMA ELÉCTRICO", "SISTEMA ELECTRÓNICO / SCANNER", "TRANSMISIÓN",
  "MOTOR", "AIRE ACONDICIONADO", "DIAGNÓSTICO GENERAL", "OTRO"
];

const ESTADOS_COLOR: Record<string, string> = {
  PENDIENTE: "#f59e0b", COTIZADO: "#3b82f6", APROBADO: "#8b5cf6",
  EN_REPARACION: "#ef4444", COMPLETADO: "#10b981"
};

// --- FUNCIÓN DE IMPRESIÓN PROFESIONAL ---
const imprimirFormatoTecnico = (detalle: any) => {
  const { diag, cliente, vehiculo, cotizacion } = detalle;
  const total = Number(cotizacion?.mano_obra || 0) + Number(cotizacion?.repuestos || 0);

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Informe Técnico - Sólido Auto Servicio</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.6; }
        .header { text-align: center; border-bottom: 3px solid #111; padding-bottom: 20px; margin-bottom: 25px; }
        .logo { font-size: 26px; font-weight: 900; letter-spacing: 1px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .card { border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; background: #f8fafc; }
        .card-title { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
        .obs-box { background: #fffbeb; border: 1px solid #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #111; color: #fff; padding: 12px; text-align: left; font-size: 13px; }
        td { padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; }
        .total-box { text-align: right; margin-top: 20px; font-size: 24px; font-weight: 900; color: #1e40af; border-top: 2px solid #111; padding-top: 10px; }
        .footer { text-align: center; margin-top: 60px; font-size: 11px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 20px; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">🔧 SÓLIDO AUTO SERVICIO</div>
        <p>Expertos en Mecánica & Detallado | Tel: 809-712-2027<br>Santo Domingo, República Dominicana</p>
      </div>

      <h2 style="text-align:center;">INFORME DE DIAGNÓSTICO #${diag.id}</h2>

      <div class="info-grid">
        <div class="card">
          <div class="card-title">Cliente y Vehículo</div>
          <strong>Cliente:</strong> ${cliente?.nombre || 'Particular'}<br>
          <strong>Vehículo:</strong> ${vehiculo?.marca || ''} ${vehiculo?.modelo || ''}<br>
          <strong>Placa:</strong> ${vehiculo?.placa || 'N/A'}
        </div>
        <div class="card">
          <div class="card-title">Detalles del Servicio</div>
          <strong>Servicio:</strong> ${diag.tipo_servicio}<br>
          <strong>Técnico:</strong> ${diag.tecnico_nombre || 'YOEL'}<br>
          <strong>Fecha:</strong> ${new Date(diag.created_at).toLocaleDateString('es-DO')}
        </div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-title">Inspección Técnica</div>
        ${diag.inspeccion_mecanica ? `<p><strong>Mecánica:</strong> ${diag.inspeccion_mecanica}</p>` : ''}
        ${diag.inspeccion_electrica ? `<p><strong>Eléctrica:</strong> ${diag.inspeccion_electrica}</p>` : ''}
        ${diag.inspeccion_electronica ? `<p><strong>Scanner:</strong> ${diag.inspeccion_electronica}</p>` : ''}
      </div>

      <div class="obs-box">
        <div class="card-title" style="color:#92400e; border-color:#fde68a;">Fallas Identificadas y Recomendaciones</div>
        <p>${diag.fallas_identificadas || 'Sin fallas críticas reportadas.'}</p>
        <p><strong>Observaciones:</strong> ${diag.observaciones || 'No hay notas adicionales.'}</p>
      </div>

      ${cotizacion ? `
      <table>
        <thead>
          <tr>
            <th>DETALLE DE COTIZACIÓN</th>
            <th style="text-align:right;">MONTO (RD$)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Servicios Profesionales de Mano de Obra</td>
            <td style="text-align:right;">RD$ ${Number(cotizacion.mano_obra).toLocaleString()}</td>
          </tr>
          <tr>
            <td>Repuestos, Insumos y Materiales</td>
            <td style="text-align:right;">RD$ ${Number(cotizacion.repuestos).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
      <div class="total-box">TOTAL PRESUPUESTO: RD$ ${total.toLocaleString()}</div>
      ` : ''}

      <div class="footer">
        <p>Este informe técnico tiene validez de 15 días. Precios sujetos a cambios tras desarme profundo.</p>
        <p>Sólido Café Garage - "Mecánica de alto nivel"</p>
      </div>
      <script>window.onload = () => { window.print(); window.close(); }</script>
    </body>
    </html>
  `;
  const win = window.open("", "_blank");
  win?.document.write(html);
  win?.document.close();
};

export default function DiagnosticosPage() {
  const [diagnosticos, setDiagnosticos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [tab, setTab] = useState<"lista" | "nuevo">("lista");
  const [detalle, setDetalle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    cliente_id: "", vehiculo_id: "", tipo_servicio: "", tecnico_nombre: "",
    inspeccion_mecanica: "", inspeccion_electrica: "", inspeccion_electronica: "",
    scanner_resultado: "", fallas_identificadas: "", observaciones: ""
  });

  const [cotForm, setCotForm] = useState({ mano_obra: "", repuestos: "", tiempo_estimado: "", notas: "" });
  const [detalleManoObra, setDetalleManoObra] = useState("");
const [avanceForm, setAvanceForm] = useState({ descripcion: "", tecnico_nombre: "" });
  const [firmaCliente, setFirmaCliente] = useState("");

  const fetchAll = async () => {
    try {
      const [dRes, cRes, vRes] = await Promise.all([
        fetch(`${API}/diagnosticos`),
        fetch(`${API}/clientes`),
        fetch(`${API}/vehiculos`)
      ]);
      setDiagnosticos(await dRes.json());
      setClientes(await cRes.json());
      setVehiculos(await vRes.json());
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const vehiculosFiltrados = vehiculos.filter(v => String(v.cliente_id) === String(form.cliente_id));

  const crearDiagnostico = async () => {
    if (!form.cliente_id) return alert("Selecciona un cliente");
    if (!form.vehiculo_id) return alert("Selecciona un vehículo");
    if (!form.tipo_servicio) return alert("Selecciona el tipo de servicio");
    try {
      const res = await fetch(`${API}/diagnosticos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, cliente_id: Number(form.cliente_id), vehiculo_id: Number(form.vehiculo_id) })
      });
      const data = await res.json();
      if (data.error) return alert(data.error);
      alert("✅ Diagnóstico creado");
      setForm({ cliente_id: "", vehiculo_id: "", tipo_servicio: "", tecnico_nombre: "", inspeccion_mecanica: "", inspeccion_electrica: "", inspeccion_electronica: "", scanner_resultado: "", fallas_identificadas: "", observaciones: "" });
      setTab("lista");
      fetchAll();
    } catch { alert("Error al crear"); }
  };

  const abrirDetalle = async (id: number) => {
    const res = await fetch(`${API}/diagnosticos/${id}`);
    const data = await res.json();
    setDetalle(data);
    setCotForm({ mano_obra: data.cotizacion?.mano_obra || "", repuestos: data.cotizacion?.repuestos || "", tiempo_estimado: data.cotizacion?.tiempo_estimado || "", notas: data.cotizacion?.notas || "" });
  };

  const guardarCotizacion = async () => {
    if (!cotForm.mano_obra && !cotForm.repuestos) return alert("Ingresa al menos un monto");
    
    // El monto total que se pasará a facturación
    const totalCalculado = Number(cotForm.mano_obra || 0) + Number(cotForm.repuestos || 0);

    await fetch(`${API}/cotizaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        diagnostico_id: detalle.diag.id, 
        ...cotForm, 
        mano_obra: Number(cotForm.mano_obra || 0), 
        repuestos: Number(cotForm.repuestos || 0),
        total: totalCalculado, // Enviamos el total para que facturación lo lea fácilmente
 mano_de_obra_detalle: detalleManoObra

      })

    });
    const res = await fetch(`${API}/diagnosticos/${detalle.diag.id}`);
    setDetalle(await res.json());
    fetchAll();
    alert("💰 Cotización guardada correctamente");
  };

  const aprobarCotizacion = async () => {
    if (!firmaCliente.trim()) return alert("Ingresa el nombre del cliente como firma de aprobación");
    if (!confirm(`¿Confirmar aprobación de cotización con firma: "${firmaCliente}"?`)) return;
    await fetch(`${API}/cotizaciones/${detalle.cotizacion.id}/aprobar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firma_cliente: firmaCliente })
    });
    const res = await fetch(`${API}/diagnosticos/${detalle.diag.id}`);
    setDetalle(await res.json());
    fetchAll();
  };

  const agregarAvance = async () => {
    if (!avanceForm.descripcion.trim()) return alert("Describe el avance");
    await fetch(`${API}/avances`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diagnostico_id: detalle.diag.id, ...avanceForm })
    });
    setAvanceForm({ descripcion: "", tecnico_nombre: "" });
    const res = await fetch(`${API}/diagnosticos/${detalle.diag.id}`);
    setDetalle(await res.json());
    fetchAll();
  };

  const completar = async () => {
    if (!confirm("¿Marcar este diagnóstico como COMPLETADO?")) return;
    await fetch(`${API}/diagnosticos/${detalle.diag.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "COMPLETADO" })
    });
    const res = await fetch(`${API}/diagnosticos/${detalle.diag.id}`);
    setDetalle(await res.json());
    fetchAll();
  };

  return (
    <div style={container}>
      <h1 style={title}>🔬 Diagnósticos Técnicos</h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {(["lista", "nuevo"] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setDetalle(null); }}
            style={{ ...tabBtn, background: tab === t && !detalle ? "#111827" : "#fff", color: tab === t && !detalle ? "#fff" : "#111" }}>
            {t === "lista" ? "📋 Lista" : "➕ Nuevo Diagnóstico"}
          </button>
        ))}
        {detalle && <span style={{ padding: "9px 16px", background: "#8b5cf6", color: "#fff", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>🔍 Detalle #{detalle.diag.id}</span>}
      </div>

      {/* ========== LISTA ========== */}
      {!detalle && tab === "lista" && (
        <div style={card}>
          {loading ? <p>Cargando...</p> : diagnosticos.length === 0 ? (
            <p style={{ color: "#888", textAlign: "center", padding: 30 }}>Sin diagnósticos. Crea el primero.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead>
                  <tr>{["#", "Cliente", "Vehículo", "Tipo Servicio", "Técnico", "Estado", "Fecha", ""].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {diagnosticos.map((d: any) => (
                    <tr key={d.id}>
                      <td style={td}>#{d.id}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{d.cliente_nombre}</td>
                      <td style={td}>{d.vehiculo_info}</td>
                      <td style={td}>{d.tipo_servicio}</td>
                      <td style={td}>{d.tecnico_nombre || "—"}</td>
                      <td style={td}>
                        <span style={{ background: ESTADOS_COLOR[d.estado] || "#888", color: "#fff", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                          {d.estado}
                        </span>
                      </td>
                      <td style={{ ...td, fontSize: 12 }}>{d.created_at ? new Date(d.created_at).toLocaleDateString("es-DO") : "—"}</td>
                      <td style={td}>
                        <button onClick={() => abrirDetalle(d.id)} style={btnVer}>Ver Detalle →</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========== NUEVO ========== */}
      {!detalle && tab === "nuevo" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={card}>
            <h2 style={cardTitle}>📝 Datos Generales</h2>

            <label style={label}>Cliente *</label>
            <select value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value, vehiculo_id: "" })} style={input}>
              <option value="">— Seleccionar —</option>
              {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>

            <label style={label}>Vehículo *</label>
            <select value={form.vehiculo_id} onChange={e => setForm({ ...form, vehiculo_id: e.target.value })} style={input} disabled={!form.cliente_id}>
              <option value="">— Seleccionar —</option>
              {vehiculosFiltrados.map((v: any) => <option key={v.id} value={v.id}>{v.marca} {v.modelo} · {v.placa}</option>)}
            </select>

            <label style={label}>Tipo de Servicio *</label>
            <select value={form.tipo_servicio} onChange={e => setForm({ ...form, tipo_servicio: e.target.value })} style={input}>
              <option value="">— Seleccionar —</option>
              {TIPOS_SERVICIO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <label style={label}>Técnico Responsable</label>
            <input placeholder="Nombre del técnico" value={form.tecnico_nombre}
              onChange={e => setForm({ ...form, tecnico_nombre: e.target.value })} style={input} />
          </div>

          <div style={card}>
            <h2 style={cardTitle}>🔍 Inspección Técnica</h2>

            <label style={label}>Inspección Mecánica</label>
            <textarea placeholder="Descripción de hallazgos mecánicos..." value={form.inspeccion_mecanica}
              onChange={e => setForm({ ...form, inspeccion_mecanica: e.target.value })}
              rows={3} style={{ ...input, resize: "vertical" }} />

            <label style={label}>Inspección Eléctrica</label>
            <textarea placeholder="Descripción de hallazgos eléctricos..." value={form.inspeccion_electrica}
              onChange={e => setForm({ ...form, inspeccion_electrica: e.target.value })}
              rows={3} style={{ ...input, resize: "vertical" }} />

            <label style={label}>Inspección Electrónica / Scanner</label>
            <textarea placeholder="Códigos de falla, resultado del escáner..." value={form.inspeccion_electronica}
              onChange={e => setForm({ ...form, inspeccion_electronica: e.target.value })}
              rows={2} style={{ ...input, resize: "vertical" }} />

            <label style={label}>Fallas Identificadas</label>
            <textarea placeholder="Lista las fallas encontradas..." value={form.fallas_identificadas}
              onChange={e => setForm({ ...form, fallas_identificadas: e.target.value })}
              rows={3} style={{ ...input, resize: "vertical" }} />

            <label style={label}>Observaciones Adicionales</label>
            <textarea placeholder="Notas del técnico..." value={form.observaciones}
              onChange={e => setForm({ ...form, observaciones: e.target.value })}
              rows={2} style={{ ...input, resize: "vertical" }} />

            <button onClick={crearDiagnostico} style={btnPrimary}>✅ Guardar Diagnóstico</button>
          </div>
        </div>
      )}

      {/* ========== DETALLE ========== */}
      {detalle && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <button onClick={() => setDetalle(null)} style={btnBack}>← Volver a lista</button>
            <button onClick={() => imprimirFormatoTecnico(detalle)} style={{ ...btnPrimary, width: "auto", padding: "8px 20px", background: "#111827" }}>
              🖨️ Imprimir Diagnóstico
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* INFO */}
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h2 style={{ ...cardTitle, marginBottom: 0 }}>📋 Diagnóstico #{detalle.diag.id}</h2>
                <span style={{ background: ESTADOS_COLOR[detalle.diag.estado] || "#888", color: "#fff", padding: "4px 12px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
                  {detalle.diag.estado}
                </span>
              </div>

              <div style={infoRow}><span style={infoLabel}>Cliente:</span><span style={{ fontWeight: 600 }}>{detalle.cliente?.nombre}</span></div>
              <div style={infoRow}><span style={infoLabel}>Vehículo:</span><span>{detalle.vehiculo?.marca} {detalle.vehiculo?.modelo} ({detalle.vehiculo?.placa})</span></div>
              <div style={infoRow}><span style={infoLabel}>Servicio:</span><span>{detalle.diag.tipo_servicio}</span></div>
              <div style={infoRow}><span style={infoLabel}>Técnico:</span><span>{detalle.diag.tecnico_nombre || "—"}</span></div>

              {detalle.diag.inspeccion_mecanica && <><div style={secLabel}>🔧 Mecánica</div><p style={secText}>{detalle.diag.inspeccion_mecanica}</p></>}
              {detalle.diag.inspeccion_electrica && <><div style={secLabel}>⚡ Eléctrica</div><p style={secText}>{detalle.diag.inspeccion_electrica}</p></>}
              {detalle.diag.inspeccion_electronica && <><div style={secLabel}>💻 Electrónica/Scanner</div><p style={secText}>{detalle.diag.inspeccion_electronica}</p></>}
              {detalle.diag.fallas_identificadas && <><div style={secLabel}>⚠️ Fallas</div><p style={secText}>{detalle.diag.fallas_identificadas}</p></>}
              {detalle.diag.observaciones && <><div style={secLabel}>📝 Observaciones</div><p style={secText}>{detalle.diag.observaciones}</p></>}

{detalle.diag.mano_de_obra_detalle && (
  <>
    <div style={secLabel}>🛠️ Mano de Obra</div>
    <p style={secText}>{detalle.diag.mano_de_obra_detalle}</p>
  </>
)}



              {detalle.diag.estado !== "COMPLETADO" && (
                <button onClick={completar} style={{ ...btnPrimary, marginTop: 16, background: "#10b981" }}>
                  ✅ Marcar como Completado
                </button>
              )}
            </div>

            <div>
              {/* COTIZACIÓN */}
              <div style={{ ...card, marginBottom: 16 }}>
                <h2 style={cardTitle}>💰 Cotización</h2>
                {detalle.cotizacion?.aprobado && (
                  <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#166534", fontWeight: 600 }}>
                    ✅ Aprobada por: {detalle.cotizacion.firma_cliente}
                  </div>
                )}
                <label style={label}>Mano de Obra (RD$)</label>
                <input type="number" value={cotForm.mano_obra} onChange={e => setCotForm({ ...cotForm, mano_obra: e.target.value })} style={input} placeholder="0.00" />
                <label style={label}>Repuestos (RD$)</label>
                <input type="number" value={cotForm.repuestos} onChange={e => setCotForm({ ...cotForm, repuestos: e.target.value })} style={input} placeholder="0.00" />
                <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontWeight: 700, fontSize: 16 }}>
                  Total: RD$ {(Number(cotForm.mano_obra || 0) + Number(cotForm.repuestos || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <label style={label}>Tiempo Estimado</label>
                <input value={cotForm.tiempo_estimado} onChange={e => setCotForm({ ...cotForm, tiempo_estimado: e.target.value })} style={input} placeholder="Ej: 2 días" />
                <label style={label}>Notas</label>
		<label style={label}>Detalle de Mano de Obra</label>

///////MODIFICADO/////////

const [manoObraItems, setManoObraItems] = useState<any[]>([
  { descripcion: "", precio: "" }
]);

<label style={label}>Detalle de Mano de Obra</label>

{manoObraItems.map((item, index) => (
  <div key={index} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
    
    <input
      placeholder="Descripción (Ej: Cambio de aceite)"
      value={item.descripcion}
      onChange={(e) => {
        const newItems = [...manoObraItems];
        newItems[index].descripcion = e.target.value;
        setManoObraItems(newItems);
      }}
      style={{ ...input, flex: 2 }}
    />

    <input
      type="number"
      placeholder="Precio"
      value={item.precio}
      onChange={(e) => {
        const newItems = [...manoObraItems];
        newItems[index].precio = e.target.value;
        setManoObraItems(newItems);
      }}
      style={{ ...input, flex: 1 }}
    />

    <button
      onClick={() => {
        const newItems = manoObraItems.filter((_, i) => i !== index);
        setManoObraItems(newItems);
      }}
      style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, padding: "0 10px" }}
    >
      X
    </button>
  </div>
))}

<button
  onClick={() => setManoObraItems([...manoObraItems, { descripcion: "", precio: "" }])}
  style={{ ...btnPrimary, background: "#8b5cf6", marginBottom: 10 }}
>
  ➕ Agregar Servicio
</button>

  rows={3}
  placeholder="Ej: Cambio de aceite, revisión de frenos, ajuste de suspensión..."
  style={{ ...input, resize: "vertical" }}
/>
                <textarea value={cotForm.notas} onChange={e => setCotForm({ ...cotForm, notas: e.target.value })} rows={2} style={{ ...input, resize: "vertical" }} />
                

<button onClick={guardarCotizacion} style={btnPrimary}>💾 Guardar Cotización</button>

                {detalle.cotizacion && !detalle.cotizacion.aprobado && (
                  <div style={{ marginTop: 12 }}>
                    <label style={label}>Firma/Aprobación del Cliente</label>
                    <input value={firmaCliente} onChange={e => setFirmaCliente(e.target.value)}
                      placeholder="Nombre completo del cliente" style={input} />
                    <button onClick={aprobarCotizacion} style={{ ...btnPrimary, background: "#8b5cf6" }}>
                      ✍️ Registrar Aprobación del Cliente
                    </button>
                  </div>
                )}
              </div>

              {/* AVANCES */}
              <div style={card}>
                <h2 style={cardTitle}>⚙️ Avances de Reparación</h2>
                {detalle.avances?.length === 0 ? (
                  <p style={{ color: "#888", fontSize: 13, marginBottom: 12 }}>Sin avances registrados aún</p>
                ) : (
                  <div style={{ marginBottom: 14 }}>
                    {detalle.avances.map((a: any) => (
                      <div key={a.id} style={{ borderLeft: "3px solid #8b5cf6", paddingLeft: 12, marginBottom: 10 }}>
                        <div style={{ fontSize: 12, color: "#888" }}>
                          {new Date(a.created_at).toLocaleString("es-DO")} — {a.tecnico_nombre || "Técnico"}
                        </div>
                        <div style={{ fontSize: 14, marginTop: 2 }}>{a.descripcion}</div>
                      </div>
                    ))}
                  </div>
                )}
                <label style={label}>Nuevo Avance</label>
                <textarea value={avanceForm.descripcion} onChange={e => setAvanceForm({ ...avanceForm, descripcion: e.target.value })}
                  placeholder="Describe el trabajo realizado..." rows={2} style={{ ...input, resize: "vertical" }} />
                <label style={label}>Técnico</label>
                <input value={avanceForm.tecnico_nombre} onChange={e => setAvanceForm({ ...avanceForm, tecnico_nombre: e.target.value })}
                  placeholder="Nombre del técnico" style={input} />
                <button onClick={agregarAvance} style={{ ...btnPrimary, background: "#8b5cf6" }}>
                  ➕ Registrar Avance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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