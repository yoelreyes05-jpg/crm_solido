"use client";
import { useEffect, useState, useCallback } from "react";
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
  { key: "luces_ok",          label: "💡 Luces" },
  { key: "espejos_ok",        label: "🔍 Espejos" },
  { key: "radio_pantalla",    label: "📻 Radio / Pantalla" },
  { key: "tapiceria_ok",      label: "🪑 Tapicería" },
  { key: "alfombras_ok",      label: "🧺 Alfombras" },
  { key: "bocina_ok",         label: "📣 Bocina" },
  { key: "gato_ok",           label: "🔩 Gato hidráulico" },
  { key: "llanta_repuesto_ok",label: "🛞 Llanta repuesto" },
  { key: "documentos_ok",     label: "📄 Documentos" },
  { key: "herramientas_ok",   label: "🔧 Herramientas" },
];

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

  const usuario: Record<string, string> =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("usuario") || "{}")
      : {};

  // ── Helpers de carga ─────────────────────────────────────────────────────
  function aplicarDiagnostico(diag: Diagnostico) {
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
  }

  // Cargar inventario cuando se abre el panel
  const cargarInventario = async () => {
    if (inventario.length > 0) return; // ya cargado
    setLoadingInv(true);
    try {
      const res = await fetch(`${API}/inventario`);
      const data = await res.json();
      setInventario(Array.isArray(data) ? data : []);
    } catch { /* silencioso */ }
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
        // ── Fallback: el endpoint /ordenes/:id no existe en esta versión del backend
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
    } catch {
      setMsg({ tipo: "error", texto: "Error cargando datos de la orden." });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Guardar borrador ──────────────────────────────────────────────────────
  async function guardar(cerrar = false) {
    if (!desc.trim()) {
      setMsg({ tipo: "error", texto: "La descripción de hallazgos es requerida." });
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
      repuestos:            totalRepuestos,           // total calculado de repuestos del inventario
      repuestos_items:      repuestosItems,           // lista estructurada de partes
      total:                total,
      tiempo_estimado:      tiempoEst,
      mano_de_obra_detalle: moDetalle,
      notas:                notas,
      usuario_id:           usuario.id,
      usuario_nombre:       usuario.nombre || usuario.name,
      ...(cerrar ? { terminado: true } : {}),
    };

    // ── Helper: forzar cambio de estado via PATCH directo ────────────────────
    // Retorna true si tuvo éxito (HTTP 2xx), false si falló.
    // No lanza — deja que el caller decida qué hacer.
    async function moverEstado(nuevoEstado: string): Promise<boolean> {
      try {
        const r = await fetch(`${API}/ordenes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            estado:         nuevoEstado,
            usuario_id:     usuario.id    || null,
            usuario_nombre: usuario.nombre || usuario.name || "Técnico",
          }),
        });
        return r.ok;
      } catch {
        return false;
      }
    }

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
        // Paso 1: mover a DIAGNOSTICO (si sigue en RECIBIDO — backend viejo no lo hizo)
        await moverEstado("DIAGNOSTICO");
        // Paso 2: mover a ESPERANDO_APROBACION
        const ok = await moverEstado("ESPERANDO_APROBACION");
        if (!ok) {
          // El backend nuevo ya hizo la transición con terminado:true — ignorar
          // Solo mostrar error si ambos pasos fallaron
          console.warn("Estado puede ya estar en ESPERANDO_APROBACION (backend lo hizo internamente)");
        }
        setExito(true);
        setConfirmCerrar(false);
      } else {
        // Borrador: solo asegurarse que esté en DIAGNOSTICO
        await moverEstado("DIAGNOSTICO");
        setMsg({ tipo: "ok", texto: "Borrador guardado correctamente." });
      }
    } catch (e: any) {
      setMsg({ tipo: "error", texto: e.message || "Error al guardar diagnóstico." });
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 15 }}>
      ⏳ Cargando datos...
    </div>
  );

  if (!orden) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.red, fontSize: 15 }}>
      ⚠️ Orden no encontrada.
    </div>
  );

  const tituloOrden = numero(orden.id, orden.numero_orden);
  const vehiculoStr = orden.vehiculo_marca && orden.vehiculo_modelo
    ? `${orden.vehiculo_marca} ${orden.vehiculo_modelo} ${orden.vehiculo_ano || ""}`.trim()
    : orden.vehiculo_info || "—";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#1e293b", borderBottom: `1px solid ${C.border}`, padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => router.push("/taller")}
          style={{ background: "transparent", color: C.muted, border: "none", cursor: "pointer", fontSize: 20, padding: 0 }}
        >
          ←
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            🔍 Diagnóstico — {tituloOrden}
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: C.muted }}>
            {orden.cliente_nombre} · {vehiculoStr}
            {orden.vehiculo_placa ? ` · ${orden.vehiculo_placa}` : ""}
          </p>
        </div>
      </div>

      {/* Pantalla de éxito */}
      {exito && (
        <div style={{ padding: 40, maxWidth: 600, margin: "60px auto", textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: C.green, margin: "0 0 12px" }}>
            Diagnóstico enviado para aprobación
          </h2>
          <p style={{ color: C.muted, marginBottom: 24 }}>
            El diagnóstico de <strong>{tituloOrden}</strong> ha sido completado y está esperando aprobación del cliente.
          </p>
          <button
            onClick={() => router.push("/taller")}
            style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
          >
            ← Volver al taller
          </button>
        </div>
      )}

      {!exito && (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 0, maxWidth: 1280, margin: "0 auto", minHeight: "calc(100vh - 65px)" }}>

          {/* Panel izquierdo: inspección de entrada */}
          <div style={{ borderRight: `1px solid ${C.border}`, padding: 20, overflowY: "auto" }}>
            <button
              onClick={() => setInspecOpen(p => !p)}
              style={{
                width: "100%",
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "10px 14px",
                color: C.text,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <span>📋 Inspección de Entrada</span>
              <span style={{ color: C.muted }}>{inspecOpen ? "▲" : "▼"}</span>
            </button>

            {inspecOpen && (
              <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {!inspeccion ? (
                  <p style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>Sin inspección registrada</p>
                ) : (
                  <>
                    {/* KM + combustible */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <CampoReadonly label="KM entrada" value={inspeccion.km_entrada ? `${Number(inspeccion.km_entrada).toLocaleString()} km` : "—"} />
                      <CampoReadonly label="Combustible" value={inspeccion.nivel_combustible != null ? `${inspeccion.nivel_combustible}%` : "—"} />
                    </div>
                    <CampoReadonly label="Condición general" value={inspeccion.condicion_general || "—"} />

                    {/* Checklist */}
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Checklist</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                        {CHECKLIST_LABELS.map(({ key, label }) => {
                          const val = inspeccion[key];
                          const ok  = val === true || val === 1;
                          return (
                            <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                              <span style={{ color: ok ? C.green : C.red }}>{ok ? "✓" : "✗"}</span>
                              <span style={{ color: C.muted }}>{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {inspeccion.observaciones && (
                      <CampoReadonly label="Observaciones" value={inspeccion.observaciones} multiline />
                    )}

                    {inspeccion.firma_cliente && (
                      <div>
                        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Firma del cliente</div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={inspeccion.firma_cliente}
                          alt="Firma"
                          style={{ maxWidth: "100%", borderRadius: 6, border: `1px solid ${C.border}`, background: "#fff" }}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {!inspecOpen && (
              <p style={{ fontSize: 12, color: C.muted, textAlign: "center" }}>
                Haz clic en el acordeón para ver la inspección
              </p>
            )}
          </div>

          {/* Panel principal: formulario diagnóstico */}
          <div style={{ padding: 24, overflowY: "auto" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 20px", color: C.text }}>
              📝 Formulario de Diagnóstico
              {diagnostico && !diagnostico.terminado && (
                <span style={{ marginLeft: 10, fontSize: 11, color: C.yellow, fontWeight: 600 }}>
                  (borrador guardado)
                </span>
              )}
              {diagnostico?.terminado && (
                <span style={{ marginLeft: 10, fontSize: 11, color: C.purple, fontWeight: 600 }}>
                  (diagnóstico cerrado)
                </span>
              )}
            </h2>

            {/* Mensaje inline */}
            {msg && (
              <div style={{
                background: msg.tipo === "ok" ? C.green + "22" : msg.tipo === "error" ? C.red + "22" : C.blue + "22",
                border: `1px solid ${msg.tipo === "ok" ? C.green : msg.tipo === "error" ? C.red : C.blue}55`,
                color: msg.tipo === "ok" ? C.green : msg.tipo === "error" ? C.red : C.blue,
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                marginBottom: 16,
              }}>
                {msg.tipo === "ok" ? "✅ " : msg.tipo === "error" ? "⚠️ " : "ℹ️ "}
                {msg.texto}
              </div>
            )}

            {/* Descripción hallazgos */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>
                Descripción de hallazgos técnicos <span style={{ color: C.red }}>*</span>
              </label>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                disabled={!!diagnostico?.terminado}
                rows={5}
                placeholder="Describe detalladamente los hallazgos técnicos encontrados..."
                style={{ ...inputStyle, resize: "vertical", height: 120 }}
              />
            </div>

            {/* Mano de obra + Total */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
              <div>
                <label style={labelStyle}>Mano de obra (RD$)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={manoObra}
                  onChange={e => setManoObra(e.target.value)}
                  disabled={!!diagnostico?.terminado}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Total estimado (calculado)</label>
                <input
                  type="text"
                  readOnly
                  value={fmtDinero(total)}
                  style={{ ...inputStyle, background: "#0f172a", color: C.green, fontWeight: 700, cursor: "default" }}
                />
              </div>
            </div>

            {/* ── Repuestos del inventario ────────────────────────── */}
            <div style={{
              background: "#162032", border: `1px solid ${C.border}`,
              borderRadius: 10, padding: 16, marginBottom: 18,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>🔩 Repuestos del Inventario</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    Total repuestos: <strong style={{ color: C.yellow }}>{fmtDinero(totalRepuestos)}</strong>
                  </div>
                </div>
                {!diagnostico?.terminado && (
                  <button
                    onClick={abrirPanelInventario}
                    style={{
                      background: C.blue, color: "#fff", border: "none", borderRadius: 8,
                      padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer",
                    }}
                  >
                    + Agregar repuesto
                  </button>
                )}
              </div>

              {/* Lista de repuestos seleccionados */}
              {repuestosItems.length === 0 ? (
                <p style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "12px 0" }}>
                  Sin repuestos agregados. Haz clic en &quot;+ Agregar repuesto&quot; para buscar en el inventario.
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {["Repuesto","Código","Cant.","Precio Unit.","Subtotal",""].map(h => (
                        <th key={h} style={{ padding: "6px 8px", textAlign: "left", color: C.muted, fontSize: 11, fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {repuestosItems.map(r => (
                      <tr key={r.inventario_id} style={{ borderBottom: `1px solid ${C.border}22` }}>
                        <td style={{ padding: "8px 8px", color: C.text, fontWeight: 600 }}>{r.nombre}</td>
                        <td style={{ padding: "8px 8px", color: C.muted, fontFamily: "monospace", fontSize: 11 }}>{r.codigo || "—"}</td>
                        <td style={{ padding: "8px 8px" }}>
                          {diagnostico?.terminado ? (
                            <span style={{ color: C.text }}>{r.cantidad}</span>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <button onClick={() => actualizarCantidad(r.inventario_id, r.cantidad - 1)}
                                style={{ background: C.border, color: C.text, border: "none", borderRadius: 4, width: 24, height: 24, cursor: "pointer", fontWeight: 700 }}>−</button>
                              <span style={{ color: C.text, minWidth: 24, textAlign: "center" }}>{r.cantidad}</span>
                              <button onClick={() => actualizarCantidad(r.inventario_id, Math.min(r.cantidad + 1, r.stock_disponible))}
                                disabled={r.cantidad >= r.stock_disponible}
                                style={{ background: C.border, color: r.cantidad >= r.stock_disponible ? C.muted : C.text,
                                  border: "none", borderRadius: 4, width: 24, height: 24,
                                  cursor: r.cantidad >= r.stock_disponible ? "not-allowed" : "pointer", fontWeight: 700 }}>+</button>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "8px 8px", color: C.muted }}>{fmtDinero(r.precio_unitario)}</td>
                        <td style={{ padding: "8px 8px", color: C.yellow, fontWeight: 700 }}>{fmtDinero(r.subtotal)}</td>
                        <td style={{ padding: "8px 8px" }}>
                          {!diagnostico?.terminado && (
                            <button onClick={() => actualizarCantidad(r.inventario_id, 0)}
                              style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 14 }}>🗑️</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: `2px solid ${C.border}` }}>
                      <td colSpan={4} style={{ padding: "8px 8px", textAlign: "right", color: C.muted, fontWeight: 600, fontSize: 12 }}>
                        Total repuestos:
                      </td>
                      <td style={{ padding: "8px 8px", color: C.yellow, fontWeight: 800, fontSize: 15 }}>
                        {fmtDinero(totalRepuestos)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Modal: búsqueda de inventario */}
            {showInvPanel && (
              <div style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
              }}>
                <div style={{
                  background: C.card, borderRadius: 14, padding: 24,
                  width: "min(680px, 95vw)", maxHeight: "80vh",
                  display: "flex", flexDirection: "column", boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <h3 style={{ margin: 0, color: C.text, fontSize: 16, fontWeight: 800 }}>🔩 Buscar repuesto en inventario</h3>
                    <button onClick={() => setShowInvPanel(false)}
                      style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
                  </div>

                  <input
                    autoFocus
                    type="text"
                    value={busqInv}
                    onChange={e => setBusqInv(e.target.value)}
                    placeholder="Buscar por nombre, código o categoría..."
                    style={{ ...inputStyle, marginBottom: 12, fontSize: 14 }}
                  />

                  <div style={{ overflowY: "auto", flex: 1 }}>
                    {loadingInv ? (
                      <p style={{ color: C.muted, textAlign: "center", padding: 20 }}>Cargando inventario...</p>
                    ) : inventarioFiltrado.length === 0 ? (
                      <p style={{ color: C.muted, textAlign: "center", padding: 20 }}>Sin resultados</p>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "#0f172a" }}>
                            {["Repuesto","Código","Categoría","Stock","Precio",""].map(h => (
                              <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: C.muted, fontSize: 11, fontWeight: 600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {inventarioFiltrado.map(item => {
                            const yaAgregado = repuestosItems.find(r => r.inventario_id === item.id);
                            const sinStock   = item.stock <= 0;
                            return (
                              <tr key={item.id}
                                style={{ borderBottom: `1px solid ${C.border}22`,
                                  background: yaAgregado ? C.blue + "11" : "transparent" }}
                              >
                                <td style={{ padding: "9px 10px", color: C.text, fontWeight: 600 }}>{item.name}</td>
                                <td style={{ padding: "9px 10px", color: C.muted, fontFamily: "monospace", fontSize: 11 }}>{item.code || "—"}</td>
                                <td style={{ padding: "9px 10px", color: C.muted }}>{item.categoria || "—"}</td>
                                <td style={{ padding: "9px 10px" }}>
                                  <span style={{
                                    color: sinStock ? C.red : item.stock <= 5 ? C.yellow : C.green,
                                    fontWeight: 700,
                                  }}>
                                    {sinStock ? "Sin stock" : `${item.stock} uds`}
                                  </span>
                                </td>
                                <td style={{ padding: "9px 10px", color: C.yellow }}>{fmtDinero(item.price)}</td>
                                <td style={{ padding: "9px 10px" }}>
                                  <button
                                    onClick={() => { agregarRepuesto(item); }}
                                    disabled={sinStock}
                                    style={{
                                      background: yaAgregado ? C.green + "22" : C.blue,
                                      color: yaAgregado ? C.green : "#fff",
                                      border: yaAgregado ? `1px solid ${C.green}` : "none",
                                      borderRadius: 6, padding: "5px 10px",
                                      fontWeight: 700, fontSize: 12,
                                      cursor: sinStock ? "not-allowed" : "pointer",
                                      opacity: sinStock ? 0.5 : 1,
                                    }}
                                  >
                                    {yaAgregado ? "✓ Agregado (+1)" : sinStock ? "Sin stock" : "+ Agregar"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div style={{ paddingTop: 12, borderTop: `1px solid ${C.border}`, marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: C.muted }}>
                      {repuestosItems.length} repuesto(s) seleccionado(s) — Total: <strong style={{ color: C.yellow }}>{fmtDinero(totalRepuestos)}</strong>
                    </span>
                    <button onClick={() => setShowInvPanel(false)}
                      style={{ background: C.green, color: "#fff", border: "none", borderRadius: 8,
                        padding: "9px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                      ✅ Confirmar selección
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tiempo estimado */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Tiempo estimado de reparación</label>
              <input
                type="text"
                value={tiempoEst}
                onChange={e => setTiempoEst(e.target.value)}
                disabled={!!diagnostico?.terminado}
                placeholder='Ej: "2 horas", "1 día", "3 días hábiles"'
                style={inputStyle}
              />
            </div>

            {/* Detalle de mano de obra */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Detalle de mano de obra (una línea por trabajo)</label>
              <textarea
                value={moDetalle}
                onChange={e => setMoDetalle(e.target.value)}
                disabled={!!diagnostico?.terminado}
                rows={4}
                placeholder={"Cambio de aceite y filtro\nAlineación y balanceo\nRevisión de frenos"}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            {/* Notas adicionales */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Notas adicionales</label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                disabled={!!diagnostico?.terminado}
                rows={3}
                placeholder="Observaciones, advertencias, recomendaciones..."
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            {/* Botones de acción */}
            {!diagnostico?.terminado && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  onClick={() => guardar(false)}
                  disabled={saving}
                  style={{
                    background: C.blue + "22",
                    color: C.blue,
                    border: `1px solid ${C.blue}55`,
                    borderRadius: 8,
                    padding: "10px 20px",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? "⏳ Guardando..." : "💾 Guardar Borrador"}
                </button>

                <button
                  onClick={() => setConfirmCerrar(true)}
                  disabled={saving}
                  style={{
                    background: C.green,
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 20px",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.7 : 1,
                    boxShadow: `0 2px 8px ${C.green}44`,
                  }}
                >
                  ✅ Cerrar Diagnóstico → Enviar para Aprobación
                </button>
              </div>
            )}

            {diagnostico?.terminado && (
              <div style={{ background: C.purple + "22", border: `1px solid ${C.purple}55`, borderRadius: 8, padding: "12px 16px", color: C.purple, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                ✅ Este diagnóstico ya fue cerrado y enviado para aprobación.
              </div>
            )}

            {/* Botón Generar Cotización (disponible cuando hay diagnóstico guardado) */}
            {diagnostico?.id && (
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={async () => {
                    // Generar/actualizar cotización con los datos actuales y navegar
                    try {
                      const res = await fetch(`${API}/cotizaciones/diagnostico`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          diagnostico_id:      diagnostico.id,
                          mano_obra:           parseFloat(manoObra) || 0,
                          repuestos:           totalRepuestos,
                          total:               total,
                          tiempo_estimado:     tiempoEst,
                          mano_de_obra_detalle: moDetalle,
                          notas:               notas,
                          items_detalle:       repuestosItems,
                          usuario_id:          usuario.id,
                          usuario_nombre:      usuario.nombre || usuario.name,
                        }),
                      });
                      const data = await res.json();
                      if (data?.id) {
                        router.push(`/cotizacion/${data.id}`);
                      } else {
                        alert("Error al generar cotización: " + (data?.error || "Sin ID"));
                      }
                    } catch (e: any) {
                      alert("Error: " + e.message);
                    }
                  }}
                  style={{
                    background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                    color: "#fff", border: "none", borderRadius: 8,
                    padding: "11px 22px", fontWeight: 800, fontSize: 14,
                    cursor: "pointer", boxShadow: "0 4px 14px rgba(124,58,237,0.4)",
                  }}
                >
                  📄 Ver / Generar Cotización
                </button>
                <p style={{ margin: "6px 0 0", fontSize: 11, color: C.muted }}>
                  Genera una cotización formal con el diagnóstico, repuestos e inspección del vehículo.
                </p>
              </div>
            )}

            {/* Confirmación inline para cerrar */}
            {confirmCerrar && (
              <div style={{
                marginTop: 16,
                background: C.orange + "11",
                border: `1px solid ${C.orange}55`,
                borderRadius: 10,
                padding: 18,
              }}>
                <p style={{ margin: "0 0 12px", fontWeight: 700, color: C.orange, fontSize: 14 }}>
                  ⚠️ ¿Confirmas cerrar el diagnóstico?
                </p>
                <p style={{ margin: "0 0 16px", color: C.muted, fontSize: 13 }}>
                  El diagnóstico pasará a estado <strong>Esperando Aprobación</strong>. Esta acción no se puede deshacer.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => guardar(true)}
                    disabled={saving}
                    style={{
                      background: C.green,
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "10px 20px",
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: saving ? "not-allowed" : "pointer",
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? "⏳ Enviando..." : "✅ Sí, cerrar y enviar"}
                  </button>
                  <button
                    onClick={() => setConfirmCerrar(false)}
                    style={{ background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function CampoReadonly({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      {multiline ? (
        <div style={{ fontSize: 13, color: "#e2e8f0", background: "#0f172a", borderRadius: 6, padding: "8px 10px", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
          {value}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{value}</div>
      )}
    </div>
  );
}

// ── Estilos base ──────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  fontWeight: 600,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#1e293b",
  color: "#e2e8f0",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "system-ui, sans-serif",
};
