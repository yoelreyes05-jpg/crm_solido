"use client";
/**
 * /repuestos — Vista pública del catálogo web de repuestos.
 * Los datos vienen de la tabla "inventario" (mapeados por el backend).
 * Para agregar, editar o eliminar repuestos, usa el módulo /inventario.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL as API } from "@/config";

export default function RepuestosWebPage() {
  const router = useRouter();
  const [repuestos, setRepuestos] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [busqueda, setBusqueda]   = useState("");

  const cargar = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/inventario`);  // tabla inventario: name, price, stock, code
      const data = await res.json();
      setRepuestos(Array.isArray(data) ? data : []);
    } catch { setRepuestos([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  const filtrados = repuestos.filter(r =>
    !busqueda.trim() || r.name?.toLowerCase().includes(busqueda.toLowerCase()) || r.code?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={container}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={title}>🔩 Repuestos — Vista Web</h1>
          <p style={{ color:"#6b7280", fontSize:13, marginTop:2 }}>
            Esta es la vista pública que aparece en la página web. Datos tomados del módulo{" "}
            <strong>Inventario</strong>.
          </p>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={cargar} style={btnSecondary}>🔄 Actualizar</button>
          <button onClick={() => router.push("/inventario")} style={btnPrimary}>
            📦 Gestionar en Inventario →
          </button>
        </div>
      </div>

      {/* Banner informativo */}
      <div style={infoBanner}>
        <span style={{ fontSize:20 }}>ℹ️</span>
        <div>
          <div style={{ fontWeight:700, marginBottom:2 }}>¿Cómo funciona?</div>
          <div style={{ fontSize:13, opacity:0.9 }}>
            El portal de Repuestos en tu página web muestra automáticamente todos los artículos
            registrados en <strong>Inventario</strong>. Para agregar o modificar repuestos, ve al
            módulo Inventario. Los cambios se reflejan en tiempo real en la web.
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={kpiGrid}>
        {[
          { label: "Total en catálogo",   value: repuestos.length,                               icon: "📦", color:"#3b82f6", bg:"#eff6ff" },
          { label: "Con stock disponible", value: repuestos.filter(r=>r.stock>0).length,          icon: "✅", color:"#10b981", bg:"#d1fae5" },
          { label: "Sin stock",           value: repuestos.filter(r=>r.stock<=0).length,          icon: "🚨", color:"#ef4444", bg:"#fee2e2" },
          { label: "Precio promedio",     value: repuestos.length
              ? `RD$ ${(repuestos.reduce((a,r)=>a+Number(r.price),0)/repuestos.length).toFixed(2)}`
              : "—",                                                                               icon: "💰", color:"#f59e0b", bg:"#fefce8" },
        ].map((k,i) => (
          <div key={i} style={{ ...kpiCard, background: k.bg }}>
            <div style={{ fontSize:26 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize:20, fontWeight:800, color:k.color }}>{k.value}</div>
              <div style={{ fontSize:11, color:"#6b7280", fontWeight:600 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Búsqueda */}
      <input
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="🔍 Buscar repuesto por nombre..."
        style={searchInput}
      />

      {/* Tabla */}
      {loading ? (
        <p style={{ color:"#6b7280", padding:20 }}>Cargando inventario...</p>
      ) : filtrados.length === 0 ? (
        <div style={emptyBox}>
          <div style={{ fontSize:44, marginBottom:10 }}>🔩</div>
          <div style={{ fontWeight:600, color:"#374151" }}>
            {busqueda ? "No hay resultados" : "El inventario está vacío"}
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
                {["#","Nombre","Código","Precio (RD$)","Stock","Estado web"].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                  <td style={td}>{r.id}</td>
                  <td style={{ ...td, fontWeight:700 }}>{r.name}</td>
                  <td style={{ ...td, color:"#6b7280", fontFamily:"monospace" }}>
                    {r.code || "—"}
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
                      : <span style={{ color:"#9ca3af", fontSize:12 }}>⚫ Oculto (sin stock)</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding:"10px 16px", fontSize:12, color:"#9ca3af", borderTop:"1px solid #f0f0f0" }}>
            Mostrando {filtrados.length} de {repuestos.length} artículos · Solo aparecen en la web los que tienen stock &gt; 0
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const container    = { padding:"24px", background:"#f5f7fb", minHeight:"100vh" } as const;
const title        = { fontSize:24, fontWeight:800, color:"#111827" } as const;
const kpiGrid      = { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 } as const;
const kpiCard      = { borderRadius:12, padding:"14px 16px", display:"flex", alignItems:"center", gap:12, boxShadow:"0 2px 8px rgba(0,0,0,0.06)" } as const;
const infoBanner   = { display:"flex", gap:14, alignItems:"flex-start", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:12, padding:"16px 20px", marginBottom:20, color:"#1d4ed8" } as const;
const searchInput  = { display:"block", width:"100%", padding:"11px 14px", borderRadius:10, border:"1px solid #e5e7eb", fontSize:14, marginBottom:16, outline:"none", boxSizing:"border-box" as const };
const tableWrap    = { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.07)", overflow:"hidden" } as const;
const table        = { width:"100%", borderCollapse:"collapse" as const };
const th           = { padding:"12px 14px", background:"#111827", color:"#fff", fontSize:12, fontWeight:700, textAlign:"left" as const };
const td           = { padding:"11px 14px", fontSize:13, borderBottom:"1px solid #f0f0f0" } as const;
const emptyBox     = { textAlign:"center" as const, padding:"60px 20px", background:"#fff", borderRadius:16, boxShadow:"0 2px 10px rgba(0,0,0,0.06)" };
const btnPrimary   = { padding:"10px 20px", background:"#111827", color:"#fff", border:"none", borderRadius:10, cursor:"pointer", fontWeight:700, fontSize:13 } as const;
const btnSecondary = { padding:"10px 16px", background:"#f1f5f9", color:"#374151", border:"1px solid #e5e7eb", borderRadius:10, cursor:"pointer", fontWeight:700, fontSize:13 } as const;
