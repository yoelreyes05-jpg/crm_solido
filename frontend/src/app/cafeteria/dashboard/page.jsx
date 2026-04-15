"use client";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);

  const obtenerVentas = async () => {
    try {
      const res = await fetch("h`${API}/cafeteria/ventas");
      const data = await res.json();
      setVentas(data);
    } catch (error) {
      console.error("Error cargando ventas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    obtenerVentas();
  }, []);

  // 📅 Fecha de hoy
  const hoy = new Date().toDateString();

  // 💰 Ventas de hoy
  const ventasHoy = ventas.filter(
    (v) => new Date(v.created_at).toDateString() === hoy
  );

  const totalHoy = ventasHoy.reduce((acc, v) => acc + v.total, 0);

  // 📆 Ventas del mes
  const mesActual = new Date().getMonth();
  const ventasMes = ventas.filter(
    (v) => new Date(v.created_at).getMonth() === mesActual
  );

  const totalMes = ventasMes.reduce((acc, v) => acc + v.total, 0);

  // 💳 Métodos de pago
  const conteoPagos = ventas.reduce((acc, v) => {
    acc[v.metodo_pago] = (acc[v.metodo_pago] || 0) + 1;
    return acc;
  }, {});

  if (loading) return <p>Cargando dashboard...</p>;

  return (
    <div style={{ padding: "20px", background: "#f5f5f5", minHeight: "100vh" }}>
      <h1>📊 Dashboard Cafetería</h1>

      {/* 🔢 KPIs */}
      <div style={gridStyle}>
        <Card title="💰 Ventas Hoy" value={`RD$ ${totalHoy}`} />
        <Card title="📅 Ventas del Mes" value={`RD$ ${totalMes}`} />
        <Card title="🧾 Total Ventas" value={ventas.length} />
        <Card title="☕ Ventas Hoy (Cantidad)" value={ventasHoy.length} />
      </div>

      {/* 💳 Métodos de pago */}
      <div style={{ marginTop: "30px" }}>
        <h2>💳 Métodos de Pago</h2>
        <div style={gridStyle}>
          {Object.keys(conteoPagos).map((metodo) => (
            <Card
              key={metodo}
              title={metodo}
              value={`${conteoPagos[metodo]} ventas`}
            />
          ))}
        </div>
      </div>

      {/* 🧾 Últimas ventas */}
      <div style={{ marginTop: "40px" }}>
        <h2>🧾 Últimas Ventas</h2>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Total</th>
              <th>Método</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {ventas.slice().reverse().map((v) => (
              <tr key={v.id}>
                <td>{v.id}</td>
                <td>RD$ {v.total}</td>
                <td>{v.metodo_pago}</td>
                <td>{new Date(v.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 🧱 COMPONENTE CARD
function Card({ title, value }) {
  return (
    <div style={cardStyle}>
      <h3 style={{ marginBottom: "10px" }}>{title}</h3>
      <p style={{ fontSize: "22px", fontWeight: "bold" }}>{value}</p>
    </div>
  );
}

// 🎨 ESTILOS
const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "15px",
  marginTop: "20px",
};

const cardStyle = {
  background: "#fff",
  padding: "20px",
  borderRadius: "12px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
};

const tableStyle = {
  width: "100%",
  marginTop: "15px",
  borderCollapse: "collapse",
  background: "#fff",
};
