"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { API_URL as API } from "@/config";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface InventarioItem {
  id: number;
  name: string;
  code?: string;
  price: number;
  stock: number;
  categoria?: string;
  descripcion?: string;
}

interface RepuestoSeleccionado {
  inventario_id: number;
  nombre: string;
  codigo?: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  stock_disponible: number;
}

interface OrdenDetalle {
  id: number;
  numero_orden: string;
  estado: string;
  descripcion: string;
  cliente_nombre: string;
  cliente_id?: number;
  vehiculo_info: string;
  vehiculo_id?: number;
  vehiculo_marca?: string;
  vehiculo_modelo?: string;
  vehiculo_placa?: string;
  vehiculo_ano?: string;
  created_at: string;
}

interface Inspeccion {
  id?: number;
  km_entrada?: string | number;
  nivel_combustible?: number | string;
  condicion_general?: string;
  observaciones?: string;
  firma_cliente?: string;
  // checklist — nombres exactos de la tabla inspeccion_vehiculo
  radio_pantalla?: boolean;
  tapiceria_ok?: boolean;
  alfombras_ok?: boolean;
  luces_ok?: boolean;
  bocina_ok?: boolean;
  espejos_ok?: boolean;
  gato_ok?: boolean;
  llanta_repuesto_ok?: boolean;
  documentos_ok?: boolean;
  herramientas_ok?: boolean;
}

interface Diagnostico {
  id: number;
  orden_id: number;
  descripcion: string;
  mano_obra: number | string;
  repuestos: number | string;
  total?: number | string;
  tiempo_estimado?: string;
  mano_de_obra_detalle?: string;
  notas?: string;
  terminado?: boolean;
}

type MsgTipo = "ok" | "error" | "info";
interface Msg { tipo: MsgTipo; texto: string }

// ── Paleta ────────────────────────────────────────────────────────────────────
const C = {
  bg:     "#0f172a",
  card:   "#1e293b",
  card2:  "#162032",
  border: "#334155",
  text:   "#e2e8f0",
  muted:  "#94a3b8",
  blue:   "#3b82f6",
  green:  "#10b981",
  red:    "#ef4444",
  orange: "#f97316",
  yellow: "#f59e0b",
  purple: "#8b5cf6",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function numero(id: number, num?: string): string {
  return num || `OT-${String(id).padStart(4, "0")}`;
}

function fmtDinero(n: number): string {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(n || 0);
}

const CHECKLIST_LABELS: { key: keyof Inspeccion; label: string }[] = [
  { key: "luces_ok",          label: "Luces" },
  { key: "espejos_ok",        label: "Espejos" },
  { key: "radio_pantalla",    label: "Radio / Pantalla" },
  { key: "tapiceria_ok",      label: "Tapiceria" },
  { key: "alfombras_ok",      label: "Alfombras" },
  { key: "bocina_ok",         label: "Bocina" },
  { key: "gato_ok",           label: "Gato hidraulico" },
  { key: "llanta_repuesto_ok",label: "Llanta repuesto" },
  { key: "documentos_ok",     label: "Documentos" },
  { key: "herramientas_ok",   label: "Herramientas" },
];

// ── Sub-componente: Campo de solo lectura ─────────────────────────────────────
function CampoReadonly({ label, value, multiline }: { label: string; value?: string | number | null; multiline?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
      {multiline ? (
        <div style={{ fontSize: 12, color: "#e2e8f0", background: "#0f172a", borderRadius: 6, padding: "6px 10px", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{value || "—"}</div>
      ) : (
        <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{value ?? "—"}</div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function DiagnosticoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [orden,      setOrden]      = useState<OrdenDetalle | null>(null);
  const [inspeccion, setInspeccion] = useState<Inspeccion | null>(null);
  const [diagnostico,setDiagnostico]= useState<Diagnostico | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [msg,        setMsg]        = useState<Msg | null>(null);
  const [inspecOpen, setInspecOpen] = useState(false);
  const [confirmCerrar, setConfirmCerrar] = useState(false);
  const [exito,      setExito]      = useState(false);

  // Campos del formulario
  const [desc,        setDesc]      = useState("");
  const [manoObra,    setManoObra]  = useState("0");
  const [tiempoEst,   setTiempoEst] = useState("");
  const [moDetalle,   setMoDetalle] = useState("");
  const [notas,       setNotas]     = useState("");

  // Repuestos del inventario
  const [repuestosItems, setRepuestosItems] = useState<RepuestoSeleccionado[]>([]);
  const [inventario,     setInventario]     = useState<InventarioItem[]>([]);
  const [busqInv,        setBusqInv]        = useState("");
  const [showInvPanel,   setShowInvPanel]   = useState(false);
  const [loadingInv,     setLoadingInv]     = useState(false);

 
// Total calculado
const totalRepuestos = repuestosItems.reduce((s, r) => s + r.subtotal, 0);
const total = (parseFloat(manoObra) || 0) + totalRepuestos;

// Usuario logueado
const [usuario, setUsuario] = useState<Record<string, any>>({});

useEffect(() => {
  if (typeof window !== "undefined") {
    const data = localStorage.getItem("usuario");

    if (data) {
      setUsuario(JSON.parse(data));
    }
  }
}, []);





  // ── Helpers de carga ─────────────────────────────────────────────────────
  const aplicarDiagnostico = (diag: Diagnostico) => {
    setDiagnostico(diag);
    setDesc(diag.descripcion || "");
    setManoObra(String(diag.mano_obra ?? "0"));
    setTiempoEst(diag.tiempo_estimado || "");
    setMoDetalle(diag.mano_de_obra_detalle || "");
    setNotas(diag.notas || "");
    // Cargar repuestos estructurados si existen
    if (Array.isArray((diag as any).repuestos_items) && (diag as any).repuestos_items.length > 0) {
      setRepuestosItems((diag as any).repuestos_items);
    }
  };

  // Cargar inventario cuando se abre el panel
  const cargarInventario = async () => {
    if (inventario.length > 0) return; // ya cargado
    setLoadingInv(true);
    try {
      const res = await fetch(`${API}/inventario`);
      const data = await res.json();
      setInventario(Array.isArray(data) ? data : []);
    } catch (_e) { /* silencioso */ }
    setLoadingInv(false);
  };

  const abrirPanelInventario = () => {
    setShowInvPanel(true);
    cargarInventario();
  };

  const agregarRepuesto = (item: InventarioItem) => {
    setRepuestosItems(prev => {
      const existe = prev.find(r => r.inventario_id === item.id);
      if (existe) {
        // Incrementar cantidad si hay stock
        return prev.map(r => r.inventario_id === item.id
          ? { ...r, cantidad: Math.min(r.cantidad + 1, item.stock), subtotal: (r.cantidad + 1) * r.precio_unitario }
          : r
        );
      }
      return [...prev, {
        inventario_id:    item.id,
        nombre:           item.name,
        codigo:           item.code,
        cantidad:         1,
        precio_unitario:  item.price,
        subtotal:         item.price,
        stock_disponible: item.stock,
      }];
    });
  };

  const actualizarCantidad = (inventarioId: number, nuevaCantidad: number) => {
    if (nuevaCantidad <= 0) {
      setRepuestosItems(prev => prev.filter(r => r.inventario_id !== inventarioId));
      return;
    }
    setRepuestosItems(prev => prev.map(r =>
      r.inventario_id === inventarioId
        ? { ...r, cantidad: nuevaCantidad, subtotal: nuevaCantidad * r.precio_unitario }
        : r
    ));
  };

  const inventarioFiltrado = inventario.filter(item => {
    const q = busqInv.toLowerCase();
    return !q || item.name?.toLowerCase().includes(q) || item.code?.toLowerCase().includes(q) || item.categoria?.toLowerCase().includes(q);
  }).slice(0, 40);

  // ── Carga ─────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    try {
      const [rOrden, rInsp] = await Promise.all([
        fetch(`${API}/ordenes/${id}`),
        fetch(`${API}/inspeccion/orden/${id}`),
      ]);

      if (rOrden.ok) {
        const data = await rOrden.json();
        // GET /ordenes/:id retorna { orden, cliente, vehiculo, diagnostico, log, inspeccion }
        const raw = data.orden  || data;
        const cli = data.cliente || {};
        const veh = data.vehiculo || {};
        const o: OrdenDetalle = {
          ...raw,
          cliente_nombre:  cli.nombre  || raw.cliente_nombre  || "Sin cliente",
          vehiculo_info:   veh.id
            ? `${veh.marca} ${veh.modelo} (${veh.placa})`
            : raw.vehiculo_info || "—",
          vehiculo_marca:  veh.marca   || raw.vehiculo_marca,
          vehiculo_modelo: veh.modelo  || raw.vehiculo_modelo,
          vehiculo_placa:  veh.placa   || raw.vehiculo_placa,
          vehiculo_ano:    veh.ano     || raw.vehiculo_ano,
          cliente_id:      cli.id      || raw.cliente_id,
          vehiculo_id:     veh.id      || raw.vehiculo_id,
        };
        setOrden(o);
        const diag: Diagnostico | null = data.diagnostico || null;
        if (diag) aplicarDiagnostico(diag);

      } else {
        // ── Fallback: el endpoint /ordenes/:id no existe en esta version del backend
        // Usamos GET /ordenes (lista) que siempre ha existido, filtramos por id
        const [rLista, rDiags] = await Promise.all([
          fetch(`${API}/ordenes`),
          fetch(`${API}/diagnosticos`),
        ]);

        if (rLista.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lista: any[] = await rLista.json();
          const found = (Array.isArray(lista) ? lista : []).find(
            o => String(o.id) === String(id)
          );
          if (!found) {
            setMsg({ tipo: "error", texto: `Orden #${id} no encontrada.` });
            setLoading(false);
            return;
          }
          // GET /ordenes ya trae cliente_nombre, vehiculo_info, vehiculo_placa
          setOrden(found as OrdenDetalle);
        } else {
          setMsg({ tipo: "error", texto: `No se pudo cargar la orden #${id}.` });
          setLoading(false);
          return;
        }

        if (rDiags.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const diags: any[] = await rDiags.json();
          const diag = (Array.isArray(diags) ? diags : []).find(
            d => String(d.orden_id) === String(id)
          ) as Diagnostico | undefined;
          if (diag) aplicarDiagnostico(diag);
        }
      }

      if (rInsp.ok) {
        const di = await rInsp.json();
        setInspeccion(di || null);
      }
    } catch (_e) {
      setMsg({ tipo: "error", texto: "Error cargando datos de la orden." });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Guardar borrador ──────────────────────────────────────────────────────
  const guardar = async (cerrar = false) => {
    if (!desc.trim()) {
      setMsg({ tipo: "error", texto: "La descripcion de hallazgos es requerida." });
      return;
    }
    setSaving(true);
    setMsg(null);

    const body = {
      orden_id:             Number(id),
      vehiculo_id:          orden?.vehiculo_id,
      cliente_id:           orden?.cliente_id,
      descripcion:          desc,
      mano_obra:            parseFloat(manoObra) || 0,
      repuestos:            totalRepuestos,
      repuestos_items:      repuestosItems,
      total:                total,
      tiempo_estimado:      tiempoEst,
      mano_de_obra_detalle: moDetalle,
      notas:                notas,
      usuario_id:           usuario.id,
      usuario_nombre:       usuario.nombre || usuario.name,
      ...(cerrar ? { terminado: true } : {}),
    };

    // Helper: forzar cambio de estado via PATCH directo
    const moverEstado = async (nuevoEstado: string) => {
      try {
        const r = await fetch(`${API}/ordenes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            estado:         nuevoEstado,
            usuario_id:     usuario.id    || null,
            usuario_nombre: usuario.nombre || usuario.name || "Tecnico",
          }),
        });
        return r.ok;
      } catch (_e) {
        return false;
      }
    };

    try {
      let res: Response;
      if (diagnostico?.id) {
        res = await fetch(`${API}/diagnosticos/${diagnostico.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`${API}/diagnosticos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || `Error ${res.status}`);
      }

      const data = await res.json();
      const diag = data.diagnostico || data;
      setDiagnostico(diag);

      if (cerrar) {
        await moverEstado("DIAGNOSTICO");
        const ok = await moverEstado("ESPERANDO_APROBACION");
        if (!ok) {
          console.warn("Estado puede ya estar en ESPERANDO_APROBACION");
        }
        setExito(true);
        setConfirmCerrar(false);
      } else {
        await moverEstado("DIAGNOSTICO");
        setMsg({ tipo: "ok", texto: "Borrador guardado correctamente." });
      }
  } catch (e) {
  const errorMessage =
    e instanceof Error
      ? e.message
      : "Error al guardar diagnostico.";

  setMsg({
    tipo: "error",
    texto: errorMessage,
  });
    } finally {
      setSaving(false);
    }
  };

  // ── Estilos de inputs ─────────────────────────────────────────────────────
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, color: C.muted,
    textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.5,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", background: C.card2,
    border: `1px solid ${C.border}`, borderRadius: 8, color: C.text,
    fontSize: 13, boxSizing: "border-box",
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 15 }}>
        Cargando datos...
      </div>
    );
  }

  if (!orden) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.red, fontSize: 15 }}>
        Orden no encontrada.
      </div>
    );
  }

  const tituloOrden = numero(orden.id, orden.numero_orden);
  const vehiculoParts = [orden.vehiculo_marca, orden.vehiculo_modelo, orden.vehiculo_ano].filter(Boolean).join(" ");
  const vehiculoStr = vehiculoParts || orden.vehiculo_info || "sin info";

  // STUB: diagnostico minimo para depuracion
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Diagnostico {tituloOrden}</h1>
        <p style={{ color: C.muted }}>{orden.cliente_nombre} - {vehiculoStr}</p>
        <p style={{ color: C.muted, fontSize: 12 }}>ID: {id}</p>
        <button onClick={() => router.push("/taller")} style={{ marginTop: 16, padding: "8px 16px", background: C.blue, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          Volver al taller
        </button>
      </div>
    </div>
  );
}
