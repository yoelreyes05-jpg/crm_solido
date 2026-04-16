"use client";
import { useEffect, useState } from "react";

import { API } from "@/config";

export default function VentasPage() {
  const [ventas, setVentas] = useState([]);
  const [resumen, setResumen] = useState({ total: 0, cantidad: 0, itbis: 0 });
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const fetchVentas = async () => {
    try {
      const res = await fetch(`${API}/ventas`);
      const data = await res.json();
      const lista = Array.isArray(data) ? data : [];
      setVentas(lista);
      calcularResumen(lista);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const calcularResumen = (lista) => {
    const total = lista.reduce((acc, v) => acc + Number(v.total || 0), 0);
    const itbis = lista.reduce((acc, v) => acc + Number(v.itbis || 0), 0);
    setResumen({ total, itbis, cantidad: lista.length });
  };

  useEffect(() => { fetchVentas(); }, []);

  const ventasFiltradas = ventas.filter(v => {
    const matchBusqueda = !busqueda ||
      v.customer_name?.toLowerCase().includes(busqueda.toLowerCase()) ||
      v.ncf?.toLowerCase().includes(busqueda.toLowerCase());

    const fecha = new Date(v.created_at);
    const matchDesde = !fechaDesde || fecha >= new Date(fechaDesde);
    const matchHasta = !fechaHasta || fecha <= new Date(fechaHasta + "T23:59:59");

    return matchBusqueda && matchDesde && matchHasta;
  });

  const totalFiltrado = ventasFiltradas.reduce((acc, v) => acc + Number(v.total || 0), 0);
  const itbisFiltrado = ventasFiltradas.reduce((acc, v) => acc + Number(v.itbis || 0), 0);

  const limpiarFiltros = () => {
    setBusqueda("");
    setFechaDesde("");
    setFechaHasta("");
  };

  return (
    <div style={container}>
      <h1 style={title}>💰 Ventas</h1>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
        <div style={kpiCard("#10b981")}>
          <div style={kpiLabel}>💰 Total Ventas</div>
          <div style={kpiNum}>RD$ {Number(resumen.total).toLocaleString("es-DO", { minimumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>{resumen.cantidad} facturas</div>
        </div>
        <div style={kpiCard("#3b82f6")}>
          <div style={kpiLabel}>🧾 ITBIS Total</div>
          <div style={kpiNum}>RD$ {Number(resumen.itbis).toLocaleString("es-DO", { minimumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>18% sobre ventas</div>
        </div>
        <div style={kpiCard("#8b5cf6")}>
          <div style={kpiLabel}>📊 Período Filtrado</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#111", marginTop: 4 }}>
            RD$ {totalFiltrado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>{ventasFiltradas.length} registros</div>
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", marginBottom: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: 2, minWidth: 200 }}>
          <label style={label}>🔍 Buscar cliente o NCF</label>
          <input
            placeholder="Nombre del cliente o número NCF..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={input}
          />
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={label}>📅 Desde</label>
          <input type="date" value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)} style={input} />
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={label}>📅 Hasta</label>
          <input type="date" value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)} style={input} />
        </div>
        <button onClick={limpiarFiltros}
          style={{ padding: "12px 20px", background: "#f1f5f9", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap" }}>
          🗑️ Limpiar
        </button>
      </div>

      {/* RESUMEN FILTRADO */}
      {(fechaDesde || fechaHasta || busqueda) && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 24, fontSize: 14 }}>
          <span>📊 <b>{ventasFiltradas.length}</b> ventas en el período</span>
          <span>💰 Total: <b>RD$ {totalFiltrado.toFixed(2)}</b></span>
          <span>🧾 ITBIS: <b>RD$ {itbisFiltrado.toFixed(2)}</b></span>
        </div>
      )}

      {/* TABLA */}
      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#111827" }}>
              {["Factura", "NCF", "Tipo", "Cliente", "Método", "Subtotal", "ITBIS", "Total", "Estado", "Fecha"].map(h => (
                <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 14, color: "#fff", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: "center", color: "#aaa", fontSize: 15 }}>Cargando ventas...</td></tr>
            ) : ventasFiltradas.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: "center", color: "#aaa", fontSize: 15 }}>Sin ventas en este período</td></tr>
            ) : ventasFiltradas.map((v, i) => {
              const cancelada = v.estado === "CANCELADA";
              return (
                <tr key={v.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb", opacity: cancelada ? 0.6 : 1, borderBottom: "1px solid #f0f0f0" }}>
                  <td style={td}><b>FAC-{String(v.id).padStart(5, "0")}</b></td>
                  <td style={{ ...td, fontSize: 12 }}>{v.ncf}</td>
                  <td style={td}>
                    <span style={{ background: "#dbeafe", color: "#1e40af", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                      {v.ncf_tipo}
                    </span>
                  </td>
                  <td style={{ ...td, fontWeight: 600 }}>{v.customer_name}</td>
                  <td style={td}>{v.method}</td>
                  <td style={td}>RD$ {Number(v.subtotal).toFixed(2)}</td>
                  <td style={td}>RD$ {Number(v.itbis).toFixed(2)}</td>
                  <td style={{ ...td, fontWeight: 800, color: "#10b981" }}>RD$ {Number(v.total).toFixed(2)}</td>
                  <td style={td}>
                    {cancelada
                      ? <span style={{ background: "#fee2e2", color: "#dc2626", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>CANCELADA</span>
                      : <span style={{ background: "#dcfce7", color: "#16a34a", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>ACTIVA</span>
                    }
                  </td>
                  <td style={{ ...td, fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>
                    {v.created_at ? new Date(v.created_at).toLocaleString("es-DO") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* TOTAL VISIBLE */}
      {ventasFiltradas.length > 0 && (
        <div style={{ marginTop: 16, background: "#111827", borderRadius: 12, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff" }}>
          <span style={{ fontSize: 15, color: "#9ca3af" }}>{ventasFiltradas.length} ventas mostradas</span>
          <span style={{ fontSize: 20, fontWeight: 800 }}>
            Total: RD$ {totalFiltrado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}
    </div>
  );
}

const container = { padding: "24px", background: "#f5f7fb", minHeight: "100vh" };
const title = { fontSize: 28, fontWeight: 900, marginBottom: 24 };
const kpiCard = (color) => ({
  background: "#fff", borderRadius: 14, padding: "20px",
  boxShadow: "0 2px 12px rgba(0,0,0,0.06)", borderLeft: `5px solid ${color}`
});
const kpiLabel = { fontSize: 13, color: "#888", marginBottom: 8, fontWeight: 600 };
const kpiNum = { fontSize: 26, fontWeight: 900, color: "#111" };
const label = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5, color: "#555" };
const input = { display: "block", padding: "12px", width: "100%", borderRadius: 8, border: "1px solid #ddd", boxSizing: "border-box", fontSize: 14, marginBottom: 0 };
const td = { padding: "13px 16px", fontSize: 14 };