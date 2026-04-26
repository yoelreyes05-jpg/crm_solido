"use client";
import { useEffect, useState, useRef } from "react";

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
        {["vender", "productos"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...tabBtn, background: tab === t ? "#111827" : "#fff", color: tab === t ? "#fff" : "#111" }}>
            {t === "vender" ? "🛒 Vender" : "➕ Gestionar Productos"}
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