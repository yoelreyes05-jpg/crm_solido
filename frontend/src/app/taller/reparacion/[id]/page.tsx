"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { API_URL as API } from "@/config";
import FichaTecnicaVehiculo from "@/components/FichaTecnicaVehiculo";

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Orden {
  id: number;
  numero_orden: string;
  estado: string;
  cliente_nombre: string;
  vehiculo_info: string;
  vehiculo_marca?: string;
  vehiculo_modelo?: string;
  vehiculo_placa?: string;
  vehiculo_ano?: string;
  vehiculo_id?: number;
  descripcion: string;
  created_at: string;
}

interface Avance {
  id: number;
  orden_id: number;
  descripcion: string;
  tecnico_nombre: string;
  usuario_id?: number;
  created_at: string;
}

interface Repuesto {
  id: number;
  nombre: string;
  codigo?: string;
  precio?: number;
  stock: number;
  unidad?: string;
}

interface RepuestoSeleccionado {
  id: number;
  nombre: string;
  codigo?: string;
  precio: number;
  cantidad: number;
  stock: number;
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
  cyan:   "#06b6d4",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function numeroOrden(o: Orden): string {
  return o.numero_orden || `OT-${String(o.id).padStart(4, "0")}`;
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-DO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const ESTADO_INFO: Record<string, { label: string; color: string }> = {
  RECIBIDO:             { label: "Recibido",        color: C.blue },
  DIAGNOSTICO:          { label: "Diagnóstico",     color: C.yellow },
  ESPERANDO_APROBACION: { label: "Esp. Aprobación", color: C.orange },
  REPARACION:           { label: "En Reparación",   color: C.red },
  CONTROL_CALIDAD:      { label: "Control Calidad", color: C.purple },
  LISTO:                { label: "Listo",           color: C.green },
  ENTREGADO:            { label: "Entregado",       color: "#6b7280" },
};

// ── Componente principal ──────────────────────────────────────────────────────
export default function ReparacionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [orden,   setOrden]   = useState<Orden | null>(null);
  const [avances, setAvances] = useState<Avance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState<Msg | null>(null);
  const [descAvance, setDescAvance] = useState("");
  const [confirmCompleta, setConfirmCompleta] = useState(false);
  const [mejorandoIA,     setMejorandoIA]     = useState(false);
  const [iaModal,         setIaModal]         = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const avancesEndRef = useRef<HTMLDivElement>(null);

  // ── Inventario (C4) ───────────────────────────────────────────────────────
  const [inventario, setInventario] = useState<Repuesto[]>([]);
  const [busqInv, setBusqInv] = useState("");
  const [repuestosSeleccionados, setRepuestosSeleccionados] = useState<RepuestoSeleccionado[]>([]);
  const [mostrarInventario, setMostrarInventario] = useState(false);

  // ── Ficha Técnica (NHTSA + IA) ────────────────────────────────────────────
  const [tabActivo, setTabActivo] = useState<"avances" | "ficha">("avances");
  const [fichaTecnica, setFichaTecnica] = useState<{ complaints: any[]; recalls: any[]; vehiculo?: any; motivo_entrada?: string; cached?: boolean } | null>(null);
  const [fichaLoading, setFichaLoading] = useState(false);
  const [fichaError, setFichaError] = useState<string | null>(null);
  const [iaAnalisis, setIaAnalisis] = useState<string | null>(null);
  const [iaAnalizando, setIaAnalizando] = useState(false);
  const [fichaComponenteActivo, setFichaComponenteActivo] = useState<string | null>(null);

  const usuario: Record<string, string> =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("usuario") || "{}")
      : {};
  const nombreTecnico = usuario.nombre || usuario.name || "Técnico";
  const rolUsuario    = usuario.rol || usuario.role || "";
  const puedeMarcarListo = ["gerente", "jefe", "admin", "GERENTE", "JEFE", "ADMIN"].includes(rolUsuario);

  // ── Carga ─────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    try {
      const [rOrden, rAvances] = await Promise.all([
        fetch(`${API}/ordenes/${id}`),
        fetch(`${API}/avances/${id}`),
      ]);

      if (rOrden.ok) {
        const data = await rOrden.json();
        const ordenBase = data.orden || data;
        // GET /ordenes/:id retorna { orden, cliente, vehiculo, ... }
        // Enriquecer la orden con los campos derivados de cliente y vehículo
        if (data.cliente || data.vehiculo) {
          const cli = data.cliente || {};
          const veh = data.vehiculo || {};
          setOrden({
            ...ordenBase,
            cliente_nombre:   cli.nombre   || ordenBase.cliente_nombre   || "Sin cliente",
            cliente_telefono: cli.telefono || ordenBase.cliente_telefono || "",
            vehiculo_info:    veh.id
              ? `${veh.marca} ${veh.modelo} (${veh.placa})`
              : ordenBase.vehiculo_info || "—",
            vehiculo_marca:   veh.marca    || ordenBase.vehiculo_marca   || "",
            vehiculo_modelo:  veh.modelo   || ordenBase.vehiculo_modelo  || "",
            vehiculo_placa:   veh.placa    || ordenBase.vehiculo_placa   || "",
            vehiculo_ano:     String(veh.ano || ordenBase.vehiculo_ano   || ""),
            vehiculo_id:      veh.id || ordenBase.vehiculo_id || undefined,
          });
        } else {
          setOrden(ordenBase);
        }
      } else {
        // Fallback: GET /ordenes/:id no existe en esta versión del backend
        const rLista = await fetch(`${API}/ordenes`);
        if (rLista.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lista: any[] = await rLista.json();
          const found = (Array.isArray(lista) ? lista : []).find(
            o => String(o.id) === String(id)
          );
          if (found) setOrden(found as Orden);
          else setMsg({ tipo: "error", texto: `Orden #${id} no encontrada.` });
        }
      }

      if (rAvances.ok) {
        const data = await rAvances.json();
        setAvances(Array.isArray(data) ? data : data.avances || []);
      }
    } catch {
      setMsg({ tipo: "error", texto: "Error cargando datos." });
    } finally {
      setLoading(false);
    }
  }, [id]);

  const cargarInventario = useCallback(async () => {
    try {
      const res = await fetch(`${API}/inventario`);
      if (res.ok) {
        const data = await res.json();
        setInventario(Array.isArray(data) ? data : data.items || []);
      }
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    cargar();
    cargarInventario();
    intervalRef.current = setInterval(cargar, 20000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [cargar, cargarInventario]);

  // Scroll al último avance cuando se agregan nuevos
  useEffect(() => {
    avancesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [avances.length]);

  // ── Inventario helpers (C4) ───────────────────────────────────────────────
  const inventarioFiltrado = inventario.filter(item => {
    if (!busqInv.trim()) return true;
    const q = busqInv.toLowerCase();
    return (
      item.nombre.toLowerCase().includes(q) ||
      (item.codigo || "").toLowerCase().includes(q)
    );
  }).filter(item => item.stock > 0); // solo con stock disponible

  function agregarRepuesto(rep: Repuesto) {
    setRepuestosSeleccionados(prev => {
      const existe = prev.find(r => r.id === rep.id);
      if (existe) return prev; // ya está seleccionado
      return [...prev, {
        id: rep.id,
        nombre: rep.nombre,
        codigo: rep.codigo,
        precio: rep.precio || 0,
        cantidad: 1,
        stock: rep.stock,
      }];
    });
    setBusqInv("");
    setMostrarInventario(false);
  }

  function actualizarCantidad(repId: number, cantidad: number) {
    setRepuestosSeleccionados(prev =>
      prev.map(r => r.id === repId ? { ...r, cantidad: Math.max(1, Math.min(cantidad, r.stock)) } : r)
    );
  }

  function quitarRepuesto(repId: number) {
    setRepuestosSeleccionados(prev => prev.filter(r => r.id !== repId));
  }

  const totalRepuestos = repuestosSeleccionados.reduce(
    (sum, r) => sum + r.precio * r.cantidad, 0
  );

  // ── Agregar avance ────────────────────────────────────────────────────────
  async function agregarAvance(desc?: string) {
    const texto = (desc ?? descAvance).trim();
    if (!texto) {
      setMsg({ tipo: "error", texto: "La descripción del avance es requerida." });
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      // Construir descripción completa incluyendo repuestos usados
      let descripcionFinal = texto;
      if (repuestosSeleccionados.length > 0) {
        const listaRepuestos = repuestosSeleccionados
          .map(r => `${r.nombre}${r.codigo ? ` (${r.codigo})` : ""} x${r.cantidad}`)
          .join(", ");
        descripcionFinal += `\n\n🔩 Repuestos utilizados: ${listaRepuestos}`;
      }

      const res = await fetch(`${API}/avances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orden_id:       Number(id),
          descripcion:    descripcionFinal,
          tecnico_nombre: nombreTecnico,
          usuario_id:     usuario.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || `Error ${res.status}`);
      }

      const data = await res.json();
      const nuevo: Avance = data.avance || data;
      setAvances(prev => [...prev, nuevo]);
      setDescAvance("");

      // Descontar stock de cada repuesto seleccionado (C4)
      if (repuestosSeleccionados.length > 0) {
        await Promise.all(
          repuestosSeleccionados.map(r =>
            fetch(`${API}/inventario/${r.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ stock_delta: -r.cantidad }),
            }).catch(() => {}) // silencioso — el avance ya se guardó
          )
        );
        // Refrescar inventario con stocks actualizados
        cargarInventario();
        setRepuestosSeleccionados([]);
      }

      setMsg({ tipo: "ok", texto: "Avance agregado correctamente." });
    } catch (e: any) {
      setMsg({ tipo: "error", texto: e.message || "Error al agregar avance." });
    } finally {
      setSaving(false);
    }
  }

  // ── Marcar reparación completa → Control de Calidad ──────────────────────
  async function marcarCompleta() {
    setSaving(true);
    setMsg(null);
    setConfirmCompleta(false);

    try {
      // 1. Agregar avance de cierre
      const resAvance = await fetch(`${API}/avances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orden_id:       Number(id),
          descripcion:    "Reparación completada por técnico",
          tecnico_nombre: nombreTecnico,
          usuario_id:     usuario.id,
        }),
      });

      if (resAvance.ok) {
        const data = await resAvance.json();
        const nuevo: Avance = data.avance || data;
        setAvances(prev => [...prev, nuevo]);
      }

      // 2. Transición de estado: REPARACION → CONTROL_CALIDAD
      // Intentar primero con el endpoint específico (backend nuevo), con fallback a PATCH directo
      const resCalidad = await fetch(`${API}/ordenes/${id}/completar-reparacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id:     usuario.id,
          usuario_nombre: nombreTecnico,
          motivo:         "Reparación completada por técnico",
        }),
      });

      if (!resCalidad.ok) {
        // Fallback: usar PATCH directo (funciona con backend antiguo y nuevo)
        const resPatch = await fetch(`${API}/ordenes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            estado:         "CONTROL_CALIDAD",
            usuario_id:     usuario.id    || null,
            usuario_nombre: nombreTecnico,
          }),
        });
        if (!resPatch.ok) {
          const err = await resPatch.json().catch(() => ({}));
          throw new Error(err.error || "No se pudo mover la orden a Control de Calidad");
        }
      }

      // Refrescar la orden (con fallback si GET /ordenes/:id no existe)
      const rOrden = await fetch(`${API}/ordenes/${id}`);
      if (rOrden.ok) {
        const data = await rOrden.json();
        const ordenBase = data.orden || data;
        if (data.cliente || data.vehiculo) {
          const cli = data.cliente || {};
          const veh = data.vehiculo || {};
          setOrden({
            ...ordenBase,
            cliente_nombre:   cli.nombre   || ordenBase.cliente_nombre   || "Sin cliente",
            cliente_telefono: cli.telefono || ordenBase.cliente_telefono || "",
            vehiculo_info:    veh.id
              ? `${veh.marca} ${veh.modelo} (${veh.placa})`
              : ordenBase.vehiculo_info || "—",
            vehiculo_marca:   veh.marca    || ordenBase.vehiculo_marca   || "",
            vehiculo_modelo:  veh.modelo   || ordenBase.vehiculo_modelo  || "",
            vehiculo_placa:   veh.placa    || ordenBase.vehiculo_placa   || "",
            vehiculo_ano:     String(veh.ano || ordenBase.vehiculo_ano   || ""),
            vehiculo_id:      veh.id || ordenBase.vehiculo_id || undefined,
          });
        } else {
          setOrden(ordenBase);
        }
      } else {
        // Fallback: actualizar estado en memoria
        setOrden(prev => prev ? { ...prev, estado: "CONTROL_CALIDAD" } : prev);
      }

      setMsg({ tipo: "ok", texto: "Reparación marcada como completa. La orden está en Control de Calidad." });
    } catch (e: any) {
      setMsg({ tipo: "error", texto: e.message || "Error al completar la reparación." });
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 15 }}>
      ⏳ Cargando...
    </div>
  );

  if (!orden) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.red, fontSize: 15 }}>
      ⚠️ Orden no encontrada.
    </div>
  );

  // ── Cargar Ficha Técnica ──────────────────────────────────────────────────
  async function cargarFichaTecnica() {
    if (fichaLoading) return;
    setFichaLoading(true);
    setFichaError(null);
    setIaAnalisis(null);
    try {
      const res = await fetch(`${API}/ficha-tecnica/${id}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setFichaTecnica(data);
      if (data.complaints?.length > 0) setFichaComponenteActivo(data.complaints[0].component);
    } catch (e: any) {
      setFichaError(e.message || "Error al cargar boletines NHTSA");
    } finally {
      setFichaLoading(false);
    }
  }

  async function analizarConIA() {
    if (!fichaTecnica || iaAnalizando) return;
    setIaAnalizando(true);
    setIaAnalisis(null);
    try {
      const res = await fetch(`${API}/api/ia/analizar-falla`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orden_id: id,
          sintoma: orden.descripcion || fichaTecnica.motivo_entrada || "Sin síntoma registrado",
          vehiculo: fichaTecnica.vehiculo,
          complaints: fichaTecnica.complaints,
          recalls: fichaTecnica.recalls,
        }),
      });
      const data = await res.json();
      setIaAnalisis(data.respuesta || data.error || "Sin respuesta");
    } catch (e: any) {
      setIaAnalisis("⚠️ Error al contactar la IA: " + e.message);
    } finally {
      setIaAnalizando(false);
    }
  }

  const estadoInfo = ESTADO_INFO[orden.estado] || { label: orden.estado, color: C.muted };
  const vehiculoStr = orden.vehiculo_marca && orden.vehiculo_modelo
    ? `${orden.vehiculo_marca} ${orden.vehiculo_modelo} ${orden.vehiculo_ano || ""}`.trim()
    : orden.vehiculo_info || "—";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{
        background: "#1e293b",
        borderBottom: `1px solid ${C.border}`,
        padding: "14px 24px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}>
        <button
          onClick={() => router.push("/taller")}
          style={{ background: "transparent", color: C.muted, border: "none", cursor: "pointer", fontSize: 20, padding: 0 }}
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              🔨 Reparación — {numeroOrden(orden)}
            </h1>
            <span style={{
              background: estadoInfo.color + "22",
              color: estadoInfo.color,
              border: `1px solid ${estadoInfo.color}55`,
              borderRadius: 6,
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 700,
            }}>
              {estadoInfo.label}
            </span>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: C.muted }}>
            {orden.cliente_nombre} · {vehiculoStr}
            {orden.vehiculo_placa ? ` · ${orden.vehiculo_placa}` : ""}
          </p>
        </div>
        <button
          onClick={cargar}
          style={{
            background: C.blue + "22",
            color: C.blue,
            border: `1px solid ${C.blue}44`,
            borderRadius: 8,
            padding: "6px 14px",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          ↻ Actualizar
        </button>
      </div>

      {/* Banner control de calidad */}
      {orden.estado === "CONTROL_CALIDAD" && (
        <div style={{
          background: C.blue + "22",
          border: `1px solid ${C.blue}55`,
          borderRadius: 0,
          padding: "12px 24px",
          color: C.blue,
          fontSize: 14,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          ⚡ Esta orden está en Control de Calidad — verificando calidad antes de entrega al cliente.
        </div>
      )}

      {/* Mensaje inline */}
      {msg && (
        <div style={{
          margin: "16px 24px 0",
          background: msg.tipo === "ok" ? C.green + "22" : msg.tipo === "error" ? C.red + "22" : C.blue + "22",
          border: `1px solid ${msg.tipo === "ok" ? C.green : msg.tipo === "error" ? C.red : C.blue}55`,
          color: msg.tipo === "ok" ? C.green : msg.tipo === "error" ? C.red : C.blue,
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 13,
        }}>
          {msg.tipo === "ok" ? "✅ " : msg.tipo === "error" ? "⚠️ " : "ℹ️ "}
          {msg.texto}
        </div>
      )}

      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr 420px", gap: 24, alignItems: "start" }}>

        {/* Panel izquierdo: tabs Avances / Ficha Técnica */}
        <div>

          {/* ── Selector de pestaña ── */}
          <div style={{ display: "flex", gap: 0, marginBottom: 18, borderBottom: `1px solid ${C.border}` }}>
            {[
              { key: "avances", label: `📋 Avances (${avances.length})` },
              { key: "ficha",   label: "📡 Ficha Técnica" },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => {
                  setTabActivo(tab.key as "avances" | "ficha");
                  if (tab.key === "ficha" && !fichaTecnica && !fichaLoading) cargarFichaTecnica();
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: tabActivo === tab.key ? `2px solid ${C.cyan}` : "2px solid transparent",
                  color: tabActivo === tab.key ? C.cyan : C.muted,
                  padding: "8px 18px",
                  fontSize: 13,
                  fontWeight: tabActivo === tab.key ? 700 : 400,
                  cursor: "pointer",
                  marginBottom: -1,
                  transition: "all 0.15s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ══════════════ TAB: AVANCES ══════════════ */}
          {tabActivo === "avances" && (<>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: C.text }}>
            📋 Avances de Reparación
            <span style={{ marginLeft: 8, fontSize: 12, color: C.muted, fontWeight: 400 }}>
              ({avances.length} {avances.length === 1 ? "avance" : "avances"})
            </span>
          </h2>

          {avances.length === 0 ? (
            <div style={{
              background: C.card,
              border: `1px dashed ${C.border}`,
              borderRadius: 10,
              padding: 40,
              textAlign: "center",
              color: C.muted,
            }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🔧</div>
              <p style={{ fontSize: 14 }}>No hay avances registrados todavía.</p>
              <p style={{ fontSize: 12 }}>Agrega el primer avance cuando inicies el trabajo.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {avances.map((av, idx) => (
                <div
                  key={av.id}
                  style={{
                    background: C.card,
                    border: `1px solid ${C.border}`,
                    borderRadius: 10,
                    padding: 16,
                    display: "grid",
                    gridTemplateColumns: "32px 1fr",
                    gap: 12,
                    alignItems: "start",
                  }}
                >
                  {/* Número / línea de tiempo */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: C.green + "22",
                      border: `2px solid ${C.green}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.green,
                    }}>
                      {idx + 1}
                    </div>
                    {idx < avances.length - 1 && (
                      <div style={{ width: 2, flex: 1, minHeight: 16, background: C.border }} />
                    )}
                  </div>

                  {/* Contenido */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                          {av.tecnico_nombre}
                        </span>
                        <span style={{
                          background: C.green + "22",
                          color: C.green,
                          border: `1px solid ${C.green}44`,
                          borderRadius: 5,
                          padding: "1px 6px",
                          fontSize: 10,
                          fontWeight: 700,
                        }}>
                          ✅ Completado
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: C.muted }}>
                        {fmtFecha(av.created_at)}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                      {av.descripcion}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={avancesEndRef} />
            </div>
          )}
          </>)}

          {/* ══════════════ TAB: FICHA TÉCNICA ══════════════ */}
          {tabActivo === "ficha" && (
            <div>
              {/* Estado: cargando */}
              {fichaLoading && (
                <div style={{ textAlign: "center", padding: 60, color: C.muted }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
                  <p style={{ fontSize: 14 }}>Consultando base de datos NHTSA...</p>
                  <p style={{ fontSize: 12, color: C.muted }}>Esto puede tomar unos segundos</p>
                </div>
              )}

              {/* Estado: error */}
              {fichaError && !fichaLoading && (
                <div style={{ background: C.red + "15", border: `1px solid ${C.red}44`, borderRadius: 10, padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
                  <p style={{ color: C.red, fontSize: 13, margin: "0 0 12px" }}>{fichaError}</p>
                  <button
                    onClick={cargarFichaTecnica}
                    style={{ background: C.red + "22", color: C.red, border: `1px solid ${C.red}44`, borderRadius: 7, padding: "6px 16px", fontSize: 12, cursor: "pointer" }}
                  >↻ Reintentar</button>
                </div>
              )}

              {/* Sin datos cargados aún */}
              {!fichaTecnica && !fichaLoading && !fichaError && (
                <div style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 10, padding: 40, textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
                  <p style={{ fontSize: 14, color: C.text, marginBottom: 6 }}>Boletines de Servicio NHTSA</p>
                  <p style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>
                    Quejas reales de propietarios y recalls del fabricante para este vehículo
                  </p>
                  <button
                    onClick={cargarFichaTecnica}
                    style={{ background: C.cyan + "22", color: C.cyan, border: `1px solid ${C.cyan}44`, borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                  >
                    Consultar NHTSA
                  </button>
                </div>
              )}

              {/* Datos cargados */}
              {fichaTecnica && !fichaLoading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Info del vehículo + badge cache */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
                        {fichaTecnica.vehiculo?.marca} {fichaTecnica.vehiculo?.modelo} {fichaTecnica.vehiculo?.ano}
                      </span>
                      {fichaTecnica.vehiculo?.vin && (
                        <span style={{ marginLeft: 10, fontSize: 11, color: C.muted }}>VIN: {fichaTecnica.vehiculo.vin}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {fichaTecnica.cached && (
                        <span style={{ fontSize: 10, color: C.muted, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 5, padding: "2px 7px" }}>
                          📦 Cache
                        </span>
                      )}
                      <button
                        onClick={cargarFichaTecnica}
                        style={{ fontSize: 11, background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}
                      >↻ Actualizar</button>
                    </div>
                  </div>

                  {/* Síntoma actual */}
                  {fichaTecnica.motivo_entrada && (
                    <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>MOTIVO DE ENTRADA</span>
                      <span style={{ fontSize: 13, color: C.text }}>{fichaTecnica.motivo_entrada}</span>
                    </div>
                  )}

                  {/* ── Recalls activos ── */}
                  {fichaTecnica.recalls.length > 0 && (
                    <div style={{ background: C.red + "10", border: `1px solid ${C.red}44`, borderRadius: 10, padding: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.red }}>🔔 Recalls del Fabricante</span>
                        <span style={{ background: C.red + "22", color: C.red, border: `1px solid ${C.red}44`, borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>
                          {fichaTecnica.recalls.length}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {fichaTecnica.recalls.slice(0, 5).map((r: any, i: number) => (
                          <div key={i} style={{ background: "#0f172a", borderRadius: 8, padding: "10px 12px", borderLeft: `3px solid ${C.red}` }}>
                            {r.NHTSACampaignNumber && (
                              <span style={{ fontSize: 10, color: C.muted, display: "block", marginBottom: 3 }}>
                                Campaña: {r.NHTSACampaignNumber}
                              </span>
                            )}
                            <p style={{ margin: 0, fontSize: 12, color: C.text, lineHeight: 1.5 }}>
                              <strong>Consecuencia:</strong> {r.consequence || r.summary || "Ver detalles oficiales"}
                            </p>
                            {r.remedy && (
                              <p style={{ margin: "4px 0 0", fontSize: 12, color: C.green }}>
                                <strong>Remedio:</strong> {r.remedy}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Fallas más reportadas (por componente) ── */}
                  {fichaTecnica.complaints.length > 0 ? (
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.yellow }}>📊 Fallas Más Reportadas</span>
                        <span style={{ fontSize: 11, color: C.muted }}>
                          {fichaTecnica.complaints.reduce((s: number, c: any) => s + c.count, 0)} quejas totales · NHTSA
                        </span>
                      </div>

                      {/* Ranking de componentes */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 12, borderBottom: `1px solid ${C.border}` }}>
                        {fichaTecnica.complaints.map((c: any) => (
                          <button
                            key={c.component}
                            onClick={() => setFichaComponenteActivo(fichaComponenteActivo === c.component ? null : c.component)}
                            style={{
                              background: fichaComponenteActivo === c.component ? C.yellow + "22" : C.card2,
                              color:      fichaComponenteActivo === c.component ? C.yellow : C.muted,
                              border:     `1px solid ${fichaComponenteActivo === c.component ? C.yellow + "55" : C.border}`,
                              borderRadius: 20,
                              padding: "4px 12px",
                              fontSize: 11,
                              fontWeight: fichaComponenteActivo === c.component ? 700 : 400,
                              cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                          >
                            {c.component.split(" ").slice(0, 3).join(" ")} ({c.count})
                          </button>
                        ))}
                      </div>

                      {/* Detalle del componente seleccionado */}
                      {fichaComponenteActivo && (() => {
                        const comp = fichaTecnica.complaints.find((c: any) => c.component === fichaComponenteActivo);
                        if (!comp) return null;
                        return (
                          <div style={{ padding: 14 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: C.yellow, margin: "0 0 10px" }}>
                              {comp.component} — {comp.count} reportes
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {comp.items?.map((item: any, i: number) => (
                                <div key={i} style={{ background: C.card2, borderRadius: 8, padding: "9px 12px", borderLeft: `2px solid ${C.yellow}55` }}>
                                  <p style={{ margin: 0, fontSize: 12, color: C.text, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                                    {item.summary || "Sin descripción"}
                                  </p>
                                  {(item.injuries > 0 || item.deaths > 0) && (
                                    <span style={{ fontSize: 10, color: C.red, marginTop: 4, display: "block" }}>
                                      ⚠️ {item.injuries} heridos · {item.deaths} fallecidos
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 10, padding: 20, textAlign: "center", color: C.muted, fontSize: 13 }}>
                      No hay quejas registradas en NHTSA para este vehículo.
                    </div>
                  )}

                  {/* ── Análisis IA ── */}
                  <div style={{ background: C.card, border: `1px solid ${C.purple}44`, borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ background: C.purple + "15", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.purple }}>🤖 Análisis IA</span>
                        <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>
                          Síntoma actual vs. historial NHTSA
                        </span>
                      </div>
                      <button
                        onClick={analizarConIA}
                        disabled={iaAnalizando}
                        style={{
                          background: iaAnalizando ? C.border : C.purple + "22",
                          color:      iaAnalizando ? C.muted   : C.purple,
                          border:     `1px solid ${iaAnalizando ? C.border : C.purple + "55"}`,
                          borderRadius: 8,
                          padding: "6px 16px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: iaAnalizando ? "not-allowed" : "pointer",
                        }}
                      >
                        {iaAnalizando ? "⏳ Analizando..." : "✨ Analizar con síntoma actual"}
                      </button>
                    </div>

                    {!iaAnalisis && !iaAnalizando && (
                      <div style={{ padding: "14px 16px", fontSize: 12, color: C.muted }}>
                        Presiona el botón para que la IA correlacione el síntoma actual del vehículo
                        con las {fichaTecnica.complaints.reduce((s: number, c: any) => s + c.count, 0)} quejas
                        registradas en NHTSA y sugiera los puntos de inspección más probables.
                      </div>
                    )}

                    {iaAnalizando && (
                      <div style={{ padding: 20, textAlign: "center", color: C.muted, fontSize: 13 }}>
                        ⏳ Cruzando síntoma con datos NHTSA...
                      </div>
                    )}

                    {iaAnalisis && (
                      <div style={{ padding: "14px 16px" }}>
                        <pre style={{
                          margin: 0,
                          fontSize: 13,
                          color: C.text,
                          lineHeight: 1.7,
                          whiteSpace: "pre-wrap",
                          fontFamily: "system-ui, sans-serif",
                        }}>
                          {iaAnalisis}
                        </pre>
                        <button
                          onClick={analizarConIA}
                          style={{ marginTop: 12, background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 12px", fontSize: 11, cursor: "pointer" }}
                        >
                          ↻ Regenerar análisis
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          )}

        </div>

        {/* Panel derecho: acciones */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── C4: Selector de repuestos ── */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>
                🔩 Repuestos Utilizados
              </h3>
              <button
                onClick={() => setMostrarInventario(v => !v)}
                style={{
                  background: C.cyan + "22",
                  color: C.cyan,
                  border: `1px solid ${C.cyan}44`,
                  borderRadius: 7,
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {mostrarInventario ? "✕ Cerrar" : "+ Agregar repuesto"}
              </button>
            </div>

            {/* Buscador de inventario */}
            {mostrarInventario && (
              <div style={{ marginBottom: 12 }}>
                <input
                  type="text"
                  value={busqInv}
                  onChange={e => setBusqInv(e.target.value)}
                  placeholder="Buscar por nombre o código..."
                  autoFocus
                  style={{ ...inputStyle, marginBottom: 8 }}
                />
                {busqInv.trim().length > 0 && (
                  <div style={{
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    maxHeight: 200,
                    overflowY: "auto",
                  }}>
                    {inventarioFiltrado.length === 0 ? (
                      <div style={{ padding: "12px 14px", fontSize: 13, color: C.muted, textAlign: "center" }}>
                        Sin resultados
                      </div>
                    ) : (
                      inventarioFiltrado.slice(0, 10).map(item => (
                        <div
                          key={item.id}
                          onClick={() => agregarRepuesto(item)}
                          style={{
                            padding: "9px 14px",
                            cursor: "pointer",
                            borderBottom: `1px solid ${C.border}`,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: 13,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.border + "44")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <div>
                            <span style={{ fontWeight: 600, color: C.text }}>{item.nombre}</span>
                            {item.codigo && <span style={{ marginLeft: 6, fontSize: 11, color: C.muted }}>{item.codigo}</span>}
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            {item.precio != null && item.precio > 0 && (
                              <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>
                                ${item.precio.toFixed(2)}
                              </span>
                            )}
                            <span style={{
                              fontSize: 11,
                              background: item.stock > 5 ? C.green + "22" : C.orange + "22",
                              color: item.stock > 5 ? C.green : C.orange,
                              border: `1px solid ${item.stock > 5 ? C.green : C.orange}44`,
                              borderRadius: 5,
                              padding: "1px 6px",
                              fontWeight: 700,
                            }}>
                              Stock: {item.stock}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Lista de repuestos seleccionados */}
            {repuestosSeleccionados.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: C.muted, fontStyle: "italic" }}>
                Ningún repuesto agregado. Los repuestos usados se descontarán del inventario al guardar el avance.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {repuestosSeleccionados.map(r => (
                  <div key={r.id} style={{
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.nombre}
                      </div>
                      {r.codigo && <div style={{ fontSize: 11, color: C.muted }}>{r.codigo}</div>}
                    </div>
                    {/* Cantidad */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => actualizarCantidad(r.id, r.cantidad - 1)}
                        style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
                      >−</button>
                      <span style={{ minWidth: 28, textAlign: "center", fontSize: 13, fontWeight: 700, color: C.text }}>{r.cantidad}</span>
                      <button
                        onClick={() => actualizarCantidad(r.id, r.cantidad + 1)}
                        disabled={r.cantidad >= r.stock}
                        style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: r.cantidad >= r.stock ? C.muted : C.text, cursor: r.cantidad >= r.stock ? "not-allowed" : "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
                      >+</button>
                    </div>
                    {r.precio > 0 && (
                      <span style={{ fontSize: 12, color: C.green, fontWeight: 700, minWidth: 64, textAlign: "right", flexShrink: 0 }}>
                        ${(r.precio * r.cantidad).toFixed(2)}
                      </span>
                    )}
                    <button
                      onClick={() => quitarRepuesto(r.id)}
                      style={{ background: "transparent", border: "none", color: C.red, cursor: "pointer", fontSize: 16, padding: "0 2px", flexShrink: 0 }}
                    >×</button>
                  </div>
                ))}
                {/* Total */}
                {totalRepuestos > 0 && (
                  <div style={{
                    textAlign: "right",
                    fontSize: 13,
                    fontWeight: 700,
                    color: C.green,
                    paddingTop: 6,
                    borderTop: `1px solid ${C.border}`,
                    marginTop: 4,
                  }}>
                    Total repuestos: ${totalRepuestos.toFixed(2)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Formulario agregar avance */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: C.text }}>
              ➕ Agregar Avance
            </h3>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Descripción del trabajo realizado</label>
              <button
                type="button"
                onClick={async () => {
                  if (!descAvance.trim() || descAvance.trim().length < 10) {
                    setMsg({ tipo: "error", texto: "Escribe el trabajo antes de usar la IA." });
                    return;
                  }
                  setMejorandoIA(true);
                  setMsg(null);
                  try {
                    const r = await fetch(`${API}/api/ia/mejorar-texto`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        texto: descAvance,
                        tipo: "avance",
                        vehiculo: vehiculoStr !== "—" ? vehiculoStr : undefined,
                        cliente: orden?.cliente_nombre,
                      }),
                    });
                    const data = await r.json();
                    if (data.error) { setMsg({ tipo: "error", texto: data.error }); return; }
                    setIaModal(data.mejorado);
                  } catch {
                    setMsg({ tipo: "error", texto: "No se pudo conectar con la IA." });
                  } finally {
                    setMejorandoIA(false);
                  }
                }}
                disabled={mejorandoIA}
                style={{
                  background: mejorandoIA ? "#4c1d95" : "#7c3aed",
                  color: "#fff", border: "none", borderRadius: 7,
                  padding: "5px 12px", fontSize: 12, fontWeight: 700,
                  cursor: mejorandoIA ? "wait" : "pointer",
                }}
              >
                {mejorandoIA ? "⏳ Procesando..." : "✨ Pulir con IA"}
              </button>
            </div>
            <textarea
              value={descAvance}
              onChange={e => setDescAvance(e.target.value)}
              rows={4}
              placeholder="Describe el trabajo que realizaste en este avance..."
              style={{ ...inputStyle, resize: "vertical", marginBottom: 12 }}
            />

            {repuestosSeleccionados.length > 0 && (
              <div style={{
                background: C.cyan + "11",
                border: `1px solid ${C.cyan}33`,
                borderRadius: 7,
                padding: "8px 12px",
                marginBottom: 10,
                fontSize: 12,
                color: C.cyan,
              }}>
                🔩 Se descontarán <strong>{repuestosSeleccionados.length} repuesto(s)</strong> del inventario al guardar.
              </div>
            )}

            <button
              onClick={() => agregarAvance()}
              disabled={saving || !descAvance.trim()}
              style={{
                width: "100%",
                background: saving || !descAvance.trim() ? C.blue + "44" : C.blue,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 16px",
                fontWeight: 700,
                fontSize: 14,
                cursor: saving || !descAvance.trim() ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "⏳ Guardando..." : "➕ Agregar Avance"}
            </button>
          </div>

          {/* Info de la orden */}
          <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Datos del trabajo
            </h3>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 2 }}>
              <div><strong style={{ color: C.text }}>Orden:</strong> {numeroOrden(orden)}</div>
              <div><strong style={{ color: C.text }}>Cliente:</strong> {orden.cliente_nombre}</div>
              <div><strong style={{ color: C.text }}>Vehículo:</strong> {vehiculoStr}</div>
              {orden.vehiculo_placa && <div><strong style={{ color: C.text }}>Placa:</strong> {orden.vehiculo_placa}</div>}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                <strong style={{ color: C.text }}>Trabajo:</strong>
                <p style={{ margin: "4px 0 0", lineHeight: 1.5 }}>{orden.descripcion || "—"}</p>
              </div>
            </div>
          </div>

          {/* Ficha técnica — el técnico anota el filtro y los cuartos reales.
              Va justo antes de cerrar la reparación porque es cuando tiene el
              vehículo delante y el filtro en la mano. Lo que anote aquí queda
              para todos los del mismo modelo. */}
          {orden.estado === "REPARACION" && orden.vehiculo_id && (
            <div style={{ marginBottom: 16 }}>
              <FichaTecnicaVehiculo
                vehiculoId={orden.vehiculo_id}
                vehiculoLabel={`${orden.vehiculo_marca || ""} ${orden.vehiculo_modelo || ""} ${orden.vehiculo_ano || ""} · ${orden.vehiculo_placa || ""}`.trim()}
                usuario={nombreTecnico}
              />
            </div>
          )}

          {/* Botón marcar completa → Control Calidad */}
          {orden.estado === "REPARACION" && (
            <div>
              <button
                onClick={() => setConfirmCompleta(true)}
                disabled={saving}
                style={{
                  width: "100%",
                  background: C.orange,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                  boxShadow: `0 3px 12px ${C.orange}44`,
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                🏁 Marcar Reparación Completa → Control de Calidad
              </button>

              {/* Confirmación inline */}
              {confirmCompleta && (
                <div style={{
                  marginTop: 12,
                  background: C.orange + "11",
                  border: `1px solid ${C.orange}55`,
                  borderRadius: 10,
                  padding: 16,
                }}>
                  <p style={{ margin: "0 0 8px", fontWeight: 700, color: C.orange, fontSize: 13 }}>
                    ⚠️ ¿Confirmas que la reparación está completa?
                  </p>
                  <p style={{ margin: "0 0 14px", color: C.muted, fontSize: 12 }}>
                    Se registrará un avance de cierre y la orden pasará a <strong>Control de Calidad</strong>.
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={marcarCompleta}
                      disabled={saving}
                      style={{ flex: 1, background: C.orange, color: "#fff", border: "none", borderRadius: 7, padding: "9px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                    >
                      {saving ? "⏳..." : "✅ Confirmar"}
                    </button>
                    <button
                      onClick={() => setConfirmCompleta(false)}
                      style={{ flex: 1, background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 7, padding: "9px 12px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Auto-refresh info */}
          <div style={{ textAlign: "center", fontSize: 11, color: C.border }}>
            Auto-actualización cada 20 segundos
          </div>
        </div>
      </div>

      {/* Modal IA */}
      {iaModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: C.card, borderRadius: 16, padding: 28, width: "min(620px, 96vw)", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#a78bfa" }}>✨ Avance mejorado por IA</h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>Revisa y edita antes de aceptar</p>
              </div>
              <button onClick={() => setIaModal(null)} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Texto original</div>
              <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#94a3b8", whiteSpace: "pre-wrap", maxHeight: 80, overflowY: "auto" }}>
                {descAvance}
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>✨ Versión profesional (editable)</div>
              <textarea
                value={iaModal}
                onChange={e => setIaModal(e.target.value)}
                style={{ flex: 1, minHeight: 200, width: "100%", padding: "12px 14px", background: "#0f172a", border: "2px solid #7c3aed55", borderRadius: 8, color: "#e2e8f0", fontSize: 13, lineHeight: 1.7, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
              />
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button onClick={() => setIaModal(null)} style={{ flex: 1, padding: "10px 0", background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.muted, fontWeight: 700, cursor: "pointer" }}>✕ Descartar</button>
              <button
                onClick={() => { setDescAvance(iaModal); setIaModal(null); setMsg({ tipo: "ok", texto: "Texto mejorado aplicado al avance." }); }}
                style={{ flex: 2, padding: "10px 0", background: "#7c3aed", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}
              >✅ Aceptar y aplicar</button>
            </div>
          </div>
        </div>
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
  background: "#0f172a",
  color: "#e2e8f0",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "system-ui, sans-serif",
};
