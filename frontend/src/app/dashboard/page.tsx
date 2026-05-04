"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { API_URL as API } from "@/config";

// ─── Fases del taller ────────────────────────────────────────────────────────
const FASES = [
  { key: "RECIBIDO",        label: "Recibido",      color: "#3b82f6", light: "#eff6ff", icon: "📋" },
  { key: "DIAGNOSTICO",     label: "Diagnóstico",   color: "#f59e0b", light: "#fffbeb", icon: "🔍" },
  { key: "REPARACION",      label: "Reparación",    color: "#ef4444", light: "#fef2f2", icon: "🔧" },
  { key: "CONTROL_CALIDAD", label: "Ctrl. Calidad", color: "#8b5cf6", light: "#f5f3ff", icon: "✅" },
  { key: "LISTO",           label: "Listo",         color: "#10b981", light: "#ecfdf5", icon: "🎉" },
  { key: "ENTREGADO",       label: "Entregado",     color: "#6b7280", light: "#f9fafb", icon: "🏁" },
];
const MAX_VISIBLE = 3;

export default function Dashboard() {
  const [stats, setStats]     = useState<any>(null);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    try {
      const [sRes, oRes] = await Promise.all([
        fetch(`${API}/dashboard/stats`),
        fetch(`${API}/ordenes`),
      ]);
      setStats(await sRes.json());
      const o = await oRes.json();
      setOrdenes(Array.isArray(o) ? o : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const i = setInterval(loadData, 5000);
    return () => clearInterval(i);
  }, [loadData]);

  // ─── Drag & Drop ────────────────────────────────────────────────────────
  const onDragEnd = async (result: any) => {
    const { source, destination, draggableId } = result;
    if (!destination || source.droppableId === destination.droppableId) return;
    const ordenId  = Number(draggableId);
    const nuevoEst = destination.droppableId;
    // Optimistic update
    setOrdenes(prev => prev.map(o => o.id === ordenId ? { ...o, estado: nuevoEst } : o));
    try {
      await fetch(`${API}/ordenes/${ordenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEst, status: nuevoEst }),
      });
    } catch { loadData(); }
  };

  // ─── Agrupar por fase ───────────────────────────────────────────────────
  const byFase: Record<string, any[]> = {};
  for (const f of FASES) byFase[f.key] = ordenes.filter(o => (o.estado || "RECIBIDO") === f.key);

  const listos        = byFase["LISTO"]?.length || 0;
  const enTaller      = ordenes.filter(o => o.estado !== "ENTREGADO").length;

  if (loading) return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:"60vh", fontSize:18, color:"#888" }}>
      Cargando dashboard...
    </div>
  );

  return (
    <div style={S.container}>
      {/* HEADER */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
        <div>
          <h1 style={S.title}>📊 Dashboard</h1>
          <p style={{ color:"#888", fontSize:14, margin:0 }}>Sólido Auto Servicio — Vista general del taller</p>
        </div>
        <span style={{ fontSize:12, color:"#aaa", background:"#fff", padding:"6px 14px", borderRadius:8, border:"1px solid #e5e7eb" }}>
          🔄 Auto‑refresh 5s
        </span>
      </div>

      {/* ALERTA LISTOS */}
      {listos > 0 && (
        <div style={{
          background:"linear-gradient(135deg,#065f46,#10b981)", color:"#fff",
          borderRadius:14, padding:"13px 20px", marginBottom:20,
          display:"flex", alignItems:"center", gap:14,
          boxShadow:"0 4px 16px rgba(16,185,129,0.4)",
          animation:"pulse 2.5s ease-in-out infinite"
        }}>
          <span style={{ fontSize:28 }}>🎉</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:16 }}>
              {listos} vehículo{listos > 1 ? "s" : ""} listo{listos > 1 ? "s" : ""} para entregar
            </div>
            <div style={{ fontSize:12, opacity:0.82, marginTop:2 }}>Notifica al cliente para coordinar la entrega</div>
          </div>
          <Link href="/ordenes" style={{ background:"rgba(255,255,255,0.2)", color:"#fff", padding:"8px 18px", borderRadius:8, fontWeight:700, fontSize:13, textDecoration:"none" }}>
            Ver órdenes →
          </Link>
        </div>
      )}

      {/* KPIs */}
      <div style={S.kpiGrid}>
        {[
          { label:"🚗 En Taller",   valor: enTaller,                        color:"#3b82f6" },
          { label:"🎉 Listos",      valor: listos,                          color:"#10b981" },
          { label:"🔍 Diagnóstico", valor: stats?.ordenes?.diagnostico||0,  color:"#f59e0b" },
          { label:"🔧 Reparación",  valor: stats?.ordenes?.reparacion||0,   color:"#ef4444" },
          { label:"👥 Clientes",    valor: stats?.clientes||0,              color:"#8b5cf6" },
          { label:"⚠️ Stock Bajo",  valor: stats?.stockBajo||0,            color: stats?.stockBajo > 0 ? "#ef4444" : "#6b7280" },
        ].map(k => (
          <div key={k.label} style={{ background:"#fff", borderRadius:14, padding:"18px 16px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)", borderLeft:`5px solid ${k.color}` }}>
            <div style={{ fontSize:13, color:"#888", marginBottom:8, fontWeight:600 }}>{k.label}</div>
            <div style={{ fontSize:34, fontWeight:900, color:"#111" }}>{k.valor}</div>
          </div>
        ))}
      </div>

      {/* KANBAN */}
      <div style={S.section}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h2 style={S.sectionTitle}>🏭 Estado del Taller</h2>
          <span style={{ fontSize:11, color:"#aaa", background:"#fff", padding:"4px 12px", borderRadius:6, border:"1px solid #e5e7eb" }}>
            ☝️ Arrastra tarjetas para cambiar fase
          </span>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:10, alignItems:"start" }}>
            {FASES.map(fase => {
              const cards   = byFase[fase.key] || [];
              const expanded = expandidas[fase.key];
              const visible  = expanded ? cards : cards.slice(0, MAX_VISIBLE);
              const hayMas   = cards.length > MAX_VISIBLE;
              return (
                <div key={fase.key} style={{ background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", overflow:"hidden", border:`1px solid ${fase.color}22` }}>
                  {/* Header */}
                  <div style={{ padding:"10px 12px", background:fase.light, borderBottom:`2px solid ${fase.color}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:12, fontWeight:800, color:"#111" }}>{fase.icon} {fase.label}</span>
                    <span style={{ background:fase.color, color:"#fff", borderRadius:"50%", width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800 }}>
                      {cards.length}
                    </span>
                  </div>
                  {/* Drop zone */}
                  <Droppable droppableId={fase.key}>
                    {(prov, snap) => (
                      <div ref={prov.innerRef} {...prov.droppableProps} style={{ padding:8, minHeight:60, background:snap.isDraggingOver ? `${fase.color}12` : "transparent", transition:"background 0.15s" }}>
                        {visible.length === 0 && (
                          <div style={{ textAlign:"center", color:"#ddd", fontSize:11, padding:"14px 4px", fontWeight:600 }}>Sin órdenes</div>
                        )}
                        {visible.map((orden, idx) => (
                          <Draggable key={String(orden.id)} draggableId={String(orden.id)} index={idx}>
                            {(p, s) => (
                              <div
                                ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}
                                style={{
                                  background:"#fff",
                                  border:`1.5px solid ${s.isDragging ? fase.color : "#f0f0f0"}`,
                                  borderRadius:10, padding:"9px 10px", marginBottom:6,
                                  cursor:"grab", userSelect:"none",
                                  boxShadow: s.isDragging ? `0 8px 24px rgba(0,0,0,0.18),0 0 0 2px ${fase.color}40` : "0 1px 4px rgba(0,0,0,0.04)",
                                  transform: s.isDragging ? "rotate(1.5deg)" : "none",
                                  ...p.draggableProps.style,
                                }}
                              >
                                <div style={{ fontSize:12, fontWeight:700, color:"#111", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:2 }}>
                                  {orden.cliente_nombre || "Sin cliente"}
                                </div>
                                <div style={{ fontSize:11, color:"#888", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                  🚗 {orden.vehiculo_info || "—"}
                                </div>
                                {orden.created_at && (
                                  <div style={{ fontSize:10, color:"#ccc", marginTop:4 }}>
                                    {new Date(orden.created_at).toLocaleDateString("es-DO")}
                                  </div>
                                )}
                                {fase.key === "LISTO" && orden.cliente_telefono && (
                                  <a
                                    href={`https://wa.me/${orden.cliente_telefono.replace(/\D/g,"")}?text=${encodeURIComponent(`Hola ${orden.cliente_nombre} 👋, le informamos que su vehículo *${orden.vehiculo_info}* ya está listo para ser retirado en *Sólido Auto Servicio*. Nuestro horario es de 8am a 6pm. ¡Le esperamos!`)}`}
                                    target="_blank" rel="noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:4, marginTop:7, padding:"5px 0", background:"#25d366", color:"#fff", borderRadius:6, fontSize:11, fontWeight:700, textDecoration:"none" }}>
                                    💬 Notificar cliente
                                  </a>
                                )}
                                {fase.key === "LISTO" && !orden.cliente_telefono && (
                                  <div style={{ marginTop:6, fontSize:10, color:"#f59e0b", textAlign:"center" }}>⚠️ Sin teléfono</div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {prov.placeholder}
                      </div>
                    )}
                  </Droppable>
                  {hayMas && (
                    <button onClick={() => setExpandidas(prev => ({ ...prev, [fase.key]: !prev[fase.key] }))}
                      style={{ width:"100%", padding:"7px", border:"none", background:`${fase.color}10`, color:fase.color, fontSize:11, fontWeight:700, cursor:"pointer", borderTop:`1px solid ${fase.color}20` }}>
                      {expanded ? "▲ Ver menos" : `▼ +${cards.length - MAX_VISIBLE} más`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* ÚLTIMAS ÓRDENES */}
      <div style={S.section}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h2 style={{ ...S.sectionTitle, marginBottom:0 }}>🧾 Últimas Órdenes de Trabajo</h2>
          <Link href="/ordenes" style={{ fontSize:14, color:"#3b82f6", fontWeight:600, textDecoration:"none" }}>Ver todas →</Link>
        </div>
        <div style={{ background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                {["#","Cliente","Vehículo","Descripción","Estado","Fecha"].map(h => (
                  <th key={h} style={{ padding:"12px 16px", textAlign:"left", fontSize:12, color:"#888", fontWeight:700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenes.length === 0 ? (
                <tr><td colSpan={6} style={{ padding:30, textAlign:"center", color:"#aaa" }}>Sin órdenes</td></tr>
              ) : ordenes.slice(0,8).map(o => {
                const fase = FASES.find(f => f.key === o.estado) || FASES[0];
                return (
                  <tr key={o.id} style={{ borderTop:"1px solid #f0f0f0" }}>
                    <td style={S.td}>#{o.id}</td>
                    <td style={{ ...S.td, fontWeight:700 }}>{o.cliente_nombre}</td>
                    <td style={S.td}>{o.vehiculo_info}</td>
                    <td style={{ ...S.td, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{o.descripcion||"—"}</td>
                    <td style={S.td}>
                      <span style={{ background:fase.color, color:"#fff", padding:"3px 10px", borderRadius:6, fontSize:11, fontWeight:700 }}>{o.estado}</span>
                    </td>
                    <td style={{ ...S.td, fontSize:12, color:"#888" }}>{o.created_at ? new Date(o.created_at).toLocaleDateString("es-DO") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ACCESOS RÁPIDOS */}
      <div style={S.section}>
        <h2 style={S.sectionTitle}>⚡ Accesos Rápidos</h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
          {[
            { href:"/ordenes",      label:"➕ Nueva Orden",       color:"#3b82f6" },
            { href:"/diagnosticos", label:"🔬 Nuevo Diagnóstico", color:"#8b5cf6" },
            { href:"/facturacion",  label:"🧾 Facturar",          color:"#10b981" },
            { href:"/clientes",     label:"👤 Nuevo Cliente",     color:"#f59e0b" },
          ].map(a => (
            <Link key={a.href} href={a.href} style={{
              background:a.color, color:"#fff", padding:"18px 16px",
              borderRadius:14, textAlign:"center", fontWeight:700,
              fontSize:15, textDecoration:"none", display:"block",
              boxShadow:`0 4px 14px ${a.color}44`,
            }}>
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.88} }
      `}</style>
    </div>
  );
}

const S: any = {
  container:    { padding:"24px 28px", background:"#f5f7fb", minHeight:"100vh" },
  title:        { fontSize:26, fontWeight:900, margin:0 },
  kpiGrid:      { display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:14, marginBottom:24 },
  section:      { marginBottom:28 },
  sectionTitle: { fontSize:17, fontWeight:700, marginBottom:14, color:"#111" },
  td:           { padding:"12px 16px", fontSize:13 },
};
