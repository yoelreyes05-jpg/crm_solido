"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { API_URL as API } from "@/config";

const fmt = (n: any) => "RD$ " + Number(n || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const METODOS = ["EFECTIVO", "TARJETA", "TRANSFERENCIA"];
const NCF = [{ k: "B02", d: "Consumidor Final" }, { k: "B01", d: "Crédito Fiscal" }];

const C = {
  bg: "#f5f7fb", card: "#fff", border: "#e5e7eb", text: "#111827", sub: "#6b7280",
  green: "#10b981", blue: "#2563eb", amber: "#d97706", red: "#dc2626", input: "#fafafa",
};
const sInput: any = { width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, background: C.input, color: C.text, boxSizing: "border-box" };
const sBtn: any = { padding: "9px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: C.blue, color: "#fff" };
const sLabel: any = { display: "block", fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 4 };

export default function CarWashPage() {
  const [servicios, setServicios] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [lavados, setLavados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form
  const [busqCli, setBusqCli] = useState("");
  const [cliSel, setCliSel] = useState<any>(null);
  const [nuevoCli, setNuevoCli] = useState({ nombre: "", telefono: "" });
  const [vehSel, setVehSel] = useState<any>(null);
  const [nuevoVeh, setNuevoVeh] = useState({ marca: "", modelo: "", placa: "" });
  const [servSel, setServSel] = useState<any>(null);
  const [precio, setPrecio] = useState("");
  const [saving, setSaving] = useState(false);

  // Facturar modal
  const [factModal, setFactModal] = useState<any>(null);
  const [factForm, setFactForm] = useState<any>({ metodo_pago: "EFECTIVO", ncf_tipo: "B02", itbis_aplica: false });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, v, l] = await Promise.all([
        fetch(`${API}/carwash/servicios`).then(r => r.json()).catch(() => []),
        fetch(`${API}/clientes`).then(r => r.json()).catch(() => []),
        fetch(`${API}/vehiculos`).then(r => r.json()).catch(() => []),
        fetch(`${API}/carwash`).then(r => r.json()).catch(() => []),
      ]);
      setServicios(Array.isArray(s) ? s : []);
      setClientes(Array.isArray(c) ? c : []);
      setVehiculos(Array.isArray(v) ? v : []);
      setLavados(Array.isArray(l) ? l : []);
    } catch { /* noop */ }
    setLoading(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const cliMap: any = {}; clientes.forEach(c => { cliMap[c.id] = c; });
  const vehMap: any = {}; vehiculos.forEach(v => { vehMap[v.id] = v; });
  const vehDeCliente = cliSel ? vehiculos.filter(v => v.cliente_id === cliSel.id) : [];
  const clientesFiltrados = busqCli
    ? clientes.filter(c => (c.nombre || "").toLowerCase().includes(busqCli.toLowerCase()) || (c.telefono || "").includes(busqCli)).slice(0, 8)
    : [];

  const elegirServicio = (s: any) => { setServSel(s); setPrecio(String(s.precio)); };

  const registrar = async () => {
    setSaving(true);
    try {
      // 1) Cliente
      let clienteId = cliSel?.id;
      if (!clienteId) {
        if (!nuevoCli.nombre.trim()) { alert("Escribe el nombre del cliente o selecciona uno."); setSaving(false); return; }
        const r = await fetch(`${API}/clientes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nuevoCli) });
        const c = await r.json();
        if (c.error) { alert("Error creando cliente: " + c.error); setSaving(false); return; }
        clienteId = c.id;
      }
      // 2) Vehículo
      let vehiculoId = vehSel?.id;
      if (!vehiculoId) {
        if (!nuevoVeh.marca.trim() && !nuevoVeh.placa.trim()) { alert("Selecciona un vehículo o escribe al menos marca/placa."); setSaving(false); return; }
        const r = await fetch(`${API}/vehiculos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...nuevoVeh, cliente_id: clienteId }) });
        const v = await r.json();
        if (v.error) { alert("Error creando vehículo: " + v.error); setSaving(false); return; }
        vehiculoId = v.id;
      }
      // 3) Lavado
      if (!servSel) { alert("Selecciona el tipo de lavado."); setSaving(false); return; }
      const r = await fetch(`${API}/carwash`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id: clienteId, vehiculo_id: vehiculoId, servicio_id: servSel.id, servicio_nombre: servSel.nombre, precio: Number(precio || servSel.precio) }),
      });
      const o = await r.json();
      if (o.error) { alert("Error: " + o.error); setSaving(false); return; }
      // reset
      setCliSel(null); setVehSel(null); setNuevoCli({ nombre: "", telefono: "" }); setNuevoVeh({ marca: "", modelo: "", placa: "" });
      setServSel(null); setPrecio(""); setBusqCli("");
      await cargar();
      alert("🚿 Lavado registrado y en proceso.");
    } catch (e: any) { alert("Error de conexión: " + e.message); }
    setSaving(false);
  };

  const marcarListo = async (id: number) => {
    const r = await fetch(`${API}/carwash/${id}/listo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!r.ok) { const e = await r.json().catch(() => ({})); alert(e.error || "No se pudo marcar listo"); return; }
    cargar();
  };

  const facturar = async () => {
    const r = await fetch(`${API}/carwash/${factModal.id}/facturar`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(factForm),
    });
    const d = await r.json();
    if (!r.ok || d.error) { alert(d.error || "No se pudo facturar"); return; }
    setFactModal(null); setFactForm({ metodo_pago: "EFECTIVO", ncf_tipo: "B02", itbis_aplica: false });
    cargar();
    alert("Factura generada ✓");
  };

  const entregar = async (id: number) => {
    if (!confirm("¿Entregar el vehículo al cliente?")) return;
    const r = await fetch(`${API}/ordenes/${id}/entregar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario_nombre: "Recepción" }) });
    const d = await r.json();
    if (!r.ok || d.error) { alert(d.error || "No se pudo entregar"); return; }
    cargar();
    alert("Vehículo entregado ✓");
  };

  return (
    <div style={{ padding: 24, background: C.bg, minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: 0 }}>🚿 Car Wash / Lavado</h1>
          <p style={{ fontSize: 13, color: C.sub, margin: "4px 0 0" }}>Entrada rápida — sin diagnóstico ni reparación. No se entrega sin factura.</p>
        </div>
        <Link href="/recepcion" style={{ textDecoration: "none", background: "#f1f5f9", color: "#334155", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 16px", fontWeight: 700, fontSize: 13 }}>← Recepción</Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) minmax(340px, 1.2fr)", gap: 18, alignItems: "start" }}>
        {/* ── FORM NUEVA ENTRADA ── */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 14 }}>Nueva entrada de lavado</h3>

          {/* Cliente */}
          <label style={sLabel}>Cliente</label>
          {cliSel ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{cliSel.nombre} <span style={{ color: C.sub, fontWeight: 400 }}>· {cliSel.telefono || "s/tel"}</span></span>
              <button onClick={() => { setCliSel(null); setVehSel(null); }} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontWeight: 700 }}>cambiar</button>
            </div>
          ) : (
            <>
              <input value={busqCli} onChange={e => setBusqCli(e.target.value)} placeholder="🔍 Buscar cliente por nombre o teléfono..." style={{ ...sInput, marginBottom: 6 }} />
              {clientesFiltrados.length > 0 && (
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 8, maxHeight: 160, overflowY: "auto" }}>
                  {clientesFiltrados.map(c => (
                    <div key={c.id} onClick={() => { setCliSel(c); setBusqCli(""); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                      <b>{c.nombre}</b> <span style={{ color: C.sub }}>· {c.telefono || "s/tel"}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 11, color: C.sub, margin: "4px 0 6px" }}>…o crea uno nuevo:</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <input value={nuevoCli.nombre} onChange={e => setNuevoCli({ ...nuevoCli, nombre: e.target.value })} placeholder="Nombre" style={sInput} />
                <input value={nuevoCli.telefono} onChange={e => setNuevoCli({ ...nuevoCli, telefono: e.target.value })} placeholder="Teléfono" style={sInput} />
              </div>
            </>
          )}

          {/* Vehículo */}
          <label style={sLabel}>Vehículo</label>
          {vehSel ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{[vehSel.marca, vehSel.modelo, vehSel.placa].filter(Boolean).join(" ")}</span>
              <button onClick={() => setVehSel(null)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontWeight: 700 }}>cambiar</button>
            </div>
          ) : (
            <>
              {cliSel && vehDeCliente.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {vehDeCliente.map(v => (
                    <button key={v.id} onClick={() => setVehSel(v)} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      {[v.marca, v.modelo, v.placa].filter(Boolean).join(" ")}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 11, color: C.sub, margin: "0 0 6px" }}>…o registra uno nuevo:</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <input value={nuevoVeh.marca} onChange={e => setNuevoVeh({ ...nuevoVeh, marca: e.target.value })} placeholder="Marca" style={sInput} />
                <input value={nuevoVeh.modelo} onChange={e => setNuevoVeh({ ...nuevoVeh, modelo: e.target.value })} placeholder="Modelo" style={sInput} />
                <input value={nuevoVeh.placa} onChange={e => setNuevoVeh({ ...nuevoVeh, placa: e.target.value })} placeholder="Placa" style={sInput} />
              </div>
            </>
          )}

          {/* Servicio */}
          <label style={sLabel}>Tipo de lavado</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {servicios.filter(s => s.activo !== false).map(s => (
              <button key={s.id} onClick={() => elegirServicio(s)} style={{
                padding: "8px 12px", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 700,
                border: servSel?.id === s.id ? `2px solid ${C.blue}` : `1px solid ${C.border}`,
                background: servSel?.id === s.id ? "#eff6ff" : "#fff", color: C.text,
              }}>{s.nombre} · {fmt(s.precio)}</button>
            ))}
            {servicios.length === 0 && <span style={{ fontSize: 12, color: C.sub }}>No hay tipos de lavado. Córrelos en la migración v14.</span>}
          </div>
          {servSel && (
            <div style={{ marginBottom: 12 }}>
              <label style={sLabel}>Precio (RD$)</label>
              <input type="number" value={precio} onChange={e => setPrecio(e.target.value)} style={sInput} />
            </div>
          )}

          <button onClick={registrar} disabled={saving} style={{ ...sBtn, width: "100%", background: C.green, fontSize: 15, padding: "12px" }}>
            {saving ? "Registrando..." : "🚿 Registrar entrada de lavado"}
          </button>
        </div>

        {/* ── LAVADOS ACTIVOS ── */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Lavados activos ({lavados.length})</h3>
            <button onClick={cargar} style={{ ...sBtn, background: "#f1f5f9", color: "#334155", padding: "6px 12px" }}>🔄</button>
          </div>
          {loading ? <p style={{ color: C.sub, textAlign: "center", padding: 20 }}>Cargando...</p> :
            lavados.length === 0 ? <p style={{ color: C.sub, textAlign: "center", padding: 24 }}>No hay lavados en proceso.</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {lavados.map(o => {
                  const c = cliMap[o.cliente_id]; const v = vehMap[o.vehiculo_id];
                  const enLavado = o.estado === "EN_LAVADO";
                  const listo = o.estado === "LISTO";
                  return (
                    <div key={o.id} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", background: "#fcfcfd" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14 }}>{o.numero_orden || `LAV-${o.id}`} · {c?.nombre || "Cliente"}</div>
                          <div style={{ fontSize: 12, color: C.sub }}>{v ? [v.marca, v.modelo, v.placa].filter(Boolean).join(" ") : "Vehículo"}</div>
                          <div style={{ fontSize: 12, color: C.text, marginTop: 2 }}>{o.descripcion} · <b>{fmt(o.total)}</b></div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: enLavado ? "#ffedd5" : "#dcfce7", color: enLavado ? "#9a3412" : "#166534" }}>
                            {enLavado ? "EN LAVADO" : "LISTO"}
                          </span>
                          <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: o.facturado ? C.green : C.amber }}>
                            {o.facturado ? "✓ Facturado" : "● Sin facturar"}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                        {enLavado && <button onClick={() => marcarListo(o.id)} style={{ ...sBtn, background: C.blue, padding: "6px 12px" }}>✓ Listo</button>}
                        {!o.facturado && <button onClick={() => { setFactModal(o); setFactForm({ metodo_pago: "EFECTIVO", ncf_tipo: "B02", itbis_aplica: false }); }} style={{ ...sBtn, background: C.amber, padding: "6px 12px" }}>💵 Cobrar / Facturar</button>}
                        <button onClick={() => entregar(o.id)} disabled={!listo || !o.facturado}
                          title={!o.facturado ? "Debe facturarse antes de entregar" : (!listo ? "Marca Listo primero" : "")}
                          style={{ ...sBtn, background: (listo && o.facturado) ? C.green : "#cbd5e1", color: "#fff", padding: "6px 12px", cursor: (listo && o.facturado) ? "pointer" : "not-allowed" }}>
                          🚗 Entregar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>

      {/* Facturar modal */}
      {factModal && (
        <div onClick={() => setFactModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 24, width: 420, maxWidth: "92vw" }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, marginTop: 0, marginBottom: 4 }}>Cobrar lavado</h3>
            <p style={{ fontSize: 13, color: C.sub, marginBottom: 16 }}>{factModal.descripcion} · <b>{fmt(factModal.total)}</b></p>
            <label style={sLabel}>Método de pago</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {METODOS.map(m => (
                <button key={m} onClick={() => setFactForm({ ...factForm, metodo_pago: m })} style={{ flex: 1, padding: "8px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, border: `1px solid ${C.border}`, background: factForm.metodo_pago === m ? C.blue : "#fff", color: factForm.metodo_pago === m ? "#fff" : C.text }}>{m}</button>
              ))}
            </div>
            <label style={sLabel}>Comprobante (NCF)</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {NCF.map(n => (
                <button key={n.k} onClick={() => setFactForm({ ...factForm, ncf_tipo: n.k })} style={{ flex: 1, padding: "8px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, border: `1px solid ${C.border}`, background: factForm.ncf_tipo === n.k ? C.blue : "#fff", color: factForm.ncf_tipo === n.k ? "#fff" : C.text }}>{n.k} · {n.d}</button>
              ))}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 18, cursor: "pointer" }}>
              <input type="checkbox" checked={factForm.itbis_aplica} onChange={e => setFactForm({ ...factForm, itbis_aplica: e.target.checked })} />
              Aplicar ITBIS (18%)
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setFactModal(null)} style={{ ...sBtn, flex: 1, background: "#f1f5f9", color: "#334155" }}>Cancelar</button>
              <button onClick={facturar} style={{ ...sBtn, flex: 1, background: C.green }}>💾 Generar factura</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
