"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { API_URL as API } from "@/config";
import { useEmpresa } from "@/lib/empresa";

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

// ─── Gráfica de barras SVG (inline, sin dependencias) ────────────────────────
function BarChart({
  data,
  colorBar = "#3b82f6",
  height = 100,
  labelKey = "fecha",
  valueKey = "total",
  formatValue = (v: number) => String(v),
  yPrefix = "",
}: {
  data: Record<string, any>[];
  colorBar?: string;
  height?: number;
  labelKey?: string;
  valueKey?: string;
  formatValue?: (v: number) => string;
  yPrefix?: string;
}) {
  if (!data || data.length === 0) return null;
  const valores = data.map(d => Number(d[valueKey]) || 0);
  const maxVal  = Math.max(...valores, 1);
  const W       = 460;
  const H       = height;
  const barW    = Math.floor((W - 16) / data.length) - 2;

  return (
    <svg viewBox={`0 0 ${W} ${H + 28}`} style={{ width: "100%", overflow: "visible" }}>
      {data.map((d, i) => {
        const v     = Number(d[valueKey]) || 0;
        const barH  = maxVal > 0 ? Math.max(3, Math.round((v / maxVal) * H)) : 3;
        const x     = 8 + i * (barW + 2);
        const y     = H - barH;
        const label = String(d[labelKey]).slice(5); // MM-DD
        return (
          <g key={i}>
            <rect
              x={x} y={y}
              width={barW} height={barH}
              rx={3}
              fill={v > 0 ? colorBar : "#334155"}
              opacity={0.85}
            />
            {v > 0 && (
              <text
                x={x + barW / 2} y={y - 3}
                textAnchor="middle"
                fontSize={9}
                fill={colorBar}
                fontWeight="700"
              >
                {yPrefix}{formatValue(v)}
              </text>
            )}
            {/* Only show every other label to avoid crowding */}
            {i % 2 === 0 && (
              <text
                x={x + barW / 2} y={H + 20}
                textAnchor="middle"
                fontSize={8}
                fill="#64748b"
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Dashboard() {
  const empresa = useEmpresa();
  const [stats,   setStats]   = useState<any>(null);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [kpisGerente, setKpisGerente] = useState<any>(null);
  const [planesResumen, setPlanesResumen] = useState<any>(null);
  const [vinHoy,  setVinHoy]  = useState(0);
  const [cafeHoy, setCafeHoy] = useState<number|null>(null);
  const [oper,    setOper]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});

  // Rol del usuario logueado
  const rolUsuario: string =
    typeof window !== "undefined"
      ? (JSON.parse(localStorage.getItem("usuario") || "{}").rol || "").toLowerCase()
      : "";
  const esGerente = ["gerente", "admin", "jefe"].includes(rolUsuario);

  const loadData = useCallback(async () => {
    try {
      const requests: Promise<any>[] = [
        fetch(`${API}/dashboard/stats`),
        fetch(`${API}/ordenes`),
        fetch(`${API}/api/predictivo/vin-historial`),
        fetch(`${API}/cafeteria/ventas?limit=200`),
        fetch(`${API}/dashboard/operaciones`),
      ];
      if (esGerente) requests.push(fetch(`${API}/dashboard/kpis-gerente`));

      const [sRes, oRes, vinRes, cafeRes, operRes, kRes] = await Promise.all(requests);
      setStats(await sRes.json());
      const o = await oRes.json();
      setOrdenes(Array.isArray(o) ? o : []);

      // Operaciones: ingresos por canal + tablero de lavados
      try { setOper(await operRes.json()); } catch { setOper(null); }

      // VIN: contar consultas de hoy
      try {
        const vinData = await vinRes.json();
        const hoy = new Date().toISOString().slice(0, 10);
        const count = Array.isArray(vinData)
          ? vinData.filter((v: any) => v.consultado_en?.slice(0, 10) === hoy).length
          : 0;
        setVinHoy(count);
      } catch { setVinHoy(0); }

      // Cafetería: total vendido hoy
      try {
        const cafeData = await cafeRes.json();
        const hoy = new Date().toISOString().slice(0, 10);
        const total = Array.isArray(cafeData)
          ? cafeData
              .filter((v: any) => v.created_at?.slice(0, 10) === hoy)
              .reduce((s: number, v: any) => s + (Number(v.total) || 0), 0)
          : null;
        setCafeHoy(total);
      } catch { setCafeHoy(null); }

      if (kRes) setKpisGerente(await kRes.json());

      // 💎 Membresías: ganancias e inscripciones (solo gerente)
      if (esGerente) {
        try {
          const pr = await fetch(`${API}/planes/resumen`).then(r => r.json());
          if (pr && !pr.error) setPlanesResumen(pr);
        } catch { /* módulo de planes sin migrar aún */ }
      }
    } catch {}
    setLoading(false);
  }, [esGerente]);

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

  const listos   = byFase["LISTO"]?.length || 0;
  const enTaller = ordenes.filter(o => o.estado !== "ENTREGADO").length;

  const money = (n: number) => "$" + Number(n || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Tablero de lavados (car wash) por estado
  const LAV_COLS = [
    { key: "en_lavado", label: "En Lavado", icon: "🚿", color: "#0891b2", light: "#ecfeff" },
    { key: "listo",     label: "Listo",     icon: "✅", color: "#10b981", light: "#ecfdf5" },
    { key: "entregado", label: "Entregado", icon: "🏁", color: "#6b7280", light: "#f9fafb" },
  ];
  const lav = oper?.lavados || { en_lavado: [], listo: [], entregado: [] };

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
          <p style={{ color:"#888", fontSize:14, margin:0 }}>{empresa.nombre || "Sólido Auto Servicio"} — Vista general del taller</p>
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

      {/* KPIs básicos */}
      <div style={S.kpiGrid}>
        {[
          { label:"🚗 En Taller",   valor: enTaller,                        color:"#3b82f6" },
          { label:"🎉 Listos",      valor: listos,                          color:"#10b981" },
          { label:"🔍 Diagnóstico", valor: stats?.ordenes?.diagnostico||0,  color:"#f59e0b" },
          { label:"🔧 Reparación",  valor: stats?.ordenes?.reparacion||0,   color:"#ef4444" },
          { label:"👥 Clientes",    valor: stats?.clientes||0,              color:"#8b5cf6" },
          { label:"⚠️ Stock Bajo",  valor: stats?.stockBajo||0,             color: stats?.stockBajo > 0 ? "#ef4444" : "#6b7280" },
          { label:"🔎 VIN Hoy",     valor: vinHoy,                          color:"#7c3aed" },
        ].map(k => (
          <div key={k.label} style={{ background:"#fff", borderRadius:14, padding:"18px 16px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)", borderLeft:`5px solid ${k.color}` }}>
            <div style={{ fontSize:13, color:"#888", marginBottom:8, fontWeight:600 }}>{k.label}</div>
            <div style={{ fontSize:34, fontWeight:900, color:"#111" }}>{k.valor}</div>
          </div>
        ))}
      </div>

      {/* ── VENTAS DE HOY POR CANAL ── */}
      <div style={S.section}>
        <h2 style={S.sectionTitle}>💰 Ventas de Hoy por Canal</h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:14 }}>
          {[
            { label:"☕ Cafetería POS", valor: oper?.cafeteriaHoy ?? cafeHoy ?? 0, color:"#d97706", href:"/cafeteria" },
            { label:"🎓 Cursos",        valor: oper?.cursosHoy ?? 0,               color:"#7c3aed", href:"/capacitaciones" },
            { label:"🚿 Car Wash",      valor: oper?.carwashHoy ?? 0,              color:"#0891b2", href:"/carwash" },
            { label:"🧮 Total del Día",  valor: (Number(oper?.cafeteriaHoy)||0)+(Number(oper?.cursosHoy)||0)+(Number(oper?.carwashHoy)||0), color:"#10b981", href:"/contabilidad" },
          ].map(k => (
            <Link key={k.label} href={k.href} style={{ textDecoration:"none" }}>
              <div style={{ background:"#fff", borderRadius:14, padding:"18px 16px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)", borderLeft:`5px solid ${k.color}` }}>
                <div style={{ fontSize:13, color:"#888", marginBottom:8, fontWeight:600 }}>{k.label}</div>
                <div style={{ fontSize:26, fontWeight:900, color:"#111" }}>{money(Number(k.valor) || 0)}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── TABLERO DE LAVADOS (CAR WASH) ── */}
      <div style={S.section}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h2 style={{ ...S.sectionTitle, marginBottom:0 }}>🚿 Lavados — En Pantalla</h2>
          <Link href="/carwash" style={{ fontSize:14, color:"#0891b2", fontWeight:600, textDecoration:"none" }}>Ir a Car Wash →</Link>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, alignItems:"start" }}>
          {LAV_COLS.map(col => {
            const items: any[] = lav[col.key] || [];
            return (
              <div key={col.key} style={{ background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", overflow:"hidden", border:`1px solid ${col.color}22` }}>
                <div style={{ padding:"10px 14px", background:col.light, borderBottom:`2px solid ${col.color}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:13, fontWeight:800, color:"#111" }}>{col.icon} {col.label}</span>
                  <span style={{ background:col.color, color:"#fff", borderRadius:"50%", minWidth:22, height:22, padding:"0 6px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800 }}>
                    {items.length}
                  </span>
                </div>
                <div style={{ padding:10, minHeight:60 }}>
                  {items.length === 0 ? (
                    <div style={{ textAlign:"center", color:"#ccc", fontSize:12, padding:"18px 4px", fontWeight:600 }}>Sin vehículos</div>
                  ) : items.map(o => (
                    <div key={o.id} style={{ border:"1px solid #f0f0f0", borderLeft:`3px solid ${col.color}`, borderRadius:10, padding:"9px 11px", marginBottom:8, background:"#fcfcfd" }}>
                      <div style={{ fontSize:13, fontWeight:800, color:"#111" }}>{o.vehiculo_info}</div>
                      <div style={{ fontSize:12, color:"#888" }}>{o.cliente_nombre}</div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:4 }}>
                        <span style={{ fontSize:11, color:"#0891b2", fontWeight:700 }}>👤 {o.tecnico_nombre || "Sin técnico"}</span>
                        <span style={{ fontSize:12, fontWeight:800, color:"#10b981" }}>{money(o.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── KPIs GERENTE (C7) ── */}
      {esGerente && kpisGerente && (
        <div style={{ ...S.section }}>
          <h2 style={S.sectionTitle}>📈 Análisis Gerencial</h2>

          {/* KPI cards financieros */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
            {[
              {
                label: "💵 Ingreso Hoy",
                valor: `$${(kpisGerente.ingresoHoy || 0).toLocaleString("es-DO", { minimumFractionDigits:2, maximumFractionDigits:2 })}`,
                color: "#10b981",
                sub: "ventas del día",
              },
              {
                label: "📅 Ingreso Semana",
                valor: `$${(kpisGerente.ingresoSemana || 0).toLocaleString("es-DO", { minimumFractionDigits:2, maximumFractionDigits:2 })}`,
                color: "#3b82f6",
                sub: "semana en curso",
              },
              {
                label: "🎯 Ticket Promedio",
                valor: kpisGerente.ticketPromedio > 0
                  ? `$${Number(kpisGerente.ticketPromedio).toLocaleString("es-DO", { minimumFractionDigits:2, maximumFractionDigits:2 })}`
                  : "—",
                color: "#8b5cf6",
                sub: "últimas 2 semanas",
              },
              {
                label: "✅ Tasa Aprobación",
                valor: kpisGerente.tasaAprobacion != null ? `${kpisGerente.tasaAprobacion}%` : "—",
                color: kpisGerente.tasaAprobacion >= 80 ? "#10b981" : kpisGerente.tasaAprobacion >= 60 ? "#f59e0b" : "#ef4444",
                sub: "órdenes completadas",
              },
            ].map(k => (
              <div key={k.label} style={{
                background:"#fff", borderRadius:14, padding:"18px 16px",
                boxShadow:"0 2px 12px rgba(0,0,0,0.06)",
                borderTop:`4px solid ${k.color}`,
              }}>
                <div style={{ fontSize:12, color:"#888", marginBottom:4, fontWeight:600 }}>{k.label}</div>
                <div style={{ fontSize:26, fontWeight:900, color:"#111", marginBottom:4 }}>{k.valor}</div>
                <div style={{ fontSize:11, color:"#aaa" }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* 💎 Membresías — ganancias e inscripciones */}
          {planesResumen && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
              {[
                {
                  label: "💎 Miembros Activos",
                  valor: String(planesResumen.miembros_activos || 0),
                  color: "#6366f1",
                  sub: `${planesResumen.inscripciones_mes || 0} inscripciones este mes`,
                },
                {
                  label: "🔁 Ingreso Recurrente",
                  valor: `$${(planesResumen.mrr || 0).toLocaleString("es-DO", { minimumFractionDigits:2, maximumFractionDigits:2 })}`,
                  color: "#8b5cf6",
                  sub: "MRR mensual de membresías",
                },
                {
                  label: "💳 Membresías — Mes",
                  valor: `$${(planesResumen.ingresos_mes || 0).toLocaleString("es-DO", { minimumFractionDigits:2, maximumFractionDigits:2 })}`,
                  color: "#10b981",
                  sub: "cobrado este mes (inscripciones + renovaciones)",
                },
                {
                  label: "🏆 Membresías — Total",
                  valor: `$${(planesResumen.ingresos_total || 0).toLocaleString("es-DO", { minimumFractionDigits:2, maximumFractionDigits:2 })}`,
                  color: "#f59e0b",
                  sub: "histórico de planes",
                },
              ].map(k => (
                <div key={k.label} style={{
                  background:"#fff", borderRadius:14, padding:"18px 16px",
                  boxShadow:"0 2px 12px rgba(0,0,0,0.06)",
                  borderTop:`4px solid ${k.color}`,
                }}>
                  <div style={{ fontSize:12, color:"#888", marginBottom:4, fontWeight:600 }}>{k.label}</div>
                  <div style={{ fontSize:26, fontWeight:900, color:"#111", marginBottom:4 }}>{k.valor}</div>
                  <div style={{ fontSize:11, color:"#aaa" }}>{k.sub}</div>
                </div>
              ))}
            </div>
          )}

          {/* Gráficas */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            {/* Volumen de órdenes — 14 días */}
            <div style={{ background:"#fff", borderRadius:14, padding:"18px 20px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#111", marginBottom:14 }}>
                📦 Órdenes por día — últimas 2 semanas
              </div>
              <BarChart
                data={kpisGerente.volumenDiario || []}
                colorBar="#3b82f6"
                height={90}
                labelKey="fecha"
                valueKey="total"
              />
              <div style={{ fontSize:11, color:"#aaa", marginTop:8, textAlign:"right" }}>
                Total: <strong style={{ color:"#111" }}>{kpisGerente.ordenes14dias}</strong> órdenes
              </div>
            </div>

            {/* Ingresos — 7 días */}
            <div style={{ background:"#fff", borderRadius:14, padding:"18px 20px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#111", marginBottom:14 }}>
                💰 Ingresos por día — última semana
              </div>
              <BarChart
                data={kpisGerente.ingresosDiarios || []}
                colorBar="#10b981"
                height={90}
                labelKey="fecha"
                valueKey="total"
                yPrefix="$"
                formatValue={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v)}
              />
              <div style={{ fontSize:11, color:"#aaa", marginTop:8, textAlign:"right" }}>
                Semana: <strong style={{ color:"#111" }}>
                  ${(kpisGerente.ingresoSemana || 0).toLocaleString("es-DO", { minimumFractionDigits:2, maximumFractionDigits:2 })}
                </strong>
              </div>
            </div>
          </div>

          {/* Stock bajo */}
          {kpisGerente.stockBajoItems?.length > 0 && (
            <div style={{ background:"#fff", borderRadius:14, padding:"16px 20px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)", marginTop:16, borderLeft:"4px solid #ef4444" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#ef4444", marginBottom:10 }}>
                ⚠️ Repuestos con stock bajo
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {kpisGerente.stockBajoItems.map((item: any, i: number) => (
                  <span key={i} style={{
                    background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8,
                    padding:"5px 12px", fontSize:12, color:"#dc2626",
                  }}>
                    {item.nombre} — <strong>{item.stock}</strong> / min {item.min}
                  </span>
                ))}
                <Link href="/inventario" style={{ fontSize:12, color:"#3b82f6", fontWeight:600, textDecoration:"none", alignSelf:"center", marginLeft:6 }}>
                  Ver inventario →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

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
                  <div style={{ padding:"10px 12px", background:fase.light, borderBottom:`2px solid ${fase.color}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:12, fontWeight:800, color:"#111" }}>{fase.icon} {fase.label}</span>
                    <span style={{ background:fase.color, color:"#fff", borderRadius:"50%", width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800 }}>
                      {cards.length}
                    </span>
                  </div>
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
                                    href={`https://wa.me/${orden.cliente_telefono.replace(/\D/g,"")}?text=${encodeURIComponent(`Hola ${orden.cliente_nombre} 👋, le informamos que su vehículo *${orden.vehiculo_info}* ya está listo para ser retirado en *${empresa.nombre || "Sólido Auto Servicio"}*. Nuestro horario es de 8am a 6pm. ¡Le esperamos!`)}`}
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
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
          {[
            { href:"/recepcion",    label:"🚗 Nueva Recepción",   color:"#3b82f6" },
            { href:"/diagnosticos", label:"🔬 Nuevo Diagnóstico",  color:"#8b5cf6" },
            { href:"/facturacion",  label:"🧾 Facturar",           color:"#10b981" },
            { href:"/clientes",     label:"👤 Nuevo Cliente",      color:"#f59e0b" },
            { href:"/cafeteria",    label:"☕ Cafetería",           color:"#d97706" },
            { href:"/inteligencia", label:"🧠 Inteligencia",        color:"#7c3aed" },
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
  kpiGrid:      { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:14, marginBottom:24 },
  section:      { marginBottom:28 },
  sectionTitle: { fontSize:17, fontWeight:700, marginBottom:14, color:"#111" },
  td:           { padding:"12px 16px", fontSize:13 },
};
