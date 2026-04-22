"use client";
import { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "";

// ─── Tipos ─────────────────────────────────────────────
type Usuario = {
  nombre: string;
  rol: string;
} | null;

// ─── Utilidades ────────────────────────────────────────
const fmt = (n: number | string) =>
  Number(n || 0).toLocaleString("es-DO", { style: "currency", currency: "DOP" });

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const CATEGORIAS_GASTO = [
  "Limpieza", "Papelería", "Comida / refrigerio", "Transporte",
  "Ferretería", "Electricidad", "Plomería", "Otro",
];

// ─── COMPONENTE PRINCIPAL ──────────────────────────────
export default function ContabilidadPage() {
  const [tab, setTab] = useState("cuadre");
  const [usuario, setUsuario] = useState<Usuario>(null);

  useEffect(() => {
    const u = localStorage.getItem("usuario");
    if (u) setUsuario(JSON.parse(u));
  }, []);

  const tabs = [
    { key: "cuadre", label: "🏦 Cuadre de Caja", roles: ["gerente", "secretaria"] },
    { key: "chica", label: "💵 Caja Chica", roles: ["gerente", "secretaria"] },
    { key: "costos", label: "📊 Costos y Utilidades", roles: ["gerente"] },
  ];

  const tabsVisibles = tabs.filter(
    (t) => !usuario || t.roles.includes(usuario.rol)
  );

  return (
    <div style={{ padding: 28, maxWidth: 1100, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 20 }}>🧮 Contabilidad</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {tabsVisibles.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={btnTab(tab === t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "cuadre" && <CuadreDeCaja usuario={usuario} />}
      {tab === "chica" && <CajaChica usuario={usuario} />}
      {tab === "costos" && <CostosUtilidades />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CUADRE DE CAJA
// ═══════════════════════════════════════════════════════
function CuadreDeCaja({ usuario }: { usuario: Usuario }) {
  const hoy = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState<any>({
    fecha: hoy,
    turno: "mañana",
  });

  const [historial, setHistorial] = useState<any[]>([]);

  const cargar = useCallback(async () => {
    const r = await fetch(`${API}/api/contabilidad/cuadre`);
    const d = await r.json();
    setHistorial(d.cuadres || []);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const ingresos_sistema =
    Number(form.efectivo_sistema || 0) +
    Number(form.tarjeta_sistema || 0) +
    Number(form.transferencia_sistema || 0);

  const ingresos_fisico =
    Number(form.efectivo_fisico || 0) +
    Number(form.tarjeta_fisica || 0) +
    Number(form.transferencia_fisica || 0);

  const diferencia = ingresos_fisico - ingresos_sistema - Number(form.egresos || 0);

  const guardar = async () => {
    await fetch(`${API}/api/contabilidad/cuadre`, {
      method: "POST",
      body: JSON.stringify({
        ...form,
        ingresos_sistema,
        ingresos_fisico,
        diferencia,
        responsable: usuario?.nombre || "Sistema",
      }),
    });
    cargar();
  };

  return (
    <div>
      <button onClick={guardar} style={btnStyle}>Guardar Cuadre</button>

      {historial.map((c) => (
        <div key={c.id}>
          {fmtDate(c.fecha)} - {fmt(c.diferencia)}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CAJA CHICA
// ═══════════════════════════════════════════════════════
function CajaChica({ usuario }: { usuario: Usuario }) {
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [fondo, setFondo] = useState(5000);

  const cargar = useCallback(async () => {
    const r = await fetch(`${API}/api/contabilidad/caja-chica`);
    const d = await r.json();
    setMovimientos(d.movimientos || []);
    setFondo(d.fondo_actual || 5000);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div>
      <h3>Saldo: {fmt(fondo)}</h3>
      {movimientos.map((m) => (
        <div key={m.id}>{m.descripcion} - {fmt(m.monto)}</div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// COSTOS
// ═══════════════════════════════════════════════════════
function CostosUtilidades() {
  const [reporte, setReporte] = useState<any>(null);

  const cargar = async () => {
    const r = await fetch(`${API}/api/contabilidad/costos`);
    const d = await r.json();
    setReporte(d);
  };

  useEffect(() => { cargar(); }, []);

  if (!reporte) return <p>Cargando...</p>;

  return (
    <div>
      <p>Ingresos: {fmt(reporte.ingresos_totales)}</p>
      <p>Utilidad: {fmt(reporte.utilidad_bruta)}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// COMPONENTES
// ═══════════════════════════════════════════════════════
function Row({
  label,
  value,
  color,
  bold,
}: {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>{label}</span>
      <span style={{ color: color || "#111", fontWeight: bold ? 800 : 500 }}>
        {value}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════
const btnStyle: React.CSSProperties = {
  padding: "10px",
  background: "#111827",
  color: "#fff",
  border: "none",
  borderRadius: 8,
};

const btnTab = (active: boolean): React.CSSProperties => ({
  padding: "10px",
  borderRadius: 8,
  border: "none",
  background: active ? "#111827" : "#eee",
  color: active ? "#fff" : "#333",
});

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px",
  borderRadius: 8,
  border: "1px solid #ccc",
  boxSizing: "border-box" as const, // ✅ FIX
};