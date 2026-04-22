"use client";
import { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "";

// ─── Tipos ─────────────────────────────────────────────────────────────────
type Usuario = { nombre: string; rol: string } | null;

type Movimiento = {
  id: number;
  fecha: string;
  descripcion: string;
  monto: number;
  tipo: "INGRESO" | "EGRESO";
  usuario: string;
};

type Cuadre = {
  id: number;
  fecha: string;
  usuario: string;
  efectivo_inicial: number;
  efectivo_final: number;
  ventas_efectivo: number;
  ventas_transferencia: number;
  ventas_tarjeta: number;
  gastos: number;
  diferencia: number;
  creado_en: string;
};

type ReporteCostos = {
  ingresos_totales: number;
  costo_repuestos: number;
  utilidad_bruta: number;
  facturas_count: number;
  ticket_promedio: number;
  por_metodo: { metodo: string; total: number }[];
  top_servicios: { descripcion: string; total: number; count: number }[];
};

// ─── Helpers ───────────────────────────────────────────────────────────────
const fmt = (n: number | string) =>
  "RD$ " + Number(n || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtDatetime = (d: string) =>
  d ? new Date(d).toLocaleString("es-DO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const CATEGORIAS_GASTO = [
  "Limpieza", "Papelería", "Comida / refrigerio", "Transporte",
  "Ferretería", "Electricidad", "Plomería", "Herramientas", "Otro",
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function ContabilidadPage() {
  const [tab, setTab] = useState("cuadre");
  const [usuario, setUsuario] = useState<Usuario>(null);

  useEffect(() => {
    const u = localStorage.getItem("usuario");
    if (u) setUsuario(JSON.parse(u));
  }, []);

  const tabs = [
    { key: "cuadre",  label: "🏦 Cuadre de Caja",      roles: ["gerente", "secretaria"] },
    { key: "chica",   label: "💵 Caja Chica",           roles: ["gerente", "secretaria"] },
    { key: "costos",  label: "📊 Costos y Utilidades",  roles: ["gerente"] },
  ];

  const tabsVisibles = tabs.filter(t => !usuario || t.roles.includes(usuario.rol));

  return (
    <div style={s.page}>
      {/* HEADER */}
      <div style={s.header}>
        <div>
          <h1 style={s.pageTitle}>🧮 Contabilidad</h1>
          <p style={s.pageSubtitle}>SÓLIDO AUTO SERVICIO SRL — Panel financiero</p>
        </div>
        {usuario && (
          <div style={s.userBadge}>
            <div style={s.userDot} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{usuario.nombre}</span>
            <span style={s.rolTag}>{usuario.rol}</span>
          </div>
        )}
      </div>

      {/* TABS */}
      <div style={s.tabBar}>
        {tabsVisibles.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={tab === t.key ? s.tabActive : s.tabInactive}>
            {t.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={s.content}>
        {tab === "cuadre" && <CuadreDeCaja usuario={usuario} />}
        {tab === "chica"  && <CajaChica usuario={usuario} />}
        {tab === "costos" && <CostosUtilidades />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CUADRE DE CAJA
// ═══════════════════════════════════════════════════════════════════════════
function CuadreDeCaja({ usuario }: { usuario: Usuario }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [historial, setHistorial]   = useState<Cuadre[]>([]);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [facturasDia, setFacturasDia] = useState<any>(null);

  const [form, setForm] = useState({
    fecha: hoy,
    efectivo_inicial: "",
    efectivo_final: "",
    ventas_efectivo: "",
    ventas_tarjeta: "",
    ventas_transferencia: "",
    gastos: "",
  });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/contabilidad/cuadre`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setHistorial(Array.isArray(d) ? d : d.cuadres || []);
    } catch { setHistorial([]); }
    setLoading(false);
  }, []);

  // Cargar totales del día desde facturas reales
  const cargarTotalesDia = useCallback(async (fecha: string) => {
    try {
      const r = await fetch(`${API}/facturas`);
      const facturas = await r.json();
      const delDia = facturas.filter((f: any) => {
        const ff = new Date(f.created_at).toISOString().slice(0, 10);
        return ff === fecha && f.estado !== "CANCELADA";
      });
      const totales = {
        efectivo: delDia.filter((f: any) => f.metodo_pago === "EFECTIVO").reduce((a: number, f: any) => a + Number(f.total), 0),
        tarjeta:  delDia.filter((f: any) => f.metodo_pago === "TARJETA").reduce((a: number, f: any) => a + Number(f.total), 0),
        transf:   delDia.filter((f: any) => f.metodo_pago === "TRANSFERENCIA").reduce((a: number, f: any) => a + Number(f.total), 0),
        count:    delDia.length,
      };
      setFacturasDia(totales);
      setForm(prev => ({
        ...prev,
        ventas_efectivo:     String(totales.efectivo),
        ventas_tarjeta:      String(totales.tarjeta),
        ventas_transferencia: String(totales.transf),
      }));
    } catch {}
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { if (showForm) cargarTotalesDia(form.fecha); }, [showForm]);

  const totalIngresos = Number(form.ventas_efectivo || 0) + Number(form.ventas_tarjeta || 0) + Number(form.ventas_transferencia || 0);
  const diferencia    = Number(form.efectivo_final || 0) - Number(form.efectivo_inicial || 0) - Number(form.ventas_efectivo || 0) + Number(form.gastos || 0);

  const guardar = async () => {
    if (!form.efectivo_inicial) return alert("Ingresa el efectivo inicial");
    setSaving(true);
    try {
      await fetch(`${API}/api/contabilidad/cuadre`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          efectivo_inicial:     Number(form.efectivo_inicial),
          efectivo_final:       Number(form.efectivo_final),
          ventas_efectivo:      Number(form.ventas_efectivo),
          ventas_tarjeta:       Number(form.ventas_tarjeta),
          ventas_transferencia: Number(form.ventas_transferencia),
          gastos:               Number(form.gastos),
          diferencia,
          usuario: usuario?.nombre || "Sistema",
        }),
      });
      setShowForm(false);
      setForm({ fecha: hoy, efectivo_inicial: "", efectivo_final: "", ventas_efectivo: "", ventas_tarjeta: "", ventas_transferencia: "", gastos: "" });
      cargar();
    } catch { alert("Error al guardar"); }
    setSaving(false);
  };

  return (
    <div>
      {/* KPI RÁPIDOS del historial */}
      {historial.length > 0 && (() => {
        const ult = historial[0];
        return (
          <div style={s.kpiRow}>
            <KpiCard label="Último cuadre" value={fmtDate(ult.fecha)} icon="📅" color="#6366f1" />
            <KpiCard label="Ventas efectivo" value={fmt(ult.ventas_efectivo)} icon="💵" color="#10b981" />
            <KpiCard label="Ventas tarjeta" value={fmt(ult.ventas_tarjeta)} icon="💳" color="#3b82f6" />
            <KpiCard label="Diferencia" value={fmt(ult.diferencia)} icon="⚖️" color={Number(ult.diferencia) >= 0 ? "#10b981" : "#ef4444"} />
          </div>
        );
      })()}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => setShowForm(!showForm)} style={s.btnPrimary}>
          {showForm ? "✕ Cancelar" : "➕ Nuevo Cuadre"}
        </button>
      </div>

      {showForm && (
        <div style={{ ...s.card, marginBottom: 20, border: "2px solid #6366f1" }}>
          <h3 style={{ ...s.cardTitle, color: "#4338ca" }}>📋 Registrar Cuadre de Caja</h3>

          {facturasDia && (
            <div style={s.infoBanner}>
              <span>📊 Facturas del día: <b>{facturasDia.count}</b> — Totales cargados automáticamente desde el sistema</span>
            </div>
          )}

          <div style={s.formGrid}>
            <FormField label="Fecha">
              <input type="date" value={form.fecha}
                onChange={e => { setForm({ ...form, fecha: e.target.value }); cargarTotalesDia(e.target.value); }}
                style={s.input} />
            </FormField>
            <FormField label="💰 Efectivo inicial (RD$)">
              <input type="number" value={form.efectivo_inicial}
                onChange={e => setForm({ ...form, efectivo_inicial: e.target.value })}
                placeholder="0.00" style={s.input} />
            </FormField>
            <FormField label="💰 Efectivo final físico (RD$)">
              <input type="number" value={form.efectivo_final}
                onChange={e => setForm({ ...form, efectivo_final: e.target.value })}
                placeholder="0.00" style={s.input} />
            </FormField>
            <FormField label="💵 Ventas en efectivo (RD$)">
              <input type="number" value={form.ventas_efectivo}
                onChange={e => setForm({ ...form, ventas_efectivo: e.target.value })}
                placeholder="0.00" style={s.input} />
            </FormField>
            <FormField label="💳 Ventas con tarjeta (RD$)">
              <input type="number" value={form.ventas_tarjeta}
                onChange={e => setForm({ ...form, ventas_tarjeta: e.target.value })}
                placeholder="0.00" style={s.input} />
            </FormField>
            <FormField label="🏦 Ventas por transferencia (RD$)">
              <input type="number" value={form.ventas_transferencia}
                onChange={e => setForm({ ...form, ventas_transferencia: e.target.value })}
                placeholder="0.00" style={s.input} />
            </FormField>
            <FormField label="📉 Gastos del día (RD$)">
              <input type="number" value={form.gastos}
                onChange={e => setForm({ ...form, gastos: e.target.value })}
                placeholder="0.00" style={s.input} />
            </FormField>
          </div>

          {/* Resumen cuadre */}
          <div style={s.resumenBox}>
            <div style={s.resumenRow}><span>Total ingresos del día</span><span style={{ fontWeight: 700 }}>{fmt(totalIngresos)}</span></div>
            <div style={s.resumenRow}><span>Gastos registrados</span><span style={{ color: "#ef4444" }}>− {fmt(form.gastos || 0)}</span></div>
            <div style={{ ...s.resumenRow, borderTop: "2px solid #e2e8f0", paddingTop: 10, marginTop: 4, fontSize: 18, fontWeight: 800 }}>
              <span>Diferencia de caja</span>
              <span style={{ color: diferencia >= 0 ? "#10b981" : "#ef4444" }}>
                {diferencia >= 0 ? "+" : ""}{fmt(diferencia)}
              </span>
            </div>
          </div>

          <button onClick={guardar} disabled={saving} style={{ ...s.btnPrimary, width: "100%", marginTop: 16 }}>
            {saving ? "Guardando..." : "💾 Guardar Cuadre"}
          </button>
        </div>
      )}

      {/* HISTORIAL */}
      <div style={s.card}>
        <h3 style={s.cardTitle}>📋 Historial de Cuadres</h3>
        {loading ? <p style={s.empty}>Cargando...</p> : historial.length === 0 ? (
          <p style={s.empty}>Sin cuadres registrados aún.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {["Fecha", "Responsable", "Ef. Inicial", "Ef. Final", "Ventas Ef.", "Tarjeta", "Transf.", "Gastos", "Diferencia"].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historial.map((c: Cuadre) => (
                  <tr key={c.id}>
                    <td style={s.td}><b>{fmtDate(c.fecha)}</b></td>
                    <td style={s.td}>{c.usuario}</td>
                    <td style={s.td}>{fmt(c.efectivo_inicial)}</td>
                    <td style={s.td}>{fmt(c.efectivo_final)}</td>
                    <td style={s.td}>{fmt(c.ventas_efectivo)}</td>
                    <td style={s.td}>{fmt(c.ventas_tarjeta)}</td>
                    <td style={s.td}>{fmt(c.ventas_transferencia)}</td>
                    <td style={{ ...s.td, color: "#ef4444" }}>{fmt(c.gastos)}</td>
                    <td style={{ ...s.td, fontWeight: 700, color: Number(c.diferencia) >= 0 ? "#10b981" : "#ef4444" }}>
                      {Number(c.diferencia) >= 0 ? "+" : ""}{fmt(c.diferencia)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CAJA CHICA
// ═══════════════════════════════════════════════════════════════════════════
function CajaChica({ usuario }: { usuario: Usuario }) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [fondo, setFondo]             = useState(0);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [showForm, setShowForm]       = useState(false);
  const [filtro, setFiltro]           = useState("TODOS");

  const [form, setForm] = useState({
    descripcion: "",
    monto: "",
    tipo: "EGRESO" as "INGRESO" | "EGRESO",
    categoria: "Otro",
  });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      // Cargar desde tabla caja_chica directamente
      const r = await fetch(`${API}/api/contabilidad/caja-chica`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      const movs: Movimiento[] = Array.isArray(d) ? d : d.movimientos || [];
      setMovimientos(movs);
      // Calcular fondo: ingresos - egresos
      const fondoCalc = movs.reduce((acc, m) => m.tipo === "INGRESO" ? acc + Number(m.monto) : acc - Number(m.monto), 0);
      setFondo(d.fondo_actual ?? fondoCalc);
    } catch { setMovimientos([]); setFondo(0); }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    if (!form.descripcion || !form.monto) return alert("Completa todos los campos");
    if (form.tipo === "EGRESO" && Number(form.monto) > fondo) return alert("Fondos insuficientes en caja chica");
    setSaving(true);
    try {
      await fetch(`${API}/api/contabilidad/caja-chica`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion: `[${form.categoria}] ${form.descripcion}`,
          monto: Number(form.monto),
          tipo: form.tipo,
          usuario: usuario?.nombre || "Sistema",
        }),
      });
      setShowForm(false);
      setForm({ descripcion: "", monto: "", tipo: "EGRESO", categoria: "Otro" });
      cargar();
    } catch { alert("Error al guardar"); }
    setSaving(false);
  };

  const movsFiltrados = movimientos.filter(m => filtro === "TODOS" || m.tipo === filtro);
  const totalIngresos = movimientos.filter(m => m.tipo === "INGRESO").reduce((a, m) => a + Number(m.monto), 0);
  const totalEgresos  = movimientos.filter(m => m.tipo === "EGRESO").reduce((a, m) => a + Number(m.monto), 0);

  return (
    <div>
      {/* KPIs */}
      <div style={s.kpiRow}>
        <KpiCard label="Saldo actual" value={fmt(fondo)} icon="🏦" color={fondo >= 0 ? "#10b981" : "#ef4444"} big />
        <KpiCard label="Total ingresos" value={fmt(totalIngresos)} icon="⬆️" color="#10b981" />
        <KpiCard label="Total egresos"  value={fmt(totalEgresos)}  icon="⬇️" color="#ef4444" />
        <KpiCard label="Movimientos"    value={String(movimientos.length)} icon="📋" color="#6366f1" />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["TODOS", "INGRESO", "EGRESO"].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={filtro === f ? s.tabActive : s.tabInactive}>
              {f === "TODOS" ? "📋 Todos" : f === "INGRESO" ? "⬆️ Ingresos" : "⬇️ Egresos"}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(!showForm)} style={s.btnPrimary}>
          {showForm ? "✕ Cancelar" : "➕ Registrar Movimiento"}
        </button>
      </div>

      {showForm && (
        <div style={{ ...s.card, marginBottom: 20, border: "2px solid #10b981" }}>
          <h3 style={{ ...s.cardTitle, color: "#065f46" }}>💵 Nuevo Movimiento de Caja Chica</h3>
          <div style={s.formGrid}>
            <FormField label="Tipo de movimiento">
              <div style={{ display: "flex", gap: 8 }}>
                {(["INGRESO", "EGRESO"] as const).map(t => (
                  <button key={t} onClick={() => setForm({ ...form, tipo: t })}
                    style={{ ...s.tabInactive, flex: 1, ...(form.tipo === t ? { background: t === "INGRESO" ? "#10b981" : "#ef4444", color: "#fff", borderColor: "transparent" } : {}) }}>
                    {t === "INGRESO" ? "⬆️ Ingreso" : "⬇️ Egreso"}
                  </button>
                ))}
              </div>
            </FormField>
            <FormField label="Categoría">
              <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} style={s.input}>
                {CATEGORIAS_GASTO.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Descripción">
              <input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Ej: Compra de papel de impresora" style={s.input} />
            </FormField>
            <FormField label="Monto (RD$)">
              <input type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })}
                placeholder="0.00" style={s.input} />
            </FormField>
          </div>
          <button onClick={guardar} disabled={saving} style={{ ...s.btnPrimary, width: "100%", marginTop: 8 }}>
            {saving ? "Guardando..." : "💾 Registrar"}
          </button>
        </div>
      )}

      {/* TABLA */}
      <div style={s.card}>
        <h3 style={s.cardTitle}>📋 Movimientos ({movsFiltrados.length})</h3>
        {loading ? <p style={s.empty}>Cargando...</p> : movsFiltrados.length === 0 ? (
          <p style={s.empty}>Sin movimientos registrados.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {["#", "Fecha", "Descripción", "Usuario", "Tipo", "Monto"].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movsFiltrados.map((m: Movimiento) => (
                  <tr key={m.id}>
                    <td style={{ ...s.td, color: "#888" }}>{m.id}</td>
                    <td style={s.td}>{fmtDatetime(m.fecha)}</td>
                    <td style={s.td}>{m.descripcion}</td>
                    <td style={s.td}>{m.usuario}</td>
                    <td style={s.td}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: m.tipo === "INGRESO" ? "#dcfce7" : "#fee2e2",
                        color:      m.tipo === "INGRESO" ? "#166534"  : "#dc2626",
                      }}>{m.tipo}</span>
                    </td>
                    <td style={{ ...s.td, fontWeight: 700, color: m.tipo === "INGRESO" ? "#10b981" : "#ef4444" }}>
                      {m.tipo === "INGRESO" ? "+" : "−"}{fmt(m.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COSTOS Y UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════
function CostosUtilidades() {
  const [reporte, setReporte]   = useState<ReporteCostos | null>(null);
  const [loading, setLoading]   = useState(false);
  const [periodo, setPeriodo]   = useState("mes");
  const [fechaDesde, setDesde]  = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [fechaHasta, setHasta]  = useState(new Date().toISOString().slice(0, 10));

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      // Cargar facturas y calcular reporte localmente si el endpoint no existe
      const r = await fetch(`${API}/facturas`);
      const facturas: any[] = await r.json() || [];

      // Filtrar por periodo
      const filtradas = facturas.filter(f => {
        if (f.estado === "CANCELADA") return false;
        const ff = f.created_at?.slice(0, 10);
        return ff >= fechaDesde && ff <= fechaHasta;
      });

      const ingresos_totales = filtradas.reduce((a, f) => a + Number(f.total), 0);
      const itbis_total      = filtradas.reduce((a, f) => a + Number(f.itbis || 0), 0);
      const subtotal_total   = filtradas.reduce((a, f) => a + Number(f.subtotal || 0), 0);

      // Agrupado por método de pago
      const metodos: Record<string, number> = {};
      filtradas.forEach(f => {
        const m = f.metodo_pago || "EFECTIVO";
        metodos[m] = (metodos[m] || 0) + Number(f.total);
      });

      setReporte({
        ingresos_totales,
        costo_repuestos: 0, // requeriría JOIN con compras
        utilidad_bruta: subtotal_total,
        facturas_count: filtradas.length,
        ticket_promedio: filtradas.length ? ingresos_totales / filtradas.length : 0,
        por_metodo: Object.entries(metodos).map(([metodo, total]) => ({ metodo, total })),
        top_servicios: [],
      });
    } catch { setReporte(null); }
    setLoading(false);
  }, [fechaDesde, fechaHasta]);

  // Cambio de periodo rápido
  const cambiarPeriodo = (p: string) => {
    setPeriodo(p);
    const hoy = new Date();
    if (p === "hoy") {
      const d = hoy.toISOString().slice(0, 10);
      setDesde(d); setHasta(d);
    } else if (p === "semana") {
      const ini = new Date(hoy); ini.setDate(hoy.getDate() - 7);
      setDesde(ini.toISOString().slice(0, 10)); setHasta(hoy.toISOString().slice(0, 10));
    } else if (p === "mes") {
      const ini = new Date(hoy); ini.setDate(1);
      setDesde(ini.toISOString().slice(0, 10)); setHasta(hoy.toISOString().slice(0, 10));
    } else if (p === "año") {
      const ini = new Date(hoy.getFullYear(), 0, 1);
      setDesde(ini.toISOString().slice(0, 10)); setHasta(hoy.toISOString().slice(0, 10));
    }
  };

  useEffect(() => { cargar(); }, [cargar]);

  const margenPct = reporte && reporte.ingresos_totales > 0
    ? ((reporte.utilidad_bruta / reporte.ingresos_totales) * 100).toFixed(1)
    : "0.0";

  return (
    <div>
      {/* Filtros de periodo */}
      <div style={{ ...s.card, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#555", marginRight: 4 }}>Período:</span>
          {[
            { key: "hoy", label: "Hoy" },
            { key: "semana", label: "Esta semana" },
            { key: "mes", label: "Este mes" },
            { key: "año", label: "Este año" },
            { key: "custom", label: "Personalizado" },
          ].map(p => (
            <button key={p.key} onClick={() => cambiarPeriodo(p.key)}
              style={periodo === p.key ? s.tabActive : s.tabInactive}>
              {p.label}
            </button>
          ))}
          {periodo === "custom" && (
            <>
              <input type="date" value={fechaDesde} onChange={e => setDesde(e.target.value)}
                style={{ ...s.input, width: 150, marginBottom: 0 }} />
              <span style={{ fontSize: 13 }}>—</span>
              <input type="date" value={fechaHasta} onChange={e => setHasta(e.target.value)}
                style={{ ...s.input, width: 150, marginBottom: 0 }} />
              <button onClick={cargar} style={s.btnPrimary}>Aplicar</button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <p style={s.empty}>Cargando reporte...</p>
      ) : reporte ? (
        <>
          {/* KPIs principales */}
          <div style={s.kpiRow}>
            <KpiCard label="Ingresos totales"  value={fmt(reporte.ingresos_totales)} icon="💰" color="#10b981" big />
            <KpiCard label="Subtotal (sin ITBIS)" value={fmt(reporte.utilidad_bruta)} icon="📈" color="#6366f1" />
            <KpiCard label="Facturas emitidas" value={String(reporte.facturas_count)} icon="🧾" color="#3b82f6" />
            <KpiCard label="Ticket promedio"   value={fmt(reporte.ticket_promedio)}  icon="🎫" color="#f59e0b" />
          </div>

          {/* Margen visual */}
          <div style={{ ...s.card, marginBottom: 20 }}>
            <h3 style={s.cardTitle}>📊 Margen sobre ingresos</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 14, color: "#555" }}>Subtotal (sin ITBIS) vs Ingresos totales</span>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{margenPct}%</span>
                </div>
                <div style={{ height: 14, background: "#f1f5f9", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${margenPct}%`, background: "linear-gradient(90deg, #6366f1, #10b981)", borderRadius: 8, transition: "width .6s ease" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Por método de pago */}
          <div style={{ ...s.card, marginBottom: 20 }}>
            <h3 style={s.cardTitle}>💳 Ingresos por método de pago</h3>
            {reporte.por_metodo.length === 0 ? (
              <p style={s.empty}>Sin datos en el período.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {reporte.por_metodo.map(({ metodo, total }) => {
                  const pct = reporte.ingresos_totales > 0 ? (total / reporte.ingresos_totales * 100).toFixed(0) : 0;
                  const icons: Record<string, string> = { EFECTIVO: "💵", TARJETA: "💳", TRANSFERENCIA: "🏦", CHEQUE: "📄" };
                  return (
                    <div key={metodo} style={{ background: "#f8fafc", borderRadius: 12, padding: "16px 18px", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: 22, marginBottom: 6 }}>{icons[metodo] || "💰"}</div>
                      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 2 }}>{fmt(total)}</div>
                      <div style={{ fontSize: 12, color: "#888" }}>{metodo} · {pct}%</div>
                      <div style={{ height: 4, background: "#e2e8f0", borderRadius: 4, marginTop: 8, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: "#6366f1", borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resumen contable */}
          <div style={s.card}>
            <h3 style={s.cardTitle}>📑 Resumen Contable del Período</h3>
            <div style={{ maxWidth: 420 }}>
              <div style={s.resumenRow}><span>Ingresos totales (con ITBIS)</span><span style={{ fontWeight: 700, color: "#10b981" }}>{fmt(reporte.ingresos_totales)}</span></div>
              <div style={s.resumenRow}><span>ITBIS incluido en ventas (18%)</span><span style={{ color: "#6366f1" }}>{fmt(reporte.ingresos_totales - reporte.utilidad_bruta)}</span></div>
              <div style={{ ...s.resumenRow, borderTop: "2px solid #e2e8f0", paddingTop: 10, marginTop: 4, fontWeight: 800, fontSize: 16 }}>
                <span>Subtotal sin ITBIS</span>
                <span style={{ color: "#111" }}>{fmt(reporte.utilidad_bruta)}</span>
              </div>
              <p style={{ fontSize: 11, color: "#aaa", marginTop: 8 }}>
                * Para ver costos de repuestos y utilidad neta, conecta el módulo de compras de inventario.
              </p>
            </div>
          </div>
        </>
      ) : (
        <p style={s.empty}>No se pudo cargar el reporte.</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTES
// ═══════════════════════════════════════════════════════════════════════════
function KpiCard({ label, value, icon, color, big }: { label: string; value: string; icon: string; color: string; big?: boolean }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", boxShadow: "0 2px 12px rgba(0,0,0,.07)", border: "1px solid #f0f0f0", flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: big ? 22 : 18, fontWeight: 800, color, marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#888" }}>{label}</div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════════════════════
const s: Record<string, React.CSSProperties> = {
  page:         { padding: "24px 28px", background: "#f5f7fb", minHeight: "100vh" },
  header:       { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  pageTitle:    { fontSize: 26, fontWeight: 900, color: "#111827", margin: 0 },
  pageSubtitle: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  userBadge:    { display: "flex", alignItems: "center", gap: 8, background: "#fff", padding: "8px 14px", borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,.07)" },
  userDot:      { width: 8, height: 8, borderRadius: "50%", background: "#10b981" },
  rolTag:       { fontSize: 11, background: "#f1f5f9", padding: "2px 8px", borderRadius: 20, color: "#555", fontWeight: 600 },
  tabBar:       { display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" as const },
  tabActive:    { padding: "10px 20px", borderRadius: 10, border: "none", background: "#111827", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14 },
  tabInactive:  { padding: "10px 20px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#374151", cursor: "pointer", fontWeight: 600, fontSize: 14 },
  content:      { },
  card:         { background: "#fff", padding: 22, borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,.07)", marginBottom: 20 },
  cardTitle:    { fontSize: 17, fontWeight: 700, marginBottom: 16, color: "#111827" },
  kpiRow:       { display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" as const },
  formGrid:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" },
  label:        { display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 5 },
  input:        { display: "block", padding: "11px 14px", width: "100%", borderRadius: 9, border: "1px solid #e2e8f0", fontSize: 14, marginBottom: 14, boxSizing: "border-box" as const, background: "#fafafa" },
  resumenBox:   { background: "#f8fafc", borderRadius: 12, padding: "14px 18px", marginTop: 12 },
  resumenRow:   { display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 15, borderBottom: "1px solid #f0f0f0" },
  infoBanner:   { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 9, padding: "9px 14px", fontSize: 13, color: "#1e40af", marginBottom: 14 },
  btnPrimary:   { padding: "11px 22px", background: "#111827", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 14 },
  empty:        { color: "#aaa", textAlign: "center" as const, padding: "32px 0", fontStyle: "italic" },
  table:        { width: "100%", borderCollapse: "collapse" as const },
  th:           { textAlign: "left" as const, padding: "10px 14px", background: "#f8fafc", fontSize: 12, fontWeight: 700, color: "#555", whiteSpace: "nowrap" as const, borderBottom: "2px solid #e2e8f0" },
  td:           { padding: "11px 14px", borderBottom: "1px solid #f0f0f0", fontSize: 13 },
};
