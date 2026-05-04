"use client";
import { useEffect, useState, useRef, useCallback } from "react";

import { API_URL as API } from "@/config";

const EMPRESA = {
  nombre: "SÓLIDO AUTO SERVICIO",
  telefono: "809-712-2027",
  rnc: "RNC: 000-000000-0",
  direccion: "Santo Domingo, República Dominicana"
};

const NCF_LABEL_MAP: Record<string, string> = {
  B01: "Crédito Fiscal",
  B02: "Consumidor Final",
  B14: "Régimen Especial",
  B15: "Gubernamental",
};

function generarHTMLCafe(venta: any, items: any, metodoPago: any) {
  const fecha = new Date(venta.created_at || Date.now()).toLocaleString("es-DO", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
  const ncfLabel = NCF_LABEL_MAP[venta.ncf_tipo] || venta.ncf_tipo || "B02";
  const lineas = items.map((i: any) => `
    <tr>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;">${i.nombre}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:center;">${i.qty}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;">RD$ ${Number(i.precio).toFixed(2)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:700;">RD$ ${(i.precio * i.qty).toFixed(2)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>Cafetería ${venta.ncf || ""}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:24px;max-width:400px;margin:auto;}
    .header{text-align:center;border-bottom:3px solid #111;padding-bottom:14px;margin-bottom:16px;}
    .logo{font-size:20px;font-weight:900;letter-spacing:1px;}
    .sub{font-size:11px;color:#555;margin-top:4px;line-height:1.6;}
    .ncf-box{background:#111;color:#fff;text-align:center;padding:8px;border-radius:6px;margin:12px 0;}
    .ncf-num{font-size:15px;font-weight:900;letter-spacing:2px;}
    table{width:100%;border-collapse:collapse;margin-bottom:12px;}
    thead th{background:#111;color:#fff;padding:8px 6px;font-size:11px;text-align:left;}
    .totales{border-top:2px solid #111;padding-top:8px;margin-top:4px;}
    .t-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px;}
    .t-total{font-size:18px;font-weight:900;}
    .footer{text-align:center;margin-top:20px;font-size:11px;color:#777;border-top:1px dashed #ccc;padding-top:12px;line-height:1.8;}
    @media print{body{padding:8px;}}
  </style></head><body>
  <div class="header">
    <div class="logo">☕ ${EMPRESA.nombre}</div>
    <div class="sub">Tel: ${EMPRESA.telefono}<br/>${EMPRESA.rnc} | ${EMPRESA.direccion}</div>
  </div>
  <div style="font-size:12px;margin-bottom:10px;">
    <b>Fecha:</b> ${fecha}<br/>
    <b>Método:</b> ${metodoPago}<br/>
    <b>Comprobante:</b> ${venta.ncf_tipo || "B02"} — ${ncfLabel}
  </div>
  ${venta.ncf ? `<div class="ncf-box"><div style="font-size:9px;opacity:0.7;margin-bottom:2px;">COMPROBANTE FISCAL — ${ncfLabel}</div><div class="ncf-num">${venta.ncf}</div></div>` : ""}
  <table>
    <thead><tr>
      <th>Descripción</th><th style="text-align:center;">Cant.</th>
      <th style="text-align:right;">Precio</th><th style="text-align:right;">Total</th>
    </tr></thead>
    <tbody>${lineas}</tbody>
  </table>
  <div class="totales">
    <div class="t-row t-total"><span>TOTAL:</span><span>RD$ ${Number(venta.total).toFixed(2)}</span></div>
  </div>
  <div class="footer">
    ¡Gracias por su visita!<br/>
    <b>${EMPRESA.nombre}</b><br/>
    ${EMPRESA.telefono}
  </div>
  <script>window.onload=function(){window.print();}</script>
  </body></html>`;
}

// ─── Imprimir via iframe (fiable) ────────────────────────────────────────────
function imprimirHTMLCafe(html: string) {
  const prev = document.getElementById("__cafe_admin_iframe__");
  if (prev) prev.remove();
  const iframe = document.createElement("iframe");
  iframe.id = "__cafe_admin_iframe__";
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:820px;height:1000px;border:none;opacity:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || (iframe.contentWindow as any)?.document;
  if (!doc) { const w = window.open("","_blank"); if (w){w.document.write(html);w.document.close();} return; }
  doc.open(); doc.write(html); doc.close();
  iframe.onload = () => {
    try { (iframe.contentWindow as any)?.focus(); (iframe.contentWindow as any)?.print(); }
    catch { const w = window.open("","_blank"); if (w){w.document.write(html);w.document.close();} }
  };
}

export default function CafeteriaPage() {
  const [productos, setProductos] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [metodoPago, setMetodoPago] = useState("EFECTIVO");
  const [ncfTipo, setNcfTipo] = useState("B02");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("vender");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [ultimaVenta, setUltimaVenta] = useState(null);
  const [nuevoProducto, setNuevoProducto] = useState({
    nombre: "", precio: "", categoria: "General", stock: ""
  });
  const [nuevoImagen, setNuevoImagen] = useState<string>("");
  const [editImagenId, setEditImagenId] = useState<number|null>(null);
  const [editImagenB64, setEditImagenB64] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileEditRef  = useRef<HTMLInputElement>(null);
  // Editar producto completo
  const [editandoId, setEditandoId]   = useState<number|null>(null);
  const [editForm, setEditForm]       = useState<any>({});
  const [guardandoEdit, setGuardandoEdit] = useState(false);

  const obtener = async (): Promise<void> => {
    try {
      const res = await fetch(`${API}/cafeteria/productos`);
      const data = await res.json();
      setProductos(Array.isArray(data) ? data : []);
    } catch { setProductos([]); }
  };

  useEffect(() => { obtener(); }, []);

  const agregarAlCarrito = (p) => {
    if (p.stock <= 0) return alert("Sin stock disponible");
    setCarrito(prev => {
      const existe = prev.find(i => i.id === p.id);
      if (existe) {
        if (existe.qty >= p.stock) return prev;
        return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { id: p.id, nombre: p.nombre, precio: p.precio, qty: 1, stock: p.stock }];
    });
  };

  const cambiarQty = (id, delta) => {
    setCarrito(prev =>
      prev.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0)
    );
  };

  const total = carrito.reduce((acc, i) => acc + i.precio * i.qty, 0);
  const vuelto = Number(montoRecibido || 0) - total;

  const despachar = async () => {
    if (carrito.length === 0) return alert("Carrito vacío");
    if (Number(montoRecibido) > 0 && vuelto < 0)
      return alert(`Monto insuficiente. Faltan RD$ ${Math.abs(vuelto).toFixed(2)}`);

    setLoading(true);
    const snap = [...carrito];

    try {
      const res = await fetch(`${API}/cafeteria/venta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: snap, total, metodo_pago: metodoPago, ncf_tipo: ncfTipo })
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }

      setUltimaVenta({ venta: data, items: snap });

      // 🖨️ IMPRIMIR AUTOMÁTICO (iframe)
      imprimirHTMLCafe(generarHTMLCafe(data, snap, metodoPago));

      setCarrito([]);
      setMontoRecibido("");
      obtener();
    } catch (e) {
      console.error(e);
      alert("Error al despachar");
    } finally { setLoading(false); }
  };

  const crearProducto = async () => {
    if (!nuevoProducto.nombre || !nuevoProducto.precio) return alert("Nombre y precio requeridos");
    try {
      await fetch(`${API}/cafeteria/productos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...nuevoProducto, imagen: nuevoImagen || null })
      });
      setNuevoProducto({ nombre: "", precio: "", categoria: "General", stock: "" });
      setNuevoImagen("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      obtener();
    } catch { alert("Error al crear"); }
  };

  // ── Leer imagen como base64 ───────────────────────────────────────────────
  const leerImagen = (file: File, callback: (b64: string) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => callback(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Editar producto completo ──────────────────────────────────────────────
  const iniciarEdicion = (p: any) => {
    setEditandoId(p.id);
    setEditForm({ nombre: p.nombre, precio: p.precio, categoria: p.categoria || "", stock: p.stock });
    setEditImagenId(null); // cerrar imagen si estaba abierto
  };
  const guardarEdicion = async () => {
    if (!editandoId) return;
    setGuardandoEdit(true);
    try {
      const res = await fetch(`${API}/cafeteria/productos/${editandoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.error) { alert("Error: " + data.error); return; }
      setEditandoId(null);
      setEditForm({});
      obtener();
    } catch { alert("Error al guardar"); }
    finally { setGuardandoEdit(false); }
  };
  const eliminarProducto = async (id: number, nombre: string) => {
    if (!confirm(`¿Archivar "${nombre}"?\nEl producto ya no aparecerá en el POS ni en el menú.\nEl historial de ventas se conserva.`)) return;
    // Optimistic: quitar de UI inmediatamente
    setProductos((prev: any[]) => prev.filter((p: any) => p.id !== id));
    try {
      const res = await fetch(`${API}/cafeteria/productos/${id}`, { method: "DELETE" });
      let data: any = {};
      try { data = await res.json(); } catch {}
      if (!res.ok || data?.error) {
        // Revertir si falló
        alert("Error al eliminar: " + (data?.error || `HTTP ${res.status}`));
        await obtener();
        return;
      }
      // Confirmar con recarga limpia
      await obtener();
    } catch (e: any) {
      alert("Error de conexión: " + e.message);
      await obtener();
    }
  };

  // ── Guardar imagen de producto existente ──────────────────────────────────
  const guardarImagenProducto = async () => {
    if (!editImagenId || !editImagenB64) return;
    try {
      await fetch(`${API}/cafeteria/productos/${editImagenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagen: editImagenB64 }),
      });
      setEditImagenId(null);
      setEditImagenB64("");
      if (fileEditRef.current) fileEditRef.current.value = "";
      obtener();
    } catch { alert("Error al guardar imagen"); }
  };

  return (
    <div style={container}>
      <h1 style={title}>☕ SOLIDO CAFE GARAGE — {EMPRESA.nombre}</h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {[
          { k: "vender",    l: "🛒 Vender" },
          { k: "productos", l: "➕ Gestionar Productos" },
          { k: "cuadre",    l: "🏦 Cuadre" },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ ...tabBtn, background: tab === t.k ? "#111827" : "#fff", color: tab === t.k ? "#fff" : "#111" }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === "vender" && (
        <div style={grid}>
          {/* PRODUCTOS */}
          <div style={card}>
            <h2 style={cardTitle}>📋 Productos disponibles</h2>
            {productos.length === 0 ? (
              <p style={{ color: "#888" }}>Sin productos. Ve a "Gestionar Productos".</p>
            ) : productos.map(p => (
              <div key={p.id} style={productoRow}>
                <div>
                  <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>{p.categoria} · Stock: {p.stock}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 700 }}>RD$ {Number(p.precio).toFixed(2)}</span>
                  <button onClick={() => agregarAlCarrito(p)} disabled={p.stock <= 0}
                    style={{ ...btnAdd, background: p.stock <= 0 ? "#ccc" : "#111827" }}>
                    + Agregar
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* CARRITO + PAGO */}
          <div style={card}>
            <h2 style={cardTitle}>🛒 Orden</h2>

            {/* Método de pago */}
            <div style={{ marginBottom: 12 }}>
              <label style={label}>Método de pago</label>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { k: "EFECTIVO",      l: "💵 Efectivo",     c: "#10b981" },
                  { k: "TARJETA",       l: "💳 Tarjeta",      c: "#3b82f6" },
                  { k: "TRANSFERENCIA", l: "📲 Transfer.",    c: "#8b5cf6" },
                ].map(m => (
                  <button key={m.k} onClick={() => setMetodoPago(m.k)} style={{
                    flex: 1, padding: "9px 6px", borderRadius: 8, border: "none",
                    cursor: "pointer", fontWeight: 700, fontSize: 12,
                    background: metodoPago === m.k ? m.c : "#f1f5f9",
                    color: metodoPago === m.k ? "#fff" : "#555",
                    boxShadow: metodoPago === m.k ? `0 2px 8px ${m.c}55` : "none",
                  }}>{m.l}</button>
                ))}
              </div>
            </div>
            {/* Tipo comprobante — botones para evitar bug visual del select */}
            <div style={{ marginBottom: 12 }}>
              <label style={label}>🧾 Tipo Comprobante</label>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { k: "B02", l: "B02", d: "Consumidor Final" },
                  { k: "B01", l: "B01", d: "Crédito Fiscal"   },
                  { k: "B15", l: "B15", d: "Gubernamental"     },
                ].map(n => (
                  <button key={n.k} onClick={() => setNcfTipo(n.k)} style={{
                    flex: 1, padding: "8px 4px", borderRadius: 8, border: "none",
                    cursor: "pointer", fontWeight: 700, fontSize: 11, lineHeight: 1.3,
                    background: ncfTipo === n.k ? "#1d4ed8" : "#f1f5f9",
                    color: ncfTipo === n.k ? "#fff" : "#555",
                    boxShadow: ncfTipo === n.k ? "0 2px 8px rgba(29,78,216,0.35)" : "none",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 900 }}>{n.l}</div>
                    <div style={{ fontSize: 10, opacity: 0.8 }}>{n.d}</div>
                  </button>
                ))}
              </div>
            </div>

            {carrito.length === 0 ? (
              <p style={{ color: "#888", textAlign: "center", padding: 30 }}>Agrega productos al carrito</p>
            ) : carrito.map(i => (
              <div key={i.id} style={carritoRow}>
                <span style={{ flex: 1, fontWeight: 600 }}>{i.nombre}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => cambiarQty(i.id, -1)} style={btnQty}>−</button>
                  <span style={{ fontWeight: 700, minWidth: 20, textAlign: "center" }}>{i.qty}</span>
                  <button onClick={() => cambiarQty(i.id, 1)} style={btnQty}>+</button>
                  <span style={{ marginLeft: 8, minWidth: 90, textAlign: "right", fontWeight: 600 }}>
                    RD$ {(i.precio * i.qty).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}

            <div style={totalesBox}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 800 }}>
                <span>TOTAL:</span><span>RD$ {total.toFixed(2)}</span>
              </div>
            </div>

            {/* VUELTO */}
            <div style={vueltoBx}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#92400e" }}>
                💵 Monto recibido (RD$)
              </label>
              <input type="number" value={montoRecibido}
                onChange={e => setMontoRecibido(e.target.value)} placeholder="0.00"
                style={{ display: "block", padding: "10px 12px", width: "100%", borderRadius: 8, border: "1px solid #fde68a", fontSize: 18, fontWeight: 700, boxSizing: "border-box" }}
              />
              {Number(montoRecibido) > 0 && (
                <div style={{
                  marginTop: 10, padding: 14, borderRadius: 8, textAlign: "center",
                  background: vuelto >= 0 ? "#dcfce7" : "#fee2e2",
                  color: vuelto >= 0 ? "#166534" : "#dc2626",
                  fontWeight: 800, fontSize: 22
                }}>
                  {vuelto >= 0 ? `💚 Vuelto: RD$ ${vuelto.toFixed(2)}` : `🔴 Faltan: RD$ ${Math.abs(vuelto).toFixed(2)}`}
                </div>
              )}
            </div>

            <button onClick={despachar} disabled={loading || carrito.length === 0}
              style={{ ...btnDespachar, background: carrito.length === 0 ? "#aaa" : "#10b981" }}>
              {loading ? "Procesando..." : `🖨️ Despachar e Imprimir — RD$ ${total.toFixed(2)}`}
            </button>

            {ultimaVenta && (
              <button
                onClick={() => imprimirHTMLCafe(generarHTMLCafe(ultimaVenta.venta, ultimaVenta.items, metodoPago))}
                style={btnReimprimir}>
                🔁 Reimprimir último recibo
              </button>
            )}
          </div>
        </div>
      )}

      {tab === "cuadre" && <CafeteriaCuadre usuario={typeof window !== "undefined" ? (() => { try { return JSON.parse(localStorage.getItem("usuario") || "{}"); } catch { return {}; } })() : {}} />}

      {tab === "productos" && (
        <div style={{ maxWidth: 640 }}>
          <div style={card}>
            <h2 style={cardTitle}>➕ Nuevo Producto</h2>
            <label style={label}>Nombre *</label>
            <input placeholder="Ej: Café negro, Agua fría..." value={nuevoProducto.nombre}
              onChange={e => setNuevoProducto({ ...nuevoProducto, nombre: e.target.value })} style={input} />
            <label style={label}>Precio (RD$) *</label>
            <input type="number" placeholder="0.00" value={nuevoProducto.precio}
              onChange={e => setNuevoProducto({ ...nuevoProducto, precio: e.target.value })} style={input} />
            <label style={label}>Categoría</label>
            <input placeholder="Bebidas, Comida, Snacks..." value={nuevoProducto.categoria}
              onChange={e => setNuevoProducto({ ...nuevoProducto, categoria: e.target.value })} style={input} />
            <label style={label}>Stock inicial</label>
            <input type="number" placeholder="0" value={nuevoProducto.stock}
              onChange={e => setNuevoProducto({ ...nuevoProducto, stock: e.target.value })} style={input} />
            {/* Imagen */}
            <label style={label}>📸 Imagen (opcional)</label>
            <input ref={fileInputRef} type="file" accept="image/*"
              onChange={e => { const f = e.target.files?.[0]; if (f) leerImagen(f, b64 => setNuevoImagen(b64)); }}
              style={{ ...input, padding:"8px", cursor:"pointer" }} />
            {nuevoImagen && (
              <div style={{ marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
                <img src={nuevoImagen} alt="preview" style={{ width:60, height:60, borderRadius:8, objectFit:"cover", border:"2px solid #e5e7eb" }} />
                <button onClick={() => { setNuevoImagen(""); if (fileInputRef.current) fileInputRef.current.value=""; }}
                  style={{ fontSize:12, color:"#dc2626", background:"#fee2e2", border:"none", borderRadius:6, padding:"4px 10px", cursor:"pointer" }}>
                  ✕ Quitar
                </button>
              </div>
            )}
            <button onClick={crearProducto} style={btnPrimary}>Guardar Producto</button>
          </div>

          <div style={card}>
            <h3 style={{ marginBottom:14, fontSize:16, fontWeight:700 }}>📋 Productos existentes ({productos.length})</h3>
            {productos.map(p => (
              <div key={p.id}>
                {/* ── Fila normal ── */}
                {editandoId !== p.id && (
                  <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:"1px solid #f0f0f0" }}>
                    {/* Thumbnail */}
                    {p.imagen
                      ? <img src={p.imagen} alt={p.nombre} style={{ width:50, height:50, borderRadius:8, objectFit:"cover", border:"1px solid #e5e7eb", flexShrink:0 }} />
                      : <div style={{ width:50, height:50, borderRadius:8, background:"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>☕</div>
                    }
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14 }}>{p.nombre}</div>
                      <div style={{ fontSize:12, color:"#888" }}>
                        {p.categoria} ·{" "}
                        <span style={{ color: p.stock <= 0 ? "#ef4444" : p.stock <= 3 ? "#f59e0b" : "#10b981", fontWeight:700 }}>
                          Stock: {p.stock}
                        </span>
                        {" · "}RD$ {Number(p.precio).toFixed(2)}
                      </div>
                    </div>
                    {/* Acciones */}
                    <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                      <button onClick={() => { setEditImagenId(p.id); setEditandoId(null); setEditImagenB64(""); }}
                        title="Cambiar imagen"
                        style={{ background:"#f1f5f9", color:"#555", border:"1px solid #e2e8f0", borderRadius:7, padding:"5px 10px", fontSize:12, cursor:"pointer" }}>
                        📸
                      </button>
                      <button onClick={() => iniciarEdicion(p)}
                        style={{ background:"#eff6ff", color:"#1d4ed8", border:"1px solid #bfdbfe", borderRadius:7, padding:"5px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        ✏️ Editar
                      </button>
                      <button onClick={() => eliminarProducto(p.id, p.nombre)}
                        title="Archivar producto"
                        style={{ background:"#fee2e2", color:"#dc2626", border:"1px solid #fca5a5", borderRadius:7, padding:"5px 10px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        📦 Archivar
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Formulario de imagen ── */}
                {editImagenId === p.id && editandoId !== p.id && (
                  <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:"12px 14px", marginBottom:8 }}>
                    <div style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>📸 Cambiar imagen de "{p.nombre}"</div>
                    <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                      <input ref={fileEditRef} type="file" accept="image/*"
                        onChange={e => { const f = e.target.files?.[0]; if (f) leerImagen(f, b64 => setEditImagenB64(b64)); }}
                        style={{ fontSize:12 }} />
                      {editImagenB64 && <img src={editImagenB64} alt="preview" style={{ width:40, height:40, borderRadius:6, objectFit:"cover" }} />}
                      <button onClick={guardarImagenProducto} disabled={!editImagenB64}
                        style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:7, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>✓ Guardar</button>
                      <button onClick={() => { setEditImagenId(null); setEditImagenB64(""); }}
                        style={{ background:"#f1f5f9", color:"#555", border:"1px solid #ddd", borderRadius:7, padding:"6px 10px", fontSize:12, cursor:"pointer" }}>✕</button>
                    </div>
                  </div>
                )}

                {/* ── Formulario de edición completa ── */}
                {editandoId === p.id && (
                  <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:12, padding:"14px 16px", marginBottom:8 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:"#1d4ed8", marginBottom:10 }}>✏️ Editando: {p.nombre}</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                      <div>
                        <label style={{ ...label, color:"#1d4ed8" }}>Nombre</label>
                        <input value={editForm.nombre || ""} onChange={e => setEditForm((f:any) => ({...f, nombre:e.target.value}))}
                          style={{ ...input, marginBottom:0, border:"1px solid #93c5fd" }} />
                      </div>
                      <div>
                        <label style={{ ...label, color:"#1d4ed8" }}>Categoría</label>
                        <input value={editForm.categoria || ""} onChange={e => setEditForm((f:any) => ({...f, categoria:e.target.value}))}
                          style={{ ...input, marginBottom:0, border:"1px solid #93c5fd" }} />
                      </div>
                      <div>
                        <label style={{ ...label, color:"#1d4ed8" }}>Precio (RD$)</label>
                        <input type="number" value={editForm.precio || ""} onChange={e => setEditForm((f:any) => ({...f, precio:e.target.value}))}
                          style={{ ...input, marginBottom:0, border:"1px solid #93c5fd" }} />
                      </div>
                      <div>
                        <label style={{ ...label, color:"#1d4ed8" }}>Stock</label>
                        <input type="number" value={editForm.stock ?? ""} onChange={e => setEditForm((f:any) => ({...f, stock:Number(e.target.value)}))}
                          style={{ ...input, marginBottom:0, border:"1px solid #93c5fd" }} />
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={guardarEdicion} disabled={guardandoEdit}
                        style={{ background:"#1d4ed8", color:"#fff", border:"none", borderRadius:8, padding:"9px 20px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                        {guardandoEdit ? "Guardando..." : "✓ Guardar Cambios"}
                      </button>
                      <button onClick={() => { setEditandoId(null); setEditForm({}); }}
                        style={{ background:"#f1f5f9", color:"#555", border:"1px solid #ddd", borderRadius:8, padding:"9px 16px", fontSize:13, cursor:"pointer" }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ☕ CUADRE DE CAFETERÍA
// ══════════════════════════════════════════════════════════
function fmtCafe(n: number | string) {
  return "RD$ " + Number(n || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtFechaCafe(d: string) {
  return d ? new Date(d).toLocaleDateString("es-DO", { day: "numeric", month: "numeric", year: "2-digit", timeZone: "America/Santo_Domingo" }) : "—";
}

function imprimirCuadreCafe(c: any) {
  const saldoEsperado = Number(c.ventas_efectivo || 0);
  const diferencia    = c.efectivo_contado !== null && c.efectivo_contado !== undefined
    ? Number(c.efectivo_contado) - saldoEsperado : 0;

  const row = (lbl: string, val: string, color = "#111", bold = false) =>
    `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;">
       <span style="color:#555;">${lbl}</span>
       <span style="font-weight:${bold ? 800 : 500};color:${color};">${val}</span>
     </div>`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>Cuadre Cafetería — ${c.fecha}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;font-size:13px;padding:28px;max-width:560px;margin:auto;}
    h1{font-size:17px;font-weight:900;} h2{font-size:12px;font-weight:600;color:#555;}
    .sec-title{font-weight:700;font-size:11px;text-transform:uppercase;color:#d97706;letter-spacing:.5px;
      margin-bottom:6px;border-bottom:2px solid #fde68a;padding-bottom:3px;margin-top:14px;}
    .sig{display:inline-block;border-top:1px solid #333;width:180px;text-align:center;
      font-size:11px;color:#555;padding-top:4px;margin-top:30px;}
    .footer{text-align:center;font-size:11px;color:#aaa;margin-top:24px;border-top:1px dashed #ddd;padding-top:12px;}
    @media print{button{display:none!important;}}
  </style></head><body>
  <div style="text-align:center;margin-bottom:18px;">
    <h1>☕ SÓLIDO AUTO SERVICIO SRL</h1>
    <h2>CUADRE CAFETERÍA — ${c.fecha}</h2>
    <div style="font-size:11px;color:#888;margin-top:4px;">Responsable: <b>${c.usuario || "—"}</b> · Transacciones: <b>${c.transacciones_count || 0}</b></div>
  </div>

  <div class="sec-title">Ventas del día</div>
  ${row("Ventas en efectivo", fmtCafe(c.ventas_efectivo))}
  ${Number(c.ventas_tarjeta || 0) > 0 ? row("Ventas con tarjeta", fmtCafe(c.ventas_tarjeta)) : ""}
  ${Number(c.ventas_transferencia || 0) > 0 ? row("Ventas por transferencia", fmtCafe(c.ventas_transferencia)) : ""}
  <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #d97706;margin-top:4px;font-weight:800;font-size:15px;">
    <span>TOTAL VENTAS</span><span>${fmtCafe(c.ventas_total)}</span>
  </div>

  <div class="sec-title">Cuadre de efectivo</div>
  ${row("Efectivo esperado en caja", fmtCafe(c.ventas_efectivo))}
  ${c.efectivo_contado !== null && c.efectivo_contado !== undefined
    ? row("Efectivo contado físicamente", fmtCafe(c.efectivo_contado), "#111", true) +
      `<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid ${diferencia >= 0 ? "#10b981" : "#ef4444"};margin-top:4px;font-weight:900;font-size:15px;color:${diferencia >= 0 ? "#065f46" : "#991b1b"};">
         <span>DIFERENCIA</span><span>${diferencia >= 0 ? "+" : ""}${fmtCafe(diferencia)}</span>
       </div>`
    : `<div style="color:#aaa;font-size:12px;padding:6px 0;">Sin conteo físico registrado</div>`}

  ${c.notas ? `<div class="sec-title">Notas</div><p style="color:#555;font-size:13px;">${c.notas}</p>` : ""}

  <div style="display:flex;justify-content:space-around;margin-top:14px;">
    <div style="text-align:center;"><div class="sig"></div><div>Responsable</div><div style="font-size:11px;color:#888;">${c.usuario || ""}</div></div>
    <div style="text-align:center;"><div class="sig"></div><div>Supervisado por</div></div>
  </div>

  <div class="footer">SÓLIDO AUTO SERVICIO SRL · 809-712-2027 · Santo Domingo, R.D.<br/>
  Impreso: ${new Date().toLocaleString("es-DO",{day:"numeric",month:"numeric",year:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:"America/Santo_Domingo"})}</div>
  <script>setTimeout(()=>window.print(),400);<\/script>
  </body></html>`;

  const w = window.open("", "_blank", "width=660,height=680");
  if (w) { w.document.write(html); w.document.close(); }
}

function CafeteriaCuadre({ usuario }: { usuario: any }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [historial, setHistorial] = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [fetching, setFetching]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [preview, setPreview]     = useState<any>(null);
  const [fechaSel, setFechaSel]   = useState(hoy);
  const [efectContado, setEfectContado] = useState("");
  const [notas, setNotas]         = useState("");

  const cargarHistorial = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/cafeteria/cuadre`);
      const d = await r.json();
      setHistorial(Array.isArray(d) ? d : []);
    } catch { setHistorial([]); }
    setLoading(false);
  }, []);

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  const generarPreview = async (fecha: string) => {
    setFetching(true);
    setPreview(null);
    try {
      const r = await fetch(`${API}/cafeteria/cuadre/auto?fecha=${fecha}`);
      const d = await r.json();
      setPreview(d);
    } catch { alert("Error al calcular ventas del día"); }
    setFetching(false);
  };

  const guardar = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const diferencia = efectContado !== ""
        ? Number(efectContado) - Number(preview.ventas_efectivo)
        : 0;

      const res = await fetch(`${API}/cafeteria/cuadre`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha:                preview.fecha,
          usuario:              usuario?.nombre || "Sistema",
          ventas_efectivo:      preview.ventas_efectivo,
          ventas_tarjeta:       preview.ventas_tarjeta,
          ventas_transferencia: preview.ventas_transferencia,
          ventas_total:         preview.ventas_total,
          transacciones_count:  preview.transacciones_count,
          efectivo_contado:     efectContado !== "" ? Number(efectContado) : null,
          diferencia,
          notas:                notas || null,
        }),
      });
      const data = await res.json();
      if (data.error) return alert("Error: " + data.error);
      setPreview(null);
      setEfectContado("");
      setNotas("");
      await cargarHistorial();
    } catch { alert("Error al guardar el cuadre"); }
    setSaving(false);
  };

  const diferencia = preview && efectContado !== ""
    ? Number(efectContado) - Number(preview.ventas_efectivo) : null;

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Panel de generación */}
      <div style={{ ...card, border: "2px solid #d97706", marginBottom: 20 }}>
        <h3 style={{ ...cardTitle, color: "#92400e" }}>☕ Cuadre de Cafetería</h3>

        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={label}>Fecha del cuadre</label>
            <input type="date" value={fechaSel}
              onChange={e => { setFechaSel(e.target.value); setPreview(null); }}
              style={{ ...input, marginBottom: 0 }} />
          </div>
          <button onClick={() => generarPreview(fechaSel)} disabled={fetching}
            style={{ padding: "12px 22px", background: "#d97706", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14, minWidth: 180 }}>
            {fetching ? "⏳ Calculando..." : "⚡ Calcular ventas del día"}
          </button>
        </div>

        {preview && (
          <div style={{ marginTop: 18 }}>
            {/* Banner */}
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>
              ☕ <b>{preview.transacciones_count} transacción{preview.transacciones_count !== 1 ? "es" : ""}</b> registradas el {preview.fecha}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Ventas por método */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 12, color: "#374151", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8, borderBottom: "2px solid #fde68a", paddingBottom: 4 }}>
                  📥 Ventas por método
                </div>
                {[
                  ["💵 Efectivo", fmtCafe(preview.ventas_efectivo)],
                  ...(Number(preview.ventas_tarjeta || 0) > 0 ? [["💳 Tarjeta", fmtCafe(preview.ventas_tarjeta)]] : []),
                  ...(Number(preview.ventas_transferencia || 0) > 0 ? [["🏦 Transferencia", fmtCafe(preview.ventas_transferencia)]] : []),
                ].map(([lbl, val]) => (
                  <div key={lbl} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f0f0f0", fontSize: 13 }}>
                    <span style={{ color: "#555" }}>{lbl}</span><span style={{ fontWeight: 600 }}>{val}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "2px solid #d97706", marginTop: 4, fontWeight: 800, fontSize: 14 }}>
                  <span>TOTAL</span><span>{fmtCafe(preview.ventas_total)}</span>
                </div>
              </div>

              {/* Cuadre efectivo */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 12, color: "#374151", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8, borderBottom: "2px solid #fde68a", paddingBottom: 4 }}>
                  ⚖️ Cuadre de efectivo
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f0f0f0", fontSize: 13 }}>
                  <span style={{ color: "#555" }}>Efectivo esperado</span>
                  <span style={{ fontWeight: 700, color: "#10b981" }}>{fmtCafe(preview.ventas_efectivo)}</span>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label style={{ ...label, fontSize: 12 }}>💰 Efectivo contado físicamente (opcional)</label>
                  <input type="number" value={efectContado} onChange={e => setEfectContado(e.target.value)}
                    placeholder="Deja vacío si no contaste"
                    style={{ ...input, marginBottom: 0, fontSize: 14 }} />
                </div>
                {diferencia !== null && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `2px solid ${diferencia >= 0 ? "#10b981" : "#ef4444"}`, marginTop: 8, fontWeight: 800, fontSize: 14, color: diferencia >= 0 ? "#065f46" : "#991b1b" }}>
                    <span>DIFERENCIA</span>
                    <span>{diferencia >= 0 ? "+" : ""}{fmtCafe(diferencia)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notas */}
            <div style={{ marginTop: 12 }}>
              <label style={{ ...label, fontSize: 12 }}>📝 Notas (opcional)</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)}
                placeholder="Observaciones, incidencias..."
                style={{ ...input, height: 54, resize: "vertical" as any, marginBottom: 0, fontSize: 13 }} />
            </div>

            {/* Botones */}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={guardar} disabled={saving}
                style={{ flex: 2, padding: "12px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
                {saving ? "Guardando..." : "💾 Guardar cuadre"}
              </button>
              <button onClick={() => { setPreview(null); setEfectContado(""); setNotas(""); }}
                style={{ flex: 1, padding: "12px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
                ✕ Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Historial */}
      <div style={card}>
        <h3 style={cardTitle}>📋 Historial de Cuadres Cafetería</h3>
        {loading ? (
          <p style={{ color: "#888", textAlign: "center", padding: 20 }}>Cargando...</p>
        ) : historial.length === 0 ? (
          <p style={{ color: "#888", textAlign: "center", padding: 20 }}>Sin cuadres guardados aún.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Fecha", "Responsable", "Trans.", "Efectivo", "Tarjeta+Transf.", "Total", "Ef. Contado", "Diferencia", ""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 12px", background: "#fef9c3", fontSize: 12, fontWeight: 700, borderBottom: "2px solid #fde68a" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historial.map((c: any) => {
                  const otros = Number(c.ventas_tarjeta || 0) + Number(c.ventas_transferencia || 0);
                  return (
                    <tr key={c.id}>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 13, fontWeight: 700 }}>{fmtFechaCafe(c.fecha)}</td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 13 }}>{c.usuario}</td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 13, textAlign: "center" }}>{c.transacciones_count ?? "—"}</td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 13 }}>{fmtCafe(c.ventas_efectivo)}</td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 13 }}>{fmtCafe(otros)}</td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 13, fontWeight: 700 }}>{fmtCafe(c.ventas_total)}</td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 13 }}>
                        {c.efectivo_contado !== null && c.efectivo_contado !== undefined ? fmtCafe(c.efectivo_contado) : <span style={{ color: "#aaa" }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 13, fontWeight: 700, color: Number(c.diferencia) === 0 ? "#6b7280" : Number(c.diferencia) > 0 ? "#10b981" : "#ef4444" }}>
                        {c.efectivo_contado !== null && c.efectivo_contado !== undefined
                          ? (Number(c.diferencia) >= 0 ? "+" : "") + fmtCafe(c.diferencia)
                          : <span style={{ color: "#aaa", fontSize: 11 }}>sin conteo</span>}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0" }}>
                        <button onClick={() => imprimirCuadreCafe(c)}
                          style={{ padding: "5px 10px", background: "#fef9c3", color: "#92400e", border: "1px solid #fde68a", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>
                          🖨️ Imprimir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const container = { padding: "20px", background: "#f5f7fb", minHeight: "100vh" };
const title = { fontSize: "26px", fontWeight: "bold", marginBottom: "20px" };
const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" };
const card = { background: "#fff", padding: "20px", borderRadius: "15px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: 16 };
const cardTitle = { marginBottom: "14px", fontSize: "18px", fontWeight: "600" };
const tabBtn = { padding: "10px 20px", borderRadius: "8px", border: "1px solid #ddd", cursor: "pointer", fontWeight: 600 };


const label = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#555" };


const input = { display: "block", marginBottom: "12px", padding: "12px", width: "100%", borderRadius: "8px", border: "1px solid #ddd", boxSizing: "border-box" as "border-box", fontSize: 14 };



const productoRow = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f0f0f0" };
const carritoRow = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f0f0f0" };
const totalesBox = { marginTop: 14, padding: 14, background: "#f8fafc", borderRadius: 10 };
const vueltoBx = { marginTop: 12, padding: 14, background: "#fefce8", borderRadius: 10, border: "1px solid #fde68a" };
const btnAdd = { padding: "6px 14px", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: 13 };
const btnQty = { padding: "2px 10px", background: "#f1f5f9", border: "1px solid #ddd", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" };
const btnPrimary = { padding: "12px", background: "#111827", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", width: "100%", fontWeight: 700 };
const btnDespachar = { padding: "14px", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", width: "100%", marginTop: "16px", fontSize: 16, fontWeight: 700 };
const btnReimprimir = { padding: "10px", background: "#f1f5f9", color: "#111", border: "1px solid #ddd", borderRadius: "8px", cursor: "pointer", width: "100%", marginTop: 10, fontSize: 13 };