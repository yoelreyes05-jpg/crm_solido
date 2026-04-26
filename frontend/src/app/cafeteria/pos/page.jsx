"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { API_URL as API } from "@/config";

// ─── Empresa ─────────────────────────────────────────────────────────────────
const EMPRESA = {
  nombre: "SÓLIDO AUTO CAFÉ",
  sub: "Sólido Auto Servicio SRL",
  telefono: "809-712-2027",
};

// ─── Categorías predefinidas ──────────────────────────────────────────────────
const CATS_EXTRA = ["Todos", "Sin categoría"];

// ─── Métodos de pago ─────────────────────────────────────────────────────────
const METODOS = [
  { key: "EFECTIVO",       label: "💵 Efectivo",       color: "#10b981" },
  { key: "TARJETA",        label: "💳 Tarjeta",         color: "#3b82f6" },
  { key: "TRANSFERENCIA",  label: "📲 Transferencia",   color: "#8b5cf6" },
];

// ─── Tipos NCF ────────────────────────────────────────────────────────────────
const NCF_TIPOS = [
  { key: "B02", label: "B02 — Consumidor Final" },
  { key: "B01", label: "B01 — Crédito Fiscal" },
  { key: "B14", label: "B14 — Régimen Especial" },
];

// ─── Print via iframe (proven method) ────────────────────────────────────────
function imprimirHTML(html) {
  const prev = document.getElementById("__cafe_print_iframe__");
  if (prev) prev.remove();
  const iframe = document.createElement("iframe");
  iframe.id = "__cafe_print_iframe__";
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:820px;height:1000px;border:none;opacity:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
    return;
  }
  doc.open(); doc.write(html); doc.close();
  iframe.onload = () => {
    try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }
    catch { const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); } }
  };
}

// ─── HTML del recibo ──────────────────────────────────────────────────────────
function generarRecibo(items, total, metodo, ncf, ncfTipo, ventaId) {
  const fecha = new Date().toLocaleString("es-DO", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
  const lineas = items.map(p =>
    `<div class="item"><span>${p.nombre} x${p.qty}</span><span>RD$ ${(p.precio * p.qty).toFixed(2)}</span></div>`
  ).join("");
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Recibo Cafetería</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Courier New',monospace; font-size:13px; max-width:320px; margin:0 auto; padding:20px 16px; }
    .center { text-align:center; }
    .bold { font-weight:700; }
    .lg { font-size:16px; }
    .sm { font-size:11px; color:#666; }
    hr { border:none; border-top:1px dashed #ccc; margin:10px 0; }
    .item { display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dotted #eee; }
    .total-row { display:flex; justify-content:space-between; padding:8px 0; font-size:15px; font-weight:900; border-top:2px solid #111; margin-top:6px; }
    .ncf-box { background:#111; color:#fff; padding:10px 12px; border-radius:6px; margin:12px 0; text-align:center; }
    .ncf-num { font-size:17px; font-weight:900; letter-spacing:3px; }
    @media print { body { padding:4px; } }
  </style></head><body>
  <div class="center">
    <div class="bold lg">${EMPRESA.nombre}</div>
    <div class="sm">${EMPRESA.sub}</div>
    <div class="sm">Tel: ${EMPRESA.telefono}</div>
  </div>
  <hr/>
  <div class="center sm">Fecha: ${fecha}<br/>Recibo: #${String(ventaId || "---").padStart(5,"0")}</div>
  <hr/>
  ${lineas}
  <div class="total-row"><span>TOTAL</span><span>RD$ ${total.toFixed(2)}</span></div>
  <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:4px;color:#666;">
    <span>Método: ${metodo}</span><span>NCF: ${ncfTipo}</span>
  </div>
  ${ncf ? `<div class="ncf-box"><div class="sm" style="color:rgba(255,255,255,.6);margin-bottom:3px;">Comprobante Fiscal</div><div class="ncf-num">${ncf}</div></div>` : ""}
  <hr/>
  <div class="center sm">¡Gracias por su visita!<br/>Sólido Auto Servicio · ${EMPRESA.telefono}</div>
  </body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CafeteriaPOS() {
  const [productos,    setProductos]    = useState([]);
  const [carrito,      setCarrito]      = useState([]);
  const [catActiva,    setCatActiva]    = useState("Todos");
  const [metodo,       setMetodo]       = useState("EFECTIVO");
  const [ncfTipo,      setNcfTipo]      = useState("B02");
  const [tab,          setTab]          = useState("pos"); // "pos" | "historial"
  const [historial,    setHistorial]    = useState([]);
  const [cobrando,     setCobrando]     = useState(false);
  const [ultimaVenta,  setUltimaVenta]  = useState(null);
  const [stockModal,   setStockModal]   = useState(null); // producto para ajuste stock
  const [stockVal,     setStockVal]     = useState("");
  const [guardandoStk, setGuardandoStk] = useState(false);

  // ── Cargar productos ──────────────────────────────────────────────────────
  const cargarProductos = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/cafeteria/productos`);
      const data = await res.json();
      setProductos(Array.isArray(data) ? data : []);
    } catch { setProductos([]); }
  }, []);

  // ── Cargar historial de ventas ────────────────────────────────────────────
  const cargarHistorial = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/cafeteria/ordenes`);
      const data = await res.json();
      setHistorial(Array.isArray(data) ? data : []);
    } catch { setHistorial([]); }
  }, []);

  useEffect(() => {
    cargarProductos();
  }, [cargarProductos]);

  useEffect(() => {
    if (tab === "historial") cargarHistorial();
  }, [tab, cargarHistorial]);

  // ── Categorías dinámicas ──────────────────────────────────────────────────
  const categorias = useMemo(() => {
    const cats = new Set(productos.map(p => p.categoria || "Sin categoría"));
    return ["Todos", ...Array.from(cats)];
  }, [productos]);

  // ── Filtrar por categoría ─────────────────────────────────────────────────
  const productosFiltrados = useMemo(() => {
    if (catActiva === "Todos") return productos;
    return productos.filter(p => (p.categoria || "Sin categoría") === catActiva);
  }, [productos, catActiva]);

  // ── Carrito: agregar ──────────────────────────────────────────────────────
  const agregar = (prod) => {
    if (prod.stock <= 0) return; // sin stock, botón deshabilitado visualmente
    setCarrito(prev => {
      const ex = prev.find(p => p.id === prod.id);
      if (ex) {
        if (ex.qty >= prod.stock) return prev; // no superar stock
        return prev.map(p => p.id === prod.id ? { ...p, qty: p.qty + 1 } : p);
      }
      return [...prev, { ...prod, qty: 1 }];
    });
  };

  // ── Carrito: cambiar cantidad ─────────────────────────────────────────────
  const cambiarQty = (id, delta) => {
    setCarrito(prev => prev
      .map(p => p.id === id ? { ...p, qty: Math.max(0, p.qty + delta) } : p)
      .filter(p => p.qty > 0)
    );
  };

  // ── Carrito: vaciar ───────────────────────────────────────────────────────
  const vaciarCarrito = () => setCarrito([]);

  // ── Total ─────────────────────────────────────────────────────────────────
  const total = carrito.reduce((a, p) => a + p.precio * p.qty, 0);

  // ── Cobrar ────────────────────────────────────────────────────────────────
  const cobrar = async () => {
    if (carrito.length === 0) return;
    setCobrando(true);
    try {
      const res = await fetch(`${API}/cafeteria/venta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: carrito.map(p => ({ id: p.id, qty: p.qty, precio: p.precio })),
          total,
          metodo_pago: metodo,
          ncf_tipo: ncfTipo,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert("❌ Error al procesar la venta: " + (data.error || ""));
        return;
      }
      setUltimaVenta(data);
      // Imprimir recibo
      imprimirHTML(generarRecibo(carrito, total, metodo, data.ncf, ncfTipo, data.id));
      setCarrito([]);
      cargarProductos();
    } catch (e) {
      alert("Error de conexión: " + e.message);
    } finally {
      setCobrando(false);
    }
  };

  // ── Ajuste de stock ───────────────────────────────────────────────────────
  const guardarStock = async () => {
    if (!stockModal || stockVal === "") return;
    setGuardandoStk(true);
    try {
      await fetch(`${API}/cafeteria/productos/${stockModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: Number(stockVal) }),
      });
      setStockModal(null);
      setStockVal("");
      cargarProductos();
    } catch { alert("Error al actualizar stock"); }
    finally { setGuardandoStk(false); }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"#0f172a", fontFamily:"system-ui,sans-serif", color:"#f1f5f9" }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div style={{ display:"flex", alignItems:"center", gap:16, padding:"12px 20px", background:"#1e293b", borderBottom:"1px solid #334155" }}>
        <span style={{ fontSize:24 }}>☕</span>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800, fontSize:16 }}>{EMPRESA.nombre}</div>
          <div style={{ fontSize:11, color:"#64748b" }}>{EMPRESA.sub}</div>
        </div>
        {/* Tabs */}
        <div style={{ display:"flex", gap:6 }}>
          {[{ k:"pos", icon:"🛒", label:"POS" }, { k:"historial", icon:"📋", label:"Historial" }].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              padding:"7px 16px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:700, fontSize:13,
              background: tab === t.k ? "#3b82f6" : "#334155",
              color: tab === t.k ? "#fff" : "#94a3b8",
            }}>{t.icon} {t.label}</button>
          ))}
        </div>
      </div>

      {/* ══ TAB: POS ════════════════════════════════════════════════════════ */}
      {tab === "pos" && (
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* ── PANEL IZQUIERDO: Productos ─────────────────────────────────── */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", borderRight:"1px solid #1e293b" }}>

            {/* Categorías */}
            <div style={{ display:"flex", gap:6, padding:"10px 14px", overflowX:"auto", background:"#1e293b", flexShrink:0 }}>
              {categorias.map(cat => (
                <button key={cat} onClick={() => setCatActiva(cat)} style={{
                  padding:"6px 14px", borderRadius:20, border:"none", cursor:"pointer", fontWeight:700,
                  fontSize:12, whiteSpace:"nowrap", transition:"all 0.15s",
                  background: catActiva === cat ? "#f59e0b" : "#334155",
                  color: catActiva === cat ? "#111" : "#94a3b8",
                }}>{cat}</button>
              ))}
            </div>

            {/* Grid de productos */}
            <div style={{ flex:1, overflowY:"auto", padding:14, display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:10, alignContent:"start" }}>
              {productosFiltrados.length === 0 && (
                <div style={{ gridColumn:"1/-1", textAlign:"center", color:"#475569", padding:32, fontSize:15 }}>
                  Sin productos en esta categoría
                </div>
              )}
              {productosFiltrados.map(prod => {
                const sinStock = prod.stock <= 0;
                const enCarrito = carrito.find(p => p.id === prod.id);
                return (
                  <button
                    key={prod.id}
                    onClick={() => !sinStock && agregar(prod)}
                    style={{
                      position:"relative", display:"flex", flexDirection:"column", alignItems:"center",
                      padding:"12px 8px", borderRadius:14, border:"none", cursor: sinStock ? "not-allowed" : "pointer",
                      background: sinStock ? "#1e293b" : enCarrito ? "#1d3a5f" : "#1e293b",
                      boxShadow: enCarrito ? "0 0 0 2px #3b82f6" : "0 2px 8px rgba(0,0,0,0.4)",
                      opacity: sinStock ? 0.5 : 1,
                      transition:"all 0.15s", textAlign:"center",
                    }}
                  >
                    {/* Imagen o emoji */}
                    {prod.imagen
                      ? <img src={prod.imagen} alt={prod.nombre} style={{ width:64, height:64, borderRadius:10, objectFit:"cover", marginBottom:8 }} />
                      : <div style={{ width:64, height:64, borderRadius:10, background:"#334155", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, marginBottom:8 }}>☕</div>
                    }
                    <div style={{ fontSize:12, fontWeight:700, color:"#f1f5f9", lineHeight:1.2, marginBottom:4 }}>{prod.nombre}</div>
                    <div style={{ fontSize:14, fontWeight:900, color:"#10b981" }}>RD$ {Number(prod.precio).toFixed(2)}</div>
                    <div style={{ fontSize:10, color: prod.stock <= 3 ? "#ef4444" : "#64748b", marginTop:2 }}>
                      {sinStock ? "❌ Sin stock" : `📦 ${prod.stock}`}
                    </div>
                    {enCarrito && (
                      <div style={{ position:"absolute", top:6, right:6, background:"#3b82f6", color:"#fff", borderRadius:"50%", width:20, height:20, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:900 }}>
                        {enCarrito.qty}
                      </div>
                    )}
                    {/* Botón quick-stock */}
                    <button
                      onClick={e => { e.stopPropagation(); setStockModal(prod); setStockVal(String(prod.stock)); }}
                      title="Ajustar stock"
                      style={{ position:"absolute", bottom:4, right:4, background:"#334155", border:"none", borderRadius:6, color:"#94a3b8", fontSize:10, padding:"2px 5px", cursor:"pointer" }}
                    >⚙</button>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── PANEL DERECHO: Carrito + Cobro ────────────────────────────── */}
          <div style={{ width:300, display:"flex", flexDirection:"column", background:"#1e293b" }}>

            {/* Carrito header */}
            <div style={{ padding:"12px 16px", borderBottom:"1px solid #334155", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontWeight:800, fontSize:15 }}>🛒 Carrito <span style={{ fontSize:12, color:"#64748b" }}>({carrito.length} items)</span></div>
              {carrito.length > 0 && (
                <button onClick={vaciarCarrito} style={{ background:"#450a0a", color:"#fca5a5", border:"none", borderRadius:6, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                  ✕ Vaciar
                </button>
              )}
            </div>

            {/* Items carrito */}
            <div style={{ flex:1, overflowY:"auto", padding:"8px 12px" }}>
              {carrito.length === 0 && (
                <div style={{ textAlign:"center", color:"#475569", padding:"32px 0", fontSize:13 }}>
                  Toca un producto para agregar
                </div>
              )}
              {carrito.map(p => (
                <div key={p.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom:"1px solid #334155" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700 }}>{p.nombre}</div>
                    <div style={{ fontSize:12, color:"#10b981" }}>RD$ {(p.precio * p.qty).toFixed(2)}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <button onClick={() => cambiarQty(p.id, -1)} style={btnQty}>−</button>
                    <span style={{ fontSize:14, fontWeight:800, minWidth:20, textAlign:"center" }}>{p.qty}</span>
                    <button onClick={() => cambiarQty(p.id, +1)} style={btnQty}>+</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div style={{ padding:"10px 16px", borderTop:"1px solid #334155", background:"#0f172a" }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:22, fontWeight:900, color:"#10b981", marginBottom:10 }}>
                <span>TOTAL</span>
                <span>RD$ {total.toFixed(2)}</span>
              </div>

              {/* Método pago */}
              <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                {METODOS.map(m => (
                  <button key={m.key} onClick={() => setMetodo(m.key)} style={{
                    flex:1, padding:"8px 4px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:700,
                    fontSize:11, background: metodo === m.key ? m.color : "#334155",
                    color: metodo === m.key ? "#fff" : "#94a3b8",
                  }}>{m.label}</button>
                ))}
              </div>

              {/* NCF tipo */}
              <select value={ncfTipo} onChange={e => setNcfTipo(e.target.value)} style={{
                width:"100%", background:"#334155", color:"#f1f5f9", border:"1px solid #475569",
                borderRadius:8, padding:"8px 10px", fontSize:12, marginBottom:10, cursor:"pointer",
              }}>
                {NCF_TIPOS.map(n => <option key={n.key} value={n.key}>{n.label}</option>)}
              </select>

              {/* Botón cobrar */}
              <button
                onClick={cobrar}
                disabled={cobrando || carrito.length === 0}
                style={{
                  width:"100%", padding:"16px", borderRadius:12, border:"none", cursor: carrito.length === 0 ? "not-allowed" : "pointer",
                  background: carrito.length === 0 ? "#334155" : "linear-gradient(135deg,#059669,#10b981)",
                  color:"#fff", fontSize:17, fontWeight:900,
                  boxShadow: carrito.length > 0 ? "0 4px 16px rgba(16,185,129,0.4)" : "none",
                  opacity: cobrando ? 0.7 : 1,
                }}
              >
                {cobrando ? "⏳ Procesando..." : "💳 COBRAR"}
              </button>

              {/* Última venta */}
              {ultimaVenta && (
                <div style={{ marginTop:10, background:"#064e3b", borderRadius:8, padding:"8px 12px", fontSize:12 }}>
                  <div style={{ fontWeight:700, color:"#34d399" }}>✅ Venta #{ultimaVenta.id} procesada</div>
                  {ultimaVenta.ncf && <div style={{ color:"#6ee7b7", marginTop:2 }}>NCF: {ultimaVenta.ncf}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: HISTORIAL ══════════════════════════════════════════════════ */}
      {tab === "historial" && (
        <div style={{ flex:1, overflowY:"auto", padding:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h2 style={{ fontSize:18, fontWeight:800, margin:0 }}>📋 Historial de Ventas</h2>
            <button onClick={cargarHistorial} style={{ background:"#334155", color:"#94a3b8", border:"none", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontWeight:700, fontSize:13 }}>
              🔄 Actualizar
            </button>
          </div>
          {historial.length === 0 ? (
            <div style={{ textAlign:"center", color:"#475569", padding:48, fontSize:15 }}>Sin ventas registradas</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {historial.map(v => {
                const mColor = { EFECTIVO:"#10b981", TARJETA:"#3b82f6", TRANSFERENCIA:"#8b5cf6" }[v.metodo_pago] || "#64748b";
                return (
                  <div key={v.id} style={{ background:"#1e293b", borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", gap:16, border:"1px solid #334155" }}>
                    <div style={{ background:"#0f172a", borderRadius:10, padding:"8px 12px", textAlign:"center", minWidth:54 }}>
                      <div style={{ fontSize:11, color:"#64748b" }}>#{String(v.id).padStart(4,"0")}</div>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:15, fontWeight:800, color:"#10b981" }}>RD$ {Number(v.total).toFixed(2)}</div>
                      {v.ncf && <div style={{ fontSize:11, color:"#64748b" }}>NCF: {v.ncf}</div>}
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <span style={{ background:mColor, color:"#fff", borderRadius:6, padding:"3px 9px", fontSize:11, fontWeight:700 }}>
                        {v.metodo_pago || "EFECTIVO"}
                      </span>
                      <div style={{ fontSize:11, color:"#64748b", marginTop:4 }}>
                        {v.created_at ? new Date(v.created_at).toLocaleString("es-DO") : "—"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ MODAL AJUSTE STOCK ══════════════════════════════════════════════ */}
      {stockModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
          <div style={{ background:"#1e293b", borderRadius:16, padding:28, width:300, border:"1px solid #334155" }}>
            <h3 style={{ fontSize:16, fontWeight:800, marginBottom:16 }}>⚙ Ajustar Stock</h3>
            <div style={{ fontSize:14, color:"#94a3b8", marginBottom:12 }}>{stockModal.nombre}</div>
            <input
              type="number" min={0} value={stockVal}
              onChange={e => setStockVal(e.target.value)}
              style={{ width:"100%", background:"#334155", border:"1px solid #475569", borderRadius:8, color:"#f1f5f9", padding:"10px 12px", fontSize:16, marginBottom:14 }}
              autoFocus
            />
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => { setStockModal(null); setStockVal(""); }}
                style={{ flex:1, padding:10, background:"#334155", color:"#94a3b8", border:"none", borderRadius:8, cursor:"pointer", fontWeight:700 }}>
                Cancelar
              </button>
              <button onClick={guardarStock} disabled={guardandoStk}
                style={{ flex:1, padding:10, background:"#10b981", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:700 }}>
                {guardandoStk ? "..." : "✓ Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Estilos pequeños ─────────────────────────────────────────────────────────
const btnQty = {
  width:28, height:28, borderRadius:7, border:"none",
  background:"#334155", color:"#f1f5f9", fontSize:16, fontWeight:900,
  cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
  lineHeight:1,
};
