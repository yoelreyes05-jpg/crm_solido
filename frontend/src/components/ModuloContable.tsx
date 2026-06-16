"use client";
import { useEffect, useState, useCallback } from "react";
import { API_URL as API } from "@/config";

/**
 * Modulo contable reutilizable e INDEPENDIENTE por area.
 * Usa endpoints en `${API}${apiBase}/...` y tablas propias del modulo.
 * Se usa en Cafeteria (tema oscuro) y Capacitacion (tema claro).
 */

type Theme = "dark" | "light";
interface Props {
  apiBase: string;          // ej: "/cafeteria/contabilidad"
  theme?: Theme;
  titulo?: string;
  usuario?: string;
  nombreEntidad?: string;   // "cliente" o "alumno/empresa"
  nombreSuplidor?: string;  // "suplidor"
}

const CATEGORIAS = ["Suministros", "Limpieza", "Mantenimiento", "Servicios", "Transporte", "Otro"];
const METODOS = ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "CHEQUE"];

const fmt = (n: any) =>
  "RD$ " + Number(n || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Fechas en zona RD (UTC-4 fijo). Naive = hora local RD; con Z/offset = instante real.
const _fechaRD = (d: string): Date | null => {
  if (!d) return null;
  const s = String(d).trim();
  const hasTz = /[zZ]$|[+\-]\d{2}:?\d{2}$/.test(s);
  if (hasTz) { const i = new Date(s); return isNaN(i.getTime()) ? null : new Date(i.getTime() - 4 * 3600 * 1000); }
  const norm = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00Z` : `${s.replace(" ", "T")}Z`;
  const dt = new Date(norm); return isNaN(dt.getTime()) ? null : dt;
};
const fmtFecha = (d: string) => {
  const x = _fechaRD(d);
  return x ? x.toLocaleDateString("es-DO", { day: "numeric", month: "numeric", year: "2-digit", timeZone: "UTC" }) : "—";
};
const fmtFechaHora = (d: string) => {
  const x = _fechaRD(d);
  return x ? x.toLocaleString("es-DO", { day: "numeric", month: "numeric", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) : "—";
};
const hoyRD = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" });

function pal(theme: Theme) {
  if (theme === "dark") {
    return {
      bg: "transparent", card: "#1e293b", cardBorder: "#334155",
      text: "#f1f5f9", sub: "#94a3b8", inputBg: "#0f172a", inputBorder: "#334155",
      tabActive: "#3b82f6", tabBg: "#334155", tabText: "#94a3b8",
      th: "#0f172a", thText: "#94a3b8", rowBorder: "#334155",
      green: "#10b981", red: "#ef4444", amber: "#f59e0b", blue: "#3b82f6",
    };
  }
  return {
    bg: "transparent", card: "#ffffff", cardBorder: "#e5e7eb",
    text: "#111827", sub: "#6b7280", inputBg: "#fafafa", inputBorder: "#e2e8f0",
    tabActive: "#6366f1", tabBg: "#f1f5f9", tabText: "#475569",
    th: "#f8fafc", thText: "#64748b", rowBorder: "#eef2f7",
    green: "#10b981", red: "#ef4444", amber: "#f59e0b", blue: "#3b82f6",
  };
}

export default function ModuloContable({
  apiBase, theme = "light", titulo = "Contabilidad", usuario = "Sistema",
  nombreEntidad = "Cliente", nombreSuplidor = "Suplidor",
}: Props) {
  const P = pal(theme);
  const [sub, setSub] = useState<"cuadre" | "chica" | "cobrar" | "pagar" | "resumen">("cuadre");

  const TABS = [
    { k: "cuadre", label: "🏦 Cuadre de Caja" },
    { k: "chica", label: "💵 Caja Chica" },
    { k: "cobrar", label: "💳 Cuentas x Cobrar" },
    { k: "pagar", label: "📤 Cuentas x Pagar" },
    { k: "resumen", label: "📊 Resumen" },
  ] as const;

  const S = {
    card: { background: P.card, border: `1px solid ${P.cardBorder}`, borderRadius: 14, padding: 20, marginBottom: 16 } as const,
    input: { display: "block", padding: "10px 12px", width: "100%", borderRadius: 9, border: `1px solid ${P.inputBorder}`, fontSize: 14, background: P.inputBg, color: P.text, boxSizing: "border-box" } as const,
    th: { textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: P.thText, background: P.th, textTransform: "uppercase", letterSpacing: 0.4 } as const,
    td: { padding: "10px 12px", fontSize: 13, color: P.text, borderBottom: `1px solid ${P.rowBorder}` } as const,
    btn: { padding: "10px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: P.blue, color: "#fff" } as const,
    btnGhost: { padding: "7px 12px", borderRadius: 8, border: `1px solid ${P.inputBorder}`, cursor: "pointer", fontWeight: 700, fontSize: 12, background: "transparent", color: P.text } as const,
  };

  return (
    <div style={{ background: P.bg, color: P.text }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>🧾 {titulo}</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setSub(t.k as any)} style={{
            padding: "8px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
            background: sub === t.k ? P.tabActive : P.tabBg, color: sub === t.k ? "#fff" : P.tabText,
          }}>{t.label}</button>
        ))}
      </div>

      {sub === "cuadre" && <Cuadre apiBase={apiBase} usuario={usuario} P={P} S={S} />}
      {sub === "chica" && <CajaChica apiBase={apiBase} usuario={usuario} P={P} S={S} />}
      {sub === "cobrar" && <Cuentas apiBase={apiBase} sufijo="cuentas-cobrar" campoNombre="cliente_nombre" etiquetaNombre={nombreEntidad} usuario={usuario} P={P} S={S} color={P.green} />}
      {sub === "pagar" && <Cuentas apiBase={apiBase} sufijo="cuentas-pagar" campoNombre="suplidor_nombre" etiquetaNombre={nombreSuplidor} usuario={usuario} P={P} S={S} color={P.amber} />}
      {sub === "resumen" && <Resumen apiBase={apiBase} P={P} S={S} />}
    </div>
  );
}

function Kpi({ label, value, color, P }: any) {
  return (
    <div style={{ flex: 1, minWidth: 150, background: P.card, border: `1px solid ${P.cardBorder}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 12, color: P.sub, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || P.text }}>{value}</div>
    </div>
  );
}

// ════════════════════════ CUADRE DE CAJA ════════════════════════
function Cuadre({ apiBase, usuario, P, S }: any) {
  const [fecha, setFecha] = useState(hoyRD());
  const [prev, setPrev] = useState<any>(null);
  const [contado, setContado] = useState("");
  const [notas, setNotas] = useState("");
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hist, setHist] = useState<any[]>([]);

  const cargarHist = useCallback(async () => {
    try { const d = await fetch(`${API}${apiBase}/cuadre`).then(r => r.json()); setHist(d.cuadres || []); }
    catch { setHist([]); }
  }, [apiBase]);
  useEffect(() => { cargarHist(); }, [cargarHist]);

  const generar = async (f: string) => {
    setFetching(true); setPrev(null);
    try {
      const d = await fetch(`${API}${apiBase}/cuadre/auto?fecha=${f}`).then(r => r.json());
      setPrev(d); setContado(String(d.efectivo_esperado ?? ""));
    } catch { alert("No se pudo calcular el cuadre"); }
    setFetching(false);
  };

  const guardar = async () => {
    if (!prev) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}${apiBase}/cuadre`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...prev, efectivo_contado: Number(contado || 0), notas, usuario }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); alert(e.error || "No se pudo guardar"); setSaving(false); return; }
      setPrev(null); setContado(""); setNotas("");
      cargarHist();
      alert("Cuadre guardado ✓");
    } catch { alert("Error al guardar el cuadre"); }
    setSaving(false);
  };

  const diferencia = prev ? Number(contado || 0) - Number(prev.efectivo_esperado || 0) : 0;
  const fila = (l: string, v: any, c?: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 4px", borderBottom: `1px solid ${P.rowBorder}` }}>
      <span style={{ color: P.sub, fontSize: 14 }}>{l}</span>
      <span style={{ fontWeight: 700, color: c || P.text }}>{v}</span>
    </div>
  );

  return (
    <div>
      <div style={{ ...S.card, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: P.sub, marginBottom: 4 }}>Fecha del cuadre</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...S.input, width: 180 }} />
        </div>
        <button onClick={() => generar(fecha)} disabled={fetching} style={S.btn}>{fetching ? "Calculando..." : "🔄 Generar cuadre"}</button>
      </div>

      {prev && (
        <div style={S.card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>📋 Cuadre del {prev.fecha}</h3>
          <p style={{ fontSize: 12, color: P.sub, marginBottom: 14 }}>{prev.movimientos_count} movimiento(s) de caja chica en el día</p>
          {fila("Fondo inicial (cierre día anterior)", fmt(prev.fondo_inicial))}
          {fila("+ Ingresos de caja chica (efectivo)", fmt(prev.ingresos_caja), P.green)}
          {fila("+ Cobros en efectivo", fmt(prev.cobros_efectivo), P.green)}
          {fila("− Egresos / gastos de caja chica", fmt(prev.egresos_caja), P.red)}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 4px", background: theme_safe(P), borderRadius: 8, marginTop: 6 }}>
            <span style={{ fontWeight: 800 }}>= Efectivo esperado en caja</span>
            <span style={{ fontWeight: 800, color: P.blue }}>{fmt(prev.efectivo_esperado)}</span>
          </div>

          {(Number(prev.cobros_tarjeta) > 0 || Number(prev.cobros_transferencia) > 0) && (
            <div style={{ marginTop: 12 }}>
              {fila("Cobros con tarjeta (no efectivo)", fmt(prev.cobros_tarjeta), P.sub)}
              {fila("Cobros por transferencia (no efectivo)", fmt(prev.cobros_transferencia), P.sub)}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 18px", marginTop: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: P.sub }}>💵 Efectivo contado (físico)</label>
              <input type="number" value={contado} onChange={e => setContado(e.target.value)} style={{ ...S.input, marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: P.sub }}>Diferencia</label>
              <div style={{ ...S.input, marginTop: 4, fontWeight: 800, color: Math.abs(diferencia) < 0.01 ? P.green : P.red, background: "transparent" }}>
                {fmt(diferencia)} {Math.abs(diferencia) < 0.01 ? "✓ Cuadra" : (diferencia > 0 ? "▲ Sobrante" : "▼ Faltante")}
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: P.sub }}>📝 Notas (opcional)</label>
              <input value={notas} onChange={e => setNotas(e.target.value)} style={{ ...S.input, marginTop: 4 }} />
            </div>
          </div>
          <button onClick={guardar} disabled={saving} style={{ ...S.btn, width: "100%", marginTop: 14, background: P.green }}>{saving ? "Guardando..." : "💾 Confirmar y guardar cuadre"}</button>
        </div>
      )}

      <div style={S.card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📋 Historial de cuadres</h3>
        {hist.length === 0 ? <p style={{ color: P.sub, textAlign: "center", padding: 20 }}>Sin cuadres registrados.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Fecha", "Fondo inic.", "Ingresos", "Egresos", "Cobros efvo.", "Esperado", "Contado", "Diferencia"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {hist.map(c => {
                  const dif = Number(c.diferencia || 0);
                  return (
                    <tr key={c.id}>
                      <td style={{ ...S.td, fontWeight: 700 }}>{fmtFecha(c.fecha)}</td>
                      <td style={S.td}>{fmt(c.fondo_inicial)}</td>
                      <td style={{ ...S.td, color: P.green }}>{fmt(c.ingresos_caja)}</td>
                      <td style={{ ...S.td, color: P.red }}>{fmt(c.egresos_caja)}</td>
                      <td style={S.td}>{fmt(c.cobros_efectivo)}</td>
                      <td style={{ ...S.td, fontWeight: 700 }}>{fmt(c.efectivo_esperado)}</td>
                      <td style={S.td}>{fmt(c.efectivo_contado)}</td>
                      <td style={{ ...S.td, fontWeight: 700, color: Math.abs(dif) < 0.01 ? P.green : P.red }}>{fmt(dif)}</td>
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

function theme_safe(P: any) { return P.card === "#1e293b" ? "#0f172a" : "#f8fafc"; }

// ════════════════════════ CAJA CHICA ════════════════════════
function CajaChica({ apiBase, usuario, P, S }: any) {
  const [movs, setMovs] = useState<any[]>([]);
  const [fondo, setFondo] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filtro, setFiltro] = useState("TODOS");
  const [form, setForm] = useState({ descripcion: "", monto: "", tipo: "EGRESO", categoria: "Otro" });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}${apiBase}/caja-chica`);
      const d = await r.json();
      const m = d.movimientos || [];
      setMovs(m);
      setFondo(d.fondo_actual ?? m.reduce((a: number, x: any) => x.tipo === "INGRESO" ? a + Number(x.monto) : a - Number(x.monto), 0));
    } catch { setMovs([]); setFondo(0); }
    setLoading(false);
  }, [apiBase]);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    if (!form.descripcion || !form.monto) return alert("Completa descripción y monto");
    if (form.tipo === "EGRESO" && Number(form.monto) > fondo) return alert("Fondos insuficientes en caja chica");
    setSaving(true);
    try {
      const r = await fetch(`${API}${apiBase}/caja-chica`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion: `[${form.categoria}] ${form.descripcion}`,
          monto: Number(form.monto), tipo: form.tipo, categoria: form.categoria, usuario,
        }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); alert(e.error || "No se pudo registrar"); setSaving(false); return; }
      setShowForm(false);
      setForm({ descripcion: "", monto: "", tipo: "EGRESO", categoria: "Otro" });
      cargar();
    } catch { alert("Error al guardar"); }
    setSaving(false);
  };

  const eliminar = async (id: number) => {
    if (!confirm("¿Eliminar este movimiento?")) return;
    await fetch(`${API}${apiBase}/caja-chica/${id}`, { method: "DELETE" });
    cargar();
  };

  const lista = movs.filter(m => filtro === "TODOS" || m.tipo === filtro);
  const ingresos = movs.filter(m => m.tipo === "INGRESO").reduce((a, m) => a + Number(m.monto), 0);
  const egresos = movs.filter(m => m.tipo === "EGRESO").reduce((a, m) => a + Number(m.monto), 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Kpi label="Saldo actual" value={fmt(fondo)} color={fondo >= 0 ? P.green : P.red} P={P} />
        <Kpi label="Total ingresos" value={fmt(ingresos)} color={P.green} P={P} />
        <Kpi label="Total egresos" value={fmt(egresos)} color={P.red} P={P} />
        <Kpi label="Movimientos" value={String(movs.length)} color={P.blue} P={P} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["TODOS", "INGRESO", "EGRESO"].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{
              padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12,
              background: filtro === f ? P.tabActive : P.tabBg, color: filtro === f ? "#fff" : P.tabText,
            }}>{f === "TODOS" ? "📋 Todos" : f === "INGRESO" ? "⬆️ Ingresos" : "⬇️ Egresos"}</button>
          ))}
        </div>
        <button onClick={() => setShowForm(!showForm)} style={S.btn}>{showForm ? "✕ Cancelar" : "➕ Registrar Movimiento"}</button>
      </div>

      {showForm && (
        <div style={{ ...S.card, border: `2px solid ${P.green}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 18px" }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: P.sub }}>Tipo</label>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                {["INGRESO", "EGRESO"].map(t => (
                  <button key={t} onClick={() => setForm({ ...form, tipo: t })} style={{
                    flex: 1, padding: "9px", borderRadius: 8, border: `1px solid ${P.inputBorder}`, cursor: "pointer", fontWeight: 700, fontSize: 12,
                    background: form.tipo === t ? (t === "INGRESO" ? P.green : P.red) : "transparent",
                    color: form.tipo === t ? "#fff" : P.text,
                  }}>{t === "INGRESO" ? "⬆️ Ingreso" : "⬇️ Egreso"}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: P.sub }}>Categoría</label>
              <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} style={{ ...S.input, marginTop: 4 }}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: P.sub }}>Descripción</label>
              <input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Ej: compra de vasos" style={{ ...S.input, marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: P.sub }}>Monto (RD$)</label>
              <input type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} placeholder="0.00" style={{ ...S.input, marginTop: 4 }} />
            </div>
          </div>
          <button onClick={guardar} disabled={saving} style={{ ...S.btn, width: "100%", marginTop: 12, background: P.green }}>{saving ? "Guardando..." : "💾 Registrar"}</button>
        </div>
      )}

      <div style={S.card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📋 Movimientos ({lista.length})</h3>
        {loading ? <p style={{ color: P.sub, textAlign: "center", padding: 20 }}>Cargando...</p> :
          lista.length === 0 ? <p style={{ color: P.sub, textAlign: "center", padding: 20 }}>Sin movimientos.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["#", "Fecha", "Descripción", "Usuario", "Tipo", "Monto", ""].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {lista.map(m => (
                    <tr key={m.id}>
                      <td style={{ ...S.td, color: P.sub }}>{m.id}</td>
                      <td style={S.td}>{fmtFechaHora(m.fecha)}</td>
                      <td style={S.td}>{m.descripcion}</td>
                      <td style={S.td}>{m.usuario}</td>
                      <td style={S.td}><span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: m.tipo === "INGRESO" ? "#dcfce7" : "#fee2e2", color: m.tipo === "INGRESO" ? "#166534" : "#dc2626" }}>{m.tipo}</span></td>
                      <td style={{ ...S.td, fontWeight: 700, color: m.tipo === "INGRESO" ? P.green : P.red }}>{m.tipo === "INGRESO" ? "+" : "−"}{fmt(m.monto)}</td>
                      <td style={S.td}><button onClick={() => eliminar(m.id)} style={{ ...S.btnGhost, color: P.red, padding: "4px 8px" }}>🗑️</button></td>
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

// ════════════════════════ CUENTAS (cobrar / pagar) ════════════════════════
function Cuentas({ apiBase, sufijo, campoNombre, etiquetaNombre, usuario, P, S, color }: any) {
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ nombre: "", descripcion: "", monto_original: "", fecha_vencimiento: "", notas: "" });
  const [modalPago, setModalPago] = useState<any>(null);
  const [pago, setPago] = useState<any>({ monto: "", metodo: "EFECTIVO", fecha: hoyRD(), referencia: "", notas: "" });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}${apiBase}/${sufijo}`);
      const d = await r.json();
      setCuentas(d.cuentas || []);
    } catch { setCuentas([]); }
    setLoading(false);
  }, [apiBase, sufijo]);
  useEffect(() => { cargar(); }, [cargar]);

  const crear = async () => {
    if (!form.descripcion || !form.monto_original || !form.fecha_vencimiento)
      return alert("Descripción, monto y fecha de vencimiento son requeridos");
    setSaving(true);
    try {
      const body: any = {
        descripcion: form.descripcion, monto_original: Number(form.monto_original),
        fecha_vencimiento: form.fecha_vencimiento, notas: form.notas, created_by: usuario,
      };
      body[campoNombre] = form.nombre || null;
      const r = await fetch(`${API}${apiBase}/${sufijo}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); alert(e.error || "No se pudo crear"); setSaving(false); return; }
      setShowForm(false);
      setForm({ nombre: "", descripcion: "", monto_original: "", fecha_vencimiento: "", notas: "" });
      cargar();
    } catch { alert("Error al crear"); }
    setSaving(false);
  };

  const registrarPago = async () => {
    if (!pago.monto || Number(pago.monto) <= 0) return alert("Monto inválido");
    try {
      const r = await fetch(`${API}${apiBase}/${sufijo}/${modalPago.id}/pago`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pago, monto: Number(pago.monto), usuario }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); alert(e.error || "No se pudo registrar el pago"); return; }
      setModalPago(null);
      setPago({ monto: "", metodo: "EFECTIVO", fecha: hoyRD(), referencia: "", notas: "" });
      cargar();
    } catch { alert("Error al registrar pago"); }
  };

  const eliminar = async (id: number) => {
    if (!confirm("¿Eliminar esta cuenta y sus pagos?")) return;
    await fetch(`${API}${apiBase}/${sufijo}/${id}`, { method: "DELETE" });
    cargar();
  };

  const totalPendiente = cuentas.filter(c => c.estado !== "PAGADO" && c.estado !== "ANULADO").reduce((a, c) => a + Number(c.saldo || 0), 0);
  const totalCobrado = cuentas.reduce((a, c) => a + Number(c.monto_pagado || 0), 0);
  const vencidas = cuentas.filter(c => c.vencida).length;
  const esCobrar = sufijo === "cuentas-cobrar";

  const estadoChip = (c: any) => {
    const map: any = {
      PENDIENTE: { bg: "#fef9c3", fg: "#854d0e" }, PARCIAL: { bg: "#dbeafe", fg: "#1d4ed8" },
      PAGADO: { bg: "#dcfce7", fg: "#166534" }, ANULADO: { bg: "#e5e7eb", fg: "#6b7280" },
    };
    const st = c.vencida && c.estado !== "PAGADO" ? { bg: "#fee2e2", fg: "#dc2626" } : (map[c.estado] || map.PENDIENTE);
    const label = c.vencida && c.estado !== "PAGADO" ? "VENCIDA" : c.estado;
    return <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.fg }}>{label}</span>;
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Kpi label={esCobrar ? "Por cobrar" : "Por pagar"} value={fmt(totalPendiente)} color={color} P={P} />
        <Kpi label={esCobrar ? "Total cobrado" : "Total pagado"} value={fmt(totalCobrado)} color={P.green} P={P} />
        <Kpi label="Cuentas vencidas" value={String(vencidas)} color={P.red} P={P} />
        <Kpi label="Total cuentas" value={String(cuentas.length)} color={P.blue} P={P} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button onClick={() => setShowForm(!showForm)} style={S.btn}>{showForm ? "✕ Cancelar" : `➕ Nueva cuenta`}</button>
      </div>

      {showForm && (
        <div style={{ ...S.card, border: `2px solid ${color}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 18px" }}>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: P.sub }}>{etiquetaNombre}</label>
              <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={{ ...S.input, marginTop: 4 }} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: P.sub }}>Monto (RD$)</label>
              <input type="number" value={form.monto_original} onChange={e => setForm({ ...form, monto_original: e.target.value })} style={{ ...S.input, marginTop: 4 }} /></div>
            <div style={{ gridColumn: "1 / -1" }}><label style={{ fontSize: 12, fontWeight: 600, color: P.sub }}>Descripción</label>
              <input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} style={{ ...S.input, marginTop: 4 }} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: P.sub }}>Fecha de vencimiento</label>
              <input type="date" value={form.fecha_vencimiento} onChange={e => setForm({ ...form, fecha_vencimiento: e.target.value })} style={{ ...S.input, marginTop: 4 }} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600, color: P.sub }}>Notas</label>
              <input value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} style={{ ...S.input, marginTop: 4 }} /></div>
          </div>
          <button onClick={crear} disabled={saving} style={{ ...S.btn, width: "100%", marginTop: 12, background: color }}>{saving ? "Guardando..." : "💾 Crear cuenta"}</button>
        </div>
      )}

      <div style={S.card}>
        {loading ? <p style={{ color: P.sub, textAlign: "center", padding: 20 }}>Cargando...</p> :
          cuentas.length === 0 ? <p style={{ color: P.sub, textAlign: "center", padding: 20 }}>Sin cuentas registradas.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{[etiquetaNombre, "Descripción", "Monto", "Pagado", "Saldo", "Vence", "Estado", ""].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {cuentas.map(c => (
                    <tr key={c.id}>
                      <td style={S.td}>{c[campoNombre] || "—"}</td>
                      <td style={S.td}>{c.descripcion}</td>
                      <td style={{ ...S.td, fontWeight: 700 }}>{fmt(c.monto_original)}</td>
                      <td style={{ ...S.td, color: P.green }}>{fmt(c.monto_pagado)}</td>
                      <td style={{ ...S.td, fontWeight: 700, color: color }}>{fmt(c.saldo)}</td>
                      <td style={S.td}>{fmtFecha(c.fecha_vencimiento)}</td>
                      <td style={S.td}>{estadoChip(c)}</td>
                      <td style={{ ...S.td, whiteSpace: "nowrap" }}>
                        {c.estado !== "PAGADO" && c.estado !== "ANULADO" && (
                          <button onClick={() => { setModalPago(c); setPago({ monto: String(c.saldo), metodo: "EFECTIVO", fecha: hoyRD(), referencia: "", notas: "" }); }}
                            style={{ ...S.btnGhost, color: P.green, marginRight: 6 }}>💵 Pago</button>
                        )}
                        <button onClick={() => eliminar(c.id)} style={{ ...S.btnGhost, color: P.red, padding: "4px 8px" }}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {modalPago && (
        <div onClick={() => setModalPago(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: P.card, color: P.text, borderRadius: 14, padding: 24, width: 420, maxWidth: "92vw", border: `1px solid ${P.cardBorder}` }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{esCobrar ? "Registrar cobro" : "Registrar pago"}</h3>
            <p style={{ fontSize: 13, color: P.sub, marginBottom: 16 }}>{modalPago.descripcion} · Saldo: <b style={{ color }}>{fmt(modalPago.saldo)}</b></p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 14px" }}>
              <div><label style={{ fontSize: 12, fontWeight: 600, color: P.sub }}>Monto</label>
                <input type="number" value={pago.monto} onChange={e => setPago({ ...pago, monto: e.target.value })} style={{ ...S.input, marginTop: 4 }} /></div>
              <div><label style={{ fontSize: 12, fontWeight: 600, color: P.sub }}>Método</label>
                <select value={pago.metodo} onChange={e => setPago({ ...pago, metodo: e.target.value })} style={{ ...S.input, marginTop: 4 }}>
                  {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                </select></div>
              <div><label style={{ fontSize: 12, fontWeight: 600, color: P.sub }}>Fecha</label>
                <input type="date" value={pago.fecha} onChange={e => setPago({ ...pago, fecha: e.target.value })} style={{ ...S.input, marginTop: 4 }} /></div>
              <div><label style={{ fontSize: 12, fontWeight: 600, color: P.sub }}>Referencia</label>
                <input value={pago.referencia} onChange={e => setPago({ ...pago, referencia: e.target.value })} style={{ ...S.input, marginTop: 4 }} /></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={() => setModalPago(null)} style={{ ...S.btnGhost, flex: 1, padding: "10px" }}>Cancelar</button>
              <button onClick={registrarPago} style={{ ...S.btn, flex: 1, background: P.green }}>💾 Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════ RESUMEN ════════════════════════
function Resumen({ apiBase, P, S }: any) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const [rc, rcc, rcp] = await Promise.all([
          fetch(`${API}${apiBase}/caja-chica`).then(r => r.json()),
          fetch(`${API}${apiBase}/cuentas-cobrar`).then(r => r.json()),
          fetch(`${API}${apiBase}/cuentas-pagar`).then(r => r.json()),
        ]);
        const movs = rc.movimientos || [];
        const ing = movs.filter((m: any) => m.tipo === "INGRESO").reduce((a: number, m: any) => a + Number(m.monto), 0);
        const egr = movs.filter((m: any) => m.tipo === "EGRESO").reduce((a: number, m: any) => a + Number(m.monto), 0);
        const cxc = rcc.cuentas || [];
        const cxp = rcp.cuentas || [];
        const porCobrar = cxc.filter((c: any) => c.estado !== "PAGADO" && c.estado !== "ANULADO").reduce((a: number, c: any) => a + Number(c.saldo || 0), 0);
        const porPagar = cxp.filter((c: any) => c.estado !== "PAGADO" && c.estado !== "ANULADO").reduce((a: number, c: any) => a + Number(c.saldo || 0), 0);
        setData({ fondo: rc.fondo_actual ?? (ing - egr), ing, egr, porCobrar, porPagar });
      } catch { setData({ fondo: 0, ing: 0, egr: 0, porCobrar: 0, porPagar: 0 }); }
    })();
  }, [apiBase]);

  if (!data) return <p style={{ color: P.sub, textAlign: "center", padding: 30 }}>Cargando resumen...</p>;
  const posicion = Number(data.fondo) + Number(data.porCobrar) - Number(data.porPagar);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Kpi label="Saldo caja chica" value={fmt(data.fondo)} color={data.fondo >= 0 ? P.green : P.red} P={P} />
        <Kpi label="Por cobrar" value={fmt(data.porCobrar)} color={P.green} P={P} />
        <Kpi label="Por pagar" value={fmt(data.porPagar)} color={P.amber} P={P} />
        <Kpi label="Posición neta" value={fmt(posicion)} color={posicion >= 0 ? P.green : P.red} P={P} />
      </div>
      <div style={S.card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>📊 Estado contable del módulo</h3>
        {[
          ["⬆️ Ingresos de caja chica", fmt(data.ing), P.green],
          ["⬇️ Egresos / gastos de caja chica", fmt(data.egr), P.red],
          ["💳 Cuentas por cobrar (saldo)", fmt(data.porCobrar), P.green],
          ["📤 Cuentas por pagar (saldo)", fmt(data.porPagar), P.amber],
        ].map(([l, v, c]: any, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "11px 4px", borderBottom: `1px solid ${P.rowBorder}` }}>
            <span style={{ color: P.sub, fontSize: 14 }}>{l}</span>
            <span style={{ fontWeight: 700, color: c }}>{v}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 4px", marginTop: 4 }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>Posición neta (caja + por cobrar − por pagar)</span>
          <span style={{ fontWeight: 800, fontSize: 16, color: posicion >= 0 ? P.green : P.red }}>{fmt(posicion)}</span>
        </div>
      </div>
    </div>
  );
}
