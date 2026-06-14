"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { API_URL as API } from "@/config";

interface Order {
  id: number;
  numero_orden: string;
  descripcion: string;
  estado: string;
  total: number;
  created_at: string;
  cliente_nombre: string;
  vehiculo_info: string;
  vehiculo_placa?: string;
}

const FILTROS = [
  { key: "TODOS",               label: "Todas",         color: "#6b7280", icon: "📋" },
  { key: "RECIBIDO",            label: "Recibidos",     color: "#3b82f6", icon: "📥" },
  { key: "DIAGNOSTICO",         label: "Diagnóstico",   color: "#f59e0b", icon: "🔬" },
  { key: "ESPERANDO_APROBACION",label: "Aprobación",    color: "#f97316", icon: "⏳" },
  { key: "REPARACION",          label: "Reparación",    color: "#ef4444", icon: "🔧" },
  { key: "CONTROL_CALIDAD",     label: "Ctrl. Calidad", color: "#8b5cf6", icon: "✅" },
  { key: "LISTO",               label: "Listos",        color: "#10b981", icon: "🎉" },
  { key: "ENTREGADO",           label: "Entregados",    color: "#6b7280", icon: "🏁" },
];

const ESTADO_COLOR: Record<string, string> = {
  RECIBIDO:"#3b82f6", DIAGNOSTICO:"#f59e0b", ESPERANDO_APROBACION:"#f97316",
  REPARACION:"#ef4444", CONTROL_CALIDAD:"#8b5cf6", LISTO:"#10b981",
  ENTREGADO:"#6b7280", CANCELADA:"#dc2626",
};

// Acción rápida contextual según estado de la orden
function AccionRapida({ orden }: { orden: Order }) {
  const acciones: Record<string, { label: string; href: string; color: string }> = {
    RECIBIDO:            { label: "🔬 Iniciar diagnóstico",    href: `/taller/diagnostico/${orden.id}`, color: "#f59e0b" },
    DIAGNOSTICO:         { label: "🔬 Continuar diagnóstico",  href: `/taller/diagnostico/${orden.id}`, color: "#f59e0b" },
    ESPERANDO_APROBACION:{ label: "⏳ Gestionar aprobación",   href: `/aprobacion`,                     color: "#f97316" },
    REPARACION:          { label: "🔧 Ir a reparación",        href: `/taller/reparacion/${orden.id}`,  color: "#ef4444" },
    CONTROL_CALIDAD:     { label: "✅ Control calidad",        href: `/ordenes/${orden.id}`,            color: "#8b5cf6" },
    LISTO:               { label: "🏁 Procesar entrega",       href: `/ordenes/${orden.id}`,            color: "#10b981" },
  };
  const a = acciones[orden.estado];
  if (!a) return null;
  return (
    <Link href={a.href}>
      <button style={{
        padding:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer",
        background: a.color + "18", color: a.color,
        border:`1px solid ${a.color}44`, borderRadius:6, whiteSpace:"nowrap",
      }}>
        {a.label}
      </button>
    </Link>
  );
}

export default function OrdenesPage() {
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro]   = useState("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [toast, setToast]     = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  const showToast = useCallback((msg: string, tipo: "ok" | "err" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API}/ordenes`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchOrders();
    const i = setInterval(fetchOrders, 8000);
    return () => clearInterval(i);
  }, [fetchOrders]);

  const eliminarOrden = async () => {
    if (!confirmId) return;
    try {
      await fetch(`${API}/ordenes/${confirmId}`, { method: "DELETE" });
      showToast("🗑️ Orden eliminada");
      setOrders(prev => prev.filter(o => o.id !== confirmId));
    } catch { showToast("Error al eliminar", "err"); }
    finally { setConfirmId(null); }
  };

  const conteos = useMemo(() => {
    const c: Record<string, number> = { TODOS: orders.length };
    for (const o of orders) c[o.estado] = (c[o.estado] || 0) + 1;
    return c;
  }, [orders]);

  const ordenesFiltradas = useMemo(() => orders.filter(o => {
    const matchEstado = filtro === "TODOS" || o.estado === filtro;
    const q = busqueda.toLowerCase();
    const matchBusqueda = !q || [
      o.cliente_nombre, o.numero_orden, o.vehiculo_info, o.vehiculo_placa, o.descripcion
    ].some(v => (v || "").toLowerCase().includes(q));
    return matchEstado && matchBusqueda;
  }), [orders, filtro, busqueda]);

  return (
    <div style={{ padding:"20px 24px", background:"#f5f7fb", minHeight:"100vh" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position:"fixed", bottom:24, right:24, zIndex:9999,
          background: toast.tipo === "ok" ? "#10b981" : "#ef4444",
          color:"#fff", padding:"12px 20px", borderRadius:10,
          fontWeight:600, fontSize:14, boxShadow:"0 4px 20px rgba(0,0,0,0.3)",
        }}>{toast.msg}</div>
      )}

      {/* Modal eliminar */}
      {confirmId && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9998 }}>
          <div style={{ background:"#fff", borderRadius:14, padding:"28px 32px", maxWidth:360, width:"90%", textAlign:"center" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🗑️</div>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>¿Eliminar esta orden?</div>
            <div style={{ fontSize:13, color:"#6b7280", marginBottom:24 }}>Esta acción no se puede deshacer.</div>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button onClick={() => setConfirmId(null)} style={{ padding:"10px 20px", borderRadius:8, border:"1px solid #e5e7eb", background:"#f9fafb", cursor:"pointer", fontWeight:600 }}>Cancelar</button>
              <button onClick={eliminarOrden} style={{ padding:"10px 20px", borderRadius:8, border:"none", background:"#ef4444", color:"#fff", cursor:"pointer", fontWeight:700 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:900, margin:0 }}>🧾 Órdenes de Trabajo</h1>
          <p style={{ color:"#6b7280", fontSize:13, margin:"4px 0 0" }}>
            {orders.length} órdenes · {ordenesFiltradas.length} mostradas
          </p>
        </div>
        <Link href="/recepcion">
          <button style={{
            padding:"10px 22px", background:"#111827", color:"#fff",
            border:"none", borderRadius:10, cursor:"pointer",
            fontWeight:700, fontSize:14, display:"flex", alignItems:"center", gap:8,
          }}>
            🚗 Nueva Recepción
          </button>
        </Link>
      </div>

      {/* Filtros de estado */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
        {FILTROS.map(f => {
          const activo = filtro === f.key;
          const cnt = conteos[f.key] || 0;
          return (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              style={{
                padding:"6px 13px", borderRadius:20, cursor:"pointer",
                border: activo ? "none" : "1px solid #e5e7eb",
                background: activo ? f.color : "#fff",
                color: activo ? "#fff" : "#374151",
                fontWeight: activo ? 700 : 500,
                fontSize:13, display:"flex", alignItems:"center", gap:5,
                transition:"all .15s",
              }}
            >
              {f.icon} {f.label}
              {cnt > 0 && (
                <span style={{
                  background: activo ? "rgba(255,255,255,0.3)" : f.color + "22",
                  color: activo ? "#fff" : f.color,
                  borderRadius:10, padding:"0 6px", fontSize:11, fontWeight:700,
                }}>{cnt}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Búsqueda */}
      <input
        type="text"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="🔍 Buscar por cliente, placa, número de orden..."
        style={{
          width:"100%", maxWidth:460, padding:"9px 14px", marginBottom:16,
          border:"1px solid #e5e7eb", borderRadius:10, fontSize:14,
          background:"#fff", outline:"none", boxSizing:"border-box",
          display:"block",
        }}
      />

      {/* Tabla */}
      <div style={{ background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", overflow:"hidden" }}>
        {loading ? (
          <div style={{ padding:40, textAlign:"center", color:"#9ca3af" }}>Cargando órdenes...</div>
        ) : ordenesFiltradas.length === 0 ? (
          <div style={{ padding:48, textAlign:"center", color:"#9ca3af" }}>
            <div style={{ fontSize:36, marginBottom:10 }}>📭</div>
            <p style={{ margin:0, fontWeight:700, fontSize:15 }}>
              {busqueda ? `Sin resultados para "${busqueda}"` : "No hay órdenes con este filtro"}
            </p>
            <p style={{ margin:"8px 0 0", fontSize:13 }}>
              Para crear una orden usa <Link href="/recepcion" style={{ color:"#3b82f6", fontWeight:700, textDecoration:"none" }}>Nueva Recepción</Link>
            </p>
          </div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#f8fafc" }}>
                  {["Orden","Cliente","Vehículo","Descripción","Estado","Fecha","Acciones"].map(h => (
                    <th key={h} style={{ padding:"11px 14px", textAlign:"left", fontSize:12, color:"#6b7280", fontWeight:700, whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordenesFiltradas.map(o => {
                  const color = ESTADO_COLOR[o.estado] || "#6b7280";
                  return (
                    <tr
                      key={o.id}
                      style={{ borderBottom:"1px solid #f1f5f9", transition:"background .1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding:"11px 14px", fontWeight:800, fontSize:13, whiteSpace:"nowrap" }}>
                        {o.numero_orden || `OT-${String(o.id).padStart(4,"0")}`}
                      </td>
                      <td style={{ padding:"11px 14px", fontWeight:600, fontSize:13 }}>{o.cliente_nombre}</td>
                      <td style={{ padding:"11px 14px", fontSize:13, color:"#374151" }}>
                        <div>{o.vehiculo_info}</div>
                        {o.vehiculo_placa && (
                          <span style={{ fontSize:11, background:"#f1f5f9", padding:"1px 6px", borderRadius:4, fontFamily:"monospace", color:"#475569" }}>
                            {o.vehiculo_placa}
                          </span>
                        )}
                      </td>
                      <td style={{ padding:"11px 14px", fontSize:13, color:"#6b7280", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {o.descripcion || "—"}
                      </td>
                      <td style={{ padding:"11px 14px" }}>
                        <span style={{
                          background: color+"18", color, border:`1.5px solid ${color}44`,
                          borderRadius:14, padding:"3px 10px", fontWeight:800, fontSize:11, whiteSpace:"nowrap",
                        }}>
                          {o.estado}
                        </span>
                      </td>
                      <td style={{ padding:"11px 14px", fontSize:12, color:"#9ca3af", whiteSpace:"nowrap" }}>
                        {o.created_at ? new Date(o.created_at).toLocaleDateString("es-DO") : "—"}
                      </td>
                      <td style={{ padding:"11px 14px" }}>
                        <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                          <Link href={`/ordenes/${o.id}`}>
                            <button style={{ padding:"4px 10px", background:"#dbeafe", color:"#1d4ed8", border:"none", borderRadius:6, cursor:"pointer", fontSize:11, fontWeight:700 }}>
                              👁 Ver
                            </button>
                          </Link>
                          <AccionRapida orden={o} />
                          <button
                            onClick={() => setConfirmId(o.id)}
                            style={{ padding:"4px 8px", background:"#fee2e2", color:"#dc2626", border:"none", borderRadius:6, cursor:"pointer", fontSize:12 }}
                            title="Eliminar orden"
                          >
                            🗑
                          </button>
                        </div>
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
