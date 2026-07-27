"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { API_URL as API } from "@/config";

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Cliente {
  id: number;
  nombre: string;
  cedula?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
}

interface Vehiculo {
  id: number;
  cliente_id: number;
  marca: string;
  modelo: string;
  ano: number;
  placa: string;
  color?: string;
}

interface ChecklistState {
  radio_pantalla: boolean;
  tapiceria_ok: boolean;
  alfombras_ok: boolean;
  luces_ok: boolean;
  bocina_ok: boolean;
  espejos_ok: boolean;
  gato_ok: boolean;
  llanta_repuesto_ok: boolean;
  documentos_ok: boolean;
  herramientas_ok: boolean;
}

type Prioridad = "NORMAL" | "ALTA" | "URGENTE";
type Condicion = "Excelente" | "Bueno" | "Regular" | "Malo";

// ── Constantes ────────────────────────────────────────────────────────────────
const CHECKLIST_ITEMS: [keyof ChecklistState, string][] = [
  ["radio_pantalla",     "Radio / Pantalla"],
  ["tapiceria_ok",       "Tapicería"],
  ["alfombras_ok",       "Alfombras"],
  ["luces_ok",           "Luces"],
  ["bocina_ok",          "Bocina"],
  ["espejos_ok",         "Espejos"],
  ["gato_ok",            "Gato hidráulico"],
  ["llanta_repuesto_ok", "Llanta de repuesto"],
  ["documentos_ok",      "Documentos"],
  ["herramientas_ok",    "Herramientas"],
];

const CONDICIONES: Condicion[] = ["Excelente", "Bueno", "Regular", "Malo"];
const PRIORIDADES: Prioridad[] = ["NORMAL", "ALTA", "URGENTE"];

const PRIORIDAD_COLOR: Record<Prioridad, string> = {
  NORMAL: "#10b981",
  ALTA:   "#f59e0b",
  URGENTE: "#ef4444",
};

// ── Inspección visual — daños y fotos ─────────────────────────────────────────
type FotoSlotKey = "frente" | "trasero" | "lateral_izq" | "lateral_der" | "interior" | "tablero" | "danos_visibles";

interface ZonaDanio { zona_id: string; tipo_danio: string; label: string; }

const FOTO_SLOTS: { key: FotoSlotKey; label: string; icon: string }[] = [
  { key: "frente",        label: "Frente",        icon: "🚗" },
  { key: "trasero",       label: "Trasero",       icon: "🔙" },
  { key: "lateral_izq",   label: "Lateral Izq.",  icon: "◀️" },
  { key: "lateral_der",   label: "Lateral Der.",  icon: "▶️" },
  { key: "interior",      label: "Interior",      icon: "💺" },
  { key: "tablero",       label: "Tablero",       icon: "🎛️" },
  { key: "danos_visibles",label: "Daños",         icon: "⚠️" },
];

const ZONAS_DANIO_MAP = [
  { id: "frontal_centro",  label: "Frontal centro",       cx: 200, cy: 45  },
  { id: "frontal_izq",     label: "Frontal izquierdo",    cx: 110, cy: 65  },
  { id: "frontal_der",     label: "Frontal derecho",      cx: 290, cy: 65  },
  { id: "lateral_izq_f",   label: "Lateral izq. frente",  cx: 65,  cy: 130 },
  { id: "lateral_izq_t",   label: "Lateral izq. trasero", cx: 65,  cy: 230 },
  { id: "lateral_der_f",   label: "Lateral der. frente",  cx: 335, cy: 130 },
  { id: "lateral_der_t",   label: "Lateral der. trasero", cx: 335, cy: 230 },
  { id: "techo",           label: "Techo",                cx: 200, cy: 175 },
  { id: "trasero_izq",     label: "Trasero izquierdo",    cx: 110, cy: 295 },
  { id: "trasero_der",     label: "Trasero derecho",      cx: 290, cy: 295 },
  { id: "trasero_centro",  label: "Trasero centro",       cx: 200, cy: 315 },
];

const TIPO_DANIO_LIST = ["rayon_leve", "rayon_profundo", "golpe", "falta_pieza", "sin_danio"] as const;
const TIPO_DANIO_COLOR: Record<string, string> = {
  rayon_leve: "#f59e0b", rayon_profundo: "#ef4444",
  golpe: "#7c3aed", falta_pieza: "#1d4ed8", sin_danio: "#10b981",
};
const TIPO_DANIO_LABEL: Record<string, string> = {
  rayon_leve: "Rayón leve", rayon_profundo: "Rayón profundo",
  golpe: "Golpe/Abolladura", falta_pieza: "Falta pieza", sin_danio: "Sin daño",
};

// ── Colores tema (claro) ──────────────────────────────────────────────────────
const BG       = "#f1f5f9";
const CARD     = "#ffffff";
const BORDER   = "#e2e8f0";
const TEXT     = "#1e293b";
const MUTED    = "#64748b";
const BLUE     = "#3b82f6";
const GREEN    = "#10b981";
const RED      = "#ef4444";
const YELLOW   = "#f59e0b";

// ── Estilos base ──────────────────────────────────────────────────────────────
const sPage: React.CSSProperties = {
  minHeight: "100vh",
  background: BG,
  padding: "24px 16px 60px",
  fontFamily: "system-ui, -apple-system, sans-serif",
  color: TEXT,
};
const sInner: React.CSSProperties = { maxWidth: 760, margin: "0 auto" };
const sCard: React.CSSProperties = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  padding: 24,
  marginBottom: 20,
};
const sLabel: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: MUTED,
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};
const sInput: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "11px 14px",
  background: "#fff",
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  color: TEXT,
  fontSize: 14,
  boxSizing: "border-box",
  marginBottom: 14,
  outline: "none",
};
const sTextarea: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "11px 14px",
  background: "#fff",
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  color: TEXT,
  fontSize: 14,
  boxSizing: "border-box",
  marginBottom: 14,
  resize: "vertical",
  minHeight: 80,
  outline: "none",
  fontFamily: "inherit",
};
const sBtnPrimary: React.CSSProperties = {
  padding: "12px 28px",
  background: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};
const sBtnSecondary: React.CSSProperties = {
  padding: "12px 22px",
  background: "transparent",
  color: MUTED,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
};
const sBtnGhost: React.CSSProperties = {
  padding: "10px 18px",
  background: "transparent",
  color: BLUE,
  border: `1px solid ${BLUE}`,
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};
const sError: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fca5a5",
  color: "#b91c1c",
  borderRadius: 10,
  padding: "12px 16px",
  fontSize: 13,
  marginBottom: 16,
};

// ── Sub-componentes ───────────────────────────────────────────────────────────
function StepIndicator({ paso }: { paso: number }) {
  const pasos = ["Cliente", "Vehículo", "Inspección", "Orden"];
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 32 }}>
      {pasos.map((label, i) => {
        const num = i + 1;
        const completo = paso > num;
        const activo   = paso === num;
        const color    = completo ? GREEN : activo ? BLUE : BORDER;
        const textColor = completo ? GREEN : activo ? BLUE : MUTED;
        return (
          <div key={num} style={{ display: "flex", alignItems: "center", flex: i < pasos.length - 1 ? 1 : 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: completo ? GREEN : activo ? BLUE : "transparent",
                border: `2px solid ${color}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 14,
                color: completo || activo ? "#fff" : MUTED,
              }}>
                {completo ? "✓" : num}
              </div>
              <span style={{ fontSize: 11, color: textColor, fontWeight: activo ? 700 : 500, marginTop: 6, whiteSpace: "nowrap" }}>
                {label}
              </span>
            </div>
            {i < pasos.length - 1 && (
              <div style={{
                flex: 1,
                height: 2,
                background: paso > num ? GREEN : BORDER,
                margin: "0 6px",
                marginBottom: 22,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ResumenItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 11, color: MUTED, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </p>
      <p style={{ margin: "3px 0 0", fontSize: 14, color: TEXT, fontWeight: 600 }}>{value}</p>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function RecepcionPage() {
  const [paso, setPaso] = useState(1);
  const [error, setError] = useState("");
  const [finalizado, setFinalizado] = useState(false);
  const [numeroOrden, setNumeroOrden] = useState<number | null>(null);

  // Paso 1 — Cliente
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [modoCrearCliente, setModoCrearCliente] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: "", telefono: "", cedula: "", email: "", direccion: "" });
  const [creandoCliente, setCreandoCliente] = useState(false);

  // Paso 2 — Vehículo
  const [vehiculosCliente, setVehiculosCliente] = useState<Vehiculo[]>([]);
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<Vehiculo | null>(null);
  const [modoCrearVehiculo, setModoCrearVehiculo] = useState(false);
  const [nuevoVehiculo, setNuevoVehiculo] = useState({ marca: "", modelo: "", ano: "", placa: "", color: "" });
  const [creandoVehiculo, setCreandoVehiculo] = useState(false);

  // Paso 3 — Inspección
  const [kmEntrada, setKmEntrada] = useState("");
  const [combustible, setCombustible] = useState(50);
  const [condicion, setCondicion] = useState<Condicion>("Bueno");
  const [checklist, setChecklist] = useState<ChecklistState>({
    radio_pantalla: false, tapiceria_ok: false, alfombras_ok: false,
    luces_ok: false, bocina_ok: false, espejos_ok: false, gato_ok: false,
    llanta_repuesto_ok: false, documentos_ok: false, herramientas_ok: false,
  });
  const [observaciones, setObservaciones] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [firmada, setFirmada] = useState(false);

  // Paso 3 — Mapa de daños y fotos
  const [zonesDanio, setZonesDanio] = useState<ZonaDanio[]>([]);
  const [zonaSeleccionada, setZonaSeleccionada] = useState<string | null>(null);
  const [fotosSlots, setFotosSlots] = useState<Record<FotoSlotKey, string | null>>({
    frente: null, trasero: null, lateral_izq: null, lateral_der: null,
    interior: null, tablero: null, danos_visibles: null,
  });
  const [rayones, setRayones] = useState("");
  const [golpes, setGolpes] = useState("");
  const [estadoVidrios, setEstadoVidrios] = useState("");
  const [estadoLlantas, setEstadoLlantas] = useState("");
  const [estadoPintura, setEstadoPintura] = useState("");

  // Paso 4 — Orden
  const [descripcion, setDescripcion] = useState("");
  const [prioridad, setPrioridad] = useState<Prioridad>("NORMAL");

  // Servicio express: ciclo corto RECIBIDO → DIAGNOSTICO → LISTO → ENTREGADO.
  // Para trabajos que el cliente ya aprobó al dejar el vehículo (cambio de
  // aceite, lavado, gomas). Sin esto la orden queda esperando que apruebe una
  // cotización que nunca pidió.
  const [esExpress, setEsExpress] = useState(false);
  const [creandoOrden, setCreandoOrden] = useState(false);

  // ── Cargar clientes ───────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/clientes`)
      .then(r => r.json())
      .then(d => setClientes(Array.isArray(d) ? d : []))
      .catch(() => setClientes([]));
  }, []);

  // ── Cargar vehículos al seleccionar cliente ───────────────────────────────
  useEffect(() => {
    if (!clienteSeleccionado) return;
    setVehiculosCliente([]);
    setVehiculoSeleccionado(null);
    setModoCrearVehiculo(false);
    fetch(`${API}/clientes/${clienteSeleccionado.id}/vehiculos`)
      .then(r => r.json())
      .then(d => {
        const suyos: Vehiculo[] = Array.isArray(d) ? d : [];
        setVehiculosCliente(suyos);
        if (suyos.length === 0) setModoCrearVehiculo(true);
      })
      .catch(() => setVehiculosCliente([]));
  }, [clienteSeleccionado]);

  // ── Filtro de clientes ────────────────────────────────────────────────────
  const clientesFiltrados = busquedaCliente.trim().length < 2
    ? []
    : clientes.filter(c => {
        const q = busquedaCliente.toLowerCase();
        return (
          c.nombre?.toLowerCase().includes(q) ||
          c.cedula?.includes(q) ||
          c.telefono?.includes(q)
        );
      }).slice(0, 8);

  // ── Crear cliente ─────────────────────────────────────────────────────────
  const crearCliente = async () => {
    if (!nuevoCliente.nombre.trim()) { setError("El nombre del cliente es requerido."); return; }
    if (!nuevoCliente.telefono.trim()) { setError("El teléfono del cliente es requerido."); return; }
    setError("");
    setCreandoCliente(true);
    try {
      const res = await fetch(`${API}/clientes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoCliente),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Error al crear cliente");
      const clienteNuevo: Cliente = data;
      setClientes(prev => [clienteNuevo, ...prev]);
      setClienteSeleccionado(clienteNuevo);
      setModoCrearCliente(false);
      setNuevoCliente({ nombre: "", telefono: "", cedula: "", email: "", direccion: "" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al crear el cliente");
    }
    setCreandoCliente(false);
  };

  // ── Crear vehículo ────────────────────────────────────────────────────────
  const crearVehiculo = async () => {
    if (!nuevoVehiculo.marca.trim())  { setError("La marca es requerida."); return; }
    if (!nuevoVehiculo.modelo.trim()) { setError("El modelo es requerido."); return; }
    if (!nuevoVehiculo.ano)           { setError("El año es requerido."); return; }
    if (!nuevoVehiculo.placa.trim())  { setError("La placa es requerida."); return; }
    if (!clienteSeleccionado)         { setError("No hay cliente seleccionado."); return; }
    setError("");
    setCreandoVehiculo(true);
    try {
      const res = await fetch(`${API}/vehiculos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: clienteSeleccionado.id,
          marca:  nuevoVehiculo.marca.trim().toUpperCase(),
          modelo: nuevoVehiculo.modelo.trim().toUpperCase(),
          ano:    Number(nuevoVehiculo.ano),
          placa:  nuevoVehiculo.placa.trim().toUpperCase(),
          color:  nuevoVehiculo.color.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Error al crear vehículo");
      const v: Vehiculo = data;
      setVehiculosCliente(prev => [v, ...prev]);
      setVehiculoSeleccionado(v);
      setModoCrearVehiculo(false);
      setNuevoVehiculo({ marca: "", modelo: "", ano: "", placa: "", color: "" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al crear el vehículo");
    }
    setCreandoVehiculo(false);
  };

  // ── Firma canvas ──────────────────────────────────────────────────────────
  const getPos = useCallback((
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    const src = "touches" in e ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }, []);

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return;
    setDrawing(true);
    setLastPos(getPos(e, c));
  };
  const stopDraw = () => setDrawing(false);
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, c);
    ctx.beginPath();
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setLastPos(pos);
    setFirmada(true);
    e.preventDefault();
  };
  const limpiarFirma = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setFirmada(false);
  };

  // ── Handlers daños y fotos ────────────────────────────────────────────────
  const clickZona = (zonaId: string) => setZonaSeleccionada(zonaId);

  const seleccionarTipo = (tipo: string) => {
    if (!zonaSeleccionada) return;
    const zona = ZONAS_DANIO_MAP.find(z => z.id === zonaSeleccionada);
    if (!zona) return;
    setZonesDanio(prev => {
      const sinEsta = prev.filter(z => z.zona_id !== zonaSeleccionada);
      if (tipo === "sin_danio") return sinEsta;
      return [...sinEsta, { zona_id: zonaSeleccionada, tipo_danio: tipo, label: zona.label }];
    });
    setZonaSeleccionada(null);
  };

  const getDanioZona = (zonaId: string) => zonesDanio.find(z => z.zona_id === zonaId);

  const handleFotoSlot = (key: FotoSlotKey, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setFotosSlots(prev => ({ ...prev, [key]: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  // ── Navegación ────────────────────────────────────────────────────────────
  const avanzar = () => {
    setError("");
    if (paso === 1 && !clienteSeleccionado) {
      setError("Debes seleccionar o crear un cliente antes de continuar.");
      return;
    }
    if (paso === 2 && !vehiculoSeleccionado) {
      setError("Debes seleccionar o registrar un vehículo antes de continuar.");
      return;
    }
    setPaso(p => p + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const retroceder = () => {
    setError("");
    setPaso(p => p - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Crear Orden y Finalizar ───────────────────────────────────────────────
  const crearOrden = async () => {
    if (!descripcion.trim()) {
      setError("El motivo de entrada / descripción del trabajo es requerido.");
      return;
    }
    if (!clienteSeleccionado || !vehiculoSeleccionado) {
      setError("Faltan datos de cliente o vehículo.");
      return;
    }
    setError("");
    setCreandoOrden(true);
    try {
      const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
      const firma = firmada && canvasRef.current ? canvasRef.current.toDataURL() : null;

      // 1. Crear la orden
      const resOrden = await fetch(`${API}/ordenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id:    clienteSeleccionado.id,
          vehiculo_id:   vehiculoSeleccionado.id,
          descripcion:   descripcion.trim(),
          usuario_id:    usuario.id    || null,
          usuario_nombre: usuario.nombre || "Sistema",
          motivo_entrada: descripcion.trim(),
          prioridad,
        }),
      });
      const dataOrden = await resOrden.json();
      if (!resOrden.ok || dataOrden.error) throw new Error(dataOrden.error || "Error al crear la orden");

      const ordenId: number = dataOrden.id ?? dataOrden.orden?.id;
      if (!ordenId) throw new Error("El servidor no devolvió el ID de la orden");

      // 1b. Marcar como express si aplica. No bloqueante: la orden ya existe y
      //     la marca se puede activar después desde el detalle de la orden.
      if (esExpress) {
        try {
          const r = await fetch(`${API}/ordenes/${ordenId}/express`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ es_express: true, motivo: descripcion.trim() }),
          });
          if (!r.ok) {
            const e = await r.json().catch(() => ({}));
            console.warn("⚠️ No se pudo marcar como express:", e.error || r.status);
          }
        } catch (exErr) {
          console.warn("⚠️ No se pudo marcar como express:", exErr);
        }
      }

      // 2. Crear la inspección (no-bloqueante: si la tabla aún no existe en Supabase,
      //    la orden ya fue creada y no se cancela)
      try {
        const resInsp = await fetch(`${API}/inspeccion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orden_id:          ordenId,
            vehiculo_id:       vehiculoSeleccionado.id,
            cliente_id:        clienteSeleccionado.id,
            km_entrada:        kmEntrada ? Number(kmEntrada) : null,
            nivel_combustible: combustible,
            condicion_general: condicion,
            zonas_danio:       zonesDanio,
            fotos:             Object.entries(fotosSlots)
                                 .filter(([, v]) => v)
                                 .map(([k, v]) => ({ tipo: k, data: v })),
            firma_cliente:     firma,
            observaciones:     observaciones.trim(),
            rayones:           rayones.trim() || null,
            golpes:            golpes.trim() || null,
            estado_vidrios:    estadoVidrios.trim() || null,
            estado_llantas:    estadoLlantas.trim() || null,
            estado_pintura:    estadoPintura.trim() || null,
            creado_por_id:     usuario.id    || null,
            creado_por_nombre: usuario.nombre || "Sistema",
            ...checklist,
          }),
        });
        if (!resInsp.ok) {
          const errInsp = await resInsp.json().catch(() => ({}));
          console.warn("⚠️ Inspección no guardada (¿tabla existe?):", errInsp.error || resInsp.status);
        }
      } catch (inspErr) {
        // No bloquear creación de orden por fallo de inspección
        console.warn("⚠️ Error al crear inspección:", inspErr);
      }

      setNumeroOrden(ordenId);
      setFinalizado(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error inesperado al crear la orden");
    }
    setCreandoOrden(false);
  };

  // ── Reset completo ────────────────────────────────────────────────────────
  const resetear = () => {
    setPaso(1);
    setError("");
    setFinalizado(false);
    setNumeroOrden(null);
    setClienteSeleccionado(null);
    setBusquedaCliente("");
    setModoCrearCliente(false);
    setNuevoCliente({ nombre: "", telefono: "", cedula: "", email: "", direccion: "" });
    setVehiculosCliente([]);
    setVehiculoSeleccionado(null);
    setModoCrearVehiculo(false);
    setNuevoVehiculo({ marca: "", modelo: "", ano: "", placa: "", color: "" });
    setKmEntrada("");
    setCombustible(50);
    setCondicion("Bueno");
    setChecklist({
      radio_pantalla: false, tapiceria_ok: false, alfombras_ok: false,
      luces_ok: false, bocina_ok: false, espejos_ok: false,
      gato_ok: false, llanta_repuesto_ok: false, documentos_ok: false, herramientas_ok: false,
    });
    setObservaciones("");
    setFirmada(false);
    setZonesDanio([]);
    setZonaSeleccionada(null);
    setFotosSlots({ frente: null, trasero: null, lateral_izq: null, lateral_der: null, interior: null, tablero: null, danos_visibles: null });
    setRayones("");
    setGolpes("");
    setEstadoVidrios("");
    setEstadoLlantas("");
    setEstadoPintura("");
    // limpiar canvas en el siguiente ciclo (el canvas puede no estar montado)
    setTimeout(() => limpiarFirma(), 50);
    setDescripcion("");
    setPrioridad("NORMAL");
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fuelColor = combustible < 25 ? RED : combustible < 55 ? YELLOW : GREEN;
  const fuelEmoji = combustible < 25 ? "🔴" : combustible < 55 ? "🟡" : "🟢";

  // ── PANTALLA DE ÉXITO ─────────────────────────────────────────────────────
  if (finalizado) {
    return (
      <div style={sPage}>
        <div style={{ ...sInner, textAlign: "center", paddingTop: 60 }}>
          <div style={{ fontSize: 72, marginBottom: 20 }}>✅</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: GREEN, marginBottom: 10 }}>
            ¡Recepción completada!
          </h1>
          <p style={{ color: MUTED, fontSize: 16, marginBottom: 24 }}>
            La orden de trabajo fue creada exitosamente.
          </p>
          <div style={{
            display: "inline-block",
            background: "#f0fdf4",
            border: `2px solid ${GREEN}`,
            borderRadius: 16,
            padding: "18px 40px",
            marginBottom: 32,
          }}>
            <p style={{ margin: 0, color: MUTED, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Número de Orden
            </p>
            <p style={{ margin: "6px 0 0", color: GREEN, fontSize: 36, fontWeight: 900, letterSpacing: "0.05em" }}>
              OT-{String(numeroOrden).padStart(4, "0")}
            </p>
          </div>
          <div style={{ marginBottom: 24, color: TEXT, fontSize: 14, lineHeight: 1.8 }}>
            <p style={{ margin: 0 }}>
              Cliente: <strong>{clienteSeleccionado?.nombre}</strong>
            </p>
            <p style={{ margin: 0 }}>
              Vehículo: <strong>{vehiculoSeleccionado?.marca} {vehiculoSeleccionado?.modelo} — {vehiculoSeleccionado?.placa}</strong>
            </p>
          </div>
          <button onClick={resetear} style={{ ...sBtnPrimary, fontSize: 15, padding: "14px 36px" }}>
            + Nueva Recepción
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER WIZARD ─────────────────────────────────────────────────────────
  return (
    <div style={sPage}>
      <div style={sInner}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, color: TEXT }}>
            Recepción de Vehículo
          </h1>
        </div>
        <p style={{ color: MUTED, fontSize: 14, marginBottom: 28 }}>
          Completa los 4 pasos para registrar la entrada del vehículo al taller. ¿Solo lavado? Usa el módulo Car Wash en el menú lateral.
        </p>

        <StepIndicator paso={paso} />

        {error && <div style={sError}>{error}</div>}

        {/* ═══════════════════════════════════════════════════════════════════
            PASO 1 — CLIENTE
        ═══════════════════════════════════════════════════════════════════ */}
        {paso === 1 && (
          <div>
            <div style={sCard}>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, color: TEXT }}>
                Paso 1 — Seleccionar Cliente
              </h2>

              {/* Cliente ya elegido */}
              {clienteSeleccionado && (
                <div style={{
                  background: "#f0fdf4",
                  border: `1px solid ${GREEN}`,
                  borderRadius: 12,
                  padding: "14px 18px",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: GREEN, fontSize: 15 }}>
                      {clienteSeleccionado.nombre}
                    </p>
                    <p style={{ margin: "3px 0 0", color: MUTED, fontSize: 13 }}>
                      {[clienteSeleccionado.telefono, clienteSeleccionado.cedula].filter(Boolean).join(" · ") || "Sin datos adicionales"}
                    </p>
                  </div>
                  <button
                    onClick={() => { setClienteSeleccionado(null); setBusquedaCliente(""); setModoCrearCliente(false); setError(""); }}
                    style={{ ...sBtnGhost, fontSize: 12, padding: "6px 12px" }}
                  >
                    Cambiar
                  </button>
                </div>
              )}

              {/* Buscador */}
              {!clienteSeleccionado && !modoCrearCliente && (
                <>
                  <label style={sLabel}>Buscar por nombre, cédula o teléfono</label>
                  <input
                    style={sInput}
                    placeholder="Escribe al menos 2 caracteres..."
                    value={busquedaCliente}
                    onChange={e => setBusquedaCliente(e.target.value)}
                    autoFocus
                  />

                  {busquedaCliente.trim().length >= 2 && (
                    <>
                      {clientesFiltrados.length === 0 ? (
                        <p style={{ color: MUTED, fontSize: 13, marginBottom: 12 }}>
                          No se encontraron clientes con ese dato.
                        </p>
                      ) : (
                        <div style={{ marginBottom: 12 }}>
                          {clientesFiltrados.map(c => (
                            <button
                              key={c.id}
                              onClick={() => { setClienteSeleccionado(c); setBusquedaCliente(""); setError(""); }}
                              style={{
                                display: "block",
                                width: "100%",
                                textAlign: "left",
                                background: BG,
                                border: `1px solid ${BORDER}`,
                                borderRadius: 10,
                                padding: "12px 16px",
                                marginBottom: 8,
                                cursor: "pointer",
                                color: TEXT,
                              }}
                              onMouseEnter={e => (e.currentTarget.style.borderColor = BLUE)}
                              onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
                            >
                              <span style={{ fontWeight: 700, fontSize: 14 }}>{c.nombre}</span>
                              <span style={{ color: MUTED, fontSize: 12, marginLeft: 10 }}>
                                {[c.telefono, c.cedula].filter(Boolean).join(" · ")}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14, marginTop: 4 }}>
                    <button onClick={() => { setModoCrearCliente(true); setError(""); }} style={sBtnGhost}>
                      + Crear nuevo cliente
                    </button>
                  </div>
                </>
              )}

              {/* Formulario crear cliente */}
              {modoCrearCliente && !clienteSeleccionado && (
                <div>
                  <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>
                    Nuevo Cliente
                  </p>
                  <label style={sLabel}>Nombre *</label>
                  <input style={sInput} placeholder="Nombre completo"
                    value={nuevoCliente.nombre}
                    onChange={e => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })} />
                  <label style={sLabel}>Teléfono *</label>
                  <input style={sInput} placeholder="809-000-0000"
                    value={nuevoCliente.telefono}
                    onChange={e => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })} />
                  <label style={sLabel}>Cédula</label>
                  <input style={sInput} placeholder="000-0000000-0"
                    value={nuevoCliente.cedula}
                    onChange={e => setNuevoCliente({ ...nuevoCliente, cedula: e.target.value })} />
                  <label style={sLabel}>Email</label>
                  <input style={sInput} type="email" placeholder="correo@ejemplo.com"
                    value={nuevoCliente.email}
                    onChange={e => setNuevoCliente({ ...nuevoCliente, email: e.target.value })} />
                  <label style={sLabel}>Dirección</label>
                  <input style={sInput} placeholder="Dirección opcional"
                    value={nuevoCliente.direccion}
                    onChange={e => setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })} />
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={crearCliente} disabled={creandoCliente}
                      style={{ ...sBtnPrimary, opacity: creandoCliente ? 0.6 : 1, flex: 1, cursor: creandoCliente ? "not-allowed" : "pointer" }}>
                      {creandoCliente ? "Creando..." : "Crear Cliente"}
                    </button>
                    <button onClick={() => { setModoCrearCliente(false); setError(""); }} style={sBtnSecondary}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={avanzar} disabled={!clienteSeleccionado}
                style={{ ...sBtnPrimary, opacity: !clienteSeleccionado ? 0.5 : 1, cursor: !clienteSeleccionado ? "not-allowed" : "pointer" }}>
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            PASO 2 — VEHÍCULO
        ═══════════════════════════════════════════════════════════════════ */}
        {paso === 2 && (
          <div>
            <div style={sCard}>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, color: TEXT }}>
                Paso 2 — Seleccionar Vehículo
              </h2>
              <p style={{ color: MUTED, fontSize: 13, marginBottom: 16 }}>
                Cliente: <strong style={{ color: TEXT }}>{clienteSeleccionado?.nombre}</strong>
              </p>

              {/* Vehículo elegido */}
              {vehiculoSeleccionado && (
                <div style={{
                  background: "#f0fdf4",
                  border: `1px solid ${GREEN}`,
                  borderRadius: 12,
                  padding: "14px 18px",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: GREEN, fontSize: 15 }}>
                      {vehiculoSeleccionado.marca} {vehiculoSeleccionado.modelo}
                    </p>
                    <p style={{ margin: "3px 0 0", color: MUTED, fontSize: 13 }}>
                      {vehiculoSeleccionado.placa} · {vehiculoSeleccionado.ano}{vehiculoSeleccionado.color ? ` · ${vehiculoSeleccionado.color}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => { setVehiculoSeleccionado(null); setModoCrearVehiculo(false); setError(""); }}
                    style={{ ...sBtnGhost, fontSize: 12, padding: "6px 12px" }}
                  >
                    Cambiar
                  </button>
                </div>
              )}

              {/* Lista vehículos */}
              {!vehiculoSeleccionado && !modoCrearVehiculo && (
                <>
                  {vehiculosCliente.length > 0 ? (
                    <>
                      <p style={{ fontSize: 13, color: MUTED, marginBottom: 12 }}>
                        Vehículos registrados de este cliente:
                      </p>
                      {vehiculosCliente.map(v => (
                        <button
                          key={v.id}
                          onClick={() => { setVehiculoSeleccionado(v); setError(""); }}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            background: BG,
                            border: `1px solid ${BORDER}`,
                            borderRadius: 10,
                            padding: "12px 16px",
                            marginBottom: 8,
                            cursor: "pointer",
                            color: TEXT,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = BLUE)}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
                        >
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{v.marca} {v.modelo}</span>
                          <span style={{ color: MUTED, fontSize: 12, marginLeft: 10 }}>
                            {v.placa} · {v.ano}{v.color ? ` · ${v.color}` : ""}
                          </span>
                        </button>
                      ))}
                      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14, marginTop: 4 }}>
                        <button onClick={() => { setModoCrearVehiculo(true); setError(""); }} style={sBtnGhost}>
                          + Registrar nuevo vehículo
                        </button>
                      </div>
                    </>
                  ) : (
                    <p style={{ color: MUTED, fontSize: 13 }}>
                      Este cliente no tiene vehículos registrados.
                    </p>
                  )}
                </>
              )}

              {/* Formulario crear vehículo */}
              {modoCrearVehiculo && !vehiculoSeleccionado && (
                <div>
                  <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>
                    Nuevo Vehículo
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                    <div>
                      <label style={sLabel}>Marca *</label>
                      <input style={sInput} placeholder="Ej: TOYOTA"
                        value={nuevoVehiculo.marca}
                        onChange={e => setNuevoVehiculo({ ...nuevoVehiculo, marca: e.target.value })} />
                    </div>
                    <div>
                      <label style={sLabel}>Modelo *</label>
                      <input style={sInput} placeholder="Ej: COROLLA"
                        value={nuevoVehiculo.modelo}
                        onChange={e => setNuevoVehiculo({ ...nuevoVehiculo, modelo: e.target.value })} />
                    </div>
                    <div>
                      <label style={sLabel}>Año *</label>
                      <input style={sInput} type="number" placeholder="Ej: 2020" min={1980} max={2026}
                        value={nuevoVehiculo.ano}
                        onChange={e => setNuevoVehiculo({ ...nuevoVehiculo, ano: e.target.value })} />
                    </div>
                    <div>
                      <label style={sLabel}>Placa *</label>
                      <input style={sInput} placeholder="Ej: A123456"
                        value={nuevoVehiculo.placa}
                        onChange={e => setNuevoVehiculo({ ...nuevoVehiculo, placa: e.target.value.toUpperCase() })} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={sLabel}>Color</label>
                      <input style={sInput} placeholder="Ej: Blanco, Negro, Rojo..."
                        value={nuevoVehiculo.color}
                        onChange={e => setNuevoVehiculo({ ...nuevoVehiculo, color: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={crearVehiculo} disabled={creandoVehiculo}
                      style={{ ...sBtnPrimary, opacity: creandoVehiculo ? 0.6 : 1, flex: 1, cursor: creandoVehiculo ? "not-allowed" : "pointer" }}>
                      {creandoVehiculo ? "Registrando..." : "Registrar Vehículo"}
                    </button>
                    {vehiculosCliente.length > 0 && (
                      <button onClick={() => { setModoCrearVehiculo(false); setError(""); }} style={sBtnSecondary}>
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={retroceder} style={sBtnSecondary}>← Atrás</button>
              <button onClick={avanzar} disabled={!vehiculoSeleccionado}
                style={{ ...sBtnPrimary, opacity: !vehiculoSeleccionado ? 0.5 : 1, cursor: !vehiculoSeleccionado ? "not-allowed" : "pointer" }}>
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            PASO 3 — INSPECCIÓN
        ═══════════════════════════════════════════════════════════════════ */}
        {paso === 3 && (
          <div>
            {/* ── Datos básicos ── */}
            <div style={sCard}>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, color: TEXT }}>
                Paso 3 — Inspección Visual
              </h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <div>
                  <label style={sLabel}>Kilómetros al recibir</label>
                  <input style={sInput} type="number" placeholder="Ej: 85000" value={kmEntrada}
                    onChange={e => setKmEntrada(e.target.value)} min={0} />
                </div>
                <div>
                  <label style={sLabel}>Condición general</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                    {CONDICIONES.map(c => (
                      <button key={c} onClick={() => setCondicion(c)} style={{
                        padding: "7px 14px", borderRadius: 8, fontSize: 13,
                        border: condicion === c ? `2px solid ${BLUE}` : `1px solid ${BORDER}`,
                        background: condicion === c ? "#eff6ff" : "#fff",
                        color: condicion === c ? BLUE : MUTED,
                        fontWeight: condicion === c ? 700 : 500, cursor: "pointer",
                      }}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label style={sLabel}>Nivel de combustible {fuelEmoji} — {combustible}%</label>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                <div style={{ flex: 1, height: 18, background: "#f1f5f9", borderRadius: 9, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
                  <div style={{ width: `${combustible}%`, height: "100%", background: fuelColor, borderRadius: 9, transition: "width 0.15s, background 0.15s" }} />
                </div>
                <span style={{ color: fuelColor, fontWeight: 700, fontSize: 14, minWidth: 40, textAlign: "right" }}>{combustible}%</span>
              </div>
              <input type="range" min={0} max={100} step={5} value={combustible}
                onChange={e => setCombustible(Number(e.target.value))}
                style={{ width: "100%", accentColor: fuelColor, cursor: "pointer", marginBottom: 4 }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                {["Vacío", "¼", "½", "¾", "Lleno"].map(l => (
                  <span key={l} style={{ fontSize: 10, color: MUTED }}>{l}</span>
                ))}
              </div>
            </div>

            {/* ── Mapa de daños ── */}
            <div style={sCard}>
              <p style={{ fontWeight: 700, fontSize: 15, color: TEXT, marginBottom: 4 }}>🗺️ Mapa de Daños</p>
              <p style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>Toca una zona del vehículo para marcar el tipo de daño</p>

              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                {/* SVG top-view del carro */}
                <div style={{ flex: "0 0 auto" }}>
                  <svg viewBox="0 0 400 360" style={{ width: 220, height: "auto", display: "block" }}>
                    <ellipse cx="95"  cy="110" rx="22" ry="32" fill="#374151"/>
                    <ellipse cx="305" cy="110" rx="22" ry="32" fill="#374151"/>
                    <ellipse cx="95"  cy="250" rx="22" ry="32" fill="#374151"/>
                    <ellipse cx="305" cy="250" rx="22" ry="32" fill="#374151"/>
                    <rect x="80" y="25" width="240" height="310" rx="42" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="2"/>
                    <rect x="118" y="50"  width="164" height="65" rx="12" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="1.5"/>
                    <rect x="118" y="245" width="164" height="55" rx="12" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="1.5"/>
                    <rect x="128" y="120" width="144" height="120" rx="10" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1"/>
                    <rect x="138" y="16"  width="124" height="22" rx="6" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5"/>
                    <rect x="138" y="322" width="124" height="22" rx="6" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5"/>
                    <text x="200" y="10"  textAnchor="middle" fontSize="11" fill="#9ca3af" fontFamily="system-ui,sans-serif">FRENTE</text>
                    <text x="200" y="355" textAnchor="middle" fontSize="11" fill="#9ca3af" fontFamily="system-ui,sans-serif">TRASERO</text>
                    {ZONAS_DANIO_MAP.map(z => {
                      const danio = getDanioZona(z.id);
                      const sel = zonaSeleccionada === z.id;
                      return (
                        <circle key={z.id} cx={z.cx} cy={z.cy} r={18}
                          fill={danio ? TIPO_DANIO_COLOR[danio.tipo_danio] : sel ? "#3b82f6" : "rgba(255,255,255,0.9)"}
                          stroke={danio ? TIPO_DANIO_COLOR[danio.tipo_danio] : sel ? "#1d4ed8" : "#94a3b8"}
                          strokeWidth={2}
                          onClick={() => clickZona(z.id)}
                          style={{ cursor: "pointer" }}
                        />
                      );
                    })}
                  </svg>
                </div>

                {/* Leyenda + zonas marcadas */}
                <div style={{ flex: 1, minWidth: 140 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 10 }}>Leyenda:</p>
                  {TIPO_DANIO_LIST.map(t => (
                    <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                      <div style={{ width: 13, height: 13, borderRadius: "50%", background: TIPO_DANIO_COLOR[t], flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: TEXT }}>{TIPO_DANIO_LABEL[t]}</span>
                    </div>
                  ))}

                  {zonesDanio.length > 0 && (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 8, textTransform: "uppercase" }}>Zonas marcadas:</p>
                      {zonesDanio.map(z => (
                        <div key={z.zona_id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: TIPO_DANIO_COLOR[z.tipo_danio], flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: TEXT, flex: 1 }}>{z.label}: <strong>{TIPO_DANIO_LABEL[z.tipo_danio]}</strong></span>
                          <button onClick={() => setZonesDanio(prev => prev.filter(d => d.zona_id !== z.zona_id))}
                            style={{ background: "none", border: "none", cursor: "pointer", color: RED, fontSize: 16, lineHeight: 1, padding: "0 4px" }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Fotos ── */}
            <div style={sCard}>
              <p style={{ fontWeight: 700, fontSize: 15, color: TEXT, marginBottom: 4 }}>📷 Fotos del Vehículo</p>
              <p style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>Toca un ángulo para capturar o adjuntar la foto</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 10 }}>
                {FOTO_SLOTS.map(slot => (
                  <label key={slot.key} style={{ cursor: "pointer", display: "block" }}>
                    <div style={{
                      border: `2px dashed ${fotosSlots[slot.key] ? GREEN : BORDER}`,
                      borderRadius: 10, overflow: "hidden",
                      aspectRatio: "1 / 1", display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      background: fotosSlots[slot.key] ? "#f0fdf4" : "#f8fafc",
                    }}>
                      {fotosSlots[slot.key] ? (
                        <img src={fotosSlots[slot.key]!} alt={slot.label}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <>
                          <span style={{ fontSize: 22 }}>{slot.icon}</span>
                          <span style={{ fontSize: 10, color: MUTED, marginTop: 4, textAlign: "center", padding: "0 4px" }}>{slot.label}</span>
                        </>
                      )}
                    </div>
                    <input type="file" accept="image/*" capture="environment"
                      style={{ display: "none" }}
                      onChange={e => handleFotoSlot(slot.key, e)} />
                  </label>
                ))}
              </div>
            </div>

            {/* ── Checklist ── */}
            <div style={sCard}>
              <p style={{ fontWeight: 700, fontSize: 15, color: TEXT, marginBottom: 14 }}>✅ Checklist de Accesorios</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {CHECKLIST_ITEMS.map(([key, lbl]) => (
                  <label key={key} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                    borderRadius: 10, cursor: "pointer",
                    background: checklist[key] ? "#f0fdf4" : "#f8fafc",
                    border: `1px solid ${checklist[key] ? GREEN : BORDER}`,
                  }}>
                    <input type="checkbox" checked={checklist[key]}
                      onChange={e => setChecklist(prev => ({ ...prev, [key]: e.target.checked }))}
                      style={{ width: 18, height: 18, accentColor: GREEN, cursor: "pointer", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: checklist[key] ? "#16a34a" : TEXT, fontWeight: checklist[key] ? 600 : 400 }}>
                      {lbl}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* ── Estado del vehículo en texto ── */}
            <div style={sCard}>
              <p style={{ fontWeight: 700, fontSize: 15, color: TEXT, marginBottom: 14 }}>📝 Estado del Vehículo</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <div>
                  <label style={sLabel}>Rayones</label>
                  <input style={sInput} placeholder="Ej: Rayón en puerta trasera izq." value={rayones}
                    onChange={e => setRayones(e.target.value)} />
                </div>
                <div>
                  <label style={sLabel}>Golpes / Abolladuras</label>
                  <input style={sInput} placeholder="Ej: Golpe en parachoques" value={golpes}
                    onChange={e => setGolpes(e.target.value)} />
                </div>
                <div>
                  <label style={sLabel}>Vidrios</label>
                  <input style={sInput} placeholder="Ej: Fisura en parabrisas" value={estadoVidrios}
                    onChange={e => setEstadoVidrios(e.target.value)} />
                </div>
                <div>
                  <label style={sLabel}>Llantas</label>
                  <input style={sInput} placeholder="Ej: Llanta trasera derecha baja" value={estadoLlantas}
                    onChange={e => setEstadoLlantas(e.target.value)} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={sLabel}>Pintura</label>
                  <input style={sInput} placeholder="Ej: Decoloración en capó" value={estadoPintura}
                    onChange={e => setEstadoPintura(e.target.value)} />
                </div>
              </div>
            </div>

            {/* ── Observaciones y firma ── */}
            <div style={sCard}>
              <div style={{ marginBottom: 20 }}>
                <label style={sLabel}>Observaciones generales</label>
                <textarea style={sTextarea}
                  placeholder="Observaciones adicionales sobre el estado del vehículo..."
                  value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3} />
              </div>

              <label style={sLabel}>Firma del cliente (opcional)</label>
              <p style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>
                El cliente confirma que la información es correcta.
              </p>
              <div style={{ border: `2px dashed ${firmada ? GREEN : BORDER}`, borderRadius: 12, overflow: "hidden", maxWidth: 480, background: "#f8fafc" }}>
                <canvas ref={canvasRef} width={480} height={130}
                  style={{ display: "block", touchAction: "none", cursor: "crosshair", width: "100%", maxWidth: 480 }}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                <button onClick={limpiarFirma} style={{ ...sBtnSecondary, padding: "8px 16px", fontSize: 13 }}>
                  Limpiar firma
                </button>
                {firmada
                  ? <span style={{ fontSize: 13, color: GREEN, fontWeight: 700 }}>✓ Firma capturada</span>
                  : <span style={{ fontSize: 12, color: MUTED }}>Firma con el dedo o el ratón</span>
                }
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={retroceder} style={sBtnSecondary}>← Atrás</button>
              <button onClick={avanzar} style={sBtnPrimary}>Siguiente →</button>
            </div>

            {/* ── Modal tipo de daño ── */}
            {zonaSeleccionada && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 340, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: "#111", marginBottom: 4 }}>
                    {ZONAS_DANIO_MAP.find(z => z.id === zonaSeleccionada)?.label}
                  </p>
                  <p style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>¿Qué tipo de daño hay en esta zona?</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {TIPO_DANIO_LIST.map(tipo => (
                      <button key={tipo} onClick={() => seleccionarTipo(tipo)} style={{
                        padding: "12px 16px", borderRadius: 10, textAlign: "left",
                        border: `2px solid ${TIPO_DANIO_COLOR[tipo]}`,
                        background: `${TIPO_DANIO_COLOR[tipo]}18`,
                        color: TIPO_DANIO_COLOR[tipo], fontWeight: 600, fontSize: 14,
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                      }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: TIPO_DANIO_COLOR[tipo], flexShrink: 0 }} />
                        {TIPO_DANIO_LABEL[tipo]}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setZonaSeleccionada(null)} style={{
                    marginTop: 12, width: "100%", padding: "10px",
                    background: "none", border: `1px solid ${BORDER}`,
                    borderRadius: 10, color: MUTED, cursor: "pointer", fontSize: 14,
                  }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            PASO 4 — ORDEN
        ═══════════════════════════════════════════════════════════════════ */}
        {paso === 4 && (
          <div>
            <div style={sCard}>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, color: TEXT }}>
                Paso 4 — Crear Orden de Trabajo
              </h2>

              {/* Resumen */}
              <div style={{
                background: BG,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: 16,
                marginBottom: 22,
              }}>
                <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Resumen de la recepción
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
                  <ResumenItem label="Cliente"      value={clienteSeleccionado?.nombre || "—"} />
                  <ResumenItem label="Vehículo"     value={`${vehiculoSeleccionado?.marca} ${vehiculoSeleccionado?.modelo}`} />
                  <ResumenItem label="Placa"        value={vehiculoSeleccionado?.placa || "—"} />
                  <ResumenItem label="KM entrada"   value={kmEntrada ? `${Number(kmEntrada).toLocaleString()} km` : "No registrado"} />
                  <ResumenItem label="Combustible"  value={`${fuelEmoji} ${combustible}%`} />
                  <ResumenItem label="Condición"    value={condicion} />
                </div>
              </div>

              {/* Descripción */}
              <label style={sLabel}>Motivo de entrada / Trabajo a realizar *</label>
              <textarea
                style={{ ...sTextarea, minHeight: 100 }}
                placeholder="Describe el trabajo a realizar, los síntomas o motivo de ingreso del vehículo..."
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                rows={4}
                autoFocus
              />

              {/* Prioridad */}
              <div style={{ marginBottom: 22 }}>
                <label style={sLabel}>Prioridad</label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {PRIORIDADES.map(p => (
                    <button
                      key={p}
                      onClick={() => setPrioridad(p)}
                      style={{
                        padding: "10px 22px",
                        borderRadius: 10,
                        border: prioridad === p ? `2px solid ${PRIORIDAD_COLOR[p]}` : `1px solid ${BORDER}`,
                        background: prioridad === p ? `${PRIORIDAD_COLOR[p]}22` : BG,
                        color: prioridad === p ? PRIORIDAD_COLOR[p] : MUTED,
                        fontWeight: prioridad === p ? 700 : 500,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Servicio express — ciclo corto sin cotización */}
              <div
                onClick={() => setEsExpress(v => !v)}
                style={{
                  marginBottom: 22, padding: "14px 16px", borderRadius: 12, cursor: "pointer",
                  border: esExpress ? "2px solid #10b981" : `1px solid ${BORDER}`,
                  background: esExpress ? "rgba(16,185,129,0.10)" : BG,
                  display: "flex", alignItems: "flex-start", gap: 12,
                }}
              >
                <div
                  style={{
                    flex: "none", width: 22, height: 22, borderRadius: 6, marginTop: 1,
                    border: esExpress ? "none" : `2px solid ${BORDER}`,
                    background: esExpress ? "#10b981" : "transparent",
                    color: "#fff", fontSize: 14, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {esExpress ? "✓" : ""}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: esExpress ? "#10b981" : MUTED }}>
                    ⚡ Servicio express
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 1.5 }}>
                    Para trabajos que el cliente ya aprobó al dejar el vehículo:
                    cambio de aceite, lavado, gomas. La orden va directo de
                    diagnóstico a <strong>Listo</strong>, sin cotización ni espera de aprobación.
                    El chequeo del técnico se guarda igual, como cortesía.
                  </div>
                </div>
              </div>

              {/* Botón crear */}
              <button
                onClick={crearOrden}
                disabled={creandoOrden || !descripcion.trim()}
                style={{
                  ...sBtnPrimary,
                  width: "100%",
                  padding: "15px",
                  fontSize: 16,
                  opacity: creandoOrden || !descripcion.trim() ? 0.6 : 1,
                  cursor: creandoOrden || !descripcion.trim() ? "not-allowed" : "pointer",
                }}
              >
                {creandoOrden ? "Creando orden..." : "Crear Orden y Finalizar"}
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <button onClick={retroceder} disabled={creandoOrden} style={{ ...sBtnSecondary, opacity: creandoOrden ? 0.5 : 1 }}>
                ← Atrás
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
