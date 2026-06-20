"use client";
import { useEffect, useState, useCallback } from "react";
import { API_URL as API } from "@/config";

const C = {
  bg: "#f5f7fb", card: "#fff", border: "#e5e7eb", text: "#111827", sub: "#6b7280",
  green: "#10b981", blue: "#2563eb", amber: "#d97706", red: "#dc2626", purple: "#7c3aed",
};
const money = (n: any) => "RD$ " + Number(n || 0).toLocaleString("es-DO", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const NIVEL_COLOR: Record<string, string> = {
  BRONCE: "#b45309", PLATA: "#64748b", ORO: "#d97706", PLATINO: "#7c3aed",
};
const NIVEL_ICON: Record<string, string> = {
  BRONCE: "🥉", PLATA: "🥈", ORO: "🥇", PLATINO: "💎",
};

// ── Textos de WhatsApp predefinidos (NO se envían solos; abren WhatsApp listos) ──
const MENSAJES: { key: string; label: string; texto: (c: any, valor: string) => string }[] = [
  {
    key: "saldo", label: "Saldo de puntos",
    texto: (c, valor) => `Hola ${c.nombre} 👋, en el *Club Sólido Auto Servicio* tienes *${c.saldo_puntos} puntos* acumulados (${valor} en descuentos). ¡Pásate a canjearlos por descuentos, lavados y más! 🎁`,
  },
  {
    key: "bienvenida", label: "Bienvenida al club",
    texto: (c) => `Hola ${c.nombre} 👋, ¡ya eres parte del *Club Sólido*! Por cada compra en taller, car wash, cafetería y cursos ganas puntos que canjeas por descuentos y servicios. ¡Bienvenido! 🚗`,
  },
  {
    key: "nivel", label: "Subió de nivel",
    texto: (c) => `¡Felicidades ${c.nombre} 🎉! Alcanzaste el nivel *${c.nivel}* del Club Sólido Auto Servicio. Disfruta tus nuevos beneficios. ¡Gracias por tu preferencia!`,
  },
  {
    key: "recordatorio", label: "Recordatorio / invitación",
    texto: (c, valor) => `Hola ${c.nombre}, te recordamos que tienes *${c.saldo_puntos} puntos* en el Club Sólido (${valor} en descuentos). ¡No los dejes vencer, te esperamos! 🔧`,
  },
];

function waLink(tel: string, texto: string): string {
  const d = (tel || "").replace(/\D/g, "");
  const num = d.length === 10 ? "1" + d : d.startsWith("1") ? d : d;
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
}

export default function FidelizacionPage() {
  const [config, setConfig] = useState<any>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [msgSel, setMsgSel] = useState<Record<number, string>>({});
  const [form, setForm] = useState<any>({ rd_por_punto: 100, valor_punto: 1, nivel_plata: 10000, nivel_oro: 30000, nivel_platino: 75000 });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/fidelizacion/clientes`, { cache: "no-store" });
      const d = await r.json();
      setConfig(d.config);
      setClientes(Array.isArray(d.clientes) ? d.clientes : []);
      if (d.config) setForm((f: any) => ({ ...f, ...d.config }));
    } catch { /* noop */ }
    setLoading(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardarConfig = async (cambios: any) => {
    setGuardando(true);
    try {
      const r = await fetch(`${API}/fidelizacion/config`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      const d = await r.json();
      if (d.error) alert(d.error); else { setConfig(d); setForm((f: any) => ({ ...f, ...d })); }
    } catch (e: any) { alert("Error: " + e.message); }
    setGuardando(false);
  };

  const toggleActivo = () => guardarConfig({ activo: !config?.activo });

  const ajustar = async (c: any) => {
    const txt = prompt(`Ajustar puntos de ${c.nombre} (usa negativo para restar):`, "100");
    if (txt === null) return;
    const p = Number(txt);
    if (!p) return;
    const r = await fetch(`${API}/fidelizacion/ajuste`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente_id: c.cliente_id, puntos: p, descripcion: "Ajuste manual desde módulo" }),
    });
    const d = await r.json();
    if (d.error) alert(d.error); else cargar();
  };

  const canjear = async (c: any) => {
    const txt = prompt(`¿Cuántos puntos canjea ${c.nombre}? (saldo: ${c.saldo_puntos})`, String(c.saldo_puntos));
    if (txt === null) return;
    const p = Number(txt);
    if (!p || p <= 0) return;
    const r = await fetch(`${API}/fidelizacion/canjear`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente_id: c.cliente_id, puntos: p, descripcion: "Canje en módulo de fidelización" }),
    });
    const d = await r.json();
    if (d.error) alert(d.error); else { alert(`Canjeado ✓. Nuevo saldo: ${d.saldo} puntos.`); cargar(); }
  };

  const valorPunto = Number(config?.valor_punto || 1);
  const filtrados = clientes.filter(c =>
    !busqueda || (c.nombre || "").toLowerCase().includes(busqueda.toLowerCase()) || (c.telefono || "").includes(busqueda)
  );
  const activo = !!config?.activo;

  return (
    <div style={{ padding: 24, background: C.bg, minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      {/* Header + interruptor */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: C.text, margin: 0 }}>🎁 Fidelización — Club Sólido</h1>
          <p style={{ fontSize: 13, color: C.sub, margin: "4px 0 0" }}>Puntos multicanal: taller, car wash, cafetería y cursos.</p>
        </div>
        <button onClick={toggleActivo} disabled={guardando} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderRadius: 12,
          border: "none", cursor: "pointer", fontWeight: 800, fontSize: 14,
          background: activo ? C.green : "#94a3b8", color: "#fff", boxShadow: `0 4px 14px ${activo ? C.green : "#94a3b8"}55`,
        }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#fff", opacity: 0.9 }} />
          {activo ? "PROGRAMA ACTIVO" : "PROGRAMA DESACTIVADO"} · {activo ? "Apagar" : "Encender"}
        </button>
      </div>

      {/* Banner estado */}
      {!activo && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 14, color: "#92400e" }}>
          ⚠️ El programa está <b>desactivado</b>: no se acumulan puntos en las facturas. Enciéndelo cuando quieras empezar. Los datos guardados no se borran.
        </div>
      )}

      {/* Configuración */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 18 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, marginTop: 0, marginBottom: 12 }}>⚙️ Reglas del programa</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
          <Campo label="RD$ por 1 punto" value={form.rd_por_punto} onChange={(v: any) => setForm({ ...form, rd_por_punto: v })} />
          <Campo label="Valor de 1 punto (RD$)" value={form.valor_punto} onChange={(v: any) => setForm({ ...form, valor_punto: v })} />
          <Campo label="Nivel Plata (gasto)" value={form.nivel_plata} onChange={(v: any) => setForm({ ...form, nivel_plata: v })} />
          <Campo label="Nivel Oro (gasto)" value={form.nivel_oro} onChange={(v: any) => setForm({ ...form, nivel_oro: v })} />
          <Campo label="Nivel Platino (gasto)" value={form.nivel_platino} onChange={(v: any) => setForm({ ...form, nivel_platino: v })} />
          <button onClick={() => guardarConfig(form)} disabled={guardando}
            style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: C.blue, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            {guardando ? "Guardando..." : "Guardar reglas"}
          </button>
        </div>
        <p style={{ fontSize: 12, color: C.sub, marginTop: 10, marginBottom: 0 }}>
          Ejemplo actual: el cliente gana 1 punto por cada {money(form.rd_por_punto)} facturados; cada punto vale {money(form.valor_punto)} al canjear.
        </p>
      </div>

      {/* Clientes */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>👥 Clientes en el programa ({clientes.length})</h3>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="🔍 Buscar cliente..."
            style={{ padding: "9px 14px", borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 13, minWidth: 220 }} />
        </div>

        {loading ? (
          <p style={{ color: C.sub, textAlign: "center", padding: 30 }}>Cargando...</p>
        ) : filtrados.length === 0 ? (
          <p style={{ color: C.sub, textAlign: "center", padding: 30 }}>
            Aún no hay clientes con puntos. Se irán agregando solos cuando factures con el programa activo.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Cliente", "Nivel", "Puntos", "Valor", "Acciones", "WhatsApp"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, color: C.sub, fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(c => {
                  const valorStr = money(Number(c.saldo_puntos) * valorPunto);
                  const tipoMsg = msgSel[c.cliente_id] || "saldo";
                  const plantilla = MENSAJES.find(m => m.key === tipoMsg) || MENSAJES[0];
                  const texto = plantilla.texto(c, valorStr);
                  return (
                    <tr key={c.cliente_id} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: "10px 12px", fontWeight: 700, fontSize: 13 }}>
                        {c.nombre}
                        <div style={{ fontSize: 11, color: C.sub, fontWeight: 400 }}>{c.telefono || "Sin teléfono"}</div>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: (NIVEL_COLOR[c.nivel] || "#888") + "22", color: NIVEL_COLOR[c.nivel] || "#888" }}>
                          {NIVEL_ICON[c.nivel] || ""} {c.nivel}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 800, fontSize: 14 }}>{c.saldo_puntos}</td>
                      <td style={{ padding: "10px 12px", color: C.green, fontWeight: 700, fontSize: 13 }}>{valorStr}</td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        <button onClick={() => canjear(c)} style={btnMini(C.amber)}>Canjear</button>
                        <button onClick={() => ajustar(c)} style={btnMini("#64748b")}>Ajustar</button>
                      </td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <select value={tipoMsg} onChange={e => setMsgSel(s => ({ ...s, [c.cliente_id]: e.target.value }))}
                            style={{ padding: "7px 8px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, background: "#fff" }}>
                            {MENSAJES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                          </select>
                          {c.telefono ? (
                            <a href={waLink(c.telefono, texto)} target="_blank" rel="noopener noreferrer" title={texto}
                              style={{ background: "#25d366", color: "#fff", borderRadius: 8, padding: "7px 12px", fontWeight: 800, fontSize: 12, textDecoration: "none", whiteSpace: "nowrap" }}>
                              💬 Enviar
                            </a>
                          ) : (
                            <span style={{ fontSize: 11, color: C.sub }}>Sin tel.</span>
                          )}
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

function Campo({ label, value, onChange }: { label: string; value: any; onChange: (v: any) => void }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>{label}</label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        style={{ width: 140, padding: "9px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 }} />
    </div>
  );
}

function btnMini(bg: string): React.CSSProperties {
  return { background: bg + "18", color: bg, border: `1px solid ${bg}44`, borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginRight: 5 };
}
