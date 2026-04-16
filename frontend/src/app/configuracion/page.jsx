"use client";
import { useEffect, useState } from "react";

import { API } from "@/config";

export default function ConfiguracionPage() {
  const [tab, setTab] = useState("empresa");
  const [empresa, setEmpresa] = useState({
    nombre: "SÓLIDO AUTO SERVICIO",
    telefono: "809-712-2027",
    rnc: "000-000000-0",
    direccion: "Santo Domingo, República Dominicana",
    email: "info@solidoauto.com",
    itbis: "18"
  });
  const [ncfConfig, setNcfConfig] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    // Cargar config guardada
    const saved = localStorage.getItem("empresa_config");
    if (saved) setEmpresa(JSON.parse(saved));

    // Cargar NCF
    fetch(`${API}/ncf/config`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setNcfConfig(d); })
      .catch(() => {});
  }, []);

  const guardarEmpresa = () => {
    setGuardando(true);
    localStorage.setItem("empresa_config", JSON.stringify(empresa));
    setTimeout(() => {
      setGuardando(false);
      setMsg("✅ Configuración guardada correctamente");
      setTimeout(() => setMsg(""), 3000);
    }, 500);
  };

  const tabs = [
    { key: "empresa",   label: "🏢 Empresa" },
    { key: "ncf",       label: "🧾 Comprobantes NCF" },
    { key: "sistema",   label: "⚙️ Sistema" },
    { key: "respaldo",  label: "💾 Respaldo" },
  ];

  return (
    <div style={container}>
      <h1 style={title}>⚙️ Configuración del Sistema</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ ...tabBtn, background: tab === t.key ? "#111827" : "#fff", color: tab === t.key ? "#fff" : "#111" }}>
            {t.label}
          </button>
        ))}
      </div>

      {msg && (
        <div style={{ background: "#dcfce7", color: "#166534", padding: "12px 16px", borderRadius: 10, marginBottom: 16, fontWeight: 600 }}>
          {msg}
        </div>
      )}

      {/* ====== EMPRESA ====== */}
      {tab === "empresa" && (
        <div style={{ maxWidth: 580 }}>
          <div style={card}>
            <h2 style={cardTitle}>🏢 Datos de la Empresa</h2>
            <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
              Esta información aparece en todas las facturas y comprobantes impresos.
            </p>

            {[
              { key: "nombre",    label: "Nombre de la Empresa", ph: "SÓLIDO AUTO SERVICIO" },
              { key: "rnc",       label: "RNC", ph: "000-000000-0" },
              { key: "telefono",  label: "Teléfono", ph: "809-000-0000" },
              { key: "email",     label: "Email", ph: "info@empresa.com" },
              { key: "direccion", label: "Dirección", ph: "Santo Domingo, RD" },
            ].map(f => (
              <div key={f.key}>
                <label style={label}>{f.label}</label>
                <input value={empresa[f.key]} placeholder={f.ph}
                  onChange={e => setEmpresa({ ...empresa, [f.key]: e.target.value })}
                  style={input} />
              </div>
            ))}

            <div>
              <label style={label}>ITBIS (%)</label>
              <select value={empresa.itbis} onChange={e => setEmpresa({ ...empresa, itbis: e.target.value })} style={input}>
                <option value="18">18% — Estándar RD</option>
                <option value="0">0% — Exento</option>
                <option value="16">16%</option>
              </select>
            </div>

            <button onClick={guardarEmpresa} disabled={guardando} style={btnPrimary}>
              {guardando ? "Guardando..." : "💾 Guardar Configuración"}
            </button>
          </div>
        </div>
      )}

      {/* ====== NCF ====== */}
      {tab === "ncf" && (
        <div style={{ maxWidth: 600 }}>
          <div style={card}>
            <h2 style={cardTitle}>🧾 Configuración de Comprobantes Fiscales</h2>
            <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
              Los NCF son compartidos entre Facturación y Cafetería. La secuencia avanza automáticamente.
            </p>

            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead>
                  <tr>
                    {["Tipo", "Descripción", "Prefijo", "Secuencia Actual", "Próximo NCF"].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { tipo: "B01", desc: "Crédito Fiscal" },
                    { tipo: "B02", desc: "Consumidor Final" },
                    { tipo: "B15", desc: "Gubernamental" },
                  ].map(n => {
                    const conf = ncfConfig.find(c => c.tipo === n.tipo);
                    return (
                      <tr key={n.tipo}>
                        <td style={td}>
                          <span style={{ background: "#dbeafe", color: "#1e40af", padding: "3px 10px", borderRadius: 6, fontWeight: 700, fontSize: 13 }}>
                            {n.tipo}
                          </span>
                        </td>
                        <td style={td}>{n.desc}</td>
                        <td style={td}>{conf?.prefijo || n.tipo}</td>
                        <td style={{ ...td, fontWeight: 700 }}>{conf?.secuencia_actual || 0}</td>
                        <td style={td}>
                          <code style={{ fontSize: 12 }}>
                            {(conf?.prefijo || n.tipo) + String((conf?.secuencia_actual || 0) + 1).padStart(8, "0")}
                          </code>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 16px", marginTop: 16, fontSize: 13 }}>
              ⚠️ Para resetear o ajustar secuencias de NCF, hazlo directamente en Supabase → tabla <code>ncf_config</code>. Los NCF son documentos fiscales legales.
            </div>
          </div>
        </div>
      )}

      {/* ====== SISTEMA ====== */}
      {tab === "sistema" && (
        <div style={{ maxWidth: 580 }}>
          <div style={card}>
            <h2 style={cardTitle}>⚙️ Configuración del Sistema</h2>

            <div style={opcionRow}>
              <div>
                <div style={{ fontWeight: 600 }}>URL del Backend</div>
                <div style={{ fontSize: 12, color: "#888" }}>Dirección del servidor Express</div>
              </div>
              <input defaultValue="http://127.0.0.1:4000" style={{ ...input, width: 220, marginBottom: 0 }} />
            </div>

            <div style={opcionRow}>
              <div>
                <div style={{ fontWeight: 600 }}>Actualización automática Dashboard</div>
                <div style={{ fontSize: 12, color: "#888" }}>Cada cuántos segundos se refresca</div>
              </div>
              <select style={{ ...input, width: 120, marginBottom: 0 }}>
                <option value="5">5 segundos</option>
                <option value="10">10 segundos</option>
                <option value="30">30 segundos</option>
              </select>
            </div>

            <div style={opcionRow}>
              <div>
                <div style={{ fontWeight: 600 }}>Moneda</div>
                <div style={{ fontSize: 12, color: "#888" }}>Moneda predeterminada del sistema</div>
              </div>
              <select style={{ ...input, width: 140, marginBottom: 0 }}>
                <option value="RD$">RD$ — Peso Dominicano</option>
                <option value="US$">US$ — Dólar</option>
              </select>
            </div>

            <div style={opcionRow}>
              <div>
                <div style={{ fontWeight: 600 }}>Versión del Sistema</div>
                <div style={{ fontSize: 12, color: "#888" }}>CRM Automotriz Pro</div>
              </div>
              <span style={{ background: "#dcfce7", color: "#16a34a", padding: "4px 12px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
                v1.0.0
              </span>
            </div>

            <button style={btnPrimary}>💾 Guardar Preferencias</button>
          </div>

          <div style={{ ...card, marginTop: 16, background: "#fef2f2", border: "1px solid #fecaca" }}>
            <h2 style={{ ...cardTitle, color: "#dc2626" }}>⚠️ Zona de Peligro</h2>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
              Estas acciones son irreversibles. Úsalas con extremo cuidado.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { if (confirm("¿Limpiar caché local? Tendrás que iniciar sesión de nuevo.")) { localStorage.clear(); window.location.href = "/login"; } }}
                style={{ ...btnPrimary, background: "#f59e0b", flex: 1 }}>
                🗑️ Limpiar Caché
              </button>
              <button onClick={() => alert("Contacta a tu administrador del sistema para esta acción.")}
                style={{ ...btnPrimary, background: "#dc2626", flex: 1 }}>
                💥 Resetear Sistema
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== RESPALDO ====== */}
      {tab === "respaldo" && (
        <div style={{ maxWidth: 580 }}>
          <div style={card}>
            <h2 style={cardTitle}>💾 Respaldo de Datos</h2>
            <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
              Tus datos están guardados automáticamente en Supabase (nube). Aquí puedes exportar reportes locales.
            </p>

            {[
              { icon: "👤", label: "Exportar Clientes", desc: "Lista completa de clientes en CSV", color: "#3b82f6" },
              { icon: "🧾", label: "Exportar Facturas", desc: "Historial de ventas del período", color: "#10b981" },
              { icon: "📦", label: "Exportar Inventario", desc: "Stock actual de repuestos", color: "#f59e0b" },
              { icon: "🔬", label: "Exportar Diagnósticos", desc: "Historial técnico de vehículos", color: "#8b5cf6" },
            ].map(b => (
              <div key={b.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid #f0f0f0" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 24 }}>{b.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{b.label}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{b.desc}</div>
                  </div>
                </div>
                <button onClick={() => exportarCSV(b.label)}
                  style={{ padding: "8px 16px", background: b.color, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                  ⬇️ Descargar
                </button>
              </div>
            ))}

            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "14px 16px", marginTop: 16, fontSize: 13 }}>
              💡 <b>Tu base de datos Supabase</b> tiene respaldo automático diario. Para exportar la base de datos completa, entra a tu panel de Supabase → Settings → Database → Backups.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function exportarCSV(tipo) {
  alert(`Función de exportar "${tipo}" — Conecta con el endpoint de tu backend para generar el CSV. Próximamente disponible.`);
}

const container = { padding: "24px", background: "#f5f7fb", minHeight: "100vh" };
const title = { fontSize: 26, fontWeight: "bold", marginBottom: 20 };
const card = { background: "#fff", padding: 24, borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: 16 };
const cardTitle = { marginBottom: 14, fontSize: 18, fontWeight: 700 };
const tabBtn = { padding: "10px 18px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", fontWeight: 600, fontSize: 13 };
const label = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#555" };
const input = { display: "block", marginBottom: 12, padding: 12, width: "100%", borderRadius: 8, border: "1px solid #ddd", boxSizing: "border-box", fontSize: 14 };
const btnPrimary = { padding: 13, background: "#111827", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", width: "100%", fontWeight: 700, fontSize: 14 };
const table = { width: "100%", borderCollapse: "collapse" };
const th = { textAlign: "left", padding: "10px 12px", background: "#f8fafc", fontSize: 13, fontWeight: 600 };
const td = { padding: "10px 12px", borderBottom: "1px solid #eee", fontSize: 13 };
const opcionRow = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid #f0f0f0", gap: 16 };