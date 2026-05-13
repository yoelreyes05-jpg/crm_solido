"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { API_URL as API } from "@/config";

// ── Tipos ────────────────────────────────────────────────────────────────────
interface ZonaDanio { zona: string; tipo: string; }
interface Foto      { data: string; label: string; }

// Slots fijos de fotos del vehículo
const FOTO_SLOTS = [
  { key: "frente",         label: "📷 Frente",           icon: "🚗" },
  { key: "trasero",        label: "📷 Trasero",           icon: "🔙" },
  { key: "lateral_izq",   label: "📷 Lateral Izquierdo", icon: "◀️" },
  { key: "lateral_der",   label: "📷 Lateral Derecho",   icon: "▶️" },
] as const;
type FotoSlotKey = typeof FOTO_SLOTS[number]["key"];
type FotosSlots = Record<FotoSlotKey, string | null>;

const CONDICION_OPTIONS = ["Excelente", "Buena", "Regular", "Mala"];
const NIVEL_LABELS = ["Vacío", "¼", "½", "¾", "Lleno"];

// ── Mapa visual del vehículo (zonas clickeables) ─────────────────────────────
const ZONAS: { id: string; label: string; cx: number; cy: number }[] = [
  { id: "frontal_centro", label: "Frontal centro",    cx: 200, cy: 45  },
  { id: "frontal_izq",    label: "Frontal izquierdo", cx: 110, cy: 65  },
  { id: "frontal_der",    label: "Frontal derecho",   cx: 290, cy: 65  },
  { id: "lateral_izq_f", label: "Lateral izq frente", cx: 65,  cy: 130 },
  { id: "lateral_izq_t", label: "Lateral izq trasero",cx: 65,  cy: 230 },
  { id: "lateral_der_f", label: "Lateral der frente", cx: 335, cy: 130 },
  { id: "lateral_der_t", label: "Lateral der trasero", cx: 335, cy: 230 },
  { id: "techo",         label: "Techo",              cx: 200, cy: 175 },
  { id: "trasero_izq",   label: "Trasero izquierdo",  cx: 110, cy: 295 },
  { id: "trasero_der",   label: "Trasero derecho",    cx: 290, cy: 295 },
  { id: "trasero_centro",label: "Trasero centro",     cx: 200, cy: 315 },
];
const TIPO_DANIO = ["rayon_leve","rayon_profundo","golpe","falta_pieza","sin_danio"];
const TIPO_COLOR: Record<string,string> = {
  rayon_leve:    "#f59e0b",
  rayon_profundo:"#ef4444",
  golpe:         "#7c3aed",
  falta_pieza:   "#1d4ed8",
  sin_danio:     "#10b981",
};
const TIPO_LABEL: Record<string,string> = {
  rayon_leve:"Rayón leve", rayon_profundo:"Rayón profundo",
  golpe:"Golpe", falta_pieza:"Falta pieza", sin_danio:"Sin daño"
};

// ── Componente principal ──────────────────────────────────────────────────────
export default function InspeccionPage() {
  const { ordenId } = useParams() as { ordenId: string };
  const router = useRouter();

  const [orden, setOrden]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]  = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [inspeccionExistente, setInspeccionExistente] = useState<any>(null);

  // Formulario
  const [kmEntrada, setKmEntrada]     = useState("");
  const [combustible, setCombustible] = useState(50);
  const [condicion, setCondicion]     = useState("Buena");
  const [zonas, setZonas]             = useState<ZonaDanio[]>([]);
  const [zonaSeleccionada, setZonaSeleccionada] = useState<string | null>(null);
  const [tipoDanioModal, setTipoDanioModal]     = useState(false);
  const [rayones, setRayones]         = useState("");
  const [golpes, setGolpes]           = useState("");
  const [vidrios, setVidrios]         = useState("");
  const [llantas, setLlantas]         = useState("");
  const [pintura, setPintura]         = useState("");
  // 4 slots fijos de fotos
  const [fotosSlots, setFotosSlots]   = useState<FotosSlots>({
    frente: null, trasero: null, lateral_izq: null, lateral_der: null,
  });
  // compatibilidad legacy: fotos adicionales libres
  const [fotosExtra, setFotosExtra]   = useState<Foto[]>([]);
  const [observaciones, setObservaciones] = useState("");

  // Checklist
  const [checks, setChecks] = useState({
    radio_pantalla: false, tapiceria_ok: false, alfombras_ok: false,
    luces_ok: false, bocina_ok: false, espejos_ok: false, gato_ok: false,
    llanta_repuesto_ok: false, documentos_ok: false, herramientas_ok: false,
  });
  const [otrosAccesorios, setOtrosAccesorios] = useState("");

  // Firma digital
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [firmada, setFirmada] = useState(false);

  // ── Cargar datos ──────────────────────────────────────────────────────────
  useEffect(() => {
    const cargar = async () => {
      try {
        const [oRes, iRes] = await Promise.all([
          fetch(`${API}/ordenes/${ordenId}`),
          fetch(`${API}/inspeccion/orden/${ordenId}`),
        ]);

        // ── Cargar orden con fallback robusto ──────────────────────────────
        if (oRes.ok) {
          try {
            const json = await oRes.json();
            // El endpoint /ordenes/:id devuelve { orden, cliente, vehiculo, ... }
            if (json?.orden) {
              setOrden(json); // ya tiene la estructura esperada
            } else if (json?.id) {
              // respuesta directa sin wrapper
              setOrden({ orden: json, cliente: null, vehiculo: null, diagnostico: null, log: [], inspeccion: null });
            }
          } catch { /* JSON parse error */ }
        }

        // Fallback: si el endpoint directo falla, buscar en la lista
        if (!oRes.ok || oRes.status === 404) {
          try {
            const lista = await fetch(`${API}/ordenes`).then(r => r.ok ? r.json() : []);
            const found = (Array.isArray(lista) ? lista : []).find((o: any) => String(o.id) === String(ordenId));
            if (found) {
              // Intentar obtener cliente y vehículo si tenemos IDs
              const [cliRes, vehRes] = await Promise.all([
                found.cliente_id ? fetch(`${API}/clientes/${found.cliente_id}`).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
                found.vehiculo_id ? fetch(`${API}/vehiculos/${found.vehiculo_id}`).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
              ]);
              setOrden({ orden: found, cliente: cliRes, vehiculo: vehRes, diagnostico: null, log: [], inspeccion: null });
            }
          } catch { /* fallback silencioso */ }
        }

        if (iRes.ok) {
          try {
            const ins = await iRes.json();
            if (ins) {
              setInspeccionExistente(ins);
            // Pre-rellenar si ya existe
            setKmEntrada(ins.km_entrada?.toString() || "");
            setCombustible(ins.nivel_combustible ?? 50);
            setCondicion(ins.condicion_general || "Buena");
            setZonas(ins.zonas_danio || []);
            setRayones(ins.rayones || "");
            setGolpes(ins.golpes || "");
            setVidrios(ins.estado_vidrios || "");
            setLlantas(ins.estado_llantas || "");
            setPintura(ins.estado_pintura || "");
            // Cargar fotos: si tiene fotos_slots (nuevo formato) úsalas, si no recuperar del array legacy
            if (ins.fotos_slots) {
              setFotosSlots(ins.fotos_slots);
            } else if (Array.isArray(ins.fotos) && ins.fotos.length > 0) {
              // Mapear fotos legacy al nuevo formato de slots por posición
              const slotKeys: FotoSlotKey[] = ["frente","trasero","lateral_izq","lateral_der"];
              const newSlots: FotosSlots = { frente: null, trasero: null, lateral_izq: null, lateral_der: null };
              ins.fotos.forEach((f: Foto, i: number) => {
                if (i < slotKeys.length) newSlots[slotKeys[i]] = f.data;
              });
              setFotosSlots(newSlots);
              // fotos extra si había más de 4
              if (ins.fotos.length > 4) setFotosExtra(ins.fotos.slice(4));
            }
            setObservaciones(ins.observaciones || "");
            setOtrosAccesorios(ins.otros_accesorios || "");
            if (ins.radio_pantalla !== undefined) {
              setChecks({
                radio_pantalla:    ins.radio_pantalla,
                tapiceria_ok:      ins.tapiceria_ok,
                alfombras_ok:      ins.alfombras_ok,
                luces_ok:          ins.luces_ok,
                bocina_ok:         ins.bocina_ok,
                espejos_ok:        ins.espejos_ok,
                gato_ok:           ins.gato_ok,
                llanta_repuesto_ok:ins.llanta_repuesto_ok,
                documentos_ok:     ins.documentos_ok,
                herramientas_ok:   ins.herramientas_ok,
              });
            }
          } catch { /* JSON parse error inspeccion */ }
          }
        }
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    cargar();
  }, [ordenId]);

  // ── Firma canvas ──────────────────────────────────────────────────────────
  const getPos = (e: any, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };
  const startDraw  = (e: any) => { const c = canvasRef.current!; setDrawing(true); setLastPos(getPos(e, c)); };
  const stopDraw   = ()        => { setDrawing(false); setFirmada(true); };
  const draw       = (e: any) => {
    if (!drawing) return;
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const pos = getPos(e, c);
    ctx.beginPath(); ctx.strokeStyle = "#1d4ed8"; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.moveTo(lastPos.x, lastPos.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    setLastPos(pos);
    e.preventDefault();
  };
  const limpiarFirma = () => {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setFirmada(false);
  };

  // ── Fotos (4 slots fijos) ─────────────────────────────────────────────────
  const handleFotoSlot = (slotKey: FotoSlotKey, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFotosSlots(prev => ({ ...prev, [slotKey]: ev.target!.result as string }));
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // reset para poder volver a seleccionar el mismo archivo
  };

  const handleFotoExtra = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const label = file.name.replace(/\.[^/.]+$/, "") || "Foto adicional";
        setFotosExtra(prev => [...prev, { data: ev.target!.result as string, label }]);
      };
      reader.readAsDataURL(file);
    });
  };

  // ── Zonas de daño ────────────────────────────────────────────────────────
  const clickZona = (zonaId: string) => {
    setZonaSeleccionada(zonaId);
    setTipoDanioModal(true);
  };
  const seleccionarTipo = (tipo: string) => {
    setZonas(prev => {
      const sin = prev.filter(z => z.zona !== zonaSeleccionada);
      if (tipo === "sin_danio") return sin;
      return [...sin, { zona: zonaSeleccionada!, tipo }];
    });
    setTipoDanioModal(false);
    setZonaSeleccionada(null);
  };
  const getDanioZona = (zonaId: string) => zonas.find(z => z.zona === zonaId);

  // ── Guardar ───────────────────────────────────────────────────────────────
  const guardar = async () => {
    setSaving(true);
    try {
      const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
      const firma   = firmada ? canvasRef.current!.toDataURL() : (inspeccionExistente?.firma_cliente || null);
      const payload = {
        orden_id:           Number(ordenId),
        vehiculo_id:        orden?.vehiculo?.id   || null,
        cliente_id:         orden?.cliente?.id    || null,
        km_entrada:         kmEntrada ? Number(kmEntrada) : null,
        nivel_combustible:  combustible,
        condicion_general:  condicion,
        zonas_danio:        zonas,
        rayones, golpes,
        estado_vidrios:     vidrios,
        estado_llantas:     llantas,
        estado_pintura:     pintura,
        fotos_slots:        fotosSlots,
        fotos:              fotosExtra, firma_cliente: firma, observaciones,
        otros_accesorios:   otrosAccesorios,
        ...checks,
        creado_por_id:      usuario.id   || null,
        creado_por_nombre:  usuario.nombre || "Sistema",
      };

      let url    = `${API}/inspeccion`;
      let method = "POST";
      if (inspeccionExistente) {
        url    = `${API}/inspeccion/${inspeccionExistente.id}`;
        method = "PATCH";
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data?.error) throw new Error(data.error);

      setInspeccionExistente(data);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 3000);
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    }
    setSaving(false);
  };

  // ── UI helpers ────────────────────────────────────────────────────────────
  const sty = {
    card: { background: "#fff", borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.07)" } as React.CSSProperties,
    label: { fontSize: 12, color: "#6b7280", fontWeight: 600, marginBottom: 4, display: "block" } as React.CSSProperties,
    input: { width: "100%", padding: "9px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, boxSizing: "border-box" } as React.CSSProperties,
    textarea: { width: "100%", padding: "9px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, minHeight: 72, resize: "vertical", boxSizing: "border-box" } as React.CSSProperties,
    checkRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 } as React.CSSProperties,
    sectionTitle: { fontWeight: 800, fontSize: 15, color: "#111", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #f3f4f6" } as React.CSSProperties,
  };

  if (loading) return <div style={{ padding: 40, color: "#6b7280" }}>Cargando inspección...</div>;
  if (!orden)  return (
    <div style={{ padding: 40 }}>
      <div style={{ color: "#ef4444", marginBottom: 16 }}>⚠️ No se encontró la orden #{ordenId}.</div>
      <button onClick={() => router.back()}
        style={{ padding: "8px 18px", background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
        ← Volver
      </button>
    </div>
  );

  // Soportar tanto { orden, cliente, vehiculo } como respuesta plana
  const o       = orden.orden    || orden;
  const cliente = orden.cliente  || null;
  const vehiculo= orden.vehiculo || null;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 900, margin: "0 auto" }}>

      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <button onClick={() => router.back()}
          style={{ background: "#f3f4f6", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, color: "#374151", fontWeight: 600 }}>
          ← Volver
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
            📋 Inspección de Recepción — Orden #{ordenId}
          </h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>
            {vehiculo ? `${vehiculo.marca} ${vehiculo.modelo} · Placa: ${vehiculo.placa}` : ""}
            {cliente ? ` · Cliente: ${cliente.nombre}` : ""}
          </p>
        </div>
        {inspeccionExistente && (
          <span style={{ marginLeft: "auto", background: "#d1fae5", color: "#065f46", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
            ✓ Inspección guardada
          </span>
        )}
      </div>

      {/* SECCIÓN 1: Datos de entrada */}
      <div style={sty.card}>
        <div style={sty.sectionTitle}>🔑 Datos de Recepción</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={sty.label}>Kilómetros al recibir</label>
            <input type="number" value={kmEntrada} onChange={e => setKmEntrada(e.target.value)}
              placeholder="Ej: 85000" style={sty.input} />
          </div>
          <div>
            <label style={sty.label}>Condición general</label>
            <select value={condicion} onChange={e => setCondicion(e.target.value)} style={sty.input}>
              {CONDICION_OPTIONS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Nivel de combustible */}
        <div style={{ marginTop: 14 }}>
          <label style={sty.label}>Nivel de combustible — {Math.round(combustible)}%</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, height: 28, background: "#f3f4f6", borderRadius: 14, overflow: "hidden", position: "relative" }}>
              <div style={{
                width: `${combustible}%`, height: "100%",
                background: combustible < 25 ? "#ef4444" : combustible < 50 ? "#f59e0b" : "#22c55e",
                borderRadius: 14, transition: "width 0.2s"
              }} />
            </div>
            <input type="range" min={0} max={100} step={5} value={combustible}
              onChange={e => setCombustible(Number(e.target.value))}
              style={{ width: 120, accentColor: "#3b82f6" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            {NIVEL_LABELS.map(l => <span key={l} style={{ fontSize: 10, color: "#9ca3af" }}>{l}</span>)}
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: Mapa de daños */}
      <div style={sty.card}>
        <div style={sty.sectionTitle}>🗺️ Mapa de Condición del Vehículo</div>
        <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
          Haz clic en cada zona para marcar el tipo de daño.
        </p>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {/* SVG del vehículo */}
          <svg viewBox="0 0 400 360" width={300} height={270}
            style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#f9fafb", cursor: "pointer" }}>
            {/* Silueta simplificada del carro */}
            <rect x="100" y="30"  width="200" height="300" rx="30" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2"/>
            <rect x="130" y="80"  width="140" height="120" rx="8"  fill="#bfdbfe" stroke="#93c5fd" strokeWidth="1.5"/>
            <ellipse cx="145" cy="335" rx="25" ry="12" fill="#94a3b8"/>
            <ellipse cx="255" cy="335" rx="25" ry="12" fill="#94a3b8"/>
            <ellipse cx="145" cy="25"  rx="25" ry="12" fill="#94a3b8"/>
            <ellipse cx="255" cy="25"  rx="25" ry="12" fill="#94a3b8"/>

            {/* Zonas clickeables */}
            {ZONAS.map(z => {
              const danio = getDanioZona(z.id);
              return (
                <g key={z.id} onClick={() => clickZona(z.id)} style={{ cursor: "pointer" }}>
                  <circle cx={z.cx} cy={z.cy} r={16}
                    fill={danio ? TIPO_COLOR[danio.tipo] : "rgba(255,255,255,0.7)"}
                    stroke={danio ? TIPO_COLOR[danio.tipo] : "#94a3b8"}
                    strokeWidth={danio ? 2.5 : 1.5}
                    opacity={0.85}
                  />
                  <text x={z.cx} y={z.cy + 5} textAnchor="middle" fontSize={11} fill={danio ? "#fff" : "#475569"} fontWeight="700">
                    {danio ? (danio.tipo === "rayon_leve" ? "R" : danio.tipo === "rayon_profundo" ? "R!" : danio.tipo === "golpe" ? "G" : "F") : "+"}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Leyenda */}
          <div style={{ flex: 1, minWidth: 180 }}>
            <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#374151" }}>Leyenda:</p>
            {Object.entries(TIPO_LABEL).filter(([k]) => k !== "sin_danio").map(([tipo, lbl]) => (
              <div key={tipo} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: "50%", background: TIPO_COLOR[tipo], flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#374151" }}>{lbl}</span>
              </div>
            ))}
            <hr style={{ margin: "10px 0", border: "none", borderTop: "1px solid #f3f4f6" }} />
            <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: "#374151" }}>Zonas marcadas:</p>
            {zonas.length === 0
              ? <p style={{ fontSize: 12, color: "#9ca3af" }}>Sin daños marcados</p>
              : zonas.map(z => (
                  <div key={z.zona} style={{ fontSize: 12, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: TIPO_COLOR[z.tipo], flexShrink: 0 }} />
                    <span style={{ color: "#374151" }}>{ZONAS.find(x => x.id === z.zona)?.label}: <b>{TIPO_LABEL[z.tipo]}</b></span>
                    <button onClick={() => setZonas(prev => prev.filter(p => p.zona !== z.zona))}
                      style={{ marginLeft: "auto", background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>✕</button>
                  </div>
                ))}
          </div>
        </div>

        {/* Campos de texto adicionales */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
          {[
            ["Descripción de rayones", rayones, setRayones],
            ["Descripción de golpes", golpes, setGolpes],
            ["Estado de vidrios", vidrios, setVidrios],
            ["Estado de llantas", llantas, setLlantas],
            ["Estado de pintura", pintura, setPintura],
          ].map(([lbl, val, setter]: any) => (
            <div key={lbl}>
              <label style={sty.label}>{lbl}</label>
              <textarea value={val} onChange={e => setter(e.target.value)} style={sty.textarea} placeholder={`Describe el estado...`} rows={2} />
            </div>
          ))}
        </div>
      </div>

      {/* SECCIÓN 3: Checklist interior */}
      <div style={sty.card}>
        <div style={sty.sectionTitle}>✅ Checklist de Accesorios e Interior</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {([
            ["radio_pantalla",    "📻 Radio / Pantalla"],
            ["tapiceria_ok",      "🪑 Tapicería"],
            ["alfombras_ok",      "🧺 Alfombras"],
            ["luces_ok",          "💡 Luces (interior/exterior)"],
            ["bocina_ok",         "📣 Bocina"],
            ["espejos_ok",        "🔍 Espejos"],
            ["gato_ok",           "🔩 Gato hidráulico"],
            ["llanta_repuesto_ok","🛞 Llanta de repuesto"],
            ["documentos_ok",     "📄 Documentos (licencia, marbete)"],
            ["herramientas_ok",   "🔧 Herramientas"],
          ] as [keyof typeof checks, string][]).map(([key, lbl]) => (
            <label key={key} style={{ ...sty.checkRow, cursor: "pointer", padding: "6px 8px", borderRadius: 8, background: checks[key] ? "#f0fdf4" : "#f9fafb" }}>
              <input type="checkbox" checked={checks[key]}
                onChange={e => setChecks(prev => ({ ...prev, [key]: e.target.checked }))}
                style={{ width: 18, height: 18, accentColor: "#22c55e", cursor: "pointer" }} />
              <span style={{ fontSize: 13, color: "#374151" }}>{lbl}</span>
              <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: checks[key] ? "#16a34a" : "#9ca3af" }}>
                {checks[key] ? "✓ OK" : "—"}
              </span>
            </label>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={sty.label}>Otros accesorios / observaciones adicionales</label>
          <textarea value={otrosAccesorios} onChange={e => setOtrosAccesorios(e.target.value)}
            style={sty.textarea} placeholder="Ej: GPS propio del cliente, tapas originales, etc." rows={2} />
        </div>
      </div>

      {/* SECCIÓN 4: Fotos — 4 slots fijos */}
      <div style={sty.card}>
        <div style={sty.sectionTitle}>📷 Evidencia Fotográfica del Vehículo</div>
        <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
          Toma una foto por cada ángulo del vehículo. Haz clic en el slot o en la imagen para reemplazarla.
        </p>

        {/* 4 slots fijos */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 16 }}>
          {FOTO_SLOTS.map(slot => {
            const img = fotosSlots[slot.key];
            return (
              <div key={slot.key} style={{ position: "relative" }}>
                <label style={{ cursor: "pointer", display: "block" }}>
                  <div style={{
                    width: "100%", aspectRatio: "4/3",
                    border: img ? "2px solid #22c55e" : "2px dashed #d1d5db",
                    borderRadius: 10, overflow: "hidden",
                    background: img ? "#000" : "#f9fafb",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative",
                  }}>
                    {img ? (
                      <>
                        <img src={img} alt={slot.label}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <div style={{
                          position: "absolute", inset: 0, background: "rgba(0,0,0,0)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          opacity: 0, transition: "opacity 0.2s",
                        }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={e => (e.currentTarget.style.opacity = "0")}
                        >
                          <span style={{ background: "rgba(0,0,0,0.7)", color: "#fff", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                            🔄 Cambiar foto
                          </span>
                        </div>
                      </>
                    ) : (
                      <div style={{ textAlign: "center", color: "#9ca3af" }}>
                        <div style={{ fontSize: 28, marginBottom: 6 }}>{slot.icon}</div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>+ Agregar foto</div>
                      </div>
                    )}
                  </div>
                  <input type="file" accept="image/*"
                    onChange={e => handleFotoSlot(slot.key, e)}
                    style={{ display: "none" }} />
                </label>
                {/* Etiqueta y botón eliminar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: img ? "#16a34a" : "#6b7280" }}>
                    {img ? "✅ " : ""}{slot.label}
                  </span>
                  {img && (
                    <button onClick={() => setFotosSlots(prev => ({ ...prev, [slot.key]: null }))}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12, padding: 0 }}>
                      🗑️ Quitar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Fotos adicionales opcionales */}
        <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>📎 Fotos adicionales (daños específicos)</span>
            <label style={{
              padding: "5px 12px", background: "#f3f4f6", borderRadius: 7,
              cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#374151"
            }}>
              + Agregar
              <input type="file" accept="image/*" multiple onChange={handleFotoExtra} style={{ display: "none" }} />
            </label>
          </div>
          {fotosExtra.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {fotosExtra.map((f, i) => (
                <div key={i} style={{ position: "relative", width: 100, height: 75 }}>
                  <img src={f.data} alt={f.label}
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 7, border: "1px solid #e5e7eb" }} />
                  <button onClick={() => setFotosExtra(prev => prev.filter((_, j) => j !== i))}
                    style={{ position: "absolute", top: 2, right: 2, background: "#ef4444", border: "none",
                      color: "#fff", width: 18, height: 18, borderRadius: "50%", cursor: "pointer", fontSize: 10 }}>✕</button>
                  <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2, textAlign: "center",
                    overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {f.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN 5: Observaciones */}
      <div style={sty.card}>
        <div style={sty.sectionTitle}>📝 Observaciones Generales</div>
        <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
          style={{ ...sty.textarea, minHeight: 90 }}
          placeholder="Describe cualquier condición relevante del vehículo al momento de la recepción..." />
      </div>

      {/* SECCIÓN 6: Firma del cliente */}
      <div style={sty.card}>
        <div style={sty.sectionTitle}>✍️ Firma del Cliente</div>
        <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
          El cliente confirma que la información de arriba es correcta al momento de la entrega del vehículo al taller.
        </p>
        <div style={{ border: "2px dashed #d1d5db", borderRadius: 10, overflow: "hidden", maxWidth: 400, background: "#fafafa" }}>
          <canvas
            ref={canvasRef} width={400} height={120}
            style={{ display: "block", touchAction: "none", cursor: "crosshair" }}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
          />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={limpiarFirma}
            style={{ padding: "7px 14px", background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            🗑️ Borrar firma
          </button>
          {firmada && <span style={{ fontSize: 12, color: "#16a34a", alignSelf: "center", fontWeight: 700 }}>✓ Firma capturada</span>}
          {!firmada && inspeccionExistente?.firma_cliente && (
            <span style={{ fontSize: 12, color: "#6b7280", alignSelf: "center" }}>Firma anterior guardada (firmar de nuevo para actualizar)</span>
          )}
        </div>
      </div>

      {/* Botón guardar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, marginBottom: 40 }}>
        <button onClick={guardar} disabled={saving}
          style={{
            padding: "12px 32px", background: saving ? "#9ca3af" : "linear-gradient(135deg,#1d4ed8,#3b82f6)",
            color: "#fff", border: "none", borderRadius: 11, cursor: saving ? "not-allowed" : "pointer",
            fontSize: 15, fontWeight: 800, boxShadow: "0 4px 14px rgba(59,130,246,0.4)"
          }}>
          {saving ? "Guardando..." : inspeccionExistente ? "💾 Actualizar Inspección" : "💾 Guardar Inspección"}
        </button>
        {guardado && (
          <span style={{ color: "#16a34a", fontWeight: 700, fontSize: 14 }}>✅ ¡Guardado con éxito!</span>
        )}
      </div>

      {/* Modal tipo de daño */}
      {tipoDanioModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999
        }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, minWidth: 280, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>
              Zona: {ZONAS.find(z => z.id === zonaSeleccionada)?.label}
            </h3>
            {TIPO_DANIO.map(tipo => (
              <button key={tipo} onClick={() => seleccionarTipo(tipo)}
                style={{
                  display: "block", width: "100%", marginBottom: 8, padding: "10px 14px",
                  background: TIPO_COLOR[tipo], color: "#fff", border: "none", borderRadius: 9,
                  cursor: "pointer", fontWeight: 700, fontSize: 14, textAlign: "left"
                }}>
                {TIPO_LABEL[tipo]}
              </button>
            ))}
            <button onClick={() => { setTipoDanioModal(false); setZonaSeleccionada(null); }}
              style={{ marginTop: 4, width: "100%", padding: "8px", background: "#f3f4f6", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 600 }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
