"use client";
import { useEffect, useState, useCallback } from "react";
import { getEmpresaSync } from "@/lib/empresa";

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
  ventas_cheque: number;
  ventas_credito: number;
  cafe_efectivo: number;
  cafe_total: number;
  facturas_count: number;
  tipo: string;
  efectivo_contado: number | null;
  notas: string | null;
  gastos: number;
  diferencia: number;
  creado_en: string;
};

type CuentaPagar = {
  id: number;
  suplidor_id?: number;
  suplidor_nombre?: string;
  suplidor_display?: string;
  descripcion: string;
  monto_original: number;
  monto_pagado: number;
  saldo?: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: string;
  notas?: string;
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
  d ? new Date(d).toLocaleDateString("es-DO", { day: "numeric", month: "numeric", year: "2-digit", timeZone: "America/Santo_Domingo" }) : "—";

const fmtDatetime = (d: string) =>
  d ? new Date(d).toLocaleString("es-DO", { day: "numeric", month: "numeric", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Santo_Domingo" }) : "—";

// ── Imprimir recibo de pago ────────────────────────────────────────────────
function imprimirRecibo(cuenta: any, pagos: any[], tipo: "cobrar" | "pagar") {
  const titulo  = tipo === "cobrar" ? "RECIBO DE COBRO" : "COMPROBANTE DE PAGO";
  const saldo   = Number(cuenta.monto_original) - Number(cuenta.monto_pagado);
  const rows    = pagos.map(p => `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;">${fmtDate(p.fecha)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:700;color:#111;">${fmt(p.monto)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;">${p.metodo}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;">${p.referencia || "—"}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;">${p.usuario || "—"}</td>
    </tr>`).join("");
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>${titulo}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:13px;padding:30px;max-width:600px;margin:auto;}
  h1{font-size:20px;font-weight:900;border-bottom:3px solid #111;padding-bottom:10px;margin-bottom:16px;}
  .row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;font-size:13px;}
  .total{font-size:18px;font-weight:900;border-top:3px solid #111;padding-top:10px;margin-top:8px;}
  table{width:100%;border-collapse:collapse;margin-top:14px;}
  th{text-align:left;padding:8px 10px;background:#f1f5f9;font-size:12px;}
  .footer{text-align:center;margin-top:24px;font-size:11px;color:#888;border-top:1px dashed #ccc;padding-top:14px;}
  @media print{button{display:none!important;}}</style></head><body>
  <h1>SÓLIDO AUTO SERVICIO SRL<br/><span style="font-size:14px;font-weight:600;">${titulo}</span></h1>
  <div class="row"><span>Descripción</span><strong>${cuenta.descripcion}</strong></div>
  ${cuenta.suplidor_display && cuenta.suplidor_display !== "—" ? `<div class="row"><span>Suplidor</span><strong>${cuenta.suplidor_display}</strong></div>` : ""}
  <div class="row"><span>Monto original</span><strong>${fmt(cuenta.monto_original)}</strong></div>
  <div class="row"><span>Total pagado</span><strong style="color:#10b981;">${fmt(cuenta.monto_pagado)}</strong></div>
  <div class="row total"><span>Saldo pendiente</span><span>${fmt(saldo)}</span></div>
  <table><thead><tr><th>Fecha</th><th>Monto</th><th>Método</th><th>Referencia</th><th>Usuario</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="footer">SÓLIDO AUTO SERVICIO SRL · 849-569-2027 · Santo Domingo, R.D.<br/>Impreso: ${new Date().toLocaleString("es-DO",{day:"numeric",month:"numeric",year:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:"America/Santo_Domingo"})}</div>
  <script>setTimeout(()=>window.print(),500);<\/script></body></html>`;
  const w = window.open("", "_blank", "width=700,height=600");
  if (w) { w.document.write(html); w.document.close(); }
}

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
    { key: "cuadre",  label: "🏦 Cuadre de Caja",       roles: ["gerente", "secretaria"] },
    { key: "chica",   label: "💵 Caja Chica",            roles: ["gerente", "secretaria"] },
    { key: "costos",  label: "📊 Costos y Utilidades",   roles: ["gerente"] },
    { key: "cobrar",  label: "💳 Cuentas x Cobrar",      roles: ["gerente", "secretaria"] },
    { key: "pagar",   label: "📤 Cuentas x Pagar",       roles: ["gerente", "secretaria"] },
    { key: "nomina",  label: "👥 Nómina",                roles: ["gerente"] },
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
        {tab === "cobrar" && <CuentasCobrar usuario={usuario} />}
        {tab === "pagar"  && <CuentasPagar  usuario={usuario} />}
        {tab === "nomina" && <Nomina usuario={usuario} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CUADRE DE CAJA
// ═══════════════════════════════════════════════════════════════════════════

// Imprimir un cuadre de caja
function imprimirCuadre(c: Cuadre & { por_metodo?: any[] }) {
  const _e = getEmpresaSync();
  const EMPRESA = { nombre: _e.nombre || "Sólido Auto Servicio", tel: _e.telefono || "", dir: _e.direccion || "" };
  const ef           = Number(c.ventas_efectivo      || 0);
  const tar          = Number(c.ventas_tarjeta       || 0);
  const tra          = Number(c.ventas_transferencia || 0);
  const che          = Number(c.ventas_cheque        || 0);
  const cre          = Number(c.ventas_credito       || 0);
  const gastos       = Number(c.gastos               || 0);
  const efectivoNeto = ef - gastos;
  const ventas_total = ef + tar + tra + che + cre;
  const totalNeto    = ventas_total - gastos;
  const saldoEsperado = efectivoNeto;
  const diferencia    = c.efectivo_contado !== null && c.efectivo_contado !== undefined
    ? Number(c.efectivo_contado) - saldoEsperado
    : Number(c.diferencia || 0);

  const row = (label: string, val: string, color = "#111", bold = false) =>
    `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;">
       <span style="color:#555;">${label}</span>
       <span style="font-weight:${bold ? 800 : 500};color:${color};">${val}</span>
     </div>`;

  const section = (title: string, content: string) =>
    `<div style="margin-bottom:16px;">
       <div style="font-weight:700;font-size:12px;text-transform:uppercase;color:#6366f1;letter-spacing:.5px;margin-bottom:6px;border-bottom:2px solid #e0e7ff;padding-bottom:4px;">${title}</div>
       ${content}
     </div>`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>Cuadre de Caja — ${c.fecha}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;font-size:13px;padding:30px;max-width:640px;margin:auto;}
    h1{font-size:18px;font-weight:900;}
    h2{font-size:13px;font-weight:600;color:#555;}
    .total{font-size:17px;font-weight:900;}
    .sig{display:inline-block;border-top:1px solid #333;width:200px;text-align:center;font-size:11px;color:#555;padding-top:4px;margin-top:32px;}
    .badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;}
    .badge-auto{background:#dcfce7;color:#16a34a;}
    .badge-manual{background:#fef9c3;color:#854d0e;}
    .footer{text-align:center;font-size:11px;color:#aaa;margin-top:28px;border-top:1px dashed #ddd;padding-top:14px;}
    @media print{button{display:none!important;}}
  </style></head><body>
  <div style="text-align:center;margin-bottom:20px;">
    <h1>${EMPRESA.nombre}</h1>
    <h2>CUADRE DE CAJA — ${c.fecha}</h2>
    <div style="margin-top:6px;">
      <span class="badge badge-${(c.tipo || "AUTO").toLowerCase()}">${c.tipo || "AUTO"}</span>
      &nbsp;<span style="font-size:11px;color:#888;">Responsable: <b>${c.usuario}</b></span>
    </div>
  </div>


  ${section("Ventas del Taller",
    row("💵 Efectivo",       fmt(ef)) +
    row("💳 Tarjeta",        fmt(tar)) +
    row("🏦 Transferencia",  fmt(tra)) +
    (che > 0 ? row("🔖 Cheque",  fmt(che))  : "") +
    (cre > 0 ? row("📋 Crédito", fmt(cre))  : "") +
    `<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #6366f1;margin-top:4px;">
       <span style="font-weight:800;">TOTAL VENTAS BRUTAS</span>
       <span style="font-weight:800;font-size:15px;">${fmt(ventas_total)}</span>
     </div>`
  )}

  ${section("Egresos del Día", row("💸 Gastos caja chica (efectivo)", fmt(gastos), "#ef4444", true))}

  ${section("Cuadre Final — Neto por Método",
    row("💵 Efectivo bruto",            fmt(ef)) +
    row("   − Gastos caja chica",       fmt(gastos), "#ef4444") +
    `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;font-weight:700;color:${efectivoNeto>=0?"#065f46":"#991b1b"};">
       <span>   = Efectivo neto en caja</span><span>${fmt(efectivoNeto)}</span></div>` +
    (tar > 0 ? row("💳 Tarjeta (banco)", fmt(tar)) : "") +
    (tra > 0 ? row("🏦 Transferencia (banco)", fmt(tra)) : "") +
    (che > 0 ? row("🔖 Cheque", fmt(che)) : "") +
    (cre > 0 ? row("📋 Crédito pendiente", fmt(cre)) : "") +
    `<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #111;margin-top:4px;">
       <span style="font-weight:800;">TOTAL NETO DEL DÍA</span>
       <span style="font-weight:900;font-size:16px;color:${totalNeto>=0?"#065f46":"#991b1b"};">${fmt(totalNeto)}</span>
     </div>` +
    (c.efectivo_contado !== null && c.efectivo_contado !== undefined
      ? `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed #ddd;">` +
        row("💰 Efectivo contado físicamente", fmt(c.efectivo_contado), "#111", true) +
        `<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid ${diferencia >= 0 ? "#10b981" : "#ef4444"};margin-top:4px;">
           <span style="font-weight:800;">DIFERENCIA (contado − esperado)</span>
           <span style="font-weight:900;font-size:15px;color:${diferencia >= 0 ? "#10b981" : "#ef4444"};">${diferencia >= 0 ? "+" : ""}${fmt(diferencia)}</span>
         </div></div>`
      : `<div style="color:#888;font-size:12px;margin-top:6px;">Sin conteo físico registrado</div>`)
  )}

  ${c.notas ? section("Notas", `<p style="color:#555;font-size:13px;">${c.notas}</p>`) : ""}

  <div style="display:flex;justify-content:space-around;margin-top:16px;">
    <div style="text-align:center;">
      <div class="sig"></div>
      <div>Responsable</div>
      <div style="font-size:11px;color:#888;">${c.usuario}</div>
    </div>
    <div style="text-align:center;">
      <div class="sig"></div>
      <div>Supervisado por</div>
    </div>
  </div>

  <div class="footer">${EMPRESA.nombre} · ${EMPRESA.tel} · ${EMPRESA.dir}<br/>
  Impreso: ${new Date().toLocaleString("es-DO",{day:"numeric",month:"numeric",year:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:"America/Santo_Domingo"})}</div>
  </body></html>`;

  // Usar iframe oculto para evitar bloqueo de popups
  let frame = document.getElementById("cuadre-print-frame") as HTMLIFrameElement | null;
  if (!frame) {
    frame = document.createElement("iframe");
    frame.id = "cuadre-print-frame";
    frame.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:800px;height:600px;border:none;";
    document.body.appendChild(frame);
  }
  const doc = frame.contentDocument || frame.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  frame.onload = () => { frame!.contentWindow?.print(); };
}

function CuadreDeCaja({ usuario }: { usuario: Usuario }) {
  // Usar fecha en timezone de RD (UTC-4) para evitar el bug del día anterior
  const hoyDR = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" });
  const [historial, setHistorial] = useState<Cuadre[]>([]);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [fetching, setFetching]   = useState(false);
  const [guardadoMsg, setGuardadoMsg] = useState<string|null>(null);

  // Auto-cuadre preview
  const [preview, setPreview]     = useState<any>(null);
  const [fechaSel, setFechaSel]   = useState(hoyDR);
  const [efectContado, setEfectContado] = useState("");
  const [notas, setNotas]         = useState("");
  const [filtrFecha, setFiltrFecha] = useState("");

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

  useEffect(() => { cargar(); }, [cargar]);

  const generarPreview = async (fecha: string) => {
    setFetching(true);
    setPreview(null);
    try {
      const [rCuadre, rCobrar, rPagar] = await Promise.all([
        fetch(`${API}/api/contabilidad/cuadre/auto?fecha=${fecha}`),
        fetch(`${API}/api/contabilidad/cuentas-cobrar`),
        fetch(`${API}/api/contabilidad/cuentas-pagar`),
      ]);
      const d = await rCuadre.json();
      const cuentasCobrar = rCobrar.ok ? await rCobrar.json() : [];
      const cuentasPagar  = rPagar.ok  ? await rPagar.json()  : [];
      // Filtrar CxC y CxP con vencimiento hoy o pendientes del día
      const cobrarHoy = (Array.isArray(cuentasCobrar) ? cuentasCobrar : cuentasCobrar.data || [])
        .filter((c: any) => c.estado !== "pagado" && (c.fecha_vencimiento === fecha || c.fecha_emision === fecha));
      const pagarHoy  = (Array.isArray(cuentasPagar)  ? cuentasPagar  : cuentasPagar.data  || [])
        .filter((c: any) => c.estado !== "pagado" && (c.fecha_vencimiento === fecha || c.fecha_emision === fecha));
      setPreview({ ...d, cuentasCobrarHoy: cobrarHoy, cuentasPagarHoy: pagarHoy });
    } catch { alert("Error al cargar datos del día"); }
    setFetching(false);
  };

  const guardar = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const saldoEsperado = Number(preview.ventas_efectivo) - Number(preview.gastos);
      const efectivo_final = efectContado !== "" ? Number(efectContado) : saldoEsperado;
      const diferencia = efectContado !== "" ? Number(efectContado) - saldoEsperado : 0;

      const res = await fetch(`${API}/api/contabilidad/cuadre`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha:                preview.fecha,
          efectivo_inicial:     preview.efectivo_inicial,
          efectivo_final,
          ventas_efectivo:      preview.ventas_efectivo,
          ventas_tarjeta:       preview.ventas_tarjeta,
          ventas_transferencia: preview.ventas_transferencia,
          ventas_cheque:        preview.ventas_cheque || 0,
          ventas_credito:       preview.ventas_credito || 0,
          facturas_count:       preview.facturas_count || 0,
          tipo:                 "AUTO",
          efectivo_contado:     efectContado !== "" ? Number(efectContado) : null,
          notas:                notas || null,
          gastos:               preview.gastos,
          diferencia,
          usuario:              usuario?.nombre || "Sistema",
        }),
      });
      const data = await res.json();
      if (data.error) return alert("Error: " + data.error);

      setGuardadoMsg(data._updated
        ? "✅ Cuadre actualizado correctamente con las nuevas ventas del día."
        : "✅ Cuadre guardado correctamente.");
      setTimeout(() => setGuardadoMsg(null), 5000);
      setPreview(null);
      setEfectContado("");
      setNotas("");
      await cargar();
    } catch { alert("Error al guardar el cuadre"); }
    setSaving(false);
  };

  const saldoEsperado = preview
    ? Number(preview.ventas_efectivo) - Number(preview.gastos)
    : 0;
  const diferencia = efectContado !== "" ? Number(efectContado) - saldoEsperado : null;

  return (
    <div>
      {guardadoMsg && (
        <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:10, padding:"10px 16px", marginBottom:16, fontSize:13, color:"#166534", fontWeight:600 }}>
          {guardadoMsg}
        </div>
      )}

      {/* KPIs del último cuadre */}
      {historial.length > 0 && (() => {
        const ult = historial[0];
        const ventasTotales = Number(ult.ventas_efectivo||0)+Number(ult.ventas_tarjeta||0)+Number(ult.ventas_transferencia||0)+Number(ult.ventas_cheque||0)+Number(ult.ventas_credito||0);
        const totalNeto = ventasTotales - Number(ult.gastos||0);
        return (
          <div style={s.kpiRow}>
            <KpiCard label="Último cuadre" value={fmtDate(ult.fecha)} icon="📅" color="#6366f1" />
            <KpiCard label="Ventas totales" value={fmt(ventasTotales)} icon="💰" color="#10b981" />
            <KpiCard label="Facturas" value={String(ult.facturas_count || "—")} icon="🧾" color="#3b82f6" />
            <KpiCard label="Total (ventas − gastos)" value={fmt(totalNeto)} icon="⚖️" color={totalNeto >= 0 ? "#10b981" : "#ef4444"} />
          </div>
        );
      })()}

      {/* Selector de fecha + botón generar */}
      <div style={{ ...s.card, marginBottom: 20, border: "2px solid #6366f1" }}>
        <h3 style={{ ...s.cardTitle, color: "#4338ca" }}>⚡ Generar Cuadre de Caja</h3>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#444" }}>Fecha del cuadre</label>
            <input type="date" value={fechaSel}
              onChange={e => { setFechaSel(e.target.value); setPreview(null); }}
              style={{ ...s.input, marginBottom: 0 }} />
          </div>
          <button onClick={() => generarPreview(fechaSel)} disabled={fetching}
            style={{ ...s.btnPrimary, background: "#6366f1", minWidth: 180 }}>
            {fetching ? "⏳ Calculando..." : "⚡ Calcular automático"}
          </button>
        </div>

        {/* PREVIEW del cuadre auto */}
        {preview && (
          <div style={{ marginTop: 20 }}>
            {/* Banner info */}
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#166534" }}>
              ✅ <b>Datos calculados automáticamente para {fechaSel}</b> — <b>{preview.facturas_count}</b> factura{preview.facturas_count !== 1 ? "s" : ""} del taller · Egresos caja chica: {fmt(preview.gastos || 0)}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Columna izquierda: ventas por método */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".5px" }}>📥 Ventas del taller</div>
                {[
                  ["💵 Efectivo",       fmt(preview.ventas_efectivo      || 0)],
                  ["💳 Tarjeta",        fmt(preview.ventas_tarjeta       || 0)],
                  ["🏦 Transferencia",  fmt(preview.ventas_transferencia || 0)],
                  ...(Number(preview.ventas_cheque ||0)>0 ? [["🔖 Cheque",  fmt(preview.ventas_cheque)]]  : []),
                  ...(Number(preview.ventas_credito||0)>0 ? [["📋 Crédito", fmt(preview.ventas_credito)]] : []),
                ].map(([lbl, val]) => (
                  <div key={lbl} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f0f0f0", fontSize: 13 }}>
                    <span style={{ color: "#555" }}>{lbl}</span><span style={{ fontWeight: 600 }}>{val}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f0", fontSize: 13 }}>
                  <span style={{ color: "#ef4444" }}>− Gastos caja chica</span>
                  <span style={{ fontWeight: 600, color: "#ef4444" }}>{fmt(preview.gastos || 0)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "2px solid #6366f1", marginTop: 4, fontWeight: 800, fontSize: 14 }}>
                  <span>TOTAL DÍA (ventas − gastos)</span>
                  <span style={{ color: (preview.ventas_total||0) - (preview.gastos||0) >= 0 ? "#065f46" : "#991b1b" }}>
                    {fmt((preview.ventas_total || 0) - (preview.gastos || 0))}
                  </span>
                </div>
              </div>

              {/* Columna derecha: cuadre efectivo */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".5px" }}>⚖️ Cuadre de efectivo</div>
                {[
                  ["Efectivo inicial (caja anterior)", fmt(preview.efectivo_inicial || 0)],
                  ["+ Ventas en efectivo hoy",         fmt(preview.ventas_efectivo)],
                  ["− Gastos del día",                 fmt(preview.gastos)],
                ].map(([lbl, val]) => (
                  <div key={lbl} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f0f0f0", fontSize: 13 }}>
                    <span style={{ color: "#555" }}>{lbl}</span><span style={{ fontWeight: 600 }}>{val}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "2px solid #10b981", marginTop: 4, fontWeight: 800, fontSize: 15, color: "#065f46" }}>
                  <span>SALDO ESPERADO EN CAJA</span><span>{fmt(saldoEsperado)}</span>
                </div>

                {/* Conteo físico */}
                <div style={{ marginTop: 12 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5, color: "#444" }}>💰 Efectivo contado físicamente (opcional)</label>
                  <input type="number" value={efectContado} onChange={e => setEfectContado(e.target.value)}
                    placeholder="Deja vacío si no contaste" style={{ ...s.input, marginBottom: 0, fontSize: 14 }} />
                </div>
                {diferencia !== null && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `2px solid ${diferencia >= 0 ? "#10b981" : "#ef4444"}`, marginTop: 8, fontWeight: 800, fontSize: 15, color: diferencia >= 0 ? "#065f46" : "#991b1b" }}>
                    <span>DIFERENCIA (contado − esperado)</span>
                    <span>{diferencia >= 0 ? "+" : ""}{fmt(diferencia)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* CxC / CxP del día */}
            {((preview.cuentasCobrarHoy?.length > 0) || (preview.cuentasPagarHoy?.length > 0)) && (
              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {preview.cuentasCobrarHoy?.length > 0 && (
                  <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "12px 14px", border: "1px solid #bbf7d0" }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#15803d", textTransform: "uppercase", marginBottom: 8 }}>💳 Cuentas x Cobrar vencen hoy</div>
                    {preview.cuentasCobrarHoy.map((c: any, i: number) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: "1px solid #dcfce7" }}>
                        <span style={{ color: "#166534" }}>{c.descripcion || c.cliente_nombre || "—"}</span>
                        <span style={{ fontWeight: 700, color: "#15803d" }}>{fmt(c.monto_original - c.monto_pagado)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {preview.cuentasPagarHoy?.length > 0 && (
                  <div style={{ background: "#fff7ed", borderRadius: 10, padding: "12px 14px", border: "1px solid #fed7aa" }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#b45309", textTransform: "uppercase", marginBottom: 8 }}>📤 Cuentas x Pagar vencen hoy</div>
                    {preview.cuentasPagarHoy.map((c: any, i: number) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: "1px solid #fde68a" }}>
                        <span style={{ color: "#92400e" }}>{c.descripcion || c.suplidor_display || "—"}</span>
                        <span style={{ fontWeight: 700, color: "#b45309" }}>{fmt(c.monto_original - c.monto_pagado)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Notas */}
            <div style={{ marginTop: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5, color: "#444" }}>📝 Notas del cuadre (opcional)</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)}
                placeholder="Observaciones, incidencias, novedades..."
                style={{ ...s.input, height: 60, resize: "vertical" as any, marginBottom: 0, fontSize: 13 }} />
            </div>

            {/* Botones */}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={guardar} disabled={saving} style={{ ...s.btnPrimary, flex: 2, background: "#10b981" }}>
                {saving ? "Guardando..." : "💾 Confirmar y guardar cuadre"}
              </button>
              <button onClick={() => { setPreview(null); setEfectContado(""); setNotas(""); }}
                style={{ ...s.btnPrimary, flex: 1, background: "#6b7280" }}>
                ✕ Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* HISTORIAL */}
      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ ...s.cardTitle, marginBottom: 0 }}>📋 Historial de Cuadres</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#555", whiteSpace: "nowrap" }}>📅 Filtrar por fecha:</label>
            <input type="date" value={filtrFecha}
              onChange={e => setFiltrFecha(e.target.value)}
              style={{ ...s.input, marginBottom: 0, width: 160, fontSize: 13 }} />
            {filtrFecha && (
              <button onClick={() => setFiltrFecha("")}
                style={{ padding: "8px 12px", background: "#f1f5f9", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#555" }}>
                ✕ Limpiar
              </button>
            )}
          </div>
        </div>
        {loading ? <p style={s.empty}>Cargando...</p> : historial.length === 0 ? (
          <p style={s.empty}>Sin cuadres registrados aún.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {["Fecha", "Responsable", "Facturas", "Ventas Total", "Efectivo", "Tarjeta+Transf.", "Gastos", "Total Neto", ""].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historial.filter((c: Cuadre) => !filtrFecha || c.fecha === filtrFecha).map((c: Cuadre) => {
                  const vTot   = Number(c.ventas_efectivo||0)+Number(c.ventas_tarjeta||0)+Number(c.ventas_transferencia||0)+Number(c.ventas_cheque||0)+Number(c.ventas_credito||0);
                  const vOtros = Number(c.ventas_tarjeta||0)+Number(c.ventas_transferencia||0)+Number(c.ventas_cheque||0)+Number(c.ventas_credito||0);
                  const totalNeto = vTot - Number(c.gastos||0);
                  return (
                    <tr key={c.id}>
                      <td style={s.td}>
                        <b>{fmtDate(c.fecha)}</b>
                        {c.tipo === "AUTO" && <span style={{ marginLeft: 4, fontSize: 10, background: "#dcfce7", color: "#16a34a", padding: "1px 6px", borderRadius: 99, fontWeight: 700 }}>AUTO</span>}
                      </td>
                      <td style={s.td}>{c.usuario}</td>
                      <td style={{ ...s.td, textAlign: "center" }}>{c.facturas_count ?? "—"}</td>
                      <td style={{ ...s.td, fontWeight: 700 }}>{fmt(vTot)}</td>
                      <td style={s.td}>{fmt(c.ventas_efectivo)}</td>
                      <td style={s.td}>{fmt(vOtros)}</td>
                      <td style={{ ...s.td, color: "#ef4444" }}>{fmt(c.gastos)}</td>
                      <td style={{ ...s.td, fontWeight: 700, color: totalNeto >= 0 ? "#10b981" : "#ef4444" }}>
                        {fmt(totalNeto)}
                      </td>
                      <td style={s.td}>
                        <button onClick={() => imprimirCuadre(c)}
                          style={{ padding: "5px 10px", background: "#dbeafe", color: "#1d4ed8", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>
                          🖨️ Imprimir
                        </button>
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
// CUENTAS POR COBRAR
// ═══════════════════════════════════════════════════════════════════════════
type Cuenta = {
  id: number; cliente_id: number | null; factura_id: number | null;
  descripcion: string; monto_original: number; monto_pagado: number;
  saldo: number; fecha_emision: string; fecha_vencimiento: string;
  estado: string; notas: string; created_by: string;
};

function CuentasCobrar({ usuario }: { usuario: Usuario }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [cuentas, setCuentas]       = useState<Cuenta[]>([]);
  const [resumen, setResumen]       = useState<any>(null);
  const [loading, setLoading]       = useState(false);
  const [filtro, setFiltro]         = useState("TODOS");
  const [showForm, setShowForm]     = useState(false);
  const [modalPago, setModalPago]   = useState<Cuenta | null>(null);
  const [modalDetalle, setModalDetalle] = useState<{ cuenta: Cuenta; pagos: any[] } | null>(null);
  const [clientes, setClientes]     = useState<any[]>([]);
  const [savingPago, setSavingPago] = useState(false);

  const [form, setForm] = useState({
    cliente_id: "", descripcion: "", monto_original: "",
    fecha_emision: hoy, fecha_vencimiento: "", notas: "",
  });

  const [pagoForm, setPagoForm] = useState({
    monto: "", fecha: hoy, metodo: "EFECTIVO", referencia: "", notas: "",
  });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [rC, rR] = await Promise.all([
        fetch(`${API}/api/contabilidad/cuentas-cobrar${filtro !== "TODOS" ? `?estado=${filtro}` : ""}`),
        fetch(`${API}/api/contabilidad/cuentas-cobrar/resumen`),
      ]);
      const dC = await rC.json();
      const dR = await rR.json();
      setCuentas(Array.isArray(dC) ? dC : []);
      setResumen(dR);
    } catch { setCuentas([]); }
    setLoading(false);
  }, [filtro]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    fetch(`${API}/clientes`).then(r => r.json()).then(d => setClientes(Array.isArray(d) ? d : []));
  }, []);

  const guardarCuenta = async () => {
    if (!form.descripcion || !form.monto_original || !form.fecha_vencimiento)
      return alert("Descripción, monto y fecha de vencimiento son requeridos");
    try {
      const r = await fetch(`${API}/api/contabilidad/cuentas-cobrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
          monto_original: Number(form.monto_original),
          created_by: usuario?.nombre || "Sistema",
        }),
      });
      const d = await r.json();
      if (d.error) return alert(d.error);
      setShowForm(false);
      setForm({ cliente_id: "", descripcion: "", monto_original: "",
        fecha_emision: hoy, fecha_vencimiento: "", notas: "" });
      cargar();
    } catch (e: any) { alert(e.message); }
  };

  const registrarPago = async () => {
    if (!modalPago || !pagoForm.monto) return;
    setSavingPago(true);
    try {
      const r = await fetch(`${API}/api/contabilidad/cuentas-cobrar/${modalPago.id}/pago`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pagoForm,
          monto: Number(pagoForm.monto),
          usuario: usuario?.nombre || "Sistema",
        }),
      });
      const d = await r.json();
      if (d.error) return alert(d.error);
      setModalPago(null);
      setPagoForm({ monto: "", fecha: hoy, metodo: "EFECTIVO", referencia: "", notas: "" });
      cargar();
    } catch (e: any) { alert(e.message); }
    setSavingPago(false);
  };

  const verDetalle = async (c: Cuenta) => {
    const r = await fetch(`${API}/api/contabilidad/cuentas-cobrar/${c.id}`);
    const d = await r.json();
    setModalDetalle({ cuenta: d.cuenta, pagos: d.pagos });
  };

  const semColor = (c: Cuenta) => {
    if (c.estado === "PAGADO") return "#10b981";
    if (c.estado === "VENCIDO") return "#ef4444";
    const diasVence = Math.ceil((new Date(c.fecha_vencimiento).getTime() - Date.now()) / 86400000);
    if (diasVence <= 7) return "#f59e0b";
    return "#3b82f6";
  };

  const semEmoji = (c: Cuenta) => {
    if (c.estado === "PAGADO") return "✅";
    if (c.estado === "VENCIDO") return "🔴";
    const d = Math.ceil((new Date(c.fecha_vencimiento).getTime() - Date.now()) / 86400000);
    return d <= 7 ? "🟡" : "🟢";
  };

  return (
    <div>
      {/* KPIs */}
      {resumen && (
        <div style={s.kpiRow}>
          <KpiCard label="Total por cobrar" value={fmt(resumen.total_por_cobrar)} icon="💳" color="#3b82f6" big />
          <KpiCard label="Vencidas" value={fmt(resumen.vencidas)} icon="🔴" color="#ef4444" />
          <KpiCard label="Por vencer esta semana" value={fmt(resumen.por_vencer_semana)} icon="🟡" color="#f59e0b" />
          <KpiCard label="Cuentas activas" value={String(resumen.count)} icon="📋" color="#6366f1" />
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["TODOS", "PENDIENTE", "PARCIAL", "VENCIDO", "PAGADO"].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={filtro === f ? s.tabActive : s.tabInactive}>
              {f === "TODOS" ? "📋 Todas" : f === "PENDIENTE" ? "🟡 Pendientes"
                : f === "PARCIAL" ? "🔵 Parciales" : f === "VENCIDO" ? "🔴 Vencidas" : "✅ Pagadas"}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(f => !f)} style={s.btnPrimary}>
          {showForm ? "✕ Cancelar" : "➕ Nueva Cuenta"}
        </button>
      </div>

      {/* FORM NUEVA CUENTA */}
      {showForm && (
        <div style={{ ...s.card, marginBottom: 20, border: "2px solid #3b82f6" }}>
          <h3 style={{ ...s.cardTitle, color: "#1e40af" }}>💳 Registrar Cuenta por Cobrar</h3>
          <div style={s.formGrid}>
            <FormField label="Cliente">
              <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))} style={s.input}>
                <option value="">— Consumidor final / sin cliente —</option>
                {clientes.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Descripción / Concepto">
              <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Ej: Factura B0100000012 — Servicio de frenos" style={s.input} />
            </FormField>
            <FormField label="Monto (RD$)">
              <input type="number" value={form.monto_original}
                onChange={e => setForm(f => ({ ...f, monto_original: e.target.value }))}
                placeholder="0.00" style={s.input} />
            </FormField>
            <FormField label="Fecha de emisión">
              <input type="date" value={form.fecha_emision}
                onChange={e => setForm(f => ({ ...f, fecha_emision: e.target.value }))} style={s.input} />
            </FormField>
            <FormField label="Fecha de vencimiento">
              <input type="date" value={form.fecha_vencimiento}
                onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} style={s.input} />
            </FormField>
            <FormField label="Notas (opcional)">
              <input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Observaciones..." style={s.input} />
            </FormField>
          </div>
          <button onClick={guardarCuenta} style={{ ...s.btnPrimary, width: "100%", marginTop: 4 }}>
            💾 Guardar Cuenta
          </button>
        </div>
      )}

      {/* TABLA */}
      <div style={s.card}>
        <h3 style={s.cardTitle}>💳 Cuentas por Cobrar ({cuentas.length})</h3>
        {loading ? <p style={s.empty}>Cargando...</p> : cuentas.length === 0 ? (
          <p style={s.empty}>No hay cuentas en este filtro.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {["", "Descripción", "Emitida", "Vence", "Original", "Pagado", "Saldo", "Estado", "Acciones"].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cuentas.map((c: Cuenta) => (
                  <tr key={c.id} style={{ background: c.estado === "VENCIDO" ? "#fff5f5" : "transparent" }}>
                    <td style={s.td}>{semEmoji(c)}</td>
                    <td style={{ ...s.td, maxWidth: 220 }}>
                      <div style={{ fontWeight: 600 }}>{c.descripcion}</div>
                      {c.notas && <div style={{ fontSize: 11, color: "#888" }}>{c.notas}</div>}
                    </td>
                    <td style={s.td}>{fmtDate(c.fecha_emision)}</td>
                    <td style={{ ...s.td, fontWeight: 700, color: semColor(c) }}>{fmtDate(c.fecha_vencimiento)}</td>
                    <td style={s.td}>{fmt(c.monto_original)}</td>
                    <td style={{ ...s.td, color: "#10b981" }}>{fmt(c.monto_pagado)}</td>
                    <td style={{ ...s.td, fontWeight: 700, color: semColor(c) }}>{fmt(c.saldo ?? (c.monto_original - c.monto_pagado))}</td>
                    <td style={s.td}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: c.estado === "PAGADO" ? "#dcfce7" : c.estado === "VENCIDO" ? "#fee2e2"
                          : c.estado === "PARCIAL" ? "#dbeafe" : "#fef3c7",
                        color: c.estado === "PAGADO" ? "#166534" : c.estado === "VENCIDO" ? "#dc2626"
                          : c.estado === "PARCIAL" ? "#1e40af" : "#d97706",
                      }}>{c.estado}</span>
                    </td>
                    <td style={s.td}>
                      <div style={{ display: "flex", gap: 5 }}>
                        {c.estado !== "PAGADO" && (
                          <button onClick={() => { setModalPago(c); setPagoForm({ monto: String(c.saldo ?? (c.monto_original - c.monto_pagado)), fecha: hoy, metodo: "EFECTIVO", referencia: "", notas: "" }); }}
                            style={{ ...s.btnSmall || { padding: "5px 10px", background: "#10b981", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 } }}>
                            💰 Cobrar
                          </button>
                        )}
                        <button onClick={() => verDetalle(c)}
                          style={{ padding: "5px 10px", background: "#f1f5f9", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                          👁️ Ver
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL REGISTRAR PAGO */}
      {modalPago && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 440, maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
            <h3 style={{ ...s.cardTitle, marginBottom: 6 }}>💰 Registrar Pago</h3>
            <p style={{ color: "#555", fontSize: 14, marginBottom: 16 }}>
              {modalPago.descripcion}<br />
              <strong>Saldo: {fmt(modalPago.saldo ?? (modalPago.monto_original - modalPago.monto_pagado))}</strong>
            </p>
            <div style={s.formGrid}>
              <FormField label="Monto a cobrar (RD$)">
                <input type="number" value={pagoForm.monto}
                  onChange={e => setPagoForm(p => ({ ...p, monto: e.target.value }))}
                  style={s.input} />
              </FormField>
              <FormField label="Fecha">
                <input type="date" value={pagoForm.fecha}
                  onChange={e => setPagoForm(p => ({ ...p, fecha: e.target.value }))}
                  style={s.input} />
              </FormField>
              <FormField label="Método">
                <select value={pagoForm.metodo} onChange={e => setPagoForm(p => ({ ...p, metodo: e.target.value }))} style={s.input}>
                  <option value="EFECTIVO">💵 Efectivo</option>
                  <option value="TARJETA">💳 Tarjeta</option>
                  <option value="TRANSFERENCIA">🏦 Transferencia</option>
                  <option value="CHEQUE">📄 Cheque</option>
                </select>
              </FormField>
              <FormField label="Referencia (opcional)">
                <input value={pagoForm.referencia}
                  onChange={e => setPagoForm(p => ({ ...p, referencia: e.target.value }))}
                  placeholder="No. transferencia / cheque" style={s.input} />
              </FormField>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={registrarPago} disabled={savingPago}
                style={{ ...s.btnPrimary, flex: 1, background: "#10b981" }}>
                {savingPago ? "Guardando..." : "✅ Confirmar Pago"}
              </button>
              <button onClick={() => setModalPago(null)}
                style={{ ...s.btnPrimary, flex: 1, background: "#6b7280" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE */}
      {modalDetalle && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 520, maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,.3)", maxHeight: "85vh", overflowY: "auto" }}>
            <h3 style={{ ...s.cardTitle, marginBottom: 6 }}>📋 Detalle de Cuenta</h3>
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 14 }}>
              <div style={s.resumenRow}><span>Descripción</span><span style={{ fontWeight: 600 }}>{modalDetalle.cuenta.descripcion}</span></div>
              <div style={s.resumenRow}><span>Monto original</span><span style={{ fontWeight: 700 }}>{fmt(modalDetalle.cuenta.monto_original)}</span></div>
              <div style={s.resumenRow}><span>Total pagado</span><span style={{ color: "#10b981", fontWeight: 700 }}>{fmt(modalDetalle.cuenta.monto_pagado)}</span></div>
              <div style={{ ...s.resumenRow, borderTop: "2px solid #e2e8f0", paddingTop: 8, fontWeight: 800 }}>
                <span>Saldo pendiente</span>
                <span style={{ color: "#3b82f6" }}>{fmt(modalDetalle.cuenta.monto_original - modalDetalle.cuenta.monto_pagado)}</span>
              </div>
            </div>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Historial de Pagos</h4>
            {modalDetalle.pagos.length === 0 ? (
              <p style={{ ...s.empty, padding: "12px 0" }}>Sin pagos registrados aún.</p>
            ) : (
              <table style={s.table}>
                <thead>
                  <tr>{["Fecha", "Monto", "Método", "Referencia", "Usuario"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {modalDetalle.pagos.map((p: any) => (
                    <tr key={p.id}>
                      <td style={s.td}>{fmtDate(p.fecha)}</td>
                      <td style={{ ...s.td, fontWeight: 700, color: "#10b981" }}>{fmt(p.monto)}</td>
                      <td style={s.td}>{p.metodo}</td>
                      <td style={s.td}>{p.referencia || "—"}</td>
                      <td style={s.td}>{p.usuario || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => imprimirRecibo(modalDetalle.cuenta, modalDetalle.pagos, "cobrar")}
                style={{ ...s.btnPrimary, flex: 1, background: "#2563eb" }}>🖨️ Imprimir</button>
              <button onClick={() => setModalDetalle(null)}
                style={{ ...s.btnPrimary, flex: 1, background: "#6b7280" }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CUENTAS POR PAGAR
// ═══════════════════════════════════════════════════════════════════════════
function CuentasPagar({ usuario }: { usuario: Usuario }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [cuentas, setCuentas]       = useState<CuentaPagar[]>([]);
  const [resumen, setResumen]       = useState<any>(null);
  const [loading, setLoading]       = useState(false);
  const [filtro, setFiltro]         = useState("TODOS");
  const [showForm, setShowForm]     = useState(false);
  const [modalPago, setModalPago]   = useState<CuentaPagar | null>(null);
  const [modalDetalle, setModalDetalle] = useState<{ cuenta: CuentaPagar; pagos: any[] } | null>(null);
  const [suplidores, setSuplidores] = useState<any[]>([]);
  const [savingPago, setSavingPago] = useState(false);

  const [form, setForm] = useState({
    suplidor_id: "", suplidor_nombre: "", descripcion: "",
    monto_original: "", fecha_emision: hoy, fecha_vencimiento: "", notas: "",
  });
  const [pagoForm, setPagoForm] = useState({
    monto: "", fecha: hoy, metodo: "EFECTIVO", referencia: "", notas: "",
  });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [rC, rR] = await Promise.all([
        fetch(`${API}/api/contabilidad/cuentas-pagar${filtro !== "TODOS" ? `?estado=${filtro}` : ""}`),
        fetch(`${API}/api/contabilidad/cuentas-pagar/resumen`),
      ]);
      const dC = await rC.json();
      const dR = await rR.json();
      setCuentas(Array.isArray(dC) ? dC : []);
      setResumen(dR);
    } catch { setCuentas([]); }
    setLoading(false);
  }, [filtro]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    fetch(`${API}/suplidores`).then(r => r.json()).then(d => setSuplidores(Array.isArray(d) ? d : []));
  }, []);

  const guardarCuenta = async () => {
    if (!form.descripcion || !form.monto_original || !form.fecha_vencimiento)
      return alert("Descripción, monto y fecha de vencimiento son requeridos");
    try {
      const r = await fetch(`${API}/api/contabilidad/cuentas-pagar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          suplidor_id: form.suplidor_id ? Number(form.suplidor_id) : null,
          monto_original: Number(form.monto_original),
          created_by: usuario?.nombre || "Sistema",
        }),
      });
      const d = await r.json();
      if (d.error) return alert(d.error);
      setShowForm(false);
      setForm({ suplidor_id: "", suplidor_nombre: "", descripcion: "",
        monto_original: "", fecha_emision: hoy, fecha_vencimiento: "", notas: "" });
      cargar();
    } catch (e: any) { alert(e.message); }
  };

  const registrarPago = async () => {
    if (!modalPago || !pagoForm.monto) return;
    setSavingPago(true);
    try {
      const r = await fetch(`${API}/api/contabilidad/cuentas-pagar/${modalPago.id}/pago`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pagoForm, monto: Number(pagoForm.monto), usuario: usuario?.nombre || "Sistema" }),
      });
      const d = await r.json();
      if (d.error) return alert(d.error);
      setModalPago(null);
      setPagoForm({ monto: "", fecha: hoy, metodo: "EFECTIVO", referencia: "", notas: "" });
      cargar();
    } catch (e: any) { alert(e.message); }
    setSavingPago(false);
  };

  const verDetalle = async (c: CuentaPagar) => {
    const r = await fetch(`${API}/api/contabilidad/cuentas-pagar/${c.id}`);
    const d = await r.json();
    setModalDetalle({ cuenta: d.cuenta, pagos: d.pagos });
  };

  const semColor = (c: CuentaPagar) => {
    if (c.estado === "PAGADO") return "#10b981";
    if (c.estado === "VENCIDO") return "#ef4444";
    const dias = Math.ceil((new Date(c.fecha_vencimiento).getTime() - Date.now()) / 86400000);
    return dias <= 7 ? "#f59e0b" : "#6366f1";
  };

  const semEmoji = (c: CuentaPagar) => {
    if (c.estado === "PAGADO") return "✅";
    if (c.estado === "VENCIDO") return "🔴";
    const d = Math.ceil((new Date(c.fecha_vencimiento).getTime() - Date.now()) / 86400000);
    return d <= 7 ? "🟡" : "🟢";
  };

  return (
    <div>
      {/* KPIs */}
      {resumen && (
        <div style={s.kpiRow}>
          <KpiCard label="Total por pagar"         value={fmt(resumen.total_por_pagar)}    icon="📤" color="#6366f1" big />
          <KpiCard label="Vencidas"                value={fmt(resumen.vencidas)}           icon="🔴" color="#ef4444" />
          <KpiCard label="Por vencer esta semana"  value={fmt(resumen.por_vencer_semana)}  icon="🟡" color="#f59e0b" />
          <KpiCard label="Cuentas activas"         value={String(resumen.count)}           icon="📋" color="#8b5cf6" />
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["TODOS", "PENDIENTE", "PARCIAL", "VENCIDO", "PAGADO"].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={filtro === f ? s.tabActive : s.tabInactive}>
              {f === "TODOS" ? "📋 Todas" : f === "PENDIENTE" ? "🟡 Pendientes"
                : f === "PARCIAL" ? "🔵 Parciales" : f === "VENCIDO" ? "🔴 Vencidas" : "✅ Pagadas"}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(f => !f)} style={{ ...s.btnPrimary, background: "#6366f1" }}>
          {showForm ? "✕ Cancelar" : "➕ Nueva Cuenta"}
        </button>
      </div>

      {/* FORM NUEVA CUENTA */}
      {showForm && (
        <div style={{ ...s.card, marginBottom: 20, border: "2px solid #6366f1" }}>
          <h3 style={{ ...s.cardTitle, color: "#4338ca" }}>📤 Registrar Cuenta por Pagar</h3>
          <div style={s.formGrid}>
            <FormField label="Suplidor (del catálogo)">
              <select value={form.suplidor_id}
                onChange={e => {
                  const sup = suplidores.find((s: any) => String(s.id) === e.target.value);
                  setForm(f => ({ ...f, suplidor_id: e.target.value, suplidor_nombre: sup?.nombre || "" }));
                }} style={s.input}>
                <option value="">— Seleccionar suplidor —</option>
                {suplidores.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </FormField>
            <FormField label="Suplidor (nombre libre si no está en lista)">
              <input value={form.suplidor_nombre}
                onChange={e => setForm(f => ({ ...f, suplidor_nombre: e.target.value }))}
                placeholder="Ej: Ferretería El Clavo" style={s.input} />
            </FormField>
            <FormField label="Descripción / Concepto">
              <input value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Ej: Factura #001 — Compra de filtros" style={s.input} />
            </FormField>
            <FormField label="Monto (RD$)">
              <input type="number" value={form.monto_original}
                onChange={e => setForm(f => ({ ...f, monto_original: e.target.value }))}
                placeholder="0.00" style={s.input} />
            </FormField>
            <FormField label="Fecha de emisión">
              <input type="date" value={form.fecha_emision}
                onChange={e => setForm(f => ({ ...f, fecha_emision: e.target.value }))} style={s.input} />
            </FormField>
            <FormField label="Fecha de vencimiento">
              <input type="date" value={form.fecha_vencimiento}
                onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} style={s.input} />
            </FormField>
            <FormField label="Notas (opcional)">
              <input value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Observaciones..." style={s.input} />
            </FormField>
          </div>
          <button onClick={guardarCuenta} style={{ ...s.btnPrimary, width: "100%", marginTop: 4, background: "#6366f1" }}>
            💾 Guardar Cuenta
          </button>
        </div>
      )}

      {/* TABLA */}
      <div style={s.card}>
        <h3 style={s.cardTitle}>📤 Cuentas por Pagar ({cuentas.length})</h3>
        {loading ? <p style={s.empty}>Cargando...</p> : cuentas.length === 0 ? (
          <p style={s.empty}>No hay cuentas en este filtro.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {["", "Suplidor / Descripción", "Emitida", "Vence", "Original", "Pagado", "Saldo", "Estado", "Acciones"].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cuentas.map((c: CuentaPagar) => (
                  <tr key={c.id} style={{ background: c.estado === "VENCIDO" ? "#fdf2f2" : "transparent" }}>
                    <td style={s.td}>{semEmoji(c)}</td>
                    <td style={{ ...s.td, maxWidth: 240 }}>
                      {c.suplidor_display && c.suplidor_display !== "—" && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", marginBottom: 2 }}>
                          🏭 {c.suplidor_display}
                        </div>
                      )}
                      <div style={{ fontWeight: 600 }}>{c.descripcion}</div>
                      {c.notas && <div style={{ fontSize: 11, color: "#888" }}>{c.notas}</div>}
                    </td>
                    <td style={s.td}>{fmtDate(c.fecha_emision)}</td>
                    <td style={{ ...s.td, fontWeight: 700, color: semColor(c) }}>{fmtDate(c.fecha_vencimiento)}</td>
                    <td style={s.td}>{fmt(c.monto_original)}</td>
                    <td style={{ ...s.td, color: "#10b981" }}>{fmt(c.monto_pagado)}</td>
                    <td style={{ ...s.td, fontWeight: 700, color: semColor(c) }}>{fmt(c.saldo ?? (c.monto_original - c.monto_pagado))}</td>
                    <td style={s.td}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: c.estado === "PAGADO" ? "#dcfce7" : c.estado === "VENCIDO" ? "#fee2e2"
                          : c.estado === "PARCIAL" ? "#ede9fe" : "#fef3c7",
                        color: c.estado === "PAGADO" ? "#166534" : c.estado === "VENCIDO" ? "#dc2626"
                          : c.estado === "PARCIAL" ? "#4338ca" : "#d97706",
                      }}>{c.estado}</span>
                    </td>
                    <td style={s.td}>
                      <div style={{ display: "flex", gap: 5 }}>
                        {c.estado !== "PAGADO" && c.estado !== "ANULADO" && (
                          <button
                            onClick={() => { setModalPago(c); setPagoForm({ monto: String(c.saldo ?? (c.monto_original - c.monto_pagado)), fecha: hoy, metodo: "EFECTIVO", referencia: "", notas: "" }); }}
                            style={{ padding: "5px 10px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                            💸 Pagar
                          </button>
                        )}
                        <button onClick={() => verDetalle(c)}
                          style={{ padding: "5px 10px", background: "#f1f5f9", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                          👁️ Ver
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL REGISTRAR PAGO */}
      {modalPago && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 440, maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
            <h3 style={{ ...s.cardTitle, marginBottom: 6 }}>💸 Registrar Pago</h3>
            <p style={{ color: "#555", fontSize: 14, marginBottom: 16 }}>
              {modalPago.suplidor_display && modalPago.suplidor_display !== "—" && (
                <><strong style={{ color: "#6366f1" }}>🏭 {modalPago.suplidor_display}</strong><br /></>
              )}
              {modalPago.descripcion}<br />
              <strong>Saldo: {fmt(modalPago.saldo ?? (modalPago.monto_original - modalPago.monto_pagado))}</strong>
            </p>
            <div style={s.formGrid}>
              <FormField label="Monto a pagar (RD$)">
                <input type="number" value={pagoForm.monto}
                  onChange={e => setPagoForm(p => ({ ...p, monto: e.target.value }))} style={s.input} />
              </FormField>
              <FormField label="Fecha">
                <input type="date" value={pagoForm.fecha}
                  onChange={e => setPagoForm(p => ({ ...p, fecha: e.target.value }))} style={s.input} />
              </FormField>
              <FormField label="Método">
                <select value={pagoForm.metodo} onChange={e => setPagoForm(p => ({ ...p, metodo: e.target.value }))} style={s.input}>
                  <option value="EFECTIVO">💵 Efectivo</option>
                  <option value="TARJETA">💳 Tarjeta</option>
                  <option value="TRANSFERENCIA">🏦 Transferencia</option>
                  <option value="CHEQUE">📄 Cheque</option>
                </select>
              </FormField>
              <FormField label="Referencia (opcional)">
                <input value={pagoForm.referencia}
                  onChange={e => setPagoForm(p => ({ ...p, referencia: e.target.value }))}
                  placeholder="No. cheque / transferencia" style={s.input} />
              </FormField>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={registrarPago} disabled={savingPago}
                style={{ ...s.btnPrimary, flex: 1, background: "#6366f1" }}>
                {savingPago ? "Guardando..." : "✅ Confirmar Pago"}
              </button>
              <button onClick={() => setModalPago(null)}
                style={{ ...s.btnPrimary, flex: 1, background: "#6b7280" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE */}
      {modalDetalle && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 520, maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,.3)", maxHeight: "85vh", overflowY: "auto" }}>
            <h3 style={{ ...s.cardTitle, marginBottom: 6 }}>📋 Detalle de Cuenta</h3>
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 14 }}>
              {modalDetalle.cuenta.suplidor_display && modalDetalle.cuenta.suplidor_display !== "—" && (
                <div style={s.resumenRow}><span>Suplidor</span><span style={{ fontWeight: 700, color: "#6366f1" }}>{modalDetalle.cuenta.suplidor_display}</span></div>
              )}
              <div style={s.resumenRow}><span>Descripción</span><span style={{ fontWeight: 600 }}>{modalDetalle.cuenta.descripcion}</span></div>
              <div style={s.resumenRow}><span>Monto original</span><span style={{ fontWeight: 700 }}>{fmt(modalDetalle.cuenta.monto_original)}</span></div>
              <div style={s.resumenRow}><span>Total pagado</span><span style={{ color: "#10b981", fontWeight: 700 }}>{fmt(modalDetalle.cuenta.monto_pagado)}</span></div>
              <div style={{ ...s.resumenRow, borderTop: "2px solid #e2e8f0", paddingTop: 8, fontWeight: 800 }}>
                <span>Saldo pendiente</span>
                <span style={{ color: "#6366f1" }}>{fmt(modalDetalle.cuenta.monto_original - modalDetalle.cuenta.monto_pagado)}</span>
              </div>
            </div>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Historial de Pagos</h4>
            {modalDetalle.pagos.length === 0 ? (
              <p style={{ ...s.empty, padding: "12px 0" }}>Sin pagos registrados aún.</p>
            ) : (
              <table style={s.table}>
                <thead>
                  <tr>{["Fecha", "Monto", "Método", "Referencia", "Usuario"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {modalDetalle.pagos.map((p: any) => (
                    <tr key={p.id}>
                      <td style={s.td}>{fmtDate(p.fecha)}</td>
                      <td style={{ ...s.td, fontWeight: 700, color: "#6366f1" }}>{fmt(p.monto)}</td>
                      <td style={s.td}>{p.metodo}</td>
                      <td style={s.td}>{p.referencia || "—"}</td>
                      <td style={s.td}>{p.usuario || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => imprimirRecibo(modalDetalle.cuenta, modalDetalle.pagos, "pagar")}
                style={{ ...s.btnPrimary, flex: 1, background: "#6366f1" }}>🖨️ Imprimir</button>
              <button onClick={() => setModalDetalle(null)}
                style={{ ...s.btnPrimary, flex: 1, background: "#6b7280" }}>Cerrar</button>
            </div>
          </div>
        </div>
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
// NÓMINA — República Dominicana (TSS + ISR + comisiones de técnicos)
// ═══════════════════════════════════════════════════════════════════════════
type Empleado = {
  id: number; usuario_id: number | null; nombre: string; cedula: string | null;
  telefono: string | null; puesto: string | null; tipo: "tecnico" | "administrativo";
  fecha_ingreso: string | null; salario_mensual: number; frecuencia_pago: "QUINCENAL" | "MENSUAL";
  comision_pct: number; metodo_pago: string | null; banco: string | null; cuenta_banco: string | null;
  tss_aplica: boolean; isr_aplica: boolean; activo: boolean; notas: string | null;
};

type NominaRun = {
  id: number; tipo: string; periodo_inicio: string; periodo_fin: string; estado: string;
  total_bruto: number; total_deducciones: number; total_neto: number; total_aporte_empleador: number;
  creado_por: string | null; pagada_at: string | null; detalle?: NominaDet[];
};

type NominaDet = {
  id: number; empleado_id: number; empleado_nombre: string; puesto: string | null;
  salario_base: number; comisiones: number; comisiones_detalle: any[]; horas_extra: number;
  otros_ingresos: number; otros_ingresos_desc: string | null; total_bruto: number;
  afp_empleado: number; sfs_empleado: number; isr: number; otros_descuentos: number;
  otros_descuentos_desc: string | null; total_deducciones: number; neto: number;
  afp_empleador: number; sfs_empleador: number; srl_empleador: number; infotep: number;
  metodo_pago: string | null;
};

const TIPO_NOMINA_LABEL: Record<string, string> = {
  QUINCENA_1: "1ra Quincena", QUINCENA_2: "2da Quincena", MENSUAL: "Mensual", REGALIA: "Regalía Pascual",
};

function imprimirVolante(n: NominaRun, d: NominaDet) {
  const _e = getEmpresaSync();
  const row = (label: string, val: string, color = "#111", bold = false) =>
    `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f0f0f0;">
       <span style="color:#555;">${label}</span><span style="font-weight:${bold ? 800 : 500};color:${color};">${val}</span></div>`;
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Volante de Pago</title>
  <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:13px;padding:30px;max-width:600px;margin:auto;}
  h1{font-size:18px;font-weight:900;}.sec{font-weight:700;font-size:12px;text-transform:uppercase;color:#6366f1;letter-spacing:.5px;margin:16px 0 6px;border-bottom:2px solid #e0e7ff;padding-bottom:4px;}
  .sig{display:inline-block;border-top:1px solid #333;width:200px;text-align:center;font-size:11px;color:#555;padding-top:4px;margin-top:36px;}
  @media print{button{display:none!important;}}</style></head><body>
  <div style="text-align:center;margin-bottom:14px;">
    <h1>${_e.nombre}</h1>
    <div style="font-size:13px;font-weight:600;color:#555;">VOLANTE DE PAGO — ${TIPO_NOMINA_LABEL[n.tipo] || n.tipo}</div>
    <div style="font-size:12px;color:#888;">Período: ${fmtDate(n.periodo_inicio)} al ${fmtDate(n.periodo_fin)}</div>
  </div>
  ${row("Empleado", d.empleado_nombre, "#111", true)}
  ${d.puesto ? row("Puesto", d.puesto) : ""}
  ${row("Método de pago", d.metodo_pago || "—")}
  <div class="sec">Ingresos</div>
  ${row("Salario base", fmt(d.salario_base))}
  ${Number(d.comisiones) > 0 ? row(`Comisiones (${(d.comisiones_detalle || []).length} factura${(d.comisiones_detalle || []).length === 1 ? "" : "s"})`, fmt(d.comisiones)) : ""}
  ${Number(d.horas_extra) > 0 ? row("Horas extra", fmt(d.horas_extra)) : ""}
  ${Number(d.otros_ingresos) > 0 ? row(d.otros_ingresos_desc || "Otros ingresos", fmt(d.otros_ingresos)) : ""}
  ${row("TOTAL BRUTO", fmt(d.total_bruto), "#111", true)}
  <div class="sec">Deducciones</div>
  ${row("AFP (2.87%)", fmt(d.afp_empleado), "#ef4444")}
  ${row("SFS (3.04%)", fmt(d.sfs_empleado), "#ef4444")}
  ${row("ISR", fmt(d.isr), "#ef4444")}
  ${Number(d.otros_descuentos) > 0 ? row(d.otros_descuentos_desc || "Otros descuentos", fmt(d.otros_descuentos), "#ef4444") : ""}
  ${row("Total deducciones", fmt(d.total_deducciones), "#ef4444", true)}
  <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:3px solid #111;margin-top:8px;">
    <span style="font-weight:900;font-size:16px;">NETO A PAGAR</span>
    <span style="font-weight:900;font-size:18px;color:#10b981;">${fmt(d.neto)}</span>
  </div>
  <div style="display:flex;justify-content:space-around;">
    <div style="text-align:center;"><div class="sig"></div><div>Empleado</div></div>
    <div style="text-align:center;"><div class="sig"></div><div>Empresa</div></div>
  </div>
  <div style="text-align:center;margin-top:24px;font-size:11px;color:#888;border-top:1px dashed #ccc;padding-top:12px;">
    ${_e.nombre} · ${_e.telefono} · Impreso: ${fmtDatetime(new Date().toISOString())}
  </div>
  <script>setTimeout(()=>window.print(),500);<\/script></body></html>`;
  const w = window.open("", "_blank", "width=700,height=600");
  if (w) { w.document.write(html); w.document.close(); }
}

const EMPLEADO_VACIO = {
  nombre: "", cedula: "", telefono: "", puesto: "", tipo: "administrativo", usuario_id: "",
  fecha_ingreso: "", salario_mensual: "", frecuencia_pago: "QUINCENAL", comision_pct: "",
  metodo_pago: "TRANSFERENCIA", banco: "", cuenta_banco: "", tss_aplica: true, isr_aplica: true,
};

function Nomina({ usuario }: { usuario: Usuario }) {
  const [vista, setVista] = useState<"nominas" | "empleados">("nominas");
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [nominas, setNominas] = useState<NominaRun[]>([]);
  const [detalle, setDetalle] = useState<NominaRun | null>(null);
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState("");

  // Form empleado
  const [formVisible, setFormVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<any>(EMPLEADO_VACIO);

  // Generar nómina
  const hoy = new Date();
  const y = hoy.getFullYear(), m = hoy.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const finMes = new Date(y, m + 1, 0).getDate();
  const [genTipo, setGenTipo] = useState("QUINCENA_1");
  const [genInicio, setGenInicio] = useState(`${y}-${pad(m + 1)}-01`);
  const [genFin, setGenFin] = useState(`${y}-${pad(m + 1)}-15`);

  const cambiarTipo = (t: string) => {
    setGenTipo(t);
    if (t === "QUINCENA_1") { setGenInicio(`${y}-${pad(m + 1)}-01`); setGenFin(`${y}-${pad(m + 1)}-15`); }
    else if (t === "QUINCENA_2") { setGenInicio(`${y}-${pad(m + 1)}-16`); setGenFin(`${y}-${pad(m + 1)}-${pad(finMes)}`); }
    else if (t === "MENSUAL") { setGenInicio(`${y}-${pad(m + 1)}-01`); setGenFin(`${y}-${pad(m + 1)}-${pad(finMes)}`); }
    else { setGenInicio(`${y}-01-01`); setGenFin(`${y}-12-31`); }
  };

  const cargar = useCallback(async () => {
    try {
      const [rE, rN, rU] = await Promise.all([
        fetch(`${API}/api/nomina/empleados`), fetch(`${API}/api/nomina`), fetch(`${API}/usuarios`),
      ]);
      setEmpleados(await rE.json());
      setNominas(await rN.json());
      const us = await rU.json();
      setUsuarios(Array.isArray(us) ? us : us.usuarios || []);
    } catch { setMsg("Error cargando datos"); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirDetalle = async (id: number) => {
    const r = await fetch(`${API}/api/nomina/${id}`);
    const d = await r.json();
    if (d.error) { setMsg(d.error); return; }
    setDetalle(d);
  };

  // ── Empleados CRUD ──
  const guardarEmpleado = async () => {
    if (!form.nombre || !Number(form.salario_mensual)) { setMsg("Nombre y salario son obligatorios"); return; }
    setCargando(true);
    const body = {
      ...form,
      usuario_id: form.usuario_id ? Number(form.usuario_id) : null,
      salario_mensual: Number(form.salario_mensual),
      comision_pct: Number(form.comision_pct) || 0,
      fecha_ingreso: form.fecha_ingreso || null,
    };
    const r = await fetch(`${API}/api/nomina/empleados${editId ? `/${editId}` : ""}`, {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    setCargando(false);
    if (d.error) { setMsg(d.error); return; }
    setMsg(editId ? "✅ Empleado actualizado" : "✅ Empleado registrado");
    setFormVisible(false); setEditId(null); setForm(EMPLEADO_VACIO);
    cargar();
  };

  const editarEmpleado = (e: Empleado) => {
    setForm({
      nombre: e.nombre, cedula: e.cedula || "", telefono: e.telefono || "", puesto: e.puesto || "",
      tipo: e.tipo, usuario_id: e.usuario_id ? String(e.usuario_id) : "", fecha_ingreso: e.fecha_ingreso || "",
      salario_mensual: String(e.salario_mensual), frecuencia_pago: e.frecuencia_pago,
      comision_pct: String(e.comision_pct || ""), metodo_pago: e.metodo_pago || "TRANSFERENCIA",
      banco: e.banco || "", cuenta_banco: e.cuenta_banco || "", tss_aplica: e.tss_aplica, isr_aplica: e.isr_aplica,
    });
    setEditId(e.id); setFormVisible(true);
  };

  const toggleActivo = async (e: Empleado) => {
    await fetch(`${API}/api/nomina/empleados/${e.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !e.activo }),
    });
    cargar();
  };

  // ── Nóminas ──
  const generarNomina = async () => {
    setCargando(true); setMsg("");
    const r = await fetch(`${API}/api/nomina/generar`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: genTipo, periodo_inicio: genInicio, periodo_fin: genFin, creado_por: usuario?.nombre }),
    });
    const d = await r.json();
    setCargando(false);
    if (d.error) { setMsg(`⚠️ ${d.error}`); return; }
    setMsg("✅ Nómina generada en borrador — revísala y márcala como pagada");
    await cargar();
    abrirDetalle(d.nomina_id);
  };

  const ajustarFila = async (fila: NominaDet) => {
    const he = prompt("Horas extra (monto RD$):", String(fila.horas_extra || 0));
    if (he === null) return;
    const oi = prompt("Otros ingresos (RD$):", String(fila.otros_ingresos || 0));
    if (oi === null) return;
    const od = prompt("Otros descuentos — avances, préstamos (RD$):", String(fila.otros_descuentos || 0));
    if (od === null) return;
    const r = await fetch(`${API}/api/nomina/detalle/${fila.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ horas_extra: Number(he) || 0, otros_ingresos: Number(oi) || 0, otros_descuentos: Number(od) || 0 }),
    });
    const d = await r.json();
    if (d.error) { setMsg(`⚠️ ${d.error}`); return; }
    abrirDetalle(detalle!.id); cargar();
  };

  const pagarNomina = async () => {
    if (!detalle) return;
    if (!confirm(`¿Marcar como PAGADA la nómina por ${fmt(detalle.total_neto)}?`)) return;
    const r = await fetch(`${API}/api/nomina/${detalle.id}/pagar`, { method: "POST" });
    const d = await r.json();
    if (d.error) { setMsg(`⚠️ ${d.error}`); return; }
    setMsg("✅ Nómina marcada como pagada");
    abrirDetalle(detalle.id); cargar();
  };

  const eliminarBorrador = async () => {
    if (!detalle || !confirm("¿Eliminar este borrador de nómina?")) return;
    await fetch(`${API}/api/nomina/${detalle.id}`, { method: "DELETE" });
    setDetalle(null); cargar();
  };

  const badgeEstado = (estado: string) => {
    const c = estado === "PAGADA" ? ["#dcfce7", "#16a34a"] : estado === "BORRADOR" ? ["#fef9c3", "#854d0e"] : ["#fee2e2", "#dc2626"];
    return <span style={{ background: c[0], color: c[1], padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{estado}</span>;
  };

  const tecnicos = usuarios.filter((u: any) => u.rol === "tecnico");

  // ════ VISTA DETALLE ════
  if (detalle) {
    const esBorrador = detalle.estado === "BORRADOR";
    return (
      <div>
        <button onClick={() => { setDetalle(null); cargar(); }} style={{ ...s.tabInactive, marginBottom: 16 }}>← Volver</button>
        {msg && <div style={s.infoBanner}>{msg}</div>}
        <div style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={s.cardTitle}>
                Nómina #{detalle.id} — {TIPO_NOMINA_LABEL[detalle.tipo] || detalle.tipo} {badgeEstado(detalle.estado)}
              </div>
              <div style={{ fontSize: 13, color: "#888" }}>
                Período: {fmtDate(detalle.periodo_inicio)} al {fmtDate(detalle.periodo_fin)}
                {detalle.pagada_at ? ` · Pagada: ${fmtDatetime(detalle.pagada_at)}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {esBorrador && <button onClick={pagarNomina} style={{ ...s.btnPrimary, background: "#10b981" }}>✅ Marcar pagada</button>}
              {esBorrador && <button onClick={eliminarBorrador} style={{ ...s.btnPrimary, background: "#ef4444" }}>🗑 Eliminar</button>}
            </div>
          </div>
        </div>

        <div style={s.kpiRow}>
          <KpiCard label="Total bruto" value={fmt(detalle.total_bruto)} icon="💰" color="#111827" />
          <KpiCard label="Deducciones (TSS + ISR)" value={fmt(detalle.total_deducciones)} icon="📉" color="#ef4444" />
          <KpiCard label="Neto a pagar" value={fmt(detalle.total_neto)} icon="💵" color="#10b981" big />
          <KpiCard label="Aporte patronal (costo extra)" value={fmt(detalle.total_aporte_empleador)} icon="🏢" color="#6366f1" />
        </div>

        <div style={s.card}>
          <div style={{ overflowX: "auto" }}>
            <table style={s.table}>
              <thead><tr>
                <th style={s.th}>Empleado</th><th style={s.th}>Salario</th><th style={s.th}>Comisión</th>
                <th style={s.th}>Extras</th><th style={s.th}>Bruto</th><th style={s.th}>AFP</th>
                <th style={s.th}>SFS</th><th style={s.th}>ISR</th><th style={s.th}>Otros desc.</th>
                <th style={s.th}>Neto</th><th style={s.th}></th>
              </tr></thead>
              <tbody>
                {(detalle.detalle || []).map(d => (
                  <tr key={d.id}>
                    <td style={s.td}>
                      <strong>{d.empleado_nombre}</strong>
                      <div style={{ fontSize: 11, color: "#888" }}>{d.puesto || ""}</div>
                    </td>
                    <td style={s.td}>{fmt(d.salario_base)}</td>
                    <td style={s.td}>
                      {Number(d.comisiones) > 0 ? (
                        <span title={(d.comisiones_detalle || []).map((c: any) => `${c.ncf || "Factura " + c.factura_id}: ${fmt(c.comision)}`).join("\n")}>
                          {fmt(d.comisiones)} <span style={{ fontSize: 11, color: "#888" }}>({(d.comisiones_detalle || []).length}f)</span>
                        </span>
                      ) : "—"}
                    </td>
                    <td style={s.td}>{Number(d.horas_extra) + Number(d.otros_ingresos) > 0 ? fmt(Number(d.horas_extra) + Number(d.otros_ingresos)) : "—"}</td>
                    <td style={{ ...s.td, fontWeight: 700 }}>{fmt(d.total_bruto)}</td>
                    <td style={{ ...s.td, color: "#ef4444" }}>{fmt(d.afp_empleado)}</td>
                    <td style={{ ...s.td, color: "#ef4444" }}>{fmt(d.sfs_empleado)}</td>
                    <td style={{ ...s.td, color: "#ef4444" }}>{fmt(d.isr)}</td>
                    <td style={{ ...s.td, color: "#ef4444" }}>{Number(d.otros_descuentos) > 0 ? fmt(d.otros_descuentos) : "—"}</td>
                    <td style={{ ...s.td, fontWeight: 800, color: "#10b981" }}>{fmt(d.neto)}</td>
                    <td style={{ ...s.td, whiteSpace: "nowrap" }}>
                      {esBorrador && <button onClick={() => ajustarFila(d)} style={{ ...s.tabInactive, padding: "5px 10px", fontSize: 12, marginRight: 6 }}>✏️ Ajustar</button>}
                      <button onClick={() => imprimirVolante(detalle, d)} style={{ ...s.tabInactive, padding: "5px 10px", fontSize: 12 }}>🖨 Volante</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ ...s.infoBanner, marginTop: 14 }}>
            🏢 Aporte patronal del período (no se descuenta al empleado): AFP 7.10% + SFS 7.09% + Riesgos Laborales 1.20% + INFOTEP 1% = <strong>{fmt(detalle.total_aporte_empleador)}</strong>.
            Costo total de esta nómina para el taller: <strong>{fmt(Number(detalle.total_bruto) + Number(detalle.total_aporte_empleador))}</strong>
          </div>
        </div>
      </div>
    );
  }

  // ════ VISTA PRINCIPAL ════
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button onClick={() => setVista("nominas")} style={vista === "nominas" ? s.tabActive : s.tabInactive}>📋 Nóminas</button>
        <button onClick={() => setVista("empleados")} style={vista === "empleados" ? s.tabActive : s.tabInactive}>👤 Empleados ({empleados.filter(e => e.activo).length})</button>
      </div>
      {msg && <div style={s.infoBanner}>{msg}</div>}

      {vista === "nominas" && (
        <>
          <div style={s.card}>
            <div style={s.cardTitle}>⚙️ Generar nómina</div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
              <FormField label="Tipo de nómina">
                <select value={genTipo} onChange={e => cambiarTipo(e.target.value)} style={s.input}>
                  <option value="QUINCENA_1">1ra Quincena (1–15)</option>
                  <option value="QUINCENA_2">2da Quincena (16–fin)</option>
                  <option value="MENSUAL">Mensual</option>
                  <option value="REGALIA">Regalía Pascual (salario 13)</option>
                </select>
              </FormField>
              <FormField label="Desde">
                <input type="date" value={genInicio} onChange={e => setGenInicio(e.target.value)} style={s.input} />
              </FormField>
              <FormField label="Hasta">
                <input type="date" value={genFin} onChange={e => setGenFin(e.target.value)} style={s.input} />
              </FormField>
              <button onClick={generarNomina} disabled={cargando} style={{ ...s.btnPrimary, marginBottom: 14 }}>
                {cargando ? "Generando..." : "⚙️ Generar borrador"}
              </button>
            </div>
            <div style={{ fontSize: 12, color: "#888" }}>
              Las comisiones de técnicos (% sobre mano de obra facturada del período) se calculan automáticamente.
              Deducciones de ley: AFP 2.87% · SFS 3.04% · ISR escala DGII. La regalía está exenta de TSS e ISR.
            </div>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>📋 Historial de nóminas</div>
            {nominas.length === 0 ? <div style={s.empty}>Aún no hay nóminas generadas</div> : (
              <table style={s.table}>
                <thead><tr>
                  <th style={s.th}>#</th><th style={s.th}>Tipo</th><th style={s.th}>Período</th>
                  <th style={s.th}>Bruto</th><th style={s.th}>Neto</th><th style={s.th}>Estado</th><th style={s.th}></th>
                </tr></thead>
                <tbody>
                  {nominas.map(n => (
                    <tr key={n.id} style={{ cursor: "pointer" }} onClick={() => abrirDetalle(n.id)}>
                      <td style={s.td}>{n.id}</td>
                      <td style={s.td}>{TIPO_NOMINA_LABEL[n.tipo] || n.tipo}</td>
                      <td style={s.td}>{fmtDate(n.periodo_inicio)} — {fmtDate(n.periodo_fin)}</td>
                      <td style={s.td}>{fmt(n.total_bruto)}</td>
                      <td style={{ ...s.td, fontWeight: 700, color: "#10b981" }}>{fmt(n.total_neto)}</td>
                      <td style={s.td}>{badgeEstado(n.estado)}</td>
                      <td style={s.td}><button style={{ ...s.tabInactive, padding: "5px 12px", fontSize: 12 }}>Ver →</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {vista === "empleados" && (
        <>
          <div style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={s.cardTitle}>👤 Empleados</div>
              <button onClick={() => { setFormVisible(!formVisible); setEditId(null); setForm(EMPLEADO_VACIO); }} style={s.btnPrimary}>
                {formVisible ? "✕ Cancelar" : "+ Nuevo empleado"}
              </button>
            </div>

            {formVisible && (
              <div style={{ ...s.resumenBox, marginBottom: 18 }}>
                <div style={s.formGrid}>
                  <FormField label="Nombre completo *">
                    <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={s.input} />
                  </FormField>
                  <FormField label="Cédula">
                    <input value={form.cedula} onChange={e => setForm({ ...form, cedula: e.target.value })} style={s.input} placeholder="000-0000000-0" />
                  </FormField>
                  <FormField label="Teléfono">
                    <input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} style={s.input} />
                  </FormField>
                  <FormField label="Puesto">
                    <input value={form.puesto} onChange={e => setForm({ ...form, puesto: e.target.value })} style={s.input} placeholder="Técnico mecánico, Secretaria..." />
                  </FormField>
                  <FormField label="Tipo de empleado">
                    <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={s.input}>
                      <option value="administrativo">Administrativo (solo sueldo fijo)</option>
                      <option value="tecnico">Técnico (sueldo fijo + comisiones)</option>
                    </select>
                  </FormField>
                  {form.tipo === "tecnico" && (
                    <FormField label="Usuario del sistema (para vincular sus órdenes)">
                      <select value={form.usuario_id} onChange={e => setForm({ ...form, usuario_id: e.target.value })} style={s.input}>
                        <option value="">— Sin vincular —</option>
                        {tecnicos.map((u: any) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                      </select>
                    </FormField>
                  )}
                  {form.tipo === "tecnico" && (
                    <FormField label="Comisión % sobre mano de obra">
                      <input type="number" value={form.comision_pct} onChange={e => setForm({ ...form, comision_pct: e.target.value })} style={s.input} placeholder="Ej: 30" />
                    </FormField>
                  )}
                  <FormField label="Fecha de ingreso">
                    <input type="date" value={form.fecha_ingreso} onChange={e => setForm({ ...form, fecha_ingreso: e.target.value })} style={s.input} />
                  </FormField>
                  <FormField label="Salario mensual (RD$) *">
                    <input type="number" value={form.salario_mensual} onChange={e => setForm({ ...form, salario_mensual: e.target.value })} style={s.input} />
                  </FormField>
                  <FormField label="Frecuencia de pago">
                    <select value={form.frecuencia_pago} onChange={e => setForm({ ...form, frecuencia_pago: e.target.value })} style={s.input}>
                      <option value="QUINCENAL">Quincenal (15 y 30)</option>
                      <option value="MENSUAL">Mensual</option>
                    </select>
                  </FormField>
                  <FormField label="Método de pago">
                    <select value={form.metodo_pago} onChange={e => setForm({ ...form, metodo_pago: e.target.value })} style={s.input}>
                      <option value="TRANSFERENCIA">Transferencia</option>
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </FormField>
                  <FormField label="Banco">
                    <input value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })} style={s.input} />
                  </FormField>
                  <FormField label="No. de cuenta">
                    <input value={form.cuenta_banco} onChange={e => setForm({ ...form, cuenta_banco: e.target.value })} style={s.input} />
                  </FormField>
                </div>
                <div style={{ display: "flex", gap: 18, marginBottom: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>
                    <input type="checkbox" checked={form.tss_aplica} onChange={e => setForm({ ...form, tss_aplica: e.target.checked })} /> Cotiza TSS (AFP + SFS)
                  </label>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>
                    <input type="checkbox" checked={form.isr_aplica} onChange={e => setForm({ ...form, isr_aplica: e.target.checked })} /> Retener ISR
                  </label>
                </div>
                <button onClick={guardarEmpleado} disabled={cargando} style={s.btnPrimary}>
                  {cargando ? "Guardando..." : editId ? "💾 Actualizar empleado" : "💾 Registrar empleado"}
                </button>
              </div>
            )}

            {empleados.length === 0 ? <div style={s.empty}>No hay empleados registrados — agrega el primero</div> : (
              <table style={s.table}>
                <thead><tr>
                  <th style={s.th}>Empleado</th><th style={s.th}>Tipo</th><th style={s.th}>Salario mensual</th>
                  <th style={s.th}>Comisión</th><th style={s.th}>Frecuencia</th><th style={s.th}>TSS/ISR</th>
                  <th style={s.th}>Estado</th><th style={s.th}></th>
                </tr></thead>
                <tbody>
                  {empleados.map(e => (
                    <tr key={e.id} style={{ opacity: e.activo ? 1 : 0.45 }}>
                      <td style={s.td}>
                        <strong>{e.nombre}</strong>
                        <div style={{ fontSize: 11, color: "#888" }}>{e.puesto || ""} {e.cedula ? `· ${e.cedula}` : ""}</div>
                      </td>
                      <td style={s.td}>{e.tipo === "tecnico" ? "🔧 Técnico" : "🗂 Administrativo"}</td>
                      <td style={{ ...s.td, fontWeight: 700 }}>{fmt(e.salario_mensual)}</td>
                      <td style={s.td}>{e.tipo === "tecnico" && Number(e.comision_pct) > 0 ? `${e.comision_pct}% M.O.` : "—"}</td>
                      <td style={s.td}>{e.frecuencia_pago === "QUINCENAL" ? "Quincenal" : "Mensual"}</td>
                      <td style={s.td}>{e.tss_aplica ? "TSS ✓" : "TSS ✕"} {e.isr_aplica ? "· ISR ✓" : "· ISR ✕"}</td>
                      <td style={s.td}>{e.activo ? <span style={{ color: "#16a34a", fontWeight: 700 }}>Activo</span> : <span style={{ color: "#dc2626", fontWeight: 700 }}>Inactivo</span>}</td>
                      <td style={{ ...s.td, whiteSpace: "nowrap" }}>
                        <button onClick={() => editarEmpleado(e)} style={{ ...s.tabInactive, padding: "5px 10px", fontSize: 12, marginRight: 6 }}>✏️</button>
                        <button onClick={() => toggleActivo(e)} style={{ ...s.tabInactive, padding: "5px 10px", fontSize: 12 }}>{e.activo ? "Desactivar" : "Activar"}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
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
