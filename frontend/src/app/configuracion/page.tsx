"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Config {
  clave: string;
  valor: string;
  descripcion?: string;
}

const ETIQUETAS: Record<string, string> = {
  nombre_empresa:     "Nombre de la Empresa",
  telefono_empresa:   "Teléfono",
  direccion_empresa:  "Dirección",
  email_empresa:      "Correo Electrónico",
  rnc_empresa:        "RNC",
  moneda:             "Moneda",
  itbis_porcentaje:   "% ITBIS",
  dias_garantia:      "Días de Garantía",
  whatsapp_numero:    "WhatsApp (número con código país)",
};

export default function ConfiguracionPage() {
  const [configs, setConfigs]   = useState<Config[]>([]);
  const [editMap, setEditMap]   = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState(false);
  const [mensaje, setMensaje]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch(`${API}/config`)
      .then(r => r.json())
      .then((data: Config[]) => {
        setConfigs(data);
        const m: Record<string, string> = {};
        data.forEach(c => { m[c.clave] = c.valor ?? ""; });
        setEditMap(m);
      })
      .catch(() => {
        // Si no hay endpoint de config todavía, cargar claves por defecto vacías
        const defaultKeys = Object.keys(ETIQUETAS);
        const m: Record<string, string> = {};
        defaultKeys.forEach(k => { m[k] = ""; });
        setEditMap(m);
        setConfigs(defaultKeys.map(k => ({ clave: k, valor: "", descripcion: ETIQUETAS[k] })));
      })
      .finally(() => setLoading(false));
  }, []);

  async function guardar() {
    setSaving(true);
    setMensaje(null);
    try {
      const payload = Object.entries(editMap).map(([clave, valor]) => ({ clave, valor }));
      const res = await fetch(`${API}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setMensaje("✅ Configuración guardada correctamente.");
    } catch {
      setMensaje("❌ No se pudo guardar. Verifica la conexión con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  const s: Record<string, React.CSSProperties> = {
    page:    { padding: 32, maxWidth: 720, margin: "0 auto" },
    titulo:  { fontSize: 22, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 },
    sub:     { fontSize: 13, color: "#64748b", marginBottom: 28 },
    card:    { background: "#1e293b", borderRadius: 12, padding: 24, marginBottom: 16 },
    label:   { display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8",
               textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
    input:   { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #334155",
               background: "#0f172a", color: "#f1f5f9", fontSize: 14, outline: "none",
               boxSizing: "border-box" as const },
    row:     { marginBottom: 18 },
    btn:     { padding: "10px 28px", borderRadius: 8, border: "none",
               background: "#2563eb", color: "#fff", fontWeight: 700,
               fontSize: 14, cursor: "pointer" },
    mensaje: { marginTop: 16, fontSize: 13, color: "#94a3b8" },
  };

  if (loading) return (
    <div style={{ padding: 40, color: "#64748b", textAlign: "center" }}>
      Cargando configuración…
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.titulo}>⚙️ Configuración del Sistema</div>
      <div style={s.sub}>Datos generales de la empresa y parámetros del sistema.</div>

      <div style={s.card}>
        {Object.keys(ETIQUETAS).map(clave => (
          <div key={clave} style={s.row}>
            <label style={s.label}>{ETIQUETAS[clave]}</label>
            <input
              style={s.input}
              value={editMap[clave] ?? ""}
              onChange={e => setEditMap(prev => ({ ...prev, [clave]: e.target.value }))}
              placeholder={ETIQUETAS[clave]}
            />
          </div>
        ))}

        <button style={s.btn} onClick={guardar} disabled={saving}>
          {saving ? "Guardando…" : "Guardar Cambios"}
        </button>

        {mensaje && <div style={s.mensaje}>{mensaje}</div>}
      </div>

      {/* Sección informativa */}
      <div style={{ ...s.card, background: "#0f172a", border: "1px solid #1e293b" }}>
        <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>
          <strong style={{ color: "#94a3b8" }}>Versión del sistema:</strong> CRM Sólido Auto Servicio v1.0<br />
          <strong style={{ color: "#94a3b8" }}>Base de datos:</strong> Supabase PostgreSQL<br />
          <strong style={{ color: "#94a3b8" }}>Backend:</strong> Node.js + Express<br />
          <strong style={{ color: "#94a3b8" }}>Frontend:</strong> Next.js 14 + TypeScript
        </div>
      </div>
    </div>
  );
}
