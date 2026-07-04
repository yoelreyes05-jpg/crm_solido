"use client";
import { useState, useEffect, useCallback } from "react";
import { API_URL as API } from "@/config";
import { usePermisos } from "@/lib/usePermisos";

// ─── Estilos (mismo patrón visual que /usuarios) ─────────────────────────────
const container: any = { padding: 24, maxWidth: 1200, margin: "0 auto" };
const title: any     = { fontSize: 24, fontWeight: 800, marginBottom: 20, color: "#111827" };
const card: any      = { background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb" };
const table: any     = { width: "100%", borderCollapse: "collapse" as const };
const th: any        = { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5, color: "#64748b", borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap" as const };
const td: any        = { padding: "10px 12px", fontSize: 13, color: "#334155", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" as const };
const inputS: any    = { padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "#fff", minWidth: 130 };
const labelS: any    = { fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: 0.5, display: "block", marginBottom: 4 };

// Colores por tipo de acción
const ACCION_COLOR: Record<string, { bg: string; fg: string }> = {
  CREAR:    { bg: "#dcfce7", fg: "#166534" },
  EDITAR:   { bg: "#dbeafe", fg: "#1e40af" },
  ELIMINAR: { bg: "#fee2e2", fg: "#b91c1c" },
  ANULAR:   { bg: "#fef3c7", fg: "#92400e" },
  COBRAR:   { bg: "#d1fae5", fg: "#065f46" },
  PAGAR:    { bg: "#e0e7ff", fg: "#3730a3" },
  LOGIN:    { bg: "#f1f5f9", fg: "#475569" },
};

const MODULO_LABEL: Record<string, string> = {
  facturas:   "🧾 Facturas",
  usuarios:   "👥 Usuarios",
  permisos:   "🔐 Permisos",
  clientes:   "👤 Clientes",
  vehiculos:  "🚙 Vehículos",
  inventario: "📦 Inventario",
  caja_chica: "💵 Caja Chica",
  nomina:     "💰 Nómina",
  sesion:     "🔑 Sesión",
};

const PAGE_SIZE = 50;

export default function AuditoriaPage() {
  const { puedeVer, listo } = usePermisos("auditoria");

  const [items, setItems]     = useState<any[]>([]);
  const [total, setTotal]     = useState(0);
  const [pagina, setPagina]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [detalleAbierto, setDetalleAbierto] = useState<number | null>(null);

  // Filtros
  const [fUsuario, setFUsuario] = useState("");
  const [fModulo, setFModulo]   = useState("");
  const [fAccion, setFAccion]   = useState("");
  const [fDesde, setFDesde]     = useState("");
  const [fHasta, setFHasta]     = useState("");
  const [fBuscar, setFBuscar]   = useState("");

  // Opciones dinámicas de filtros
  const [opciones, setOpciones] = useState<{ modulos: string[]; acciones: string[]; usuarios: string[] }>({ modulos: [], acciones: [], usuarios: [] });

  const cargar = useCallback(async (pag = 0) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (fUsuario) params.set("usuario", fUsuario);
      if (fModulo)  params.set("modulo", fModulo);
      if (fAccion)  params.set("accion", fAccion);
      if (fDesde)   params.set("desde", fDesde);
      if (fHasta)   params.set("hasta", fHasta);
      if (fBuscar)  params.set("buscar", fBuscar);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(pag * PAGE_SIZE));

      const res  = await fetch(`${API}/auditoria?${params.toString()}`);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setItems(data.items || []);
      setTotal(data.total || 0);
      setPagina(pag);
    } catch {
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }, [fUsuario, fModulo, fAccion, fDesde, fHasta, fBuscar]);

  useEffect(() => { cargar(0); }, []); // carga inicial

  useEffect(() => {
    fetch(`${API}/auditoria/opciones`)
      .then(r => r.json())
      .then(d => { if (d && !d.error) setOpciones(d); })
      .catch(() => {});
  }, []);

  const limpiar = () => {
    setFUsuario(""); setFModulo(""); setFAccion(""); setFDesde(""); setFHasta(""); setFBuscar("");
    setTimeout(() => cargar(0), 0);
  };

  const fmtFecha = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" }) +
      " " + d.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });
  };

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (listo && !puedeVer) {
    return (
      <div style={container}>
        <div style={{ ...card, textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontSize: 18, color: "#111827", marginBottom: 6 }}>Acceso restringido</h2>
          <p style={{ fontSize: 14, color: "#64748b" }}>No tienes permiso para ver el registro de auditoría.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={container}>
      <h1 style={title}>🕵️ Auditoría del Sistema</h1>

      {/* ── Filtros ── */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div>
            <label style={labelS}>Usuario</label>
            <select value={fUsuario} onChange={e => setFUsuario(e.target.value)} style={inputS}>
              <option value="">Todos</option>
              {opciones.usuarios.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={labelS}>Módulo</label>
            <select value={fModulo} onChange={e => setFModulo(e.target.value)} style={inputS}>
              <option value="">Todos</option>
              {opciones.modulos.map(m => <option key={m} value={m}>{MODULO_LABEL[m] || m}</option>)}
            </select>
          </div>
          <div>
            <label style={labelS}>Acción</label>
            <select value={fAccion} onChange={e => setFAccion(e.target.value)} style={inputS}>
              <option value="">Todas</option>
              {opciones.acciones.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label style={labelS}>Desde</label>
            <input type="date" value={fDesde} onChange={e => setFDesde(e.target.value)} style={inputS} />
          </div>
          <div>
            <label style={labelS}>Hasta</label>
            <input type="date" value={fHasta} onChange={e => setFHasta(e.target.value)} style={inputS} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={labelS}>Buscar en descripción</label>
            <input type="text" placeholder="Ej: factura, nombre..." value={fBuscar}
              onChange={e => setFBuscar(e.target.value)}
              onKeyDown={e => e.key === "Enter" && cargar(0)}
              style={{ ...inputS, width: "100%" }} />
          </div>
          <button onClick={() => cargar(0)}
            style={{ padding: "9px 20px", background: "#111827", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            🔍 Filtrar
          </button>
          <button onClick={limpiar}
            style={{ padding: "9px 14px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Limpiar
          </button>
        </div>
      </div>

      {/* ── Tabla ── */}
      <div style={card}>
        {error && (
          <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
            ⚠️ {error} — ¿Ya ejecutaste el script <code>sql/log_acciones.sql</code> en Supabase?
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: "#64748b" }}>
            {loading ? "Cargando..." : `${total.toLocaleString("es-DO")} registro${total === 1 ? "" : "s"}`}
          </span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button disabled={pagina === 0} onClick={() => cargar(pagina - 1)}
              style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: pagina === 0 ? "default" : "pointer", opacity: pagina === 0 ? 0.4 : 1, fontSize: 13 }}>
              ← Anterior
            </button>
            <span style={{ fontSize: 12, color: "#64748b" }}>Pág. {pagina + 1} / {totalPaginas}</span>
            <button disabled={pagina + 1 >= totalPaginas} onClick={() => cargar(pagina + 1)}
              style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: pagina + 1 >= totalPaginas ? "default" : "pointer", opacity: pagina + 1 >= totalPaginas ? 0.4 : 1, fontSize: 13 }}>
              Siguiente →
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr>
                {["Fecha", "Usuario", "Acción", "Módulo", "Descripción", ""].map((h, i) => (
                  <th key={i} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && (
                <tr><td colSpan={6} style={{ ...td, textAlign: "center", padding: 40, color: "#94a3b8" }}>
                  Sin registros. Las acciones sensibles (anular facturas, borrar usuarios, cambiar permisos...) aparecerán aquí.
                </td></tr>
              )}
              {items.map(r => {
                const col = ACCION_COLOR[r.accion] || { bg: "#f1f5f9", fg: "#475569" };
                const tieneDetalle = r.detalle && Object.keys(r.detalle).length > 0;
                return (
                  <tr key={r.id}>
                    <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12, color: "#64748b" }}>{fmtFecha(r.created_at)}</td>
                    <td style={{ ...td, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {r.usuario_nombre}
                      {r.usuario_rol && <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>{r.usuario_rol}</div>}
                    </td>
                    <td style={td}>
                      <span style={{ background: col.bg, color: col.fg, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                        {r.accion}
                      </span>
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12 }}>{MODULO_LABEL[r.modulo] || r.modulo}</td>
                    <td style={td}>
                      {r.descripcion || "—"}
                      {detalleAbierto === r.id && tieneDetalle && (
                        <pre style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: 8, fontSize: 11, marginTop: 6, whiteSpace: "pre-wrap", color: "#475569" }}>
                          {JSON.stringify(r.detalle, null, 2)}
                        </pre>
                      )}
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {tieneDetalle && (
                        <button onClick={() => setDetalleAbierto(detalleAbierto === r.id ? null : r.id)}
                          style={{ padding: "3px 10px", background: "#f1f5f9", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#475569" }}>
                          {detalleAbierto === r.id ? "Ocultar" : "Detalle"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
