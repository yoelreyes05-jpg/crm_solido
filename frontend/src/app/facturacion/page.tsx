"use client";
import { useEffect, useState } from "react";
import { API_URL as API } from "@/config";

const EMPRESA = {
  nombre: "SÓLIDO AUTO SERVICIO",
  telefono: "809-712-2027",
  rnc: "RNC: 000-000000-0",
  direccion: "Santo Domingo, República Dominicana"
};

// Generador de HTML Unificado (Factura y Cotización)
function generarHTML(venta, itemsFactura, clienteNombre, vehiculoInfo, esCotizacion = false) {
  const subtotalFinal = Number(venta.subtotal || 0);
  const itbisFinal = Number(venta.itbis || 0);
  const totalFinal = Number(venta.total || 0);
  
  const fecha = new Date(venta.created_at || Date.now()).toLocaleString("es-DO", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });

  const lineas = itemsFactura.map(p => `
    <tr>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;">${p.name}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:center;">${p.qty}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;">RD$ ${Number(p.price).toFixed(2)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:700;">RD$ ${(p.price * p.qty).toFixed(2)}</td>
    </tr>`).join("");

  const banner = esCotizacion 
    ? `<div style="background:#fefce8;border:2px solid #eab308;color:#854d0e;text-align:center;padding:12px;font-size:20px;font-weight:900;border-radius:8px;margin:16px 0;">📄 COTIZACIÓN PREVENTIVA</div>`
    : venta.estado === "CANCELADA"
    ? `<div style="background:#fee2e2;border:2px solid #dc2626;color:#dc2626;text-align:center;padding:12px;font-size:20px;font-weight:900;border-radius:8px;margin:16px 0;">⚠️ FACTURA CANCELADA</div>`
    : "";

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
    <title>${esCotizacion ? 'Cotización' : 'Factura'} ${venta.ncf || ''}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:30px;max-width:720px;margin:auto;}
      .header{text-align:center;border-bottom:3px solid #111;padding-bottom:18px;margin-bottom:20px;}
      .logo-nombre{font-size:28px;font-weight:900;letter-spacing:2px;text-transform:uppercase;}
      .logo-sub{font-size:13px;color:#555;margin-top:6px;line-height:1.6;}
      .dos-col{display:flex;justify-content:space-between;gap:16px;margin-bottom:20px;}
      .info-box{flex:1;background:#f8f8f8;border-radius:8px;padding:14px 16px;}
      .info-box h3{font-size:10px;text-transform:uppercase;color:#888;margin-bottom:8px;letter-spacing:1px;}
      .info-box p{margin-bottom:5px;font-size:13px;line-height:1.5;}
      .ncf-box{background:${esCotizacion ? '#854d0e' : '#111'};color:#fff;text-align:center;padding:12px;border-radius:8px;margin:18px 0;}
      .ncf-label{font-size:11px;letter-spacing:1px;opacity:0.7;margin-bottom:4px;}
      .ncf-num{font-size:20px;font-weight:900;letter-spacing:3px;}
      table{width:100%;border-collapse:collapse;margin-bottom:16px;}
      thead th{background:#111;color:#fff;padding:10px 6px;font-size:12px;text-align:left;}
      .totales{margin-left:auto;width:300px;margin-top:8px;}
      .t-row{display:flex;justify-content:space-between;padding:7px 0;font-size:14px;border-bottom:1px solid #eee;}
      .t-total{font-size:20px;font-weight:900;border-top:3px solid #111;border-bottom:none;padding-top:12px;margin-top:6px;}
      .footer{text-align:center;margin-top:30px;padding-top:16px;border-top:1px dashed #ccc;color:#777;font-size:12px;line-height:2;}
    </style></head><body>
    <div class="header">
      <div class="logo-nombre">🔧 ${EMPRESA.nombre}</div>
      <div class="logo-sub">Tel: ${EMPRESA.telefono} &nbsp;|&nbsp; ${EMPRESA.direccion}<br/>${EMPRESA.rnc}</div>
    </div>
    ${banner}
    <div class="dos-col">
      <div class="info-box">
        <h3>Datos del Documento</h3>
        <p><b>${esCotizacion ? 'Cotización' : 'Factura'} #:</b> ${esCotizacion ? 'PRO-FORMA' : 'FAC-'+String(venta.id).padStart(5, "0")}</p>
        <p><b>Fecha:</b> ${fecha}</p>
        <p><b>Método:</b> ${venta.method}</p>
        ${!esCotizacion ? `<p><b>Tipo NCF:</b> ${venta.ncf_tipo}</p>` : ''}
      </div>
      <div class="info-box">
        <h3>Cliente</h3>
        <p><b>${clienteNombre}</b></p>
        ${vehiculoInfo ? `<p>🚗 ${vehiculoInfo}</p>` : ""}
      </div>
    </div>
    ${!esCotizacion ? `
    <div class="ncf-box">
      <div class="ncf-label">Número de Comprobante Fiscal (NCF)</div>
      <div class="ncf-num">${venta.ncf}</div>
    </div>` : ''}
    <table>
      <thead><tr>
        <th>Descripción</th>
        <th style="text-align:center;">Cant.</th>
        <th style="text-align:right;">Precio Unit.</th>
        <th style="text-align:right;">Total</th>
      </tr></thead>
      <tbody>${lineas}</tbody>
    </table>
    <div class="totales">
      <div class="t-row"><span>Subtotal:</span><span>RD$ ${subtotalFinal.toFixed(2)}</span></div>
      <div class="t-row"><span>ITBIS (18%):</span><span>RD$ ${itbisFinal.toFixed(2)}</span></div>
      <div class="t-row t-total"><span>TOTAL:</span><span>RD$ ${totalFinal.toFixed(2)}</span></div>
    </div>
    <div class="footer">
      <p>¡Gracias por confiar en <b>${EMPRESA.nombre}</b>!</p>
      ${esCotizacion ? '<p>Esta cotización tiene una validez de 15 días.</p>' : ''}
      <p style="font-size:11px;color:#aaa;margin-top:6px;">Documento fiscal válido según la DGII — República Dominicana</p>
    </div>
    <script>window.onload=function(){window.print();}</script>
    </body></html>`;
}

function abrirImpresion(html) {
  const w = window.open("", "_blank", "width=780,height=950");
  if (w) { w.document.write(html); w.document.close(); }
}

export default function FacturaPage() {
  const [clientes, setClientes] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [items, setItems] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [diagnosticos, setDiagnosticos] = useState([]); // Nuevo
  const [carrito, setCarrito] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [vehiculoId, setVehiculoId] = useState("");
  const [method, setMethod] = useState("EFECTIVO");
  const [ncfTipo, setNcfTipo] = useState("B02");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("nueva");
  const [busqueda, setBusqueda] = useState("");
  const [buscandoHistorial, setBuscandoHistorial] = useState("");
  const [ultimaVenta, setUltimaVenta] = useState(null);
  const [montoRecibido, setMontoRecibido] = useState("");
  const [modalVenta, setModalVenta] = useState(null);
  const [modalMethod, setModalMethod] = useState("EFECTIVO");
  const [modalNcfTipo, setModalNcfTipo] = useState("B02");
  const [modalCliente, setModalCliente] = useState("");

  const fetchData = async () => {
    try {
      const [cRes, vRes, iRes, ventasRes, dRes] = await Promise.all([
        fetch(`${API}/clientes`),
        fetch(`${API}/vehiculos`),
        fetch(`${API}/inventario`),
        fetch(`${API}/ventas`),
        fetch(`${API}/diagnosticos`) // Endpoint de tus diagnósticos
      ]);

      const c = await cRes.json(); const v = await vRes.json();
      const i = await iRes.json(); const vt = await ventasRes.json();
      const d = await dRes.json();

      setClientes(Array.isArray(c) ? c : []);
      setVehiculos(Array.isArray(v) ? v : []);
      setItems(Array.isArray(i) ? i : []);
      setVentas(Array.isArray(vt) ? vt : []);
      setDiagnosticos(Array.isArray(d) ? d.filter(item => item.estado !== 'FACTURADO') : []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchData(); }, []);

  // Lógica de filtrado
  const vehiculosFiltrados = vehiculos.filter(v => Number(v.cliente_id) === Number(clienteId));
  const itemsFiltrados = items.filter(i => !busqueda || i.name.toLowerCase().includes(busqueda.toLowerCase()));
  const ventasFiltradas = ventas.filter(v => 
    !buscandoHistorial || 
    v.customer_name?.toLowerCase().includes(buscandoHistorial.toLowerCase()) || 
    v.ncf?.toLowerCase().includes(buscandoHistorial.toLowerCase())
  );

  // Totales
  const subtotal = carrito.reduce((acc, p) => acc + p.price * p.qty, 0);
  const itbis = subtotal * 0.18;
  const total = subtotal + itbis;
  const vuelto = Number(montoRecibido || 0) - total;

  // Importar Diagnóstico al Carrito
  const cargarDiagnostico = (diag) => {
    setClienteId(diag.cliente_id);
    setVehiculoId(diag.vehiculo_id);
    
    // Creamos la línea de mano de obra basada en el diagnóstico
    const manoDeObra = {
      id: `MO-${diag.id}`,
      name: `MANO DE OBRA: ${diag.detalle_tecnico || 'Servicio técnico'}`,
      price: diag.costo_estimado || 0,
      qty: 1,
      stock: 999 // Virtual
    };
    
    setCarrito([manoDeObra]);
    alert("Diagnóstico cargado correctamente.");
  };

  const addItem = (item) => {
    if (item.stock <= 0) return alert("Sin stock disponible");
    const exists = carrito.find(p => p.id === item.id);
    if (exists) {
      if (exists.qty >= item.stock) return alert("Stock insuficiente");
      setCarrito(carrito.map(p => p.id === item.id ? { ...p, qty: p.qty + 1 } : p));
    } else {
      setCarrito([...carrito, { ...item, qty: 1 }]);
    }
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) { setCarrito(carrito.filter(p => p.id !== id)); return; }
    setCarrito(carrito.map(p => p.id === id ? { ...p, qty } : p));
  };

  // Acción: Imprimir Cotización
  const handleCotizacion = () => {
    if (carrito.length === 0) return alert("Carrito vacío");
    const veh = vehiculosFiltrados.find(v => v.id === Number(vehiculoId));
    const vehiculoInfo = veh ? `${veh.marca} ${veh.modelo} · Placa: ${veh.placa}` : "";
    const clienteNombre = clientes.find(c => c.id === Number(clienteId))?.nombre || "Consumidor Final";
    
    const mockVenta = { subtotal, itbis, total, method: method, created_at: new Date() };
    abrirImpresion(generarHTML(mockVenta, carrito, clienteNombre, vehiculoInfo, true));
  };

  const generarFactura = async () => {
    if (carrito.length === 0) return alert("Carrito vacío");
    if (Number(montoRecibido) > 0 && vuelto < 0) return alert(`Monto insuficiente. Faltan RD$ ${Math.abs(vuelto).toFixed(2)}`);
    setLoading(true);
    const snap = [...carrito];
    try {
      const res = await fetch(`${API}/ventas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: snap.map(p => ({ partId: typeof p.id === 'string' ? null : p.id, name: p.name, price: p.price, quantity: p.qty })),
          method,
          customer_name: clientes.find(c => c.id === Number(clienteId))?.nombre || "Consumidor Final",
          ncf_tipo: ncfTipo,
          subtotal, itbis, total
        })
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }

      const veh = vehiculosFiltrados.find(v => v.id === Number(vehiculoId));
      const vehiculoInfo = veh ? `${veh.marca} ${veh.modelo} · Placa: ${veh.placa}` : "";
      const clienteNombre = clientes.find(c => c.id === Number(clienteId))?.nombre || "Consumidor Final";
      
      setUltimaVenta({ venta: data, items: snap });
      abrirImpresion(generarHTML(data, snap, clienteNombre, vehiculoInfo));
      setCarrito([]); setClienteId(""); setVehiculoId(""); setMontoRecibido("");
      fetchData();
    } catch { alert("Error generando factura"); }
    finally { setLoading(false); }
  };

  // Re-imprimir
  const reimprimirDesdeHistorial = async (venta) => {
    try {
      const res = await fetch(`${API}/ventas/${venta.id}/items`);
      const data = await res.json();
      abrirImpresion(generarHTML(venta, data.items || [], venta.customer_name || "Consumidor Final", ""));
    } catch { alert("Error al cargar ítems"); }
  };

  // Eliminar/Cancelar (Se mantienen tus funciones)
  const eliminarFactura = async (id) => {
    if (!confirm(`¿Eliminar permanentemente FAC-${String(id).padStart(5, "0")}?`)) return;
    try {
      const res = await fetch(`${API}/ventas/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) return alert(data.error);
      fetchData();
    } catch { alert("Error al eliminar"); }
  };

  const cancelarFactura = async (venta) => {
    if (!confirm(`¿Cancelar FAC-${String(venta.id).padStart(5, "0")}?`)) return;
    try {
      await fetch(`${API}/ventas/${venta.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "CANCELADA" })
      });
      fetchData();
    } catch { alert("Error al cancelar"); }
  };

  const guardarEdicion = async () => {
    if (!modalVenta) return;
    try {
      await fetch(`${API}/ventas/${modalVenta.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: modalMethod, ncf_tipo: modalNcfTipo, customer_name: modalCliente })
      });
      setModalVenta(null);
      fetchData();
    } catch { alert("Error al guardar"); }
  };

  return (
    <div style={container}>
      <h1 style={title}>🧾 Facturación y Taller — {EMPRESA.nombre}</h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {["nueva", "historial"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...tabBtn, background: tab === t ? "#111827" : "#fff", color: tab === t ? "#fff" : "#111" }}>
            {t === "nueva" ? "➕ Facturación / Cotización" : `📋 Historial (${ventas.length})`}
          </button>
        ))}
      </div>

      {tab === "nueva" && (
        <div style={grid}>
          {/* COLUMNA IZQUIERDA: CONFIGURACIÓN */}
          <div>
            {/* CARGAR DIAGNÓSTICO */}
            <div style={{ ...card, marginBottom: 16, border: "2px solid #3b82f6" }}>
              <h2 style={{ ...cardTitle, color: "#1e40af", display: "flex", alignItems: "center", gap: 8 }}>
                📋 Cargar Diagnóstico Técnico
              </h2>
              <select style={input} onChange={(e) => {
                const d = diagnosticos.find(x => x.id === Number(e.target.value));
                if (d) cargarDiagnostico(d);
              }}>
                <option value="">-- Seleccionar diagnóstico pendiente --</option>
                {diagnosticos.map(d => (
                  <option key={d.id} value={d.id}>Diag #{d.id} - {d.cliente_nombre} ({d.vehiculo_marca})</option>
                ))}
              </select>
            </div>

            <div style={{ ...card, marginBottom: 16 }}>
              <h2 style={cardTitle}>👤 Cliente y Vehículo</h2>
              <label style={label}>Cliente</label>
              <select value={clienteId} onChange={e => { setClienteId(e.target.value); setVehiculoId(""); }} style={input}>
                <option value="">Consumidor Final</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>

              {clienteId && (
                <>
                  <label style={label}>Vehículo</label>
                  <select value={vehiculoId} onChange={e => setVehiculoId(e.target.value)} style={input}>
                    <option value="">— Sin vehículo —</option>
                    {vehiculosFiltrados.map(v => (
                      <option key={v.id} value={v.id}>{v.marca} {v.modelo} · {v.placa}</option>
                    ))}
                  </select>
                </>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>Tipo NCF</label>
                  <select value={ncfTipo} onChange={e => setNcfTipo(e.target.value)} style={input}>
                    <option value="B02">B02 — Consumidor Final</option>
                    <option value="B01">B01 — Crédito Fiscal</option>
                    <option value="B15">B15 — Gubernamental</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Método de pago</label>
                  <select value={method} onChange={e => setMethod(e.target.value)} style={input}>
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TARJETA">Tarjeta</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={card}>
              <h2 style={cardTitle}>📦 Repuestos del Inventario</h2>
              <input placeholder="Buscar repuesto para añadir..." value={busqueda}
                onChange={e => setBusqueda(e.target.value)} style={{ ...input, marginBottom: 12 }} />
              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                {itemsFiltrados.map(i => (
                  <div key={i.id} style={productoRow}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{i.name}</div>
                      <div style={{ fontSize: 12, color: i.stock > 0 ? "#10b981" : "#e74c3c" }}>Stock: {i.stock}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 700 }}>RD$ {Number(i.price).toFixed(2)}</span>
                      <button onClick={() => addItem(i)} disabled={i.stock <= 0}
                        style={{ ...btnAdd, background: i.stock <= 0 ? "#ccc" : "#111827" }}>+ Agregar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: CARRITO Y PAGO */}
          <div style={card}>
            <h2 style={cardTitle}>🛒 Detalle de Servicios y Piezas</h2>

            {carrito.length === 0 ? (
              <p style={{ color: "#888", textAlign: "center", padding: 40 }}>Carrito vacío</p>
            ) : carrito.map(p => (
              <div key={p.id} style={carritoRow}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>RD$ {Number(p.price).toFixed(2)} c/u</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => updateQty(p.id, p.qty - 1)} style={btnQty}>−</button>
                  <span style={{ fontWeight: 700, minWidth: 24, textAlign: "center" }}>{p.qty}</span>
                  <button onClick={() => updateQty(p.id, p.qty + 1)} style={btnQty}>+</button>
                  <span style={{ minWidth: 90, textAlign: "right", fontWeight: 600 }}>RD$ {(p.price * p.qty).toFixed(2)}</span>
                </div>
              </div>
            ))}

            <div style={totalesBox}>
              <div style={totalesRow}><span>Subtotal</span><span>RD$ {subtotal.toFixed(2)}</span></div>
              <div style={totalesRow}><span>ITBIS (18%)</span><span>RD$ {itbis.toFixed(2)}</span></div>
              <div style={{ ...totalesRow, fontWeight: 700, fontSize: 18, borderTop: "2px solid #e2e8f0", paddingTop: 10, marginTop: 4 }}>
                <span>TOTAL</span><span>RD$ {total.toFixed(2)}</span>
              </div>
            </div>

            <div style={vueltoBx}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#92400e" }}>💵 Recibido (RD$)</label>
              <input type="number" value={montoRecibido} onChange={e => setMontoRecibido(e.target.value)} placeholder="0.00"
                style={{ display: "block", padding: "10px 12px", width: "100%", borderRadius: 8, border: "1px solid #fde68a", fontSize: 18, fontWeight: 700, boxSizing: "border-box" }} />
              {Number(montoRecibido) > 0 && (
                <div style={{ marginTop: 10, padding: "10px", borderRadius: 8, textAlign: "center", background: vuelto >= 0 ? "#dcfce7" : "#fee2e2", color: vuelto >= 0 ? "#166534" : "#dc2626", fontWeight: 800, fontSize: 20 }}>
                  {vuelto >= 0 ? `Vuelto: RD$ ${vuelto.toFixed(2)}` : `Faltan: RD$ ${Math.abs(vuelto).toFixed(2)}`}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={handleCotizacion} style={{ ...btnFacturar, background: "#64748b", marginTop: 0 }}>📄 Cotización</button>
              <button onClick={generarFactura} disabled={loading || carrito.length === 0}
                style={{ ...btnFacturar, background: carrito.length === 0 ? "#aaa" : "#10b981", marginTop: 0, flex: 2 }}>
                {loading ? "Procesando..." : `🖨️ Facturar`}
              </button>
            </div>

            {ultimaVenta && (
              <button onClick={() => abrirImpresion(generarHTML(ultimaVenta.venta, ultimaVenta.items, ultimaVenta.venta.customer_name, ""))} style={btnReimprimir}>
                🔁 Reimprimir FAC-{String(ultimaVenta.venta.id).padStart(5, "0")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ====== HISTORIAL ====== */}
      {tab === "historial" && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ ...cardTitle, marginBottom: 0 }}>📋 Historial de Ventas</h2>
            <input placeholder="Buscar por cliente o NCF..."
              value={buscandoHistorial} onChange={e => setBuscandoHistorial(e.target.value)}
              style={{ ...input, width: 280, marginBottom: 0 }} />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>{["Factura", "NCF", "Tipo", "Cliente", "Método", "Total", "Estado", "Fecha", "Acciones"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {ventasFiltradas.map(v => {
                  const cancelada = v.estado === "CANCELADA";
                  return (
                    <tr key={v.id} style={{ opacity: cancelada ? 0.6 : 1 }}>
                      <td style={td}><b>FAC-{String(v.id).padStart(5, "0")}</b></td>
                      <td style={{ ...td, fontSize: 11 }}>{v.ncf}</td>
                      <td style={td}>{v.ncf_tipo}</td>
                      <td style={td}>{v.customer_name}</td>
                      <td style={td}>{v.method}</td>
                      <td style={{ ...td, fontWeight: 700 }}>RD$ {Number(v.total).toFixed(2)}</td>
                      <td style={td}>{cancelada ? "🔴 CANCELADA" : "🟢 ACTIVA"}</td>
                      <td style={{ ...td, fontSize: 11 }}>{new Date(v.created_at).toLocaleString("es-DO")}</td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => reimprimirDesdeHistorial(v)} style={btnAcc("#111827")}>🖨️</button>
                          {!cancelada && <button onClick={() => cancelarFactura(v)} style={btnAcc("#f59e0b")}>⛔</button>}
                          <button onClick={() => eliminarFactura(v.id)} style={btnAcc("#dc2626")}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====== MODAL EDITAR (Opcional) ====== */}
      {modalVenta && (
        <div style={overlay}>
          <div style={modal}>
            <h2 style={{ marginBottom: 16 }}>✏️ Editar Factura</h2>
            <label style={label}>Cliente</label>
            <input value={modalCliente} onChange={e => setModalCliente(e.target.value)} style={input} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={guardarEdicion} style={{ flex: 1, padding: 12, background: "#111827", color: "#fff", borderRadius: 8 }}>💾 Guardar</button>
              <button onClick={() => setModalVenta(null)} style={{ flex: 1, padding: 12, background: "#eee", borderRadius: 8 }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ESTILOS (Se mantienen exactamente como los tenías)
const container: React.CSSProperties = { padding: "20px", background: "#f5f7fb", minHeight: "100vh" };
const title: React.CSSProperties = { fontSize: "24px", fontWeight: "bold", marginBottom: "20px" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" };
const card: React.CSSProperties = { background: "#fff", padding: "20px", borderRadius: "15px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" };
const cardTitle = { marginBottom: "15px", fontSize: "18px", fontWeight: "600" };
const tabBtn: React.CSSProperties = { padding: "10px 20px", borderRadius: "8px", border: "1px solid #ddd", cursor: "pointer", fontWeight: 600 };
const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#555" };
const input: React.CSSProperties = { display: "block", marginBottom: "12px", padding: "12px", width: "100%", borderRadius: "8px", border: "1px solid #ddd", boxSizing: "border-box", fontSize: 14 };
const productoRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f0f0f0" };
const carritoRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f0f0f0", gap: 8 };
const totalesBox: React.CSSProperties = { marginTop: 16, padding: 16, background: "#f8fafc", borderRadius: 10 };
const totalesRow = { display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 15 };
const vueltoBx: React.CSSProperties = { marginTop: 12, padding: 14, background: "#fefce8", borderRadius: 10, border: "1px solid #fde68a" };
const btnAdd: React.CSSProperties = { padding: "6px 14px", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" };
const btnQty: React.CSSProperties = { padding: "2px 10px", background: "#f1f5f9", border: "1px solid #ddd", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" };
const btnFacturar: React.CSSProperties = { padding: "14px", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", width: "100%", marginTop: 16, fontSize: 16, fontWeight: 700 };
const btnReimprimir: React.CSSProperties = { padding: "10px", background: "#f1f5f9", color: "#111", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", width: "100%", marginTop: 10, fontSize: 13 };
const btnAcc = (bg) => ({ padding: "5px 9px", background: bg, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 });
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", background: "#f1f5f9", fontSize: 13, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #eee", fontSize: 13 };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const modal: React.CSSProperties = { background: "#fff", padding: 28, borderRadius: 16, width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };