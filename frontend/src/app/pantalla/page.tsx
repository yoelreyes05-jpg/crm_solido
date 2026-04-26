"use client";
import { useEffect, useState, useCallback } from "react";
import { API_URL as API } from "@/config";

// ─── Fases del taller ─────────────────────────────────────────────────────────
const FASES = [
  { key: "RECIBIDO",        label: "Recibido",      color: "#3b82f6", icon: "📋" },
  { key: "DIAGNOSTICO",     label: "Diagnóstico",   color: "#f59e0b", icon: "🔍" },
  { key: "REPARACION",      label: "Reparación",    color: "#ef4444", icon: "🔧" },
  { key: "CONTROL_CALIDAD", label: "Ctrl. Calidad", color: "#8b5cf6", icon: "✅" },
  { key: "LISTO",           label: "Listo",         color: "#10b981", icon: "🎉" },
  { key: "ENTREGADO",       label: "Entregado",     color: "#6b7280", icon: "🏁" },
];

// ─── Slide rotación ─────────────────────────────────────────────────────────
// Slides: [taller] → [cafe_prod_1] → [cafe_prod_2] → ... → [taller] ...
// El slide de taller muestra el estado de todas las fases
// Cada slide de cafetería muestra hasta ~12 productos (grid grande)

const SLIDE_DURATION = 10_000; // 10 segundos por slide

export default function PantallaTV() {
  const [ordenes,      setOrdenes]      = useState<any[]>([]);
  const [productos,    setProductos]    = useState<any[]>([]);
  const [slideIdx,     setSlideIdx]     = useState(0);
  const [hora,         setHora]         = useState("");

  // ── Carga datos ────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    try {
      const [oRes, pRes] = await Promise.all([
        fetch(`${API}/ordenes`),
        fetch(`${API}/cafeteria/productos`),
      ]);
      const o = await oRes.json();
      const p = await pRes.json();
      setOrdenes(Array.isArray(o) ? o : []);
      setProductos(Array.isArray(p) ? p : []);
    } catch {}
  }, []);

  useEffect(() => {
    cargar();
    const refresh = setInterval(cargar, 30_000);
    return () => clearInterval(refresh);
  }, [cargar]);

  // ── Reloj ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setHora(now.toLocaleTimeString("es-DO", { hour:"2-digit", minute:"2-digit" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Slides ────────────────────────────────────────────────────────────────
  // Slide 0 → taller
  // Slides 1..N → cafetería (agrupadas de 12 productos por slide)
  const PROD_POR_SLIDE = 12;
  const cafSlides: any[][] = [];
  for (let i = 0; i < productos.length; i += PROD_POR_SLIDE) {
    cafSlides.push(productos.slice(i, i + PROD_POR_SLIDE));
  }
  // Si no hay productos de cafetería, solo hay 1 slide (taller)
  const totalSlides = 1 + cafSlides.length;

  useEffect(() => {
    const id = setInterval(() => {
      setSlideIdx(prev => (prev + 1) % totalSlides);
    }, SLIDE_DURATION);
    return () => clearInterval(id);
  }, [totalSlides]);

  // ── Agrupar órdenes por fase ───────────────────────────────────────────────
  const byFase: Record<string, any[]> = {};
  for (const f of FASES) byFase[f.key] = ordenes.filter(o => (o.estado || "RECIBIDO") === f.key);
  const activas = ordenes.filter(o => o.estado !== "ENTREGADO");

  const esSliderTaller = slideIdx === 0;
  const cafSlide = cafSlides[slideIdx - 1] || [];

  return (
    <div style={{
      width:"100vw", height:"100vh", overflow:"hidden",
      background:"#050a14", color:"#f1f5f9",
      fontFamily:"system-ui,-apple-system,sans-serif",
      display:"flex", flexDirection:"column",
    }}>

      {/* ══ HEADER TV ════════════════════════════════════════════════════════ */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"12px 32px", background:"#0f172a",
        borderBottom:"2px solid #1e3a5f", flexShrink:0,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <span style={{ fontSize:32 }}>🚗</span>
          <div>
            <div style={{ fontWeight:900, fontSize:20, letterSpacing:1 }}>SÓLIDO AUTO SERVICIO</div>
            <div style={{ fontSize:12, color:"#64748b" }}>
              {esSliderTaller ? "Estado del Taller" : "Menú Cafetería"}
            </div>
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:40, fontWeight:900, color:"#3b82f6", fontVariantNumeric:"tabular-nums" }}>{hora}</div>
          <div style={{ fontSize:12, color:"#64748b" }}>
            {new Date().toLocaleDateString("es-DO", { weekday:"long", day:"2-digit", month:"long" })}
          </div>
        </div>
      </div>

      {/* ══ CONTENIDO PRINCIPAL ══════════════════════════════════════════════ */}
      <div style={{ flex:1, overflow:"hidden", position:"relative" }}>

        {/* ─ SLIDE TALLER ────────────────────────────────────────────────── */}
        {esSliderTaller && (
          <div style={{ padding:"20px 32px", height:"100%", display:"flex", flexDirection:"column" }}>

            {/* Resumen rápido */}
            <div style={{ display:"flex", gap:12, marginBottom:20, flexShrink:0 }}>
              {[
                { label:"En Taller",   valor: activas.length,                   color:"#3b82f6" },
                { label:"Listos",      valor: byFase["LISTO"]?.length || 0,     color:"#10b981" },
                { label:"Diagnóstico", valor: byFase["DIAGNOSTICO"]?.length||0, color:"#f59e0b" },
                { label:"Reparación",  valor: byFase["REPARACION"]?.length||0,  color:"#ef4444" },
              ].map(k => (
                <div key={k.label} style={{
                  flex:1, background:"#0f172a", borderRadius:14, padding:"14px 16px",
                  borderLeft:`4px solid ${k.color}`,
                  boxShadow:`0 4px 20px ${k.color}22`,
                }}>
                  <div style={{ fontSize:13, color:"#64748b", fontWeight:600 }}>{k.label}</div>
                  <div style={{ fontSize:40, fontWeight:900, color:k.color }}>{k.valor}</div>
                </div>
              ))}
            </div>

            {/* Kanban fases */}
            <div style={{ flex:1, display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:12, overflow:"hidden" }}>
              {FASES.map(fase => {
                const cards = byFase[fase.key] || [];
                return (
                  <div key={fase.key} style={{
                    background:"#0f172a", borderRadius:14,
                    border:`1px solid ${fase.color}33`, overflow:"hidden",
                    display:"flex", flexDirection:"column",
                  }}>
                    {/* Cabecera fase */}
                    <div style={{
                      padding:"10px 12px", background:`${fase.color}18`,
                      borderBottom:`2px solid ${fase.color}`,
                      display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0,
                    }}>
                      <span style={{ fontSize:13, fontWeight:800 }}>{fase.icon} {fase.label}</span>
                      <span style={{
                        background:fase.color, color:"#fff", borderRadius:"50%",
                        width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:12, fontWeight:900,
                      }}>{cards.length}</span>
                    </div>
                    {/* Tarjetas */}
                    <div style={{ flex:1, overflowY:"hidden", padding:8 }}>
                      {cards.length === 0 && (
                        <div style={{ textAlign:"center", color:"#334155", fontSize:12, padding:"12px 0" }}>Sin órdenes</div>
                      )}
                      {cards.slice(0, 6).map(orden => (
                        <div key={orden.id} style={{
                          background:"#1e293b", borderRadius:9, padding:"8px 10px",
                          marginBottom:6, border:`1px solid ${fase.color}22`,
                        }}>
                          <div style={{ fontSize:12, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                            {orden.cliente_nombre || "Sin cliente"}
                          </div>
                          <div style={{ fontSize:11, color:"#64748b", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                            🚗 {orden.vehiculo_info || "—"}
                          </div>
                        </div>
                      ))}
                      {cards.length > 6 && (
                        <div style={{ fontSize:11, color:"#475569", textAlign:"center", padding:"4px 0" }}>
                          +{cards.length - 6} más
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─ SLIDE CAFETERÍA ──────────────────────────────────────────────── */}
        {!esSliderTaller && (
          <div style={{ padding:"20px 32px", height:"100%", display:"flex", flexDirection:"column" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexShrink:0 }}>
              <span style={{ fontSize:28 }}>☕</span>
              <div style={{ fontWeight:900, fontSize:22 }}>Menú Cafetería</div>
              {cafSlides.length > 1 && (
                <span style={{ fontSize:13, color:"#64748b", background:"#1e293b", padding:"3px 10px", borderRadius:6 }}>
                  Página {slideIdx} de {cafSlides.length}
                </span>
              )}
            </div>
            <div style={{
              flex:1,
              display:"grid",
              gridTemplateColumns: cafSlide.length <= 4 ? "repeat(4,1fr)" : cafSlide.length <= 6 ? "repeat(3,1fr)" : "repeat(4,1fr)",
              gap:14, alignContent:"start", overflow:"hidden",
            }}>
              {cafSlide.map(prod => (
                <div key={prod.id} style={{
                  background:"#0f172a", borderRadius:16, overflow:"hidden",
                  border:"1px solid #1e3a5f", display:"flex", flexDirection:"column",
                  boxShadow:"0 4px 20px rgba(0,0,0,0.4)",
                }}>
                  {prod.imagen
                    ? <img src={prod.imagen} alt={prod.nombre} style={{ width:"100%", height:160, objectFit:"cover" }} />
                    : <div style={{ width:"100%", height:160, background:"#1e293b", display:"flex", alignItems:"center", justifyContent:"center", fontSize:52 }}>☕</div>
                  }
                  <div style={{ padding:"12px 14px", flex:1 }}>
                    <div style={{ fontWeight:800, fontSize:16, marginBottom:4 }}>{prod.nombre}</div>
                    {prod.categoria && (
                      <div style={{ fontSize:11, color:"#64748b", marginBottom:6 }}>{prod.categoria}</div>
                    )}
                    <div style={{ fontSize:22, fontWeight:900, color:"#10b981" }}>
                      RD$ {Number(prod.precio).toFixed(2)}
                    </div>
                    {prod.stock <= 0 && (
                      <div style={{ fontSize:11, color:"#ef4444", marginTop:4, fontWeight:700 }}>❌ Agotado</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══ FOOTER con indicador de slide ════════════════════════════════════ */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"center", gap:8,
        padding:"10px 0", background:"#0f172a", borderTop:"1px solid #1e293b", flexShrink:0,
      }}>
        {Array.from({ length: totalSlides }).map((_, i) => (
          <div key={i} style={{
            width: i === slideIdx ? 28 : 8, height:8, borderRadius:4,
            background: i === slideIdx ? "#3b82f6" : "#334155",
            transition:"all 0.4s ease",
          }} />
        ))}
      </div>
    </div>
  );
}
