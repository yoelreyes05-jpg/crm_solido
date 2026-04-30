"use client";
import { useState, useEffect } from "react";
import { API_URL as API } from "@/config";

const CATEGORIAS = [
  "General","Filtros","Frenos","Suspensión","Motor","Eléctrico",
  "Transmisión","Enfriamiento","Escape","Lubricantes",
  "Iluminación","Correas y Cadenas","Inyección","Aceites","Fluidos","Otro",
];

const CAT_COLOR: Record<string, string> = {
  "Filtros":           "#1F6AA5",
  "Frenos":            "#C0392B",
  "Suspensión":        "#8E44AD",
  "Motor":             "#E67E22",
  "Eléctrico":         "#27AE60",
  "Transmisión":       "#2C3E50",
  "Enfriamiento":      "#16A085",
  "Escape":            "#7F8C8D",
  "Lubricantes":       "#D4AC0D",
  "Iluminación":       "#2980B9",
  "Correas y Cadenas": "#B7950B",
  "Inyección":         "#922B21",
  "Aceites":           "#CA6F1E",
  "Fluidos":           "#1A5276",
  "General":           "#566573",
  "Otro":              "#717D7E",
};

export default function InventarioPage() {
  const [parts, setParts]       = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [catFilter, setCatFilter] = useState("Todas");
  const [modalOpen, setModalOpen] = useState(false);
  const [editPart, setEditPart] = useState<any>(null);
  const [saving, setSaving]     = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const emptyForm = {
    name: "", code: "", price: "", stock: "0", min_stock: "5", supplier_id: "",
    categoria: "General", descripcion: "", marcas_compatibles: "", observaciones: "",
  };
  const [form, setForm] = useState(emptyForm);

  const fetchData = async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        fetch(`${API}/inventario`),
        fetch(`${API}/suplidores`),
      ]);
      const p = await pRes.json();
      const s = await sRes.json();
      setParts(Array.isArray(p) ? p : []);
      setSuppliers(Array.isArray(s) ? s : []);
    } catch { console.error("Error cargando datos"); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditPart(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (p: any) => {
    setEditPart(p);
    setForm({
      name:               p.name,
      code:               p.code || "",
      price:              p.price.toString(),
      stock:              p.stock.toString(),
      min_stock:          p.min_stock.toString(),
      supplier_id:        p.supplier_id?.toString() || "",
      categoria:          p.categoria  || "General",
      descripcion:        p.descripcion || "",
      marcas_compatibles: p.marcas_compatibles || "",
      observaciones:      p.observaciones || "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.price) return alert("Nombre y precio son requeridos");
    setSaving(true);
    try {
      const url    = editPart ? `${API}/inventario/${editPart.id}` : `${API}/inventario`;
      const method = editPart ? "PUT" : "POST";
      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:               form.name,
          code:               form.code,
          price:              Number(form.price),
          stock:              Number(form.stock),
          min_stock:          Number(form.min_stock),
          supplier_id:        form.supplier_id ? Number(form.supplier_id) : null,
          categoria:          form.categoria || "General",
          descripcion:        form.descripcion || null,
          marcas_compatibles: form.marcas_compatibles || null,
          observaciones:      form.observaciones || null,
        }),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      setModalOpen(false);
      fetchData();
    } catch { alert("Error al guardar"); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res  = await fetch(`${API}/inventario/${deleteId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      setDeleteId(null);
      fetchData();
    } catch { alert("Error al eliminar"); }
  };

  // Categorías únicas para el filtro
  const cats = ["Todas", ...Array.from(new Set(parts.map((p: any) => p.categoria || "General"))).sort()];

  const filtered = parts.filter((p: any) => {
    const matchSearch =
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      (p.code && p.code.toLowerCase().includes(search.toLowerCase())) ||
      (p.categoria && p.categoria.toLowerCase().includes(search.toLowerCase())) ||
      (p.marcas_compatibles && p.marcas_compatibles.toLowerCase().includes(search.toLowerCase()));
    const matchCat = catFilter === "Todas" || (p.categoria || "General") === catFilter;
    return matchSearch && matchCat;
  });

  const lowStock   = parts.filter((p: any) => p.stock <= p.min_stock);
  const valorTotal = parts.reduce((s: number, p: any) => s + p.price * p.stock, 0);

  const badgeColor = (p: any) => {
    if (p.stock === 0)          return { bg: "#fee2e2", color: "#dc2626" };
    if (p.stock <= p.min_stock) return { bg: "#fef9c3", color: "#854d0e" };
    return { bg: "#dcfce7", color: "#166534" };
  };

  return (
    <div style={container}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 style={title}>📦 Inventario de Repuestos</h1>
        <button onClick={openCreate} style={btnPrimary}>➕ Nuevo Repuesto</button>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:24 }}>
        <div style={kpiCard}>
          <div style={kpiLabel}>📦 Total Referencias</div>
          <div style={kpiNum}>{parts.length}</div>
        </div>
        <div style={{ ...kpiCard, borderLeft: lowStock.length > 0 ? "5px solid #ef4444" : "5px solid #e5e7eb" }}>
          <div style={kpiLabel}>⚠️ Bajo Stock</div>
          <div style={{ ...kpiNum, color: lowStock.length > 0 ? "#ef4444" : "#111" }}>{lowStock.length}</div>
          {lowStock.length > 0 && (
            <div style={{ fontSize:12, color:"#ef4444", marginTop:4 }}>
              {lowStock.map((p: any) => p.name).join(", ").substring(0, 60)}...
            </div>
          )}
        </div>
        <div style={kpiCard}>
          <div style={kpiLabel}>💰 Valor del Inventario</div>
          <div style={{ ...kpiNum, fontSize:22 }}>
            RD$ {valorTotal.toLocaleString("es-DO", { minimumFractionDigits:2 })}
          </div>
        </div>
      </div>

      {/* Buscador + Filtro categoría */}
      <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap" }}>
        <input
          placeholder="🔍 Buscar por nombre, código, marca..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding:"12px 16px", flex:1, minWidth:220, borderRadius:10, border:"1px solid #ddd", fontSize:14, boxSizing:"border-box" as const }}
        />
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          style={{ padding:"12px 14px", borderRadius:10, border:"1px solid #ddd", fontSize:14, minWidth:180 }}
        >
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div style={{ background:"#fff", borderRadius:16, boxShadow:"0 4px 20px rgba(0,0,0,0.08)", overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#111827" }}>
              {["Código","Nombre","Categoría","Marcas","Descripción","Stock","Mín.","Precio Unit.","Valor Total","Suplidor","Acciones"].map(h => (
                <th key={h} style={{ padding:"13px 12px", textAlign:"left", fontSize:12, color:"#fff", fontWeight:700, whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ padding:40, textAlign:"center", color:"#aaa", fontSize:15 }}>Cargando inventario...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={11} style={{ padding:40, textAlign:"center", color:"#aaa", fontSize:15 }}>Sin resultados</td></tr>
            ) : filtered.map((p: any, i: number) => {
              const badge = badgeColor(p);
              const sup   = suppliers.find((s: any) => s.id === p.supplier_id);
              const catBg = CAT_COLOR[p.categoria || "General"] || "#566573";
              return (
                <tr key={p.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb", borderBottom:"1px solid #f0f0f0" }}>
                  <td style={td}>
                    <span style={{ background:"#e0f2fe", color:"#0369a1", padding:"3px 8px", borderRadius:6, fontSize:12, fontWeight:700, fontFamily:"monospace" }}>
                      {p.code || `#${p.id}`}
                    </span>
                  </td>
                  <td style={{ ...td, fontWeight:700, maxWidth:160 }}>{p.name}</td>
                  <td style={td}>
                    <span style={{ background: catBg, color:"#fff", padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>
                      {p.categoria || "General"}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize:12, color:"#555", maxWidth:140 }}>
                    {p.marcas_compatibles || <span style={{ color:"#bbb" }}>—</span>}
                  </td>
                  <td style={{ ...td, fontSize:12, color:"#666", maxWidth:200 }}>
                    {p.descripcion
                      ? <span title={p.descripcion}>{p.descripcion.substring(0, 55)}{p.descripcion.length > 55 ? "…" : ""}</span>
                      : <span style={{ color:"#bbb" }}>—</span>}
                  </td>
                  <td style={td}>
                    <span style={{ background:badge.bg, color:badge.color, padding:"4px 12px", borderRadius:20, fontWeight:800, fontSize:14 }}>
                      {p.stock}
                    </span>
                  </td>
                  <td style={{ ...td, color:"#888" }}>{p.min_stock}</td>
                  <td style={td}>RD$ {Number(p.price).toFixed(2)}</td>
                  <td style={{ ...td, fontWeight:700, color:"#10b981" }}>
                    RD$ {(p.price * p.stock).toFixed(2)}
                  </td>
                  <td style={{ ...td, color:"#666" }}>{sup?.name || "—"}</td>
                  <td style={td}>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={() => openEdit(p)}
                        style={{ padding:"6px 12px", background:"#3b82f6", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:12 }}>
                        ✏️
                      </button>
                      <button onClick={() => setDeleteId(p.id)}
                        style={{ padding:"6px 12px", background:"#fee2e2", color:"#dc2626", border:"1px solid #fecaca", borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:12 }}>
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding:"10px 16px", fontSize:12, color:"#9ca3af", borderTop:"1px solid #f0f0f0" }}>
          Mostrando {filtered.length} de {parts.length} referencias
        </div>
      </div>

      {/* MODAL CREAR/EDITAR */}
      {modalOpen && (
        <div style={overlay}>
          <div style={modal}>
            <h2 style={{ marginBottom:20, fontSize:20, fontWeight:700 }}>
              {editPart ? `✏️ Editar: ${editPart.name}` : "➕ Nuevo Repuesto"}
            </h2>

            {/* Fila 1: Nombre + Código */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <label style={mlabel}>Nombre *</label>
                <input placeholder="Ej: Filtro de Aceite" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} style={minput} />
              </div>
              <div>
                <label style={mlabel}>Código</label>
                <input placeholder="Ej: FLT-001" value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })} style={minput} />
              </div>
            </div>

            {/* Fila 2: Categoría + Suplidor */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <label style={mlabel}>Categoría</label>
                <select value={form.categoria}
                  onChange={e => setForm({ ...form, categoria: e.target.value })} style={minput}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={mlabel}>Suplidor</label>
                <select value={form.supplier_id}
                  onChange={e => setForm({ ...form, supplier_id: e.target.value })} style={minput}>
                  <option value="">— Sin suplidor —</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {/* Descripción */}
            <label style={mlabel}>Descripción</label>
            <textarea
              placeholder="Descripción técnica del repuesto, especificaciones..."
              value={form.descripcion}
              onChange={e => setForm({ ...form, descripcion: e.target.value })}
              rows={2}
              style={{ ...minput, resize:"vertical", fontFamily:"inherit" }}
            />

            {/* Marcas compatibles */}
            <label style={mlabel}>Marcas Compatibles</label>
            <input
              placeholder="Ej: Toyota, Honda, Nissan, Ford..."
              value={form.marcas_compatibles}
              onChange={e => setForm({ ...form, marcas_compatibles: e.target.value })}
              style={minput}
            />

            {/* Fila 3: Precio + Stock */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
              <div>
                <label style={mlabel}>Precio (RD$) *</label>
                <input type="number" placeholder="0.00" value={form.price}
                  onChange={e => setForm({ ...form, price: e.target.value })} style={minput} />
              </div>
              <div>
                <label style={mlabel}>Stock actual</label>
                <input type="number" placeholder="0" value={form.stock}
                  onChange={e => setForm({ ...form, stock: e.target.value })} style={minput} />
              </div>
              <div>
                <label style={mlabel}>Stock mínimo</label>
                <input type="number" placeholder="5" value={form.min_stock}
                  onChange={e => setForm({ ...form, min_stock: e.target.value })} style={minput} />
              </div>
            </div>

            {/* Observaciones */}
            <label style={mlabel}>Observaciones</label>
            <textarea
              placeholder="Notas internas, instrucciones de instalación, advertencias..."
              value={form.observaciones}
              onChange={e => setForm({ ...form, observaciones: e.target.value })}
              rows={2}
              style={{ ...minput, resize:"vertical", fontFamily:"inherit" }}
            />

            <div style={{ display:"flex", gap:10, marginTop:8 }}>
              <button onClick={handleSubmit} disabled={saving}
                style={{ flex:1, padding:14, background:"#111827", color:"#fff", border:"none", borderRadius:10, cursor:"pointer", fontWeight:700, fontSize:15 }}>
                {saving ? "Guardando..." : "💾 Guardar"}
              </button>
              <button onClick={() => setModalOpen(false)}
                style={{ flex:1, padding:14, background:"#f1f5f9", color:"#111", border:"1px solid #ddd", borderRadius:10, cursor:"pointer", fontSize:15 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM ELIMINAR */}
      {deleteId !== null && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth:380, textAlign:"center" as const }}>
            <div style={{ fontSize:48, marginBottom:12 }}>⚠️</div>
            <h3 style={{ fontSize:18, marginBottom:8 }}>¿Eliminar repuesto?</h3>
            <p style={{ color:"#888", marginBottom:20, fontSize:14 }}>Esta acción no se puede deshacer.</p>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={handleDelete}
                style={{ flex:1, padding:13, background:"#dc2626", color:"#fff", border:"none", borderRadius:10, cursor:"pointer", fontWeight:700, fontSize:15 }}>
                Sí, eliminar
              </button>
              <button onClick={() => setDeleteId(null)}
                style={{ flex:1, padding:13, background:"#f1f5f9", border:"1px solid #ddd", borderRadius:10, cursor:"pointer", fontSize:15 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const container: React.CSSProperties  = { padding:"24px", background:"#f5f7fb", minHeight:"100vh" };
const title: React.CSSProperties      = { fontSize:28, fontWeight:900, margin:0 };
const btnPrimary: React.CSSProperties = { padding:"12px 22px", background:"#111827", color:"#fff", border:"none", borderRadius:10, cursor:"pointer", fontWeight:700, fontSize:15 };
const kpiCard: React.CSSProperties    = { background:"#fff", borderRadius:14, padding:"20px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)", borderLeft:"5px solid #e5e7eb" };
const kpiLabel: React.CSSProperties   = { fontSize:13, color:"#888", marginBottom:10, fontWeight:600 };
const kpiNum: React.CSSProperties     = { fontSize:34, fontWeight:900, color:"#111" };
const td: React.CSSProperties         = { padding:"11px 12px", fontSize:13 };
const overlay: React.CSSProperties    = { position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 };
const modal: React.CSSProperties      = { background:"#fff", padding:28, borderRadius:18, width:"90%", maxWidth:580, boxShadow:"0 25px 60px rgba(0,0,0,0.3)", maxHeight:"90vh", overflowY:"auto" };
const mlabel: React.CSSProperties     = { display:"block", fontSize:13, fontWeight:600, marginBottom:4, color:"#555" };
const minput: React.CSSProperties     = { display:"block", marginBottom:12, padding:"11px", width:"100%", borderRadius:8, border:"1px solid #ddd", boxSizing:"border-box", fontSize:13 };
