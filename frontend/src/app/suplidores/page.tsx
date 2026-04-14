"use client";
import { useState, useEffect } from "react";

export default function SuplidoresPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState("");
  const API = "http://localhost:4000";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API}/suplidores`);
        const data = await res.json();
        setSuppliers(Array.isArray(data) ? data : []);
      } catch {
        setSuppliers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const crearSuplidor = async () => {
    if (!nombre.trim()) return alert("Nombre requerido");
    try {
      const res = await fetch(`${API}/suplidores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nombre })
      });
      const data = await res.json();
      setSuppliers(prev => [data, ...prev]);
      setNombre("");
    } catch {
      alert("Error al crear suplidor");
    }
  };

  return (
    <div style={container}>
      <h1 style={title}>📦 Suplidores</h1>

      <div style={grid}>
        <div style={card}>
          <h2 style={cardTitle}>➕ Nuevo Suplidor</h2>
          <input
            placeholder="Nombre del suplidor"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            style={input}
          />
          <button onClick={crearSuplidor} style={button}>Guardar</button>
        </div>

        <div style={card}>
          <h2 style={cardTitle}>📋 Lista de Suplidores</h2>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>ID</th>
                <th style={th}>Nombre</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={2} style={td}>Cargando...</td></tr>
              ) : suppliers.length === 0 ? (
                <tr><td colSpan={2} style={td}>Sin suplidores registrados</td></tr>
              ) : (
                suppliers.map(s => (
                  <tr key={s.id}>
                    <td style={td}>#{s.id}</td>
                    <td style={td}>{s.name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const container = { padding: "20px", background: "#f5f7fb", minHeight: "100vh" };
const title = { fontSize: "28px", fontWeight: "bold" as const, marginBottom: "20px" };
const grid = { display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px" };
const card: any = { background: "#fff", padding: "20px", borderRadius: "15px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" };
const cardTitle = { marginBottom: "15px", fontSize: "18px", fontWeight: "600" as const };
const input: any = { display: "block", marginBottom: "10px", padding: "12px", width: "100%", borderRadius: "8px", border: "1px solid #ddd", boxSizing: "border-box" as const };
const button: any = { padding: "12px", background: "#111827", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", width: "100%" };
const table: any = { width: "100%", borderCollapse: "collapse" };
const th: any = { textAlign: "left", padding: "10px", background: "#f1f5f9", fontSize: 13 };
const td: any = { padding: "10px", borderBottom: "1px solid #eee" };