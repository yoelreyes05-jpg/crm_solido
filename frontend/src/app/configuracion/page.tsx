"use client";

import { useEffect, useState, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface CfgRow { clave: string; valor: string; updated_at?: string; }
interface NcfRow  { tipo: string; prefijo: string; secuencia_actual: number; }

// ─── Claves y etiquetas de la empresa ────────────────────────────────────────
const EMPRESA_FIELDS = [
  { key: "nombre_empresa",    label: "Nombre de la Empresa",           ph: "SÓLIDO AUTO SERVICIO", type: "text" },
  { key: "rnc_empresa",       label: "RNC",                            ph: "000-000000-0",          type: "text" },
  { key: "telefono_empresa",  label: "Teléfono",                       ph: "809-712-2027",          type: "text" },
  { key: "whatsapp_numero",   label: "WhatsApp (con código país)",      ph: "18097122027",           type: "text" },
  { key: "email_empresa",     label: "Correo Electrónico",             ph: "info@empresa.com",      type: "email" },
  { key: "direccion_empresa", label: "Dirección",                      ph: "Santo Domingo, RD",     type: "text" },
];

const SISTEMA_FIELDS = [
  { key: "moneda",             label: "Moneda predeterminada",    type: "select", opts: ["RD$","US$","EUR"] },
  { key: "itbis_porcentaje",   label: "ITBIS (%)",                type: "select", opts: ["18","0","16"] },
  { key: "dias_garantia",      label: "Días de garantía",         type: "number" },
  { key: "dashboard_refresh",  label: "Refresco dashboard (seg)", type: "select", opts: ["10","30","60","120"] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const s = {
  page:   { padding: "28px 24px", maxWidth: 860, margin: "0 auto" } as React.CSSProperties,
  titulo: { fontSize: 22, fontWeight: 800, color: "#f1f5f9", marginBottom: 4 } as React.CSSProperties,
  sub:    { fontSize: 13, color: "#475569", marginBottom: 28 } as React.CSSProperties,
  tabs:   { display: "flex", gap: 6, marginBottom: 28, flexWrap: "wrap" as const },
  tab: (active: boolean): React.CSSProperties => ({
    padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer",
    fontWeight: 700, fontSize: 13,
    background: active ? "#2563eb" : "#1e293b",
    color:      active ? "#fff"    : "#94a3b8",
  }),
  card:   { background: "#1e293b", borderRadius: 14, padding: 24, marginBottom: 18 } as React.CSSProperties,
  cardDanger: { background: "#1e293b", borderRadius: 14, padding: 24, marginBottom: 18, border: "1px solid rgba(239,68,68,0.35)" } as React.CSSProperties,
  cardInfo:   { background: "#0f172a", borderRadius: 14, padding: 20, marginBottom: 18, border: "1px solid #1e293b" } as React.CSSProperties,
  cardWarn:   { background: "#1e293b", borderRadius: 14, padding: 20, marginBottom: 18, border: "1px solid rgba(245,158,11,0.3)" } as React.CSSProperties,
  section: { fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 16 },
  label:  { display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 5 } as React.CSSProperties,
  input:  {
    width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #334155",
    background: "#0f172a", color: "#f1f5f9", fontSize: 14, outline: "none",
    boxSizing: "border-box" as const, marginBottom: 14,
  } as React.CSSProperties,
  row2:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } as React.CSSProperties,
  btn:    { padding: "11px 28px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" } as React.CSSProperties,
  btnFull:{ width: "100%", padding: 13, borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 8 } as React.CSSProperties,
  btnSm:  { padding: "8px 18px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" } as React.CSSProperties,
  toast: (ok: boolean): React.CSSProperties => ({
    padding: "12px 16px", borderRadius: 10, fontWeight: 600, fontSize: 13, marginBottom: 16,
    background: ok ? "rgba(52,211,153,0.12)" : "rgba(239,68,68,0.12)",
    color:      ok ? "#34d399" : "#f87171",
    border:     `1px solid ${ok ? "rgba(52,211,153,0.3)" : "rgba(239,68,68,0.3)"}`,
  }),
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ConfiguracionPage() {
  const [tab,      setTab]      = useState("empresa");
  const [cfgMap,   setCfgMap]   = useState<Record<string, string>>({});
  const [editMap,  setEditMap]  = useState<Record<string, string>>({});
  const [ncf,      setNcf]      = useState<NcfRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState<{ text: string; ok: boolean } | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = (text: string, ok = true) => {
    setMsg({ text, ok });
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setMsg(null), 4000);
  };

  // ── Carga inicial ────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch(`${API}/config`).then(r => r.json()).catch(() => []),
      fetch(`${API}/ncf/config`).then(r => r.json()).catch(() => []),
    ]).then(([cfgData, ncfData]: [CfgRow[], NcfRow[]]) => {
      const m: Record<string, string> = {};
      if (Array.isArray(cfgData)) cfgData.forEach(c => { m[c.clave] = c.valor ?? ""; });
      setCfgMap(m);
      setEditMap({ ...m });
      if (Array.isArray(ncfData)) setNcf(ncfData);
    }).finally(() => setLoading(false));
  }, []);

  const set = (k: string, v: string) => setEditMap(p => ({ ...p, [k]: v }));
  const hasChanges = JSON.stringify(cfgMap) !== JSON.stringify(editMap);

  // ── Guardar configuración ────────────────────────────────────────────────
  async function guardar() {
    setSaving(true);
    try {
      const payload = Object.entries(editMap).map(([clave, valor]) => ({ clave, valor }));
      const res = await fetch(`${API}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Error del servidor");
      setCfgMap({ ...editMap });
      toast("✅ Configuración guardada correctamente.");
    } catch {
      toast("❌ No se pudo guardar. Verifica la conexión.", false);
    } finally {
      setSaving(false);
    }
  }

  // ── Exportar CSV ─────────────────────────────────────────────────────────
  async function exportar(tipo: string, label: string) {
    setExporting(tipo);
    try {
      const res = await fetch(`${API}/export/${tipo}`);
      if (!res.ok) throw new Error("Error");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${tipo}_${new Date().toISOString().slice(0,10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toast(`✅ ${label} exportado correctamente.`);
    } catch {
      toast(`❌ Error al exportar ${label}.`, false);
    } finally {
      setExporting(null);
    }
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const TABS = [
    { key: "empresa",     label: "🏢 Empresa" },
    { key: "ncf",         label: "🧾 NCF" },
    { key: "notif",       label: "🔔 Notificaciones" },
    { key: "exportar",    label: "📥 Exportar" },
    { key: "sistema",     label: "⚙️ Sistema" },
  ];

  if (loading) return (
    <div style={{ padding: 60, textAlign: "center", color: "#475569" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⚙️</div>
      Cargando configuración…
    </div>
  );

  return (
    <div style={s.page}>
      {/* Encabezado */}
      <div style={s.titulo}>⚙️ Configuración del Sistema</div>
      <div style={s.sub}>Gestión de empresa, comprobantes fiscales, notificaciones y exportaciones.</div>

      {/* Tabs */}
      <div style={s.tabs}>
        {TABS.map(t => (
          <button key={t.key} style={s.tab(tab === t.key)} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Toast */}
      {msg && <div style={s.toast(msg.ok)}>{msg.text}</div>}

      {/* ═══════════════════════════════════════════════════════ EMPRESA */}
      {tab === "empresa" && (
        <>
          <div style={s.card}>
            <div style={s.section}>Datos de la Empresa</div>
            <p style={{ fontSize: 12, color: "#475569", marginBottom: 18, marginTop: -8 }}>
              Esta información aparece en facturas, comprobantes e inspecciones impresas.
            </p>

            {/* Logo */}
            <div style={{ marginBottom: 18 }}>
              <div style={s.label}>Logo (URL de imagen)</div>
              <input
                style={s.input}
                value={editMap.logo_url ?? ""}
                onChange={e => set("logo_url", e.target.value)}
                placeholder="https://... o dejar vacío"
              />
              {editMap.logo_url && (
                <img
                  src={editMap.logo_url}
                  alt="Logo"
                  style={{ height: 60, objectFit: "contain", marginTop: -8, marginBottom: 10, borderRadius: 6 }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
            </div>

            <div style={s.row2}>
              {EMPRESA_FIELDS.map(f => (
                <div key={f.key}>
                  <label style={s.label}>{f.label}</label>
                  <input
                    style={s.input}
                    type={f.type}
                    value={editMap[f.key] ?? ""}
                    onChange={e => set(f.key, e.target.value)}
                    placeholder={f.ph}
                  />
                </div>
              ))}
            </div>

            <button
              style={{ ...s.btn, opacity: saving ? 0.7 : 1 }}
              onClick={guardar}
              disabled={saving || !hasChanges}
            >
              {saving ? "Guardando…" : hasChanges ? "💾 Guardar Cambios" : "✓ Sin cambios"}
            </button>
          </div>

          {/* Vista previa del encabezado de factura */}
          <div style={s.cardInfo}>
            <div style={s.section}>Vista previa — encabezado de factura</div>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              {editMap.logo_url && (
                <img src={editMap.logo_url} alt="" style={{ height: 48, objectFit: "contain", borderRadius: 4 }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>{editMap.nombre_empresa || "—"}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>RNC: {editMap.rnc_empresa || "—"}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{editMap.telefono_empresa || ""} · {editMap.email_empresa || ""}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{editMap.direccion_empresa || ""}</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ NCF */}
      {tab === "ncf" && (
        <>
          <div style={s.card}>
            <div style={s.section}>Comprobantes Fiscales (NCF)</div>
            <p style={{ fontSize: 12, color: "#475569", marginBottom: 18, marginTop: -8 }}>
              La secuencia avanza automáticamente al emitir cada factura. Solo modifica en Supabase si necesitas corregir un error.
            </p>

            {ncf.length === 0 ? (
              <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: 20 }}>
                Sin datos de NCF. Verifica que la tabla <code style={{ color: "#94a3b8" }}>ncf_config</code> exista en Supabase.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Tipo", "Descripción", "Prefijo", "Secuencia Actual", "Próximo NCF"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "10px 14px", background: "#0f172a", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 1 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ncf.map(n => {
                      const TIPOS: Record<string, string> = { B01: "Crédito Fiscal", B02: "Consumidor Final", B14: "Régimen Especial", B15: "Gubernamental", B16: "Exportaciones" };
                      const siguiente = (n.secuencia_actual || 0) + 1;
                      return (
                        <tr key={n.tipo} style={{ borderBottom: "1px solid #0f172a" }}>
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{ background: "rgba(37,99,235,0.2)", color: "#60a5fa", padding: "3px 10px", borderRadius: 6, fontWeight: 700, fontSize: 13 }}>
                              {n.tipo}
                            </span>
                          </td>
                          <td style={{ padding: "12px 14px", fontSize: 13, color: "#cbd5e1" }}>{TIPOS[n.tipo] || n.tipo}</td>
                          <td style={{ padding: "12px 14px", fontSize: 13, color: "#94a3b8" }}>{n.prefijo}</td>
                          <td style={{ padding: "12px 14px", fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{n.secuencia_actual}</td>
                          <td style={{ padding: "12px 14px" }}>
                            <code style={{ fontSize: 12, color: "#34d399", background: "rgba(52,211,153,0.08)", padding: "3px 8px", borderRadius: 4 }}>
                              {n.prefijo + String(siguiente).padStart(8, "0")}
                            </code>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={s.cardWarn}>
            <div style={{ fontSize: 13, color: "#fbbf24", fontWeight: 700, marginBottom: 6 }}>⚠️ Aviso Legal</div>
            <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
              Los NCF son documentos fiscales legales regulados por la DGII. Para ajustar secuencias o corregir prefijos, hazlo directamente en Supabase → tabla <code style={{ color: "#f1f5f9" }}>ncf_config</code>. No alteres secuencias ya emitidas.
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ NOTIFICACIONES */}
      {tab === "notif" && (
        <>
          <div style={s.card}>
            <div style={s.section}>Telegram</div>
            <p style={{ fontSize: 12, color: "#475569", marginBottom: 18, marginTop: -8 }}>
              El bot de Telegram notifica automáticamente al técnico y al cliente cuando una OT avanza de estado.
            </p>

            <label style={s.label}>Token del Bot</label>
            <input
              style={s.input}
              type="password"
              value={editMap.telegram_token ?? ""}
              onChange={e => set("telegram_token", e.target.value)}
              placeholder="123456:ABCdef…"
              autoComplete="off"
            />

            <label style={s.label}>Chat ID del grupo / canal</label>
            <input
              style={s.input}
              value={editMap.telegram_chat_id ?? ""}
              onChange={e => set("telegram_chat_id", e.target.value)}
              placeholder="-100123456789"
            />

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <input
                type="checkbox"
                id="notif_telegram"
                checked={editMap.notif_telegram === "true"}
                onChange={e => set("notif_telegram", e.target.checked ? "true" : "false")}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              <label htmlFor="notif_telegram" style={{ fontSize: 13, color: "#cbd5e1", cursor: "pointer" }}>
                Activar notificaciones automáticas por Telegram
              </label>
            </div>
          </div>

          <div style={s.card}>
            <div style={s.section}>WhatsApp</div>
            <p style={{ fontSize: 12, color: "#475569", marginBottom: 18, marginTop: -8 }}>
              Envía un mensaje de WhatsApp al cliente cuando su vehículo está listo para retirar.
            </p>

            <label style={s.label}>Número WhatsApp del taller (con código país)</label>
            <input
              style={s.input}
              value={editMap.whatsapp_numero ?? ""}
              onChange={e => set("whatsapp_numero", e.target.value)}
              placeholder="18097122027"
            />

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <input
                type="checkbox"
                id="notif_whatsapp"
                checked={editMap.notif_whatsapp === "true"}
                onChange={e => set("notif_whatsapp", e.target.checked ? "true" : "false")}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              <label htmlFor="notif_whatsapp" style={{ fontSize: 13, color: "#cbd5e1", cursor: "pointer" }}>
                Activar notificaciones automáticas por WhatsApp
              </label>
            </div>
          </div>

          <button
            style={{ ...s.btn, opacity: saving ? 0.7 : 1 }}
            onClick={guardar}
            disabled={saving || !hasChanges}
          >
            {saving ? "Guardando…" : hasChanges ? "💾 Guardar Cambios" : "✓ Sin cambios"}
          </button>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ EXPORTAR */}
      {tab === "exportar" && (
        <>
          <div style={s.card}>
            <div style={s.section}>Exportar Datos a CSV</div>
            <p style={{ fontSize: 12, color: "#475569", marginBottom: 18, marginTop: -8 }}>
              Descarga tus datos en formato CSV compatible con Excel. Los archivos incluyen BOM UTF-8 para caracteres especiales.
            </p>

            {[
              { tipo: "clientes",   icon: "👤", label: "Clientes",             desc: "Nombre, teléfono, email, cédula, fecha de registro" },
              { tipo: "facturas",   icon: "🧾", label: "Facturas",             desc: "NCF, tipo, total, método de pago, estado, fecha" },
              { tipo: "inventario", icon: "📦", label: "Inventario",           desc: "Código, nombre, categoría, stock, precios" },
              { tipo: "ordenes",    icon: "🔬", label: "Órdenes de Trabajo",   desc: "Cliente, vehículo, estado, técnico, costo, fecha" },
            ].map(b => (
              <div key={b.tipo} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <span style={{ fontSize: 26 }}>{b.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9" }}>{b.label}</div>
                    <div style={{ fontSize: 12, color: "#475569" }}>{b.desc}</div>
                  </div>
                </div>
                <button
                  onClick={() => exportar(b.tipo, b.label)}
                  disabled={exporting === b.tipo}
                  style={{
                    ...s.btnSm,
                    background: exporting === b.tipo ? "#334155" : "#2563eb",
                    color: "#fff",
                    minWidth: 110,
                  }}
                >
                  {exporting === b.tipo ? "Descargando…" : "⬇️ Descargar"}
                </button>
              </div>
            ))}
          </div>

          <div style={s.cardInfo}>
            <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
              💡 <strong style={{ color: "#94a3b8" }}>Respaldo automático:</strong> Tu base de datos Supabase hace respaldo automático diario. Para exportar la base completa accede a Supabase → Settings → Database → Backups.
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ SISTEMA */}
      {tab === "sistema" && (
        <>
          <div style={s.card}>
            <div style={s.section}>Parámetros del Sistema</div>

            <div style={s.row2}>
              {SISTEMA_FIELDS.map(f => (
                <div key={f.key}>
                  <label style={s.label}>{f.label}</label>
                  {f.type === "select" ? (
                    <select
                      style={s.input}
                      value={editMap[f.key] ?? ""}
                      onChange={e => set(f.key, e.target.value)}
                    >
                      {(f.opts || []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      style={s.input}
                      type={f.type}
                      value={editMap[f.key] ?? ""}
                      onChange={e => set(f.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              style={{ ...s.btn, opacity: saving ? 0.7 : 1 }}
              onClick={guardar}
              disabled={saving || !hasChanges}
            >
              {saving ? "Guardando…" : hasChanges ? "💾 Guardar Cambios" : "✓ Sin cambios"}
            </button>
          </div>

          {/* Info técnica */}
          <div style={s.cardInfo}>
            <div style={s.section}>Información del Sistema</div>
            {[
              { label: "Versión",       val: "CRM Sólido Auto Servicio v2.0" },
              { label: "Frontend",      val: "Next.js 14 + TypeScript" },
              { label: "Backend",       val: "Node.js + Express (ESM)" },
              { label: "Base de datos", val: "Supabase PostgreSQL" },
              { label: "API URL",       val: API },
            ].map(i => (
              <div key={i.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8, gap: 12 }}>
                <span style={{ color: "#475569", flexShrink: 0 }}>{i.label}</span>
                <span style={{ color: "#94a3b8", wordBreak: "break-all", textAlign: "right" }}>{i.val}</span>
              </div>
            ))}
          </div>

          {/* Zona de peligro */}
          <div style={s.cardDanger}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f87171", marginBottom: 8 }}>⚠️ Zona de Peligro</div>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16, lineHeight: 1.6 }}>
              Estas acciones son irreversibles. Úsalas con extremo cuidado.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  if (confirm("¿Limpiar caché local? Tendrás que iniciar sesión de nuevo.")) {
                    localStorage.clear();
                    window.location.href = "/login";
                  }
                }}
                style={{ ...s.btnSm, background: "#f59e0b", color: "#fff", flex: 1 }}
              >
                🗑️ Limpiar Caché
              </button>
              <button
                onClick={() => alert("Contacta al administrador del sistema para esta acción.")}
                style={{ ...s.btnSm, background: "#dc2626", color: "#fff", flex: 1 }}
              >
                💥 Resetear Sistema
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
