"use client";
import React, { useEffect, useState, useCallback } from "react";
import { API_URL as API } from "@/config";

const fmt = (n: number) =>
  "RD$ " + Number(n || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 });

const fmtDate = (d: string) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function InteligenciaPage() {
  const [tab, setTab] = useState("proyeccion");
  const [datos, setDatos] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const cargarTab = useCallback(async (key: string, url: string) => {
    if (datos[key]) return; // ya cargado
    setLoading(l => ({ ...l, [key]: true }));
    try {
      const r = await fetch(`${API}${url}`);
      const d = await r.json();
      setDatos(prev => ({ ...prev, [key]: d }));
    } catch { setDatos(prev => ({ ...prev, [key]: null })); }
    setLoading(l => ({ ...l, [key]: false }));
  }, [datos]);

  useEffect(() => {
    if (tab === "proyeccion")  cargarTab("proyeccion",  "/api/predictivo/proyeccion-ingresos");
    if (tab === "inventario")  cargarTab("inventario",  "/api/predictivo/demanda-inventario");
    if (tab === "fallas")      cargarTab("fallas",      "/api/predictivo/fallas-por-modelo");
    if (tab === "clientes")    cargarTab("clientes",    "/api/predictivo/clientes-riesgo");
    if (tab === "topclientes") cargarTab("topclientes", "/api/predictivo/top-clientes");
  }, [tab, cargarTab]);

  const TABS = [
    { key: "proyeccion",  label: "📈 Proyección" },
    { key: "inventario",  label: "📦 Inventario" },
    { key: "fallas",      label: "🔩 Fallas por Modelo" },
    { key: "clientes",    label: "📞 Llamar Clientes" },
    { key: "topclientes", label: "🏆 Top Clientes" },
  ];

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}>🔮 Inteligencia Predictiva</h1>
          <p style={S.subtitle}>SÓLIDO AUTO SERVICIO — Análisis y predicciones basadas en tu historial</p>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={tab === t.key ? S.tabActive : S.tabInactive}>
            {t.label}
          </button>
        ))}
      </div>

      {/* CONTENIDO */}
      {tab === "proyeccion"  && <TabProyeccion  d={datos["proyeccion"]}  loading={loading["proyeccion"]}  />}
      {tab === "inventario"  && <TabInventario  d={datos["inventario"]}  loading={loading["inventario"]}  />}
      {tab === "fallas"      && <TabFallas      d={datos["fallas"]}      loading={loading["fallas"]}      />}
      {tab === "clientes"    && <TabClientesRiesgo d={datos["clientes"]} loading={loading["clientes"]}    />}
      {tab === "topclientes" && <TabTopClientes d={datos["topclientes"]} loading={loading["topclientes"]} />}
    </div>
  );
}

// ─── Proyección de Ingresos ───────────────────────────────────────────────────
function TabProyeccion({ d, loading }: { d: any; loading: boolean }) {
  if (loading || !d) return <Spinner loading={loading} />;
  const pct = d.variacion_pct;
  const barWidth = Math.min(100, d.ingresos_actuales / Math.max(d.proyeccion_mes, 1) * 100);

  return (
    <div>
      <div style={S.kpiRow}>
        <KpiCard icon="💰" label="Ingresos del mes (actual)" value={fmt(d.ingresos_actuales)} color="#10b981" big />
        <KpiCard icon="🔮" label="Proyección al cierre del mes" value={fmt(d.proyeccion_mes)} color="#6366f1" big />
        <KpiCard icon="📅" label="Ingresos mes anterior" value={fmt(d.ingresos_mes_anterior)} color="#f59e0b" />
        <KpiCard icon={pct >= 0 ? "📈" : "📉"} label="Variación vs. mes anterior"
          value={`${pct >= 0 ? "+" : ""}${pct}%`} color={pct >= 0 ? "#10b981" : "#ef4444"} />
      </div>

      {/* Barra de progreso del mes */}
      <div style={S.card}>
        <h3 style={S.cardTitle}>📊 Progreso del Mes (día {d.dias_transcurridos} de {d.dias_del_mes})</h3>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, color: "#555" }}>
          <span>Ingresos actuales: <b>{fmt(d.ingresos_actuales)}</b></span>
          <span>Meta proyectada: <b>{fmt(d.proyeccion_mes)}</b></span>
        </div>
        <div style={{ height: 18, background: "#f1f5f9", borderRadius: 9, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${barWidth}%`,
            background: "linear-gradient(90deg,#6366f1,#10b981)", borderRadius: 9,
            transition: "width .6s ease" }} />
        </div>
        <p style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}>
          Basado en ritmo actual de {d.dias_transcurridos} días transcurridos
        </p>
      </div>

      {/* Tendencia 30 días */}
      {d.tendencia_30_dias && d.tendencia_30_dias.length > 0 && (
        <div style={S.card}>
          <h3 style={S.cardTitle}>📆 Ingresos — Últimos 30 días</h3>
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120, padding: "8px 0" }}>
              {d.tendencia_30_dias.map((item: any) => {
                const maxVal = Math.max(...d.tendencia_30_dias.map((x: any) => x.total));
                const h = maxVal > 0 ? Math.max(4, (item.total / maxVal) * 100) : 4;
                return (
                  <div key={item.fecha} title={`${item.fecha}: ${fmt(item.total)}`}
                    style={{ flex: 1, minWidth: 8, background: "#6366f1",
                      borderRadius: "3px 3px 0 0", height: `${h}%`,
                      cursor: "default", opacity: 0.85 }} />
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#aaa" }}>
              <span>{d.tendencia_30_dias[0]?.fecha}</span>
              <span>{d.tendencia_30_dias[d.tendencia_30_dias.length - 1]?.fecha}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Demanda de Inventario ────────────────────────────────────────────────────
function TabInventario({ d, loading }: { d: any[]; loading: boolean }) {
  if (loading || !d) return <Spinner loading={loading} />;
  const criticos = d.filter(i => i.alerta);
  const ok       = d.filter(i => !i.alerta);

  return (
    <div>
      {criticos.length > 0 && (
        <div style={{ background: "#fff5f5", border: "2px solid #ef4444", borderRadius: 12,
          padding: "14px 18px", marginBottom: 16 }}>
          <h4 style={{ color: "#dc2626", margin: "0 0 6px" }}>
            🚨 {criticos.length} repuesto{criticos.length > 1 ? "s" : ""} con stock insuficiente para la demanda proyectada
          </h4>
          <p style={{ fontSize: 13, color: "#ef4444", margin: 0 }}>
            Basado en el consumo de los últimos 90 días
          </p>
        </div>
      )}

      <div style={S.card}>
        <h3 style={S.cardTitle}>📦 Proyección de Demanda de Inventario (próximos 30 días)</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                {["", "Repuesto", "Stock actual", "Consumo mensual", "Días cobertura", "Estado"].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.map((item: any) => (
                <tr key={item.id} style={{ background: item.alerta ? "#fff5f5" : "transparent" }}>
                  <td style={S.td}>{item.alerta ? "🚨" : "✅"}</td>
                  <td style={{ ...S.td, fontWeight: 600 }}>{item.nombre}</td>
                  <td style={S.td}>{item.stock_actual}</td>
                  <td style={S.td}>{item.consumo_mensual} uds/mes</td>
                  <td style={{ ...S.td, fontWeight: 700,
                    color: !item.dias_cobertura ? "#aaa"
                      : item.dias_cobertura < 15 ? "#ef4444"
                      : item.dias_cobertura < 30 ? "#f59e0b" : "#10b981" }}>
                    {item.dias_cobertura !== null ? `${item.dias_cobertura} días` : "Sin consumo"}
                  </td>
                  <td style={S.td}>
                    <span style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: item.alerta ? "#fee2e2" : "#dcfce7",
                      color: item.alerta ? "#dc2626" : "#16a34a",
                    }}>
                      {item.alerta ? "⚠️ PEDIR" : "OK"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.length === 0 && <p style={S.empty}>No hay suficiente historial de consumo aún.</p>}
      </div>
    </div>
  );
}

// ─── Fallas por Modelo ────────────────────────────────────────────────────────
function TabFallas({ d, loading }: { d: any[]; loading: boolean }) {
  if (loading || !d) return <Spinner loading={loading} />;

  return (
    <div>
      <div style={{ background: "#eff6ff", borderRadius: 10, padding: "12px 16px",
        fontSize: 13, color: "#1e40af", marginBottom: 16 }}>
        💡 Basado en los diagnósticos registrados en el sistema. Útil para anticipar repuestos y preparar el taller.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {d.map((m: any) => (
          <div key={m.modelo} style={{ ...S.card, marginBottom: 0 }}>
            <h4 style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 8 }}>
              🚗 {m.modelo}
            </h4>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
              {m.total} diagnóstico{m.total > 1 ? "s" : ""} registrado{m.total > 1 ? "s" : ""}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {m.top_servicios.map((s: any) => {
                const pct = m.total > 0 ? Math.round(s.count / m.total * 100) : 0;
                return (
                  <div key={s.servicio}>
                    <div style={{ display: "flex", justifyContent: "space-between",
                      fontSize: 12, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600 }}>{s.servicio.replace(/_/g, " ")}</span>
                      <span style={{ color: "#888" }}>{s.count}x ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3 }}>
                      <div style={{ height: "100%", width: `${pct}%`,
                        background: "#6366f1", borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {d.length === 0 && (
        <div style={S.card}>
          <p style={S.empty}>No hay suficientes diagnósticos para generar el análisis.</p>
        </div>
      )}
    </div>
  );
}

// ─── Llamar Clientes / Clientes en Riesgo ────────────────────────────────────
function limpiarTelefono(tel: string): string {
  // Quitar todo excepto dígitos
  const digits = (tel || "").replace(/\D/g, "");
  // RD: números de 10 dígitos → +1 + número
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return digits;
}

function imprimirListaLlamadas(clientes: any[], contactados: Set<string>) {
  const rows = clientes.map(c => {
    const ya = contactados.has(String(c.cliente_id));
    return `<tr style="background:${ya ? "#f0fdf4" : c.nivel_riesgo === "ALTO" ? "#fff5f5" : "#fffbeb"}">
      <td style="padding:8px 10px;border-bottom:1px solid #eee;">${ya ? "✅" : c.nivel_riesgo === "ALTO" ? "🔴" : "🟡"}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:700;">${c.nombre}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;">${c.telefono || "Sin teléfono"}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;">${c.dias_sin_visita} días sin visitar</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;">Última: ${fmtDate(c.ultima_visita)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#888;">${ya ? "CONTACTADO" : "PENDIENTE"}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>Lista de Llamadas</title>
  <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:13px;padding:28px;}
  h1{font-size:18px;font-weight:900;margin-bottom:4px;}h2{font-size:12px;color:#555;font-weight:400;margin-bottom:16px;}
  table{width:100%;border-collapse:collapse;}th{background:#111;color:#fff;padding:8px 10px;text-align:left;font-size:12px;}
  .footer{text-align:center;font-size:11px;color:#aaa;margin-top:20px;border-top:1px dashed #ddd;padding-top:12px;}
  @media print{button{display:none!important;}}</style></head><body>
  <h1>SÓLIDO AUTO SERVICIO SRL — Lista de Llamadas</h1>
  <h2>Clientes sin visitar · Impreso: ${new Date().toLocaleString("es-DO",{day:"numeric",month:"numeric",year:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:"America/Santo_Domingo"})}</h2>
  <table><thead><tr><th></th><th>Cliente</th><th>Teléfono</th><th>Ausencia</th><th>Última visita</th><th>Estado</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="footer">Total: ${clientes.length} clientes · ${contactados.size} contactados · ${clientes.length - contactados.size} pendientes</div>
  <script>setTimeout(()=>window.print(),400);<\/script></body></html>`;

  const w = window.open("", "_blank", "width=800,height=650");
  if (w) { w.document.write(html); w.document.close(); }
}

function TabClientesRiesgo({ d, loading }: { d: any[]; loading: boolean }) {
  const [contactados, setContactados] = React.useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("solido_contactados");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [filtro, setFiltro] = React.useState<"todos" | "pendientes" | "contactados">("pendientes");
  const [busqueda, setBusqueda] = React.useState("");

  if (loading || !d) return <Spinner loading={loading} />;
  const altos  = d.filter(c => c.nivel_riesgo === "ALTO");
  const medios = d.filter(c => c.nivel_riesgo === "MEDIO");

  const marcarContactado = (id: string) => {
    setContactados(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) { nuevo.delete(id); } else { nuevo.add(id); }
      localStorage.setItem("solido_contactados", JSON.stringify(Array.from(nuevo)));
      return nuevo;
    });
  };

  const clientesFiltrados = d.filter(c => {
    const yaContactado = contactados.has(String(c.cliente_id));
    if (filtro === "pendientes" && yaContactado) return false;
    if (filtro === "contactados" && !yaContactado) return false;
    if (busqueda && !c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) &&
        !c.telefono?.includes(busqueda)) return false;
    return true;
  });

  return (
    <div>
      {/* KPIs */}
      <div style={S.kpiRow}>
        <KpiCard icon="🔴" label="Riesgo alto (hace 3x+)"   value={`${altos.length} clientes`}  color="#ef4444" />
        <KpiCard icon="🟡" label="Riesgo medio (hace 1.5x)" value={`${medios.length} clientes`}  color="#f59e0b" />
        <KpiCard icon="✅" label="Ya contactados"            value={`${contactados.size}`}         color="#10b981" />
        <KpiCard icon="📞" label="Pendientes de llamar"     value={`${d.length - contactados.size}`} color="#6366f1" />
      </div>

      {/* Banner */}
      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10,
        padding: "12px 16px", fontSize: 13, color: "#92400e", marginBottom: 16 }}>
        💡 Clientes que llevan más de 1.5× su intervalo habitual sin volver al taller.
        Llámalos para ofrecerles un mantenimiento o revisión. Los marcados como contactados se recuerdan en este dispositivo.
      </div>

      {/* Controles */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="🔍 Buscar por nombre o teléfono..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: "10px 14px", borderRadius: 8,
            border: "1px solid #e2e8f0", fontSize: 14 }} />
        {(["pendientes", "contactados", "todos"] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: "10px 16px", borderRadius: 8, border: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 13,
            background: filtro === f ? "#111827" : "#f1f5f9",
            color: filtro === f ? "#fff" : "#374151",
          }}>
            {f === "pendientes" ? `📞 Por llamar (${d.length - contactados.size})` :
             f === "contactados" ? `✅ Contactados (${contactados.size})` : "Todos"}
          </button>
        ))}
        <button onClick={() => imprimirListaLlamadas(clientesFiltrados, contactados)}
          style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #e2e8f0",
            background: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
          🖨️ Imprimir lista
        </button>
      </div>

      {/* Tarjetas de clientes */}
      {clientesFiltrados.length === 0 ? (
        <div style={S.card}>
          <p style={S.empty}>
            {filtro === "pendientes" ? "✅ ¡Todos los clientes en riesgo ya fueron contactados!" :
             filtro === "contactados" ? "Ningún cliente marcado como contactado aún." :
             "No hay clientes en riesgo con los datos actuales."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
          {clientesFiltrados.map((c: any) => {
            const yaContactado = contactados.has(String(c.cliente_id));
            const telLimpio = limpiarTelefono(c.telefono);
            const msgWA = encodeURIComponent(
              `Hola ${c.nombre}, le saludamos desde SÓLIDO AUTO SERVICIO SRL. ` +
              `Han pasado ${c.dias_sin_visita} días desde su última visita. ` +
              `¿Desea agendar un mantenimiento o revisión para su vehículo? ` +
              `Llámenos al 809-712-2027 o responda este mensaje. ¡Gracias!`
            );
            const urlWA = `https://wa.me/${telLimpio}?text=${msgWA}`;

            return (
              <div key={c.cliente_id} style={{
                background: yaContactado ? "#f0fdf4" : "#fff",
                border: `2px solid ${yaContactado ? "#86efac" : c.nivel_riesgo === "ALTO" ? "#fca5a5" : "#fde68a"}`,
                borderRadius: 14,
                padding: 18,
                boxShadow: "0 2px 10px rgba(0,0,0,.06)",
                opacity: yaContactado ? 0.85 : 1,
              }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#111827", marginBottom: 2 }}>
                      {yaContactado ? "✅ " : ""}{c.nombre}
                    </div>
                    <span style={{
                      padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: c.nivel_riesgo === "ALTO" ? "#fee2e2" : "#fef3c7",
                      color:      c.nivel_riesgo === "ALTO" ? "#dc2626" : "#d97706",
                    }}>
                      {c.nivel_riesgo === "ALTO" ? "🔴 RIESGO ALTO" : "🟡 RIESGO MEDIO"}
                    </span>
                  </div>
                  <button
                    onClick={() => marcarContactado(String(c.cliente_id))}
                    title={yaContactado ? "Marcar como pendiente" : "Marcar como contactado"}
                    style={{
                      padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                      fontWeight: 700, fontSize: 12,
                      background: yaContactado ? "#dcfce7" : "#f1f5f9",
                      color: yaContactado ? "#16a34a" : "#374151",
                    }}>
                    {yaContactado ? "✅ Contactado" : "◻ Marcar"}
                  </button>
                </div>

                {/* Info */}
                <div style={{ fontSize: 13, color: "#555", marginBottom: 14, lineHeight: 1.7 }}>
                  <div>🕐 Sin visitar: <b style={{ color: c.nivel_riesgo === "ALTO" ? "#ef4444" : "#f59e0b" }}>{c.dias_sin_visita} días</b></div>
                  <div>📅 Última visita: <b>{fmtDate(c.ultima_visita)}</b></div>
                  <div>🔁 Visitaba cada: <b>{c.intervalo_promedio} días</b> · {c.visitas_total} visitas totales</div>
                  {c.email && <div>✉️ {c.email}</div>}
                </div>

                {/* Botones de contacto */}
                {c.telefono ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <a href={`tel:${c.telefono}`}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                        gap: 6, padding: "10px", background: "#1d4ed8", color: "#fff",
                        borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
                      📞 Llamar
                    </a>
                    <a href={urlWA} target="_blank" rel="noopener noreferrer"
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                        gap: 6, padding: "10px", background: "#16a34a", color: "#fff",
                        borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
                      💬 WhatsApp
                    </a>
                  </div>
                ) : (
                  <div style={{ padding: "10px", background: "#f1f5f9", borderRadius: 8,
                    fontSize: 13, color: "#aaa", textAlign: "center" }}>
                    📵 Sin teléfono registrado
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Top Clientes ─────────────────────────────────────────────────────────────
function TabTopClientes({ d, loading }: { d: any[]; loading: boolean }) {
  if (loading || !d) return <Spinner loading={loading} />;
  const top3 = d.slice(0, 3);

  return (
    <div>
      {/* Podio top 3 */}
      {top3.length > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {top3.map((c, i) => (
            <div key={c.cliente_id} style={{ ...S.card, flex: 1, minWidth: 180, marginBottom: 0,
              borderTop: `4px solid ${i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : "#cd7c2f"}` }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
              </div>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 2 }}>{c.nombre}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#10b981" }}>{fmt(c.total_facturado)}</div>
              <div style={{ fontSize: 12, color: "#888" }}>
                {c.visitas} visitas · ticket prom. {fmt(c.ticket_promedio)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={S.card}>
        <h3 style={S.cardTitle}>🏆 Ranking de Clientes por Valor Total (Top 20)</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                {["#", "Cliente", "Total Facturado", "Visitas", "Ticket Promedio", "Última Visita"].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.map((c: any, i: number) => (
                <tr key={c.cliente_id} style={{ background: i < 3 ? "#fffbeb" : "transparent" }}>
                  <td style={{ ...S.td, fontWeight: 700, color: "#888" }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </td>
                  <td style={{ ...S.td, fontWeight: 700 }}>{c.nombre}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: "#10b981" }}>{fmt(c.total_facturado)}</td>
                  <td style={S.td}>{c.visitas}</td>
                  <td style={S.td}>{fmt(c.ticket_promedio)}</td>
                  <td style={{ ...S.td, color: "#888" }}>{fmtDate(c.ultima_visita)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.length === 0 && <p style={S.empty}>No hay facturas con cliente asignado aún.</p>}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, color, big }: { icon: string; label: string; value: string; color: string; big?: boolean }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px",
      boxShadow: "0 2px 12px rgba(0,0,0,.07)", flex: 1, minWidth: 160,
      borderLeft: `5px solid ${color}` }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: big ? 22 : 18, fontWeight: 900, color, marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#888" }}>{label}</div>
    </div>
  );
}

function Spinner({ loading }: { loading: boolean }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 0", color: "#aaa" }}>
      {loading ? "⏳ Cargando análisis..." : "No se pudo cargar el análisis."}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:       { padding: "24px 28px", background: "#f5f7fb", minHeight: "100vh" },
  header:     { marginBottom: 24 },
  title:      { fontSize: 26, fontWeight: 900, color: "#111827", margin: 0 },
  subtitle:   { fontSize: 13, color: "#6b7280", marginTop: 4 },
  kpiRow:     { display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" },
  card:       { background: "#fff", padding: 22, borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,.07)", marginBottom: 20 },
  cardTitle:  { fontSize: 17, fontWeight: 700, marginBottom: 16, color: "#111827" },
  tabActive:  { padding: "10px 20px", borderRadius: 10, border: "none", background: "#111827",
                color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14 },
  tabInactive: { padding: "10px 20px", borderRadius: 10, border: "1px solid #e2e8f0",
                 background: "#fff", color: "#374151", cursor: "pointer", fontWeight: 600, fontSize: 14 },
  table:      { width: "100%", borderCollapse: "collapse" },
  th:         { textAlign: "left", padding: "10px 12px", background: "#f8fafc", fontSize: 12,
                fontWeight: 700, color: "#555", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" },
  td:         { padding: "11px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 13 },
  empty:      { color: "#aaa", textAlign: "center", padding: "32px 0", fontStyle: "italic" },
};
