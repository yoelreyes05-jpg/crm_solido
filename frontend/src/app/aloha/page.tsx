"use client";
import React, { useEffect, useState, useRef } from "react";

import { API_URL as API } from "@/config";
import { usePermisos } from "@/lib/usePermisos";
import ModuloContable from "@/components/ModuloContable";

// ─────────────────────────────────────────────────────────────────────────────
// 🌺 ALOHA PERFUME STORE — Módulo totalmente independiente
// Tema: rosa claro + blanco · Tablas propias aloha_* en Supabase
// ─────────────────────────────────────────────────────────────────────────────

const TIENDA = {
  nombre: "ALOHA PERFUME STORE",
  telefono: "829-393-3673",
  instagram: "@alohaperfumes_store",
  direccion: "Calle Constanza #71, Los Cerros de Sabana Perdida",
  emoji: "🌺",
};

// ── Paleta rosa/blanco ────────────────────────────────────────────────────────
const C = {
  bg:        "#fdf2f8",   // rosa muy claro (fondo)
  card:      "#ffffff",
  border:    "#fbcfe8",   // rosa-200
  primary:   "#ec4899",   // rosa-500
  primaryD:  "#db2777",   // rosa-600
  primarySoft: "#fce7f3", // rosa-100
  text:      "#831843",   // rosa-900
  sub:       "#9d5c7d",
  green:     "#10b981",
  red:       "#ef4444",
  amber:     "#f59e0b",
};

const fmt = (n: any) =>
  "RD$ " + Number(n || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORIAS = ["Perfume", "Body Splash", "Crema", "Set / Regalo", "Accesorio", "Otro"];

// ── Comprimir imagen a base64 (máx 500px, JPEG 80%) ─────────────────────────
function comprimirImagen(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 500;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const r = Math.min(MAX / width, MAX / height);
          width = Math.round(width * r);
          height = Math.round(height * r);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas no disponible"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = String(e.target?.result || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Factura imprimible (rosa) ────────────────────────────────────────────────
function generarHTMLAloha(venta: any, items: any[]) {
  const fecha = new Date(venta.created_at || Date.now()).toLocaleString("es-DO", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const lineas = items.map((i: any) => `
    <tr>
      <td style="padding:8px 6px;border-bottom:1px solid #fce7f3;">${i.nombre}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #fce7f3;text-align:center;">${i.qty}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #fce7f3;text-align:right;">${fmt(i.precio)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #fce7f3;text-align:right;font-weight:700;">${fmt(i.precio * i.qty)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>${TIENDA.nombre} — ${venta.numero || "Factura"}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;font-size:13px;color:#500724;padding:24px;max-width:400px;margin:auto;background:#fff;}
    .header{text-align:center;border-bottom:3px solid #ec4899;padding-bottom:14px;margin-bottom:16px;}
    .logo{font-size:34px;}
    .nombre{font-size:18px;font-weight:900;letter-spacing:2px;color:#db2777;margin-top:4px;}
    .sub{font-size:11px;color:#9d5c7d;margin-top:4px;line-height:1.6;}
    .num-box{background:#ec4899;color:#fff;text-align:center;padding:8px;border-radius:6px;margin:12px 0;}
    .num{font-size:15px;font-weight:900;letter-spacing:2px;}
    table{width:100%;border-collapse:collapse;margin-bottom:12px;}
    thead th{background:#ec4899;color:#fff;padding:8px 6px;font-size:11px;text-align:left;}
    .totales{border-top:2px solid #ec4899;padding-top:8px;margin-top:4px;}
    .t-row{display:flex;justify-content:space-between;padding:3px 0;font-size:13px;}
    .t-total{font-size:18px;font-weight:900;color:#db2777;}
    .footer{text-align:center;margin-top:20px;font-size:11px;color:#9d5c7d;border-top:1px dashed #fbcfe8;padding-top:12px;line-height:1.8;}
    @media print{body{padding:8px;}}
  </style></head><body>
  <div class="header">
    <div class="logo">${TIENDA.emoji}</div>
    <div class="nombre">${TIENDA.nombre}</div>
    <div class="sub">Tel: ${TIENDA.telefono}<br/>${TIENDA.instagram}<br/>${TIENDA.direccion}</div>
  </div>
  <div style="font-size:12px;margin-bottom:10px;">
    <b>Factura:</b> ${venta.numero || "—"}<br/>
    <b>Fecha:</b> ${fecha}<br/>
    <b>Cliente:</b> ${venta.cliente_nombre || "Cliente genérico"}<br/>
    <b>Método:</b> ${venta.metodo_pago || "EFECTIVO"}
  </div>
  ${venta.numero ? `<div class="num-box"><div style="font-size:9px;opacity:0.8;margin-bottom:2px;">FACTURA</div><div class="num">${venta.numero}</div></div>` : ""}
  <table>
    <thead><tr>
      <th>Descripción</th><th style="text-align:center;">Cant.</th>
      <th style="text-align:right;">Precio</th><th style="text-align:right;">Total</th>
    </tr></thead>
    <tbody>${lineas}</tbody>
  </table>
  <div class="totales">
    <div class="t-row"><span>Subtotal:</span><span>${fmt(venta.subtotal)}</span></div>
    ${Number(venta.itbis) > 0 ? `<div class="t-row"><span>ITBIS (18%):</span><span>${fmt(venta.itbis)}</span></div>` : ""}
    <div class="t-row t-total"><span>TOTAL:</span><span>${fmt(venta.total)}</span></div>
  </div>
  <div class="footer">
    ¡Gracias por su compra! ${TIENDA.emoji}<br/>
    <b>${TIENDA.nombre}</b> · ${TIENDA.telefono}<br/>
    ${TIENDA.instagram} · ${TIENDA.direccion}
  </div>
  <script>window.onload=function(){window.print();}</script>
  </body></html>`;
}

function imprimirHTML(html: string) {
  const prev = document.getElementById("__aloha_iframe__");
  if (prev) prev.remove();
  const iframe = document.createElement("iframe");
  iframe.id = "__aloha_iframe__";
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:820px;height:1000px;border:none;opacity:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || (iframe.contentWindow as any)?.document;
  if (!doc) { const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); } return; }
  doc.open(); doc.write(html); doc.close();
  iframe.onload = () => {
    try { (iframe.contentWindow as any)?.focus(); (iframe.contentWindow as any)?.print(); }
    catch { const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); } }
  };
}

// ── Estilos compartidos ──────────────────────────────────────────────────────
const S = {
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16 } as React.CSSProperties,
  input: { display: "block", padding: "10px 12px", width: "100%", borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 14, background: "#fff", color: C.text, boxSizing: "border-box" } as React.CSSProperties,
  label: { fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 4, display: "block" } as React.CSSProperties,
  btn: { padding: "10px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: C.primary, color: "#fff" } as React.CSSProperties,
  btnGhost: { padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.border}`, cursor: "pointer", fontWeight: 700, fontSize: 12, background: "#fff", color: C.text } as React.CSSProperties,
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: C.sub, background: C.primarySoft, textTransform: "uppercase" as const, letterSpacing: 0.4 },
  td: { padding: "10px 12px", fontSize: 13, color: C.text, borderBottom: `1px solid ${C.primarySoft}` },
};

export default function AlohaPage() {
  const { usuario, listo, puedeVer, puedeCrear, puedeEditar, puedeEliminar } = usePermisos("aloha");
  const [tab, setTab] = useState<"vender" | "clientes" | "inventario" | "historial" | "contabilidad">("vender");

  if (listo && !puedeVer) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: C.text }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <h2>Sin acceso al módulo Aloha</h2>
        <p style={{ color: C.sub }}>Pide al gerente que te asigne permisos desde /permisos.</p>
      </div>
    );
  }

  const TABS = [
    { k: "vender",       label: "🛍️ Vender" },
    { k: "clientes",     label: "👤 Clientes" },
    { k: "inventario",   label: "📦 Inventario" },
    { k: "historial",    label: "🧾 Historial" },
    { k: "contabilidad", label: "💰 Contabilidad" },
  ] as const;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ fontSize: 36 }}>{TIENDA.emoji}</div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: C.primaryD, letterSpacing: 1, margin: 0 }}>
            {TIENDA.nombre}
          </h1>
          <div style={{ fontSize: 13, color: C.sub }}>Tel: {TIENDA.telefono} · {TIENDA.instagram}</div>
          <div style={{ fontSize: 12, color: C.sub }}>📍 {TIENDA.direccion}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)} style={{
            padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13,
            background: tab === t.k ? C.primary : "#fff",
            color: tab === t.k ? "#fff" : C.sub,
            boxShadow: tab === t.k ? "0 2px 8px rgba(236,72,153,0.35)" : "none",
            border: tab === t.k ? "1px solid transparent" : `1px solid ${C.border}`,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === "vender"       && <Vender usuario={usuario} puedeCrear={puedeCrear} />}
      {tab === "clientes"     && <Clientes puedeCrear={puedeCrear} puedeEditar={puedeEditar} puedeEliminar={puedeEliminar} />}
      {tab === "inventario"   && <Inventario puedeCrear={puedeCrear} puedeEditar={puedeEditar} puedeEliminar={puedeEliminar} />}
      {tab === "historial"    && <Historial />}
      {tab === "contabilidad" && (
        <ModuloContable
          apiBase="/aloha/contabilidad"
          theme="light"
          titulo="Contabilidad — ALOHA"
          usuario={usuario?.nombre || "Sistema"}
          nombreEntidad="Cliente"
          nombreSuplidor="Suplidor"
        />
      )}
    </div>
  );
}

// ════════════════════════════ VENDER (POS) ════════════════════════════
function Vender({ usuario, puedeCrear }: any) {
  const [productos, setProductos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [carrito, setCarrito] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [clienteId, setClienteId] = useState<string>("");
  const [metodoPago, setMetodoPago] = useState("EFECTIVO");
  const [aplicaItbis, setAplicaItbis] = useState(false);
  const [mixto, setMixto] = useState({ efectivo: "", tarjeta: "", transferencia: "" });
  const [montoRecibido, setMontoRecibido] = useState("");
  const [loading, setLoading] = useState(false);
  const [ultimaVenta, setUltimaVenta] = useState<any>(null);

  const cargar = async () => {
    try {
      const [p, c] = await Promise.all([
        fetch(`${API}/aloha/productos`).then(r => r.json()),
        fetch(`${API}/aloha/clientes`).then(r => r.json()),
      ]);
      setProductos(Array.isArray(p) ? p : []);
      setClientes(Array.isArray(c) ? c : []);
    } catch { /* silencioso */ }
  };
  useEffect(() => { cargar(); }, []);

  const agregar = (prod: any) => {
    const enCarrito = carrito.find(i => i.id === prod.id);
    const qtyActual = enCarrito ? enCarrito.qty : 0;
    if (qtyActual + 1 > Number(prod.stock)) { alert(`Stock insuficiente de "${prod.nombre}"`); return; }
    if (enCarrito) setCarrito(carrito.map(i => i.id === prod.id ? { ...i, qty: i.qty + 1 } : i));
    else setCarrito([...carrito, { id: prod.id, nombre: prod.nombre, precio: Number(prod.precio), qty: 1 }]);
  };
  const quitar = (id: any) => setCarrito(carrito.filter(i => i.id !== id));
  const cambiarQty = (id: any, qty: number) => {
    if (qty <= 0) return quitar(id);
    const prod = productos.find(p => p.id === id);
    if (prod && qty > Number(prod.stock)) { alert("Stock insuficiente"); return; }
    setCarrito(carrito.map(i => i.id === id ? { ...i, qty } : i));
  };

  const subtotal = carrito.reduce((a, i) => a + i.precio * i.qty, 0);
  const itbis = aplicaItbis ? +(subtotal * 0.18).toFixed(2) : 0;
  const total = +(subtotal + itbis).toFixed(2);
  const devuelta = metodoPago === "EFECTIVO" && montoRecibido ? Number(montoRecibido) - total : 0;
  const sumaMixto = Number(mixto.efectivo || 0) + Number(mixto.tarjeta || 0) + Number(mixto.transferencia || 0);

  const cobrar = async () => {
    if (carrito.length === 0) return alert("El carrito está vacío");
    if (metodoPago === "MIXTO" && Math.abs(sumaMixto - total) > 0.01)
      return alert(`El desglose mixto (${fmt(sumaMixto)}) no cuadra con el total (${fmt(total)})`);
    setLoading(true);
    try {
      const cli = clientes.find((c: any) => String(c.id) === clienteId);
      const res = await fetch(`${API}/aloha/venta`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: carrito, metodo_pago: metodoPago, aplica_itbis: aplicaItbis,
          cliente_id: cli?.id || null, cliente_nombre: cli?.nombre || "Cliente genérico",
          monto_efectivo: mixto.efectivo, monto_tarjeta: mixto.tarjeta, monto_transferencia: mixto.transferencia,
          usuario: usuario?.nombre || "Sistema",
        }),
      });
      const data = await res.json();
      if (data.error) { alert("Error: " + data.error); return; }
      setUltimaVenta({ venta: data, items: carrito });
      imprimirHTML(generarHTMLAloha(data, carrito));
      setCarrito([]); setMontoRecibido(""); setMixto({ efectivo: "", tarjeta: "", transferencia: "" });
      setAplicaItbis(false); setClienteId("");
      cargar();
    } catch { alert("Error de conexión"); }
    finally { setLoading(false); }
  };

  const visibles = productos.filter(p =>
    !busqueda || `${p.nombre} ${p.marca || ""} ${p.categoria || ""}`.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, alignItems: "start" }}>
      {/* Catálogo */}
      <div style={S.card}>
        <input placeholder="🔍 Buscar perfume, marca o categoría…" value={busqueda}
          onChange={e => setBusqueda(e.target.value)} style={{ ...S.input, marginBottom: 14 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
          {visibles.map(p => (
            <div key={p.id} onClick={() => Number(p.stock) > 0 && agregar(p)} style={{
              border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", cursor: Number(p.stock) > 0 ? "pointer" : "not-allowed",
              opacity: Number(p.stock) > 0 ? 1 : 0.45, background: "#fff", transition: "box-shadow .15s",
            }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 14px rgba(236,72,153,0.25)")}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
              <div style={{ height: 110, background: C.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {p.imagen
                  ? <img src={p.imagen} alt={p.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 38 }}>🌸</span>}
              </div>
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.25 }}>{p.nombre}</div>
                {p.marca && <div style={{ fontSize: 11, color: C.sub }}>{p.marca}</div>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 5 }}>
                  <span style={{ fontWeight: 800, color: C.primaryD, fontSize: 13 }}>{fmt(p.precio)}</span>
                  <span style={{ fontSize: 11, color: Number(p.stock) <= 3 ? C.red : C.sub }}>Stock: {p.stock}</span>
                </div>
              </div>
            </div>
          ))}
          {visibles.length === 0 && <div style={{ color: C.sub, padding: 20 }}>Sin productos. Agrégalos en Inventario.</div>}
        </div>
      </div>

      {/* Carrito */}
      <div style={{ ...S.card, position: "sticky" as any, top: 12 }}>
        <h3 style={{ color: C.primaryD, fontWeight: 800, marginBottom: 12 }}>🛒 Factura</h3>

        <label style={S.label}>Cliente</label>
        <select value={clienteId} onChange={e => setClienteId(e.target.value)} style={{ ...S.input, marginBottom: 10 }}>
          <option value="">Cliente genérico</option>
          {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}{c.telefono ? ` — ${c.telefono}` : ""}</option>)}
        </select>

        {carrito.length === 0 && <div style={{ color: C.sub, fontSize: 13, padding: "14px 0" }}>Toca un producto para agregarlo.</div>}
        {carrito.map(i => (
          <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 0", borderBottom: `1px solid ${C.primarySoft}` }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{i.nombre}</div>
              <div style={{ fontSize: 11, color: C.sub }}>{fmt(i.precio)} c/u</div>
            </div>
            <button onClick={() => cambiarQty(i.id, i.qty - 1)} style={S.btnGhost}>−</button>
            <span style={{ minWidth: 22, textAlign: "center", fontWeight: 800, color: C.text }}>{i.qty}</span>
            <button onClick={() => cambiarQty(i.id, i.qty + 1)} style={S.btnGhost}>+</button>
            <button onClick={() => quitar(i.id)} style={{ ...S.btnGhost, color: C.red }}>✕</button>
          </div>
        ))}

        {/* ITBIS checkbox */}
        <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0", cursor: "pointer", fontSize: 13, fontWeight: 700, color: C.text }}>
          <input type="checkbox" checked={aplicaItbis} onChange={e => setAplicaItbis(e.target.checked)}
            style={{ width: 17, height: 17, accentColor: C.primary }} />
          Aplicar ITBIS (18%)
        </label>

        <div style={{ fontSize: 13, color: C.sub, display: "flex", justifyContent: "space-between" }}>
          <span>Subtotal</span><span>{fmt(subtotal)}</span>
        </div>
        {aplicaItbis && (
          <div style={{ fontSize: 13, color: C.sub, display: "flex", justifyContent: "space-between" }}>
            <span>ITBIS 18%</span><span>{fmt(itbis)}</span>
          </div>
        )}
        <div style={{ fontSize: 20, fontWeight: 900, color: C.primaryD, display: "flex", justifyContent: "space-between", margin: "6px 0 12px" }}>
          <span>TOTAL</span><span>{fmt(total)}</span>
        </div>

        <label style={S.label}>Método de pago</label>
        <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} style={{ ...S.input, marginBottom: 10 }}>
          <option value="EFECTIVO">💵 Efectivo</option>
          <option value="TARJETA">💳 Tarjeta</option>
          <option value="TRANSFERENCIA">🏦 Transferencia</option>
          <option value="MIXTO">🔀 Mixto</option>
        </select>

        {metodoPago === "EFECTIVO" && (
          <>
            <label style={S.label}>Monto recibido</label>
            <input type="number" value={montoRecibido} onChange={e => setMontoRecibido(e.target.value)}
              placeholder="0.00" style={{ ...S.input, marginBottom: 6 }} />
            {montoRecibido && (
              <div style={{ fontSize: 14, fontWeight: 800, color: devuelta >= 0 ? C.green : C.red, marginBottom: 8 }}>
                Devuelta: {fmt(devuelta)}
              </div>
            )}
          </>
        )}

        {metodoPago === "MIXTO" && (
          <div style={{ marginBottom: 8 }}>
            {(["efectivo", "tarjeta", "transferencia"] as const).map(k => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: C.sub, width: 96, textTransform: "capitalize" }}>{k}</span>
                <input type="number" value={(mixto as any)[k]} placeholder="0.00"
                  onChange={e => setMixto({ ...mixto, [k]: e.target.value })} style={{ ...S.input, marginBottom: 0 }} />
              </div>
            ))}
            <div style={{ fontSize: 12, fontWeight: 700, color: Math.abs(sumaMixto - total) < 0.01 ? C.green : C.red }}>
              Desglose: {fmt(sumaMixto)} / {fmt(total)}
            </div>
          </div>
        )}

        <button onClick={cobrar} disabled={loading || carrito.length === 0 || !puedeCrear}
          style={{ ...S.btn, width: "100%", padding: 14, fontSize: 15, opacity: loading || carrito.length === 0 || !puedeCrear ? 0.55 : 1 }}>
          {loading ? "Procesando…" : `💖 Cobrar ${fmt(total)}`}
        </button>
        {!puedeCrear && <div style={{ fontSize: 11, color: C.red, marginTop: 6 }}>No tienes permiso para facturar.</div>}

        {ultimaVenta && (
          <button onClick={() => imprimirHTML(generarHTMLAloha(ultimaVenta.venta, ultimaVenta.items))}
            style={{ ...S.btnGhost, width: "100%", marginTop: 8 }}>
            🖨️ Reimprimir última factura ({ultimaVenta.venta.numero})
          </button>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════ CLIENTES ════════════════════════════
function Clientes({ puedeCrear, puedeEditar, puedeEliminar }: any) {
  const vacio = { nombre: "", telefono: "", email: "", direccion: "", notas: "" };
  const [clientes, setClientes] = useState<any[]>([]);
  const [form, setForm] = useState<any>(vacio);
  const [editId, setEditId] = useState<any>(null);
  const [busqueda, setBusqueda] = useState("");
  const [histCliente, setHistCliente] = useState<any>(null);
  const [histVentas, setHistVentas] = useState<any[]>([]);

  const cargar = async () => {
    try {
      const d = await fetch(`${API}/aloha/clientes`).then(r => r.json());
      setClientes(Array.isArray(d) ? d : []);
    } catch { /* */ }
  };
  useEffect(() => { cargar(); }, []);

  const guardar = async () => {
    if (!form.nombre.trim()) return alert("El nombre es requerido");
    const url = editId ? `${API}/aloha/clientes/${editId}` : `${API}/aloha/clientes`;
    const r = await fetch(url, {
      method: editId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const d = await r.json();
    if (d.error) return alert("Error: " + d.error);
    setForm(vacio); setEditId(null); cargar();
  };

  const eliminar = async (c: any) => {
    if (!confirm(`¿Eliminar al cliente "${c.nombre}"?`)) return;
    await fetch(`${API}/aloha/clientes/${c.id}`, { method: "DELETE" });
    cargar();
  };

  const verHistorial = async (c: any) => {
    setHistCliente(c);
    try {
      const d = await fetch(`${API}/aloha/clientes/${c.id}/historial`).then(r => r.json());
      setHistVentas(Array.isArray(d) ? d : []);
    } catch { setHistVentas([]); }
  };

  const visibles = clientes.filter(c =>
    !busqueda || `${c.nombre} ${c.telefono || ""}`.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, alignItems: "start" }}>
      <div style={S.card}>
        <input placeholder="🔍 Buscar cliente…" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ ...S.input, marginBottom: 12 }} />
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={S.th}>Nombre</th><th style={S.th}>Teléfono</th><th style={S.th}>Email</th><th style={S.th}></th>
          </tr></thead>
          <tbody>
            {visibles.map(c => (
              <tr key={c.id}>
                <td style={S.td}><b>{c.nombre}</b></td>
                <td style={S.td}>{c.telefono || "—"}</td>
                <td style={S.td}>{c.email || "—"}</td>
                <td style={{ ...S.td, whiteSpace: "nowrap" }}>
                  <button onClick={() => verHistorial(c)} style={S.btnGhost}>🧾</button>{" "}
                  {puedeEditar && <button onClick={() => { setEditId(c.id); setForm({ nombre: c.nombre, telefono: c.telefono || "", email: c.email || "", direccion: c.direccion || "", notas: c.notas || "" }); }} style={S.btnGhost}>✏️</button>}{" "}
                  {puedeEliminar && <button onClick={() => eliminar(c)} style={{ ...S.btnGhost, color: C.red }}>🗑️</button>}
                </td>
              </tr>
            ))}
            {visibles.length === 0 && <tr><td style={S.td} colSpan={4}>Sin clientes registrados.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={S.card}>
        <h3 style={{ color: C.primaryD, fontWeight: 800, marginBottom: 12 }}>
          {editId ? "✏️ Editar cliente" : "➕ Nuevo cliente"}
        </h3>
        <label style={S.label}>Nombre *</label>
        <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={{ ...S.input, marginBottom: 8 }} />
        <label style={S.label}>Teléfono</label>
        <input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} style={{ ...S.input, marginBottom: 8 }} />
        <label style={S.label}>Email</label>
        <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={{ ...S.input, marginBottom: 8 }} />
        <label style={S.label}>Dirección</label>
        <input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} style={{ ...S.input, marginBottom: 8 }} />
        <label style={S.label}>Notas</label>
        <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2} style={{ ...S.input, marginBottom: 10 }} />
        <button onClick={guardar} disabled={!puedeCrear && !editId} style={{ ...S.btn, width: "100%", opacity: (!puedeCrear && !editId) ? 0.55 : 1 }}>
          {editId ? "Guardar cambios" : "Crear cliente"}
        </button>
        {editId && <button onClick={() => { setEditId(null); setForm(vacio); }} style={{ ...S.btnGhost, width: "100%", marginTop: 8 }}>Cancelar</button>}
      </div>

      {/* Modal historial del cliente */}
      {histCliente && (
        <div onClick={() => setHistCliente(null)} style={{
          position: "fixed", inset: 0, background: "rgba(131,24,67,0.35)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 60,
        }}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.card, width: 560, maxHeight: "80vh", overflowY: "auto", margin: 0 }}>
            <h3 style={{ color: C.primaryD, fontWeight: 800 }}>🧾 Facturas de {histCliente.nombre}</h3>
            {histVentas.length === 0 && <p style={{ color: C.sub, fontSize: 13 }}>Este cliente no tiene facturas.</p>}
            {histVentas.map(v => (
              <div key={v.id} style={{ borderBottom: `1px solid ${C.primarySoft}`, padding: "10px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: C.text, fontSize: 13 }}>
                  <span>{v.numero || `#${v.id}`}</span>
                  <span>{fmt(v.total)}</span>
                </div>
                <div style={{ fontSize: 12, color: C.sub }}>
                  {new Date(v.created_at).toLocaleString("es-DO")} · {v.metodo_pago}
                  {(v.aloha_detalle || []).map((d: any) => ` · ${d.cantidad}x ${d.aloha_productos?.nombre || "?"}`).join("")}
                </div>
              </div>
            ))}
            <button onClick={() => setHistCliente(null)} style={{ ...S.btnGhost, marginTop: 12 }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════ INVENTARIO ════════════════════════════
function Inventario({ puedeCrear, puedeEditar, puedeEliminar }: any) {
  const vacio = { nombre: "", marca: "", categoria: "Perfume", descripcion: "", precio: "", costo: "", stock: "" };
  const [productos, setProductos] = useState<any[]>([]);
  const [form, setForm] = useState<any>(vacio);
  const [imagen, setImagen] = useState<string>("");
  const [editId, setEditId] = useState<any>(null);
  const [busqueda, setBusqueda] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileEditRef = useRef<HTMLInputElement>(null);
  const [imgTargetId, setImgTargetId] = useState<any>(null);

  const cargar = async () => {
    try {
      const d = await fetch(`${API}/aloha/productos`).then(r => r.json());
      setProductos(Array.isArray(d) ? d : []);
    } catch { /* */ }
  };
  useEffect(() => { cargar(); }, []);

  const onImagen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { setImagen(await comprimirImagen(f)); } catch { alert("No se pudo procesar la imagen"); }
    e.target.value = "";
  };

  // Cambiar imagen de un producto existente (directo desde la tabla)
  const onImagenExistente = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !imgTargetId) return;
    setSubiendo(true);
    try {
      const b64 = await comprimirImagen(f);
      const r = await fetch(`${API}/aloha/productos/${imgTargetId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagen: b64 }),
      });
      const d = await r.json();
      if (d.error) alert("Error: " + d.error); else cargar();
    } catch { alert("No se pudo subir la imagen"); }
    finally { setSubiendo(false); setImgTargetId(null); e.target.value = ""; }
  };

  const guardar = async () => {
    if (!form.nombre.trim() || form.precio === "") return alert("Nombre y precio son requeridos");
    const payload: any = { ...form, precio: Number(form.precio), costo: Number(form.costo || 0), stock: Number(form.stock || 0) };
    if (!editId) payload.imagen = imagen || null;
    const url = editId ? `${API}/aloha/productos/${editId}` : `${API}/aloha/productos`;
    const r = await fetch(url, {
      method: editId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (d.error) return alert("Error: " + d.error);
    // Si estamos editando y se eligió una imagen nueva, mandarla por PATCH
    if (editId && imagen) {
      await fetch(`${API}/aloha/productos/${editId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagen }),
      });
    }
    setForm(vacio); setImagen(""); setEditId(null); cargar();
  };

  const eliminar = async (p: any) => {
    if (!confirm(`¿Eliminar "${p.nombre}" del inventario?`)) return;
    const r = await fetch(`${API}/aloha/productos/${p.id}`, { method: "DELETE" });
    const d = await r.json();
    if (d.error) alert("Error: " + d.error); else cargar();
  };

  const visibles = productos.filter(p =>
    !busqueda || `${p.nombre} ${p.marca || ""} ${p.categoria || ""}`.toLowerCase().includes(busqueda.toLowerCase()));

  const valorInventario = productos.reduce((a, p) => a + Number(p.costo || 0) * Number(p.stock || 0), 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, alignItems: "start" }}>
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
          <input placeholder="🔍 Buscar producto…" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ ...S.input, marginBottom: 0, maxWidth: 300 }} />
          <div style={{ fontSize: 13, color: C.sub }}>
            {productos.length} artículos · Valor (costo): <b style={{ color: C.primaryD }}>{fmt(valorInventario)}</b>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={S.th}>Imagen</th><th style={S.th}>Producto</th><th style={S.th}>Categoría</th>
            <th style={S.th}>Precio</th><th style={S.th}>Costo</th><th style={S.th}>Stock</th><th style={S.th}></th>
          </tr></thead>
          <tbody>
            {visibles.map(p => (
              <tr key={p.id}>
                <td style={S.td}>
                  <div onClick={() => { if (puedeEditar) { setImgTargetId(p.id); fileEditRef.current?.click(); } }}
                    title={puedeEditar ? "Clic para cambiar imagen" : ""}
                    style={{ width: 46, height: 46, borderRadius: 8, background: C.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: puedeEditar ? "pointer" : "default" }}>
                    {p.imagen ? <img src={p.imagen} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🌸"}
                  </div>
                </td>
                <td style={S.td}><b>{p.nombre}</b>{p.marca && <div style={{ fontSize: 11, color: C.sub }}>{p.marca}</div>}</td>
                <td style={S.td}>{p.categoria || "—"}</td>
                <td style={S.td}>{fmt(p.precio)}</td>
                <td style={S.td}>{fmt(p.costo)}</td>
                <td style={{ ...S.td, fontWeight: 800, color: Number(p.stock) <= 3 ? C.red : C.text }}>{p.stock}</td>
                <td style={{ ...S.td, whiteSpace: "nowrap" }}>
                  {puedeEditar && <button onClick={() => { setEditId(p.id); setImagen(""); setForm({ nombre: p.nombre, marca: p.marca || "", categoria: p.categoria || "Perfume", descripcion: p.descripcion || "", precio: String(p.precio), costo: String(p.costo || ""), stock: String(p.stock) }); }} style={S.btnGhost}>✏️</button>}{" "}
                  {puedeEliminar && <button onClick={() => eliminar(p)} style={{ ...S.btnGhost, color: C.red }}>🗑️</button>}
                </td>
              </tr>
            ))}
            {visibles.length === 0 && <tr><td style={S.td} colSpan={7}>Sin productos.</td></tr>}
          </tbody>
        </table>
        <input ref={fileEditRef} type="file" accept="image/*" onChange={onImagenExistente} style={{ display: "none" }} />
        {subiendo && <div style={{ fontSize: 12, color: C.sub, marginTop: 8 }}>Subiendo imagen…</div>}
      </div>

      <div style={S.card}>
        <h3 style={{ color: C.primaryD, fontWeight: 800, marginBottom: 12 }}>
          {editId ? "✏️ Editar producto" : "➕ Nuevo producto"}
        </h3>
        <label style={S.label}>Nombre *</label>
        <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={{ ...S.input, marginBottom: 8 }} />
        <label style={S.label}>Marca</label>
        <input value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} style={{ ...S.input, marginBottom: 8 }} />
        <label style={S.label}>Categoría</label>
        <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} style={{ ...S.input, marginBottom: 8 }}>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div><label style={S.label}>Precio *</label>
            <input type="number" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} style={{ ...S.input, marginBottom: 8 }} /></div>
          <div><label style={S.label}>Costo</label>
            <input type="number" value={form.costo} onChange={e => setForm({ ...form, costo: e.target.value })} style={{ ...S.input, marginBottom: 8 }} /></div>
          <div><label style={S.label}>Stock</label>
            <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} style={{ ...S.input, marginBottom: 8 }} /></div>
        </div>
        <label style={S.label}>Descripción</label>
        <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows={2} style={{ ...S.input, marginBottom: 10 }} />

        {/* Imagen */}
        <label style={S.label}>Imagen del artículo</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 64, height: 64, borderRadius: 10, background: C.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: `1px dashed ${C.border}` }}>
            {imagen ? <img src={imagen} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 26 }}>🌸</span>}
          </div>
          <div>
            <button onClick={() => fileRef.current?.click()} style={S.btnGhost}>📷 Subir imagen</button>
            {imagen && <button onClick={() => setImagen("")} style={{ ...S.btnGhost, marginLeft: 6, color: C.red }}>Quitar</button>}
            <div style={{ fontSize: 10, color: C.sub, marginTop: 4 }}>Se comprime automáticamente (máx. 500px)</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onImagen} style={{ display: "none" }} />
        </div>

        <button onClick={guardar} disabled={!puedeCrear && !editId} style={{ ...S.btn, width: "100%", opacity: (!puedeCrear && !editId) ? 0.55 : 1 }}>
          {editId ? "Guardar cambios" : "Agregar al inventario"}
        </button>
        {editId && <button onClick={() => { setEditId(null); setForm(vacio); setImagen(""); }} style={{ ...S.btnGhost, width: "100%", marginTop: 8 }}>Cancelar</button>}
      </div>
    </div>
  );
}

// ════════════════════════════ HISTORIAL DE FACTURAS ════════════════════════════
function Historial() {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" });
  const hace30 = new Date(Date.now() - 30 * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" });
  const [desde, setDesde] = useState(hace30);
  const [hasta, setHasta] = useState(hoy);
  const [ventas, setVentas] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [abierta, setAbierta] = useState<any>(null);
  const [cargando, setCargando] = useState(false);

  const buscar = async () => {
    setCargando(true);
    try {
      const d = await fetch(`${API}/aloha/historial?desde=${desde}&hasta=${hasta}&page=1`).then(r => r.json());
      setVentas(d.ventas || []); setTotal(d.total || 0);
    } catch { setVentas([]); }
    finally { setCargando(false); }
  };
  useEffect(() => { buscar(); }, []);

  const totalRango = ventas.reduce((a, v) => a + Number(v.total || 0), 0);

  const reimprimir = (v: any) => {
    const items = (v.aloha_detalle || []).map((d: any) => ({
      nombre: d.aloha_productos?.nombre || "Artículo", qty: d.cantidad, precio: Number(d.precio),
    }));
    imprimirHTML(generarHTMLAloha(v, items));
  };

  return (
    <div style={S.card}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
        <div><label style={S.label}>Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ ...S.input, marginBottom: 0 }} /></div>
        <div><label style={S.label}>Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ ...S.input, marginBottom: 0 }} /></div>
        <button onClick={buscar} style={S.btn}>{cargando ? "Buscando…" : "🔍 Buscar"}</button>
        <div style={{ marginLeft: "auto", fontSize: 13, color: C.sub }}>
          {total} facturas · Total del rango: <b style={{ color: C.primaryD }}>{fmt(totalRango)}</b>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={S.th}>Factura</th><th style={S.th}>Fecha</th><th style={S.th}>Cliente</th>
          <th style={S.th}>Método</th><th style={S.th}>ITBIS</th><th style={S.th}>Total</th><th style={S.th}></th>
        </tr></thead>
        <tbody>
          {ventas.map(v => (
            <React.Fragment key={v.id}>
              <tr onClick={() => setAbierta(abierta === v.id ? null : v.id)} style={{ cursor: "pointer" }}>
                <td style={{ ...S.td, fontWeight: 800, color: C.primaryD }}>{v.numero || `#${v.id}`}</td>
                <td style={S.td}>{new Date(v.created_at).toLocaleString("es-DO", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                <td style={S.td}>{v.cliente_nombre || "Cliente genérico"}</td>
                <td style={S.td}>{v.metodo_pago}</td>
                <td style={S.td}>{Number(v.itbis) > 0 ? fmt(v.itbis) : "—"}</td>
                <td style={{ ...S.td, fontWeight: 800 }}>{fmt(v.total)}</td>
                <td style={S.td}><button onClick={e => { e.stopPropagation(); reimprimir(v); }} style={S.btnGhost}>🖨️</button></td>
              </tr>
              {abierta === v.id && (
                <tr><td colSpan={7} style={{ ...S.td, background: C.bg }}>
                  {(v.aloha_detalle || []).map((d: any) => (
                    <div key={d.id} style={{ fontSize: 12, color: C.text, padding: "2px 0" }}>
                      {d.cantidad} × {d.aloha_productos?.nombre || "Artículo"} @ {fmt(d.precio)} = <b>{fmt(d.cantidad * d.precio)}</b>
                    </div>
                  ))}
                  {v.metodo_pago === "MIXTO" && (
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>
                      Mixto: 💵 {fmt(v.monto_efectivo)} · 💳 {fmt(v.monto_tarjeta)} · 🏦 {fmt(v.monto_transferencia)}
                    </div>
                  )}
                </td></tr>
              )}
            </React.Fragment>
          ))}
          {ventas.length === 0 && <tr><td style={S.td} colSpan={7}>Sin facturas en este rango.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
