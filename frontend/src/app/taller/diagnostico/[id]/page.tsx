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
  { key: "luces_ok",           label: "Luces" },
  { key: "espejos_ok",         label: "Espejos" },
  { key: "radio_pantalla",     label: "Radio / Pantalla" },
  { key: "tapiceria_ok",       label: "Tapiceria" },
  { key: "alfombras_ok",       label: "Alfombras" },
  { key: "bocina_ok",          label: "Bocina" },
  { key: "gato_ok",            label: "Gato hidraulico" },
  { key: "llanta_repuesto_ok", label: "Llanta repuesto" },
  { key: "documentos_ok",      label: "Documentos" },
  { key: "herramientas_ok",    label: "Herramientas" },
];

// ── Sub-componente ────────────────────────────────────────────────────────────
function CampoReadonly({
  label,
  value,
  multiline,
}: {
  label: string;
  value?: string | number | null;
  multiline?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
        {label}
      </div>
      {multiline ? (
        <div style={{ fontSize: 12, color: "#e2e8f0", background: "#0f172a", borderRadius: 6, padding: "6px 10px", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
          {value || "—"}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>
          {value ?? "—"}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function DiagnosticoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [orden,         setOrden]         = useState<OrdenDetalle | null>(null);
  const [inspeccion,    setInspeccion]    = useState<Inspeccion | null>(null);
  const [diagnostico,   setDiagnostico]   = useState<Diagnostico | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [msg,           setMsg]           = useState<Msg | null>(null);
  const [inspecOpen,    setInspecOpen]    = useState(false);
  const [confirmCerrar, setConfirmCerrar] = useState(false);
  const [exito,         setExito]         = useState(false);
  const [mejorandoIA,   setMejorandoIA]   = useState<"desc" | "trabajos" | null>(null);
  const [iaModal,       setIaModal]       = useState<{ campo: "desc" | "trabajos"; mejorado: string } | null>(null);

  // Campos del formulario
  const [desc,      setDesc]      = useState("");
  const [manoObra,  setManoObra]  = useState("0");
  const [tiempoEst, setTiempoEst] = useState("");
  const [moDetalle, setMoDetalle] = useState("");
  const [notas,     setNotas]     = useState("");

  // Checklist rápido de diagnóstico
  const [checklistSel, setChecklistSel] = useState<Set<string>>(new Set());

  // Repuestos del inventario
  const [repuestosItems, setRepuestosItems] = useState<RepuestoSeleccionado[]>([]);
  const [inventario,     setInventario]     = useState<InventarioItem[]>([]);
  const [busqInv,        setBusqInv]        = useState("");
  const [showInvPanel,   setShowInvPanel]   = useState(false);
  const [loadingInv,     setLoadingInv]     = useState(false);
  // Repuestos sugeridos por compatibilidad
  const [sugeridos,      setSugeridos]      = useState<any[]>([]);
  const [loadingSuger,   setLoadingSuger]   = useState(false);

  // Total calculado
  const totalRepuestos = repuestosItems.reduce((s, r) => s + r.subtotal, 0);
  const total = (parseFloat(manoObra) || 0) + totalRepuestos;

  // Usuario logueado (sin SSR mismatch)
  const [usuario, setUsuario] = useState<Record<string, any>>({});
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const d = localStorage.getItem("usuario");
        if (d) setUsuario(JSON.parse(d));
      } catch (_e) {}
    }
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const aplicarDiagnostico = (diag: Diagnostico) => {
    setDiagnostico(diag);
    setDesc(diag.descripcion || "");
    setManoObra(String(diag.mano_obra ?? "0"));
    setTiempoEst(diag.tiempo_estimado || "");
    setMoDetalle(diag.mano_de_obra_detalle || "");
    setNotas(diag.notas || "");
    if (Array.isArray((diag as any).repuestos_items) && (diag as any).repuestos_items.length > 0) {
      setRepuestosItems((diag as any).repuestos_items);
    }
  };

  const cargarInventario = async () => {
    if (inventario.length > 0) return;
    setLoadingInv(true);
    try {
      const res  = await fetch(`${API}/inventario`);
      const data = await res.json();
      setInventario(Array.isArray(data) ? data : []);
    } catch (_e) {}
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
        return prev.map(r =>
          r.inventario_id === item.id
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
    return (
      !q ||
      item.name?.toLowerCase().includes(q) ||
      item.code?.toLowerCase().includes(q) ||
      item.categoria?.toLowerCase().includes(q)
    );
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
        const raw  = data.orden    || data;
        const cli  = data.cliente  || {};
        const veh  = data.vehiculo || {};
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
        const [rLista, rDiags] = await Promise.all([
          fetch(`${API}/ordenes`),
          fetch(`${API}/diagnosticos?orden_id=${id}`),
        ]);
        if (rLista.ok) {
          const lista: any[] = await rLista.json();
          const found = (Array.isArray(lista) ? lista : []).find(
            (o: any) => String(o.id) === String(id)
          );
          if (!found) {
            setMsg({ tipo: "error", texto: `Orden #${id} no encontrada.` });
            setLoading(false);
            return;
          }
          setOrden(found as OrdenDetalle);
        } else {
          setMsg({ tipo: "error", texto: `No se pudo cargar la orden #${id}.` });
          setLoading(false);
          return;
        }
        if (rDiags.ok) {
          const diags: any[] = await rDiags.json();
          const diag = (Array.isArray(diags) ? diags : []).find(
            (d: any) => String(d.orden_id) === String(id)
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

  // ── Repuestos sugeridos por compatibilidad ────────────────────────────────
  useEffect(() => {
    if (!orden?.vehiculo_id) return;
    setLoadingSuger(true);
    fetch(`${API}/vehiculos/${orden.vehiculo_id}/repuestos-sugeridos`)
      .then(r => r.ok ? r.json() : { sugeridos: [] })
      .then(d => setSugeridos(Array.isArray(d.sugeridos) ? d.sugeridos : []))
      .catch(() => setSugeridos([]))
      .finally(() => setLoadingSuger(false));
  }, [orden?.vehiculo_id]);

  // ── Guardar ───────────────────────────────────────────────────────────────
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

    const moverEstado = async (nuevoEstado: string) => {
      try {
        const r = await fetch(`${API}/ordenes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            estado:         nuevoEstado,
            usuario_id:     usuario.id     || null,
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
    } catch (e: any) {
      setMsg({ tipo: "error", texto: e.message || "Error al guardar diagnostico." });
    } finally {
      setSaving(false);
    }
  };

  // ── IA: Mejorar texto ─────────────────────────────────────────────────────
  const mejorarConIA = async (campo: "desc" | "trabajos") => {
    const texto = campo === "desc" ? desc : moDetalle;
    if (!texto.trim() || texto.trim().length < 15) {
      setMsg({ tipo: "error", texto: "Escribe al menos una descripción antes de usar la IA." });
      return;
    }
    setMejorandoIA(campo);
    setMsg(null);
    try {
      const r = await fetch(`${API}/api/ia/mejorar-texto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto,
          tipo: campo === "desc" ? "diagnostico" : "trabajos",
          vehiculo: vehiculoStr !== "—" ? vehiculoStr : undefined,
          cliente: orden?.cliente_nombre,
        }),
      });
      const data = await r.json();
      if (data.error) { setMsg({ tipo: "error", texto: data.error }); return; }
      setIaModal({ campo, mejorado: data.mejorado });
    } catch {
      setMsg({ tipo: "error", texto: "No se pudo conectar con la IA. Verifica la conexión." });
    } finally {
      setMejorandoIA(null);
    }
  };

  // ── Estilos ───────────────────────────────────────────────────────────────
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

  const tituloOrden  = numero(orden.id, orden.numero_orden);
  const partsArr     = [orden.vehiculo_marca, orden.vehiculo_modelo, orden.vehiculo_ano].filter(Boolean);
  const vehiculoStr  = partsArr.length > 0 ? partsArr.join(" ") : (orden.vehiculo_info || "—");

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#1e293b", borderBottom: `1px solid ${C.border}`, padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => router.push("/taller")}
          style={{ background: "transparent", color: C.muted, border: "none", cursor: "pointer", fontSize: 20, padding: 0 }}
        >
          {"←"}
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            Diagnostico — {tituloOrden}
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: C.muted }}>
            {orden.cliente_nombre} {vehiculoStr !== "—" ? `· ${vehiculoStr}` : ""}
            {orden.vehiculo_placa ? ` · ${orden.vehiculo_placa}` : ""}
          </p>
        </div>
      </div>

      {/* Pantalla de exito */}
      {exito && (
        <div style={{ padding: 40, maxWidth: 600, margin: "60px auto", textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>{"✅"}</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: C.green, margin: "0 0 12px" }}>
            Diagnostico enviado para aprobacion
          </h2>
          <p style={{ color: C.muted, marginBottom: 24 }}>
            El diagnostico de <strong>{tituloOrden}</strong> ha sido completado y esta esperando aprobacion del cliente.
          </p>
          <button
            onClick={() => router.push("/taller")}
            style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
          >
            {"←"} Volver al taller
          </button>
        </div>
      )}

      {!exito && (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 0, maxWidth: 1280, margin: "0 auto", minHeight: "calc(100vh - 65px)" }}>

          {/* Panel izquierdo: inspeccion */}
          <div style={{ borderRight: `1px solid ${C.border}`, padding: 20, overflowY: "auto" }}>
            <button
              onClick={() => setInspecOpen(p => !p)}
              style={{
                width: "100%", background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: "10px 14px", color: C.text, fontWeight: 700,
                fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "space-between", marginBottom: 12,
              }}
            >
              <span>Inspeccion de Entrada</span>
              <span style={{ color: C.muted }}>{inspecOpen ? "▲" : "▼"}</span>
            </button>

            {inspecOpen && (
              <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {!inspeccion ? (
                  <p style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>Sin inspeccion registrada</p>
                ) : (
                  <React.Fragment>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <CampoReadonly
                        label="KM entrada"
                        value={inspeccion.km_entrada ? `${Number(inspeccion.km_entrada).toLocaleString()} km` : "—"}
                      />
                      <CampoReadonly
                        label="Combustible"
                        value={inspeccion.nivel_combustible != null ? `${inspeccion.nivel_combustible}%` : "—"}
                      />
                    </div>
                    <CampoReadonly label="Condicion general" value={inspeccion.condicion_general || "—"} />

                    <div>
                      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Checklist</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                        {CHECKLIST_LABELS.map(({ key, label }) => {
                          const val = inspeccion[key];
                          const ok  = val === true || val === 1;
                          return (
                            <div key={String(key)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
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
                  </React.Fragment>
                )}
              </div>
            )}

            {!inspecOpen && (
              <p style={{ fontSize: 12, color: C.muted, textAlign: "center" }}>
                Haz clic en el acordeon para ver la inspeccion
              </p>
            )}
          </div>

          {/* Panel derecho: formulario */}
          <div style={{ padding: 24, overflowY: "auto" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 20px", color: C.text }}>
              Formulario de Diagnostico
              {diagnostico && !diagnostico.terminado && (
                <span style={{ marginLeft: 10, fontSize: 11, color: C.yellow, fontWeight: 600 }}>(borrador guardado)</span>
              )}
              {diagnostico?.terminado && (
                <span style={{ marginLeft: 10, fontSize: 11, color: C.purple, fontWeight: 600 }}>(diagnostico cerrado)</span>
              )}
            </h2>

            {/* Mensaje */}
            {msg && (
              <div style={{
                background: msg.tipo === "ok" ? C.green + "22" : msg.tipo === "error" ? C.red + "22" : C.blue + "22",
                border: `1px solid ${msg.tipo === "ok" ? C.green : msg.tipo === "error" ? C.red : C.blue}55`,
                color: msg.tipo === "ok" ? C.green : msg.tipo === "error" ? C.red : C.blue,
                borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16,
              }}>
                {msg.tipo === "ok" ? "OK: " : msg.tipo === "error" ? "Error: " : "Info: "}
                {msg.texto}
              </div>
            )}

            {/* ── Checklist rápido de problemas ── */}
            {!diagnostico?.terminado && (() => {
              const GRUPOS = [
                {
                  label: "🔧 Motor y Mecánica", color: C.orange, items: [
                    "Motor con falla / no enciende",
                    "Ruido en motor (válvulas, cadena, etc.)",
                    "Pérdida de potencia",
                    "Sobrecalentamiento",
                    "Fuga de aceite",
                    "Fuga de refrigerante",
                    "Consumo excesivo de aceite",
                    "Humo excesivo (azul / negro / blanco)",
                    "Vibración excesiva en motor",
                    "Fallo en arranque / motor de arranque",
                  ],
                },
                {
                  label: "⚡ Sistema Eléctrico", color: C.yellow, items: [
                    "Batería descargada / no carga",
                    "Alternador defectuoso",
                    "Fallo en sistema de luces",
                    "Corto circuito",
                    "Luz check engine encendida",
                    "Fallo en sensor (ABS, oxígeno, MAF, etc.)",
                    "Sistema de arranque sin respuesta",
                    "Fusible quemado",
                    "Problema en sistema de audio / pantalla",
                    "A/C no enfría (eléctrico)",
                  ],
                },
                {
                  label: "🛑 Frenos y Suspensión", color: C.red, items: [
                    "Frenos fallan / pedal blando",
                    "Ruido en frenos (chirrido / golpe)",
                    "Fuga de líquido de frenos",
                    "Vibración al frenar",
                    "Ruido en suspensión (amortiguadores)",
                    "Jaloneos en dirección",
                    "Volante desviado / no alinea",
                    "Ruido en rodamientos / cubos",
                    "Estabilizadores / bujes desgastados",
                  ],
                },
                {
                  label: "⚙️ Transmisión y Tren", color: C.purple, items: [
                    "Transmisión no engancha / resbala",
                    "Ruido en caja de cambios",
                    "Fuga de aceite de transmisión",
                    "Problemas en diferencial",
                    "Fallo en clutch / embrague",
                    "Fallo en palier / semieje",
                    "Ruido en cardán / junta homocinética",
                  ],
                },
                {
                  label: "❄️ A/C y Confort", color: C.blue, items: [
                    "A/C no enfría (gas agotado)",
                    "Compresor de A/C defectuoso",
                    "Fuga de refrigerante A/C",
                    "Calefacción no funciona",
                    "Olores internos",
                  ],
                },
                {
                  label: "🔍 Mantenimiento", color: C.green, items: [
                    "Cambio de aceite y filtro",
                    "Cambio de filtros (aire, combustible)",
                    "Revisión de bujías",
                    "Alineación y balanceo",
                    "Revisión de líquidos y fluidos",
                    "Mantenimiento preventivo 5,000 km",
                    "Mantenimiento preventivo 10,000 km",
                    "Mantenimiento preventivo 20,000 km",
                  ],
                },
              ];

              const toggleItem = (item: string) => {
                setChecklistSel(prev => {
                  const next = new Set(prev);
                  if (next.has(item)) next.delete(item); else next.add(item);
                  return next;
                });
              };

              const aplicarChecklist = () => {
                if (checklistSel.size === 0) return;
                const lineas = Array.from(checklistSel).map(i => `• ${i}`).join("\n");
                setDesc(prev => prev ? prev + "\n\n" + lineas : lineas);
                setChecklistSel(new Set());
              };

              return (
                <div style={{ marginBottom: 20, background: C.card2, borderRadius: 10, border: `1px solid ${C.border}`, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>
                      ⚡ Checklist rápido — selecciona los hallazgos
                    </div>
                    {checklistSel.size > 0 && (
                      <button
                        onClick={aplicarChecklist}
                        style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        ✓ Agregar {checklistSel.size} al diagnóstico
                      </button>
                    )}
                  </div>
                  {GRUPOS.map(g => (
                    <div key={g.label} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: g.color, marginBottom: 6 }}>{g.label}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {g.items.map(item => {
                          const sel = checklistSel.has(item);
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => toggleItem(item)}
                              style={{
                                padding: "4px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                                fontWeight: sel ? 700 : 500,
                                background: sel ? g.color + "33" : C.card,
                                color: sel ? g.color : C.muted,
                                border: `1px solid ${sel ? g.color + "88" : C.border}`,
                                transition: "all .1s",
                              }}
                            >
                              {sel ? "✓ " : ""}{item}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {checklistSel.size > 0 && (
                    <div style={{ marginTop: 8, padding: "8px 12px", background: C.blue + "15", borderRadius: 7, border: `1px solid ${C.blue}33`, fontSize: 12, color: C.blue }}>
                      {checklistSel.size} ítem{checklistSel.size > 1 ? "s" : ""} seleccionado{checklistSel.size > 1 ? "s" : ""}. Haz clic en <strong>"Agregar al diagnóstico"</strong> para añadirlos al campo de descripción.
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Descripcion */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>
                  Descripcion de hallazgos tecnicos <span style={{ color: C.red }}>*</span>
                </label>
                {!diagnostico?.terminado && (
                  <button
                    type="button"
                    onClick={() => mejorarConIA("desc")}
                    disabled={mejorandoIA === "desc"}
                    style={{
                      background: mejorandoIA === "desc" ? "#4c1d95" : "#7c3aed",
                      color: "#fff", border: "none", borderRadius: 7,
                      padding: "5px 12px", fontSize: 12, fontWeight: 700,
                      cursor: mejorandoIA === "desc" ? "wait" : "pointer",
                      display: "flex", alignItems: "center", gap: 5,
                    }}
                  >
                    {mejorandoIA === "desc" ? "⏳ Procesando..." : "✨ Pulir con IA"}
                  </button>
                )}
              </div>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                disabled={!!diagnostico?.terminado}
                rows={5}
                placeholder="Describe detalladamente los hallazgos tecnicos encontrados... (o usa el checklist rápido arriba)"
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

            {/* Repuestos sugeridos por compatibilidad */}
            {(loadingSuger || sugeridos.length > 0) && (
              <div style={{ background: "#0f1f0f", border: "1px solid #16a34a44", borderRadius: 10, padding: 16, marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#4ade80", marginBottom: 10 }}>
                  ✨ Repuestos sugeridos para este vehículo
                  <span style={{ fontSize: 11, fontWeight: 400, color: "#86efac", marginLeft: 8 }}>
                    basado en reparaciones anteriores
                  </span>
                </div>
                {loadingSuger ? (
                  <p style={{ fontSize: 13, color: C.muted }}>Buscando sugerencias…</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {sugeridos.map((s: any) => {
                      const yaAgregado = repuestosItems.some(r => r.inventario_id === s.inventario_id);
                      return (
                        <div
                          key={s.inventario_id}
                          style={{
                            background: yaAgregado ? "#16a34a22" : "#162032",
                            border: `1px solid ${yaAgregado ? "#16a34a" : C.border}`,
                            borderRadius: 8, padding: "8px 12px",
                            display: "flex", alignItems: "center", gap: 10,
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{s.nombre}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                              {s.codigo && <span style={{ fontFamily: "monospace" }}>{s.codigo} · </span>}
                              usado {s.veces_usado}× · stock: {s.stock ?? "—"}
                            </div>
                          </div>
                          {!diagnostico?.terminado && !yaAgregado && (
                            <button
                              onClick={() => {
                                const inv: InventarioItem = {
                                  id: s.inventario_id,
                                  name: s.nombre,
                                  code: s.codigo,
                                  price: s.precio ?? 0,
                                  stock: s.stock ?? 99,
                                };
                                agregarRepuesto(inv);
                              }}
                              style={{
                                background: "#16a34a", color: "#fff", border: "none",
                                borderRadius: 6, padding: "5px 10px", fontSize: 12,
                                cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap",
                              }}
                            >
                              + Agregar
                            </button>
                          )}
                          {yaAgregado && (
                            <span style={{ fontSize: 11, color: "#4ade80", fontWeight: 700 }}>✓ En lista</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Repuestos del inventario */}
            <div style={{ background: "#162032", border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Repuestos del Inventario</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    Total repuestos: <strong style={{ color: C.yellow }}>{fmtDinero(totalRepuestos)}</strong>
                  </div>
                </div>
                {!diagnostico?.terminado && (
                  <button
                    onClick={abrirPanelInventario}
                    style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  >
                    + Agregar repuesto
                  </button>
                )}
              </div>

              {repuestosItems.length === 0 ? (
                <p style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "12px 0" }}>
                  Sin repuestos agregados. Haz clic en "+ Agregar repuesto" para buscar en el inventario.
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {["Repuesto", "Codigo", "Cant.", "Precio Unit.", "Subtotal", ""].map(h => (
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
                              <button
                                onClick={() => actualizarCantidad(r.inventario_id, r.cantidad - 1)}
                                style={{ background: C.border, color: C.text, border: "none", borderRadius: 4, width: 24, height: 24, cursor: "pointer", fontWeight: 700 }}
                              >
                                {"-"}
                              </button>
                              <span style={{ color: C.text, minWidth: 24, textAlign: "center" }}>{r.cantidad}</span>
                              <button
                                onClick={() => actualizarCantidad(r.inventario_id, Math.min(r.cantidad + 1, r.stock_disponible))}
                                disabled={r.cantidad >= r.stock_disponible}
                                style={{ background: C.border, color: r.cantidad >= r.stock_disponible ? C.muted : C.text, border: "none", borderRadius: 4, width: 24, height: 24, cursor: r.cantidad >= r.stock_disponible ? "not-allowed" : "pointer", fontWeight: 700 }}
                              >
                                {"+"}
                              </button>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "8px 8px", color: C.muted }}>{fmtDinero(r.precio_unitario)}</td>
                        <td style={{ padding: "8px 8px", color: C.yellow, fontWeight: 700 }}>{fmtDinero(r.subtotal)}</td>
                        <td style={{ padding: "8px 8px" }}>
                          {!diagnostico?.terminado && (
                            <button
                              onClick={() => actualizarCantidad(r.inventario_id, 0)}
                              style={{ background: "transparent", color: C.red, border: "none", cursor: "pointer", fontSize: 16, padding: "2px 6px" }}
                            >
                              {"✕"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Trabajos a realizar */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Trabajos a realizar (uno por linea)</label>
                {!diagnostico?.terminado && (
                  <button
                    type="button"
                    onClick={() => mejorarConIA("trabajos")}
                    disabled={mejorandoIA === "trabajos"}
                    style={{
                      background: mejorandoIA === "trabajos" ? "#4c1d95" : "#7c3aed",
                      color: "#fff", border: "none", borderRadius: 7,
                      padding: "5px 12px", fontSize: 12, fontWeight: 700,
                      cursor: mejorandoIA === "trabajos" ? "wait" : "pointer",
                      display: "flex", alignItems: "center", gap: 5,
                    }}
                  >
                    {mejorandoIA === "trabajos" ? "⏳ Procesando..." : "✨ Pulir con IA"}
                  </button>
                )}
              </div>
              <textarea
                value={moDetalle}
                onChange={e => setMoDetalle(e.target.value)}
                disabled={!!diagnostico?.terminado}
                rows={4}
                placeholder={"Cambio de aceite y filtro\nAlineacion y balanceo\nRevision de frenos"}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            {/* Tiempo + Notas */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
              <div>
                <label style={labelStyle}>Tiempo estimado</label>
                <input
                  type="text"
                  value={tiempoEst}
                  onChange={e => setTiempoEst(e.target.value)}
                  disabled={!!diagnostico?.terminado}
                  placeholder="Ej: 2-3 horas"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Notas internas</label>
                <input
                  type="text"
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  disabled={!!diagnostico?.terminado}
                  placeholder="Observaciones adicionales..."
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Botones de accion */}
            {!diagnostico?.terminado && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  onClick={() => guardar(false)}
                  disabled={saving}
                  style={{
                    flex: 1, minWidth: 140, padding: "12px 20px",
                    background: C.card, border: `1px solid ${C.border}`,
                    borderRadius: 10, color: C.text, fontWeight: 700,
                    fontSize: 14, cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? "Guardando..." : "Guardar borrador"}
                </button>
                <button
                  onClick={() => setConfirmCerrar(true)}
                  disabled={saving || !desc.trim()}
                  style={{
                    flex: 1, minWidth: 180, padding: "12px 20px",
                    background: saving || !desc.trim() ? C.muted : C.blue,
                    border: "none", borderRadius: 10, color: "#fff",
                    fontWeight: 800, fontSize: 14,
                    cursor: saving || !desc.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  Cerrar diagnostico
                </button>
              </div>
            )}

            {/* Boton cotizacion */}
            {diagnostico?.id && (
              <div style={{ marginTop: 16, textAlign: "right" }}>
                <button
                  onClick={async () => {
                    try {
                      const r = await fetch(`${API}/cotizaciones/por-diagnostico/${diagnostico.id}`);
                      const existing = await r.json();
                      if (existing?.id) { router.push(`/cotizacion/${existing.id}`); return; }
                      const bodyObj = {
                        diagnostico_id: diagnostico.id,
                        mano_obra:      parseFloat(manoObra) || 0,
                        repuestos:      totalRepuestos,
                        total,
                        tiempo_estimado: tiempoEst,
                        notas,
                        items_detalle:  repuestosItems,
                      };
                      const res2  = await fetch(`${API}/cotizaciones/diagnostico`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(bodyObj),
                      });
                      const data2 = await res2.json();
                      if (data2?.cotizacion?.id) router.push(`/cotizacion/${data2.cotizacion.id}`);
                      else if (data2?.id) router.push(`/cotizacion/${data2.id}`);
                    } catch (_e) {
                      setMsg({ tipo: "error", texto: "No se pudo generar la cotizacion." });
                    }
                  }}
                  style={{
                    background: "#0f172a", color: C.blue,
                    border: `1px solid ${C.blue}`, borderRadius: 8,
                    padding: "8px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  }}
                >
                  Ver / Generar Cotizacion
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: buscar en inventario */}
      {showInvPanel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: C.card, borderRadius: 14, padding: 24, width: "min(600px, 95vw)", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text }}>Buscar en Inventario</h3>
              <button
                onClick={() => setShowInvPanel(false)}
                style={{ background: "transparent", border: "none", color: C.muted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}
              >
                {"✕"}
              </button>
            </div>
            <input
              type="text"
              value={busqInv}
              onChange={e => setBusqInv(e.target.value)}
              placeholder="Buscar por nombre, codigo o categoria..."
              style={{ width: "100%", padding: "10px 12px", background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, marginBottom: 14, boxSizing: "border-box" }}
              autoFocus
            />
            <div style={{ overflowY: "auto", flex: 1 }}>
              {loadingInv ? (
                <p style={{ color: C.muted, textAlign: "center", padding: 20 }}>Cargando inventario...</p>
              ) : inventarioFiltrado.length === 0 ? (
                <p style={{ color: C.muted, textAlign: "center", padding: 20 }}>Sin resultados</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {["Nombre", "Codigo", "Stock", "Precio", ""].map(h => (
                        <th key={h} style={{ padding: "6px 8px", textAlign: "left", color: C.muted, fontSize: 11, fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inventarioFiltrado.map(item => {
                      const stock       = item.stock ?? 0;
                      const stockColor  = stock === 0 ? C.red : stock <= 3 ? C.yellow : C.green;
                      const yaAgregado  = repuestosItems.find(r => r.inventario_id === item.id);
                      return (
                        <tr key={item.id} style={{ borderBottom: `1px solid ${C.border}22` }}>
                          <td style={{ padding: "8px 8px", color: C.text, fontWeight: 600 }}>{item.name}</td>
                          <td style={{ padding: "8px 8px", color: C.muted, fontSize: 11 }}>{item.code || "—"}</td>
                          <td style={{ padding: "8px 8px" }}>
                            <span style={{ color: stockColor, fontWeight: 700 }}>{stock}</span>
                          </td>
                          <td style={{ padding: "8px 8px", color: C.yellow }}>{fmtDinero(item.price)}</td>
                          <td style={{ padding: "8px 8px" }}>
                            <button
                              onClick={() => agregarRepuesto(item)}
                              disabled={stock === 0}
                              style={{
                                background: stock === 0 ? C.muted : yaAgregado ? C.green : C.blue,
                                color: "#fff", border: "none", borderRadius: 6,
                                padding: "5px 12px", fontSize: 12, fontWeight: 700,
                                cursor: stock === 0 ? "not-allowed" : "pointer",
                              }}
                            >
                              {stock === 0 ? "Sin stock" : yaAgregado ? `Agregado (${yaAgregado.cantidad})` : "+ Agregar"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ marginTop: 16, textAlign: "right" }}>
              <button
                onClick={() => setShowInvPanel(false)}
                style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, cursor: "pointer" }}
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: resultado IA */}
      {iaModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: C.card, borderRadius: 16, padding: 28, width: "min(660px, 96vw)", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#a78bfa" }}>
                  ✨ Texto mejorado por IA
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>
                  {iaModal.campo === "desc" ? "Diagnóstico técnico" : "Trabajos a realizar"} — revisa y acepta o descarta
                </p>
              </div>
              <button onClick={() => setIaModal(null)} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>

            {/* Texto original */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                Texto original del técnico
              </div>
              <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#94a3b8", whiteSpace: "pre-wrap", maxHeight: 100, overflowY: "auto" }}>
                {iaModal.campo === "desc" ? desc : moDetalle}
              </div>
            </div>

            {/* Texto mejorado — editable */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                ✨ Versión profesional (puedes editar antes de aceptar)
              </div>
              <textarea
                value={iaModal.mejorado}
                onChange={e => setIaModal(prev => prev ? { ...prev, mejorado: e.target.value } : null)}
                style={{
                  flex: 1, minHeight: 220, width: "100%", padding: "12px 14px",
                  background: "#0f172a", border: "2px solid #7c3aed55",
                  borderRadius: 8, color: "#e2e8f0", fontSize: 13, lineHeight: 1.7,
                  resize: "vertical", boxSizing: "border-box", fontFamily: "inherit",
                }}
              />
            </div>

            {/* Botones */}
            <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
              <button
                onClick={() => setIaModal(null)}
                style={{ flex: 1, padding: "11px 0", background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.muted, fontWeight: 700, cursor: "pointer" }}
              >
                ✕ Descartar
              </button>
              <button
                onClick={() => {
                  if (iaModal.campo === "desc") setDesc(iaModal.mejorado);
                  else setMoDetalle(iaModal.mejorado);
                  setIaModal(null);
                  setMsg({ tipo: "ok", texto: "Texto mejorado aplicado. Recuerda guardar el diagnóstico." });
                }}
                style={{ flex: 2, padding: "11px 0", background: "#7c3aed", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}
              >
                ✅ Aceptar y aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: confirmar cerrar diagnostico */}
      {confirmCerrar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: C.card, borderRadius: 14, padding: 28, width: "min(420px, 95vw)", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 18, color: C.text }}>Cerrar diagnostico</h3>
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>
              Al cerrar el diagnostico se enviara para aprobacion del cliente y no podras editarlo mas.
              Confirmas que el diagnostico esta completo?
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setConfirmCerrar(false)}
                style={{ flex: 1, padding: "11px 0", background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontWeight: 700, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => guardar(true)}
                disabled={saving}
                style={{ flex: 1, padding: "11px 0", background: C.blue, border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Guardando..." : "Si, cerrar"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
