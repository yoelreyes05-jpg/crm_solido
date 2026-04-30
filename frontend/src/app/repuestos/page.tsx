"use client";
/**
 * /repuestos — Vista pública del catálogo web de repuestos.
 * Los datos vienen de la tabla "inventario" (mapeados por el backend).
 * Para agregar, editar o eliminar repuestos, usa el módulo /inventario.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL as API } from "@/config";

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

export default function RepuestosWebPage() {
  const router = useRouter();
  const [repuestos, setRepuestos]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [busqueda, setBusqueda]     = useState("");
  const [catFilter, setCatFilter]   = useState("Todas");

  const cargar = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/inventario`);
      const data = await res.json();
      setRepuestos(Array.isArray(data) ? data : []);
    } catch { setRepuestos([]); }
    finally   { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  // Categorías únicas
  const cats = ["Todas", ...Array.from(new Set(repuestos.map((r: any) => r.categoria || "General"))).sort()];

  const filtrados = repuestos.filter((r: any) => {
    const q = busqueda.trim().toLowerCase();
    const matchQ = !q ||
      r.name?.toLowerCase().includes(q) ||
      r.code?.toLowerCase().includes(q) ||
      r.descripcion?.toLowerCase().includes(q) ||
      r.marcas_compatibles?.toLowerCase().includes(q);
    const matchC = catFilter === "Todas" || (r.categoria || "General") === catFilter;
    return matchQ && matchC;
  });

  return (
    <div style={container}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={title}>🔩 Repuestos — Vista Web</h1>
          <p style={{ color:"#6b7280", fontSize:13, marginTop:2 }}>
            Vista pública del catálogo. Gestiona desde <strong>Inventario</strong>.
          </p>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={cargar} style={btnSecondary}>🔄 Actualizar</button>
          <button onClick={() => router.push("/inventario")} style={btnPrimary}>
            📦 Gestionar en Inventario →
          </button>
        </div>
      </div>

      {/* Banner */}
      <div style={infoBanner}>
        <span style={{ fontSize:20 }}>ℹ️</span>
        <div>
          <div style={{ fontWeight:700, marginBottom:2 }}>¿Cómo funciona?</div>
          <div style={{ fontSize:13, opacity:0.9 }}>
            Todos los artículos registrados en <strong>Inventario</strong> aparecen aquí automáticamente,
            con su categoría, descripción y marcas compatibles.
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={kpiGrid}>
        {[
          { label:"Total en catálogo",    value: repuestos.length,                       icon:"📦", color:"#3b82f6", bg:"#eff6ff" },
          { label:"Con stock disponible", value: repuestos.filter((r:any)=>r.stock>0).length, icon:"✅", color:"#10b981", bg:"#d1fae5" },
          { label:"Sin stock",            value: repuestos.filter((r:any)=>r.stock<=0).length, icon:"🚨", color:"#ef4444", bg:"#fee2e2" },
          { label:"Precio promedio",
            value: repuestos.length
              ? `RD$ ${(repuestos.reduce((a:number,r:any)=>a+Number(r.price),0)/repuestos.length).toFixed(2)}`
              : "—",                                                                      icon:"💰", color:"#f59e0b", bg:"#fefce8" },
        ].map((k,i) => (
          <div key={i} style={{ ...kpiCard, background:k.bg }}>
            <div style={{ fontSize:26 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize:20, fontWeight:800, color:k.color }}>{k.value}</div>
              <div style={{ fontSize:11, color:"#6b7280", fontWeight:600 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Búsqueda + Filtro */}
      <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap" }}>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="🔍 Buscar por nombre, código, marca, descripción..."
          style={{ ...searchInput, flex:1, minWidth:200 }}
        />
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          style={{ padding:"11px 14px", borderRadius:10, border:"1px solid #e5e7eb", fontSize:14, minWidth:180 }}
        >
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Tabla */}
      {loading ? (
        <p style={{ color:"#6b7280", padding:20 }}>Cargando inventario...</p>
      ) : filtrados.length === 0 ? (
        <div style={emptyBox}>
          <div style={{ fontSize:44, marginBottom:10 }}>🔩</div>
          <div style={{ fontWeight:600, color:"#374151" }}>
            {busqueda || catFilter !== "Todas" ? "No hay resultados" : "El inventario está vacío"}
          </div>
          <button onClick={() => router.push("/inventario")} style={{ ...btnPrimary, marginTop:16 }}>
            📦 Ir a Inventario
          </button>
        </div>
      ) : (
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                {["#","Nombre","Código","Categoría","Marcas Compatibles","Descripción","Precio (RD$)","Stock","Estado"].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r:any, i:number) => {
                const catBg = CAT_COLOR[r.categoria || "General"] || "#566573";
                return (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                    <td style={td}>{r.id}</td>
                    <td style={{ ...td, fontWeight:700 }}>{r.name}</td>
                    <td style={{ ...td, color:"#6b7280", fontFamily:"monospace", fontSize:12 }}>
                      {r.code || "—"}
                    </td>
                    <td style={td}>
                      <span style={{ background:catBg, color:"#fff", padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>
                        {r.categoria || "General"}
                      </span>
                    </td>
                    <td style={{ ...td, fontSize:12, color:"#555" }}>
                      {r.marcas_compatibles || <span style={{ color:"#bbb" }}>—</span>}
                    </td>
                    <td style={{ ...td, fontSize:12, color:"#666", maxWidth:220 }}>
                      {r.descripcion
                        ? <span title={r.descripcion}>{r.descripcion.substring(0, 60)}{r.descripcion.length > 60 ? "…" : ""}</span>
                        : <span style={{ color:"#bbb" }}>—</span>}
                    </td>
                    <td style={{ ...td, fontWeight:700, color:"#059669" }}>
                      {Number(r.price).toLocaleString("es-DO", { minimumFractionDigits:2 })}
                    </td>
                    <td style={{ ...td, textAlign:"center" as const }}>
                      <span style={{
                        background: r.stock <= 0 ? "#fee2e2" : r.stock <= 3 ? "#fef3c7" : "#d1fae5",
                        color:      r.stock <= 0 ? "#dc2626" : r.stock <= 3 ? "#92400e" : "#065f46",
                        padding:"3px 10px", borderRadius:10, fontSize:12, fontWeight:700
                      }}>
                        {r.stock}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign:"center" as const }}>
                      {r.stock > 0
                        ? <span style={{ color:"#16a34a", fontWeight:700, fontSize:12 }}>✅ Visible</span>
                        : <span style={{ color:"#9ca3af", fontSize:12 }}>⚫ Oculto</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding:"10px 16px", fontSize:12, color:"#9ca3af", borderTop:"1px solid #f0f0f0" }}>
            Mostrando {filtrados.length} de {repuestos.length} artículos
          </div>
        </div>
      )}
    </div>
  );
}

const container    = { padding:"24px", background:"#f5f7fb", minHeight:"100vh" } as const;
const title        = { fontSize:24, fontWeight:800, color:"#111827" } as const;
const kpiGrid      = { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 } as const;
const kpiCard      = { borderRadius:12, padding:"14px 16px", display:"flex", alignItems:"center", gap:12, boxShadow:"0 2px 8px rgba(0,0,0,0.06)" } as const;
const infoBanner   = { display:"flex", gap:14, alignItems:"flex-start", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:12, padding:"16px 20px", marginBottom:20, color:"#1d4ed8" } as const;
const searchInput  = { padding:"11px 14px", borderRadius:10, border:"1px solid #e5e7eb", fontSize:14, outline:"none", boxSizing:"border-box" as const, display:"block" };
const tableWrap    = { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.07)", overflow:"hidden" } as const;
const table        = { width:"100%", borderCollapse:"collapse" as const };
const th           = { padding:"12px 12px", background:"#111827", color:"#fff", fontSize:12, fontWeight:700, textAlign:"left" as const };
const td           = { padding:"10px 12px", fontSize:13, borderBottom:"1px solid #f0f0f0" } as const;
const emptyBox     = { textAlign:"center" as const, padding:"60px 20px", background:"#fff", borderRadius:16, boxShadow:"0 2px 10px rgba(0,0,0,0.06)" };
const btnPrimary   = { padding:"10px 20px", background:"#111827", color:"#fff", border:"none", borderRadius:10, cursor:"pointer", fontWeight:700, fontSize:13 } as const;
const btnSecondary = { padding:"10px 16px", background:"#f1f5f9", color:"#374151", border:"1px solid #e5e7eb", borderRadius:10, cursor:"pointer", fontWeight:700, fontSize:13 } as const;
