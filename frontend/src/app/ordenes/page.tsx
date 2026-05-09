"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { API_URL as API } from "@/config";

interface Order {
  id: number;
  descripcion: string;
  estado: string;
  total: number;
  created_at: string;
  cliente_nombre: string;
  vehiculo_info: string;
}

interface Cliente { id: number; nombre: string; }
interface Vehiculo { id: number; marca: string; modelo: string; placa: string; cliente_id: number; }

const ESTADOS = ["RECIBIDO", "DIAGNOSTICO", "ESPERANDO_APROBACION", "REPARACION", "CONTROL_CALIDAD", "LISTO", "ENTREGADO", "CANCELADA"];

const STATUS_COLORS: Record<string, string> = {
  RECIBIDO:             "#3b82f6",
  DIAGNOSTICO:          "#f59e0b",
  ESPERANDO_APROBACION: "#f97316",
  REPARACION:           "#ef4444",
  CONTROL_CALIDAD:      "#8b5cf6",
  LISTO:                "#10b981",
  ENTREGADO:            "#6b7280",
  CANCELADA:            "#dc2626",
};



export default function OrdenesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"lista" | "nueva">("lista");
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");

  const showToast = useCallback((msg: string, tipo: "ok" | "err" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const [form, setForm] = useState({
    cliente_id: "",
    vehiculo_id: "",
    descripcion: ""
  });

  const fetchAll = async () => {
  try {
    // 1. Haces las peticiones en paralelo
    const [oRes, cRes, vRes] = await Promise.all([
      fetch(`${API}/ordenes`),
      fetch(`${API}/clientes`),
      fetch(`${API}/vehiculos`)
    ]);
      const o = await oRes.json();
      const c = await cRes.json();
      const v = await vRes.json();
      setOrders(Array.isArray(o) ? o : []);
      setClientes(Array.isArray(c) ? c : []);
      setVehiculos(Array.isArray(v) ? v : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, []);

  const vehiculosFiltrados = vehiculos.filter(
    v => String(v.cliente_id) === String(form.cliente_id)
  );

  const crearOrden = async () => {
    setFormError("");
    if (!form.cliente_id) return setFormError("Selecciona un cliente");
    if (!form.vehiculo_id) return setFormError("Selecciona un vehículo");
    if (!form.descripcion.trim()) return setFormError("Escribe la descripción del trabajo");

    try {
      const usr = JSON.parse(localStorage.getItem("usuario") || "{}");
      const res = await fetch(`${API}/ordenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id:      Number(form.cliente_id),
          vehiculo_id:     Number(form.vehiculo_id),
          descripcion:     form.descripcion,
          usuario_id:      usr.id     || null,
          usuario_nombre:  usr.nombre || "Sistema",
        })
      });
      const data = await res.json();
      if (data.error) return setFormError(data.error);
      showToast(`✅ Orden ${data.numero_orden || "creada"} correctamente`);
      setForm({ cliente_id: "", vehiculo_id: "", descripcion: "" });
      setTab("lista");
      fetchAll();
    } catch {
      setFormError("Error al crear orden. Verifica tu conexión.");
    }
  };

  const eliminarOrden = async (id: number) => {
    setConfirmId(id);
  };

  const confirmarEliminar = async () => {
    if (!confirmId) return;
    try {
      await fetch(`${API}/ordenes/${confirmId}`, { method: "DELETE" });
      showToast("🗑️ Orden eliminada");
      fetchAll();
    } catch {
      showToast("Error al eliminar", "err");
    } finally {
      setConfirmId(null);
    }
  };

  return (
    <div style={container}>
      <h1 style={title}>🧾 Órdenes de Trabajo</h1>

      {/* TOAST */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: toast.tipo === "ok" ? "#10b981" : "#ef4444",
          color: "#fff", padding: "12px 20px", borderRadius: 10,
          fontWeight: 600, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          animation: "fadeIn .2s ease"
        }}>{toast.msg}</div>
      )}

      {/* MODAL CONFIRMAR ELIMINAR */}
      {confirmId && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998
        }}>
          <div style={{
            background: "#1e293b", borderRadius: 14, padding: "28px 32px",
            border: "1px solid #334155", maxWidth: 360, width: "90%", textAlign: "center"
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#f1f5f9", marginBottom: 8 }}>¿Eliminar esta orden?</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>Esta acción no se puede deshacer.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setConfirmId(null)}
                style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "#94a3b8", cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={confirmarEliminar}
                style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}


      {/* TABS */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {(["lista", "nueva"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...tabBtn, background: tab === t ? "#111827" : "#fff", color: tab === t ? "#fff" : "#111" }}>
            {t === "lista" ? "📋 Lista de Órdenes" : "➕ Nueva Orden"}
          </button>
        ))}
      </div>

      {/* NUEVA ORDEN */}
      {tab === "nueva" && (
        <div style={{ maxWidth: 560 }}>
          <div style={card}>
            <h2 style={cardTitle}>➕ Nueva Orden de Trabajo</h2>

            <label style={label}>Cliente</label>
            <select
              value={form.cliente_id}
              onChange={e => setForm({ ...form, cliente_id: e.target.value, vehiculo_id: "" })}
              style={input}
            >
              <option value="">— Seleccionar cliente —</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>

            <label style={label}>Vehículo</label>
            <select
              value={form.vehiculo_id}
              onChange={e => setForm({ ...form, vehiculo_id: e.target.value })}
              style={input}
              disabled={!form.cliente_id}
            >
              <option value="">— Seleccionar vehículo —</option>
              {vehiculosFiltrados.map(v => (
                <option key={v.id} value={v.id}>
                  {v.marca} {v.modelo} · {v.placa}
                </option>
              ))}
            </select>
            {form.cliente_id && vehiculosFiltrados.length === 0 && (
              <p style={{ color: "#e74c3c", fontSize: 13, marginTop: -6, marginBottom: 10 }}>
                Este cliente no tiene vehículos registrados
              </p>
            )}

            <label style={label}>Descripción del trabajo</label>
            <textarea
              placeholder="Ej: Cambio de aceite, revisión de frenos..."
              value={form.descripcion}
              onChange={e => setForm({ ...form, descripcion: e.target.value })}
              rows={4}
              style={{ ...input, resize: "vertical" }}
            />

            {formError && (
              <div style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 4 }}>
                ⚠️ {formError}
              </div>
            )}

            <button onClick={crearOrden} style={btnPrimary}>
              Crear Orden
            </button>
          </div>
        </div>
      )}

      {/* LISTA */}
      {tab === "lista" && (
        <div style={card}>
          {loading ? (
            <p>Cargando órdenes...</p>
          ) : orders.length === 0 ? (
            <p style={{ color: "#888" }}>No hay órdenes registradas</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>ID</th>
                    <th style={th}>Cliente</th>
                    <th style={th}>Vehículo</th>
                    <th style={th}>Descripción</th>
                    <th style={th}>Estado</th>
                    <th style={th}>Fecha</th>
                    <th style={th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const color = STATUS_COLORS[o.estado] || "#7f8c8d";
                    return (
                      <tr key={o.id}>
                        <td style={{ ...td, fontWeight: 700, whiteSpace: "nowrap" }}>
                          {(o as any).numero_orden || `OT-${String(o.id).padStart(4, "0")}`}
                        </td>
                        <td style={{ ...td, fontWeight: 600 }}>{o.cliente_nombre}</td>
                        <td style={td}>{o.vehiculo_info}</td>
                        <td style={{ ...td, maxWidth: 200 }}>{o.descripcion}</td>
                        <td style={td}>
                          <span style={{
                            background: color + "22",
                            color,
                            border: `1.5px solid ${color}44`,
                            borderRadius: 14,
                            padding: "4px 12px",
                            fontWeight: 800,
                            fontSize: 11,
                            whiteSpace: "nowrap",
                          }}>
                            {o.estado}
                          </span>
                        </td>
                        <td style={td}>
                          {o.created_at
                            ? new Date(o.created_at).toLocaleString("es-DO")
                            : "Sin fecha"}
                        </td>
                        <td style={{ ...td, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <Link href={`/ordenes/${o.id}`}>
                            <button style={{ padding: "5px 10px", background: "#dbeafe", color: "#1d4ed8", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                              👁 Ver
                            </button>
                          </Link>
                          <button
                            onClick={() => eliminarOrden(o.id)}
                            style={btnEliminar}
                          >
                            🗑 Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const container: any = { padding: "20px", background: "#f5f7fb", minHeight: "100vh" };
const title: any = { fontSize: "28px", fontWeight: "bold", marginBottom: "20px" };
const card: any = { background: "#fff", padding: "20px", borderRadius: "15px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" };
const cardTitle: any = { marginBottom: "15px", fontSize: "18px", fontWeight: "600" };
const tabBtn: any = { padding: "10px 20px", borderRadius: "8px", border: "1px solid #ddd", cursor: "pointer", fontWeight: 600 };
const label: any = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#555" };
const input: any = { display: "block", marginBottom: "14px", padding: "12px", width: "100%", borderRadius: "8px", border: "1px solid #ddd", boxSizing: "border-box", fontSize: 14 };
const btnPrimary: any = { padding: "13px", background: "#111827", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", width: "100%", fontSize: 15, fontWeight: 700 };
const btnEliminar: any = { padding: "5px 10px", background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 };
const table: any = { width: "100%", borderCollapse: "collapse" };
const th: any = { textAlign: "left", padding: "10px 12px", background: "#f1f5f9", fontSize: 13, whiteSpace: "nowrap" };
const td: any = { padding: "10px 12px", borderBottom: "1px solid #eee", fontSize: 14 };